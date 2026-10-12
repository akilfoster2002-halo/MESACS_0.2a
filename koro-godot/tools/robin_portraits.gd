## Robin, photographed: in her kit (front, three-quarter) and in just her clothes, and her face
##   godot --path koro-godot --resolution 900x1200 -s res://tools/robin_portraits.gd -- <dir>
extends SceneTree
func _init() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = 1.1
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.5; key.rotation = Vector3(-0.6, 0.5, 0); key.shadow_enabled = true; root.add_child(key)
	var rim := DirectionalLight3D.new(); rim.light_energy = 1.0; rim.light_color = Color("#8ff0ff"); rim.rotation = Vector3(-0.3, PI + 0.6, 0); root.add_child(rim)
	var n: Node3D = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); root.add_child(n)
	var nodes: Array = []; var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children()); nodes.append(x)
		if x is AnimationPlayer: (x as AnimationPlayer).play("idle"); (x as AnimationPlayer).seek(0.5, true)
		if x is MeshInstance3D and String(x.get_parent().name).ends_with("Foot"): x.visible = false      # the shoes' glow: a light in play, not part of her
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true
	await process_frame
	var kit := func(on: bool, shades: bool):
		for x in nodes:
			var nm := String(x.name)
			if nm.begins_with("worn_") and nm != "worn_baggy-jeans": x.visible = on and (shades or nm != "worn_shades")
			if nm in ["under_jacket", "under_cuffs", "under_shoes"]: x.visible = not on
	for v in [[true, true, 0.0, "kit_front"], [true, true, 0.7, "kit_three_quarter"], [false, false, 0.0, "plain_front"], [true, false, -1.0, "face"]]:
		kit.call(v[0], v[1])
		if v[2] < 0: cam.fov = 22; cam.look_at_from_position(Vector3(0.05, 1.6, 1.1), Vector3(0, 1.58, 0))
		else: cam.fov = 32; cam.look_at_from_position(Vector3(sin(v[2])*3.4, 1.0, cos(v[2])*3.4), Vector3(0, 0.88, 0))
		for i in 4: await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(out + "/robin_" + v[3] + ".png")
	quit()
