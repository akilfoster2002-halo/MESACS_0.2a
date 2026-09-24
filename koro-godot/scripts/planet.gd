## THE PLANET — Wano, a ball you walk all the way around.
##
## Same numbers as the browser version (public/planet.js), so a place is the
## same place in both: a radius of 320 m, longitude/latitude for where things
## stand, the same hills (fbm noise, squared going up, flatter going down,
## 9.5 m of relief), and the ground levelled under every building.
##
## Everything that moves on it keeps a DIRECTION (a unit vector from the
## centre) and an ALTITUDE over the ground, never an x/y/z — so walking is a
## rotation of the direction, and "down" is always towards the middle.
class_name Planet
extends RefCounted

## Per world, set by use() before anything is built: how big the ball is,
## how much it heaves, the seed its hills grow from, what stands on it and
## the colour of its soil. They were constants while there was one planet.
static var R := 320.0
static var RELIEF := 9.5
static var SEED := 1
static var BUILDINGS: Array = Worlds.HUB.buildings
static var SOIL: Array = Worlds.HUB.soil
static var world: Dictionary = Worlds.HUB

## Stand on a world: its numbers, its buildings and its pad (a pad is a
## building with no walls, so the hills flatten under it the same way).
static func use(w: Dictionary) -> void:
	world = w
	R = w.radius
	RELIEF = w.relief
	SEED = w.seed
	SOIL = w.soil
	BUILDINGS = (w.buildings as Array).duplicate()
	if w.has("pad"):
		BUILDINGS.append({"id": "pad", "name": "THE PAD", "lon": w.pad.lon, "lat": w.pad.lat,
			"w": 18.0, "d": 18.0, "h": 0.0, "pad": true, "plate_visible": false})
	noise = null
	basins.clear()

static var noise: FastNoiseLite = null

## WHERE SOMETHING HAS DUG A HOLE — the plunge pool under the falls. The
## ground inside a basin is first eased down to the LOWEST height anywhere on
## its rim (a rim that follows the hillside is high on one side and low on
## the other, and water poured in runs straight out of the low side), then
## the bowl is dug out of that. Registered before the ground mesh is built,
## so the mesh, your feet and the trees all agree where the bank is.
static var basins: Array = []

static func add_basin(dir: Vector3, r: float, depth: float) -> void:
	var b := {"dir": dir.normalized(), "r": r, "depth": depth}
	var f := frame_at(b.dir)
	var lo := INF
	for i in 32:
		var a := i / 32.0 * TAU
		var d := walk(b.dir, (f.x * cos(a) + f.z * sin(a)).normalized(), r)
		lo = minf(lo, raw_height(d) * pad_k(d))
	b.rim = lo
	basins.append(b)

## What the water in a basin may stand at: its rim.
static func basin_rim(dir: Vector3) -> float:
	for b in basins:
		if dir.angle_to(b.dir) * R < b.r:
			return b.rim
	return NAN

static func _basin_cut(dir: Vector3, h: float) -> float:
	for b in basins:
		var off: float = dir.angle_to(b.dir) * R
		if off >= b.r:
			continue
		var u: float = off / b.r
		var s := 1.0 - u * u
		var blend := u * u * (3.0 - 2.0 * u)
		var base: float = b.rim + (h - b.rim) * blend
		h = minf(h, base - b.depth * s * s)
	return h

static func near_basin(dir: Vector3, k := 1.0) -> bool:
	for b in basins:
		if dir.angle_to(b.dir) * R < b.r * k:
			return true
	return false

static func _noise() -> FastNoiseLite:
	if noise == null:
		noise = FastNoiseLite.new()
		noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
		noise.seed = SEED
		noise.frequency = 1.0
		noise.fractal_type = FastNoiseLite.FRACTAL_FBM
		noise.fractal_octaves = 4
	return noise

static func dir_of(lon_deg: float, lat_deg: float) -> Vector3:
	var lo := deg_to_rad(lon_deg)
	var la := deg_to_rad(lat_deg)
	return Vector3(cos(la) * sin(lo), sin(la), cos(la) * cos(lo))

## A tangent frame at a direction: x right, y up (out of the ball), z forward.
static func frame_at(dir: Vector3, spin := 0.0) -> Basis:
	var up := dir.normalized()
	var ref := Vector3(0, 0, 1) if absf(up.y) > 0.94 else Vector3(0, 1, 0)
	var right := ref.cross(up).normalized()
	var fwd := up.cross(right).normalized()
	if spin != 0.0:
		fwd = fwd.rotated(up, spin)
	right = up.cross(fwd).normalized()
	return Basis(right, up, fwd)

## A basis standing on `up` and facing `fwd` (fwd is flattened onto the ground).
static func stand(up: Vector3, fwd: Vector3) -> Basis:
	var u := up.normalized()
	var f := (fwd - u * fwd.dot(u))
	if f.length_squared() < 1e-8:
		return frame_at(u)
	f = f.normalized()
	return Basis(u.cross(f).normalized(), u, f)

static func raw_height(dir: Vector3) -> float:
	var h := _noise().get_noise_3dv(dir * 5.5)
	return (h * h * 2.2 if h > 0.0 else h * 0.7) * RELIEF

## 0 on a building's plate, 1 out in the country, eased between.
static func pad_k(dir: Vector3) -> float:
	var k := 1.0
	for b in BUILDINGS:
		var d := dir.angle_to(dir_of(b.lon, b.lat)) * R
		var flat: float = sqrt(b.w * b.w + b.d * b.d) / 2.0 + 10.0
		if d <= flat:
			return 0.0
		if d < flat + 26.0:
			var t := (d - flat) / 26.0
			k = minf(k, t * t * (3.0 - 2.0 * t))
	return k

static func height(dir: Vector3) -> float:
	var k := pad_k(dir)
	var h := 0.0 if k <= 0.0 else raw_height(dir) * k
	return _basin_cut(dir, h) if basins.size() > 0 else h

## Walk `metres` from `dir` along the great circle towards `heading`.
static func walk(dir: Vector3, heading: Vector3, metres: float, radius := R) -> Vector3:
	var axis := dir.cross(heading)
	if axis.length_squared() < 1e-12:
		return dir
	return dir.rotated(axis.normalized(), metres / radius).normalized()

## The ground itself: an icosphere, subdivided until a face is a few metres
## across, pushed out by the hills and coloured by height.
static func build_mesh(level := 6) -> ArrayMesh:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var verts: Array[Vector3] = [
		Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0),
		Vector3(0, -1, t), Vector3(0, 1, t), Vector3(0, -1, -t), Vector3(0, 1, -t),
		Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1)]
	for i in verts.size():
		verts[i] = verts[i].normalized()
	var faces: Array = [
		[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
		[11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
		[3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
	for _l in level:
		var cache := {}
		var next: Array = []
		for f in faces:
			var m := []
			for e in [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]]:
				var key := Vector2i(mini(e[0], e[1]), maxi(e[0], e[1]))
				if not cache.has(key):
					verts.append(((verts[e[0]] + verts[e[1]]) * 0.5).normalized())
					cache[key] = verts.size() - 1
				m.append(cache[key])
			next.append([f[0], m[0], m[2]])
			next.append([f[1], m[1], m[0]])
			next.append([f[2], m[2], m[1]])
			next.append([m[0], m[1], m[2]])
		faces = next
	var pos := PackedVector3Array()
	var col := PackedColorArray()
	pos.resize(verts.size())
	col.resize(verts.size())
	var lush: Color = SOIL[0]
	var dry: Color = SOIL[1]
	var high: Color = SOIL[2]
	for i in verts.size():
		var d: Vector3 = verts[i]
		var h := height(d)
		pos[i] = d * (R + h)
		var n := _noise().get_noise_3dv(d * 23.0) * 0.5 + 0.5
		var c := lush.lerp(dry, clampf(n * 0.9, 0.0, 1.0))
		col[i] = c.lerp(high, clampf((h - 3.0) / 8.0, 0.0, 1.0))
	var idx := PackedInt32Array()
	idx.resize(faces.size() * 3)
	var k := 0
	for f in faces:
		idx[k] = f[0]; idx[k + 1] = f[2]; idx[k + 2] = f[1]
		k += 3
	var st := SurfaceTool.new()
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = pos
	arrays[Mesh.ARRAY_COLOR] = col
	arrays[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	st.create_from(mesh, 0)
	st.generate_normals()
	var out := st.commit()
	# the same grass the browser lays over its ground, projected from all
	# three axes (a sphere has no UVs worth the name) and tinted by height
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	# the soil colours are picked as screen colours; read as linear they
	# come out a pale mint
	mat.vertex_color_is_srgb = true
	mat.albedo_texture = load("res://assets/textures/grass_grain.jpg")
	mat.uv1_triplanar = true
	mat.uv1_world_triplanar = true
	mat.uv1_scale = Vector3(0.22, 0.22, 0.22)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	mat.roughness = 0.95
	out.surface_set_material(0, mat)
	return out
