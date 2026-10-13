## The WFC models from the downloads (assets/tsh/wfc_src): each loaded, measured and photographed
extends SceneTree
func _init() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.8
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.4; key.rotation = Vector3(-0.6, 0.6, 0); root.add_child(key)
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 35
	for f in ["wfc/officer.glb", "wfc/drone.glb", "wfc/police_car.glb"]:
		var s: PackedScene = load("res://assets/tsh/" + f)
		if s == null: print(f, " FAILED"); continue
		var n: Node3D = s.instantiate(); root.add_child(n)
		await process_frame
		var bb := AABB(); var first := true; var meshes := 0; var tris := 0
		for mi in n.find_children("*", "MeshInstance3D", true, false):
			var b: AABB = (mi as MeshInstance3D).global_transform*(mi as MeshInstance3D).get_aabb()
			bb = b if first else bb.merge(b); first = false; meshes += 1
			if (mi as MeshInstance3D).mesh: for si in (mi as MeshInstance3D).mesh.get_surface_count(): tris += (mi as MeshInstance3D).mesh.surface_get_array_len(si)/3
		var aps := n.find_children("*", "AnimationPlayer", true, false)
		print(f, " aabb=", bb, " meshes=", meshes, " ~tris=", tris, " anims=", (aps[0] as AnimationPlayer).get_animation_list() if aps.size() else [])
		var c := bb.get_center(); var r := bb.size.length()
		cam.look_at_from_position(c + Vector3(r*0.7, r*0.35, r*0.9), c)
		for i in 3: await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(out + "/" + f.get_file().get_basename() + ".png")
		n.queue_free(); await process_frame
	quit()
