## WHAT GROWS ON A WORLD, because "a planet with a different sky" is the same
## planet with a filter on it. What tells two worlds apart from the ground is
## the things standing up out of it (public/planet.js, FLORA).
##
## VOLTA GROWS GLASS. Spires and shards lit from inside, which is the only
## light there is on a world whose sky is nearly black — thicker per square
## metre than Wano's woods, because on a world with no grass and no animals
## they are the only thing between two buildings and the horizon.
##
## A HOME PLANET GROWS A WOOD: a trunk and a crown, and boulders.
##
## Each kind is one MultiMesh per colour, so a forest is a handful of draw calls.
class_name Flora
extends RefCounted

const CRYSTAL := [Color("ff9ae8"), Color("a8f6ff"), Color("dcc8ff"), Color("ffb8bd")]

static func _spots(n: int, keep: Callable) -> Array:
	var out := []
	var tries := 0
	while out.size() < n and tries < n * 20:
		tries += 1
		var d := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized()
		if keep.call(d):
			out.append(d)
	return out

## Groves round random centres: a spire is rarely alone.
static func _groves(n: int, per: Vector2i, radius: float, keep: Callable) -> Array:
	var out := []
	for c in _spots(n, keep):
		var f := Planet.frame_at(c)
		for j in randi_range(per.x, per.y):
			var a := randf() * TAU
			var d := Planet.walk(c, (f.x * cos(a) + f.z * sin(a)).normalized(), sqrt(randf()) * radius)
			if keep.call(d):
				out.append(d)
	return out

## A spire: a tall thin octahedron — four facets a side, so it catches the
## light differently from every angle for the cost of a cone.
static func _spire() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var top := Vector3(0, 1, 0)
	var bot := Vector3(0, -0.08, 0)
	var ring := []
	for i in 4:
		var a := TAU * i / 4.0 + PI / 4.0
		ring.append(Vector3(cos(a) * 0.14, 0.22, sin(a) * 0.14))
	for i in 4:
		var a: Vector3 = ring[i]
		var b: Vector3 = ring[(i + 1) % 4]
		for v in [top, b, a, bot, a, b]:
			st.add_vertex(v)
	st.generate_normals()
	return st.commit()

static func _glass(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c.lerp(Color.WHITE, 0.25)
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 1.6
	m.roughness = 0.2
	m.metallic = 0.3
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

static func _plant(parent: Node3D, mesh: Mesh, spots: Array, lo: float, hi: float, thin: float, tilt: float) -> void:
	if spots.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = spots.size()
	for i in spots.size():
		var d: Vector3 = spots[i]
		var h := randf_range(lo, hi)
		var w := h * thin * randf_range(0.8, 1.3)
		var b := Planet.frame_at(d, randf() * TAU)
		b = Basis(b.x.rotated(b.z, randf_range(-tilt, tilt)), b.y.rotated(b.z, randf_range(-tilt, tilt)), b.z).orthonormalized()
		mm.set_instance_transform(i, Transform3D(Basis(b.x * w, b.y * h, b.z * w), d * (Planet.R + Planet.height(d) - 0.2)))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	parent.add_child(mi)

static func crystals(parent: Node3D, keep: Callable) -> void:
	var spire := _spire()
	var spots := _groves(46, Vector2i(3, 7), 7.0, keep)
	var shards := _spots(260, keep)
	for i in CRYSTAL.size():
		var m := spire.duplicate() as ArrayMesh
		m.surface_set_material(0, _glass(CRYSTAL[i]))
		_plant(parent, m, spots.filter(func(_d): return randi() % CRYSTAL.size() == i), 3.0, 9.0, 1.0, 0.18)
		_plant(parent, m, shards.filter(func(_d): return randi() % CRYSTAL.size() == i), 0.6, 1.8, 1.5, 0.5)
	# the buds: points of light on the ground between them
	var lamp_every := 6
	var k := 0
	for d in spots:
		k += 1
		if k % lamp_every != 0:
			continue
		var l := OmniLight3D.new()
		l.light_color = CRYSTAL[k % CRYSTAL.size()]
		l.light_energy = 1.6
		l.omni_range = 12.0
		l.shadow_enabled = false
		l.distance_fade_enabled = true
		l.distance_fade_begin = 70.0
		l.distance_fade_length = 20.0
		parent.add_child(l)
		l.global_position = (d as Vector3) * (Planet.R + Planet.height(d) + 3.0)

## A tree: a trunk and a crown of three, the same blocky kind that grows on
## the sky islands, merged into one mesh with its colour in the vertices.
static func _tree(leaf: Color) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.32
	trunk.bottom_radius = 0.44
	trunk.height = 3.4
	trunk.radial_segments = 6
	var parts := [[trunk, Transform3D(Basis(), Vector3(0, 1.7, 0)), Color("6b4a2f")]]
	for p in [[0.0, 3.9, 1.9], [0.9, 4.9, 1.35], [-0.8, 4.7, 1.2]]:
		var s := SphereMesh.new()
		s.radius = p[2]
		s.height = p[2] * 2.0
		s.radial_segments = 6
		s.rings = 3
		parts.append([s, Transform3D(Basis(), Vector3(p[0], p[1], 0)), leaf])
	for part in parts:
		var arr: Array = (part[0] as PrimitiveMesh).get_mesh_arrays()
		var xf: Transform3D = part[1]
		var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var ix: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		for i in ix:
			st.set_color(part[2])
			st.add_vertex(xf * v[i])
	st.generate_normals()
	var m := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	m.surface_set_material(0, mat)
	return m

static func wood(parent: Node3D, keep: Callable) -> void:
	var tree := _tree(Color("3f7a35"))
	var spots := _groves(26, Vector2i(3, 9), 9.0, keep) + _spots(70, keep)
	_plant(parent, tree, spots, 0.9, 1.6, 1.0, 0.05)
	var rock := SphereMesh.new()
	rock.radius = 1.0
	rock.height = 1.6
	rock.radial_segments = 7
	rock.rings = 4
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color("7d7a86")
	rock.material = rm
	_plant(parent, rock, _spots(90, keep), 0.5, 1.6, 1.3, 0.4)
