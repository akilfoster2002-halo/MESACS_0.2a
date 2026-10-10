## TSH IN GODOT — the test stage. The night city of the browser's TSH (public/tsh*.js), exported from the running
## game exactly as it stands (assets/tsh/city.glb, with its collision boxes, ladders and spots in city.json and its
## lights and fog in lights.json), Robin in her kit to run about in, Maya walking on Doctor Octopus's arms, and the
## Spider-Verse look over all of it (shaders/tsh_verse.gdshader).
##
##   godot --path koro-godot res://scenes/tsh_stage.tscn
##
## WASD move (relative to the camera) · Shift run · Space jump · mouse looks (click to capture, Esc frees it) ·
## scroll zooms · V toggles the Spider-Verse look · B makes Maya strike · M sends Maya to you
extends Node3D

const RUN := 6.4
const WALK := 2.4
const JUMP := 6.2
const GRAV := 18.0

var data := {}
var player: CharacterBody3D
var model: Node3D
var anim: AnimationPlayer
var cam: Camera3D
var cam_yaw := PI
var cam_pitch := -0.2
var cam_dist := 3.4
var verse_mat: ShaderMaterial
var maya: Node3D
var maya_anim: AnimationPlayer
var oc: Tentacles
var clip := ""
var shots_dir := ""

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: shots_dir = args[0]
	data = JSON.parse_string(FileAccess.get_file_as_string("res://assets/tsh/city.json"))
	_environment()
	_city()
	_player()
	_maya()
	_camera()
	if shots_dir != "": _shots()
	else: Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

# ------------------------------------------------------------------ the night
func _environment() -> void:
	var L: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/tsh/lights.json"))
	var env := Environment.new()
	var fog: Dictionary = L.env.fog
	var bg := Color("#" + str(L.env.bg))
	env.background_mode = Environment.BG_COLOR
	env.background_color = bg
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.32, 0.5, 0.52)
	env.ambient_light_energy = 0.2
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = float(L.env.exposure)
	env.fog_enabled = true
	env.fog_light_color = Color("#" + str(fog.c))
	env.fog_density = float(fog.density)*1.6
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.glow_hdr_threshold = 1.1
	env.ssao_enabled = true
	env.ssr_enabled = true                 # the wet street mirrors the city above it (the browser's planar reflector)
	env.ssr_max_steps = 48
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	for l in L.lights:
		if not l.vis: continue
		var col := Color("#" + str(l.c))
		var p := Vector3(l.p[0], l.p[1], l.p[2])
		match str(l.type):
			"DirectionalLight":
				var d := DirectionalLight3D.new(); d.light_color = col; d.light_energy = float(l.i)*0.45
				d.shadow_enabled = bool(l.shadow); add_child(d)
				var tgt := Vector3(l.t[0], l.t[1], l.t[2]) if l.t != null else Vector3.ZERO
				d.look_at_from_position(p, tgt if tgt != p else p + Vector3(0, -1, 0.01))
			"PointLight":
				var o := OmniLight3D.new(); o.light_color = col; o.light_energy = float(l.i)*0.07
				o.omni_range = float(l.d) if float(l.d) > 0 else 20.0; o.position = p; add_child(o)
			"SpotLight":
				var s := SpotLight3D.new(); s.light_color = col; s.light_energy = float(l.i)*0.07
				s.spot_range = float(l.d) if float(l.d) > 0 else 25.0; add_child(s)
				var tg := Vector3(l.t[0], l.t[1], l.t[2]) if l.t != null else p + Vector3(0, -1, 0)
				s.look_at_from_position(p, tg)
			"HemisphereLight":
				env.ambient_light_color = col.lerp(Color("#" + str(l.g)), 0.5)
				env.ambient_light_energy = float(l.i)*0.18
	# a soft light that follows her, so she reads against the night (the browser's charLook rim)
	var key := OmniLight3D.new(); key.name = "Key"; key.light_color = Color(1.0, 0.86, 0.74); key.light_energy = 1.4; key.omni_range = 4.5
	add_child(key)

# ------------------------------------------------------------------ the city
func _city() -> void:
	var c: Node3D = (load("res://assets/tsh/city.glb") as PackedScene).instantiate()
	add_child(c)
	var body := StaticBody3D.new(); add_child(body)
	# the ground, and every solid the browser's TSH collides with
	var g := CollisionShape3D.new(); var gs := BoxShape3D.new(); gs.size = Vector3(2000, 1, 2000); g.shape = gs; g.position.y = -0.5; body.add_child(g)
	for s in data.solids:
		var x1: float = s[0]; var x2: float = s[1]; var z1: float = s[2]; var z2: float = s[3]; var y1: float = s[4]; var y2: float = s[5]
		var cs := CollisionShape3D.new(); var bs := BoxShape3D.new()
		bs.size = Vector3(maxf(0.05, x2 - x1), maxf(0.05, y2 - y1), maxf(0.05, z2 - z1)); cs.shape = bs
		cs.position = Vector3((x1 + x2)/2, (y1 + y2)/2, (z1 + z2)/2); body.add_child(cs)

# ------------------------------------------------------------------ Robin
func _player() -> void:
	player = CharacterBody3D.new(); add_child(player)
	var cs := CollisionShape3D.new(); var cap := CapsuleShape3D.new(); cap.radius = 0.28; cap.height = 1.62; cs.shape = cap; cs.position.y = 0.81
	player.add_child(cs)
	model = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); player.add_child(model)
	anim = _anim_of(model); _loop(anim)
	var st: Array = data.start
	player.position = Vector3(st[0], 0.2, st[2])

func _anim_of(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer: return n
	for c in n.get_children():
		var a := _anim_of(c)
		if a: return a
	return null

func _loop(ap: AnimationPlayer) -> void:
	if not ap: return
	for nm in ap.get_animation_list():
		if nm in ["jump", "flip", "roll", "climb_top", "wake", "kneel"]: continue
		ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR

func _play(ap: AnimationPlayer, nm: String, cur: String) -> String:
	if ap and nm != cur and ap.has_animation(nm): ap.play(nm, 0.2)
	return nm

# ------------------------------------------------------------------ Maya, on her arms
func _maya() -> void:
	maya = (load("res://assets/tsh/maya.glb") as PackedScene).instantiate(); add_child(maya)
	maya_anim = _anim_of(maya); _loop(maya_anim)
	if maya_anim and maya_anim.has_animation("idle"): maya_anim.play("idle")
	oc = Tentacles.new(); add_child(oc)
	var at := _open_spot(player.position, 4.0, 8.0, 2.8)
	oc.setup(0.0, at, atan2(player.position.x - at.x, player.position.z - at.z))
	var spine := _bone(maya, "Spine2")
	oc.socket = func():
		if spine.is_empty(): return Transform3D(Basis(Vector3.UP, oc.yaw), oc.body + Vector3(0, 0.35, 0))
		var sk: Skeleton3D = spine[0]
		return sk.global_transform*sk.get_bone_global_pose(spine[1])

## somewhere clear of every solid by `r`, between `near` and `far` from `from` (the arms need room to stand)
func _open_spot(from: Vector3, near: float, far: float, r: float) -> Vector3:
	var best := from; var bd := INF
	for ix in range(-24, 25):
		for iz in range(-24, 25):
			var p := from + Vector3(ix*0.5, 0, iz*0.5)
			var d := Vector2(p.x - from.x, p.z - from.z).length()
			if d < near or d > far: continue
			var clear := true
			for s in data.solids:
				if s[5] > 0.5 and p.x > s[0] - r and p.x < s[1] + r and p.z > s[2] - r and p.z < s[3] + r: clear = false; break
			if clear and absf(d - (near + far)/2) < bd: bd = absf(d - (near + far)/2); best = p
	return Vector3(best.x, 0, best.z)

func _bone(root: Node, suffix: String) -> Array:
	var stack := [root]
	while stack.size():
		var n: Node = stack.pop_back()
		if n is Skeleton3D:
			for i in (n as Skeleton3D).get_bone_count():
				if (n as Skeleton3D).get_bone_name(i).ends_with(suffix): return [n, i]
		stack.append_array(n.get_children())
	return []

# ------------------------------------------------------------------ the lens
func _camera() -> void:
	cam = Camera3D.new(); cam.fov = 62; cam.near = 0.08; cam.far = 600; add_child(cam); cam.current = true
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(2, 2); q.mesh = qm
	q.extra_cull_margin = 16384; q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	verse_mat = ShaderMaterial.new(); verse_mat.shader = load("res://shaders/tsh_verse.gdshader"); verse_mat.render_priority = 100
	q.material_override = verse_mat; cam.add_child(q); q.position = Vector3(0, 0, -0.5)

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		cam_yaw -= ev.relative.x*0.0035; cam_pitch = clampf(cam_pitch - ev.relative.y*0.003, -1.2, 0.5)
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP: cam_dist = maxf(1.4, cam_dist - 0.3)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN: cam_dist = minf(12.0, cam_dist + 0.3)
		else: Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_V: verse_mat.set_shader_parameter("verse", 0.0 if float(verse_mat.get_shader_parameter("verse")) > 0.5 else 1.0)
			KEY_B: _strike()
			KEY_M: oc.go_to(player.position.x + 2.5, player.position.z + 2.5, 1.7)

func _strike() -> void:
	var f := Vector3(sin(oc.yaw), 0, cos(oc.yaw))
	oc.burst(0, oc.body + f*1.7 + Vector3(0.6, 0.9, 0), 1.6)
	oc.burst(1, oc.body + f*1.7 + Vector3(-0.6, 0.8, 0), 1.6)

func _physics_process(dt: float) -> void:
	var input := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	if Input.is_physical_key_pressed(KEY_A): input.x -= 1
	if Input.is_physical_key_pressed(KEY_D): input.x += 1
	if Input.is_physical_key_pressed(KEY_W): input.y -= 1
	if Input.is_physical_key_pressed(KEY_S): input.y += 1
	input = input.limit_length(1.0)
	var running := Input.is_physical_key_pressed(KEY_SHIFT)
	var basis := Basis(Vector3.UP, cam_yaw)
	var dir := basis*Vector3(input.x, 0, input.y)
	var sp := RUN if running else WALK
	player.velocity.x = dir.x*sp; player.velocity.z = dir.z*sp
	if player.is_on_floor():
		if Input.is_physical_key_pressed(KEY_SPACE): player.velocity.y = JUMP
	else:
		player.velocity.y -= GRAV*dt
	player.move_and_slide()
	if dir.length() > 0.05:
		var want := atan2(dir.x, dir.z)
		model.rotation.y = lerp_angle(model.rotation.y, want, minf(1.0, dt*12.0))
	var nm := "idle"
	if not player.is_on_floor(): nm = "jump"
	elif dir.length() > 0.05: nm = "sprint" if running else "walk"
	clip = _play(anim, nm, clip)
	# Maya stands on her arms: her body where they carry it
	maya.position = oc.body - Vector3(0, 0.95, 0)
	maya.rotation.y = oc.yaw

func _process(dt: float) -> void:
	var head := player.position + Vector3(0, 1.45, 0)
	var off := Basis(Vector3.UP, cam_yaw)*Basis(Vector3.RIGHT, cam_pitch)*Vector3(0, 0, cam_dist)
	var want := head + off
	# never inside a wall: pull in to the first thing between her and the lens
	var hit := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(head, want, 1, [player.get_rid()]))
	if hit: want = head + (hit.position - head)*0.9
	cam.global_position = cam.global_position.lerp(want, minf(1.0, dt*12.0)) if cam.global_position != Vector3.ZERO else want
	cam.look_at(head)
	($Key as OmniLight3D).global_position = head + cam.global_basis.z*1.2 + Vector3(0, 0.6, 0)

# ------------------------------------------------------------------ photographs (tools: godot ... -- <dir>)
func _shots() -> void:
	await get_tree().create_timer(2.5).timeout
	await _snap("01_start")
	cam_yaw = PI*0.75; await get_tree().create_timer(0.6).timeout; await _snap("02_side")
	var to := oc.body - player.position
	cam_yaw = atan2(-to.x, -to.z); cam_dist = 6.5; cam_pitch = -0.12
	await get_tree().create_timer(1.5).timeout; await _snap("03_maya")
	_strike(); await get_tree().create_timer(0.5).timeout; await _snap("04_strike")
	verse_mat.set_shader_parameter("verse", 0.0); await get_tree().create_timer(0.3).timeout; await _snap("05_plain")
	get_tree().quit()

func _snap(nm: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(shots_dir.path_join(nm + ".png"))
	print("shot ", nm)
