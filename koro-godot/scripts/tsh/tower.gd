## THE MERIDIAN TOWER: the tallest thing in Harbor Lane, out past the east edge of town, where the WFC chase sends her.
## A glass tower 140 m high and its roof — 60 m square, big enough to fight across: a helipad, the lift housing, plant
## (AC units, a water tank), a mast with its red light, floodlights, a parapet round the edge. Built once, the first
## time it is wanted; its body is a wall she can run at (bld:TOWER) and its roof a roof she can land on.
##   Tower.build(g)   Tower.TOP, Tower.C, Tower.HALF   Tower.arena() / blocks() for the fight
class_name Tower
extends RefCounted

const C := Vector2(335.0, 25.0)           # the middle of it: east of town, in a gap in the skyline round it (nothing over 80 m)
const HALF := 30.0                        # half its width
const TOP := 140.0                        # the roof
static var node: Node3D
static var wet: Array = []                # the roof's materials, made to shine when it rains

# what stands on the roof: [x, z, w, d, h] about the middle — the fight goes round them
const PLANT := [[-14.0, -18.0, 9.0, 7.0, 4.2], [16.0, 15.0, 5.0, 3.2, 1.8], [19.5, 9.0, 5.0, 3.2, 1.8], [-19.0, 16.0, 6.0, 6.0, 1.4]]
const TANK := Vector3(18.0, 0.0, -17.0)

static func _std(c: Color, r := 0.8, m := 0.0) -> StandardMaterial3D:
	var s := StandardMaterial3D.new(); s.albedo_color = c; s.roughness = r; s.metallic = m; return s
static func _box(p: Node3D, size: Vector3, at: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var b := BoxMesh.new(); b.size = size; mi.mesh = b; mi.material_override = m; mi.position = at; p.add_child(mi); return mi

static func arena() -> Dictionary: return {"x1": C.x - HALF + 1.6, "x2": C.x + HALF - 1.6, "z1": C.y - HALF + 1.6, "z2": C.y + HALF - 1.6}
static func blocks() -> Array:
	var out := []
	for q in PLANT: out.append({"x1": C.x + q[0] - q[2]/2, "x2": C.x + q[0] + q[2]/2, "z1": C.y + q[1] - q[3]/2, "z2": C.y + q[1] + q[3]/2})
	out.append({"x1": C.x + TANK.x - 2.6, "x2": C.x + TANK.x + 2.6, "z1": C.y + TANK.z - 2.6, "z2": C.y + TANK.z + 2.6})
	return out

static func build(g) -> void:
	if node != null and is_instance_valid(node): return
	node = Node3D.new(); node.name = "MeridianTower"; g.city.add_child(node)
	# the body: dark glass, a grid of windows, some lit
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform vec3 base : source_color = vec3(0.035, 0.05, 0.07);
varying vec3 wp;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 uv = abs(NORMAL.x) > 0.5 ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y);
	vec2 cell = floor(uv / vec2(3.0, 3.6));
	vec2 f = fract(uv / vec2(3.0, 3.6));
	float frame = step(0.08, f.x) * step(f.x, 0.92) * step(0.14, f.y) * step(f.y, 0.86);
	float lit = step(0.83, h(cell)) * frame;
	float band = step(0.96, fract(uv.y / 14.4));
	ALBEDO = mix(base, vec3(0.16, 0.18, 0.2), band) + frame * vec3(0.02, 0.03, 0.04);
	METALLIC = 0.85 * frame; ROUGHNESS = mix(0.6, 0.12, frame);
	EMISSION = lit * mix(vec3(1.0, 0.82, 0.55), vec3(0.75, 0.85, 1.0), h(cell + 3.1)) * 1.6;
}"""
	var glass := ShaderMaterial.new(); glass.shader = sh
	_box(node, Vector3(HALF*2, TOP, HALF*2), Vector3(C.x, TOP/2, C.y), glass)
	# a stepped crown under the roof edge, and the roof slab
	var conc := _std(Color(0.2, 0.21, 0.22), 0.75); var dark := _std(Color(0.08, 0.085, 0.09), 0.6, 0.3)
	_box(node, Vector3(HALF*2 + 1.2, 2.4, HALF*2 + 1.2), Vector3(C.x, TOP - 1.2, C.y), dark)
	var roof := _std(Color(0.16, 0.165, 0.17), 0.85); wet.append(roof)
	_box(node, Vector3(HALF*2, 0.2, HALF*2), Vector3(C.x, TOP - 0.1, C.y), roof)
	# the parapet
	for s in [[0, -1], [0, 1], [-1, 0], [1, 0]]:
		var along_x: bool = s[0] == 0
		var sz := Vector3(HALF*2 + 1.2 if along_x else 0.6, 1.1, 0.6 if along_x else HALF*2 + 1.2)
		_box(node, sz, Vector3(C.x + s[0]*(HALF + 0.3), TOP + 0.55, C.y + s[1]*(HALF + 0.3)), conc)
	# the helipad: a dark disc, its ring and its H
	var pad := MeshInstance3D.new(); var cy := CylinderMesh.new(); cy.top_radius = 9.0; cy.bottom_radius = 9.0; cy.height = 0.06; pad.mesh = cy
	var padm := _std(Color(0.07, 0.075, 0.08), 0.5); wet.append(padm); pad.material_override = padm; pad.position = Vector3(C.x + 4, TOP + 0.03, C.y + 2); node.add_child(pad)
	var ring := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 8.2; tm.outer_radius = 8.6; ring.mesh = tm; ring.scale = Vector3(1, 0.05, 1)
	ring.material_override = _std(Color(0.95, 0.8, 0.2), 0.5); ring.position = pad.position + Vector3(0, 0.04, 0); node.add_child(ring)
	var paint := _std(Color(0.92, 0.92, 0.9), 0.55)
	for q in [Vector3(-2.0, 0, 0), Vector3(2.0, 0, 0)]: _box(node, Vector3(0.7, 0.02, 6.0), pad.position + q + Vector3(0, 0.04, 0), paint)
	_box(node, Vector3(4.0, 0.02, 0.7), pad.position + Vector3(0, 0.04, 0), paint)
	# lights round the pad's edge
	for i in 12:
		var a := i*TAU/12; var l := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.12; sm.height = 0.24; l.mesh = sm
		var lm := StandardMaterial3D.new(); lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lm.albedo_color = Color(0.4, 1.6, 0.6); l.material_override = lm
		l.position = pad.position + Vector3(sin(a)*9.3, 0.12, cos(a)*9.3); node.add_child(l)
	# plant: the lift housing, AC units, a low box of ducts
	for q in PLANT:
		_box(node, Vector3(q[2], q[4], q[3]), Vector3(C.x + q[0], TOP + q[4]/2, C.y + q[1]), conc if q[4] > 3 else dark)
	var door := _std(Color(0.3, 0.06, 0.05), 0.6); _box(node, Vector3(1.3, 2.3, 0.08), Vector3(C.x - 14, TOP + 1.15, C.y - 18 + 3.55), door)
	for i in 2:
		var fan := MeshInstance3D.new(); var fc := CylinderMesh.new(); fc.top_radius = 1.1; fc.bottom_radius = 1.1; fc.height = 0.1; fan.mesh = fc
		fan.material_override = _std(Color(0.05, 0.05, 0.05), 0.4, 0.6); fan.position = Vector3(C.x + 16 + i*3.5, TOP + 1.86, C.y + (15.0 if i == 0 else 9.0)); fan.position.x = C.x + (16.0 if i == 0 else 19.5); node.add_child(fan)
	# the water tank on its legs
	var tank := MeshInstance3D.new(); var tc := CylinderMesh.new(); tc.top_radius = 2.4; tc.bottom_radius = 2.4; tc.height = 4.0; tank.mesh = tc
	tank.material_override = _std(Color(0.28, 0.2, 0.14), 0.9); tank.position = Vector3(C.x + TANK.x, TOP + 4.6, C.y + TANK.z); node.add_child(tank)
	for q in [Vector2(-1.6, -1.6), Vector2(1.6, -1.6), Vector2(-1.6, 1.6), Vector2(1.6, 1.6)]: _box(node, Vector3(0.2, 2.6, 0.2), Vector3(C.x + TANK.x + q.x, TOP + 1.3, C.y + TANK.z + q.y), dark)
	# the mast, and its red light
	_box(node, Vector3(0.5, 22.0, 0.5), Vector3(C.x - 24, TOP + 11, C.y - 24), dark)
	var red := OmniLight3D.new(); red.light_color = Color(1, 0.1, 0.08); red.light_energy = 3.0; red.omni_range = 8; red.position = Vector3(C.x - 24, TOP + 22.3, C.y - 24); node.add_child(red)
	var rb := MeshInstance3D.new(); var rs := SphereMesh.new(); rs.radius = 0.3; rs.height = 0.6; rb.mesh = rs
	var rm := StandardMaterial3D.new(); rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; rm.albedo_color = Color(3, 0.2, 0.15); rb.material_override = rm; rb.position = red.position; node.add_child(rb)
	# floodlights on the corners, down across the roof (so the fight is lit, hard, from the edges)
	for s in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var at := Vector3(C.x + s.x*(HALF - 1.0), TOP + 5.5, C.y + s.y*(HALF - 1.0))
		_box(node, Vector3(0.25, 5.5, 0.25), at - Vector3(0, 2.75, 0), dark)
		var sp := SpotLight3D.new(); sp.light_color = Color(0.85, 0.92, 1.0); sp.light_energy = 6.0; sp.spot_range = 52; sp.spot_angle = 48; sp.shadow_enabled = true
		node.add_child(sp); sp.look_at_from_position(at, Vector3(C.x - s.x*6, TOP, C.y - s.y*6))
	# the world: a wall she can run at, a roof she can land on, its plant in her way
	g.boots.solids.append([C.x - HALF, C.x + HALF, C.y - HALF, C.y + HALF, -1.0, TOP, "bld:TOWER"])
	g.boots.roofs.append({"id": "TOWER", "x1": C.x - HALF, "x2": C.x + HALF, "z1": C.y - HALF, "z2": C.y + HALF, "top": TOP})
	for q in PLANT: g.boots.solids.append([C.x + q[0] - q[2]/2, C.x + q[0] + q[2]/2, C.y + q[1] - q[3]/2, C.y + q[1] + q[3]/2, TOP, TOP + q[4]])

## the painted skyline round the city (the "manhattan" backdrop) has a tower of its own beside this one: off while
## we are up here, back when we leave
static func skyline(g, on: bool) -> void:
	for m in g.city.find_children("manhattan*", "MeshInstance3D", true, false): m.visible = on

## rain on the roof: it goes dark and shines
static func soak(k: float) -> void:
	for m in wet:
		(m as StandardMaterial3D).roughness = lerpf(0.85, 0.12, k); (m as StandardMaterial3D).metallic = lerpf(0.0, 0.35, k)
