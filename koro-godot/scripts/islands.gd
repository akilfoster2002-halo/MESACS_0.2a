## THE SKY ISLANDS — somewhere to fly TO — and the water that falls off one.
##
## Four islands hang over Wano inside the flight ceiling, exactly where the
## browser hangs them (islands.js). Each one is solid: a trimesh collider
## built from the rock you can see, so the same ray that finds the grass
## under your feet finds the deck of an island, and you land on it.
##
## THE FALLS pours off its rim toward a plunge pool dug into the planet
## below, and the pool drains into a river that finds its own way downhill.
## There is no other water on Wano, which is why the fish live there.
class_name Islands
extends Node3D

const ISLES := [
	{"id": "falls", "lon": 13.0, "lat": 16.0, "r": 34.0, "alt": 62.0, "spin": 0.35,
		"fall": true, "model": "res://assets/falls.glb", "yaw": PI, "centre": true},
	{"id": "garden", "lon": -16.0, "lat": 9.0, "r": 26.0, "alt": 78.0, "spin": -0.9,
		"model": "res://assets/garden.glb"},
	{"id": "spire", "lon": 24.0, "lat": -12.0, "r": 19.0, "alt": 95.0, "spin": 2.1, "trees": 2, "tall": true},
	{"id": "stone", "lon": -3.0, "lat": -9.0, "r": 11.0, "alt": 48.0, "spin": 1.2, "trees": 1},
]
const POOL_DEPTH := 8.0
const GRASS := [Color("4a7f3a"), Color("5b9147"), Color("6aa352")]
const ROCK := [Color("6b6152"), Color("574f43"), Color("463f36")]

var world: Node3D
var isles: Array = []
var pool := {}                 # the plunge pool: dir, r, surface
var fall_col := {}             # the column, in world space, for fall_push()
var fish: Array = []
var turtles: Array = []
var t := 0.0

## WHERE THE WATER LANDS, known before any water exists: the ground mesh is
## built first and has to be dug for the pool, and the pool's position falls
## out of the island's own longitude, spin and radius.
static func dig() -> void:
	for k in ISLES:
		if not k.get("fall", false):
			continue
		var d := Planet.dir_of(k.lon, k.lat)
		var f := Planet.frame_at(d, k.spin)
		var lip: Vector3 = d * (Planet.R + k.alt) + f.z * k.r * 0.80 - f.x * k.r * 0.10
		Planet.add_basin(lip.normalized(), k.r * 0.86, POOL_DEPTH)

func _ready() -> void:
	var i := 0
	for k in ISLES:
		var d := Planet.dir_of(k.lon, k.lat)
		var f := Planet.frame_at(d, k.spin)
		var g := Node3D.new()
		add_child(g)
		g.global_transform = Transform3D(f, d * (Planet.R + k.alt))
		var rec := {"k": k, "dir": d, "f": f, "g": g}
		if k.has("model"):
			_model(rec)
		else:
			_lathe(rec, i * 7 + 3)
		isles.append(rec)
		if k.get("fall", false):
			_pool(rec)
			_pour(rec)
		i += 1

# ------------------------------------------------------------ a modelled isle

func _model(rec: Dictionary) -> void:
	var k: Dictionary = rec.k
	var root := Models.spawn(k.model)
	# the stand-in transform the field is measured in: turned to face the way
	# the table says and, for a model with no grid of its own, centred
	var pre := Transform3D(Basis(Vector3.UP, k.get("yaw", 0.0)), Vector3.ZERO)
	if k.get("centre", false):
		var box := Models.bounds(root)
		var c := box.get_center()
		pre = pre * Transform3D(Basis(), -Vector3(c.x, box.position.y, c.z))
	var field := _field(root, pre, 72)
	var tops: Array = field.top.filter(func(v): return v != null)
	tops.sort()
	var deck: float = tops[tops.size() / 2]
	var reach := 0.0
	for n in field.top.size():
		if field.top[n] == null:
			continue
		var x: float = field.x0 + (n % field.nx) * field.cell
		var z: float = field.z0 + (n / field.nx) * field.cell
		reach = maxf(reach, Vector2(x, z).length())
	var s: float = k.r / maxf(1.0, reach)
	rec.g.add_child(root)
	root.transform = Transform3D(Basis().scaled(Vector3.ONE * s), Vector3(0, -deck * s, 0)) * pre
	rec.field = field
	rec.s = s
	rec.deck = deck
	# rock and wood are textured; leaves and grass carry their colour in the
	# vertices and are thin, so they are drawn from both sides
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var thin := ("leaves" in m.name.to_lower()) or ("grass" in m.name.to_lower())
		for si in m.mesh.get_surface_count():
			var src := m.get_active_material(si) as StandardMaterial3D
			if src == null:
				continue
			var mat := src.duplicate() as StandardMaterial3D
			if mat.albedo_texture == null:
				mat.vertex_color_use_as_albedo = true
			if thin:
				mat.cull_mode = BaseMaterial3D.CULL_DISABLED
			m.set_surface_override_material(si, mat)
		if not thin:
			m.create_trimesh_collision()

## THE GROUND OF A MODEL, FROM ITS TRIANGLES: every triangle laid flat onto a
## grid over its footprint, each point keeping the highest surface above it
## and the lowest. The same {top, bot} grid the browser makes.
func _field(root: Node3D, pre: Transform3D, n: int) -> Dictionary:
	var tris := PackedVector3Array()
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf := pre * Models._rel(root, m)
		for si in m.mesh.get_surface_count():
			var arr := m.mesh.surface_get_arrays(si)
			var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var ix = arr[Mesh.ARRAY_INDEX]
			if ix == null or (ix as PackedInt32Array).size() == 0:
				for p in v:
					tris.append(xf * p)
			else:
				for q in (ix as PackedInt32Array):
					tris.append(xf * v[q])
	var lo := Vector3(INF, INF, INF)
	var hi := -lo
	for p in tris:
		lo = lo.min(p)
		hi = hi.max(p)
	var span := maxf(hi.x - lo.x, hi.z - lo.z)
	var cell := span / (n - 1)
	var nx := ceili((hi.x - lo.x) / cell) + 2
	var nz := ceili((hi.z - lo.z) / cell) + 2
	var x0 := lo.x - cell * 0.5
	var z0 := lo.z - cell * 0.5
	var top := []
	var bot := []
	top.resize(nx * nz)
	bot.resize(nx * nz)
	for ti in range(0, tris.size() - 2, 3):
		var a := tris[ti]
		var b := tris[ti + 1]
		var c := tris[ti + 2]
		var det := (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
		if absf(det) < 1e-12:
			continue
		var i0 := maxi(0, ceili((minf(a.x, minf(b.x, c.x)) - x0) / cell))
		var i1 := mini(nx - 1, floori((maxf(a.x, maxf(b.x, c.x)) - x0) / cell))
		var j0 := maxi(0, ceili((minf(a.z, minf(b.z, c.z)) - z0) / cell))
		var j1 := mini(nz - 1, floori((maxf(a.z, maxf(b.z, c.z)) - z0) / cell))
		for j in range(j0, j1 + 1):
			for i in range(i0, i1 + 1):
				var x := x0 + i * cell
				var z := z0 + j * cell
				var l1 := ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det
				var l2 := ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det
				var l3 := 1.0 - l1 - l2
				if l1 < -1e-6 or l2 < -1e-6 or l3 < -1e-6:
					continue
				var y := l1 * a.y + l2 * b.y + l3 * c.y
				var q := j * nx + i
				if top[q] == null or y > top[q]:
					top[q] = y
				if bot[q] == null or y < bot[q]:
					bot[q] = y
	return {"x0": x0, "z0": z0, "cell": cell, "nx": nx, "nz": nz, "top": top, "bot": bot}

## The deck of a modelled isle at a point in the island's own frame, or null.
func _top_at(rec: Dictionary, x: float, z: float):
	var F: Dictionary = rec.field
	var s: float = rec.s
	var i := roundi((x / s - F.x0) / F.cell)
	var j := roundi((z / s - F.z0) / F.cell)
	if i < 0 or j < 0 or i >= F.nx or j >= F.nz:
		return null
	var v = F.top[j * F.nx + i]
	return null if v == null else (v - rec.deck) * s

# --------------------------------------------------------------- a lathed isle

## The crown is not flat: it domes from r*0.10 at the middle to 0 at the rim,
## and the underside tapers to a point — you believe a rock is hanging in the
## air when you can see the bottom of it.
const CROWN := [[0.0, 0.100], [0.42, 0.085], [0.74, 0.045], [0.93, 0.012], [1.0, 0.0]]

func _lathe(rec: Dictionary, seed: int) -> void:
	var k: Dictionary = rec.k
	var R: float = k.r
	var deep: float = R * 1.9 if k.get("tall", false) else R * 1.15
	var prof := []
	for c in CROWN:
		prof.append(Vector2(R * c[0], R * c[1]))
	for p in [[0.97, -0.10 * R / deep], [0.82, -0.26], [0.58, -0.52], [0.30, -0.76], [0.10, -0.93], [0.0, -1.0]]:
		prof.append(Vector2(R * p[0], deep * p[1]))
	const SEG := 44
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rows := []
	for pi in prof.size():
		var row := []
		for si in SEG + 1:
			var a := TAU * si / SEG
			var pr: Vector2 = prof[pi]
			var x := maxf(0.001, pr.x) * sin(a)
			var z := maxf(0.001, pr.x) * cos(a)
			var y := pr.y
			var ang := atan2(z, x)
			var lump := 1.0 + 0.13 * sin(ang * 3 + seed) + 0.08 * sin(ang * 5 - seed * 1.7) + 0.05 * sin(ang * 8 + seed * 0.6)
			var grip := clampf((y + deep * 0.5) / (deep * 0.5 + R * 0.1), 0.0, 1.0)
			var k2 := 1.0 + (lump - 1.0) * grip
			var col: Color
			if y > -R * 0.02:
				col = GRASS[posmod(int(floor(Vector2(x, z).length() * 0.35 + ang * 2 + seed)), GRASS.size())]
			else:
				var d := minf(2.0, -y / (deep * 0.55))
				col = ROCK[mini(ROCK.size() - 1, int(d * ROCK.size()))]
			row.append([Vector3(x * k2, y, z * k2), col])
		rows.append(row)
	for pi in prof.size() - 1:
		for si in SEG:
			var q := [rows[pi][si], rows[pi][si + 1], rows[pi + 1][si + 1], rows[pi + 1][si]]
			for tri in [[0, 2, 1], [0, 3, 2]]:
				for e in tri:
					st.set_color(q[e][1])
					st.add_vertex(q[e][0])
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = true
	mat.roughness = 0.95
	mesh.surface_set_material(0, mat)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	rec.g.add_child(mi)
	mi.create_trimesh_collision()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	for n in roundi(R / 3.0):
		var a := rng.randf() * TAU
		var rr := R * (0.55 + rng.randf() * 0.38)
		var s := 0.7 + rng.randf() * 1.5
		var bo := MeshInstance3D.new()
		bo.mesh = _stone(s, ROCK[n % ROCK.size()])
		bo.position = Vector3(cos(a) * rr, _crown_y(R, rr / R) - s * 0.25, sin(a) * rr)
		bo.rotation = Vector3(rng.randf() * 3, rng.randf() * 3, rng.randf() * 3)
		rec.g.add_child(bo)
	for n in k.get("trees", 0):
		var a := rng.randf() * TAU
		var rr := R * (0.25 + rng.randf() * 0.45)
		var tr := _tree(0.8 + rng.randf() * 0.7)
		tr.position = Vector3(cos(a) * rr, _crown_y(R, rr / R) - 0.15, sin(a) * rr)
		rec.g.add_child(tr)

static func _crown_y(R: float, u: float) -> float:
	u = clampf(u, 0.0, 1.0)
	for i in range(1, CROWN.size()):
		if u <= CROWN[i][0]:
			var a: float = CROWN[i - 1][0]
			var ay: float = CROWN[i - 1][1]
			var b: float = CROWN[i][0]
			var by: float = CROWN[i][1]
			return R * (ay + (by - ay) * (u - a) / maxf(1e-6, b - a))
	return 0.0

static var _stones := {}
static func _stone(s: float, c: Color) -> Mesh:
	var key := c.to_html()
	if not _stones.has(key):
		var m := SphereMesh.new()
		m.radius = 1.0
		m.height = 2.0
		m.radial_segments = 7
		m.rings = 4
		var mat := StandardMaterial3D.new()
		mat.albedo_color = c
		mat.roughness = 1.0
		m.material = mat
		_stones[key] = m
	var inst: Mesh = _stones[key]
	var out := inst.duplicate() as SphereMesh
	out.radius = s
	out.height = s * 2.0
	return out

func _tree(scale: float) -> Node3D:
	var g := Node3D.new()
	var trunk := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.32 * scale
	cyl.bottom_radius = 0.44 * scale
	cyl.height = 3.4 * scale
	cyl.radial_segments = 6
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color("6b4a2f")
	cyl.material = bark
	trunk.mesh = cyl
	trunk.position.y = 1.7 * scale
	g.add_child(trunk)
	var leaf := StandardMaterial3D.new()
	leaf.albedo_color = Color("3f7a35")
	for p in [[0.0, 3.9, 1.9], [0.9, 4.9, 1.35], [-0.8, 4.7, 1.2]]:
		var m := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = p[2] * scale
		sm.height = p[2] * scale * 2.0
		sm.radial_segments = 6
		sm.rings = 3
		sm.material = leaf
		m.mesh = sm
		m.position = Vector3(p[0] * scale, p[1] * scale, 0)
		g.add_child(m)
	return g

# ------------------------------------------------------------------ the pool

func _pool(rec: Dictionary) -> void:
	var k: Dictionary = rec.k
	var f: Basis = rec.f
	var lip: Vector3 = rec.dir * (Planet.R + k.alt) + f.z * k.r * 0.80 - f.x * k.r * 0.10
	var base := lip.normalized()
	# the ground UNDER THE WATER, not under the island
	var ground := Planet.height(base)
	var g := Node3D.new()
	add_child(g)
	g.global_transform = Transform3D(Planet.frame_at(base, k.spin), base * (Planet.R + ground))
	var pr: float = k.r * 0.72
	var rim := Planet.basin_rim(base)
	var surf := (POOL_DEPTH - 0.55) if is_nan(rim) else (rim - 0.45) - ground
	var r0 := Planet.R + ground
	var water := MeshInstance3D.new()
	water.mesh = Water.cap(pr * 1.10, r0, surf)
	water.material_override = Water.pool(pr, k.r * 0.22)
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(water)
	# boulders round the rim, open on the downstream side
	var rng := RandomNumberGenerator.new()
	rng.seed = 900
	for i in 22:
		var a := TAU * i / 22.0
		if cos(a) > 0.72:
			continue
		var sz := 0.55 + rng.randf() * 1.1
		var bo := MeshInstance3D.new()
		bo.mesh = _stone(sz, ROCK[i % ROCK.size()])
		var br := pr * (1.0 + rng.randf() * 0.05)
		bo.scale = Vector3(1, 0.55 + rng.randf() * 0.3, 1.1)
		bo.position = Vector3(cos(a) * br, sqrt(maxf(0.0, (r0 + surf) * (r0 + surf) - br * br)) - r0 - sz * 0.25, sin(a) * br)
		bo.rotation = Vector3(rng.randf() * 3, rng.randf() * 3, rng.randf() * 3)
		g.add_child(bo)
	rec.pool = {"g": g, "r0": r0, "surf": surf, "ground": ground, "base": base, "pr": pr, "water": water}
	pool = {"dir": base, "r": pr, "surface": ground + surf}
	_stock(g, pr, surf, r0)
	_river(base, ground + surf, pr)

## THE COLUMN, poured off the rim of the modelled island toward the middle
## of the pool. The lip is where the rock actually runs out, found by walking
## out from the middle of the island toward the pool until there is none.
func _pour(rec: Dictionary) -> void:
	var P: Dictionary = rec.pool
	var pg: Node3D = P.g
	var g: Node3D = rec.g
	var aim := g.to_local(pg.global_position)
	aim.y = 0
	var hd := aim.normalized() if aim.length_squared() > 1e-6 else Vector3(0, 0, 1)
	var rim := 0.0
	var r := 0.0
	while r < rec.k.r * 1.6:
		if _top_at(rec, hd.x * r, hd.z * r) != null:
			rim = r
		r += 0.5
	var ly = _top_at(rec, hd.x * (rim - 1.5), hd.z * (rim - 1.5))
	var lip_y: float = (ly if ly != null else 0.0) - 0.25
	var lip_i := Vector3(hd.x * (rim + 0.4), lip_y, hd.z * (rim + 0.4))
	var bed := []
	var last := lip_y
	r = rim - 0.5
	while r > maxf(2.0, rim - 16.0):
		var y = _top_at(rec, hd.x * r, hd.z * r)
		if y == null or absf(y - last) > 0.9:
			break
		bed.append(Vector3(hd.x * r, y + 0.14, hd.z * r))
		last = y
		r -= 1.0
	bed.reverse()
	bed.append(Vector3(hd.x * (rim + 0.4), lip_y + 0.14, hd.z * (rim + 0.4)))
	var to_pool := func(v: Vector3) -> Vector3: return pg.to_local(g.to_global(v))
	var lip: Vector3 = to_pool.call(lip_i)
	var surf: float = P.surf
	var H := maxf(4.0, lip.y - surf)
	var tf := sqrt(2.0 * H / Water.GRAV)
	# aim for the middle of the pool, but never slower than 3.2 m/s: water
	# that merely dribbled over the edge ran down behind the bulge under the rim
	var out: Vector3 = lip - (to_pool.call(Vector3.ZERO) as Vector3)
	var flat := Vector3(-lip.x, 0, -lip.z)
	var dist := flat.length()
	var away := Vector3(out.x, 0, out.z).normalized()
	var dir_h := flat / dist if dist > 0.01 else away
	if dir_h.dot(away) < 0.2:
		dir_h = away
		dist = 0.0
	var speed := clampf(dist / tf, 3.2, 9.0)
	var vel := dir_h * speed
	var side := Vector3(-dir_h.z, 0, dir_h.x)
	const W0 := 3.6
	const GROW := 1.9
	var hit := lip + vel * tf
	hit.y = surf
	# a bright core and two looser veils, turned thirty degrees either way, so
	# the column has body from wherever you look at it
	for spec in [[0, 0.95, 1.00, 0.00, 0.0], [1, 0.55, 1.35, 0.35, 0.52], [2, 0.42, 1.6, -0.35, -0.52]]:
		var sd := side.rotated(Vector3.UP, spec[4])
		var sh := MeshInstance3D.new()
		sh.mesh = Water.arc_ribbon(lip + dir_h * spec[3], vel, sd, tf, W0 * spec[2], GROW * spec[2])
		sh.material_override = Water.sheet(spec[0] * 7.3 + 1.1, spec[1], tf)
		sh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		sh.custom_aabb = AABB(Vector3(-300, -300, -300), Vector3(600, 600, 600))
		pg.add_child(sh)
	var common := {"lip": lip, "vel": vel, "side": side, "tf": tf, "hit": hit, "surf": surf, "w": W0}
	var wide := W0 + GROW * tf
	pg.add_child(Water.particles(700, 0, common.merged({"size": 0.30, "alpha": 0.85})))
	pg.add_child(Water.particles(900, 1, common.merged({"size": 0.55, "alpha": 0.75, "w": wide})))
	pg.add_child(Water.particles(140, 2, common.merged({"size": 5.5, "alpha": 0.20, "w": wide})))
	(P.water.material_override as ShaderMaterial).set_shader_parameter("hit", Vector2(hit.x, hit.z))
	# the stream on the island, from the meadow to the lip — the lake visibly
	# LEAVING, which is what joins the rock to the column under it
	if bed.size() > 3:
		var pts := []
		var ups := []
		for b in bed:
			pts.append(to_pool.call(b))
			ups.append(Vector3.UP)
		var sm := MeshInstance3D.new()
		sm.mesh = Water.ribbon(pts, ups, func(u: float) -> float: return (1.2 + 2.4 * u) * 0.5, 6.0)
		sm.material_override = Water.flow(1.6)
		pg.add_child(sm)
	fall_col = {"lip": pg.to_global(lip), "vel": pg.global_basis * vel, "side": pg.global_basis * side,
		"up": pg.global_basis.y.normalized(), "H": H, "tf": tf, "w0": W0, "grow": GROW}

## IS THIS POINT IN THE FALLING WATER? How hard it pushes (0 to 1) and which
## way is out of it. The column at a depth below the lip is where the
## projectile was when it had fallen that far.
func fall_push(p: Vector3) -> Dictionary:
	if fall_col.is_empty():
		return {}
	var C := fall_col
	var rel: Vector3 = p - C.lip
	var d: float = -rel.dot(C.up)
	if d < -1.0 or d > C.H + 1.0:
		return {}
	var tt := sqrt(2.0 * maxf(0.0, d) / Water.GRAV)
	var centre: Vector3 = C.vel * tt - C.up * d
	var off: Vector3 = rel - centre
	off -= C.up * off.dot(C.up)
	var half: float = (C.w0 + C.grow * tt) * 0.5 * 1.35
	var across := absf(off.dot(C.side))
	var thru := absf(off.dot((C.vel as Vector3).normalized()))
	if across > half + 0.8 or thru > 2.2:
		return {}
	var s := (1.0 - minf(1.0, across / (half + 0.8))) * (1.0 - minf(1.0, thru / 2.2))
	var out: Vector3 = off.normalized() if off.length_squared() > 1e-4 else C.side
	return {"s": s, "out": out}

## Where the water surface is at a point, or NAN for dry land.
func water_at(dir: Vector3) -> float:
	if pool.is_empty():
		return NAN
	if dir.dot(pool.dir) > 0.0 and dir.angle_to(pool.dir) * Planet.R < pool.r:
		return pool.surface
	return NAN

# ------------------------------------------------------------------ the river

## WATER THAT ARRIVES HAS TO GO SOMEWHERE. Steepest descent over the terrain
## that is already there: at each step look at a fan of headings, take the
## lowest (a few centimetres' penalty for turning keeps it one river rather
## than a zig-zag), and drape a widening ribbon over what it found.
func _river(start: Vector3, _y: float, pool_r: float) -> void:
	const STEP := 5.0
	const N := 110
	const FAN := [-0.55, -0.32, -0.14, 0.0, 0.14, 0.32, 0.55]
	var d := start
	var fr := Planet.frame_at(d)
	var best_h := INF
	var head := fr.z
	for i in 16:
		var h2 := fr.z.rotated(d, TAU * i / 16.0)
		var cand := Planet.walk(d, h2, pool_r + STEP)
		var h := Planet.height(cand)
		if h < best_h:
			best_h = h
			head = h2
	# start INSIDE the bank, or there is dry grass between the pool and its river
	d = Planet.walk(d, head, pool_r - 8.0)
	var course := [d]
	var hs := []
	for i in N:
		head = (head - d * head.dot(d)).normalized()
		var pick := {}
		for off in FAN:
			var h2 := head.rotated(d, off)
			var cand := Planet.walk(d, h2, STEP)
			var h := Planet.height(cand)
			var cost: float = h + absf(off) * 0.45
			if pick.is_empty() or cost < pick.cost:
				pick = {"cost": cost, "h2": h2, "cand": cand}
		head = pick.h2
		d = pick.cand
		course.append(d)
		hs.append(Planet.height(d))
		# once it has run out into flat country, stop rather than wander
		if i > 24 and absf(hs[i] - hs[i - 12]) < 0.05:
			break
	if course.size() < 4:
		return
	# SMOOTHED AND DRAPED: a Catmull-Rom through the course, four points a
	# step, each one sat on the real ground under it — a flat quad between
	# samples five metres apart cuts through every bulge in the hills
	var path := []
	var n := course.size()
	for i in n - 1:
		var p0: Vector3 = course[maxi(0, i - 1)]
		var p1: Vector3 = course[i]
		var p2: Vector3 = course[i + 1]
		var p3: Vector3 = course[mini(n - 1, i + 2)]
		for k in 4:
			var u := k / 4.0
			var q := 0.5 * ((2.0 * p1) + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u)
			path.append(q.normalized())
	path.append(course[n - 1])
	var pts := []
	var ups := []
	hs = []
	for p in path:
		var h := Planet.height(p)
		hs.append(h)
		pts.append((p as Vector3) * (Planet.R + h + 0.12))
		ups.append(p)
	var ribbon := MeshInstance3D.new()
	ribbon.mesh = Water.ribbon(pts, ups, func(u: float) -> float: return (4.0 + 5.4 * u) * 0.5, 14.0)
	ribbon.material_override = Water.flow(0.9)
	ribbon.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(ribbon)
	# stones along both banks, so the water has an edge
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var P := path.size()
	for i in range(10, P, 14):
		var p: Vector3 = path[i]
		var t := ((path[mini(P - 1, i + 1)] as Vector3) - (path[maxi(0, i - 1)] as Vector3)).normalized()
		var right := p.cross(t).normalized()
		var wide := (4.0 + 5.4 * float(i) / P) * 0.5
		for sx in [-1.0, 1.0]:
			if rng.randf() < 0.35:
				continue
			var sz := 0.45 + rng.randf() * 0.95
			var bo := MeshInstance3D.new()
			bo.mesh = _stone(sz, ROCK[(i + (1 if sx > 0 else 0)) % ROCK.size()])
			add_child(bo)
			bo.global_position = p * (Planet.R + hs[i] + sz * 0.35) + right * sx * (wide + sz * 0.7)
			bo.rotation = Vector3(rng.randf() * 3, rng.randf() * 3, rng.randf() * 3)
	river_path = path

var river_path: Array = []

# ------------------------------------------------------- fish and turtles

func _stock(g: Node3D, rad: float, surf: float, r0: float) -> void:
	var tints := [Color("ffa94d"), Color("ff6b6b"), Color("ffd93d"), Color("74c0fc"), Color("b197fc")]
	for i in 14:
		var m := _fish(tints[i % tints.size()])
		g.add_child(m)
		var a := randf() * TAU
		var sr := rad * 0.85 * randf()
		var f := {"m": m, "rad": rad, "surf": surf, "r0": r0, "x": cos(a) * sr, "z": sin(a) * sr,
			"a": randf() * TAU, "spd": 1.3 + randf() * 1.5, "bob": randf() * 6.0, "tx": 0.0, "tz": 0.0}
		_aim(f, 0.92)
		fish.append(f)
	for i in 4:
		var m := _turtle()
		g.add_child(m)
		var a := randf() * TAU
		var sr := rad * (0.85 + randf() * 0.3)
		var tt := {"m": m, "rad": rad, "surf": surf, "r0": r0, "x": cos(a) * sr, "z": sin(a) * sr,
			"a": randf() * TAU, "spd": 0.55 + randf() * 0.35, "step": 0.0, "rest": randf() * 5.0,
			"bob": randf() * 6.0, "tx": 0.0, "tz": 0.0}
		_aim(tt, 1.16)
		turtles.append(tt)

static func _aim(c: Dictionary, band: float) -> void:
	var a := randf() * TAU
	var r: float = c.rad * band * (0.25 + randf() * 0.75)
	c.tx = cos(a) * r
	c.tz = sin(a) * r

func _fish(tint: Color) -> Node3D:
	var g := Node3D.new()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = tint
	var body := MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 0.26
	cone.height = 1.0
	cone.radial_segments = 6
	cone.material = mat
	body.mesh = cone
	body.rotation.x = PI / 2
	g.add_child(body)
	var tail := MeshInstance3D.new()
	var tc := CylinderMesh.new()
	tc.top_radius = 0.0
	tc.bottom_radius = 0.22
	tc.height = 0.5
	tc.radial_segments = 4
	tc.material = mat
	tail.mesh = tc
	tail.rotation.x = -PI / 2
	tail.position.z = -0.64
	g.add_child(tail)
	return g

func _turtle() -> Node3D:
	var g := Node3D.new()
	g.scale = Vector3.ONE * 0.62
	var shell_m := StandardMaterial3D.new()
	shell_m.albedo_color = Color("4e7a43")
	var skin_m := StandardMaterial3D.new()
	skin_m.albedo_color = Color("93a86a")
	var shell := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.8
	sm.height = 0.8
	sm.is_hemisphere = true
	sm.material = shell_m
	shell.mesh = sm
	shell.scale = Vector3(1, 0.62 * 2.0, 1.25)
	shell.position.y = 0.42
	g.add_child(shell)
	var belly := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.35, 0.26, 1.85)
	bm.material = skin_m
	belly.mesh = bm
	belly.position.y = 0.30
	g.add_child(belly)
	var head := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 0.30
	hm.height = 0.6
	hm.material = skin_m
	head.mesh = hm
	head.position = Vector3(0, 0.46, 1.15)
	g.add_child(head)
	var legs := []
	for s in [[-1, 1], [1, 1], [-1, -1], [1, -1]]:
		var l := MeshInstance3D.new()
		var lm := BoxMesh.new()
		lm.size = Vector3(0.28, 0.22, 0.62)
		lm.material = skin_m
		l.mesh = lm
		l.position = Vector3(s[0] * 0.62, 0.20, s[1] * 0.62)
		g.add_child(l)
		legs.append(l)
	g.set_meta("legs", legs)
	return g

## The height of the water at a point in the pool's frame: the cap curves
## away with the planet, so a fish near the bank sits lower than one in the middle.
static func _cap_y(c: Dictionary, x: float, z: float) -> float:
	var top: float = c.r0 + c.surf
	return sqrt(maxf(0.0, top * top - x * x - z * z)) - c.r0

func _process(delta: float) -> void:
	t += delta
	# A WANDER, NOT AN ORBIT: each fish has somewhere it is going
	for f in fish:
		var dx: float = f.tx - f.x
		var dz: float = f.tz - f.z
		if dx * dx + dz * dz < 0.6:
			_aim(f, 0.92)
		var want := atan2(dz, dx)
		f.a += wrapf(want - f.a, -PI, PI) * minf(1.0, delta * 2.2)
		f.x += cos(f.a) * f.spd * delta
		f.z += sin(f.a) * f.spd * delta
		var m: Node3D = f.m
		m.position = Vector3(f.x, _cap_y(f, f.x, f.z) - 0.6 + sin(t * 1.7 + f.bob) * 0.14, f.z)
		m.rotation = Vector3(0, -f.a + PI / 2, sin(t * 7.0 + f.bob) * 0.20)
	# THE TURTLES DO NOT GO ROUND IN A CIRCLE: walk somewhere, stop a while
	for tt in turtles:
		var m: Node3D = tt.m
		if tt.rest > 0.0:
			tt.rest -= delta
			m.rotation.y = -tt.a + PI / 2 + sin(t * 0.6 + tt.bob) * 0.12
			continue
		var dx: float = tt.tx - tt.x
		var dz: float = tt.tz - tt.z
		if dx * dx + dz * dz < 0.5:
			_aim(tt, 1.16)
			tt.rest = 2.5 + randf() * 6.0
			continue
		var want := atan2(dz, dx)
		tt.a += wrapf(want - tt.a, -PI, PI) * minf(1.0, delta * 1.1)
		tt.x += cos(tt.a) * tt.spd * delta
		tt.z += sin(tt.a) * tt.spd * delta
		tt.step += tt.spd * delta * 7.0
		var y := _cap_y(tt, tt.x, tt.z)
		var wp := (m.get_parent() as Node3D).to_global(Vector3(tt.x, 0, tt.z))
		var ground := Planet.height(wp.normalized()) + Planet.R - (tt.r0 as float)
		m.position = Vector3(tt.x, maxf(y, ground) + 0.02, tt.z)
		m.rotation.y = -tt.a + PI / 2
		var legs: Array = m.get_meta("legs")
		for i in legs.size():
			(legs[i] as Node3D).position.y = 0.20 + maxf(0.0, sin(tt.step + (PI if i % 2 else 0.0))) * 0.11
