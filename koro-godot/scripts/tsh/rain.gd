## RAIN: streaks falling round the camera wherever it goes, and now and then the lightning (a white flash, the thunder
## a moment after). Rain.start(g, k) to bring it in (k: 0..1, how hard), Rain.stop(); Rain.tick(g, dt) each frame.
class_name Rain
extends RefCounted

static var drops: GPUParticles3D
static var k := 0.0
static var want := 0.0
static var bolt := 4.0
static var thunder := -1.0
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

static func stop() -> void:
	want = 0.0

static func tick(g, dt: float) -> void:
	if drops == null or not is_instance_valid(drops): return
	k = move_toward(k, want, dt*0.5)
	drops.amount_ratio = k
	drops.emitting = k > 0.01
	var cam: Camera3D = g.get_viewport().get_camera_3d()
	if cam: drops.global_position = cam.global_position + Vector3(0, 16, 0) - cam.global_basis.z*6
	g.storm_rain = 0.22*k
	Tower.soak(k)
	if k < 0.3:
		if want <= 0.0 and k <= 0.0:
			drops.queue_free(); drops = null
			if sky: sky.queue_free(); sky = null
		return
	if sky: sky.light_energy = move_toward(sky.light_energy, 0.0, dt*(18.0 if sky.light_energy > 2.5 else 6.0))
	bolt -= dt
	if bolt <= 0:
		bolt = 5.0 + randf()*7.0; thunder = 0.35 + randf()*0.9
		if g.station: g.station.flash(0.35, Color(0.85, 0.9, 1.0))
		if sky: sky.light_energy = 6.0; sky.rotation.y = randf()*TAU
	if thunder >= 0:
		thunder -= dt
		if thunder < 0: g.cue("boom")
