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

const R := 320.0
const RELIEF := 9.5

## Where the buildings are, in the browser's own lon/lat, and how much level
## ground each wants round it.
const BUILDINGS := [
	{"id": "missions", "lon": 0.0, "lat": 7.0, "w": 64.0, "d": 46.0, "h": 18.0},
	{"id": "mechanic", "lon": -34.0, "lat": 6.0, "w": 40.0, "d": 28.0, "h": 14.0},
]

static var noise: FastNoiseLite = null

static func _noise() -> FastNoiseLite:
	if noise == null:
		noise = FastNoiseLite.new()
		noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
		noise.seed = 1
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
	return 0.0 if k <= 0.0 else raw_height(dir) * k

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
	var lush := Color(0.20, 0.42, 0.14)
	var dry := Color(0.36, 0.44, 0.17)
	var high := Color(0.42, 0.40, 0.32)
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
	mat.albedo_texture = load("res://assets/textures/grass_grain.jpg")
	mat.uv1_triplanar = true
	mat.uv1_world_triplanar = true
	mat.uv1_scale = Vector3(0.22, 0.22, 0.22)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	mat.roughness = 0.95
	out.surface_set_material(0, mat)
	return out
