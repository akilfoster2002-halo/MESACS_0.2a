## Her eyes, photographed looking each way: centre, her left, her right, up, down
extends SceneTree
func _init() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = 1.1
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.4; key.rotation = Vector3(-0.5, 0.4, 0); root.add_child(key)
	var n: Node3D = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); root.add_child(n)
	var sk: Skeleton3D; var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: (x as AnimationPlayer).play("idle"); (x as AnimationPlayer).seek(0.5, true)
		if String(x.name) == "worn_shades": x.visible = false
	await process_frame
	var e := Eyes.attach(n)
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 14
	await process_frame
	var hi := sk.find_bone("mixamorigHead"); var hp: Vector3 = sk.global_transform*sk.get_bone_global_pose(hi).origin
	cam.look_at_from_position(hp + Vector3(0, 0.15, 0.75), hp + Vector3(0, 0.12, 0))
	var body: MeshInstance3D = n.find_child("char1", true, false)
	for v in [["centre", 0, 0], ["left", 1, 0], ["right", -1, 0], ["up", 0, 1], ["down", 0, -1], ["blink", 8, 8], ["half", 7, 7]]:
		if v[1] == 8: e.open(0.0); body.set_blend_shape_value(body.find_blend_shape_by_name("blink"), 1.0)
		elif v[1] == 7: e.open(true); body.set_blend_shape_value(body.find_blend_shape_by_name("blink"), 0.45); e.look(0, 0)
		else: e.look(v[1], v[2])
		for i in 3: await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(out + "/eyes_" + v[0] + ".png")
	quit()
