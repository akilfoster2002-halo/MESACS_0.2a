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
	g.talk_q.clear(); g.kit_all(false); g.shades(false)
	g.letterbox(true)
	city()

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
	g.score("wos-a", -16)
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
func _title(v: bool) -> void:
	if title_l == null:
		title_l = Label.new(); title_l.set_anchors_preset(Control.PRESET_FULL_RECT); title_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		title_l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER; title_l.add_theme_font_size_override("font_size", 54)
		title_l.add_theme_constant_override("outline_size", 10); title_l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		title_l.mouse_filter = Control.MOUSE_FILTER_IGNORE; title_l.text = "NEW YORK CITY\n2044"; g.hud.add_child(title_l)
	if title_tw: title_tw.kill()
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
func room() -> void:
	var R: Dictionary = g.room.room; var a: Dictionary = g.room.apt
	g.robin.visible = true
	g.show_inside(true); g.lamp.light_energy = 1.6
	g.kit_all(false); g.apt_boots(true); g.apt_pack(true); g.apt_window(false); g._form_jacket(true); g._note_home()
	_find_guitar(); _find_eq()
	var bed: Dictionary = R.bed; var top: float = bed.get("top", 0.72)
	var spk: Vector3 = g._v(R.speaker.at)
	spot = Vector3(300.6, 0, -0.9); face_y = 0.0
	var G_at := Vector3(301.85, 0, -2.75)
	game.song()
	var bar := 60.0/140.0*4.0; var beat := bar/4
	var P := spot
	var run0 := Vector2(305.0, -3.3); var run1 := Vector2(299.9, 1.35)
	var rdir := (run1 - run0).normalized(); var rside := Vector2(rdir.y, -rdir.x)
	if rside.x < 0: rside = -rside
	var her := func(y := 1.1): return g.robin.position + Vector3(0, y, 0)
	var shots := [
		# B1 EXTREME CLOSE-UP: the speaker, pushing in as the riff starts
		{"dur": beat*2, "fov": 36, "dof": 0.5, "mood": "grin", "inside": true, "cam": [spk + Vector3(0.42, 0.14, 0.5), spk + Vector3(0.24, 0.16, 0.3)], "look": spk + Vector3(0.0, 0.1, 0.1),
			"enter": func(): g.black(false); g.set_caption("INT. ROBIN'S ROOM — 21:58"); g.stage("sprint", run0.x, 0, run0.y, atan2(rdir.x, rdir.y))},
		# B2 TRACKING, a zoom: she sprints across the apartment, kitchen to bed
		{"dur": beat*6, "fov": 58, "fov2": 28, "mood": "grin", "hand": 0.25,
			"cam": func(k, t): var q: Vector3 = g.robin.position; return Vector3(q.x + rside.x*2.6, 1.0, q.z + rside.y*2.6) + Vector3(rdir.x, 0, rdir.y)*0.8,
			"look": func(k, t): return her.call(1.15),
			"tick": func(dt, t, k): g.stage("sprint", lerpf(run0.x, run1.x, k), 0, lerpf(run0.y, run1.y, k), atan2(rdir.x, rdir.y)), "ease": false},
		# B3 LOW ANGLE, crane up: she leaps onto the bed and bounces on the beat
		{"dur": bar, "fov": 48, "mood": "happy", "cam": [Vector3(bed.x + 1.4, 0.2, bed.z - 1.1), Vector3(bed.x + 1.2, 1.3, bed.z - 1.3)], "look": func(k, t): return her.call(1.0),
			"tick": func(dt, t, k): g.stage("jump", bed.x + 0.2, top + absf(sin(t*PI*140.0/60.0))*0.6, bed.z, PI/2)},
		# B4 CLOSE-UP, dutch, handheld: her face, singing along
		{"dur": beat*2, "fov": 28, "dof": 1.1, "mood": "grin", "hand": 0.6, "cam": g.rel(P.x, P.z, 0.0, 1.0, 0.2, 1.55), "look": P + Vector3(0, 1.55, 0),
			"enter": func(): g.stage("dance", P.x, 0, P.z, 0.0); g.dutch = 0.2; g.face.flap = 1.2},
		# B5 INSERT: her feet on the rug
		{"dur": beat*2, "fov": 40, "cam": [P + Vector3(0.7, 0.16, 0.75), P + Vector3(0.45, 0.14, 0.65)], "look": P + Vector3(0, 0.1, 0),
			"enter": func(): g.dutch = 0.0},
		# B6 ORBIT: a fast half-circle round her as she dances
		{"dur": bar, "fov": 44, "mood": "happy", "cam": func(k, t): var an = -1.5 + k*PI; return P + Vector3(sin(an)*2.1, 1.15 + k*0.4, cos(an)*2.1),
			"look": P + Vector3(0, 1.15, 0), "ease": false},
		# B7 WIDE, overhead from the ceiling corner: a spin
		{"dur": bar, "fov": 56, "mood": "grin", "cam": [Vector3(a.x2 - 0.5, 2.95, a.z1 + 0.5), Vector3(a.x2 - 0.9, 2.85, a.z1 + 0.8)], "look": P + Vector3(0, 0.6, 0),
			"enter": func(): g.stage("salsa", P.x, 0, P.z, 0.0)},
		# B8 PUSH-IN on the guitar against the amp; she steps into frame, kneels, takes it
		{"dur": bar, "fov": 34, "dof": 1.2, "mood": "determined", "cam": [G_at + Vector3(0.95, 1.05, 1.45), G_at + Vector3(0.55, 0.9, 0.95)], "look": G_at + Vector3(0, 0.55, -0.55),
			"tick": func(dt, t, k): if k < 0.45: g.walk_stage(Vector2(P.x, P.z), Vector2(G_at.x, G_at.z + 0.2), k/0.45),
			"beats": [[bar*0.45, func(): g.stage("kneel", G_at.x, 0, G_at.z, PI)], [bar*0.75, func(): _hold(true); g.cue("gear"); g.stage("idle", G_at.x, 0, G_at.z, PI)]]},
	]
	g.play_reel(shots, func(_s): _play())

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
	if pose: pose.active = v

## a guitar like hers: red, the pickguard cream, a dark neck — slung across her: its body at her right hip, its neck up
## to her left (her model faces +Z; her left is +X)
func _axe() -> Node3D:
	var root := Node3D.new(); root.name = "axe"
	var m := func(c: Color, r := 0.3, met := 0.2) -> StandardMaterial3D:
		var s := StandardMaterial3D.new(); s.albedo_color = c; s.roughness = r; s.metallic = met; return s
	var body := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.19; cm.bottom_radius = 0.19; cm.height = 0.05; body.mesh = cm
	body.material_override = m.call(Color("#b8203a"), 0.5, 0.0); body.rotation.x = PI/2; body.scale = Vector3(1, 1, 1.3); root.add_child(body)
	var guard := MeshInstance3D.new(); var gm := CylinderMesh.new(); gm.top_radius = 0.1; gm.bottom_radius = 0.1; gm.height = 0.052; guard.mesh = gm
	guard.material_override = m.call(Color("#f5f2e8"), 0.4, 0.0); guard.rotation.x = PI/2; guard.position = Vector3(0.05, -0.04, 0.0); root.add_child(guard)
	var neck := MeshInstance3D.new(); var nb := BoxMesh.new(); nb.size = Vector3(0.05, 0.62, 0.028); neck.mesh = nb
	neck.material_override = m.call(Color("#6a4a2a"), 0.6, 0.0); neck.position = Vector3(0, 0.5, 0); root.add_child(neck)
	var head := MeshInstance3D.new(); var hb := BoxMesh.new(); hb.size = Vector3(0.08, 0.16, 0.03); head.mesh = hb
	head.material_override = m.call(Color("#111111"), 0.4); head.position = Vector3(0, 0.88, 0); root.add_child(head)
	# slung: the neck (+Y) up and to her left, the face (+Z) out from her
	var up := Vector3(0.82, 0.57, 0.0).normalized(); var fwd := Vector3(0, 0, 1); var side := up.cross(fwd).normalized()
	root.transform = Transform3D(Basis(side, up, side.cross(up)), Vector3(-0.1, 0.98, 0.2))
	return root
## where her hands go on it (world): the left on the neck, the right over the strings, strumming
func neck_at() -> Vector3: return axe.global_transform*Vector3(0, 0.55, 0.03)
func strum_at() -> Vector3: return axe.global_transform*Vector3(0.02, 0.02 - strum*0.09, 0.07)

# ------------------------------------------------------------------ C · the game, and the camera on her
func _play() -> void:
	g.mode = "guitar"; g.set_caption(""); g.dutch = 0.0
	g.stage("idle", spot.x, 0, spot.z, face_y)
	game.auto = auto
	game.start(func(r): _played(r), func(lane): strum = 1.0)
	g.lesson_card("ROBIN · HER SONG", "PLAY", "A  S  D  F  G — each note as it reaches the line.\nHit them and the guitar stays in the song.")
	g.get_tree().create_timer(3.5).timeout.connect(func(): g.lesson_card("", "", ""))
	playing = true; gt = 0.0

## the camera through the song: a new angle for each part of it (docs/INTRO_SHOT_LIST.md, C)
func tick(dt: float) -> void:
	strum = maxf(0, strum - dt*6)
	for e in eq:
		var lvl := absf(sin(game.now*PI*140.0/60.0*(1 + e[2]*0.1) + e[2]))*(1.0 if game.band.playing else 0.0)
		(e[0] as Node3D).scale = Vector3(e[1].x, e[1].y*(0.4 + lvl*1.8), e[1].z)
	if not playing: return
	gt += dt
	var now := game.now; var S: Dictionary = game.chart.sections
	var cam: Camera3D = g.cam; var P := spot
	var fwd := Vector3(sin(face_y), 0, cos(face_y)); var left := Vector3(cos(face_y), 0, -sin(face_y))
	var pos := Vector3.ZERO; var look := P + Vector3(0, 1.15, 0); var fov := 46.0
	var beatk := absf(sin(now*PI*140.0/60.0))
	if now < float(S.verse1):
		# HERO, low angle, crane up: from her shoes to her face
		var k := clampf(gt/1.8, 0, 1); k = k*k*(3 - 2*k)
		pos = P + fwd*1.6 - left*0.3 + Vector3(0, lerpf(0.25, 1.5, k), 0); look = P + Vector3(0, lerpf(0.4, 1.45, k), 0); fov = 40
	elif now < float(S.chorus1):
		# slow orbit, her to one side of the highway
		var an := 0.5 + sin((now - float(S.verse1))*0.12)*0.9; var r := 2.6
		pos = P + Vector3(sin(an + face_y)*r, 1.4, cos(an + face_y)*r)
	elif now < float(S.verse2):
		# low hero angle, pushing in
		var k := (now - float(S.chorus1))/(float(S.verse2) - float(S.chorus1))
		pos = P + fwd*lerpf(2.4, 1.7, k) + left*0.9 + Vector3(0, 0.45, 0); look = P + Vector3(0, 1.35, 0); fov = 44
	elif now < float(S.chorus2):
		# over her left shoulder, down the neck
		var k := (now - float(S.verse2))/(float(S.chorus2) - float(S.verse2))
		pos = P - fwd*1.0 + left*0.75 + Vector3(0, 1.9, 0); look = (neck_at() if axe else P) + fwd*0.7 - Vector3(0, 0.2, 0); fov = lerpf(52, 44, k)
	elif now < float(S.solo):
		# wide from the bed, drifting
		var k := (now - float(S.chorus2))/(float(S.solo) - float(S.chorus2))
		var bed: Dictionary = g.room.room.bed
		pos = Vector3(bed.x + 0.9 + k*0.5, 1.75, bed.z - 0.6); fov = 40
	elif now < float(S.outro):
		# the solo: close on her hands and the guitar, a fast orbit
		var an := (now - float(S.solo))*0.45 - 0.6
		pos = P + Vector3(sin(an + face_y)*1.1, 1.2, cos(an + face_y)*1.1); look = (strum_at() if axe else P + Vector3(0, 1, 0)); fov = 38
	else:
		# the end: up and out to the whole room
		var k := clampf((now - float(S.outro))/6.0, 0, 1)
		var a: Dictionary = g.room.apt
		pos = (P + fwd*2.2 + Vector3(0, 1.3, 0)).lerp(Vector3(a.x2 - 0.6, 2.8, a.z2 - 0.8), k); fov = lerpf(44, 56, k)
	# her a little to one side of the highway: the look shifted the other way along the lens
	var side := (look - pos).cross(Vector3.UP).normalized()
	look += side*0.45
	cam.global_position = pos + Vector3(0, beatk*0.015, 0)
	if (look - pos).length() > 0.05: cam.look_at(look)
	cam.fov = fov

func key(ev: InputEventKey) -> bool:
	if not playing: return false
	if game.key(ev): return true
	if ev.pressed and (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER) and not game.results:
		var r := game.result(); game.stop(); _played(r); return true
	return true

func _played(r: Dictionary) -> void:
	if not playing: return
	playing = false; game.stop()
	g.mode = ""; _hold(false)
	g.note("★".repeat(r.stars) + "  %d / %d" % [r.hits, r.total])
	calls()

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
		if not active or intro == null or intro.axe == null: return
		var s := get_skeleton(); var inv := s.global_transform.affine_inverse()
		var mb: Basis = intro.g.model.global_basis
		_arm(s, "Left", inv*intro.neck_at(), inv.basis*(mb*Vector3(0.6, -1.0, -0.4)))
		_arm(s, "Right", inv*intro.strum_at(), inv.basis*(mb*Vector3(-0.7, -1.0, -0.2)))
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
