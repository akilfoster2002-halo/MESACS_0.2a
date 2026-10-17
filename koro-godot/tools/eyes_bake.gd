## Her face's texture with the painted irises covered — the white of each eye painted over them, in the texture itself
## (where the moving irises go, nothing then needs to sit under them). Uses eyes.json (tools/eyes_locate.gd).
##   godot --headless --path koro-godot -s res://tools/eyes_bake.gd [-- model.glb dir]   → <dir>/skin.png (Robin: assets/tsh/eyes)
extends SceneTree
const WHITE := Vector2(0.022, 0.0153)
func _init() -> void:
	var A := OS.get_cmdline_user_args()
	var model: String = A[0] if A.size() > 0 else "res://assets/tsh/robin.glb"; var dir: String = A[1] if A.size() > 1 else "res://assets/tsh/eyes"
	var n: Node3D = (load(model) as PackedScene).instantiate(); root.add_child(n)
	var sk: Skeleton3D; var body: MeshInstance3D; var st: Array = [n]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x is AnimationPlayer: (x as AnimationPlayer).stop()
		if x.name in ["char1", "KaiBody"]: body = x
	sk.reset_bone_poses()
	await process_frame
	var head := sk.global_transform*sk.get_bone_global_pose((sk.find_bone("mixamorigHead") if sk.find_bone("mixamorigHead") >= 0 else sk.find_bone("mixamorig_Head")))
	var J = JSON.parse_string(FileAccess.get_file_as_string(dir + "/eyes.json"))
	var WH: Vector2 = WHITE*float(J.get("size", 1.0))          # (smaller eyes than Robin's: "size" in eyes.json)
	var eyes := []
	for k in ["R", "L"]:
		var at: Vector3 = head*Vector3(J[k].local[0], J[k].local[1], J[k].local[2])
		var nn: Vector3 = (head.basis*Vector3(J[k].normal[0], J[k].normal[1], J[k].normal[2])).normalized()
		var x := Vector3.UP.cross(nn).normalized(); var z := x.cross(nn).normalized()
		eyes.append([at, x, z, nn])
	var arr := body.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]; var UV: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV]
	var B: PackedInt32Array = arr[Mesh.ARRAY_BONES]; var Wt: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]; var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var nb := B.size()/V.size(); var poses := []
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
	var mat: StandardMaterial3D = body.get_active_material(0)
	var im: Image = mat.albedo_texture.get_image(); if im.is_compressed(): im.decompress()
	im.convert(Image.FORMAT_RGBA8)
	var S := Vector2(im.get_width(), im.get_height()); var painted := 0
	var shut: Image = im.duplicate()                         # and her eyes shut: the eye painted over in her lid's own skin, a lash line low across it
	var ring := [Color(0, 0, 0, 0), Color(0, 0, 0, 0)]
	for pass_ in 2:
		for t in range(0, I.size(), 3):
			var ia := I[t]; var ib := I[t + 1]; var ic := I[t + 2]
			for e in eyes:
				if P[ia].distance_to(e[0]) > 0.03: continue
				var a := UV[ia]*S; var b := UV[ib]*S; var c := UV[ic]*S
				var lo := Vector2i(floori(minf(a.x, minf(b.x, c.x))), floori(minf(a.y, minf(b.y, c.y)))); var hi := Vector2i(ceili(maxf(a.x, maxf(b.x, c.x))), ceili(maxf(a.y, maxf(b.y, c.y))))
				var den := (b.y - c.y)*(a.x - c.x) + (c.x - b.x)*(a.y - c.y)
				if absf(den) < 1e-9: continue
				for py in range(lo.y, hi.y + 1):
					for px in range(lo.x, hi.x + 1):
						var p := Vector2(px + 0.5, py + 0.5)
						var l1 := ((b.y - c.y)*(p.x - c.x) + (c.x - b.x)*(p.y - c.y))/den; var l2 := ((c.y - a.y)*(p.x - c.x) + (a.x - c.x)*(p.y - c.y))/den; var l3 := 1 - l1 - l2
						if l1 < -0.02 or l2 < -0.02 or l3 < -0.02: continue
						var w3: Vector3 = P[ia]*l1 + P[ib]*l2 + P[ic]*l3 - e[0]
						var u: float = w3.dot(e[1])/(WH.x/2); var v: float = w3.dot(e[2])/(WH.y/2)
						var r := sqrt(u*u + v*v); var al := clampf((1.0 - r)/0.14, 0, 1)
						var ei: int = eyes.find(e)
						if pass_ == 0:                                       # the skin round the eye (the lid's colour), averaged
							if r > 1.7 and r < 2.3 and px >= 0 and py >= 0 and px < int(S.x) and py < int(S.y):
								var c0 := im.get_pixel(px, py)
								if c0.get_luminance() > 0.22 and c0.get_luminance() < 0.6: ring[ei] += Color(c0.r, c0.g, c0.b, 1)
							continue
						if r > 1.7 or px < 0 or py < 0 or px >= int(S.x) or py >= int(S.y): continue
						var lid: Color = ring[ei]/maxf(ring[ei].a, 1.0); lid.a = 1.0
						var al2 := clampf((1.65 - r)/0.35, 0, 1)
						var sc := shut.get_pixel(px, py).lerp(lid*(0.88 + 0.1*clampf(1.0 - absf(v), 0, 1)), al2)
						var curve := 0.18 - 0.25*u*u                        # the shut lids' line: a shallow smile across the eye
						var lash := clampf(1.0 - absf(v - curve)/0.2, 0, 1)*clampf((1.35 - absf(u))/0.3, 0, 1)
						shut.set_pixel(px, py, sc.lerp(Color(0.05, 0.035, 0.035), clampf(lash*1.3, 0, 1)*al2))
						if al <= 0: continue
						var shade := 0.82 + 0.18*clampf((v + 1.0)/2.0, 0, 1)
						var wc := Color(0.86*shade, 0.80*shade, 0.78*shade)
						im.set_pixel(px, py, im.get_pixel(px, py).lerp(wc, al)); painted += 1
	im.save_png(dir + "/skin.png"); shut.save_png(dir + "/skin_shut.png")
	print("painted ", painted)
	quit()
