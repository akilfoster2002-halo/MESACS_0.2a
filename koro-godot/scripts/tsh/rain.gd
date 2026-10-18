## RAIN: streaks falling round the camera wherever it goes, and now and then the lightning (a white flash, the thunder
## a moment after). Rain.start(g, k) to bring it in (k: 0..1, how hard), Rain.stop(); Rain.tick(g, dt) each frame.
class_name Rain
extends RefCounted

static var drops: GPUParticles3D
static var k := 0.0
static var want := 0.0
static var bolt := 4.0
static var thunder := -1.0
static var sounds: Array = []           # [drizzle, downpour] players: rain made by Raindear (github.com/nielsiano/Raindear, MIT), looped
static var sky: DirectionalLight3D        # the lightning: a real light, for a moment, throwing everything's shadow at once

static func start(g, hard := 1.0) -> void:
	want = hard
	if drops != null and is_instance_valid(drops): return
	drops = GPUParticles3D.new(); drops.amount = 9000; drops.lifetime = 0.9; drops.preprocess = 0.9
	drops.visibility_aabb = AABB(Vector3(-30, -40, -30), Vector3(60, 60, 60)); drops.local_coords = false
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX; pm.emission_box_extents = Vector3(20, 1, 20)
	pm.direction = Vector3(0.12, -1, 0.05); pm.spread = 2.0; pm.initial_velocity_min = 34.0; pm.initial_velocity_max = 40.0; pm.gravity = Vector3(0, -9.8, 0)
	drops.process_material = pm
	var q := QuadMesh.new(); q.size = Vector2(0.01, 0.7)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.78, 0.84, 1.0, 0.22); m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y; m.billboard_keep_scale = true
	m.render_priority = 110                  # after the ink pass (it redraws the screen over anything sooner)
	q.material = m; drops.draw_pass_1 = q
	g.add_child(drops)
	sky = DirectionalLight3D.new(); sky.light_color = Color(0.8, 0.86, 1.0); sky.light_energy = 0.0; sky.shadow_enabled = true; sky.shadow_bias = 0.1; sky.shadow_normal_bias = 2.0; sky.rotation = Vector3(-1.1, 0.7, 0); g.add_child(sky)
	k = 0.0; bolt = 3.0
	sounds = []
	for nm in ["storm_drizzle", "storm_pour"]:
		var st: AudioStreamWAV = load("res://assets/tsh/music/%s.wav" % nm)
		if st == null: continue
		st = st.duplicate(); st.loop_mode = AudioStreamWAV.LOOP_FORWARD; st.loop_begin = 0; st.loop_end = int(st.get_length()*st.mix_rate)
		var pl := AudioStreamPlayer.new(); pl.stream = st; pl.volume_db = -80; g.add_child(pl); pl.play(randf()*20.0); sounds.append(pl)

static func stop() -> void:
	want = 0.0

static func tick(g, dt: float) -> void:
	if drops == null or not is_instance_valid(drops): return
	k = move_toward(k, want, dt*0.5)
	drops.amount_ratio = k
	drops.emitting = k > 0.01
	var cam: Camera3D = g.get_viewport().get_camera_3d()
	if cam: drops.global_position = cam.global_position + Vector3(0, 16, 0) - cam.global_basis.z*6
	g.storm_rain = 0.0 if sounds.size() == 2 else 0.22*k
	if sounds.size() == 2:                                   # drizzle at first, the downpour taking over as it builds
		var dz := clampf(k/0.3, 0, 1)*(1.0 - clampf((k - 0.35)/0.4, 0, 1)*0.7); var pr := clampf((k - 0.25)/0.6, 0, 1)
		sounds[0].volume_db = linear_to_db(maxf(dz*0.9, 0.0001)); sounds[1].volume_db = linear_to_db(maxf(pr*1.15, 0.0001))
	Tower.soak(k)
	if k < 0.3:
		if want <= 0.0 and k <= 0.0:
			drops.queue_free(); drops = null
			for pl in sounds: if is_instance_valid(pl): pl.queue_free()
			sounds = []
			if sky: sky.queue_free(); sky = null
		return
	if sky: sky.light_energy = move_toward(sky.light_energy, 0.0, dt*(9.0 if sky.light_energy > 1.0 else 3.0))
	if Tower.sky_mat:
		Tower.sky_mat.set_shader_parameter("flash", (sky.light_energy/2.2) if sky else 0.0); Tower.sky_mat.set_shader_parameter("t", Time.get_ticks_msec()/1000.0)
	bolt -= dt
	if bolt <= 0:
		bolt = 1.8 + randf()*3.5; _strike(g); thunder = 0.15 + randf()*0.6
		if g.station: g.station.flash(0.12, Color(0.85, 0.9, 1.0))
		if sky: sky.light_energy = 2.2; sky.rotation.y = randf()*TAU
	if thunder >= 0:
		thunder -= dt
		if thunder < 0: g.cue("thunder")                      # (Raindear's thunder rolls: not the fight's impact)

## a bolt you can see: a jagged white line from the cloud down to the city, forks off it, gone in a quarter second
static func _strike(g) -> void:
	var cam: Camera3D = g.get_viewport().get_camera_3d()
	if cam == null: return
	var a := randf()*TAU; var far := randf_range(140.0, 260.0)
	var base: Vector3 = cam.global_position + Vector3(sin(a)*far, 0, cos(a)*far)
	var top := base + Vector3(randf_range(-20, 20), 140.0, randf_range(-20, 20)); var bottom := Vector3(base.x, cam.global_position.y - 120.0, base.z)
	var im := ImmediateMesh.new(); var mi := MeshInstance3D.new(); mi.mesh = im; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(3.5, 3.6, 4.5); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.render_priority = 104
	mi.material_override = m; g.add_child(mi)
	var side := (top - bottom).cross(cam.global_position - bottom).normalized()
	var ribbon := func(pts: Array, w: float):
		im.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
		for q in pts: im.surface_add_vertex(q - side*w); im.surface_add_vertex(q + side*w)
		im.surface_end()
	var path := [top]; var n := 14
	for i in range(1, n + 1):
		var q: Vector3 = top.lerp(bottom, float(i)/n) + side*randf_range(-9, 9) + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))
		path.append(q)
	ribbon.call(path, 0.9)
	for f in 3:
		var i0 := randi_range(2, n - 4); var fork := [path[i0]]; var q: Vector3 = path[i0]
		for k in 5: q += (bottom - top).normalized()*12.0 + side*randf_range(-12, 12); fork.append(q)
		ribbon.call(fork, 0.45)
	var tw: Tween = g.create_tween()
	tw.tween_property(m, "albedo_color:a", 0.0, 0.08).set_delay(0.06); tw.tween_property(m, "albedo_color:a", 1.0, 0.03); tw.tween_property(m, "albedo_color:a", 0.0, 0.25)
	tw.tween_callback(mi.queue_free)
