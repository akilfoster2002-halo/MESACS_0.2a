## Where her eyes are on her model: her face rendered straight on in its rest pose, the pupils found (the darkest
## pixels in each eye), and the rays through them met with her skinned face. Writes eyes.json (head-bone space).
##   godot --path koro-godot --resolution 800x800 -s res://tools/eyes_locate.gd -- <dir> [model.glb] [y0 y1 rx0 rx1 lx0 lx1]
##   (Robin by default; another model of the same make — Maya — with where to look for her pupils in the picture)
extends SceneTree
func _init() -> void:
	var A := OS.get_cmdline_user_args(); var out: String = A[0]
	var model: String = A[1] if A.size() > 1 else "res://assets/tsh/robin.glb"
	var win: Array = [400, 500, 120, 280, 450, 620] if A.size() < 8 else Array(A.slice(2, 8)).map(func(x): return int(x))
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color("#1a2a2e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color.WHITE; env.ambient_light_energy = 1.0
	var we := WorldEnvironment.new(); we.environment = env; root.add_child(we)
	var n: Node3D = (load(model) as PackedScene).instantiate(); root.add_child(n)
	var sk: Skeleton3D; var body: MeshInstance3D; var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: (x as AnimationPlayer).stop()
		if x.name == "char1": body = x
		if (String(x.name).begins_with("worn_") and x.name != "worn_baggy-jeans") or String(x.name).begins_with("glasses"): x.visible = false
	sk.reset_bone_poses()
	await process_frame
	var hi := sk.find_bone("mixamorigHead")
	var hp: Vector3 = sk.global_transform*sk.get_bone_global_pose(hi).origin
	var cam := Camera3D.new(); root.add_child(cam); cam.current = true; cam.fov = 12
	await process_frame
	cam.look_at_from_position(hp + Vector3(-0.01, 0.155, 0.9), hp + Vector3(-0.01, 0.155, 0))
	for i in 3: await process_frame
	await RenderingServer.frame_post_draw
	var im := root.get_texture().get_image(); im.save_png(out + "/eyes_c.png")
	# the pupils: the darkest pixels in each half of the eye band, by their centroid
	var W := im.get_width(); var H := im.get_height()
	body.create_trimesh_collision()
	var arr := body.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]; var B: PackedInt32Array = arr[Mesh.ARRAY_BONES]; var Wt: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]; var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var nb := B.size()/V.size()
	var poses := []
	for bi in body.skin.get_bind_count():
		var bone := body.skin.get_bind_bone(bi)
		if bone < 0: bone = sk.find_bone(body.skin.get_bind_name(bi))
		poses.append(sk.global_transform*sk.get_bone_global_pose(bone)*body.skin.get_bind_pose(bi))
	var P := PackedVector3Array(); P.resize(V.size())
	for vi in V.size():
		var q := Vector3.ZERO
		for j in nb:
			var w := Wt[vi*nb + j]
			if w > 0: q += (poses[B[vi*nb + j]] as Transform3D)*V[vi]*w
		P[vi] = q
	var eye_guess := hp + Vector3(-0.01, 0.155, 0.06)
	var tris := []
	for k in range(0, I.size(), 3):
		var a := P[I[k]]; var b := P[I[k + 1]]; var c3 := P[I[k + 2]]
		if a.distance_to(eye_guess) < 0.12: tris.append([a, b, c3])
	print("face tris ", tris.size())
	var res := {}
	for side in [["R", win[2], win[3]], ["L", win[4], win[5]]]:
		var sx := 0.0; var sy := 0.0; var c := 0.0
		for y in range(win[0], win[1]):
			for x in range(side[1], side[2]):
				var p := im.get_pixel(x, y); var l := p.r*0.3 + p.g*0.59 + p.b*0.11
				if l < 0.16: sx += x; sy += y; c += 1
		var px := Vector2(sx/c, sy/c)
		var from := cam.project_ray_origin(px); var dir := cam.project_ray_normal(px)
		var hit := {}; var best := 1e9
		for t in tris:
			var q = Geometry3D.ray_intersects_triangle(from, dir, t[0], t[1], t[2])
			if q != null and (q - from).length() < best: best = (q - from).length(); hit = {"position": q, "normal": (t[1] - t[0]).cross(t[2] - t[0]).normalized()}
		if hit and (hit.normal as Vector3).dot(dir) > 0: hit.normal = -hit.normal
		var head_inv := (sk.global_transform*sk.get_bone_global_pose(hi)).affine_inverse()
		print(side[0], " px=", px, " dark=", c, " hit=", hit.get("position"), " normal=", hit.get("normal"))
		if hit: res[side[0]] = {"local": head_inv*(hit.position as Vector3), "normal": (head_inv.basis*(hit.normal as Vector3)).normalized(), "px": [px.x, px.y]}
		# the eye's colours: the white beside the iris, the iris
		var white := im.get_pixel(int(px.x + (40 if side[0] == "L" else -40)), int(px.y)); var iris := im.get_pixel(int(px.x + 14), int(px.y))
		print(side[0], " white=", white.to_html(false), " iris-ish=", iris.to_html(false))
	var f := FileAccess.open(out + "/eyes.json", FileAccess.WRITE)
	var J := {}
	for k in res: J[k] = {"local": [res[k].local.x, res[k].local.y, res[k].local.z], "normal": [res[k].normal.x, res[k].normal.y, res[k].normal.z]}
	f.store_string(JSON.stringify(J)); f.close()
	print("scale ", sk.global_transform.basis.get_scale())
	quit()
