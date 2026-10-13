## SEQUENCE 3: BECOMING THE OTHER ROBIN (docs/script/the_other_robin_cold_open_1.1.md, shots 22–31). The jacket off
## the form, waking from her wrists to her shoulders; the gloves; the shoes; the bangle and the pack, the ring box in it;
## dinner under its cover and Mom's note; the door; the sunglasses at night; the ledge; five storeys above Kiln Street;
## and the jump — the shoes catching her — into the game, with her momentum: no prompt, no card, no voice.
class_name OpeningSuit
extends Node

var g
var made: Array = []
func _init(game) -> void: g = game
func _keep(n: Node) -> Node: made.append(n); return n
func _light(c: Color, at: Vector3, e: float, r: float) -> OmniLight3D:
	var l := OmniLight3D.new(); l.light_color = c; l.light_energy = e; l.omni_range = r; l.position = at; g.add_child(l); _keep(l); return l
func _bone(side: String) -> Vector3:
	var sk: Skeleton3D = g._find(g.model, func(x): return x is Skeleton3D)
	var i := sk.find_bone("mixamorig" + side)
	return sk.global_transform*sk.get_bone_global_pose(i).origin if i >= 0 else g.robin.position + Vector3(0, 1, 0)
func clear() -> void:
	for n in made:
		if is_instance_valid(n): n.queue_free()
	made = []

func play(ring_box: Node3D) -> void:
	var R: Dictionary = g.room.room
	var F = g._v(R.form.at); var B = g._v(R.bench.at); var SH = g._v(R.boots.at); var K = g._v(R.kitchen.at); var N = g._v(R.note.at)
	var D = g._v(R.momDoor.at); var win = g._v(R.window.at); var PK = g._v(R.pack.at)
	var J := Vector2(F.x + 0.75, F.z + 0.6); var jry := atan2(F.x - J.x, F.z - J.y)
	var at_table := Vector2(K.x - 0.3, K.z + 0.95); var face_table := atan2(K.x - at_table.x, K.z - at_table.y)
	var SILL: Vector3 = g.SILL
	var city_glow := _light(Color(0.55, 0.75, 0.9), win + Vector3(1.0, -0.2, 0), 0.9, 4.0)          # the city through the window, the lamp off
	var arm_light := _light(Color(0.3, 0.9, 1.0), Vector3.ZERO, 0.0, 1.4)
	var coil := _light(Color(0.3, 0.7, 1.0), Vector3.ZERO, 0.0, 1.2)
	var jump := {"p0": SILL, "v": Vector3(-6.5, 3.2, 1.2)}
	var shots := [
		# SHOT 22 · the jacket, from behind the form: her hand out of the dark; it lifts; black across the lens; on;
		# the lines in its sleeves waking from her wrists to her shoulders
		{"dur": 1.6, "fov": 40, "inside": true, "cam": [F + Vector3(-0.55, 1.35, -0.45), F + Vector3(-0.45, 1.3, -0.25)], "look": F + Vector3(0.5, 1.25, 0.6),
			"enter": func(): g.black(false); g.lamp.light_energy = 0.0; g.stage("idle", J.x, 0, J.y, jry),
			"beats": [[1.2, func(): g._form_jacket(false); g.black(true); g.get_tree().create_timer(0.12).timeout.connect(func(): g.black(false))]]},
		{"dur": 2.6, "fov": 38, "mood": "focused", "cam": [g.rel(J.x, J.y, jry + PI, 1.3, 0.35, 1.35), g.rel(J.x, J.y, jry + PI, 1.15, 0.25, 1.4)], "look": Vector3(J.x, 1.25, J.y),
			"enter": func(): g.stage("idle", J.x, 0, J.y, jry + PI); g.kit("jacket", true); g.cue("zip"),
			"tick": func(dt, t, k): var w := minf(1, t/1.8); arm_light.global_position = _bone("RightHand").lerp(_bone("RightShoulder"), w); arm_light.light_energy = 2.0*sin(minf(1, t/2.2)*PI)},
		# SHOT 23 · the gloves, by the soldering iron: one hand, the other; palms together, a snap; a grip on the bench
		{"dur": 2.4, "fov": 26, "dof": 0.6, "cam": func(k, t): return _bone("RightHand").lerp(_bone("LeftHand"), 0.5) + Vector3(0.32, 0.12, 0.3),
			"look": func(k, t): return _bone("RightHand").lerp(_bone("LeftHand"), 0.5),
			"enter": func(): g.stage("text", B.x + 0.3, 0, B.z + 0.75, PI),
			"beats": [[0.5, func(): g.kit("gloves", true); g.cue("gear")], [1.4, func(): g.cue("lock")]]},
		# SHOT 24 · the shoes, at floor level: laced; the coils flicker blue across the boards; a heel pressed down; dark
		{"dur": 3.0, "fov": 34, "dof": 0.7, "cam": [SH + Vector3(1.0, 0.12, -0.6), SH + Vector3(0.8, 0.1, -0.45)], "look": SH + Vector3(0.3, 0.12, 0),
			"enter": func(): g.stage("kneel", SH.x + 0.35, 0, SH.z, -PI/2),
			"tick": func(dt, t, k): coil.global_position = SH + Vector3(0.35, 0.05, 0); coil.light_energy = (2.5 if fmod(t*9.0, 1.0) > 0.4 else 0.4) if t > 0.9 and t < 1.7 else 0.0,
			"beats": [[0.8, func(): g.kit("shoes", true); g.apt_boots(false); g.cue("zip")], [2.0, func(): g.cue("kick")], [2.5, func(): g.stage("idle", SH.x + 0.35, 0, SH.z, -PI/2)]]},
		# SHOT 25 · the bangle, close; an indicator lights and dims — then over her shoulder: the ring box into the
		# pack's front pocket; roll-top closed; over one shoulder; a hand from the strap to her collar
		{"dur": 1.6, "fov": 22, "dof": 0.4, "cam": func(k, t): return _bone("RightHand") + Vector3(0.18, 0.1, 0.16), "look": func(k, t): return _bone("RightHand"),
			"enter": func(): g.stage("text", PK.x + 0.4, 0, PK.z - 0.5, -PI*0.75),
			"beats": [[0.4, func(): g.kit("bracelet", true); g.cue("lock")]]},
		{"dur": 2.6, "fov": 40, "mood": "determined", "cam": g.rel(PK.x + 0.4, PK.z - 0.5, -PI*0.75, -0.55, 0.3, 1.6), "look": Vector3(PK.x, 0.6, PK.z),
			"beats": [[0.6, func(): _pocket(ring_box)], [1.3, func(): g.apt_pack(false); g.kit("pack", true); g.cue("zip")]]},
		# SHOT 26 · dinner: wide, still, through the kitchen; the cover, the glass, untouched; the cooler light
		{"dur": 3.0, "fov": 40, "mood": "sad", "cam": Vector3(K.x - 2.2, 1.5, K.z + 2.8), "look": Vector3(K.x, 0.9, K.z),
			"enter": func(): _light(Color(0.75, 0.85, 1.0), K + Vector3(0, 1.2, 0), 1.2, 3.0),
			"tick": func(dt, t, k): _to_table(k, Vector2(PK.x + 0.3, PK.z - 1.0), at_table, face_table)},
		# · the note
		{"dur": 2.6, "fov": 24, "ease": false, "cam": Vector3(N.x - 0.05, N.y + 0.5, N.z + 0.28), "look": N, "enter": func(): g.cue("window")},
		# · her, reading: it stops on "Love"; hold a second longer than a reaction; she looks down the hall
		{"dur": 3.6, "fov": 30, "mood": "sad", "cam": g.rel(at_table.x, at_table.y, face_table, 0.85, 0.15, 1.5), "look": Vector3(at_table.x, 1.4, at_table.y),
			"enter": func(): g.stage("text", at_table.x, 0, at_table.y, face_table),
			"tick": func(dt, t, k): _reading(t, D)},
		# SHOT 27 · the door, down the hall on a long lens; her a soft silhouette in front; nothing happens; she squares
		# the note with the table's edge, exactly as it was; she goes; the note is the only thing in focus
		{"dur": 4.4, "fov": 16, "dof": 4.5, "cam": Vector3(K.x + 0.7, 1.45, K.z + 2.0), "look": Vector3(D.x, 1.1, D.z),
			"enter": func(): g._note_home(); g.stage("idle", at_table.x, 0, at_table.y, atan2(D.x - at_table.x, D.z - at_table.y)),
			"beats": [[2.4, func(): g.face.target = null], [3.0, func(): g.stage("walk", at_table.x - 0.6, 0, at_table.y + 0.6, -PI*0.6)]]},
		{"dur": 1.6, "fov": 26, "dof": 0.5, "cam": N + Vector3(0.25, 0.35, 0.45), "look": N},
		# SHOT 28 · at the window: open; the wind; the sunglasses out of her jacket; on, at night; a tilt of the head; a grin
		{"dur": 3.4, "fov": 30, "mood": "grin", "cam": [Vector3(win.x - 0.4, 1.6, win.z), Vector3(win.x - 0.15, 1.6, win.z)], "look": Vector3(win.x + 0.75, 1.58, win.z),
			"enter": func(): g.stage("idle", win.x + 0.75, 0, win.z, -PI/2); g.apt_window(true); g.cue("window"),
			"beats": [[1.4, func(): g.shades(true); g.cue("ui")], [2.2, func(): g.face.feel("smug", 1.2)]]},
		# SHOT 29 · the sill: from inside, the room dark, her silhouette in the city's light; testing her balance; a drone below
		{"dur": 3.2, "fov": 44, "cam": [Vector3(win.x + 3.0, 1.3, win.z + 0.6), Vector3(win.x + 1.9, 1.35, win.z + 0.3)], "look": Vector3(win.x, 1.5, win.z),
			"enter": func(): g.stage("kneel", win.x + 0.32, 1.0, win.z, -PI/2)},
		# SHOT 30 · five storeys above Kiln Street: her view, down; then her profile on the sill; one hand off, the other;
		# a close-up, the smile: "Let's go."
		{"dur": 2.6, "fov": 70, "inside": false, "cam": SILL + Vector3(0.1, 1.2, 0), "look": [SILL + Vector3(-6, -3, 0), SILL + Vector3(-3.5, -9, 0)],
			"enter": func(): g.set_caption("EXT. KILN STREET — 22:17"); g.stage("kneel", SILL.x, SILL.y, SILL.z, -PI/2)},
		{"dur": 2.0, "fov": 36, "cam": SILL + Vector3(-0.3, 0.9, 2.2), "look": SILL + Vector3(0, 0.7, 0)},
		{"dur": g.lines_len("open") + 0.8, "fov": 28, "mood": "grin", "cam": g.rel(SILL.x, SILL.z, -PI/2, 0.9, 0.2, SILL.y + 1.0), "look": SILL + Vector3(0, 0.95, 0),
			"beats": [[0.3, func(): g.talk("open")]]},
		# SHOT 31 · the jump. 1: outside, side on: she pushes off, horizontal against the city for a moment
		{"dur": 0.7, "fov": 48, "cam": SILL + Vector3(-1.2, -1.0, 4.0), "look": func(k, t): return g.robin.position + Vector3(0, 0.6, 0),
			"enter": func(): g.cue("kick"), "tick": func(dt, t, k): _fly(jump, t, "jump")},
		# 2: behind her, falling: the facade rushing up; the jacket lines; the soles flicker; the wind
		{"dur": 0.9, "fov": 62, "hand": 0.4, "cam": func(k, t): return g.robin.position + Vector3(2.0, 1.8, 0.3), "look": func(k, t): return g.robin.position + Vector3(-2, -1.5, 0),
			"tick": func(dt, t, k): _fly(jump, 0.7 + t, "fly"); coil.global_position = g.robin.position; coil.light_energy = 1.5 if fmod(t*12, 1.0) > 0.5 else 0.3},
		# 3: the shoe, from beneath, turning: the coils compress, glow; THUMP — not a stop, a redirection
		{"dur": 0.8, "fov": 40, "cam": func(k, t): return _bone("RightFoot") + Vector3(cos(k*2.0)*0.5, -0.35, sin(k*2.0)*0.5), "look": func(k, t): return _bone("RightFoot"),
			"tick": func(dt, t, k): _fly(jump, 1.6 + t*0.3, "fly"); coil.global_position = _bone("RightFoot"); coil.light_energy = 6.0*minf(1, t/0.3),
			"beats": [[0.3, func(): g.cue("blast"); g.cam_kick = 1.4; jump.v = Vector3(-9.0, 9.0, 2.5); jump.p0 = g.robin.position; jump.t0 = 1.6 + 0.3*0.3]]},
		# 4: wide: she arcs away from the building, the camera rolling with her until the city is sideways; flying —
		# then gravity
		{"dur": 1.6, "fov": 58, "cam": func(k, t): return g.robin.position + Vector3(3.0, 2.0, 5.0), "look": func(k, t): return g.robin.position,
			"enter": func(): g.dutch = 0.0, "tick": func(dt, t, k): _fly(jump, jump.get("t0", 1.7) + t, "fly"); g.dutch = sin(k*PI)*0.55; coil.light_energy = 0.0},
		# 5: behind her, just above her shoulder; steadier; the roofs ahead; only the wind and the shoes' pulse
		{"dur": 1.0, "fov": 72, "cam": func(k, t): return g.robin.position + Vector3(4.0, 2.0, 0.0), "look": func(k, t): return g.robin.position + Vector3(-8, -1, 0),
			"enter": func(): g.dutch = 0.0, "tick": func(dt, t, k): _fly(jump, jump.get("t0", 1.7) + 1.6 + t, "fly")},
	]
	g.play_reel(shots, func(_s): clear(); g.dutch = 0.0; g.letterbox(false); g.take_over(g.robin.position, _vel(jump, jump.get("t0", 1.7) + 2.6), -PI/2))

func _pocket(rb) -> void:
	if is_instance_valid(rb): rb.visible = false
	g.cue("pick")
func _to_table(k: float, a: Vector2, b: Vector2, face: float) -> void:
	if k < 0.7: g.walk_stage(a, b, k/0.7)
	else: g.stage("idle", b.x, 0, b.y, face)
func _reading(t: float, D: Vector3) -> void:
	g._note_hold()
	if t > 2.6: g.face.target = D + Vector3(0, 1.2, 0)
## her body through the air: from the sill, along the arc (the shoes' redirection starts a new one)
func _fly(j: Dictionary, t: float, clip: String) -> void:
	var t0: float = j.get("t0", 0.0); var dt := t - t0
	var p: Vector3 = j.p0 + (j.v as Vector3)*dt + Vector3(0, -9.8*0.5*dt*dt, 0)
	g.stage(clip, p.x, p.y, p.z, atan2(j.v.x, j.v.z))
func _vel(j: Dictionary, t: float) -> Vector3:
	var dt := t - float(j.get("t0", 0.0))
	return (j.v as Vector3) + Vector3(0, -9.8*dt, 0)
