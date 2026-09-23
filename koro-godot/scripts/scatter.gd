## SAKURA AND BAMBOO — hundreds of them, for almost nothing.
##
## In the browser these were one enormous batch each, always drawn, even the
## ones on the far side of the planet: 1.7 million triangles every frame,
## twice with shadows. Here they are MultiMeshes split into CHUNKS by where
## they stand, so the camera only draws the chunks it can see, and each
## chunk stops drawing altogether past a set distance. Shadows come only
## from trees near the camera (the sun's shadow distance handles that).
class_name Scatter
extends RefCounted

static func grow(parent: Node3D, path: String, spots: Array, lo: float, hi: float, xz: float,
		far := 320.0) -> void:
	var src := Models.first_mesh(path)
	if src.is_empty():
		return
	var mesh: Mesh = src.mesh
	var inner: Transform3D = src.xf
	var ab := inner * mesh.get_aabb()
	var base := 1.0 / maxf(0.001, ab.size.y)
	var lift := -ab.position.y            # stand it on its own feet
	var chunks := {}
	for d in spots:
		var dir: Vector3 = d
		# chunk = a 12-degree cell of longitude and latitude
		var lat := rad_to_deg(asin(clampf(dir.y, -1.0, 1.0)))
		var lon := rad_to_deg(atan2(dir.x, dir.z))
		var key := Vector2i(floori(lon / 12.0), floori(lat / 12.0))
		if not chunks.has(key):
			chunks[key] = []
		chunks[key].append(dir)
	for key in chunks:
		var list: Array = chunks[key]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = list.size()
		for i in list.size():
			var dir: Vector3 = list[i]
			var h := randf_range(lo, hi) * base
			var w := h * randf_range(xz, xz + 0.25)
			var b := Planet.frame_at(dir, randf() * TAU)
			var s := Basis(b.x * w, b.y * h, b.z * w)
			var at := dir * (Planet.R + Planet.height(dir) - 0.15)
			mm.set_instance_transform(i, Transform3D(s, at) * inner.translated(Vector3(0, lift, 0)))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.visibility_range_end = far
		mmi.visibility_range_end_margin = 20.0
		parent.add_child(mmi)

## Spots in groves round a centre, keeping clear of the buildings.
static func groves(center: Vector3, count: int, per: Vector2i, spread: float, radius: float) -> Array:
	var out := []
	var f := Planet.frame_at(center)
	for g in count:
		var a := randf() * TAU
		var r := randf_range(35.0, spread)
		var heading := (f.x * cos(a) + f.z * sin(a)).normalized()
		var c := Planet.walk(center, heading, r)
		var cf := Planet.frame_at(c)
		for j in randi_range(per.x, per.y):
			var aa := randf() * TAU
			var rr := sqrt(randf()) * radius
			var d := Planet.walk(c, (cf.x * cos(aa) + cf.z * sin(aa)).normalized(), rr)
			if Planet.pad_k(d) > 0.6:
				out.append(d)
	return out

static func anywhere(count: int, center: Vector3, spread: float) -> Array:
	var out := []
	var f := Planet.frame_at(center)
	while out.size() < count:
		var a := randf() * TAU
		var d := Planet.walk(center, (f.x * cos(a) + f.z * sin(a)).normalized(), randf_range(30.0, spread))
		if Planet.pad_k(d) > 0.6:
			out.append(d)
	return out
