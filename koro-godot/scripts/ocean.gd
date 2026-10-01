## THE OCEAN ON WANO — ported from the browser's public/ocean.js, so the sea
## is the same sea in both: east of the town at lon 80, lat 2, 240 m across
## the middle; a beach, a reef shelf, THE WALL where the shelf drops thirty
## metres, the deep plain at forty, five canyons cut back into the shelf and
## the rift across the deep, eighty metres down.
##
## IT IS PART OF THE GROUND, not a room behind a door: Planet.height() asks
## cut() for every point inside the circle, so the hills, your feet, the
## trees that stay out of water and the ground mesh all agree where the beach
## is. The ball's own triangles over the sea are left out of its mesh
## (keep_face) and a finer seabed is laid in their place; the water is one
## surface at one altitude round the curve of the ball. world.water_at()
## asks water_at() here, so wading and swimming are the walker's own.
##
## THE MAP: everything is laid out in flat metres (x, z) round the middle of
## the sea and stood onto the ball through to_dir(): distance from the middle
## becomes an angle round the planet.
class_name Ocean
extends Node3D

const LON := 80.0
const LAT := 2.0
const R := 240.0
const GRID := 2.0                 # metres a cell of the depth grid

static var on := false
static var C := Vector3.FORWARD
static var RT := Vector3.RIGHT
static var FT := Vector3.UP
static var cos_r := 1.0
static var town := Vector2(-1, 0)
static var SEA := -6.0
static var rim := 0.0
static var DC := Vector2.ZERO
static var RD := 0.42 * R
static var canyons: Array = []
static var rift: Array = []
static var zones := {}
static var _boxes: Array[Rect2] = []
static var _g := PackedFloat32Array()
static var _n := 0
static var _o := 0.0

# ------------------------------------------------------------------ setup
## On the hub only, before the ground is built (like Islands.dig).
static func setup() -> void:
	on = false
	C = Planet.dir_of(LON, LAT).normalized()
	var f := Planet.frame_at(C)
	RT = f.x.normalized()
	FT = f.z.normalized()
	cos_r = cos(R / Planet.R)
	var t := to_map(Planet.dir_of(0, 0))
	town = Vector2(t.x, t.y).normalized()
	# THE WATERLINE STANDS ON THE LOWEST POINT OF THE RIM, as the pool's does:
	# water poured into a bowl runs out of its low side
	var lo := INF
	for i in 64:
		var a := i / 64.0 * TAU
		var d := to_dir(cos(a) * R, sin(a) * R)
		lo = minf(lo, Planet.raw_height(d) * Planet.pad_k(d))
	rim = lo
	SEA = rim - 0.8
	_plan()
	_grid()
	on = true

# ------------------------------------------------------------------ the map
static func to_map(dir: Vector3) -> Vector3:     # (x, z, r)
	var d := dir.normalized()
	var a := acos(clampf(d.dot(C), -1.0, 1.0))
	var px := d.dot(RT)
	var pz := d.dot(FT)
	var n := sqrt(px * px + pz * pz)
	if n < 1e-9:
		return Vector3.ZERO
	var r := a * Planet.R
	return Vector3(px / n * r, pz / n * r, r)

static func to_dir(x: float, z: float) -> Vector3:
	var r := sqrt(x * x + z * z)
	if r < 1e-9:
		return C
	var a := r / Planet.R
	var s := sin(a) / r
	return (C * cos(a) + (RT * x + FT * z) * s).normalized()

static func to_world(x: float, y: float, z: float) -> Vector3:
	return to_dir(x, z) * (Planet.R + y)

# ------------------------------------------------------------------ the shape
static func _imul(a: int, b: int) -> int:
	return (a * b) & 0xFFFFFFFF

static func _hash(i: int, j: int) -> float:
	var h := (_imul(i & 0xFFFFFFFF, 374761393) + _imul(j & 0xFFFFFFFF, 668265263) + 1013904223) & 0xFFFFFFFF
	h = _imul(h ^ (h >> 13), 1274126177)
	return float((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967295.0

static func noise(x: float, z: float) -> float:
	var xi := floori(x)
	var zi := floori(z)
	var xf := x - xi
	var zf := z - zi
	var u := xf * xf * (3.0 - 2.0 * xf)
	var v := zf * zf * (3.0 - 2.0 * zf)
	return lerpf(lerpf(_hash(xi, zi), _hash(xi + 1, zi), u), lerpf(_hash(xi, zi + 1), _hash(xi + 1, zi + 1), u), v)

static var _rng := 1
static func _rand() -> float:
	_rng = (_rng * 1664525 + 1013904223) & 0xFFFFFFFF
	return _rng / 4294967296.0

static func _smooth(e0: float, e1: float, x: float) -> float:
	var t := clampf((x - e0) / (e1 - e0), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)

## The waterline is not a circle: it wanders in and out by a fifth.
static func shore_r(th: float) -> float:
	return R * (0.8 + 0.05 * sin(3.0 * th + 1.0) + 0.035 * sin(5.0 * th + 2.3) + 0.015 * sin(11.0 * th))

static func deep_r(th: float) -> float:
	return RD * (1.0 + 0.12 * sin(4.0 * th + 0.5) + 0.05 * sin(9.0 * th + 2.0))

static func _plan() -> void:
	_rng = 20260927
	DC = -town * 0.2 * R
	canyons = []
	_boxes.clear()
	# where the shelf is wide enough to cut into: five canyons where the run
	# from the deep to the beach is longest, spread round
	var cand: Array = []
	for i in 72:
		var th := i / 72.0 * TAU
		var ux := cos(th)
		var uz := sin(th)
		var r0 := deep_r(th) * 0.85
		var r := r0
		while r < R * 1.4:
			var p := DC + Vector2(ux, uz) * r
			if p.length() / shore_r(atan2(p.y, p.x)) > 0.84:
				break
			r += 1.0
		cand.append({"th": th, "r0": r0, "r1": r, "run": r - deep_r(th) * 1.1})
	cand.sort_custom(func(a, b): return a.run > b.run)
	var picked: Array = []
	for c in cand:
		if picked.size() >= 5 or c.run < 14.0:
			break
		var ok := true
		for p in picked:
			if absf(angle_difference(p.th, c.th)) <= 0.8:
				ok = false
		if ok:
			picked.append(c)
	for c in picked:
		var th: float = c.th + (_rand() - 0.5) * 0.1
		var u := Vector2(cos(th), sin(th))
		var px := Vector2(-u.y, u.x)
		var pts: Array = []
		var wig := 4.0 + _rand() * 5.0
		var ph := _rand() * 6.0
		for i in 17:
			var t := i / 16.0
			var r := lerpf(c.r0, c.r1, t)
			var side := sin(t * PI * 1.6 + ph) * wig * sin(t * PI)
			var p := DC + u * r + px * side
			pts.append({"x": p.x, "z": p.y, "d": lerpf(46.0, 9.0, pow(t, 0.75)), "w": lerpf(9.0, 5.0, t)})
		canyons.append(pts)
	# the rift: across the deep plain, square to the way the town is
	var ax := Vector2(-town.y, town.x)
	rift = []
	for i in 19:
		var t := i / 18.0
		var s := lerpf(-0.9, 0.9, t) * RD
		var side := sin(t * PI * 2.2 + 1.0) * 7.0
		var p := DC + ax * s + town * side
		rift.append({"x": p.x, "z": p.y, "d": 78.0 + 6.0 * sin(t * PI), "w": 8.0})
	# a box round each line, so a point far from it is not measured against every segment
	for line in canyons + [rift]:
		var bx := Rect2(Vector2(line[0].x, line[0].z), Vector2.ZERO)
		for p in line:
			bx = bx.expand(Vector2(p.x, p.z))
		var pad: float = line[0].w * 1.6
		_boxes.append(bx.grow(pad))
	var kp := town * 0.5 * R
	zones = {
		"kelp": {"x": kp.x + town.y * 18.0, "z": kp.y - town.x * 18.0, "r": 26.0},
		"reef": {"x": town.x * 0.56 * R - town.y * 30.0, "z": town.y * 0.56 * R + town.x * 30.0, "r": 34.0},
		"deep": {"x": DC.x, "z": DC.y, "r": RD * 0.8},
	}

static func _near_line(line: Array, x: float, z: float) -> Dictionary:
	var best := {}
	for i in line.size() - 1:
		var a: Dictionary = line[i]
		var c: Dictionary = line[i + 1]
		var ex: float = c.x - a.x
		var ez: float = c.z - a.z
		var l2 := ex * ex + ez * ez
		if l2 == 0.0:
			l2 = 1.0
		var t := clampf(((x - a.x) * ex + (z - a.z) * ez) / l2, 0.0, 1.0)
		var dx: float = x - (a.x + ex * t)
		var dz: float = z - (a.z + ez * t)
		var d := sqrt(dx * dx + dz * dz)
		if best.is_empty() or d < best.dist:
			best = {"dist": d, "d": lerpf(a.d, c.d, t), "w": lerpf(a.w, c.w, t)}
	return best

## DEPTH BELOW THE SURFACE at a map point: negative is land above it.
static func depth_at(x: float, z: float) -> float:
	var r := sqrt(x * x + z * z)
	var sr := shore_r(atan2(z, x))
	var s := r / sr
	if s >= 1.0:
		return -0.35 - (r - sr) * 0.04
	var D := 2.2 * _smooth(1.0, 0.9, s) if s > 0.9 else 2.2 + 9.0 * _smooth(0.9, 0.52, s)
	D += (noise(x / 5.0, z / 5.0) - 0.5) * 0.5
	var reef := maxf(0.0, noise(x / 15.0 + 7.0, z / 15.0 + 3.0) - 0.52) * 2.1
	D -= 5.5 * reef * _smooth(0.95, 0.8, s) * _smooth(0.45, 0.6, s)
	var dd := Vector2(x, z) - DC
	var dr := deep_r(atan2(dd.y, dd.x))
	var m := _smooth(dr * 1.1, dr * 0.9, dd.length())
	var deep := 38.0 + 7.0 * noise(x / 40.0 + 11.0, z / 40.0) + 3.0 * noise(x / 9.0, z / 9.0 + 5.0)
	D = lerpf(D, deep, m)
	var lines: Array = canyons + [rift]
	for li in lines.size():
		if not _boxes[li].has_point(Vector2(x, z)):
			continue
		var line: Array = lines[li]
		var n := _near_line(line, x, z)
		if n.is_empty():
			continue
		var u: float = n.dist / n.w
		if u >= 1.4:
			continue
		var fl: float = n.d + 2.0 * noise(x / 6.0, z / 6.0)
		D = maxf(D, lerpf(fl, D, _smooth(0.5, 1.4, u)))
	return D if s > 0.97 else maxf(D, 0.8)

static func _grid() -> void:
	_n = ceili(R * 2.0 / GRID) + 3
	_o = -R - GRID
	_g.resize(_n * _n)
	for j in _n:
		for i in _n:
			_g[j * _n + i] = depth_at(_o + i * GRID, _o + j * GRID)

static func depth(x: float, z: float) -> float:
	var fx := (x - _o) / GRID
	var fz := (z - _o) / GRID
	var i := floori(fx)
	var j := floori(fz)
	if i < 0 or j < 0 or i >= _n - 1 or j >= _n - 1:
		return depth_at(x, z)
	var u := fx - i
	var v := fz - j
	return lerpf(lerpf(_g[j * _n + i], _g[j * _n + i + 1], u), lerpf(_g[(j + 1) * _n + i], _g[(j + 1) * _n + i + 1], u), v)

static func bed(x: float, z: float) -> float:
	return SEA - depth(x, z)

# ------------------------------------------------------------------ for Planet
## THE GROUND under and round the sea. Outside the circle it is untouched;
## inside, the land is eased down to the beach and the beach into the seabed.
static func cut(dir: Vector3, h: float) -> float:
	if not on or dir.dot(C) <= cos_r:
		return h
	var m := to_map(dir)
	var sr := shore_r(atan2(m.y, m.x))
	if m.z > sr:
		var t := _smooth(sr, R, m.z)
		return lerpf(SEA + 0.35 + (m.z - sr) * 0.03, maxf(h, SEA + 0.3), t)
	return bed(m.x, m.y)

## The surface, if this spot is sea; NAN anywhere else.
static func water_at(dir: Vector3) -> float:
	if not on or dir.dot(C) <= cos_r:
		return NAN
	var m := to_map(dir)
	return SEA if depth(m.x, m.y) > 0.05 else NAN

## How far out from the middle, as a share of the circle (99 well outside).
static func inside(dir: Vector3) -> float:
	if not on or dir.dot(C) <= cos_r * 0.98:
		return 99.0
	return to_map(dir).z / R

## The ball's own triangles over the sea go: the seabed takes their place.
static func keep_face(a: Vector3, b: Vector3, c: Vector3) -> bool:
	return not (inside(a) < 0.985 and inside(b) < 0.985 and inside(c) < 0.985)

# ------------------------------------------------------------------ the meshes
const SEABED_SHADER := """
shader_type spatial;
render_mode cull_disabled;
uniform float sea_r;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	ALBEDO = COLOR.rgb;
	ROUGHNESS = 0.92;
	// CAUSTICS: the rippling net of light under shallow water, strongest just
	// under the surface and gone by twenty metres
	float dpt = sea_r - length(wp);
	if (dpt > 0.0) {
		vec3 q = wp * 0.55;
		float cs = sin(q.x + TIME*0.9 + sin(q.z*1.3 + TIME*0.6)) * sin(q.z*1.1 - TIME*0.7 + sin(q.y*1.2 + TIME*0.5))
		         + 0.6*sin((q.x+q.y+q.z)*0.9 + TIME*1.1);
		cs = pow(clamp(cs*0.5+0.5, 0.0, 1.0), 4.0);
		EMISSION = vec3(0.55, 0.85, 1.0) * cs * 0.9 * exp(-dpt/10.0) * COLOR.rgb;
	}
}
"""

const SURFACE_SHADER := """
shader_type spatial;
render_mode cull_disabled, depth_draw_never;
void vertex() {
	vec3 p = VERTEX * 0.35;
	float sw = sin(p.x + TIME*1.1)*0.18 + sin(p.z*1.3 - TIME*0.9)*0.14 + sin((p.x+p.y)*0.7 + TIME*0.6)*0.1;
	VERTEX += normalize(VERTEX) * sw;
}
void fragment() {
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 q = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz * 0.5;
	// ripples, worked out rather than sampled: a few crossed waves bend the normal
	vec3 rip = vec3(sin(q.x*1.7 + TIME*1.4) + sin(q.z*2.3 - TIME*1.1), 0.0, cos(q.z*1.9 + TIME*1.2) + cos(q.x*2.1 - TIME*0.8)) * 0.06;
	NORMAL = normalize((VIEW_MATRIX * vec4(normalize(wn + rip), 0.0)).xyz);
	ALBEDO = COLOR.rgb;
	ALPHA = COLOR.a;
	ROUGHNESS = 0.22;
	METALLIC = 0.05;
	SPECULAR = 0.25;      // a bright golden sky off every ripple turned the open water milky
	EMISSION = vec3(0.024, 0.19, 0.235) * 0.6;
}
"""

## UNDER THE SURFACE the world goes blue and close: the fog turns the colour
## of deep water and thickens, and comes back as it was when you surface.
var _env: Environment
var _was := {}
func _process(_dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	if _env == null:
		var we := get_tree().root.find_children("*", "WorldEnvironment", true, false)
		if we.is_empty():
			return
		_env = (we[0] as WorldEnvironment).environment
	var p := cam.global_position
	var under := not is_nan(water_at(p.normalized())) and p.length() < Planet.R + SEA
	if under and _was.is_empty():
		_was = {"c": _env.fog_light_color, "d": _env.fog_density, "s": _env.fog_sky_affect}
		_env.fog_light_color = Color("0d3f78").srgb_to_linear().lerp(Color("1f8fb8").srgb_to_linear(), 0.35)
		_env.fog_sky_affect = 1.0
	if under:
		var depth_now := Planet.R + SEA - p.length()
		_env.fog_density = 0.035 + depth_now * 0.0012
	elif not _was.is_empty():
		_env.fog_light_color = _was.c
		_env.fog_density = _was.d
		_env.fog_sky_affect = _was.s
		_was = {}

func _ready() -> void:
	if not on:
		return
	_seabed()
	_surface()
	add_child(SeaLife.new())

static func _c(h: String) -> Color:
	return Color(h)

func _seabed() -> void:
	var RR := R + 6.0
	var S := 2.0
	var n := ceili(2.0 * RR / S) + 1
	var o := -RR
	var pos := PackedVector3Array()
	var col := PackedColorArray()
	var idx := PackedInt32Array()
	var id := PackedInt32Array()
	id.resize(n * n)
	id.fill(-1)
	var SAND := _c("#e6d3a3"); var WET := _c("#c9b484"); var REEF := _c("#b49a84")
	var ROCK := _c("#6a7482"); var DEEPC := _c("#3a4658"); var ABYSS := _c("#283244")
	var TINTS := [_c("#ff7aa8"), _c("#ffa24a"), _c("#b07aff"), _c("#4ad7c0"), _c("#ffd84a")]
	var grass: Color = Planet.SOIL[0]
	for j in n:
		for i in n:
			var x := o + i * S
			var z := o + j * S
			var r := sqrt(x * x + z * z)
			if r > RR:
				continue
			var u := r / R
			var dir := to_dir(x, z)
			var y := Planet.height(dir)
			if u > 0.93:
				y -= _smooth(0.93, 1.0, u) * 0.35        # tucked under the ball's own edge
			id[j * n + i] = pos.size()
			pos.append(dir * (Planet.R + y))
			var D := depth(x, z)
			var sl := absf(depth(x + 1, z) - depth(x - 1, z)) + absf(depth(x, z + 1) - depth(x, z - 1))
			var c: Color
			if D < 0.0:
				var up := _smooth(3.0, 14.0, r - shore_r(atan2(z, x)))
				c = SAND.lerp(grass, maxf(up, _smooth(0.95, 1.0, u)))
			elif D < 1.2:
				c = WET
			elif D < 13.0:
				c = SAND.lerp(REEF, clampf(noise(x / 15.0 + 7.0, z / 15.0 + 3.0) * 1.6 - 0.7, 0.0, 1.0))
			elif D < 45.0:
				c = DEEPC
			else:
				c = ABYSS
			if D > 1.0 and sl > 1.6:
				c = c.lerp(ROCK, clampf((sl - 1.6) / 3.0, 0.0, 0.85))
			if D > 1.5 and D < 13.0:
				var k := noise(x / 4.0, z / 4.0)
				if k > 0.72:
					c = c.lerp(TINTS[int(noise(x / 3.0 + 9.0, z / 3.0) * 5.0) % 5], (k - 0.72) * 2.4)
			# picked as screen colours; Godot draws in linear light, so convert or they wash out pale
			col.append((c * (0.9 + 0.2 * noise(x * 0.7, z * 0.7))).srgb_to_linear())
	for j in n - 1:
		for i in n - 1:
			var a := id[j * n + i]; var b := id[j * n + i + 1]
			var d := id[(j + 1) * n + i]; var e := id[(j + 1) * n + i + 1]
			if a < 0 or b < 0 or d < 0 or e < 0:
				continue
			idx.append_array([a, b, d, b, e, d])
	var mi := MeshInstance3D.new()
	mi.mesh = _mesh(pos, col, idx)
	var sh := Shader.new()
	sh.code = SEABED_SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("sea_r", Planet.R + SEA)
	mi.material_override = mat
	mi.name = "seabed"
	add_child(mi)

func _surface() -> void:
	var RR := R * 0.93
	var S := 3.0
	var n := ceili(2.0 * RR / S) + 1
	var o := -RR
	var pos := PackedVector3Array()
	var col := PackedColorArray()
	var idx := PackedInt32Array()
	var id := PackedInt32Array()
	id.resize(n * n)
	id.fill(-1)
	var wet: Array[bool] = []
	var SHALLOW := _c("#48d6c8"); var MID := _c("#1f8fb8"); var DEEPC := _c("#0d3f78"); var FOAM := _c("#e8fbff")
	for j in n:
		for i in n:
			var x := o + i * S
			var z := o + j * S
			if sqrt(x * x + z * z) > RR:
				continue
			var D := depth(x, z)
			id[j * n + i] = pos.size()
			wet.append(D > 0.0)
			pos.append(to_world(x, SEA, z))
			var c: Color
			var a: float
			if D < 0.7:
				c = FOAM.lerp(SHALLOW, clampf(D / 0.7, 0.0, 1.0)); a = 0.85
			elif D < 8.0:
				c = SHALLOW.lerp(MID, (D - 0.7) / 7.3); a = lerpf(0.5, 0.66, D / 8.0)
			else:
				c = MID.lerp(DEEPC, clampf((D - 8.0) / 30.0, 0.0, 1.0)); a = lerpf(0.66, 0.86, clampf((D - 8.0) / 30.0, 0.0, 1.0))
			c = c.srgb_to_linear()
			c.a = a
			col.append(c)
	for j in n - 1:
		for i in n - 1:
			var a := id[j * n + i]; var b := id[j * n + i + 1]
			var d := id[(j + 1) * n + i]; var e := id[(j + 1) * n + i + 1]
			if a < 0 or b < 0 or d < 0 or e < 0:
				continue
			if not (wet[a] or wet[b] or wet[d] or wet[e]):
				continue
			idx.append_array([a, b, d, b, e, d])
	var mi := MeshInstance3D.new()
	mi.mesh = _mesh(pos, col, idx, true)
	var sh := Shader.new()
	sh.code = SURFACE_SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.name = "sea"
	add_child(mi)

## A mesh whose normals point up out of the ball (or straight up, for the water).
func _mesh(pos: PackedVector3Array, col: PackedColorArray, idx: PackedInt32Array, radial := false) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = pos
	arrays[Mesh.ARRAY_COLOR] = col
	arrays[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var st := SurfaceTool.new()
	st.create_from(m, 0)
	st.generate_normals()
	var out := st.commit_to_arrays()
	var nrm: PackedVector3Array = out[Mesh.ARRAY_NORMAL]
	var p: PackedVector3Array = out[Mesh.ARRAY_VERTEX]
	for i in nrm.size():
		var up := p[i].normalized()
		nrm[i] = up if radial else (nrm[i] if nrm[i].dot(up) >= 0.0 else -nrm[i])
	out[Mesh.ARRAY_NORMAL] = nrm
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, out)
	return mesh
