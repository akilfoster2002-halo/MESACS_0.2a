## Robin with the iPhone in her hand, in each phone clip, photographed — for placing the phone in her hand
##   godot --path koro-godot --resolution 900x700 -s res://tools/phone_pose.gd -- <dir>
extends SceneTree
func _init() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.4; key.rotation = Vector3(-0.5, 0.4, 0); root.add_child(key)
	var n: Node3D = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); root.add_child(n)
	var sk: Skeleton3D; var ap: AnimationPlayer; var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: ap = x
	# the phone clips, merged as the game does
	var src: Node = (load("res://assets/tsh/robin_phone.glb") as PackedScene).instantiate()
	var sap: AnimationPlayer = src.find_children("*", "AnimationPlayer", true, false)[0]
	var skp := String(ap.get_node(ap.root_node).get_path_to(sk))
	for nm in sap.get_animation_list():
		var a: Animation = sap.get_animation(nm).duplicate(true)
		for t in range(a.get_track_count() - 1, -1, -1):
			var bone := String(a.track_get_path(t)).get_file().split(":")[0].replace("_", "")
			if sk.find_bone(bone) >= 0: a.track_set_path(t, NodePath(skp + ":" + bone))
			else: a.remove_track(t)
		ap.get_animation_library("").add_animation(nm, a)
	var ph := PhoneProp.make(sk); ph.visible = true
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 30
	for v in [["text", 0.6], ["phone_talk", 10.0], ["phone_pace", 12.0]]:
		ph.hold("read" if v[0] == "text" else "ear"); ap.play(v[0]); ap.seek(v[1], true)
		for i in 3: await process_frame
		for side in [["front", Vector3(0.2, 1.5, 0.9)], ["side", Vector3(-0.9, 1.5, 0.15)], ["back", Vector3(0.5, 1.6, -0.7)]]:
			cam.look_at_from_position(side[1], Vector3(-0.05, 1.4, 0))
			for i in 2: await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(out + "/%s_%d_%s.png" % [v[0], int(v[1]), side[0]])
	quit()
