## A one-off look at something from a chosen camera — for checking a room
## without the whole of Wano round it.
##   godot --path . -s res://tools/probe.gd -- <out.png> <building id>
extends SceneTree

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var root := Node3D.new()
	get_root().add_child(root)
	var spec: Dictionary = {}
	for s in Planet.BUILDINGS:
		if s.id == args[1]:
			spec = s
	var b := Building.new().setup(spec, root)
	root.add_child(b)
	b.transform = Transform3D(Basis(), Vector3(0, 0, 0))
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.transform = Transform3D(Basis.looking_at(Vector3(0, -7.5, -2), Vector3(0, 0, -1)), Vector3(0, 7.5, 0))
	cam.current = true
	cam.fov = 80
	var light := DirectionalLight3D.new()
	root.add_child(light)
	light.rotation = Vector3(-1.0, 0.3, 0)
	for i in 8:
		await process_frame
	for c in b.get_children():
		if c is MeshInstance3D and c.mesh:
			var m := c.mesh.surface_get_material(0) as StandardMaterial3D
			print("%-28s %s" % [str(c.mesh.get_aabb()), m.albedo_color.to_html(false) if m else "-"])
	await RenderingServer.frame_post_draw
	get_root().get_texture().get_image().save_png(args[0])
	quit()
