## Her right hand and the phone, close, from four sides, in the call pose — for fitting the phone to her hand
##   godot --path koro-godot --resolution 500x500 -s res://tools/phone_fit.gd -- <dir> [x y z]
extends SceneTree
func _init() -> void:
	var args := OS.get_cmdline_user_args(); var out: String = args[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.8
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.3; key.rotation = Vector3(-0.5, 0.4, 0); root.add_child(key)
	var n: Node3D = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); root.add_child(n)
	var sk: Skeleton3D; var ap: AnimationPlayer; var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: ap = x
		if String(x.name) in ["worn_gecko-cuffs", "worn_tech-jacket", "worn_shades"]: x.visible = false
		if String(x.name) in ["under_cuffs", "under_jacket"]: x.visible = true
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
	var ph := Phone.make(sk); ph.hold("ear")
	ap.play("phone_talk"); ap.seek(10.0, true)
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 22
	for i in 3: await process_frame
	var hand: Vector3 = sk.global_transform*sk.get_bone_global_pose(sk.find_bone("mixamorigRightHand")).origin
	var c := hand + Vector3(0, 0.06, 0)
	for v in [["front", Vector3(0, 0, 0.55)], ["out", Vector3(-0.55, 0, 0.05)], ["back", Vector3(0, 0.05, -0.55)], ["top", Vector3(-0.15, 0.5, 0.15)]]:
		cam.look_at_from_position(c + v[1], c)
		for i in 2: await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(out + "/fit_" + v[0] + ".png")
	quit()
