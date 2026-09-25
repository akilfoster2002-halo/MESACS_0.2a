## TALKING TO SOMEBODY — Kit, Ada, Volt: a real conversation (server/npc.js).
##
## E next to them opens this; type, Enter, and they answer as themselves.
## Each is guarded on the server to their own topics, so a question outside
## them gets a line in character pointing back at what they know. The last
## few lines go with every message so they remember what was just said;
## nothing is kept once you walk away from the game.
class_name Talk
extends PanelContainer

const KEEP := 10

var net: Net
var hud: Node
var who := ""
var title: Label
var log: RichTextLabel
var line: LineEdit
var send: Button
var busy := false
var said: Dictionary = {}        # npc id -> [{role, text}], this session only

func build(n: Net, h: Node) -> Talk:
	net = n
	hud = h
	custom_minimum_size = Vector2(680, 460)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	add_child(col)
	title = Label.new()
	title.add_theme_font_size_override("font_size", 24)
	col.add_child(title)
	log = RichTextLabel.new()
	log.bbcode_enabled = true
	log.scroll_following = true
	log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	log.add_theme_font_size_override("normal_font_size", 17)
	log.add_theme_font_size_override("bold_font_size", 17)
	col.add_child(log)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	col.add_child(row)
	line = LineEdit.new()
	line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.max_length = 400
	line.text_submitted.connect(func(_t): _say())
	row.add_child(line)
	send = Button.new()
	send.text = "Say"
	send.custom_minimum_size = Vector2(90, 0)
	send.pressed.connect(_say)
	row.add_child(send)
	var hint := Label.new()
	hint.text = "Enter to say it  ·  Esc to walk away"
	hint.add_theme_font_size_override("font_size", 13)
	hint.modulate = Color(1, 1, 1, 0.6)
	col.add_child(hint)
	return self

## Face `id` (whose name is `name`), with whatever you two said before.
func open(id: String, name: String, hello: String) -> void:
	who = id
	title.text = name.to_upper()
	line.placeholder_text = "Say something to %s…" % name
	if not said.has(id):
		said[id] = [{"role": "npc", "text": hello}]
	_paint()
	if not net.signed_in():
		log.append_text("\n[color=#ffd766]Sign in to talk — P → Your account.[/color]")
	line.grab_focus.call_deferred()

func _paint() -> void:
	log.clear()
	for m in said[who]:
		if m.role == "npc":
			log.append_text("[b][color=#8ff0ff]%s[/color][/b]  %s\n\n" % [title.text.capitalize(), _plain(m.text)])
		else:
			log.append_text("[b][color=#ffd766]You[/color][/b]  %s\n\n" % _plain(m.text))

func _plain(t: String) -> String:
	return t.replace("[", "[lb]")

func _say() -> void:
	var t := line.text.strip_edges()
	if t == "" or busy:
		return
	if not net.signed_in():
		hud.say("Sign in first — P → Your account.", 3.0)
		return
	busy = true
	line.text = ""
	send.disabled = true
	var id := who
	var hist: Array = (said[id] as Array).slice(-KEEP)
	said[id].append({"role": "me", "text": t})
	_paint()
	log.append_text("[i][color=#9aa6c8]%s is thinking…[/color][/i]" % title.text.capitalize())
	var j := await net.api("/npc", {"npc": id, "text": t, "history": hist, "context": _context()})
	busy = false
	send.disabled = false
	var answer: String = str(j.get("text", "")) if j.get("ok", false) else "(%s)" % str(j.get("error", "No answer."))
	said[id].append({"role": "npc", "text": answer})
	if who == id:
		_paint()
		line.grab_focus()

## What they may know about you: true things from your own wallet, so Kit
## can say how far you are from a Seraph instead of guessing.
func _context() -> Dictionary:
	var cars := []
	for c in Wallet.CARS:
		cars.append({"name": c.name, "price": c.price, "owned": Wallet.owns_car(c.id)})
	var mechs := []
	for m in Wallet.MECHS:
		mechs.append({"name": m.name, "price": m.price, "owned": Wallet.owns_mech(m.id)})
	return {"coins": Wallet.coins(), "level": Wallet.level(), "cars": cars, "mechas": mechs,
		"has_ship": Building.has_ship(), "world": Worlds.get_world(Worlds.current).name}
