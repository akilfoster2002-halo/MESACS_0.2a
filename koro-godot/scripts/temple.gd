## MISSION CONTROL, THE TEMPLE — the Blender building, and now you can go in.
##
## The model is drawn as it was baked (its light is in the picture). What
## makes it a building rather than a picture of one is the layout Blender
## wrote beside it (assets/temple_layout.json, from glb files/temple/build.py):
##   - SOLIDS, every wall as a box, with the doorways left out of them;
##   - CIRCLES, the atrium's round wall with its four doors and lintels, and
##     the stone lip round the pool;
##   - THE ROOF, a height per metre measured by casting down on to the model,
##     so you can land on it — and open over the oculus, so flying down
##     through the hole in the atrium ceiling lands you by the pool.
## Every one of those becomes a physics collider, which is what the world's
## floor and wall questions are asked of.
##
## And the room is alive: the pool is a mirror with a ripple in it, blossom
## drifts down through the oculus on to the water, and three doves wheel
## over the hole in the roof.
class_name Temple
extends Node3D

var L: Dictionary
var petals: MultiMeshInstance3D
var doves: Array = []
var t := 0.0

func _ready() -> void:
	L = JSON.parse_string(FileAccess.get_file_as_string("res://assets/temple_layout.json"))
	_model()
	_colliders()
	_sign()
	_pool(L.pool)
	_petals(L.oculus)
	_doves(L.oculus)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.82, 0.63)
	lamp.light_energy = 2.2
	lamp.omni_range = 18.0
	lamp.position = Vector3(0, 6.5, -17)
	add_child(lamp)

func _model() -> void:
	var m := Models.spawn("res://assets/temple.glb")
	add_child(m)
	# THE LIGHT IS IN THE PICTURE: the baked meshes are drawn unlit, or they
	# come out twice as dark
	for mi in m.find_children("*", "MeshInstance3D", true, false):
		var mesh := mi as MeshInstance3D
		var baked := mesh.name.begins_with("T_")
		for i in mesh.mesh.get_surface_count():
			var src := mesh.get_active_material(i) as StandardMaterial3D
			if src == null:
				continue
			if src.resource_name.begins_with("B_"):
				baked = true
			if baked:
				var mat := src.duplicate() as StandardMaterial3D
				mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
				mesh.set_surface_override_material(i, mat)
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

func _colliders() -> void:
	var body := StaticBody3D.new()
	add_child(body)
	for s in L.solids:
		var size := Vector3(s.x2 - s.x1, s.y2 - s.y1, s.z2 - s.z1)
		var at := Vector3(s.x1 + s.x2, s.y1 + s.y2, s.z1 + s.z2) * 0.5
		_box(body, size, Transform3D(Basis(), at))
	for c in L.circles:
		if c.kind == "disk":
			var cs := CollisionShape3D.new()
			var cyl := CylinderShape3D.new()
			cyl.radius = c.r1
			cyl.height = c.y2 - c.y1
			cs.shape = cyl
			cs.position = Vector3(c.x, (c.y1 + c.y2) * 0.5, c.z)
			body.add_child(cs)
			continue
		# THE ROUND WALL IS ROUND: seventy-two short boxes, and a doorway where
		# a gap is, with a lintel over it at the height of its head
		const SEG := 72
		var rm: float = (c.r0 + c.r1) * 0.5
		var chord := 2.0 * rm * sin(PI / SEG) + 0.08
		for i in SEG:
			var th := (i + 0.5) * TAU / SEG
			var in_gap := false
			for g in c.gaps:
				if absf(wrapf(th - g.a, -PI, PI)) < g.half:
					in_gap = true
			# blender's angle: x = cos, -z = sin
			var at := Vector3(c.x + cos(th) * rm, 0, c.z - sin(th) * rm)
			var y0: float = c.head if in_gap else c.y1
			var h: float = c.y2 - y0
			at.y = y0 + h * 0.5
			_box(body, Vector3(c.r1 - c.r0, h, chord), Transform3D(Basis(Vector3.UP, th), at))
	# the roofs, as a surface you can stand on
	var R: Dictionary = L.roof
	var faces := PackedVector3Array()
	var rows: Array = R.rows
	var pt := func(i: int, j: int) -> Vector3:
		return Vector3(R.x0 + i * R.cell, rows[j][i], R.z0 + j * R.cell)
	for j in int(R.nz) - 1:
		for i in int(R.nx) - 1:
			var a = rows[j][i]
			var b = rows[j][i + 1]
			var c = rows[j + 1][i]
			var d = rows[j + 1][i + 1]
			if a == null or b == null or c == null or d == null:
				continue
			faces.append_array([pt.call(i, j), pt.call(i + 1, j), pt.call(i + 1, j + 1)])
			faces.append_array([pt.call(i, j), pt.call(i + 1, j + 1), pt.call(i, j + 1)])
	var roof := ConcavePolygonShape3D.new()
	roof.set_faces(faces)
	roof.backface_collision = true
	var rs := CollisionShape3D.new()
	rs.shape = roof
	body.add_child(rs)

static func _box(body: StaticBody3D, size: Vector3, xf: Transform3D) -> void:
	var cs := CollisionShape3D.new()
	var b := BoxShape3D.new()
	b.size = size.max(Vector3.ONE * 0.05)
	cs.shape = b
	cs.transform = xf
	body.add_child(cs)

func _sign() -> void:
	var P: Dictionary = L.plaque
	var lbl := Label3D.new()
	lbl.text = "MISSION CONTROL"
	lbl.font_size = 96
	lbl.pixel_size = P.h / 160.0
	lbl.modulate = Color("e9c46a")
	lbl.outline_size = 0
	lbl.position = Vector3(P.x, P.y, P.z + 0.04)
	lbl.shaded = false
	add_child(lbl)

## A MIRROR with a ripple in it: a reflection probe catches the room once and
## the water is a near-perfect metal with a moving normal, darker towards the
## middle where a pool this deep stops reflecting and starts being dark.
func _pool(P: Dictionary) -> void:
	var probe := ReflectionProbe.new()
	probe.size = Vector3(21, 16, 21)
	probe.position = Vector3(P.x, 6.0, P.z)
	probe.update_mode = ReflectionProbe.UPDATE_ONCE
	probe.box_projection = true
	probe.interior = true
	add_child(probe)
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = """
shader_type spatial;
uniform float R = 6.0;
uniform vec3 deep : source_color = vec3(0.043, 0.078, 0.094);
varying vec2 xz;
void vertex(){ xz = VERTEX.xz; }
void fragment(){
	float r = length(xz) / R;
	if(r > 1.0) discard;
	vec2 rip = vec2(sin(xz.x*2.1+TIME*0.9)+sin(xz.y*1.7-TIME*0.7),
	                cos(xz.y*2.3+TIME*0.8)+cos(xz.x*1.3+TIME*0.6)) * 0.035;
	NORMAL_MAP = vec3(0.5 + rip.x, 0.5 + rip.y, 1.0);
	ALBEDO = deep;
	METALLIC = mix(0.92, 0.7, 1.0 - r);
	ROUGHNESS = 0.04;
	SPECULAR = 0.9;
}
"""
	mat.set_shader_parameter("R", P.r)
	var water := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(P.r * 2.0, P.r * 2.0)
	plane.subdivide_width = 8
	plane.subdivide_depth = 8
	water.mesh = plane
	water.material_override = mat
	water.position = Vector3(P.x, P.y, P.z)
	add_child(water)

## BLOSSOM through the oculus, on to the water: each petal falls, sways and
## starts again at the top, all of it worked out from the clock on the card.
func _petals(O: Dictionary) -> void:
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, skip_vertex_transform;
uniform float top; uniform float floor_y = 0.25;
varying float vSpin;
void vertex(){
	vec4 s = INSTANCE_CUSTOM;               // speed, phase, sway rate, start
	float span = top - floor_y;
	float spd = 0.35 + s.x * 0.5;
	float life = span / spd;
	float age = fract(TIME / life + s.w) * life;
	float ph = s.y * 6.28 + TIME * (0.4 + s.z * 0.8);
	vec3 p = vec3(sin(ph) * 0.35, top - age * spd, cos(ph * 0.8) * 0.3);
	vec4 mv = MODELVIEW_MATRIX * vec4(p, 1.0);
	float a = ph * 0.7;
	mat2 rot = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a)));
	mv.xy += rot * (VERTEX.xy * vec2(0.14, 0.09));
	VERTEX = mv.xyz;
}
void fragment(){
	vec2 q = (UV - 0.5) * 2.0;
	if(dot(q, q) > 1.0) discard;
	ALBEDO = mix(vec3(1.0, 0.76, 0.82), vec3(0.87, 0.3, 0.45), smoothstep(0.2, 1.0, -q.x));
}
"""
	mat.set_shader_parameter("top", O.y + 4.0)
	var q := QuadMesh.new()
	q.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = q
	mm.instance_count = 220
	for i in mm.instance_count:
		var a := randf() * TAU
		var r: float = sqrt(randf()) * O.r * 0.95
		mm.set_instance_transform(i, Transform3D(Basis(), Vector3(O.x + cos(a) * r, 0, O.z + sin(a) * r)))
		mm.set_instance_custom_data(i, Color(randf(), randf(), randf(), randf()))
	mm.custom_aabb = AABB(Vector3(-10, -2, -10), Vector3(20, O.y + 10.0, 20))
	petals = MultiMeshInstance3D.new()
	petals.multimesh = mm
	petals.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(petals)

func _doves(O: Dictionary) -> void:
	var white := StandardMaterial3D.new()
	white.albedo_color = Color("f4f4f0")
	white.cull_mode = BaseMaterial3D.CULL_DISABLED
	for i in 3:
		var d := Node3D.new()
		var body := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.16
		sm.height = 0.32
		sm.material = white
		body.mesh = sm
		body.scale = Vector3(1, 0.8, 2.2)
		d.add_child(body)
		var wings := []
		for s in [-1.0, 1.0]:
			var pivot := Node3D.new()
			var w := MeshInstance3D.new()
			var pm := PlaneMesh.new()
			pm.size = Vector2(0.55, 0.22)
			pm.material = white
			w.mesh = pm
			w.position.x = s * 0.3
			pivot.add_child(w)
			pivot.set_meta("s", s)
			d.add_child(pivot)
			wings.append(pivot)
		d.set_meta("wings", wings)
		d.set_meta("u", {"a": i * 2.1, "r": 4.0 + i * 1.6, "h": O.y + 3.0 + i * 1.4, "sp": 0.35 + i * 0.08})
		add_child(d)
		doves.append(d)

func _process(delta: float) -> void:
	t += delta
	var O: Dictionary = L.oculus
	for d in doves:
		var u: Dictionary = d.get_meta("u")
		u.a += u.sp * delta
		d.position = Vector3(O.x + cos(u.a) * u.r, u.h + sin(t * 0.7 + u.a) * 0.6, O.z + sin(u.a) * u.r)
		# nose along the way it is flying round
		d.rotation.y = -u.a
		var f := sin(t * 9.0 + u.a * 3.0) * 0.7
		for w in d.get_meta("wings"):
			(w as Node3D).rotation.z = float(w.get_meta("s")) * f
