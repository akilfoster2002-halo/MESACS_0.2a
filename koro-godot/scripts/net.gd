## NET — signing in, the progress bag on your account, and the room.
##
## The same server the browser talks to (server/index.js), spoken to the same
## way (public/net.js): the HTTP API for your account, saved progress and
## texts, and the /ws socket for the room — who is here, where they are
## standing, and what they say.
##
## THE SESSION IS A COOKIE, `mq`, exactly the one the browser keeps: the
## server sets it on sign-in, and it is sent back on every request and on the
## socket's handshake. It is kept on this machine, so you stay signed in
## between launches the way a browser does.
##
## A ROOM NEEDS A SERVER THAT STAYS UP. The website on Vercel answers
## requests but cannot hold a socket, so there the room never opens — your
## account, your coins and your texts still work, and the game says so once.
## The Mac app's server, `npm run dev` and `npm start` all hold rooms.
class_name Net
extends Node

signal changed
signal players_in(list: Array)
signal said(line: Dictionary)          # {from, text} or {sys}
signal buzz(msg: Dictionary)           # a text arrived

## Where KORO lives unless a class runs its own: the Render service, which
## holds rooms (a socket needs a server that stays up). Free plan, so it
## sleeps when nobody is on and takes up to a minute to wake — see WAKE.
const DEFAULT_SERVER := "https://koro-server.onrender.com"
const WAKE := 75.0

const ROOMS := [["meadow", "Meadow"], ["canyon", "Canyon"], ["harbour", "Harbour"],
	["summit", "Summit"], ["orchard", "Orchard"], ["lagoon", "Lagoon"]]

var world: Node3D
var base := ""
var cookie := ""
var me := {}
var room := "meadow"
var ws: WebSocketPeer = null
var live := false
var want := false
var retry := 0
var retry_t := 0.0
var fails := 0
var told_no_rooms := false
var sent_t := 0.0
var save_t := 0.0
var roster: Array = []
var muted_until := 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	base = str(Settings.get_value("server", "")).strip_edges().trim_suffix("/")
	if base == "":
		base = DEFAULT_SERVER
	cookie = str(Settings.get_value("cookie", ""))
	room = str(Settings.get_value("room", "meadow"))
	if base != "" and cookie != "":
		resume()

func signed_in() -> bool:
	return not me.is_empty()

func set_server(url: String) -> void:
	url = url.strip_edges().trim_suffix("/")
	if url == "":
		url = DEFAULT_SERVER
	if not url.begins_with("http"):
		url = "https://" + url
	if url != base:
		_close()
		me = {}
		cookie = ""
		Settings.set_value("cookie", "")
	base = url
	Settings.set_value("server", url)

func set_room(id: String) -> void:
	room = id
	Settings.set_value("room", id)
	if live:
		_send({"t": "join", "server": room})

# ------------------------------------------------------------------ HTTP

func api(path: String, body: Variant = null) -> Dictionary:
	if base == "":
		return {"ok": false, "error": "Type the server's address first."}
	var req := HTTPRequest.new()
	req.timeout = WAKE
	add_child(req)
	var headers := PackedStringArray(["Content-Type: application/json", "Accept: application/json"])
	if cookie != "":
		headers.append("Cookie: mq=" + cookie)
	var method := HTTPClient.METHOD_POST if body != null else HTTPClient.METHOD_GET
	var err := req.request(base + "/api" + path, headers, method, JSON.stringify(body) if body != null else "")
	if err != OK:
		req.queue_free()
		return {"ok": false, "error": "Could not reach the server."}
	var res: Array = await req.request_completed
	req.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "error": "Could not reach the server."}
	for h in (res[2] as PackedStringArray):
		if h.to_lower().begins_with("set-cookie:") and "mq=" in h:
			cookie = h.substr(h.find("mq=") + 3).split(";")[0].strip_edges()
			Settings.set_value("cookie", cookie)
	var j = JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())
	if not (j is Dictionary):
		return {"ok": false, "error": "That is not a KORO server (it answered %d)." % res[1]}
	if int(res[1]) >= 400 or not j.get("ok", false):
		j["ok"] = false
		if not j.has("error"):
			j["error"] = "Error %d" % res[1]
	return j

func resume() -> void:
	var j := await api("/me")
	if j.ok:
		_signed(j.user)
	else:
		me = {}
		changed.emit()

func login(username: String, password: String) -> String:
	var j := await api("/login", {"username": username, "password": password})
	if not j.ok:
		return str(j.error)
	_signed(j.user)
	return ""

func register(username: String, password: String, display: String) -> String:
	var j := await api("/register", {"username": username, "password": password, "display": display})
	if not j.ok:
		return str(j.error)
	_signed(j.user)
	return ""

func logout() -> void:
	await api("/logout", {})
	cookie = ""
	Settings.set_value("cookie", "")
	me = {}
	_close()
	changed.emit()

## Signed in: the account's bag is the truth (merged with anything done here
## first), who you are and what you drive follow it, and the room opens.
func _signed(user: Dictionary) -> void:
	me = user
	var p = user.get("progress", {})
	Progress.adopt(p if p is Dictionary else {})
	if world and is_instance_valid(world) and world.player:
		world.player.set_character(str(Progress.get_value("char", world.player.character)))
		world.car.set_paint(Wallet.paint())
		for b in world.buildings:
			b.refresh()
	changed.emit()
	_open()

# ------------------------------------------------------------------ the room

func _open() -> void:
	if me.is_empty() or base == "":
		return
	want = true
	ws = WebSocketPeer.new()
	ws.handshake_headers = PackedStringArray(["Cookie: mq=" + cookie])
	var url := base.replace("https://", "wss://").replace("http://", "ws://") + "/ws"
	if ws.connect_to_url(url) != OK:
		ws = null
		_later()

func _close() -> void:
	want = false
	if ws:
		ws.close()
	ws = null
	live = false
	roster = []
	players_in.emit([])

## Back off, but never further than ten seconds — or thirty, once it is clear
## this server does not hold rooms at all.
func _later() -> void:
	retry += 1
	fails += 1
	retry_t = minf(30.0 if fails > 3 else 10.0, 0.7 * pow(2.0, mini(retry, 4)))
	if fails == 3 and not told_no_rooms:
		told_no_rooms = true
		said.emit({"sys": "This server has no live rooms right now — your account, coins and texts still work."})

func _send(m: Dictionary) -> void:
	if ws and live:
		ws.send_text(JSON.stringify(m))

func say(text: String) -> void:
	_send({"t": "chat", "text": text})

func _process(delta: float) -> void:
	if signed_in() and Progress.owed:
		save_t -= delta
		if save_t <= 0.0:
			save_t = 1.5
			Progress.owed = false
			api("/progress", {"progress": Progress.bag})
	if ws == null:
		if want and signed_in():
			retry_t -= delta
			if retry_t <= 0.0:
				_open()
		return
	ws.poll()
	match ws.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			if not live:
				live = true
				if retry > 0 and fails > 0:
					said.emit({"sys": "Back on the server."})
				retry = 0
				fails = 0
				_send({"t": "join", "server": room})
				changed.emit()
			while ws.get_available_packet_count() > 0:
				var m = JSON.parse_string(ws.get_packet().get_string_from_utf8())
				if m is Dictionary:
					_heard(m)
			sent_t -= delta
			if sent_t <= 0.0:
				sent_t = 0.09
				_where()
		WebSocketPeer.STATE_CLOSED:
			var code := ws.get_close_code()
			ws = null
			var was := live
			live = false
			roster = []
			players_in.emit([])
			changed.emit()
			if code == 4001:
				want = false
				said.emit({"sys": "Sign in again to rejoin the room."})
				return
			if was:
				said.emit({"sys": "Lost the server — trying to get back."})
			_later()

## Where we are, in the words the browser uses: longitude and latitude, the
## heading in the frame under our own feet (the one number that means the
## same thing on both screens), metres over the ground, who we are wearing,
## what the body is doing, and the car if we are in one.
func _where() -> void:
	if world == null or not is_instance_valid(world) or world.player == null:
		return
	var p: Walker = world.player
	var d := p.dir
	if world.piloting():
		d = world.mecha.dir
	var f := Planet.frame_at(d)
	var lon := rad_to_deg(atan2(d.x, d.z))
	var lat := rad_to_deg(asin(clampf(d.y, -1.0, 1.0)))
	var heading := atan2(p.fwd.dot(f.x), p.fwd.dot(f.z))
	var over := maxf(0.0, p.alt - world.base_floor(d))
	var act := "idle"
	if p.ap and p.ap.current_animation != "":
		act = p.ap.current_animation
	_send({"t": "pos", "x": snappedf(lon, 0.01), "z": snappedf(lat, 0.01), "yaw": snappedf(heading, 0.001),
		"y": snappedf(over, 0.01), "char": p.character, "act": act,
		"ride": Wallet.car_id() if p.car else null, "at": Worlds.current})

func _heard(m: Dictionary) -> void:
	match str(m.get("t", "")):
		"players":
			var mine: int = int(me.get("id", -1))
			roster = (m.players as Array).filter(func(x): return int(x.id) != mine)
			players_in.emit(roster)
		"chat":
			said.emit({"from": m.get("from", "?"), "text": m.get("text", "")})
		"room":
			for h in m.get("history", []):
				said.emit({"from": h.get("display", "?"), "text": h.get("text", ""), "old": true})
		"joined":
			said.emit({"sys": "%s joined" % m.get("display", "?")})
		"left":
			said.emit({"sys": "%s left" % m.get("display", "?")})
		"moved":
			var went := {"outside": "came back outside", "workshop": "went into the Workshop", "house": "went home",
				"counter": "went into the Wardrobe", "mission": "went into a mission", "gym": "went into the Gym", "space": "launched"}
			if went.has(m.get("where", "")):
				said.emit({"sys": "%s %s" % [m.get("display", "?"), went[m.where]]})
		"sys":
			said.emit({"sys": str(m.get("text", ""))})
		"muted":
			muted_until = float(m.get("until", 0)) / 1000.0
			said.emit({"sys": "Your teacher muted the chat for you." if muted_until > Time.get_unix_time_from_system() else "You can chat again."})
		"dm":
			buzz.emit(m)

# ------------------------------------------------------------------ the phone

func threads() -> Dictionary:
	return await api("/phone/threads")

func thread(username: String) -> Dictionary:
	return await api("/phone/thread/" + username.uri_encode())

func text(to: String, body: String) -> Dictionary:
	return await api("/phone/send", {"to": to, "text": body})

func unread() -> Dictionary:
	return await api("/phone/unread")

func find(q: String) -> Dictionary:
	return await api("/phone/find?q=" + q.uri_encode())
