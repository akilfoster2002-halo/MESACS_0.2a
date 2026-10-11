## TSH · THE RAID, THE THREE FIGHTS, HOME, AND 3 AM — tsh.js raidIntro / raidFight / raidHome / nightScene /
## prologueEnd, ported. The films are game.gd's reels; the running between them is chase.gd.
##
## THE BILLBOARD. Out of Dragon Alley with the bag: the screen across Neon Avenue says WFC, PROTECTING NEW YORK —
## "Yeah. Sure." — then a citizen alert: SECTOR 9 — DRAGON ALLEY. A drone drops in her face and reads her gloves; the
## vans come from both ends of the avenue; "THERE! DROP THE BAG!" — "Okay, little weird." — "Actually..." — and it is yours.
class_name Raid
extends Node

const RAID := {"from": Vector2(-41.4, -12.2), "at": Vector2(-41.3, -7.8)}
const VW := Vector2(-56, -2.8)
const VE := Vector2(-31, -2.8)
const RING := [Vector2(-49.0, -4.6), Vector2(-48.0, -8.8), Vector2(-51.5, -6.6), Vector2(-46.5, -2.6)]
const READY := "CLICK strike · hold CLICK, let go: power · SPACE dodge · R parry · G pull · F pulse"
const MK := {"maya": Vector2(54.4, 34.9), "kai": Vector2(54.4, 33.1), "y": 12.0}

var g
var screen: Node3D; var screen_bg: StandardMaterial3D; var screen_text: Label3D; var screen_mode := ""
var crew_out := false
var maya: Node3D; var maya_ap: AnimationPlayer; var kai: Node3D; var kai_ap: AnimationPlayer; var oc: Tentacles
var blanket: MeshInstance3D
var bino: ColorRect

func _init(game) -> void: g = game

func _ready() -> void:
	bino = ColorRect.new(); bino.set_anchors_preset(Control.PRESET_FULL_RECT); bino.mouse_filter = Control.MOUSE_FILTER_IGNORE; bino.visible = false
	var sh := Shader.new()
	sh.code = "shader_type canvas_item;\nvoid fragment(){ vec2 a = vec2(SCREEN_PIXEL_SIZE.y/SCREEN_PIXEL_SIZE.x, 1.0); vec2 u = (UV - 0.5)*vec2(1.0/a.x, 1.0);\n float d = min(length(u - vec2(-0.2, 0.0)), length(u - vec2(0.2, 0.0)));\n COLOR = vec4(0.0, 0.0, 0.0, smoothstep(0.30, 0.33, d)); }"
	var m := ShaderMaterial.new(); m.shader = sh; bino.material = m
	g.hud.add_child(bino); g.hud.move_child(bino, 1)

# ================================================================== the screen across the avenue
func _screen() -> void:
	if screen != null: return
	var spots = g._json("res://assets/tsh/city_spots.json")
	var B: Vector2 = RAID.at; var best: Array = spots.screens[0]
	for s in spots.screens:
		if Vector2(s[0] - B.x, s[2] - B.y).length() < Vector2(best[0] - B.x, best[2] - B.y).length(): best = s
	screen = Node3D.new(); g.add_child(screen)
	screen.position = Vector3(best[0], best[1], best[2]); screen.rotation.y = best[3]
	screen.translate_object_local(Vector3(0, 0, 0.08))
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(best[4], best[5]); q.mesh = qm
	screen_bg = StandardMaterial3D.new(); screen_bg.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; q.material_override = screen_bg; screen.add_child(q)
	screen_text = Label3D.new(); screen_text.pixel_size = 0.012; screen_text.font_size = 64; screen_text.outline_size = 0
	screen_text.render_priority = 101; screen_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; screen_text.position = Vector3(0, 0, 0.02); screen_text.width = best[4]/0.012
	screen_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; screen.add_child(screen_text)
func screens(mode: String) -> void:
	_screen(); screen_mode = mode
	screen.visible = mode != ""
	match mode:
		"wfc":
			screen_bg.albedo_color = Color(0.03, 0.09, 0.14); screen_text.modulate = Color(1, 1, 1)
			screen_text.text = "WFC\n\nPROTECTING NEW YORK.\n[ SECURITY. ORDER. TRUST. ]"
		"raid":
			screen_text.modulate = Color(1, 0.82, 0.24)
			screen_text.text = "⚠ CITIZEN ALERT ⚠\n\nILLEGAL WEARABLE ACTIVITY\nREPORTED\n\nSECTOR 9 — DRAGON ALLEY"
func tick(_dt: float) -> void:
	if screen != null and screen_mode == "raid":
		screen_bg.albedo_color = Color(0.23, 0.016, 0) if int(Time.get_ticks_msec()/333.0) % 2 else Color(0.1, 0.008, 0)
	if oc != null and maya != null:
		maya.position = oc.body - Vector3(0, 0.95, 0); maya.rotation.y = oc.yaw
	# the ones on the floor stay on it until she is well away, then the street is theirs again
	if crew_out and g.mode == "" and (g.fight.E.is_empty() or g.fight.E.all(func(e): return Vector2(e.x - g.robin.position.x, e.z - g.robin.position.z).length() > 30)):
		crew_out = false; g.fight.clear()

# ================================================================== THE BILLBOARD
func intro() -> void:
	var c: Chase = g.chase
	g.talk_q.clear(); c.stop(); c.build()
	var B: Vector2 = RAID.at
	_screen(); screens("wfc")
	var scr := screen.global_position
	var ry := atan2(scr.x - B.x, scr.z - B.y); var east := PI/2
	var vans: Array = c.vans
	c.van_place(vans[0], VW.x - 60, VW.y, PI/2); c.van_place(vans[1], VE.x + 45, VE.y, -PI/2)
	var pin := Vector2(B.x + sin(ry)*2.6, B.y + cos(ry)*2.6)
	var dr: Dictionary = c.spawn_drone(Vector3(pin.x, 20, pin.y)); dr.pin = pin; dr.yT = 20.0
	c.drones.append(dr)
	var cops := []
	for i in RING.size():
		var n: Dictionary = c.spawn_cop(Vector3(VW.x, 0, VW.y - 1.6), "cut"); n.node.visible = false; cops.append(n)
	var out_ := func(k: float):
		for i in cops.size():
			var n: Dictionary = cops[i]; n.node.visible = true
			n.x = lerpf(VW.x, RING[i].x, k); n.z = lerpf(VW.y - 1.6, RING[i].y, k); n.yaw = atan2(B.x - n.x, B.y - n.z)
			c._cop_play(n, "sprint" if k < 1 else "idle"); c._cop_place(n)
	var head := func(x: float, z: float, y := 1.55): return Vector3(x, y, z)
	var lead: Vector2 = RING[0]
	var drone_in := func(t: float): dr.y = lerpf(20, 2.7, minf(1, t/1.1)); dr.node.position = Vector3(dr.x, dr.y, dr.z); dr.node.rotation.y = atan2(B.x - dr.x, B.y - dr.z)
	var vans_in := func(t: float):
		var q := 1 - pow(1 - minf(1, t/1.5), 2)
		c.van_place(vans[0], lerpf(VW.x - 60, VW.x, q), VW.y, PI/2); c.van_place(vans[1], lerpf(VE.x + 45, VE.x, q), VE.y, -PI/2)
		if t > 1.7: out_.call(minf(1, (t - 1.7)/1.4))
	var shots := [
		{"dur": 3.0, "fov": 46, "cam": [Vector3(-37.6, 1.4, -2.8), Vector3(-38.2, 1.5, -3.6)], "look": [Vector3(-41.3, 1.2, -10), Vector3(-41.3, 1.3, -8)],
			"enter": func(): g.set_caption("EXT. NEON AVENUE — 23:02"); g.cue("step"),
			"tick": func(dt, t, k): g.walk_stage(RAID.from, B, k)},
		{"dur": 3.4, "fov": 34, "cam": Vector3(B.x - 1.6, 1.3, B.y + 0.8), "look": scr, "enter": func(): g.stage("idle", B.x, 0, B.y, ry)},
		{"dur": g.lines_len("raidIn1") + 0.7, "fov": 34, "cam": g.rel(B.x, B.y, ry, 1.25, 0.3, 1.62), "look": head.call(B.x, B.y, 1.58),
			"enter": func(): g.stage("idle", B.x, 0, B.y, ry); g.talk("raidIn1")},
		{"dur": 3.4, "fov": 30, "cam": Vector3(B.x - 2.4, 1.8, B.y + 1.4), "look": scr,
			"beats": [[0.5, func(): screens("raid"); g.cue("alarm")]]},
		{"dur": g.lines_len("raidIn2") + 1.4, "fov": 36, "cam": g.rel(B.x, B.y, ry, 1.1, -0.5, 1.55), "look": head.call(B.x, B.y, 1.62),
			"enter": func(): g.stage("idle", B.x, 0, B.y, ry),
			"beats": [[0.9, func(): g.stage("idle", B.x, 0, B.y, PI); g.talk("raidIn2")], [maxf(0.2, g.lines_len("raidIn2") - 0.7), func(): g.cue("rise")]]},
		{"dur": maxf(3.0, g.lines_len("raidDrone") + 1.6), "fov": 40, "cam": g.rel(B.x, B.y, ry, -1.5, 0.7, 1.55), "look": Vector3(pin.x, 2.6, pin.y),
			"enter": func(): g.stage("idle", B.x, 0, B.y, ry); g.cue("sting"),
			"tick": func(dt, t, k): drone_in.call(t),
			"beats": [[1.0, func(): g.cue("scan"); g.talk("raidDrone")]]},
		{"dur": 3.4, "fov": 52, "cam": [Vector3(-41.0, 6.5, 9.0), Vector3(-41.0, 5.6, 8.0)], "look": Vector3(-41.2, 0.8, -4.5),
			"enter": func(): g.cue("skid"); c.later(0.3, func(): g.cue("alarm")),
			"tick": func(dt, t, k): vans_in.call(t),
			"beats": [[1.6, func(): g.cue("door")]]},
		{"dur": g.lines_len("raidIn3") + 0.4, "fov": 38, "cam": g.rel(lead.x, lead.y, atan2(B.x - lead.x, B.y - lead.y), -0.9, 0.45, 1.8), "look": head.call(B.x, B.y, 1.4),
			"enter": func(): vans_in.call(9.0); out_.call(1.0); g.stage("idle", B.x, 0, B.y, atan2(lead.x - B.x, lead.y - B.y)); g.talk("raidIn3")},
		{"dur": g.lines_len("raidIn4") + 0.6, "fov": 34, "cam": g.rel(B.x, B.y, east + 0.6, 1.2, 0.2, 1.6), "look": head.call(B.x, B.y, 1.56),
			"enter": func(): g.stage("idle", B.x, 0, B.y, east + 0.6); g.talk("raidIn4")},
		{"dur": g.lines_len("raidIn5") + 0.5, "fov": 30, "cam": g.rel(B.x, B.y, east, 0.95, -0.2, 1.62), "look": head.call(B.x, B.y, 1.6),
			"enter": func(): g.stage("idle", B.x, 0, B.y, east); g.talk("raidIn5")}]
	g.play_reel(shots, func(_s): _intro_done(cops, dr, B, east, vans_in, out_))
func _intro_done(cops: Array, dr: Dictionary, B: Vector2, east: float, vans_in: Callable, out_: Callable) -> void:
	# a skipped film leaves everyone where it would have
	vans_in.call(9.0); out_.call(1.0)
	var c: Chase = g.chase
	for n in cops: n.state = "hold"
	c.later(1.2, func():
		for n in cops: if n.state == "hold": n.state = "pursue")
	c.last_known = B
	dr.erase("pin")
	if not "raid" in g.S.seen: g.S.seen.append("raid")
	g.place(Vector3(B.x, 0, B.y), east + PI)
	go(0, dr)
## it is yours: the chase, from stage i
func go(i: int, drone = null) -> void:
	g.staged = null; g.talk_q.clear()
	screens("raid")
	g.chase.start(i, drone)
	g.score("wos-b", -10)

# ================================================================== THE THREE FIGHTS
const RAIDFIGHT := {
	1: {"arena": {"x1": -33.0, "x2": -15.5, "z1": -9.6, "z2": -1.0}, "floor": 0.0, "clamp": [-29.5, -26.5, -9.0, -3.0]},
	2: {"arena": {"x1": 37.6, "x2": 46.4, "z1": -43.4, "z2": -10.6}, "floor": 13.0, "clamp": [39.5, 44.5, -40.0, -14.0]},
	3: {"arena": {"x1": 47.6, "x2": 55.6, "z1": -43.4, "z2": -10.6}, "floor": 13.0, "clamp": [48.4, 54.8, -42.0, -12.0]}}
func ready_card(n: int, show: bool) -> void:
	if show: g.lesson_card("WFC · FIGHT %d / 3" % n, "GET READY", READY); g.cue("ui")
	else: g.lesson_card("", "", "")

func fight(n: int, done: Callable) -> void:
	var c: Chase = g.chase
	var F: Dictionary = RAIDFIGHT[n]; var p: Vector3 = g.robin.position; var floor_y: float = F.floor; var cl: Array = F.clamp
	var R0 := Vector2(clampf(p.x, cl[0], cl[1]), clampf(p.z, cl[2], cl[3]))
	g.talk_q.clear()
	if c.cover != null: c.leave_cover(true)
	c.act = null; c.climb = null
	var A: Dictionary = F.arena
	var crew: Array
	match n:
		1: crew = [{"tag": "a", "kind": "wfc", "x": -21.6, "z": -5.2, "to": Vector2(-24.6, -5.8)}, {"tag": "b", "kind": "wfcLean", "x": -21.6, "z": -8.4, "to": Vector2(-24.8, -8.6), "weapon": true},
			{"tag": "c", "kind": "wfc", "x": -38.0, "z": -3.2, "to": Vector2(-31.4, -6.4), "hidden": true}]
		2:
			crew = []
			for d in [["a", "wfc", 3.2, 0.4], ["b", "wfcLean", -0.6, 3.4], ["c", "wfc", 0.4, -3.4]]:
				var q := Vector2(clampf(R0.x + d[2], A.x1 + 0.8, A.x2 - 0.8), clampf(R0.y + d[3], A.z1 + 0.8, A.z2 - 0.8))
				crew.append({"tag": d[0], "kind": d[1], "x": q.x, "z": q.y, "to": q})
		3:
			var cop = c.st.get("cop")
			var c0 := Vector2(R0.x + 2.4, R0.y + 1.2)
			if cop != null and is_instance_valid(cop.node) and cop in c.cops:
				c0 = Vector2(clampf(cop.x, A.x1 + 0.6, A.x2 - 0.6), clampf(cop.z, A.z1 + 0.6, A.z2 - 0.6))
				cop.node.queue_free(); c.cops.erase(cop); c.st.erase("cop")
			crew = [{"tag": "a", "kind": "wfc", "x": c0.x, "z": c0.y, "to": c0},
				{"tag": "b", "kind": "wfcLean", "x": 55.0, "z": -40.0, "to": Vector2(clampf(R0.x + 1.5, 48.4, 54.8), clampf(R0.y - 3.2, -42, -12)), "hidden": true, "weapon": true}]
	for m in crew: m.yaw = atan2(R0.x - m.x, R0.y - m.z); m.state = "idle"
	var blocks := []
	if n == 1 and c.st.get("van") != null and c.st.van.s != null: var s: Array = c.st.van.s; blocks = [{"x1": s[0], "x2": s[1], "z1": s[2], "z2": s[3]}]
	if n == 3: var ac: Dictionary = Chase.ROUTE.ac; blocks = [{"x1": ac.x - ac.w/2, "x2": ac.x + ac.w/2, "z1": ac.z - ac.d/2, "z2": ac.z + ac.d/2}]
	g.fight.setup({"arena": A, "blocks": blocks, "floor": floor_y, "meet": R0, "uniform": true})
	g.fight.cast(crew)
	for e in g.fight.E: e.y = floor_y; g.fight._place(e)
	crew_out = true
	var by := func(t: String): return g.crew(t)
	var lead: Vector2 = crew[0].to
	var ry := atan2(lead.x - R0.x, lead.y - R0.y); var ly := atan2(R0.x - lead.x, R0.y - lead.y)
	var head := func(x: float, z: float): return Vector3(x, floor_y + 1.55, z)
	var walk := func(t: String, k: float, nm := "walk"):
		var m = null
		for x in crew: if x.tag == t: m = x
		var e = by.call(t)
		if m == null or e == null: return
		e.node.visible = true
		g.crew_walk(e, Vector2(m.x, m.z), m.to, minf(1, k), nm); e.y = floor_y; g.fight._place(e)
		if k >= 1: g.crew_face(e, R0.x, R0.y, "fight")
	var gauntlets := {"dur": 3.0, "fov": 38, "cam": g.rel(R0.x, R0.y, ry, 1.25, 0.55, floor_y + 1.25), "look": Vector3(R0.x, floor_y + 1.05, R0.y),
		"enter": func():
			g.stage("fight", R0.x, floor_y, R0.y, ry)
			for m in crew: walk.call(m.tag, 1.0)
			ready_card(n, true),
		"beats": [[0.5, func(): g.cue("gear")]]}
	var shots: Array
	match n:
		1: shots = [
			{"dur": 2.4, "fov": 50, "cam": Vector3(-26.5, 2.4, 2.6), "look": Vector3(-21.0, 1.0, -6.8),
				"enter": func(): g.set_caption("EXT. NEON AVENUE — NIGHT"); g.stage("idle", R0.x, 0, R0.y, ry)},
			{"dur": 2.8, "fov": 44, "cam": [Vector3(-25.5, 1.7, -1.4), Vector3(-25.8, 1.6, -2.0)], "look": Vector3(-22.5, 1.2, -6.6),
				"enter": func(): g.cue("door"), "tick": func(dt, t, k): walk.call("a", k*1.2); walk.call("b", k*1.2)},
			{"dur": g.lines_len("raidVan") + 0.5, "fov": 36, "cam": g.rel(lead.x, lead.y, ly, -0.9, 0.45, 1.8), "look": head.call(R0.x, R0.y),
				"enter": func(): walk.call("a", 1.0); walk.call("b", 1.0); g.talk("raidVan")},
			{"dur": maxf(2.6, g.lines_len("raidFine") + 1.2), "fov": 44, "cam": g.rel(R0.x, R0.y, ry, 1.6, -0.8, 1.6), "look": Vector3(-31.4, 1.2, -6.4),
				"tick": func(dt, t, k): walk.call("c", k*1.4, "sprint"),
				"beats": [[1.0, func(): g.stage("idle", R0.x, 0, R0.y, ry + 0.5); g.talk("raidFine")]]},
			gauntlets]
		2: shots = [
			{"dur": 2.6, "fov": 50, "cam": Vector3(R0.x - 2.5, floor_y + 1.4, R0.y + 3.5), "look": func(k, t): return c.gun.n.position if c.gun != null else Vector3(R0.x + 10, floor_y + 18, R0.y),
				"enter": func():
					g.set_caption("EXT. ROOFTOP — NIGHT"); g.stage("idle", R0.x, floor_y, R0.y, ry); g.cue("alarm")
					for e in g.fight.E: e.node.visible = false},
			{"dur": 3.0, "fov": 56, "cam": [Vector3(R0.x - 6.5, floor_y + 4.5, R0.y + 6.5), Vector3(R0.x - 6, floor_y + 4, R0.y + 6)], "look": Vector3(R0.x, floor_y + 1.5, R0.y),
				"tick": func(dt, t, k): _drop_in(R0, floor_y, k), "beats": [[2.6, func(): g.cue("step")]]},
			{"dur": g.lines_len("raidDrop") + 0.5, "fov": 36, "cam": g.rel(lead.x, lead.y, ly, -0.9, 0.45, floor_y + 1.8), "look": head.call(R0.x, R0.y),
				"enter": func(): _drop_in(R0, floor_y, 1.0); g.talk("raidDrop")},
			{"dur": g.lines_len("raidGate") + g.lines_len("raidOkay") + 0.8, "fov": 32, "cam": g.rel(R0.x, R0.y, ry, 1.0, -0.15, floor_y + 1.6), "look": head.call(R0.x, R0.y),
				"enter": func(): g.stage("idle", R0.x, floor_y, R0.y, ry); g.talk("raidGate"); g.talk("raidOkay")},
			gauntlets]
		3: shots = [
			{"dur": g.lines_len("momFound") + 0.9, "fov": 32, "cam": g.rel(R0.x, R0.y, ry, 1.0, -0.15, floor_y + 1.55), "look": head.call(R0.x, R0.y),
				"enter": func(): g.stage("idle", R0.x, floor_y, R0.y, ry); g.talk("momFound")},
			{"dur": g.lines_len("raidHands") + 0.5, "fov": 38, "cam": g.rel(R0.x, R0.y, ry, -0.9, 0.45, floor_y + 1.75), "look": head.call(lead.x, lead.y),
				"enter": func(): g.crew_face(by.call("a"), R0.x, R0.y, "fight"); g.talk("raidHands")},
			{"dur": 2.6, "fov": 46, "cam": Vector3(R0.x - 1.1, floor_y + 2.7, R0.y + 2.3),
				"look": func(k, t): var e = by.call("b"); return Vector3(e.x, floor_y + 1.3, e.z) if e != null else Vector3(53, floor_y + 1, -32),
				"tick": func(dt, t, k): walk.call("b", k*1.15, "sprint")},
			{"dur": g.lines_len("raidPass") + 0.6, "fov": 32, "cam": g.rel(R0.x, R0.y, ry, 1.0, 0.2, floor_y + 1.6), "look": head.call(R0.x, R0.y),
				"enter": func(): walk.call("b", 1.0); g.talk("raidPass")},
			gauntlets]
	g.play_reel(shots, func(_s): _fight_begin(n, R0, ry, floor_y, crew, done))
func _drop_in(R0: Vector2, floor_y: float, k: float) -> void:
	var i := 0
	for e in g.fight.E:
		var q := clampf(k*1.25 - i*0.12, 0, 1)
		e.node.visible = q > 0; e.y = floor_y + 7*(1 - q); g.fight._place(e)
		g.crew_face(e, R0.x, R0.y, "fight" if q >= 1 else "idle"); i += 1
func _fight_begin(n: int, R0: Vector2, ry: float, floor_y: float, crew: Array, done: Callable) -> void:
	g.staged = null; g.talk_q.clear()
	for e in g.fight.E:
		e.node.visible = true; e.y = floor_y
		for m in crew: if m.tag == e.tag: e.x = m.to.x; e.z = m.to.y
		g.fight._place(e)
	g.robin.position = Vector3(R0.x, floor_y, R0.y); g.cam_yaw = ry + PI; g.cam_pitch = 0.0
	g.mode = "fight"; g.marker.visible = false; g.ring.visible = false
	ready_card(n, false)
	g.objective("Fight your way out.", [READY])
	g.fight.start(func(): _fight_end(done), "brawl")
## the last of them down: back to running
func _fight_end(done: Callable) -> void:
	g.mode = ""; g.cue("win")
	g.place(g.robin.position, g.cam_yaw)
	g.boots.ground = true; g.boots.state = "ground"
	if done.is_valid(): done.call()

# ================================================================== HOME, AND 3 AM
## On her own roof with nobody on her: "Okay... Definitely never doing that again. ...Probably." In at the window: her
## room, dark; the phone says 3:07; school in the morning. "Rats." Everything off, onto the floor, and into bed. And
## across the street, two people on a roof with binoculars.
func home() -> void:
	g.chase.stop()
	g.music.stop()
	g.outcome("home")
func night() -> void:
	g.talk_q.clear()
	if screen: screens("")
	var R: Dictionary = g.room.room; var bed: Dictionary = R.bed
	var win: Vector3 = g._v(R.window.at); var form: Vector3 = g._v(R.form.at); var boots_at: Vector3 = g._v(R.boots.at)
	var roof: Vector3 = g.robin.position if g.robin.position.y > 10 else Vector3(Chase.ROUTE.home.at.x, 12, Chase.ROUTE.home.at.y)
	var west := -PI/2
	var in_at := Vector2(win.x + 0.9, win.z); var face_in := PI/2
	var top: float = bed.get("top", 0.72)
	var lie := func(k := 0.0):
		g.stage("idle", bed.x + 0.75, top + 0.12, bed.z, PI/2); g.model.rotation.x = -PI/2; g.model.rotation.z = k
	_watchers()
	var maya_head := func(k, t): return maya.position + Vector3(0, 1.55, 0)
	var bino_at := Vector3(win.x + 0.15, 1.65, win.z + 0.1); var bed_ := Vector3(bed.x, top + 0.25, bed.z)
	var shots := [
		{"dur": g.lines_len("raidHome") + 1.2, "fov": 40, "inside": false, "cam": g.rel(roof.x, roof.z, west, 2.6, 1.2, roof.y + 1.4), "look": roof + Vector3(0, 1.0, 0),
			"enter": func(): g.set_caption("EXT. ROOFTOP — 214 HARBOR LANE"); g.stage("kneel", roof.x, roof.y, roof.z, west); g.talk("raidHome"),
			"beats": [[g.lines_len("raidHome")*0.35, func(): g.stage("idle", roof.x, roof.y, roof.z, west)]]},
		{"dur": 2.6, "fov": 40, "inside": true, "cam": Vector3(win.x + 2.2, 0.7, win.z + 0.7), "look": Vector3(win.x + 0.2, 1.5, win.z),
			"enter": func(): g.lamp.light_energy = 0; g.cue("window"); g.set_caption("INT. ROBIN'S ROOM — NIGHT"); g.stage("kneel", win.x + 0.32, 1.0, win.z, face_in),
			"beats": [[1.5, func(): g.stage("idle", in_at.x, 0, in_at.y, face_in)], [2.1, func(): g.cue("door")]]},
		{"dur": 3.2, "fov": 34, "cam": g.rel(in_at.x, in_at.y, face_in, 0.9, 0.35, 1.6), "look": Vector3(in_at.x + 0.25, 1.25, in_at.y),
			"enter": func(): g.stage("text", in_at.x, 0, in_at.y, face_in),
			"beats": [[0.3, func(): g.cue("ui"); g.phone_show("time", "3:07")]]},
		{"dur": 2.4, "fov": 44, "cam": Vector3(in_at.x + 0.4, 1.6, in_at.y - 0.3), "look": [Vector3(form.x, 1.4, form.z), Vector3(form.x + 0.3, 1.3, form.z)],
			"enter": func(): g.phone_show("")},
		{"dur": g.lines_len("rats") + 0.8, "fov": 30, "cam": g.rel(in_at.x, in_at.y, face_in, 1.0, -0.15, 1.6), "look": Vector3(in_at.x, 1.55, in_at.y),
			"enter": func(): g.stage("idle", in_at.x, 0, in_at.y, face_in); g.talk("rats")},
		{"dur": 3.4, "fov": 46, "cam": Vector3(in_at.x + 2.3, 1.3, in_at.y + 1.4), "look": Vector3(in_at.x, 0.9, in_at.y),
			"beats": [[0.3, func(): g.cue("door")], [1.0, func(): g.cue("zip"); g.kit("jacket", false)], [1.7, func(): g.cue("gear"); g.kit("gloves", false)],
				[2.5, func(): g.cue("step"); g.kit("shoes", false)]]},
		{"dur": 3.6, "fov": 42, "cam": [Vector3(bed.x + 2.0, 2.1, bed.z - 1.6), Vector3(bed.x + 1.5, 1.8, bed.z - 1.2)], "look": Vector3(bed.x - 0.1, 0.8, bed.z),
			"enter": func(): lie.call(0.0),
			"beats": [[0.9, func(): _blanket(bed, top); g.cue("door")]]},
		{"dur": 2.4, "fov": 36, "cam": boots_at + Vector3(1.1, 0.45, 0.8), "look": boots_at + Vector3(0, 0.12, 0)},
		{"dur": 3.4, "fov": 44, "inside": false, "cam": [Vector3(49.6, 13.9, 37.2), Vector3(50.2, 13.7, 36.6)], "look": Vector3(62, 9.4, 34),
			"enter": func(): g.set_caption("EXT. ROOFTOP — NIGHT"); kai.rotation.y = PI/2},
		{"dur": 3.0, "fov": 20, "inside": true, "cam": bino_at, "look": bed_, "enter": func(): bino.visible = true; lie.call(0.0)},
		{"dur": 2.4, "fov": 34, "inside": false, "cam": Vector3(60.4, 13.4, 34.2), "look": Vector3(54.4, 13.5, 34.0),
			"enter": func(): bino.visible = false; kai.rotation.y = 0},
		{"dur": 2.6, "fov": 20, "inside": true, "cam": bino_at, "look": bed_, "enter": func(): bino.visible = true; lie.call(0.0), "beats": [[1.2, func(): lie.call(0.25)]]},
		{"dur": g.lines_len("watchers") + 1.0, "fov": 30, "inside": false, "cam": g.rel(MK.maya.x, MK.maya.y, PI/2, 2.0, -0.8, MK.y + 2.3), "look": maya_head,
			"enter": func(): bino.visible = false; kai.rotation.y = PI/2; g.talk("watchers")},
		# AND THEN THEY COME OUT: one rears up over her shoulder while she stares down the lens; two stab the roof
		# behind her and lift her off it; one goes for Kai's face and stops a hand short; then all four, spread wide
		{"dur": 1.6, "fov": 34, "cam": g.rel(MK.maya.x, MK.maya.y, PI/2, 1.7, 0.2, MK.y + 1.0), "look": func(k, t): return maya.position + Vector3(0, 1.8, 0),
			"enter": func(): g.music.stop(); g.cue("rise"),
			"beats": [[0.8, func(): _burst(0, Vector3(0.25, 1.15, 0.6), 3.6); g.cue("gear"); g.fight.shake(0.12, 0.3)]]},
		{"dur": 1.6, "fov": 48, "cam": g.rel(MK.maya.x, MK.maya.y, PI/2, -1.9, 1.3, MK.y + 0.3), "look": func(k, t): return maya.position + Vector3(0, 1.4, 0),
			"beats": [[0.25, func(): _burst(2, Vector3(1.7, 0, -0.7), 0.5, true); oc.lift = 1.5; g.cue("blast"); g.fight.shake(0.45, 0.45)],
				[0.6, func(): _burst(3, Vector3(-1.2, 0, 0.9), 0.5, true); g.cue("clang"); g.fight.shake(0.3, 0.35)]]},
		{"dur": 1.9, "fov": 40, "cam": func(k, t): return kai.position + Vector3(0.75, 1.8, -0.5), "look": func(k, t): return maya.position + Vector3(0, 1.5, 0),
			"enter": func():
				kai.rotation.y = atan2(maya.position.x - kai.position.x, maya.position.z - kai.position.z); g.cue("sting")
				oc.visible = true; oc.burst(1, kai.position + Vector3(0.25, 1.68, 0.45), 1.4),
			"beats": [[0.45, func(): g.cue("clang"); kai.position.z -= 0.2]]},
		{"dur": 1.8, "fov": 58, "cam": func(k, t): return g.rel(maya.position.x, maya.position.z, PI/2, 3.8 - k*0.9, -0.9, MK.y + 0.2), "look": func(k, t): return maya.position + Vector3(0, 1.6, 0),
			"enter": func():
				_burst(0, Vector3(1.7, 0.9, 1.4), 1.7); _burst(1, Vector3(-1.7, 0.8, 1.5), 1.7)
				_burst(2, Vector3(2.0, 0, -1.3), 0.4, true); _burst(3, Vector3(-2.0, 0, -1.1), 0.4, true); g.cue("gear"),
			"beats": [[0.35, func(): g.cue("clang"); g.fight.shake(0.2, 0.25)], [0.5, func(): g.cue("clang")]]},
		{"dur": 5.0, "fov": 42, "inside": false, "cam": [Vector3(MK.maya.x + 4.5, MK.y + 2.6, MK.maya.y - 4.2), Vector3(MK.maya.x + 3.6, MK.y + 2.8, MK.maya.y - 3.4)],
			"look": func(k, t): return maya.position + Vector3(0, 1.2, 0),
			"enter": func(): oc.go_to(MK.maya.x - 9, MK.maya.y + 3, 1.7),
			"tick": func(dt, t, k): kai.rotation.y = atan2(maya.position.x - kai.position.x, maya.position.z - kai.position.z)}]
	g.play_reel(shots, func(_s): prologue_end())
## Maya and Kai, on the roof across Kiln Street from her window; her arms in her back until she has said it
func _watchers() -> void:
	if maya != null: return
	maya = (load("res://assets/tsh/maya.glb") as PackedScene).instantiate(); g.add_child(maya)
	maya_ap = g._find(maya, func(x): return x is AnimationPlayer)
	kai = (load("res://assets/tsh/people/kofi.glb") as PackedScene).instantiate(); g.add_child(kai)
	kai_ap = g._find(kai, func(x): return x is AnimationPlayer)
	for ap in [maya_ap, kai_ap]:
		if ap == null: continue
		for nm in ap.get_animation_list(): ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
		if ap.has_animation("idle"): ap.play("idle")
	kai.position = Vector3(MK.kai.x, MK.y, MK.kai.y); kai.rotation.y = PI/2
	oc = Tentacles.new(); g.add_child(oc)
	oc.lift = 0.95
	oc.setup(MK.y, Vector3(MK.maya.x, MK.y, MK.maya.y), PI/2)
	oc.visible = false
	var sk: Skeleton3D = g._find(maya, func(x): return x is Skeleton3D)
	var bi := -1
	if sk != null:
		for i in sk.get_bone_count(): if sk.get_bone_name(i).ends_with("Spine2"): bi = i
	if bi >= 0: oc.socket = func(): return sk.global_transform*sk.get_bone_global_pose(bi)
	maya.position = oc.body - Vector3(0, 0.95, 0); maya.rotation.y = oc.yaw
## an arm out at a point given about her (x to her side, z ahead of her), as the browser's burst
func _burst(k: int, at: Vector3, hold: float, on_floor := false) -> void:
	oc.visible = true
	var b := Basis(Vector3.UP, oc.yaw)
	var w: Vector3 = oc.body + b*Vector3(at.x, 0, at.z)
	w.y = MK.y if on_floor else oc.body.y + at.y
	oc.burst(k, w, hold, on_floor)
## the blanket over her, to her shoulders
func _blanket(bed: Dictionary, top: float) -> void:
	if blanket == null:
		blanket = MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1.55, 0.2, 1.1); blanket.mesh = bm
		var m := StandardMaterial3D.new(); m.albedo_color = Color(0.3, 0.37, 0.51); m.roughness = 0.95; blanket.material_override = m
		g.apt.add_child(blanket)
	blanket.global_position = Vector3(bed.x + 0.45, top + 0.15, bed.z); blanket.visible = true

## CUT TO BLACK. END OF PROLOGUE.
func prologue_end() -> void:
	g.staged = null; g.talk_q.clear(); g.phone_show(""); bino.visible = false
	g.model.rotation = Vector3.ZERO
	if oc != null: oc.queue_free(); oc = null
	if maya != null: maya.queue_free(); maya = null
	if kai != null: kai.queue_free(); kai = null
	if blanket != null: blanket.visible = false
	g.S.step = "end"; g._save()
	g.mode = "end"; g.black(true)
	g.end_text("CUT TO BLACK.")
	g.chase.later(2.4, func(): g.end_text("END OF PROLOGUE\n\n[color=#9fb4c0]Somebody has noticed her.[/color]"); g.cue("ui"))
