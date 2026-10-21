## BEFORE THE CALL. The story now opens on the city, then on her:
##   NEW YORK CITY · 2044 — over the towers, the gangs with their wearables lit, WFC's drones and vans and officers,
##   the billboard; and over it all her mother, the Director, on what the city has come to (subtitles; no voice yet).
##   HER ROOM — her song on (tools/song/rock.py), a montage over its intro: dancing, on the bed, the speaker, her face;
##   she picks up the guitar — and the film stops for the game (guitar.gd: Guitar Hero, her song's lead line).
##   CANON CALLS — school, the robot, tomorrow; and while she is on with him, an unknown number comes through. "Hold on.
##   Let me call you back." The buyer — and the night goes on as it did (game.gd opening, after its call).
class_name Intro
extends Node

var g
var gang: Array = []; var lights: Array = []
var axe: Node3D = null; var pose: GuitarPose = null; var room_guitar: Array = []
var game: GuitarGame
var gt := 0.0; var playing := false; var spot := Vector3.ZERO; var face_y := 0.0
var strum := 0.0
var auto := false

func _init(game_) -> void: g = game_

func _ready() -> void:
	game = GuitarGame.new(g); g.hud.add_child(game)

func start() -> void:
	g.talk_q.clear(); g.kit_all(false); g.shades(false); g.music.stop(); game.band.stop()
	g.letterbox(true)
	# for review (-- new room): straight to her room, the song played by itself
	if OS.get_cmdline_user_args().has("auto"): auto = true          # for recording: the song plays itself
	if OS.get_cmdline_user_args().has("room"): auto = true; g.black(true); room(); return
	if OS.get_cmdline_user_args().has("suit"):
		g.robin.visible = true; g.show_inside(true); g.kit_all(false); g.apt_boots(true); g.apt_pack(true); g._form_jacket(true); g._note_home(); suit(); return
	# SEQUENCE 1 (docs/script/the_other_robin_cold_open_1.1.md, shots 01–11)
	var oc = OpeningCity.new(g); add_child(oc)
	oc.play(func(): oc.queue_free(); g.black(true); g.talk_q.clear(); g.mode = "end"; g.get_tree().create_timer(0.35).timeout.connect(room))

# ================================================================== A · NEW YORK CITY · 2044 (docs/INTRO_SHOT_LIST.md)
func city() -> void:
	var c: Chase = g.chase
	c.stop(); c.build()
	g.robin.visible = false
	g.show_inside(false); g.black(true)
	g.raid._screen(); g.raid.screens("wfc")
	var scr: Vector3 = g.raid.screen.global_position
	# the gang, on Neon Avenue: three of them, their wearables lit
	var G0 := Vector2(-74, 0.6)
	for i in 3:
		var n: Node3D = (load("res://assets/tsh/people/%s.glb" % ["thug-a", "thug-b", "thug-buyer"][i]) as PackedScene).instantiate(); g.add_child(n)
		n.position = Vector3(G0.x - (i % 2)*1.3, 0, G0.y + (i - 1)*1.4); n.rotation.y = PI/2
		var ap: AnimationPlayer = g._find(n, func(x): return x is AnimationPlayer)
		if ap: ap.play("idle" if ap.has_animation("idle") else ap.get_animation_list()[0])
		var l := OmniLight3D.new(); l.light_color = [Color("#ff3fd0"), Color("#38ffd0"), Color("#ffb347")][i]; l.light_energy = 2.5; l.omni_range = 3
		l.position = n.position + Vector3(0.35, 1.0, 0); g.add_child(l); lights.append(l)
		gang.append(n)
	var glows := []
	for i in gang.size():
		var gl := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.05; sm.height = 0.1; gl.mesh = sm
		var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_color = (lights[i] as OmniLight3D).light_color*3.0; gl.material_override = gm
		g.add_child(gl); glows.append(gl)
	lights.append_array(glows)
	# WFC: officers across the avenue, a drone over them, another sweeping the street, the vans; their light bars
	var cops := []
	for i in 3:
		var cp: Dictionary = c.spawn_cop(Vector3(-62, 0, -1.6 + i*1.6), "cut"); cp.yaw = -PI/2; c._cop_play(cp, "idle"); c._cop_place(cp); cops.append(cp)
	var dr: Dictionary = c.spawn_drone(Vector3(-67, 9, 0)); c.drones.append(dr)
	var dr2: Dictionary = c.spawn_drone(Vector3(-40, 14, 16)); c.drones.append(dr2)
	if c.vans.size() >= 2: c.van_place(c.vans[0], -54, 3.4, PI/2); c.van_place(c.vans[1], -54, -3.8, PI/2)
	var strobe := OmniLight3D.new(); strobe.omni_range = 16; strobe.light_energy = 6; strobe.position = Vector3(-55, 2.4, 0); g.add_child(strobe); lights.append(strobe)
	var pulse := OmniLight3D.new(); pulse.light_color = Color("#9ff8ff"); pulse.light_energy = 0; pulse.omni_range = 14; pulse.position = Vector3(-70, 1.4, 0.6); g.add_child(pulse); lights.append(pulse)
	var hand := func(): var h = g._bone_pos(gang[0], "RightHand"); return h if h != null else Vector3(-74, 1.0, 0.6)
	var fire := func():
		g.cue("blast"); pulse.light_energy = 22.0; g.station.flash(0.85, Color("#e8fbff")); g.cam_kick = 1.6
		var tw: Tween = g.create_tween(); tw.tween_property(pulse, "light_energy", 0.0, 0.4)
	var life := func(dt, t, k):
		dr.node.rotation.y = sin(t*1.4)*0.6
		var tt := Time.get_ticks_msec()/1000.0
		strobe.light_color = Color(1, 0.15, 0.15) if int(tt*6) % 2 == 0 else Color(0.2, 0.35, 1)
		for i in gang.size():
			var h = g._bone_pos(gang[i], "RightHand")
			if h != null: glows[i].global_position = h; lights[i].global_position = h + Vector3(0.1, 0.1, 0)
	var sweep_dr := func(k: float):                    # the drone across the street, its light raking it
		dr2.node.position = Vector3(-40, 14, 16).lerp(Vector3(-78, 9, -6), k); dr2.node.rotation.y = -2.2
	g.music_cue("intro.city")
	var L: float = g.lines_len("cityVO")
	var shots := [
		# A1 EXTREME WIDE: a crane down over the district, tilting from the roofs up to the skyline; the title
		{"dur": 5.0, "fov": 52, "inside": false, "cam": [Vector3(70, 78, 72), Vector3(28, 40, 30)], "look": [Vector3(-30, 0, -20), Vector3(-62, 14, -18)],
			"enter": func(): g.black(false); _title(true); g.cue("siren"); g.get_tree().create_timer(0.6).timeout.connect(func(): if g.reel: g.talk("cityVO")),
			"tick": life},
		# A2 WIDE: the drone sweeps past — a whip-pan with it
		{"dur": 1.9, "fov": 50, "cam": Vector3(-56, 5.5, 13), "look": func(k, t): return dr2.node.position + Vector3(0, -1.5, 0),
			"enter": func(): _title(false), "tick": func(dt, t, k): life.call(dt, t, k); sweep_dr.call(k), "ease": false},
		# A3 LOW ANGLE: ground level, pushing in toward the gang under the neon
		{"dur": 2.8, "fov": 40, "cam": [Vector3(-63.5, 0.35, 3.2), Vector3(-68.5, 0.45, 1.6)], "look": [Vector3(-73, 1.3, 0.4), Vector3(-73.5, 1.2, 0.5)], "tick": life, "hand": 0.3},
		# A4 INSERT: a hand; the ring flares
		{"dur": 1.3, "fov": 26, "dof": 0.6, "cam": func(k, t): return hand.call() + Vector3(0.55, 0.12, 0.4), "look": func(k, t): return hand.call(),
			"enter": func(): g.cue("rise"), "tick": func(dt, t, k): life.call(dt, t, k); glows[0].scale = Vector3.ONE*(1.0 + k*4.0); lights[0].light_energy = 2.5 + k*14},
		# A5 the discharge: white, a kick in the lens
		{"dur": 0.5, "fov": 34, "cam": Vector3(-69.5, 1.4, 3.0), "look": Vector3(-74, 1.2, 0.4), "enter": func(): fire.call(); glows[0].scale = Vector3.ONE, "tick": life},
		# A6 OVER THE SHOULDER of an officer, the gang beyond; red and blue on the street; a dutch tilt
		{"dur": 2.9, "fov": 38, "cam": [Vector3(-60.7, 1.75, 0.55), Vector3(-60.9, 1.7, 0.3)], "look": Vector3(-73, 1.2, 0.4), "hand": 0.4,
			"enter": func(): g.dutch = 0.14; g.cue("siren"), "tick": life, "beats": [[1.6, fire]]},
		# A7 HIGH ANGLE, crane up: from the officers' boots over the vans to the drone
		{"dur": 2.5, "fov": 46, "cam": [Vector3(-59.5, 0.5, 3.6), Vector3(-57.5, 10, 8.5)], "look": [Vector3(-62, 0.6, 0), Vector3(-67, 8.5, 0)],
			"enter": func(): g.dutch = 0.0, "tick": life},
		# A8 LOW ANGLE, slow push-in on the billboard; the last line lands; black
		{"dur": 4.6, "fov": 40, "fov2": 30, "cam": [Vector3(-45.2, 0.9, -3.4), Vector3(-43.7, 1.5, -6.2)], "look": scr,
			"tick": life, "beats": [[0.3, func(): g.raid.screens("wfc")]]},
	]
	g.play_reel(shots, func(_s): _city_done(cops))

## the title over the first shot
var title_l: Label; var title_tw: Tween
func _title(v: bool, text := "NEW YORK CITY\n2044") -> void:
	if title_l == null:
		title_l = Label.new(); title_l.set_anchors_preset(Control.PRESET_FULL_RECT); title_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		title_l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER; title_l.add_theme_font_size_override("font_size", 54)
		title_l.add_theme_constant_override("outline_size", 10); title_l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		title_l.mouse_filter = Control.MOUSE_FILTER_IGNORE; g.hud.add_child(title_l)
	if title_tw: title_tw.kill()
	if v: title_l.text = text; title_l.add_theme_font_size_override("font_size", 54 if "\n" in text else 84)
	title_tw = g.create_tween(); title_l.modulate.a = 0.0 if v else title_l.modulate.a
	title_tw.tween_property(title_l, "modulate:a", 1.0 if v else 0.0, 0.8 if v else 0.6)
func _city_done(cops: Array) -> void:
	if title_tw: title_tw.kill()
	if title_l: title_l.modulate.a = 0.0
	for n in gang: n.queue_free()
	for l in lights: l.queue_free()
	gang = []; lights = []
	g.chase.stop(); g.dutch = 0.0
	g.black(true); g.talk_q.clear(); g.mode = "end"
	g.get_tree().create_timer(0.6).timeout.connect(room)

# ================================================================== B · HER ROOM, 21:58 (cut to the song's intro)
var eq: Array = []
var orm: OpeningRoom
func room() -> void:
	var R: Dictionary = g.room.room
	g.robin.visible = true
	g.show_inside(true); g.lamp.light_energy = 1.6
	g.kit_all(false); g.apt_boots(true); g.apt_pack(true); g.apt_window(false); g._form_jacket(true); g._note_home()
	_find_guitar(); _find_eq()
	spot = Vector3(301.6, 0, -1.6); face_y = PI*0.85
	if orm: orm.clear(); orm.queue_free()
	orm = OpeningRoom.new(g, self); add_child(orm)
	orm.film(func(): _play())

## the speaker's light bars: they jump with the song
func _find_eq() -> void:
	if not eq.is_empty(): return
	var at: Vector3 = g._v(g.room.room.speaker.at)
	var st: Array = [g.apt]
	while st.size():
		var n: Node = st.pop_back(); st.append_array(n.get_children())
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D; var bb := mi.global_transform*mi.get_aabb()
			if bb.size.length() < 0.08 and absf(bb.get_center().y - 0.28) < 0.03 and Vector2(bb.get_center().x - at.x, bb.get_center().z - (at.z + 0.11)).length() < 0.2:
				eq.append([mi, mi.scale, randf()*6])

## the room's guitar: hidden while it is in her hands
func _find_guitar() -> void:
	if not room_guitar.is_empty(): return
	var st: Array = [g.apt]
	while st.size():
		var n: Node = st.pop_back(); st.append_array(n.get_children())
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D; var bb := mi.global_transform*mi.get_aabb()
			if bb.get_center().distance_to(Vector3(301.85, 0.48, -3.35)) < 0.15 and bb.size.y > 0.8: room_guitar.append(mi)
func _hold(v: bool) -> void:
	for m in room_guitar: m.visible = not v
	if v and axe == null: axe = _axe(); g.model.add_child(axe)
	if axe: axe.visible = v
	if v and pose == null:
		var sk: Skeleton3D = g._find(g.model, func(x): return x is Skeleton3D)
		pose = GuitarPose.new(); pose.intro = self; sk.add_child(pose)
	if pose: pose.active = v                       # with her playing clips: only her strumming hand, out onto the strings

## a guitar like hers: red, the pickguard cream, a dark neck — slung across her: its body at her right hip, its neck up
## to her left (her model faces +Z; her left is +X)
func _axe() -> Node3D:
	var real := _axe_from_room()
	return real if real else make_axe()
## HER OWN GUITAR, the one against the amp, copied into her hands: its meshes measured where they stand (the long
## axis its neck; the wide end its body; its face the side turned to the room) and re-based to make_axe's frame —
## the body's pickups at the origin, the neck up +Y, the face +Z — so place_axe fits it the same way
func _axe_from_room() -> Node3D:
	_find_guitar()
	if room_guitar.is_empty(): return null
	var pts := PackedVector3Array()
	for mi in room_guitar:
		var m: Mesh = (mi as MeshInstance3D).mesh
		for si in m.get_surface_count():
			var vs: PackedVector3Array = m.surface_get_arrays(si)[Mesh.ARRAY_VERTEX]
			for i in range(0, vs.size(), maxi(1, vs.size()/4000)): pts.append(mi.global_transform*vs[i])
	if pts.size() < 10: return null
	var c := Vector3.ZERO
	for p in pts: c += p
	c /= pts.size()
	# its long axis: the covariance's biggest direction (power iteration)
	var cov := [Vector3.ZERO, Vector3.ZERO, Vector3.ZERO]
	for p in pts:
		var d := p - c
		cov[0] += d*d.x; cov[1] += d*d.y; cov[2] += d*d.z
	var mul := func(v: Vector3) -> Vector3: return cov[0]*v.x + cov[1]*v.y + cov[2]*v.z
	var up := Vector3.UP
	for i in 30: up = (mul.call(up) as Vector3).normalized()
	# its width: the biggest direction across the long one
	var w := Vector3.RIGHT if absf(up.x) < 0.9 else Vector3.FORWARD
	for i in 30:
		w = mul.call(w); w = (w - up*w.dot(up)).normalized()
	var t0 := INF; var t1 := -INF
	for p in pts: var t := (p - c).dot(up); t0 = minf(t0, t); t1 = maxf(t1, t)
	# which end is the body: the wider third
	var wa := 0.0; var wb := 0.0; var L := t1 - t0
	for p in pts:
		var t := (p - c).dot(up); var ww := absf((p - c).dot(w))
		if t < t0 + L/3: wa = maxf(wa, ww)
		elif t > t1 - L/3: wb = maxf(wb, ww)
	if wb > wa: up = -up; var tt := t0; t0 = -t1; t1 = -tt
	var face := w.cross(up).normalized()
	var room_mid := Vector3(300, c.y, 0)
	if face.dot(room_mid - c) < 0: face = -face; w = -w                 # its face the side turned to the room
	# the origin: across the body, a fifth of the way up from its end (where the pickups are)
	var o := c + up*(t0 + L*0.2)
	var body_c := Vector3.ZERO; var nb := 0
	for p in pts:
		if (p - c).dot(up) < t0 + L*0.4: body_c += p; nb += 1
	if nb > 0: body_c /= nb; o += w*(body_c - o).dot(w)
	var frame := Transform3D(Basis(w, up, face), o)
	var root := Node3D.new(); root.name = "axe"
	var front := 0.0; var back := 0.0                                   # how far its face and its back stand from its middle
	for p in pts:
		if (p - c).dot(up) < t0 + L*0.45: front = maxf(front, (p - o).dot(face)); back = maxf(back, -(p - o).dot(face))
	root.set_meta("front", clampf(front, 0.01, 0.08)); root.set_meta("back", clampf(back, 0.01, 0.08))
	var inv := frame.affine_inverse()
	for mi in room_guitar:
		var copy := MeshInstance3D.new(); copy.mesh = mi.mesh
		for si in mi.get_surface_override_material_count(): copy.set_surface_override_material(si, mi.get_surface_override_material(si))
		copy.material_override = mi.material_override
		copy.transform = inv*mi.global_transform; root.add_child(copy)
	return root
## a guitar like hers: red, the pickguard cream, a dark neck; its body at the origin, its neck along +Y, its face +Z
static func make_axe() -> Node3D:
	var root := Node3D.new(); root.name = "axe"
	var m := func(c: Color, r := 0.3, met := 0.2) -> StandardMaterial3D:
		var s := StandardMaterial3D.new(); s.albedo_color = c; s.roughness = r; s.metallic = met; return s
	var red: StandardMaterial3D = m.call(Color("#b8203a"), 0.35, 0.1)
	var disc := func(r: float, at: Vector3, mat: Material, h := 0.045):
		var d := MeshInstance3D.new(); var c := CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r; c.height = h; c.radial_segments = 32; d.mesh = c
		d.material_override = mat; d.rotation.x = PI/2; d.position = at; root.add_child(d); return d
	disc.call(0.17, Vector3(0, -0.04, 0), red)                                 # the lower bout
	disc.call(0.13, Vector3(0, 0.17, 0), red)                                  # the upper bout
	disc.call(0.09, Vector3(0, 0.07, 0), red)                                  # the waist between them
	disc.call(0.075, Vector3(0.035, -0.07, 0.003), m.call(Color("#f5f2e8"), 0.4, 0.0), 0.046)   # the pickguard
	var bridge := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.11, 0.025, 0.012); bridge.mesh = bm
	bridge.material_override = m.call(Color(0.75, 0.75, 0.78), 0.2, 0.9); bridge.position = Vector3(0, -0.1, 0.028); root.add_child(bridge)
	for i in 2:
		var pu := MeshInstance3D.new(); var pm := BoxMesh.new(); pm.size = Vector3(0.085, 0.03, 0.01); pu.mesh = pm
		pu.material_override = m.call(Color(0.08, 0.08, 0.09), 0.4, 0.3); pu.position = Vector3(0, 0.0 + i*0.07, 0.027); root.add_child(pu)
	var neck := MeshInstance3D.new(); var nb := BoxMesh.new(); nb.size = Vector3(0.045, 0.56, 0.022); neck.mesh = nb
	neck.material_override = m.call(Color("#6a4a2a"), 0.6, 0.0); neck.position = Vector3(0, 0.55, 0); root.add_child(neck)
	var head := MeshInstance3D.new(); var hb := BoxMesh.new(); hb.size = Vector3(0.07, 0.15, 0.022); head.mesh = hb
	head.material_override = m.call(Color("#111111"), 0.4); head.position = Vector3(0, 0.9, 0); root.add_child(head)
	return root
## THE GUITAR IN HER HANDS: its body against her, under her strumming hand; its neck running to her fretting hand
## (which sits two thirds of the way up it); its face out from her body
static func place_axe(axe: Node3D, sk: Skeleton3D, model: Node3D) -> void:
	var b := func(n: String) -> Vector3: return sk.global_transform*sk.get_bone_global_pose(sk.find_bone("mixamorig" + n)).origin
	var r: Vector3 = b.call("RightHand"); var l: Vector3 = b.call("LeftHand"); var chest: Vector3 = b.call("Spine1")
	var fwd: Vector3 = model.global_basis.z.normalized()
	var c: Vector3 = r - (l - r).normalized()*0.04 + Vector3(0, -0.03, 0)    # its pickups under the strumming hand
	# against her: no further out from her body than her belly
	var out_now := (c - chest).dot(fwd); c += fwd*(0.13 - out_now)
	var up := (l - c).normalized()
	var z := (fwd - up*fwd.dot(up)).normalized(); var x := up.cross(z).normalized()
	# off her body: its back a hand's breadth clear of the front of her torso (her spine and hips, plus the body
	# round them)
	var torso := -INF
	for bn in ["Hips", "Spine", "Spine1", "Spine2"]: torso = maxf(torso, (b.call(bn) as Vector3).dot(z))
	torso += 0.14
	var front: float = axe.get_meta("front", 0.025); var back: float = axe.get_meta("back", 0.025)
	c += z*(torso + back + 0.04 - c.dot(z))                              # (her hand is brought out to it: GuitarPose)
	up = (l - c).normalized(); z = (fwd - up*fwd.dot(up)).normalized(); x = up.cross(z).normalized()
	axe.global_transform = Transform3D(Basis(x, up, z), c)
## where her hands go on it (world): the left on the neck, the right over the strings, strumming
## THE GUITAR IN HER HANDS (with the Mixamo playing clips): its body at her strumming hand, its neck out to her
## fretting hand, its face to the front of her — refitted every frame as the clip moves her arms
func fit_axe() -> void:
	if axe == null or not axe.visible or not g.anim.has_animation("guitar_a") or not g.clip.begins_with("guitar"): return
	place_axe(axe, g._find(g.model, func(x): return x is Skeleton3D), g.model)
func neck_at() -> Vector3: return axe.global_transform*Vector3(0, 0.55, 0.03)
func strum_at() -> Vector3: return axe.global_transform*Vector3(0.02, 0.02 - strum*0.09, 0.07)

# ------------------------------------------------------------------ C · the game, and the camera on her
func _play() -> void:
	g.mode = "guitar"; g.set_caption(""); g.dutch = 0.0
	g.stage("guitar_a" if g.anim.has_animation("guitar_a") else "idle", spot.x, 0, spot.z, face_y)
	game.auto = auto
	game.start(func(r): _played(r), func(lane): strum = 1.0)
	g.lesson_card("ROBIN · HER SONG", "PLAY", "←  ↓  ↑  →  — each note as it reaches the line.\nWhen the guitar drops out, watch the room.")
	g.get_tree().create_timer(3.5).timeout.connect(func(): g.lesson_card("", "", ""))
	playing = true; gt = 0.0

## THE CAMERA THROUGH THE SONG (worth_chart.json). Where the electric guitar plays (chart.play, and a moment before it,
## so the first notes are seen coming) the camera is on her playing — a new angle every two bars, cut on the bar line.
## Where it drops out, the scene looks round her room: the homework, the drafting board, the cables — a cut every two
## beats, on the beat, with her in the back of it now and then. The last bars: the hero angle, the jump on the chord.
const PLAY_ANGLES := ["hand", "floor", "orbit", "shoulder", "wardrobe", "front"]
## the room between the guitar's sections, one list per gap (no shot twice): the first gap is short, two cuts
const TOURS := [["test", "wires"], ["homework", "wall", "tangle", "her", "schematic", "sensor", "cat", "pinned", "her"]]
func _idx(arr: Array, t: float) -> int:
	# how many of the times in arr are at or before t
	var i := 0
	while i < arr.size() and float(arr[i]) <= t + 0.01: i += 1
	return i
func tick(dt: float) -> void:
	strum = maxf(0, strum - dt*6)
	fit_axe()
	var bpm: float = float(game.chart.bpm)
	for e in eq:
		var lvl := absf(sin(game.now*PI*bpm/60.0*(1 + e[2]*0.1) + e[2]))*(1.0 if game.band.playing else 0.0)
		(e[0] as Node3D).scale = Vector3(e[1].x, e[1].y*(0.4 + lvl*1.8), e[1].z)
	if not playing: return
	gt += dt
	var now := game.now; var C: Dictionary = game.chart
	var cam: Camera3D = g.cam; var P := spot
	var fwd := Vector3(sin(face_y), 0, cos(face_y)); var left := Vector3(cos(face_y), 0, -sin(face_y))
	var pos := Vector3.ZERO; var look := P + Vector3(0, 1.15, 0); var fov := 46.0
	var beat := 60.0/bpm
	var beatk := absf(sin(now*PI/beat))
	var dof := -1.0; var shift := 0.45
	var bars: Array = C.bars; var beats: Array = C.beats
	var end: float = float(C.end); var last: Array = C.play[-1]
	var win := -1
	for i in C.play.size():
		if now >= float(C.play[i][0]) - AHEAD_CAM and now < float(C.play[i][1]) + 0.25: win = i
	# her playing: the first section on one clip, the second on the other
	var hero := now >= end - bar_len()*2.0
	if g.anim.has_animation("guitar_b") and not hero: g.stage("guitar_b" if win == 1 else "guitar_a", P.x, 0, P.z, face_y)
	if hero:
		# · the final chord: a low hero angle; she jumps and lands on it; the camera overshoots and settles
		var k := clampf((now - (end - bar_len()*2.0))/(bar_len()*2.0 - 0.6), 0, 1)
		pos = P + fwd*1.7 - left*0.5 + Vector3(0, 0.3 + sin(k*PI)*0.25, 0); look = P + Vector3(0, 1.25 + sin(k*PI)*0.2, 0); fov = 50; shift = 0.0
		if k > 0.62 and k < 0.8: g.stage("jump", P.x, sin((k - 0.62)/0.18*PI)*0.5, P.z, face_y)
		elif k >= 0.8: g.stage("idle", P.x, 0, P.z, face_y)
	elif win >= 0:
		# a new angle every two bars, on the bar line (counted from the section's own first bar)
		var b0 := _idx(bars, float(C.play[win][0]) - AHEAD_CAM)
		var m := maxi(0, _idx(bars, now) - b0)/2
		# an angle that would only get a moment before the section ends stays on the one before it
		if m > 0 and b0 + 2*m - 1 < bars.size() and float(bars[b0 + 2*m - 1]) + bar_len() > float(C.play[win][1]) + 0.25: m -= 1
		var n := m + win*3
		var since: float = now - (float(bars[maxi(0, _idx(bars, now) - 1)]) if _idx(bars, now) > 0 else 0.0)
		var k := clampf(since/(bar_len()*2.0), 0, 1)
		match PLAY_ANGLES[n % PLAY_ANGLES.size()]:
			"hand":           # her picking hand, the strings in front, her face soft behind
				var h: Vector3 = strum_at() if axe else P + Vector3(0, 1.0, 0)
				pos = P + fwd*1.25 - left*0.3 + Vector3(0, 1.15, 0); look = h; fov = 20; dof = (pos - h).length()
			"floor":          # low from the floor, her towering over the lens
				pos = P + fwd*lerpf(1.5, 1.2, k) - left*0.35 + Vector3(0, 0.14, 0); look = P + Vector3(0, 1.35, 0); fov = 58
			"orbit":          # a fast orbit: the window, the bench, the drafting board sweeping past
				var an := now*0.85; pos = P + Vector3(sin(an + face_y)*2.0, 1.3, cos(an + face_y)*2.0); fov = 50
			"shoulder":       # over her shoulder, her fingers on the fretboard
				pos = P + left*1.3 + fwd*0.35 + Vector3(0, 1.45, 0); look = (neck_at() if axe else P + Vector3(0, 1.2, 0)); fov = 36; dof = 1.4
			"wardrobe":       # wide, from on top of the wardrobe in the corner, looking down on her
				var a: Dictionary = g.room.apt
				pos = Vector3(a.x2 - 0.45, 2.85, a.z1 + 0.45 + k*0.4); look = P + Vector3(0, 0.9, 0); fov = 54
			_:                # tight and frontal; lost in it
				pos = P + fwd*0.95 + Vector3(0, 1.52, 0); look = P + Vector3(0, 1.45, 0); fov = 30; dof = 1.4
	else:
		# THE ROOM: the gap's own list, a cut every two beats on the beat (the first takes the part-beat before it,
		# the last runs to the gap's end); each a slow push
		var gi := 0; var g0 := 0.0; var g1 := end - bar_len()*2.0
		for i in C.play.size():
			if now >= float(C.play[i][1]) + 0.25: gi = i; g0 = float(C.play[i][1]) + 0.25; g1 = float(C.play[i + 1][0]) - AHEAD_CAM if i + 1 < C.play.size() else end - bar_len()*2.0
		var list: Array = TOURS[mini(gi, TOURS.size() - 1)]
		var j0 := _idx(beats, g0)
		var cuts := [g0]
		for c in range(1, list.size()):
			var at_i := j0 - 1 + 2*c
			if at_i >= beats.size() or float(beats[at_i]) > g1 - beat*1.5: break
			cuts.append(float(beats[at_i]))
		var cut := maxi(0, _idx(cuts, now) - 1)
		var c_end: float = float(cuts[cut + 1]) if cut + 1 < cuts.size() else g1
		var k := clampf((now - float(cuts[cut]))/maxf(0.1, c_end - float(cuts[cut])), 0, 1)
		var shot := _tour_shot(list[cut])
		shift = 0.0
		if shot.is_empty():
			# her, playing on, from across the room past the bench and the cables
			pos = (P + fwd*2.6 + left*1.1 + Vector3(0, 1.0, 0)).lerp(P + fwd*2.2 + left*0.9 + Vector3(0, 1.05, 0), k)
			look = P + Vector3(0, 1.1, 0); fov = 42; dof = 2.2
		else:
			var at: Vector3 = shot[0]; var from: Vector3 = shot[1]
			pos = from.lerp(at + (from - at)*0.82, k); look = at; fov = 40; dof = (from - at).length()*0.9
	if dof > 0:
		var at := CameraAttributesPractical.new(); at.dof_blur_far_enabled = true; at.dof_blur_far_distance = dof + 0.3; at.dof_blur_far_transition = maxf(0.6, dof); at.dof_blur_amount = 0.14; cam.attributes = at
	else: cam.attributes = null
	# while the highway is up: her a little to one side of it (the look shifted the other way along the lens)
	var side := (look - pos).cross(Vector3.UP).normalized()
	look += side*shift*game.shown
	cam.global_position = pos + Vector3(0, beatk*0.015, 0)
	if (look - pos).length() > 0.05: cam.look_at(look)
	cam.fov = fov
const AHEAD_CAM := 1.8
## a place in her room for the tour: [look at, from] — the dressing's own spots, else the bedroom's (seen from the
## room's middle side of them), else [] (her)
func _tour_shot(name: String) -> Array:
	if orm and orm.dress and orm.dress.spots.has(name): return orm.dress.spots[name]
	var bd = g.get("bedroom")
	if bd == null: return []
	if name == "cat" and bd.cat: var h: Vector3 = bd.cat.head.global_position; return [h, h + Vector3(0.45, 0.12, -0.35)]
	if not bd.spots.has(name): return []
	var at: Vector3 = bd.spots[name]
	var mid := Vector3(300, at.y, 0); var out := (mid - at); out.y = 0; out = out.normalized()
	var dist := 2.0 if name == "wall" else 1.0
	if name == "shelf": return [at + Vector3(0, -0.12, 0), at + out*1.1 + Vector3(0, -0.05, 0)]      # level with the records
	return [at, at + out*dist + Vector3(0, 0.2, 0)]
func bar_len() -> float: return 240.0/float(game.chart.bpm)

func key(ev: InputEventKey) -> bool:
	if not playing: return false
	if game.key(ev): return true
	if ev.pressed and (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER) and not game.results:
		var r := game.result(); game.stop(); _played(r); return true
	return true

## SEQUENCE 3 (opening_suit.gd), the ring box from the table going into her pack
func suit() -> void:
	var s = OpeningSuit.new(g); add_child(s)
	s.play(orm.box if orm else null)
func _played(r: Dictionary) -> void:
	if not playing: return
	playing = false; game.stop()
	g.mode = ""; _hold(false)
	g.note("★".repeat(r.stars) + "  %d / %d" % [r.hits, r.total])
	orm.after(func(): suit())

# ================================================================== D · CANON CALLS
func calls() -> void:
	var R: Dictionary = g.room.room; var bed: Dictionary = R.bed
	var sit := func(): g.stage("wake", bed.x - 0.15, bed.seat, bed.z - 0.05, PI/2)
	var near := Vector3(bed.x + 0.6, 0, bed.z - 1.15); var ry := PI
	var talking := func(): g.stage("phone_talk", near.x, 0, near.z, ry)
	var reading := func(): g.stage("phone_read", near.x, 0, near.z, ry)
	var c1: float = g.lines_len("canonPhone"); var c2: float = g.lines_len("canonHold"); var c3: float = g.lines_len("call")
	var seat := Vector3(bed.x - 0.15, bed.seat, bed.z - 0.05)
	var shots := [
		# D1 TOP-DOWN on the bed, slowly turning: out of breath; the phone buzzes — CANON
		{"dur": 2.6, "fov": 50, "mood": "happy", "inside": true, "cam": func(k, t): return seat + Vector3(sin(k*0.5)*0.3, 2.4, cos(k*0.5)*0.3 - 0.05), "look": seat + Vector3(0, 0.6, 0),
			"enter": func(): sit.call(); g.ringing(true); g.phone_show("call", "CANON")},
		# D2 MEDIUM CLOSE, drifting across her as she talks; the city through the window behind
		{"dur": c1 + 0.6, "fov": 34, "dof": 1.4, "mood": "soft",
			"cam": func(k, t): return near + Vector3(sin(ry + 0.5 - k*1.0)*1.35, 1.5, cos(ry + 0.5 - k*1.0)*1.35), "look": near + Vector3(0, 1.48, 0),
			"enter": func(): g.ringing(false); g.cue("ui"); talking.call(); g.phone_show("oncall", "CANON"); g.talk("canonPhone"), "ease": false},
		# D3 CLOSE-UP: she glances down at the phone — a second call: UNKNOWN
		{"dur": 2.2, "fov": 28, "dof": 0.8, "mood": "skeptical",
			"cam": [g.rel(near.x, near.z, ry, 0.85, -0.25, 1.45), g.rel(near.x, near.z, ry, 0.7, -0.2, 1.42)], "look": near + Vector3(0, 1.35, 0),
			"enter": func(): reading.call(); g.cue("phone"); g.phone_show("call", "UNKNOWN"); g.get_tree().create_timer(1.0).timeout.connect(func(): g.cue("phone"))},
		# D4 CLOSE-UP, pushing in: "Hold on. Let me call you back."
		{"dur": c2 + 0.5, "fov": 30, "fov2": 24, "dof": 0.9, "mood": "focused", "cam": [g.rel(near.x, near.z, ry, 1.0, 0.2, 1.55), g.rel(near.x, near.z, ry, 0.8, 0.15, 1.55)], "look": near + Vector3(0, 1.52, 0),
			"enter": func(): talking.call(); g.phone_show("oncall", "CANON"); g.talk("canonHold")},
		# D5 MEDIUM, low: the buyer
		{"dur": c3 + 1.3, "fov": 38, "mood": "focused", "cam": [g.rel(near.x, near.z, ry, 1.6, -0.6, 0.9), g.rel(near.x, near.z, ry, 1.4, -0.5, 1.0)], "look": near + Vector3(0, 1.45, 0),
			"enter": func(): g.cue("hangup"); g.get_tree().create_timer(0.3).timeout.connect(func(): g.cue("ui"); g.phone_show("oncall", "UNKNOWN"); g.talk("call")),
			"beats": [[c3 + 1.0, func(): g.cue("hangup"); g.phone_show("")]]},
	]
	g.play_reel(shots, func(_s): g.phone_show(""); g.phone_prop.hold(""); g.letterbox(false); g.S.step = "wake"; g._save(); g.opening(true))

# ------------------------------------------------------------------ her arms on the guitar
## THE ARMS: two bones each, solved after the clip (a law-of-cosines solve in the skeleton's space): the left hand on
## the neck, the right over the strings, its elbow down and out
class GuitarPose extends SkeletonModifier3D:
	var intro
	func _process_modification() -> void:
		if not active or intro == null or intro.axe == null or not intro.axe.visible: return
		var s := get_skeleton(); var inv := s.global_transform.affine_inverse()
		if intro.g.anim.has_animation("guitar_a"): _onto_strings(s, inv); return
		var mb: Basis = intro.g.model.global_basis
		_arm(s, "Left", inv*intro.neck_at(), inv.basis*(mb*Vector3(0.6, -1.0, -0.4)))
		_arm(s, "Right", inv*intro.strum_at(), inv.basis*(mb*Vector3(-0.7, -1.0, -0.2)))
	## her playing clip's strumming hand, where it would be inside the guitar's body: out to just over its face
	func _onto_strings(s: Skeleton3D, inv: Transform3D) -> void:
		var axe: Node3D = intro.axe; var z := axe.global_basis.z.normalized()
		var ia := s.find_bone("mixamorigRightArm"); var ic := s.find_bone("mixamorigRightHand"); var ib := s.find_bone("mixamorigRightForeArm")
		if ia < 0 or ib < 0 or ic < 0: return
		var r := s.global_transform*s.get_bone_global_pose(ic).origin
		var plane := (axe.global_position + z*(float(axe.get_meta("front", 0.025)) + 0.035)).dot(z)
		var d := plane - r.dot(z)
		if d <= 0: return
		var A := s.get_bone_global_pose(ia).origin; var B := s.get_bone_global_pose(ib).origin; var C := s.get_bone_global_pose(ic).origin
		_arm(s, "Right", inv*(r + z*d), B - (A + C)*0.5)
	func _arm(s: Skeleton3D, side: String, t: Vector3, pole: Vector3) -> void:
		var ia := s.find_bone("mixamorig%sArm" % side); var ib := s.find_bone("mixamorig%sForeArm" % side); var ic := s.find_bone("mixamorig%sHand" % side)
		if ia < 0 or ib < 0 or ic < 0: return
		var A := s.get_bone_global_pose(ia); var B := s.get_bone_global_pose(ib); var C := s.get_bone_global_pose(ic)
		var a := A.origin; var b := B.origin; var c := C.origin
		var l1 := (b - a).length(); var l2 := (c - b).length()
		var d := clampf((t - a).length(), 0.02, l1 + l2 - 0.002); var dir := (t - a).normalized()
		var x := (l1*l1 - l2*l2 + d*d)/(2*d); var h := sqrt(maxf(0, l1*l1 - x*x))
		var pp := (pole - dir*pole.dot(dir)); pp = pp.normalized() if pp.length() > 1e-4 else Vector3.DOWN
		var e := a + dir*x + pp*h
		# the upper arm turned so its bone points at the elbow
		var q1 := Quaternion((b - a).normalized(), (e - a).normalized())
		A.basis = Basis(q1)*A.basis
		s.set_bone_global_pose(ia, A)
		# the forearm, from where it is now, at the hand's place
		var B2 := s.get_bone_global_pose(ib); var C2 := s.get_bone_global_pose(ic)
		var q2 := Quaternion((C2.origin - B2.origin).normalized(), (t - B2.origin).normalized())
		B2.basis = Basis(q2)*B2.basis
		s.set_bone_global_pose(ib, B2)
