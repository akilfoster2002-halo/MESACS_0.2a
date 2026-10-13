## Robin playing the guitar (her Mixamo guitar clips), photographed front, side and three-quarter, the guitar placed
## as intro.gd places it — for fitting it to her hands
##   godot --path koro-godot --resolution 500x500 -s res://tools/guitar_fit.gd -- <dir>
extends SceneTree
var sk: Skeleton3D; var model: Node3D; var axe: Node3D
func bone(n: String) -> Vector3: return sk.global_transform*sk.get_bone_global_pose(sk.find_bone("mixamorig" + n)).origin
func _init() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#c8dce0"); env.ambient_light_energy = 0.8
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var key := DirectionalLight3D.new(); key.light_energy = 1.3; key.rotation = Vector3(-0.5, 0.4, 0); root.add_child(key)
	model = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); root.add_child(model)
	var ap: AnimationPlayer
	for x in model.find_children("*", "", true, false):
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: ap = x
		if String(x.name) in ["worn_tech-jacket", "worn_gecko-cuffs", "worn_shades", "worn_roll-top"]: x.visible = false
		if String(x.name) in ["under_jacket", "under_cuffs"]: x.visible = true
	var src: Node = (load("res://assets/tsh/robin_guitar.glb") as PackedScene).instantiate()
	var sap: AnimationPlayer = src.find_children("*", "AnimationPlayer", true, false)[0]
	var skp := String(ap.get_node(ap.root_node).get_path_to(sk))
	for nm in sap.get_animation_list():
		var a: Animation = sap.get_animation(nm).duplicate(true)
		for t in range(a.get_track_count() - 1, -1, -1):
			var b := String(a.track_get_path(t)).get_file().split(":")[0].replace("_", "")
			if sk.find_bone(b) >= 0: a.track_set_path(t, NodePath(skp + ":" + b))
			else: a.remove_track(t)
		ap.get_animation_library("").add_animation(nm, a)
	axe = Intro.make_axe(); root.add_child(axe)
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 30
	for v in [["guitar_a", 1.0], ["guitar_b", 1.5]]:
		ap.play(v[0]); ap.seek(v[1], true)
		for i in 2: await process_frame
		Intro.place_axe(axe, sk, model)
		print(v[0], " R=", bone("RightHand"), " L=", bone("LeftHand"), " hips=", bone("Hips"), " spine2=", bone("Spine2"))
		for side in [["front", Vector3(0.0, 1.2, 2.2)], ["side", Vector3(-2.2, 1.2, 0.2)], ["tq", Vector3(1.5, 1.3, 1.6)]]:
			cam.look_at_from_position(side[1], Vector3(0, 1.05, 0))
			for i in 2: await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(out + "/%s_%s.png" % [v[0], side[0]])
	quit()
