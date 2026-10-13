## the rigged WFC officer, photographed: idle, walking, sprinting, front and side
extends SceneTree
func _init() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.5; key.rotation = Vector3(-0.6, 0.5, 0); root.add_child(key)
	var n: Node3D = (load("res://assets/tsh/wfc/officer.glb") as PackedScene).instantiate(); root.add_child(n)
	var ap: AnimationPlayer = n.find_children("*", "AnimationPlayer", true, false)[0]
	print("anims ", ap.get_animation_list())
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 30
	for v in [["idle", 1.0, 0.0], ["walk", 0.4, 0.0], ["sprint", 0.3, 0.0], ["idle", 1.0, 1.4], ["walk", 0.4, 1.4], ["jab", 0.35, 0.6]]:
		ap.play(v[0]); ap.seek(v[1], true)
		cam.look_at_from_position(Vector3(sin(v[2])*4.2, 1.1, cos(v[2])*4.2), Vector3(0, 0.95, 0))
		for i in 3: await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(out + "/o_%s_%d.png" % [v[0], int(v[2]*10)])
	quit()
