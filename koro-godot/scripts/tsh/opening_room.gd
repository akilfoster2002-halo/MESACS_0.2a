## SEQUENCE 2: ROBIN'S WORLD (docs/script/the_other_robin_cold_open_1.1.md, shots 12–21). First, before a note: her
## room, quiet (bedroom.gd) — the fairy lights under the ivy, the wall of posters and polaroids, the candle and the tulips
## on the nightstand, her school ID, her homework on the bed, and her cat asleep on the throw. Then her song: the
## string; the run and the leap onto the bed; the room in four inserts; air-drumming with screwdrivers; the guitar —
## then the game (intro.gd + guitar.gd, shot 17). After it: back on the bed laughing, the silence, Canon, the closed
## door, the second call, the rings, the lamp.
class_name OpeningRoom
extends Node

var g; var intro
var made: Array = []
var lights: Array = []
var sticks: Array = []                 # the screwdrivers, in her hands
var chip: MeshInstance3D               # the component that jumps off the bench
var string_m: MeshInstance3D           # the string that opens the song
var phone_bed: Node3D                  # her phone, on the bedspread
var box: Node3D; var lid: Node3D; var rings: Array = []

func _init(game, i) -> void: g = game; intro = i

func _keep(n: Node) -> Node: made.append(n); return n
func _mat(c: Color, emit := 0.0, rough := 0.5, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.roughness = rough; m.metallic = metal
	if emit > 0: m.emission_enabled = true; m.emission = c; m.emission_energy_multiplier = emit
	return m
func _box(size: Vector3, at: Vector3, m: Material, parent: Node = null) -> MeshInstance3D:
	var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = size; b.mesh = bm; b.material_override = m; b.position = at
	if parent: parent.add_child(b)
	else: g.add_child(b); _keep(b)
	return b
func _light(c: Color, at: Vector3, e: float, r: float) -> OmniLight3D:
	var l := OmniLight3D.new(); l.light_color = c; l.light_energy = e; l.omni_range = r; l.position = at; g.add_child(l); _keep(l); lights.append(l); return l
func _bone(side: String) -> Vector3:
	var sk: Skeleton3D = g._find(g.model, func(x): return x is Skeleton3D)
	var i := sk.find_bone("mixamorig" + side)
	return sk.global_transform*sk.get_bone_global_pose(i).origin if i >= 0 else g.robin.position + Vector3(0, 1, 0)

# ------------------------------------------------------------------ the set
func _build() -> void:
	var R: Dictionary = g.room.room
	# her lights: the warm lamp, a monitor's blue on the bench, a red LED strip behind the desk
	_light(Color(0.35, 0.55, 1.0), g._v(R.bench.at) + Vector3(0.4, 0.5, 0.3), 1.6, 3.5)
	_light(Color(1.0, 0.12, 0.2), g._v(R.packing.at) + Vector3(-0.4, 0.4, -0.3), 1.4, 3.0)
	# the string on the guitar's body, close
	string_m = _box(Vector3(0.0035, 0.42, 0.0035), Vector3(301.86, 0.5, -3.2), _mat(Color(0.95, 0.92, 0.85), 0.6, 0.2, 0.8))
	string_m.rotation = Vector3(0, 0.3, 0.32)
	# two screwdrivers, a component on the bench
	for side in ["LeftHand", "RightHand"]:
		var ba := BoneAttachment3D.new(); ba.bone_name = "mixamorig" + side
		(g._find(g.model, func(x): return x is Skeleton3D) as Skeleton3D).add_child(ba); _keep(ba)
		var k := 1.0/0.011212
		var sd := Node3D.new(); sd.scale = Vector3.ONE*k; ba.add_child(sd); sd.position = Vector3(0, 9.0, 0)
		_box(Vector3(0.025, 0.1, 0.025), Vector3(0, 0, 0), _mat(Color("#e8384a"), 0.0, 0.4), sd)
		_box(Vector3(0.008, 0.12, 0.008), Vector3(0, 0.11, 0), _mat(Color(0.8, 0.8, 0.82), 0.0, 0.2, 0.9), sd)
		sd.rotation.x = -PI/2; ba.visible = false; sticks.append(ba)
	chip = _box(Vector3(0.03, 0.008, 0.02), g._v(R.bench.at) + Vector3(0.25, 0.01, 0.25), _mat(Color(0.1, 0.4, 0.2), 0.3, 0.4, 0.3))
	# her phone, on the bedspread
	var bed: Dictionary = R.bed
	phone_bed = (load("res://assets/tsh/props/iphone.glb") as PackedScene).instantiate(); g.add_child(phone_bed); _keep(phone_bed)
	phone_bed.scale = Vector3.ONE*0.88; phone_bed.position = Vector3(bed.x + 0.15, bed.top + 0.01, bed.z - 0.45); phone_bed.rotation = Vector3(-PI/2, 0.4, 0)
	phone_bed.visible = false
	# the ring box, on the packing table
	var P = g._v(R.packing.at)
	box = Node3D.new(); box.position = P + Vector3(-0.15, 0.0, 0.2); g.add_child(box); _keep(box)
	_box(Vector3(0.07, 0.035, 0.07), Vector3(0, 0.0175, 0), _mat(Color(0.03, 0.03, 0.035), 0.0, 0.6), box)
	_box(Vector3(0.062, 0.005, 0.062), Vector3(0, 0.036, 0), _mat(Color(0.15, 0.02, 0.05), 0.0, 0.9), box)          # the velvet
	lid = Node3D.new(); lid.position = Vector3(0, 0.035, -0.035); box.add_child(lid)
	_box(Vector3(0.07, 0.02, 0.07), Vector3(0, 0.01, 0.035), _mat(Color(0.03, 0.03, 0.035), 0.0, 0.6), lid)
	for i in 2:
		var r := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.0085; tm.outer_radius = 0.011; r.mesh = tm
		r.material_override = _mat(Color(0.85, 0.87, 0.9), 0.0, 0.15, 1.0); r.position = Vector3(-0.015 + i*0.03, 0.042, 0); r.rotation.x = PI/2.6
		box.add_child(r)
		var gl := MeshInstance3D.new(); var t2 := TorusMesh.new(); t2.inner_radius = 0.0078; t2.outer_radius = 0.0083; gl.mesh = t2
		var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_color = Color(0.4, 1.6, 2.0); gl.material_override = gm; r.add_child(gl)
		rings.append([r, gl])

func clear() -> void:
	for n in made:
		if is_instance_valid(n): n.queue_free()
	made = []; lights = []; sticks = []

# ------------------------------------------------------------------ SHOTS 12–16, cut to the song's eight bars of intro
func film(done: Callable) -> void:
	_build()
	var R: Dictionary = g.room.room; var bed: Dictionary = R.bed; var top: float = bed.get("top", 0.72)
	var bar := 60.0/140.0*4.0; var beat := bar/4
	var GB := Vector3(301.86, 0.5, -3.2)                         # the guitar's body
	var run0 := Vector2(304.4, -0.6); var run1 := Vector2(300.3, 2.6)
	var rd := (run1 - run0).normalized(); var ry := atan2(rd.x, rd.y)
	var B = g._v(R.bench.at); var S = g._v(R.sewing.at); var F = g._v(R.form.at); var P = g._v(R.packing.at); var SH = g._v(R.boots.at)
	var drum := Vector3(B.x, 0, B.z + 0.75)
	var her := func(y := 1.1) -> Vector3: return g.robin.position + Vector3(0, y, 0)
	var bounce := func(t: float): g.stage("jump", bed.x + 0.3, top + absf(sin(t*PI*140.0/60.0))*0.55, bed.z, PI/2)
	var bd: Bedroom = g.bedroom; var cat: BedroomCat = bd.cat; var sp: Dictionary = bd.spots
	bd.lights(true); cat.place("bed"); cat.shine = 0.0; g.lamp.light_energy = 1.0         # her own lamps do the rest
	var C := cat.global_position; var Hd := cat.head.global_position
	var out := Vector3(Hd.x - C.x, 0, Hd.z - C.z).normalized()
	var cat_cam := Hd + out*0.5 + out.cross(Vector3.UP)*0.18 + Vector3(0, 0.1, 0)
	var N: Vector3 = sp.nightstand; var ID: Vector3 = sp.id; var HW: Vector3 = sp.homework
	var prelude := [
		# ROOM · 21:58 — the fairy lights, close and soft, along the top of the wall under the ivy; the focus drifts down it
		{"dur": 2.6, "fov": 34, "dof": 0.5, "inside": true, "cam": [Vector3(295.2, 2.5, 3.35), Vector3(295.5, 2.45, 3.3)], "look": [Vector3(296.6, 2.72, 3.95), Vector3(299.0, 2.72, 3.95)],
			"enter": func(): g.black(false); g.set_caption("INT. ROBIN'S ROOM — 21:58"); g.stage("idle", run0.x, 0, run0.y, ry)},
		# · her wall, a slow track along it: the band posters, the moon, vinyl, good things take time, the polaroids
		{"dur": 3.2, "fov": 42, "ease": false, "cam": [Vector3(301.7, 1.85, 2.55), Vector3(299.4, 1.85, 2.55)], "look": [Vector3(301.9, 1.95, 4.0), Vector3(299.6, 1.95, 4.0)]},
		# · the nightstand: the candle flickering, the tulips, her instant camera; a slow push
		{"dur": 2.4, "fov": 34, "dof": 0.6, "cam": [N + Vector3(-0.5, 0.34, -0.72), N + Vector3(-0.42, 0.3, -0.62)], "look": N + Vector3(-0.04, 0.1, 0.0)},
		# · her school ID, hung off the lamp: HARBOR HIGH · ROBIN RYU · GRADE 11
		{"dur": 1.9, "fov": 22, "dof": 0.25, "cam": [ID + Vector3(-0.12, 0.06, -0.34), ID + Vector3(-0.09, 0.04, -0.26)], "look": ID},
		# · the homework on the bed from above: problem set 6, due Friday, a doodle in the margin, the pencil down
		{"dur": 2.0, "fov": 30, "cam": [HW + Vector3(0.02, 0.5, 0.14), HW + Vector3(0.0, 0.42, 0.12)], "look": HW},
		# · and the cat: black, asleep on the throw at the foot of the bed, breathing; the lights soft behind it.
		# An ear flicks — as if it heard what is coming
		{"dur": 3.0, "fov": 28, "dof": 0.55, "cam": [cat_cam + Vector3(0, 0.04, 0), cat_cam], "look": Hd + Vector3(0, -0.02, 0),
			"beats": [[2.3, func(): cat.flick()]]},
	]
	var shots := prelude + [
		# SHOT 12 · the string, vibrating; the pick across it; the riff
		{"dur": beat*2, "fov": 22, "dof": 0.3, "mood": "grin", "inside": true, "cam": GB + Vector3(0.1, 0.06, 0.24), "look": GB + Vector3(0, 0.02, 0),
			"enter": func(): intro.game.song(); g.stage("sprint", run0.x, 0, run0.y, ry),
			"tick": func(dt, t, k): string_m.position.x = GB.x + sin(t*90.0)*0.004*(1.0 - k*0.4)},
		# · the whip pan: past the amp, the cables, a sock off the desk — onto her, sprinting in
		{"dur": beat*2, "fov": 46, "ease": false, "cam": Vector3(301.6, 1.05, -1.2),
			"look": func(k, t): var e = k*k*(3 - 2*k); return (GB + Vector3(0, 0.3, 0)).lerp(her.call(1.1), e),
			"tick": func(dt, t, k): g.stage("sprint", lerpf(run0.x, 302.6, k), 0, lerpf(run0.y, 0.6, k), ry)},
		# SHOT 13 · the wide master from the foot of the bed, low and handheld; she lands, bounces, arms up; sings
		{"dur": bar*2, "fov": 62, "hand": 0.55, "mood": "grin", "cam": Vector3(300.9, 0.55, 3.35), "look": func(k, t): return her.call(0.9).lerp(Vector3(bed.x, 1.0, bed.z), 0.3),
			"enter": func(): g.face.flap = bar*2.2,
			"tick": func(dt, t, k):
				if t < 0.45: g.stage("sprint", lerpf(302.6, run1.x, t/0.45), 0, lerpf(0.6, run1.y, t/0.45), ry)
				else: bounce.call(t)},
		# · the cat, bounced: the bed going up and down under it; one eye opens, flat, at her. It has seen this before
		{"dur": beat*3, "fov": 24, "dof": 0.5, "cam": cat_cam + Vector3(0, -0.02, 0), "look": Hd,
			"enter": func(): cat.wake(0.55, g.robin.position + Vector3(0, 1.4, 0), true),
			"tick": func(dt, t, k): bounce.call(t); cat.position.y = C.y + absf(sin(t*PI*140.0/60.0))*0.03},
		# SHOT 14A · the sewing machine: low, from the side; a spark from the soldering iron
		{"dur": beat*2, "fov": 34, "dof": 0.5, "cam": S + Vector3(0.42, -0.04, 0.42), "look": S + Vector3(0, -0.02, 0),
			"enter": func(): cat.position.y = C.y; cat.wake(0.0),
			"tick": func(dt, t, k): bounce.call(t), "beats": [[beat*0.9, func(): _spark(B + Vector3(0.3, 0.02, 0.1))]]},
		# 14B · the jacket on the form, low; her bouncing on the bed far behind; a blue pulse
		{"dur": beat*2, "fov": 38, "dof": 1.0, "cam": F + Vector3(0.55, 0.75, 0.75), "look": F + Vector3(0, 1.25, 0),
			"tick": func(dt, t, k): bounce.call(t); g._form_jacket(true)},
		# 14C · the business, from above: the boxes, the burner phone, the cash under the mug
		{"dur": beat*2, "fov": 40, "cam": P + Vector3(0.02, 0.85, 0.06), "look": P + Vector3(0, 0, 0)},
		# 14D · the sneakers, at the floor; a car's light across the coils; her socks slide into the foreground
		{"dur": beat*2, "fov": 36, "dof": 0.6, "cam": SH + Vector3(0.75, 0.09, -0.35), "look": SH + Vector3(0, 0.08, 0),
			"tick": func(dt, t, k): _carlight(SH, k); g.stage("walk", lerpf(SH.x + 1.2, SH.x + 0.45, k), 0, SH.z - 0.2, -PI/2)},
		# SHOT 15 · air-drumming: a lateral profile, a screwdriver past the lens
		{"dur": bar, "fov": 40, "hand": 0.45, "mood": "grin", "cam": [drum + Vector3(1.6, 1.2, 0.2), drum + Vector3(0.9, 1.25, 0.25)], "look": func(k, t): return her.call(1.15),
			"enter": func(): _sticks(true); g.face.flap = bar*1.6,
			"tick": func(dt, t, k): g.stage("jab" if int(t/beat) % 2 == 0 else "cross", drum.x, 0, drum.z, PI)},
		# · the reverse: drumming toward the lens; she hits the bench too hard; a part jumps; she catches it
		{"dur": beat*2, "fov": 36, "cam": Vector3(B.x + 0.15, 1.25, B.z + 0.05), "look": func(k, t): return her.call(1.3),
			"tick": func(dt, t, k): g.stage("cross" if int(t/beat) % 2 == 0 else "jab", drum.x, 0, drum.z, PI); _chip_jump(t, beat, drum)},
		# SHOT 16 · she stops; the guitar against the amp, behind a hanging jacket; a slow push; she walks to it, seriously
		{"dur": bar*1.5, "fov": 40, "dof": 1.6, "mood": "determined", "cam": [Vector3(300.2, 1.15, -1.5), Vector3(300.7, 1.1, -2.0)], "look": GB + Vector3(-0.2, 0.25, 0),
			"enter": func(): _sticks(false); g.stage("idle", drum.x, 0, drum.z, PI/2),
			"tick": func(dt, t, k):
				if k > 0.25 and k < 0.75: g.walk_stage(Vector2(drum.x, drum.z), Vector2(301.85, -2.55), (k - 0.25)/0.5),
			"beats": [[bar*1.5*0.78, func(): intro._hold(true); g.cue("gear"); g.stage("idle", 301.85, 0, -2.55, PI)]]},
		# · LOW ANGLE as she kicks the amp on: feedback
		{"dur": beat*2, "fov": 52, "mood": "grin", "cam": Vector3(302.4, 0.25, -2.0), "look": Vector3(301.85, 1.3, -2.55),
			"enter": func(): g.cue("jam"); g.cam_kick = 0.8},
	]
	g.play_reel(shots, func(_s): done.call())

func _spark(at: Vector3) -> void:
	var s := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.008; sm.height = 0.016; s.mesh = sm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(4, 3, 1.5); s.material_override = m
	s.position = at; g.add_child(s); _keep(s)
	var l := OmniLight3D.new(); l.light_color = Color(1, 0.8, 0.5); l.light_energy = 3; l.omni_range = 1.2; s.add_child(l)
	var tw: Tween = g.create_tween(); tw.tween_property(l, "light_energy", 0.0, 0.25); tw.parallel().tween_property(s, "scale", Vector3.ZERO, 0.25)
var _cl: OmniLight3D
func _carlight(at: Vector3, k: float) -> void:
	if _cl == null: _cl = _light(Color(0.6, 0.85, 1.0), at, 0.0, 2.0)
	_cl.position = at + Vector3(-0.4, 0.4, lerpf(-1.5, 1.5, k)); _cl.light_energy = sin(k*PI)*4.0
func _sticks(v: bool) -> void:
	for s in sticks: (s as Node3D).visible = v
func _chip_jump(t: float, beat: float, drum: Vector3) -> void:
	var t0 := beat*0.9
	if t < t0: return
	var k := minf(1.0, (t - t0)/0.45)
	var from: Vector3 = g._v(g.room.room.bench.at) + Vector3(0.25, 0.01, 0.25); var to := _bone("LeftHand")
	chip.position = from.lerp(to, k) + Vector3(0, sin(k*PI)*0.25, 0); chip.rotation += Vector3(0.3, 0.5, 0.1)

# ------------------------------------------------------------------ after the song: SHOTS 17 (end) – 21
func after(done: Callable) -> void:
	var R: Dictionary = g.room.room; var bed: Dictionary = R.bed; var top: float = bed.get("top", 0.72)
	var lie := Vector3(bed.x + 0.25, top + 0.05, bed.z)
	var seat := Vector3(bed.x + 0.6, bed.get("seat", 0.55), bed.z - 0.35)
	var D: Vector3 = g._v(R.momDoor.at); var P = g._v(R.packing.at)
	var path := [Vector2(seat.x + 0.4, seat.z - 0.6), Vector2(299.6, -0.6), Vector2(D.x + 0.3, D.z + 1.1)]
	var phone_hand := func() -> Vector3: return _bone("RightHand")
	var pace := func(k: float):                                   # pacing as she talks, waist up: along her path
		var i := clampi(int(k*(path.size() - 1)), 0, path.size() - 2); var f := k*(path.size() - 1) - i
		var a: Vector2 = path[i]; var b: Vector2 = path[i + 1]; var p := a.lerp(b, f)
		g.stage("phone_pace", p.x, 0, p.y, atan2(b.x - a.x, b.y - a.y))
	var c1: float = g.lines_len("canonA"); var c2: float = g.lines_len("canonB"); var c3: float = g.lines_len("canonC")
	var cat: BedroomCat = g.bedroom.cat
	cat.place("shelf")                                            # it has moved, out of her way, while she played
	var Hc := cat.head.global_position
	var c4: float = g.lines_len("canonD"); var c5: float = g.lines_len("canonE"); var c6: float = g.lines_len("canonHold"); var c7: float = g.lines_len("call")
	var shots := [
		# · back onto the bed, the guitar on her chest, laughing at nobody; the song ends; silence; let her breathe
		{"dur": 3.4, "fov": 40, "mood": "happy", "inside": true, "cam": [lie + Vector3(0.9, 1.4, -1.2), lie + Vector3(0.75, 1.25, -1.0)], "look": lie + Vector3(0, 0.2, 0),
			"enter": func(): g.stage("sleep", lie.x, lie.y, lie.z, PI/2); g.model.rotation.x = 0.0; g.face.flap = 1.4; g.face.feel("happy", 3.0); phone_bed.visible = true; g.phone_prop.hold("")},
		# · the cat, moved to the shelf behind the bed: one eye on her, unimpressed; the phone buzzes and its head comes up
		{"dur": 1.9, "fov": 26, "dof": 0.6, "cam": Hc + Vector3(0.28, 0.1, -0.55), "look": Hc + Vector3(0, -0.02, 0),
			"enter": func(): cat.wake(0.5, lie + Vector3(0, 0.3, 0), true),
			"beats": [[1.0, func(): g.cue("phone"); cat.wake(1.0, phone_bed.position)]]},
		# SHOT 18 · the phone on the bedspread, from above; her hand comes in; she answers without looking
		{"dur": c1 + 0.8, "fov": 30, "cam": phone_bed.position + Vector3(0.02, 0.55, 0.03), "look": phone_bed.position,
			"enter": func(): g.ringing(true); g.phone_show("call", "CANON"); cat.wake(0.0),
			"beats": [[0.7, func(): g.ringing(false); g.cue("ui"); phone_bed.visible = false; g.phone_show("oncall", "CANON"); g.talk("canonA")]]},
		# · loose medium close, sitting on the bed, the guitar across her lap
		{"dur": c2 + 0.7, "fov": 36, "mood": "smug", "cam": g.rel(seat.x, seat.z, PI, 1.25, 0.35, 1.1), "look": seat + Vector3(0, 0.75, 0),
			"enter": func(): g.stage("wake", seat.x - 0.75, seat.y, seat.z + 0.3, PI/2); g.phone_prop.hold("ear"); g.talk("canonB")},
		# · up, and pacing: a loose handheld track, waist up, past the bench, the boxes, the form
		{"dur": c3 + 0.6, "fov": 40, "hand": 0.35, "ease": false,
			"cam": func(k, t): var p: Vector3 = g.robin.position; return p + Vector3(1.1, 1.3, 1.0), "look": func(k, t): return g.robin.position + Vector3(0, 1.15, 0),
			"enter": func(): intro._hold(false); g.talk("canonC"), "tick": func(dt, t, k): pace.call(k*0.5)},
		# SHOT 19 · the closed door: the camera stays in the bedroom, watching her go; no light under it
		{"dur": c4 + 1.6, "fov": 36, "dof": 6.0, "ease": false, "cam": [Vector3(298.6, 1.45, 1.4), Vector3(299.0, 1.45, 1.2)], "look": [Vector3(D.x, 1.2, D.z + 0.5), Vector3(D.x, 1.25, D.z + 0.4)],
			"tick": func(dt, t, k): pace.call(0.5 + k*0.5),
			"beats": [[0.3, func(): g.talk("canonD")], [c4 + 0.4, func(): g.cue("fridge")]]},
		# · profile at the far end; a strip of warm light; "Don't push it." — and the phone buzzes; the smile goes
		{"dur": c5 + 1.0, "fov": 34, "mood": "soft", "cam": Vector3(D.x + 1.5, 1.5, D.z + 1.3), "look": Vector3(D.x + 0.3, 1.5, D.z + 1.1),
			"enter": func(): g.stage("phone_talk", D.x + 0.3, 0, D.z + 1.1, PI*0.75); g.talk("canonE"); _warm(D),
			"beats": [[c5 + 0.4, func(): g.cue("phone"); g.face.feel("skeptical", 1.4)]]},
		# SHOT 20 · the phone, close: UNKNOWN NUMBER over Canon's name; its cold light on her thumb
		{"dur": 1.6, "fov": 24, "dof": 0.5, "cam": func(k, t): return phone_hand.call() + Vector3(0.18, 0.22, 0.12), "look": func(k, t): return phone_hand.call(),
			"enter": func(): g.stage("phone_read", D.x + 0.3, 0, D.z + 1.1, PI*0.75); g.phone_show("call", "UNKNOWN")},
		# · her eyes flick to the boxes; "Hold on. Let me call you back."
		{"dur": c6 + 0.4, "fov": 26, "mood": "focused", "cam": g.rel(D.x + 0.3, D.z + 1.1, PI*0.75, 0.85, 0.12, 1.55), "look": Vector3(D.x + 0.3, 1.52, D.z + 1.1),
			"enter": func(): g.stage("phone_talk", D.x + 0.3, 0, D.z + 1.1, PI*0.75); g.face.target = P + Vector3(0, 0.9, 0); g.phone_show("oncall", "CANON"); g.talk("canonHold")},
		# · from behind her shoulder; she switches calls; the buyer; she turns toward the boxes
		{"dur": c7 + 1.0, "fov": 34, "mood": "focused", "cam": Vector3(D.x - 0.1, 1.65, D.z + 0.55), "look": P + Vector3(0, 0.8, 0),
			"enter": func(): g.cue("hangup"); g.get_tree().create_timer(0.25).timeout.connect(func(): g.cue("ui"); g.phone_show("oncall", "UNKNOWN"); g.talk("call")),
			"tick": func(dt, t, k): var a := atan2(P.x - (D.x + 0.3), P.z - (D.z + 1.1)); g.stage("phone_talk", D.x + 0.3, 0, D.z + 1.1, lerp_angle(PI*0.75, a, minf(1, k*1.5)))},
		# SHOT 21 · the rings, from above: the box opens under her thumb; the light travelling round each ring; a push
		{"dur": 3.2, "fov": 28, "dof": 0.35, "cam": [box.position + Vector3(0.01, 0.42, 0.06), box.position + Vector3(0.0, 0.18, 0.03)], "look": box.position + Vector3(0, 0.03, 0),
			"enter": func(): g.cue("hangup"); g.phone_show(""); g.phone_prop.hold("") ,
			"tick": func(dt, t, k): lid.rotation.x = -minf(1, t/0.5)*1.9; _rings_pulse(t),
			"beats": [[1.2, func(): g.cue("pick")]]},
		# · medium: she closes it; alone in her room; the amp humming; 22:15; "Okay."; the lamp off
		{"dur": g.lines_len("okay") + 2.0, "fov": 40, "mood": "determined", "cam": Vector3(P.x - 2.2, 1.45, P.z + 1.6), "look": Vector3(P.x - 0.4, 1.0, P.z + 0.1),
			"enter": func(): lid.rotation.x = 0; g.stage("phone_read", P.x - 0.55, 0, P.z + 0.25, PI/2); g.phone_show("time", "22:15"),
			"beats": [[0.8, func(): g.phone_show(""); g.phone_prop.hold(""); g.talk("okay")], [g.lines_len("okay") + 1.2, func(): _lights_out()]]},
		# · the room dark; on the shelf, two gold eyes open, and watch her go
		{"dur": 2.2, "fov": 30, "cam": [Hc + Vector3(0.3, 0.12, -0.75), Hc + Vector3(0.24, 0.1, -0.6)], "look": Hc,
			"enter": func(): cat.wake(1.0, g.robin.position + Vector3(0, 1.4, 0)); cat.shine = 1.0},
	]
	g.play_reel(shots, func(_s): g.face.target = null; g.black(true); cat.shine = 0.0; cat.wake(0.0); g.get_tree().create_timer(0.15).timeout.connect(done))

func _lights_out() -> void:
	g.lamp.light_energy = 0.0; g.cue("ui"); g.bedroom.lights(false)
	for l in lights: l.light_energy = 0.0
func _warm(D: Vector3) -> void:
	var l := _light(Color(1.0, 0.75, 0.45), Vector3(D.x + 0.9, 1.6, D.z + 1.5), 1.8, 2.2)
func _rings_pulse(t: float) -> void:
	for i in rings.size():
		var gl: MeshInstance3D = rings[i][1]
		var a := fmod(t*0.8 + i*0.4, 1.0)
		(gl.material_override as StandardMaterial3D).albedo_color = Color(0.4, 1.6, 2.0)*(0.2 + 1.6*maxf(0, sin(a*PI)))
		gl.rotation.y = t*3.0
