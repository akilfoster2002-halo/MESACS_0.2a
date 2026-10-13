## SEQUENCE 1: THE CITY BELONGS TO SOMEONE ELSE (docs/script/the_other_robin_cold_open_1.1.md, shots 01–11).
## Built on Neon Avenue under the WFC billboard (x −66): black and a click; falling through cloud over the district,
## with three glimpses of the wearables (a ring, a bracelet, a pair of shoes); an elevated train with WFC in every
## window and a pillar that wipes to the street; Juno and his bracelet; the window exploding in slow motion; a girl
## and her mother behind a bus shelter; the vans from both ends; the drone; the arrest at boot height; and the
## crane up to the Director on the billboard. Everything built here is taken away at the end.
class_name OpeningCity
extends Node

const AVE := -66.0                     # the billboard's x: the stretch of Neon Avenue this happens on
var g
var made: Array = []                   # everything built for the sequence (freed at the end)
var juno: Dictionary; var friends: Array = []; var cops: Array = []
var drone: Dictionary; var drones: Array = []
var shards: MultiMeshInstance3D; var shard_v: Array = []; var shard_t := -1.0
var pane: MeshInstance3D
var bracelet: MeshInstance3D; var brace_light: OmniLight3D
var train: Node3D; var rain: GPUParticles3D
var portrait_vp: SubViewport
var red_dot: ColorRect
var fog_was := 0.0; var fogc_was := Color.BLACK

func _init(game) -> void: g = game

# ------------------------------------------------------------------ building blocks
func _keep(n: Node) -> Node: made.append(n); return n
func _mat(c: Color, emit := 0.0, rough := 0.6, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.roughness = rough; m.metallic = metal
	if emit > 0: m.emission_enabled = true; m.emission = c; m.emission_energy_multiplier = emit
	return m
func _box(size: Vector3, at: Vector3, m: Material, parent: Node = null) -> MeshInstance3D:
	var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = size; b.mesh = bm; b.material_override = m; b.position = at
	if parent: parent.add_child(b)
	else: g.add_child(b); _keep(b)
	return b
func _person(file: String, at: Vector3, yaw: float, clip: String, k := 1.0) -> Dictionary:
	var n: Node3D = (load("res://assets/tsh/people/%s.glb" % file) as PackedScene).instantiate(); g.add_child(n); _keep(n)
	n.position = at; n.rotation.y = yaw
	var hgt := 0.0
	for mi in n.find_children("*", "MeshInstance3D", true, false): hgt = maxf(hgt, ((mi as MeshInstance3D).get_aabb().size.y)*(mi as Node3D).global_transform.basis.get_scale().y)
	var fix := 1.75/hgt if hgt > 0.3 and (hgt < 1.2 or hgt > 2.4) else 1.0
	n.scale = Vector3.ONE*k*fix
	var ap: AnimationPlayer = n.find_children("*", "AnimationPlayer", true, false)[0]
	for a in ap.get_animation_list(): ap.get_animation(a).loop_mode = Animation.LOOP_LINEAR if a in ["idle", "walk", "sprint", "ride", "talk", "talk2", "kneel"] else Animation.LOOP_NONE
	var p := {"n": n, "ap": ap}; _clip(p, clip); return p
func _clip(p: Dictionary, nm: String) -> void:
	var ap: AnimationPlayer = p.ap
	if ap.has_animation(nm) and ap.current_animation != nm: ap.play(nm, 0.2)
func _glow(c: Color, r: float, energy := 2.5, rng := 3.0) -> MeshInstance3D:
	var s := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = r; sm.height = r*2; s.mesh = sm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c*3.0; s.material_override = m
	var l := OmniLight3D.new(); l.light_color = c; l.light_energy = energy; l.omni_range = rng; s.add_child(l)
	g.add_child(s); _keep(s); return s
func _hand(p: Dictionary, side := "RightHand"):
	var found := (p.n as Node).find_children("*", "Skeleton3D", true, false)
	if found.is_empty(): return (p.n as Node3D).global_position + Vector3(0.3, 1.0, 0)
	var sk: Skeleton3D = found[0]
	for i in sk.get_bone_count():
		if sk.get_bone_name(i).ends_with(side): return sk.global_transform*sk.get_bone_global_pose(i).origin
	return (p.n as Node3D).global_position + Vector3(0, 1, 0)

# ------------------------------------------------------------------ the set
var truck: Node3D
func _build() -> void:
	var c: Chase = g.chase
	# the city's parked truck stands where this happens: away for the sequence
	truck = g.city.find_child("Node16", true, false) as Node3D
	if truck: truck.visible = false
	c.stop(); c.build()
	# Juno and his two friends, under a broken storefront sign on the north side
	juno = _person("thug-a", Vector3(AVE + 4.0, 0, -8.7), 0.0, "idle")
	friends = [_person("thug-b", Vector3(AVE + 2.4, 0, -8.4), 0.4, "talk"), _person("u", Vector3(AVE + 5.7, 0, -8.2), -0.5, "idle")]
	# the shop window he blows out: a pane in the wall, and the shards it becomes
	pane = _box(Vector3(3.2, 2.2, 0.04), Vector3(AVE + 7.6, 1.5, -9.92), _mat(Color(0.55, 0.75, 0.8, 1), 0.0, 0.05, 0.6))
	_box(Vector3(3.6, 0.5, 0.25), Vector3(AVE + 7.6, 3.0, -9.85), _mat(Color("#ff2a6a"), 2.2))            # the broken sign over it
	var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.instance_count = 420
	var qm := QuadMesh.new(); qm.size = Vector2(0.2, 0.14); mm.mesh = qm
	shards = MultiMeshInstance3D.new(); shards.multimesh = mm; shards.visible = false
	var sm := StandardMaterial3D.new(); sm.albedo_color = Color(0.8, 0.95, 1.0, 0.75); sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; sm.metallic = 0.8; sm.roughness = 0.05
	sm.cull_mode = BaseMaterial3D.CULL_DISABLED; sm.render_priority = 101; sm.emission_enabled = true; sm.emission = Color(1, 0.4, 0.6); sm.emission_energy_multiplier = 0.6
	shards.material_override = sm; g.add_child(shards); _keep(shards)
	# his bracelet, and its light
	bracelet = _glow(Color(1, 1, 1), 0.045, 0.0, 3.5); brace_light = bracelet.get_child(0)
	# the bus shelter across the street, and the girl and her mother behind it
	var sh := Node3D.new(); sh.position = Vector3(AVE + 5.0, 0, 8.6); g.add_child(sh); _keep(sh)
	var glass := _mat(Color(0.7, 0.85, 0.9, 0.22), 0.0, 0.03, 0.5); glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; glass.render_priority = 101
	_box(Vector3(3.4, 2.2, 0.03), Vector3(0, 1.2, -0.9), glass, sh); _box(Vector3(0.03, 2.2, 1.6), Vector3(-1.7, 1.2, -0.1), glass, sh)
	_box(Vector3(3.6, 0.08, 1.8), Vector3(0, 2.35, -0.1), _mat(Color(0.15, 0.17, 0.2)), sh); _box(Vector3(2.6, 0.08, 0.4), Vector3(0, 0.48, 0.3), _mat(Color(0.2, 0.2, 0.22)), sh)
	_box(Vector3(1.0, 1.6, 0.05), Vector3(1.4, 1.3, 0.62), _mat(Color("#9fd8ff"), 1.2), sh)          # an ad panel: WFC
	_person("x", Vector3(AVE + 4.6, 0, 8.6), PI, "kneel")                                             # her mother
	_person("x", Vector3(AVE + 5.4, 0, 8.7), PI + 0.3, "kneel", 0.62)                                  # the girl
	# the elevated line along the south kerb: pillars, a deck, and (shot 03) the train on it
	for x in range(-140, 21, 22): _box(Vector3(1.2, 9.0, 1.2), Vector3(x, 4.5, 7.6), _mat(Color(0.18, 0.2, 0.22), 0.0, 0.8, 0.3))
	_box(Vector3(170, 0.6, 3.2), Vector3(-60, 9.2, 7.6), _mat(Color(0.14, 0.15, 0.17), 0.0, 0.8, 0.3))
	_box(Vector3(1.4, 9.0, 1.4), Vector3(AVE - 3.0, 4.5, 4.2), _mat(Color(0.16, 0.17, 0.19), 0.0, 0.8, 0.3))   # the pillar that wipes
	train = Node3D.new(); g.add_child(train); _keep(train)
	for i in 4:
		var car := Node3D.new(); car.position = Vector3(i*12.6, 10.9, 7.6); train.add_child(car)
		_box(Vector3(12.2, 2.8, 2.8), Vector3.ZERO, _mat(Color(0.06, 0.07, 0.08), 0.0, 0.3, 0.6), car)
		for w in 5:
			var wx := -4.8 + w*2.4
			_box(Vector3(1.8, 1.1, 0.05), Vector3(wx, 0.2, -1.42), _mat(Color(0.75, 0.82, 0.9), 0.45), car)
			var lb := Label3D.new(); lb.text = "WFC"; lb.font_size = 72; lb.pixel_size = 0.006; lb.modulate = Color(0.1, 0.15, 0.2)
			lb.position = Vector3(wx, 0.2, -1.46); lb.rotation.y = PI; lb.render_priority = 101; lb.outline_size = 0; car.add_child(lb)
	train.position.x = -200
	# on the road: a toy, a broken drone rotor, a WFC flyer against the drain
	_box(Vector3(0.18, 0.14, 0.12), Vector3(AVE - 0.5, 0.07, 1.8), _mat(Color("#e8c23a")))
	_box(Vector3(0.6, 0.02, 0.06), Vector3(AVE + 0.6, 0.02, -0.4), _mat(Color(0.2, 0.2, 0.22), 0.0, 0.4, 0.7))
	var fly := _box(Vector3(0.21, 0.005, 0.3), Vector3(AVE + 1.6, 0.01, -4.2), _mat(Color(0.92, 0.94, 0.95))); fly.rotation.y = 0.5
	# WFC: the vans waiting off either end, the officers in them, the drones
	cops = []
	for i in 6:
		var cp: Dictionary = c.spawn_cop(Vector3(AVE - 30, 0, -1.6), "cut"); cp.node.visible = false; cops.append(cp)
	drone = c.spawn_drone(Vector3(AVE + 4, 22, -6.0)); c.drones.append(drone)
	for d in [Vector3(-30, 40, -60), Vector3(-90, 28, 20), Vector3(10, 55, -30), Vector3(-60, 18, -40)]:
		var dd: Dictionary = c.spawn_drone(d); c.drones.append(dd); drones.append(dd)
	for i in c.vans.size(): c.van_place(c.vans[i], AVE - 300 - i*10, 300, 0.0)                 # the chase's vans, out of the way
	if c.vans.size() >= 2: c.van_place(c.vans[0], AVE - 60, 0.4, PI/2); c.van_place(c.vans[1], AVE + 60, 0.4, -PI/2)
	# the Director on the billboard: her face, rendered live from her model
	_billboard()
	# rain, around the lens
	_rain()
	# the red light in the black
	red_dot = ColorRect.new(); red_dot.color = Color(1, 0.1, 0.1); red_dot.size = Vector2(6, 6); red_dot.visible = false
	red_dot.set_anchors_preset(Control.PRESET_CENTER); g.hud.add_child(red_dot); _keep(red_dot)

func _billboard() -> void:
	g.raid._screen(); g.raid.screen.visible = false
	var spots = g._json("res://assets/tsh/city_spots.json"); var best: Array = spots.screens[0]
	for s in spots.screens:
		if Vector2(s[0] - AVE, s[2] - 10).length() < Vector2(best[0] - AVE, best[2] - 10).length(): best = s
	var bb := Node3D.new(); bb.position = Vector3(best[0], best[1], best[2]); bb.rotation.y = best[3]; bb.translate_object_local(Vector3(0, 0, 0.1)); g.add_child(bb); _keep(bb)
	portrait_vp = SubViewport.new(); portrait_vp.size = Vector2i(640, 400); portrait_vp.own_world_3d = true; portrait_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	g.add_child(portrait_vp); _keep(portrait_vp)
	var w := WorldEnvironment.new(); var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#0d1c2a")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#9fb8d0"); env.ambient_light_energy = 0.6; w.environment = env; portrait_vp.add_child(w)
	var k := DirectionalLight3D.new(); k.rotation = Vector3(-0.3, 0.6, 0); k.light_energy = 1.6; portrait_vp.add_child(k)
	var r := DirectionalLight3D.new(); r.rotation = Vector3(-0.2, -2.4, 0); r.light_energy = 1.2; r.light_color = Color("#8ff0ff"); portrait_vp.add_child(r)
	var her: Node3D = (load("res://assets/tsh/people/sable.glb") as PackedScene).instantiate(); portrait_vp.add_child(her)
	var ap: AnimationPlayer = her.find_children("*", "AnimationPlayer", true, false)[0]; ap.play("idle"); ap.seek(1.0, true); ap.pause()
	var cam := Camera3D.new(); cam.fov = 18; portrait_vp.add_child(cam); cam.position = Vector3(0.22, 1.58, 1.35); cam.look_at_from_position(cam.position, Vector3(0.12, 1.52, 0))
	cam.current = true
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(best[4], best[5]); q.mesh = qm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = portrait_vp.get_texture(); m.albedo_color = Color(1.3, 1.3, 1.35)
	q.material_override = m; bb.add_child(q)
	var t := Label3D.new(); t.text = "WFC. PROTECTING NEW YORK."; t.font_size = 96; t.pixel_size = 0.01; t.position = Vector3(best[4]*0.22, -best[5]*0.36, 0.03)
	t.modulate = Color(0.95, 0.98, 1.0); t.outline_size = 0; t.render_priority = 101; bb.add_child(t)
	var border := MeshInstance3D.new(); var bm := QuadMesh.new(); bm.size = Vector2(best[4] + 0.3, best[5] + 0.3); border.mesh = bm; border.position.z = -0.02
	border.material_override = _mat(Color(0.8, 0.95, 1.0), 1.4); bb.add_child(border); bb.set_meta("border", border)
	set_meta("bb", bb)

func _rain() -> void:
	rain = GPUParticles3D.new(); rain.amount = 1800; rain.lifetime = 0.9; rain.visibility_aabb = AABB(Vector3(-15, -15, -15), Vector3(30, 30, 30))
	var pm := ParticleProcessMaterial.new(); pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX; pm.emission_box_extents = Vector3(10, 0.5, 10)
	pm.direction = Vector3(0.1, -1, 0); pm.spread = 3; pm.initial_velocity_min = 18; pm.initial_velocity_max = 22; pm.gravity = Vector3.ZERO
	rain.process_material = pm
	var q := QuadMesh.new(); q.size = Vector2(0.012, 0.45)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(0.75, 0.9, 1.0, 0.28)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y; m.render_priority = 101; q.material = m
	rain.draw_pass_1 = q; rain.position = Vector3(0, 8, 0); g.cam.add_child(rain); _keep(rain)

# ------------------------------------------------------------------ the shots
func play(done: Callable) -> void:
	_build()
	var c: Chase = g.chase
	var J: Vector3 = (juno.n as Node3D).position
	var W: Vector3 = pane.position
	var vlen := func(k: String) -> float: return g.lines_len(k)
	fog_was = g.env.fog_density
	var brace := func(k: float):                                         # the bracelet waking: white to red-orange
		var h = _hand(juno); bracelet.global_position = h
		var col := Color(1, 1, 1).lerp(Color(1.0, 0.35, 0.08), clampf(k*1.4, 0, 1))
		(bracelet.material_override as StandardMaterial3D).albedo_color = col*(1.5 + k*3.0); brace_light.light_color = col; brace_light.light_energy = k*7.0
		bracelet.scale = Vector3.ONE*(0.6 + k*0.8)
	var keep_brace := func(dt, t, k): if bracelet.visible: var h = _hand(juno); bracelet.global_position = h
	var fly_drones := func(dt, t, k):
		for i in drones.size():
			var d: Dictionary = drones[i]; (d.node as Node3D).position += Vector3(sin(i*1.7)*4.0, 0, cos(i*1.3)*4.0)*dt
	var shots := [
		# SHOT 01 · black: rain, the hum, a siren that never arrives; a click; the first line; a red light on "wear"
		{"dur": 4.0, "fov": 50, "inside": false, "cam": Vector3(AVE, 60, 60), "look": Vector3(AVE, 0, 0),
			"enter": func(): g.black(true); g.cue("siren"),
			"beats": [[0.6, func(): g.cue("lock")], [1.1, func(): g.talk("vo1")],
				[1.1 + vlen.call("vo1")*0.82, func(): red_dot.visible = true; g.get_tree().create_timer(0.09).timeout.connect(func(): red_dot.visible = false)]]},
		# SHOT 02 · falling through the cloud: thick at first, thinning as the skyline appears; drones at every depth
		{"dur": 3.4, "fov": 70, "ease": false, "cam": [Vector3(AVE + 60, 330, 260), Vector3(AVE + 45, 215, 190)], "look": [Vector3(AVE - 40, 300, 60), Vector3(AVE - 30, 40, -60)],
			"enter": func(): g.black(false); fogc_was = g.env.fog_light_color; g.env.fog_light_color = Color(0.5, 0.55, 0.6); g.env.fog_density = 0.018; g.talk("vo2"),
			"tick": func(dt, t, k): g.env.fog_density = lerpf(0.018, 0.003, sqrt(k)); fly_drones.call(dt, t, k)},
		# · a ring: a commuter on a roof terrace turns their hand; red catches it
		{"dur": 0.9, "fov": 30, "dof": 0.7, "cam": func(k, t): return _ring_at() + Vector3(0.45, 0.12, -0.4), "look": func(k, t): return _ring_at(),
			"enter": func(): _glimpse_ring(Vector3(AVE + 12.0, 11.0, 17.0))},
		# · a bracelet: a courier between the traffic, a band of light under the sleeve
		{"dur": 1.0, "fov": 34, "cam": Vector3(AVE + 3, 1.1, 4.6), "look": func(k, t): return _courier_at(k) + Vector3(0, 1.0, 0),
			"enter": func(): _glimpse_courier(), "tick": func(dt, t, k): _courier_tick(k)},
		# · a pair of shoes: far off, somebody leaps between two roofs
		{"dur": 1.3, "fov": 16, "cam": Vector3(AVE - 8, 13, 4), "look": func(k, t): return (_leaper.n as Node3D).position + Vector3(0, 1, 0) if not _leaper.is_empty() else Vector3(AVE - 8, 17, -22),
			"enter": func(): _glimpse_leap(), "tick": func(dt, t, k): _leap_tick(k)},
		# · on "shoes", the camera pitches down toward the city
		{"dur": 1.6, "fov": 60, "cam": [Vector3(10, 70, 60), Vector3(0, 52, 46)], "look": [Vector3(-40, 30, 0), Vector3(AVE, 4, 2)],
			"tick": func(dt, t, k): g.env.fog_density = lerpf(0.004, fog_was, k); g.env.fog_light_color = Color(0.5, 0.55, 0.6).lerp(fogc_was, k); fly_drones.call(dt, t, k)},
		# SHOT 03 · the train: tracking alongside it, WFC in every window; a pillar wipes the frame
		{"dur": maxf(3.6, vlen.call("vo3") + 1.4), "fov": 40, "ease": false,
			"cam": func(k, t): return Vector3(AVE - 26 + k*22.0, 10.4, 1.2), "look": func(k, t): return Vector3(AVE - 26 + k*22.0 + 3.0, 10.6, 7.6),
			"enter": func(): g.env.fog_density = fog_was; g.talk("vo3"); g.cue("launch"),
			"tick": func(dt, t, k): train.position.x = AVE + 10.0 - t*16.0},
		# SHOT 04 · Neon Avenue: inches above the road, out from behind the pillar; a car through the foreground
		{"dur": 4.4, "fov": 64, "ease": false, "cam": [Vector3(AVE - 3.0, 0.14, 2.6), Vector3(AVE + 2.6, 0.22, -4.8)], "look": [Vector3(AVE + 4, 0.6, -6), Vector3(AVE + 4.2, 1.2, -8.6)],
			"enter": func(): _car_pass(), "tick": func(dt, t, k): _car_tick(t); _flicker(t)},
		# SHOT 05 · Juno and the bracelet: a slow push; the light wakes, fills, goes red; focus from his reflection to it
		{"dur": 4.2, "fov": 34, "dof": 1.1, "mood": "", "cam": [J + Vector3(0.7, 1.35, 2.3), J + Vector3(0.45, 1.4, 1.5)], "look": J + Vector3(0.3, 1.45, 0),
			"enter": func(): _clip(juno, "idle"); bracelet.visible = true; brace.call(0.0); g.cue("rise"),
			"tick": func(dt, t, k): brace.call(clampf(t/3.3, 0, 1)); _flicker(t); _juno_aim(dt, t, J, W),
			"beats": [[3.9, func(): g.cue("blast"); g.cam_kick = 1.6; g.station.flash(0.7, Color(1, 0.7, 0.5))]]},
		# SHOT 06 · the window explodes: wide from across the street, in slow motion; the impact, then the glass
		{"dur": 4.0, "fov": 40, "ease": false, "cam": [Vector3(W.x - 2.0, 1.5, 6.0), Vector3(W.x - 1.4, 1.6, 4.6)], "look": func(k, t): return W.lerp(_one_shard(), clampf((k - 0.55)/0.45, 0, 1)),
			"enter": func(): pane.visible = false; _shatter(); g.get_tree().create_timer(0.18).timeout.connect(func(): g.cue("clang")); _clip(juno, "talk2"),
			"tick": func(dt, t, k): _shards_tick(dt*(0.12 if t < 3.0 else 0.5)); keep_brace.call(dt, t, k)},
		# SHOT 07 · the girl, through the shelter glass; the line; red across her face, from a van behind her
		{"dur": maxf(4.4, vlen.call("vo4") + 1.2), "fov": 30, "dof": 3.0, "cam": Vector3(AVE + 5.6, 1.0, 6.6), "look": Vector3(AVE + 5.2, 0.7, 8.7),
			"enter": func(): g.talk("vo4"); _red(0.0),
			"tick": func(dt, t, k): _shards_tick(dt*0.5); _red(clampf((k - 0.75)/0.25, 0, 1))},
		# SHOT 08 · the WFC arrives: symmetrical, locked; vans from both ends meet; officers in a line; his friends run
		{"dur": 6.0, "fov": 48, "ease": false, "cam": [Vector3(J.x, 2.4, 9.0), Vector3(J.x, 1.9, 5.0)], "look": [J + Vector3(0, 1.0, 0), J + Vector3(0, 1.3, 0)],
			"enter": func(): g.cue("skid"); g.cue("siren"); _red(0.0), "tick": func(dt, t, k): _wfc_arrive(t)},
		# SHOT 09 · the drone drops between him and the lens; its eye; three lights across his face; the line;
		# officers close; one takes his wrist; the bracelet goes dark; a click; the Director's line
		{"dur": maxf(5.6, vlen.call("cityDrone") + vlen.call("vo5") + 1.8), "fov": 30, "cam": [J + Vector3(0.2, 0.9, 2.6), J + Vector3(0.1, 1.0, 1.9)],
			"look": func(k, t): return (drone.node as Node3D).position if t < 0.8 else J + Vector3(0, 1.55, 0),
			"enter": func(): _clip(juno, "idle"); g.cue("scan"),
			"tick": func(dt, t, k): _drone_drop(t, J); keep_brace.call(dt, t, k),
			"beats": [[1.0, func(): g.talk("cityDrone")], [1.0 + vlen.call("cityDrone"), func(): _clip(juno, "stagger"); _grab(J)],
				[1.6 + vlen.call("cityDrone"), func(): bracelet.visible = false; g.cue("lock"); g.talk("vo5")]]},
		# SHOT 10 · the arrest, at boot height: boots, a fallen phone, his hand behind his back, the dark bracelet
		{"dur": maxf(4.4, vlen.call("vo6") + 1.6), "fov": 50, "ease": false, "cam": [J + Vector3(-2.8, 0.25, 2.8), J + Vector3(2.2, 0.55, 2.6)], "look": [J + Vector3(-1.4, 0.2, 0.9), J + Vector3(2.6, 0.9, 0.6)],
			"enter": func(): _arrest(J); g.talk("vo6")},
		# SHOT 11 · up the face of the tower to the billboard; her face; the title; one beat; smash cut
		{"dur": 7.0, "fov": 44, "fov2": 52, "cam": [Vector3(AVE, 1.2, 4.0), Vector3(AVE, 11.5, -6.0)], "look": func(k, t): return Vector3(AVE, lerpf(3.0, 17.0, minf(1, k*1.4)), 10.0),
			"tick": func(dt, t, k): _border(t),
			"beats": [[4.2, func(): g.intro._title(true)]]},
	]
	g.play_reel(shots, func(_s): finish(); done.call())

func finish() -> void:
	g.intro._title(false)
	g.env.fog_density = fog_was
	if fogc_was != Color.BLACK: g.env.fog_light_color = fogc_was
	if g.raid.screen: g.raid.screen.visible = true
	if truck: truck.visible = true
	for n in made:
		if is_instance_valid(n): n.queue_free()
	made = []
	g.chase.stop()

# ------------------------------------------------------------------ the moving parts
func _juno_aim(dt: float, t: float, J: Vector3, W: Vector3) -> void:
	if t <= 2.4: return
	var n: Node3D = juno.n
	n.rotation.y = lerp_angle(n.rotation.y, atan2(W.x - J.x, W.z - J.z), dt*4); _clip(juno, "jab")
var _g1: Dictionary
func _glimpse_ring(at: Vector3) -> void:
	_g1 = _person("zuri", at, PI*0.8, "talk")
	var gl := _glow(Color(1, 0.15, 0.1), 0.02, 1.5, 1.2)
	gl.set_meta("follow", _g1); (func(): if is_instance_valid(gl): var h = _hand(_g1); gl.global_position = h).call_deferred()
	_g1.n.set_meta("glow", gl)
func _ring_at() -> Vector3:
	if _g1.is_empty(): return Vector3(AVE + 12, 12, 17)
	var h = _hand(_g1); var gl: Node3D = _g1.n.get_meta("glow"); gl.global_position = h; return h
var _cour: Dictionary; var _bike: Node3D
func _glimpse_courier() -> void:
	_cour = _person("u", Vector3(AVE - 10, 0.35, 2.0), PI/2, "ride")
	_bike = Node3D.new(); g.add_child(_bike); _keep(_bike)
	_box(Vector3(1.6, 0.5, 0.25), Vector3(0, 0.45, 0), _mat(Color(0.08, 0.08, 0.1), 0.0, 0.3, 0.6), _bike)
	_box(Vector3(0.1, 0.06, 0.24), Vector3(0.8, 0.6, 0), _mat(Color(1, 0.95, 0.8), 3.0), _bike)
	var band := _glow(Color(0.2, 1.0, 0.9), 0.03, 1.2, 1.5); band.set_meta("c", true); _cour.n.set_meta("band", band)
func _courier_at(k: float) -> Vector3: return Vector3(AVE - 10 + k*26.0, 0, 2.0)
func _courier_tick(k: float) -> void:
	if _cour.is_empty(): return
	var p := _courier_at(k); (_cour.n as Node3D).position = p + Vector3(0, 0.35, 0); _bike.position = p
	var b: Node3D = _cour.n.get_meta("band"); var h = _hand(_cour, "LeftForeArm"); b.global_position = h
var _leaper: Dictionary
func _glimpse_leap() -> void:
	_leaper = _person("zuri", Vector3(AVE - 14, 16, -22), PI/2, "jump")
func _leap_tick(k: float) -> void:
	if _leaper.is_empty(): return
	(_leaper.n as Node3D).position = Vector3(AVE - 14 + k*12.0, 16.0 + sin(k*PI)*3.0, -22)
	var gl = (_leaper.n.get_meta("gl") if _leaper.n.has_meta("gl") else null)
	if gl == null: gl = _glow(Color(0.4, 0.8, 1.0), 0.05, 2.0, 2.0); _leaper.n.set_meta("gl", gl)
	(gl as Node3D).global_position = _hand(_leaper, "RightFoot")
var _car: Node3D
func _car_pass() -> void:
	_car = Node3D.new(); g.add_child(_car); _keep(_car)
	_box(Vector3(4.2, 1.2, 1.9), Vector3(0, 0.75, 0), _mat(Color(0.12, 0.13, 0.16), 0.0, 0.2, 0.7), _car)
	_box(Vector3(0.1, 0.18, 1.6), Vector3(2.1, 0.7, 0), _mat(Color(1, 0.95, 0.85), 4.0), _car)
func _car_tick(t: float) -> void:
	if _car: _car.position = Vector3(AVE - 18 + t*24.0, 0, 0.6)
func _flicker(t: float) -> void:
	var l: OmniLight3D = (get_meta("flick") if has_meta("flick") else null)
	if l == null:
		l = OmniLight3D.new(); l.light_color = Color("#ff2a6a"); l.omni_range = 7; l.position = Vector3(AVE + 6.0, 3.2, -8.8); g.add_child(l); _keep(l); set_meta("flick", l)
	l.light_energy = 3.0 if fmod(t*7.3, 1.0) > 0.25 or fmod(t*2.1, 1.0) > 0.6 else 0.3
func _shatter() -> void:
	shards.visible = true; shard_v = []
	for i in shards.multimesh.instance_count:
		var p := pane.position + Vector3(randf_range(-1.55, 1.55), randf_range(-1.05, 1.05), 0.05)
		var v := Vector3(randf_range(-2.5, 2.5), randf_range(-0.5, 3.0), randf_range(4.0, 12.0))
		if i < 14: v = (Vector3(pane.position.x - 1.8, 1.5, 5.4) - p).normalized()*randf_range(14, 20)      # some at the lens
		shard_v.append([p, v, Vector3(randf(), randf(), randf())*TAU, Vector3(randf_range(-6, 6), randf_range(-6, 6), randf_range(-6, 6))])
	_shards_tick(0.0)
func _shards_tick(dt: float) -> void:
	if not shards.visible: return
	for i in shard_v.size():
		var s: Array = shard_v[i]
		s[1] += Vector3(0, -9.8, 0)*dt; s[0] += s[1]*dt; s[2] += s[3]*dt
		if s[0].y < 0.02: s[0].y = 0.02; s[1] = Vector3(s[1].x*0.3, 0, s[1].z*0.3)
		shards.multimesh.set_instance_transform(i, Transform3D(Basis.from_euler(s[2]), s[0]))
func _one_shard() -> Vector3: return shard_v[40][0] if shard_v.size() > 40 else pane.position
var _red_l: OmniLight3D
func _red(k: float) -> void:
	if _red_l == null: _red_l = OmniLight3D.new(); _red_l.light_color = Color(1, 0.1, 0.1); _red_l.omni_range = 9; _red_l.position = Vector3(AVE + 7.5, 1.5, 11.5); g.add_child(_red_l); _keep(_red_l)
	_red_l.light_energy = k*9.0*(0.6 + 0.4*sin(Time.get_ticks_msec()/80.0))
func _wfc_arrive(t: float) -> void:
	var c: Chase = g.chase; var J: Vector3 = (juno.n as Node3D).position
	var q := 1.0 - pow(1.0 - minf(1, t/1.6), 2)
	if c.vans.size() >= 2:
		c.van_place(c.vans[0], lerpf(AVE - 60, J.x - 9, q), 0.4, PI/2 - q*0.5); c.van_place(c.vans[1], lerpf(AVE + 60, J.x + 9, q), 0.4, -PI/2 + q*0.5)
	if t > 1.9:
		var k := minf(1, (t - 1.9)/1.6)
		for i in cops.size():
			var cp: Dictionary = cops[i]; cp.node.visible = true
			var side := -1.0 if i < 3 else 1.0; var j := i % 3
			cp.x = J.x + side*lerpf(8.5, 3.0 + j*1.1, k); cp.z = lerpf(0.4, -5.5 + j*0.8, k); cp.y = 0.0; cp.yaw = atan2(J.x - cp.x, J.z - cp.z)
			c._cop_play(cp, "walk" if k < 1 else "idle"); c._cop_place(cp)
	if t > 2.2:
		for i in friends.size():
			var f: Dictionary = friends[i]; _clip(f, "sprint")
			var n: Node3D = f.n; var dir := -1.0 if i == 0 else 1.0
			n.position.x += dir*7.0*get_process_delta_time(); n.rotation.y = dir*PI/2
func _drone_drop(t: float, J: Vector3) -> void:
	var n: Node3D = drone.node
	var k := 1.0 - pow(1.0 - minf(1, t/0.7), 3)
	n.position = Vector3(J.x + 0.15, lerpf(9.0, 1.75, k), J.z + 1.1); n.rotation.y = PI
	var sc: Array = (get_meta("scan") if has_meta("scan") else [])
	if sc.is_empty():
		for i in 3: sc.append(_glow(Color(1, 0.12, 0.08), 0.012, 0.8, 0.6))
		set_meta("scan", sc)
	for i in 3:
		(sc[i] as Node3D).visible = t > 0.9 and t < 3.5
		(sc[i] as Node3D).global_position = J + Vector3(-0.12 + i*0.12, 1.5 + sin(t*3.0 + i)*0.12, 0.12)
func _grab(J: Vector3) -> void:
	var c: Chase = g.chase
	for i in [0, 3]:
		var cp: Dictionary = cops[i]; cp.x = J.x + (-0.7 if i == 0 else 0.7); cp.z = J.z + 0.3; cp.yaw = atan2(J.x - cp.x, J.z - cp.z); c._cop_play(cp, "idle"); c._cop_place(cp)
func _arrest(J: Vector3) -> void:
	_clip(juno, "fall")
	var phone := _box(Vector3(0.08, 0.01, 0.16), J + Vector3(0.9, 0.01, 0.4), _mat(Color(0.05, 0.05, 0.06), 0.0, 0.2, 0.5)); phone.rotation.y = 0.7
	var dark := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.035; tm.outer_radius = 0.05; dark.mesh = tm
	dark.material_override = _mat(Color(0.12, 0.1, 0.1), 0.0, 0.3, 0.8); dark.position = J + Vector3(1.5, 0.015, 0.25); g.add_child(dark); _keep(dark)
	var c: Chase = g.chase
	for i in cops.size():
		var cp: Dictionary = cops[i]; cp.x = J.x - 2.4 + i*1.0; cp.z = J.z - 0.2 + (i % 2)*0.4; cp.yaw = atan2(J.x - cp.x, J.z - cp.z); c._cop_play(cp, "walk" if i % 2 else "idle"); c._cop_place(cp)
func _border(t: float) -> void:
	var bb: Node3D = (get_meta("bb") if has_meta("bb") else null)
	if bb: ((bb.get_meta("border") as MeshInstance3D).material_override as StandardMaterial3D).emission_energy_multiplier = 1.0 + 0.6*sin(t*2.4)
