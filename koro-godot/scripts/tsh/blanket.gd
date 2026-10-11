## A BLANKET, NOT A BLOCK (tsh.js blanketOn). A cloth over her as she lies: a height field over the bed, the highest
## point of her body (and what she wears) under each point of it and the cloth falling away from there, softened, its
## edges turned down — stopping at her shoulders. Read off her pose (her skinned vertices, skinned here on the CPU)
## each time she is laid down, so it lies on her, not through her or on top of her like a box.
class_name Blanket
extends MeshInstance3D

static var _quilt: ImageTexture
static var _arrays := {}               # mesh → [verts, bones, weights, per-vertex count], read once

func _init() -> void:
	var m := StandardMaterial3D.new(); m.albedo_texture = _tex(); m.roughness = 0.95; m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.texture_repeat = true; material_override = m; visible = false

## the quilt: blue, flecked, stitched in a diamond
static func _tex() -> ImageTexture:
	if _quilt: return _quilt
	var im := Image.create(256, 256, false, Image.FORMAT_RGBA8); im.fill(Color("#4c5f82"))
	var blend := func(x: int, y: int, c: Color):
		x = posmod(x, 256); y = posmod(y, 256); im.set_pixel(x, y, im.get_pixel(x, y).blend(c))
	for i in 3000:
		var c := Color8(20, 26, 40, 20) if randf() < 0.5 else Color8(140, 160, 200, 20)
		var x := randi() % 256; var y := randi() % 256
		for dy in 2:
			for dx in 2: blend.call(x + dx, y + dy, c)
	var st := Color(28/255.0, 36/255.0, 58/255.0, 0.55)
	for k in range(-256, 512, 64):
		for s in 2:
			for t in 256:
				if t % 9 >= 5: continue                         # dashed: 5 on, 4 off
				var x: int = k + t if s == 0 else k + 256 - t
				if x < 0 or x >= 256: continue
				blend.call(x, t, st); blend.call(x + 1, t, st)
	_quilt = ImageTexture.create_from_image(im); return _quilt

## lays it over her, on a bed whose mattress is at `top`; body: her model (the skinned meshes under it)
func fit(body: Node3D, top: float) -> void:
	var sk := _skel(body)
	var hd := Vector3.INF
	if sk:
		var hi := -1
		for i in sk.get_bone_count():
			if sk.get_bone_name(i).ends_with("Head"): hi = i; break
		if hi >= 0: hd = sk.global_transform*sk.get_bone_global_pose(hi).origin
	var pts := PackedVector3Array()
	for mi: MeshInstance3D in _meshes(body):
		var msk: Skeleton3D = mi.get_node_or_null(mi.skeleton) as Skeleton3D
		if msk == null or mi.skin == null: continue
		var poses := []
		for b in mi.skin.get_bind_count():
			var bi := mi.skin.get_bind_bone(b)
			if bi < 0: bi = msk.find_bone(mi.skin.get_bind_name(b))
			poses.append(msk.global_transform*(msk.get_bone_global_pose(bi) if bi >= 0 else Transform3D.IDENTITY)*mi.skin.get_bind_pose(b))
		for s in mi.mesh.get_surface_count():
			var A: Array = _surface(mi.mesh, s)
			var V: PackedVector3Array = A[0]; var B: PackedInt32Array = A[1]; var W: PackedFloat32Array = A[2]; var n: int = A[3]
			if V.is_empty() or B.is_empty(): continue
			var step := maxi(1, V.size()/14000)
			for i in range(0, V.size(), step):
				var p := Vector3.ZERO
				for j in n:
					var w := W[i*n + j]
					if w > 0.0: p += (poses[B[i*n + j]] as Transform3D)*V[i]*w
				if hd == Vector3.INF or p.distance_to(hd) > 0.3: pts.append(p)
	if pts.is_empty(): return
	var x0 := 1e9; var x1 := -1e9; var z0 := 1e9; var z1 := -1e9
	for p in pts: x0 = minf(x0, p.x); x1 = maxf(x1, p.x); z0 = minf(z0, p.z); z1 = maxf(z1, p.z)
	# her length runs along the longer side; the cloth stops just short of her head at that end and runs past her feet
	var along_x := x1 - x0 > z1 - z0; var mid := (x0 + x1)/2 if along_x else (z0 + z1)/2
	var head_end := 1 if hd != Vector3.INF and (hd.x if along_x else hd.z) > mid else -1
	var side := 0.3; var foot := 0.18; var near_head := -0.04
	if along_x:
		if head_end > 0: x1 += near_head; x0 -= foot
		else: x0 -= near_head; x1 += foot
		z0 -= side; z1 += side
	else:
		if head_end > 0: z1 += near_head; z0 -= foot
		else: z0 -= near_head; z1 += foot
		x0 -= side; x1 += side
	const NX := 44; const NZ := 34
	var dx := (x1 - x0)/(NX - 1); var dz := (z1 - z0)/(NZ - 1); var base := top + 0.012
	var hb := PackedFloat32Array(); hb.resize(NX*NZ); hb.fill(-1e9)
	for p in pts:
		var a := roundi((p.x - x0)/dx); var b := roundi((p.z - z0)/dz)
		if a >= 0 and b >= 0 and a < NX and b < NZ: hb[b*NX + a] = maxf(hb[b*NX + a], p.y + 0.035)
	# the cloth tents from each high point and falls away at about the slope a sheet does
	const R := 7
	var H := PackedFloat32Array(); H.resize(NX*NZ)
	for b in NZ:
		for a in NX:
			var h := base
			for j in range(-R, R + 1):
				var bb := b + j
				if bb < 0 or bb >= NZ: continue
				for i in range(-R, R + 1):
					var aa := a + i
					if aa < 0 or aa >= NX: continue
					var hv := hb[bb*NX + aa]
					if hv < -1e8: continue
					h = maxf(h, hv - sqrt(i*dx*i*dx + j*dz*j*dz)*0.95)
			H[b*NX + a] = h
	var tent := H.duplicate()
	for pass_ in 3:
		var C := H.duplicate()
		for b in range(1, NZ - 1):
			for a in range(1, NX - 1):
				var s := 0.0
				for j in range(-1, 2):
					for i in range(-1, 2): s += C[(b + j)*NX + a + i]
				H[b*NX + a] = maxf(base, s/9.0)
	# softened, but never through her: never below the tent itself
	for k in H.size(): H[k] = maxf(H[k], tent[k] - 0.004)
	# its edges turned down over the mattress
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var inv := get_parent_node_3d().global_transform.affine_inverse() if get_parent_node_3d() else Transform3D.IDENTITY
	for b in NZ:
		for a in NX:
			var e := mini(mini(a, b), mini(NX - 1 - a, NZ - 1 - b))*minf(dx, dz); var drop := (0.07 - e)*1.4 if e < 0.07 else 0.0
			var x := x0 + a*dx; var z := z0 + b*dz
			st.set_uv(Vector2((x - x0)*1.6, (z - z0)*1.6)); st.add_vertex(inv*Vector3(x, H[b*NX + a] - drop, z))
	for b in NZ - 1:
		for a in NX - 1:
			var i := b*NX + a
			for v in [i, i + 1, i + NX, i + 1, i + NX + 1, i + NX]: st.add_index(v)
	st.generate_normals()
	mesh = st.commit(); transform = Transform3D.IDENTITY

static func _skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D: return n
	for c in n.get_children():
		var r := _skel(c)
		if r: return r
	return null
static func _meshes(n: Node, out: Array = []) -> Array:
	if n is MeshInstance3D and (n as MeshInstance3D).is_visible_in_tree() and (n as MeshInstance3D).skin != null: out.append(n)
	for c in n.get_children(): _meshes(c, out)
	return out
static func _surface(m: Mesh, s: int) -> Array:
	var key := "%d:%d" % [m.get_instance_id(), s]
	if _arrays.has(key): return _arrays[key]
	var a := m.surface_get_arrays(s)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES] if a[Mesh.ARRAY_BONES] != null else PackedInt32Array()
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS] if a[Mesh.ARRAY_WEIGHTS] != null else PackedFloat32Array()
	var r := [V, B, W, B.size()/V.size() if V.size() > 0 else 4]
	_arrays[key] = r; return r
