## Her eyes in motion, recorded (with --write-movie): her head turning slowly; mode "still" holds the eyes, "move" sweeps them
extends Node3D
var t := 0.0; var model: Node3D; var e: Eyes; var sk: Skeleton3D; var cam: Camera3D; var mode := "still"; var hi := -1
func _ready() -> void:
	mode = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() else "still"
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.6
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.4; key.rotation = Vector3(-0.5, 0.4, 0); add_child(key)
	var n: Node3D = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); add_child(n); model = n
	var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: (x as AnimationPlayer).play("idle")
		if String(x.name) == "worn_shades": x.visible = false
	e = Eyes.attach(n); hi = sk.find_bone("mixamorigHead")
	cam = Camera3D.new(); add_child(cam); cam.current = true; cam.fov = 16
	if OS.get_cmdline_user_args().has("verse"):
		var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(2, 2); q.mesh = qm; q.extra_cull_margin = 16384
		var vm := ShaderMaterial.new(); vm.shader = load("res://shaders/tsh_verse.gdshader"); vm.render_priority = 100; q.material_override = vm; cam.add_child(q); q.position = Vector3(0, 0, -0.5)
func _process(dt: float) -> void:
	t += dt
	model.rotation.y = sin(t*0.8)*0.35
	var hp: Vector3 = sk.global_transform*sk.get_bone_global_pose(hi).origin
	cam.look_at_from_position(Vector3(0, 1.66, 1.1), hp + Vector3(0, 0.13, 0))
	if mode == "move": e.look(sin(t*1.3), sin(t*0.9)*0.6)
