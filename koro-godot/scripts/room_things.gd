## THE THINGS A CHAT ROOM CAN HOLD — how each type in data/chatrooms.json
## looks. Every builder makes one Node3D standing on its own floor spot, its
## front towards +z, about the size the catalog's "solid" box says. Colour
## and text come from the object's props. What a thing DOES is not here: that
## is its behaviour, in chatroom.gd.
##
## Most are a handful of boxes and cylinders — a room can hold a hundred and
## fifty things, and a chair does not need a model — and the rest are the
## game's own models (the shop's props, the panda, the Seraph, the cast).
class_name RoomThings
extends RefCounted

static var _mats := {}

static func build(type: String, props: Dictionary, spec: Dictionary) -> Node3D:
	var n := Node3D.new()
	match type:
		"table": _table(n)
		"chair": _chair(n)
		"couch": _couch(n, _col(props, "#9b6bff"))
		"bed": _bed(n, _col(props, "#27a3b3"))
		"desk": _desk(n)
		"bookshelf": _bookshelf(n)
		"rug": _rug(n, _col(props, "#ff6ad5"))
		"school_desk": _school_desk(n)
		"plant": _plant(n)
		"floor_lamp": _floor_lamp(n, _col(props, "#ffd766"))
		"poster": _poster(n, int(props.get("art", 1)))
		"neon_sign": _neon(n, str(props.get("text", "MY ROOM")), _col(props, "#ff6ad5"))
		"statue": _statue(n, str(props.get("who", "nia")))
		"globe": _globe(n)
		"crate": _crate(n)
		"portal": _portal(n, str(props.get("to", "")))
		"light_switch": _switch(n)
		"jukebox": _jukebox(n)
		"tv": _tv(n)
		"arcade": _arcade(n)
		"robot": _robot(n)
		_:
			if spec.has("model"):
				_model(n, str(spec.model), float(spec.get("height", 1.5)))
	return n

# ---------------------------------------------------------------- the kit

static func _col(props: Dictionary, dflt: String) -> Color:
	return Color(str(props.get("color", dflt)))

static func mat(c: Color, rough := 0.8, metal := 0.0, glow := 0.0) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f|%.2f" % [c.to_html(), rough, metal, glow]
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.roughness = rough
		m.metallic = metal
		if glow > 0.0:
			m.emission_enabled = true
			m.emission = c
			m.emission_energy_multiplier = glow
		_mats[key] = m
	return _mats[key]

static func box(p: Node3D, size: Vector3, at: Vector3, m: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = m
	mi.position = at
	mi.rotation = rot
	p.add_child(mi)
	return mi

static func cyl(p: Node3D, r0: float, r1: float, h: float, at: Vector3, m: Material, segs := 20) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r0
	c.bottom_radius = r1
	c.height = h
	c.radial_segments = segs
	mi.mesh = c
	mi.material_override = m
	mi.position = at
	p.add_child(mi)
	return mi

static func ball(p: Node3D, r: float, at: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	mi.mesh = s
	mi.material_override = m
	mi.position = at
	p.add_child(mi)
	return mi

static func label(p: Node3D, text: String, at: Vector3, size: int, c: Color, glow := false) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.005
	l.outline_size = 8 if not glow else 0
	l.modulate = c * (2.2 if glow else 1.0)
	l.shaded = false
	l.position = at
	p.add_child(l)
	return l

const WOOD := Color("8a5a3b")
const DARK_WOOD := Color("5b3a29")
const STEEL := Color("9aa3b5")

# ------------------------------------------------------------- furniture

static func _legs(n: Node3D, w: float, d: float, h: float, m: Material) -> void:
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			box(n, Vector3(0.07, h, 0.07), Vector3(sx * (w / 2.0 - 0.06), h / 2.0, sz * (d / 2.0 - 0.06)), m)

static func _table(n: Node3D) -> void:
	box(n, Vector3(2.0, 0.08, 1.2), Vector3(0, 0.86, 0), mat(WOOD, 0.55))
	_legs(n, 2.0, 1.2, 0.82, mat(DARK_WOOD))

static func _chair(n: Node3D) -> void:
	var m := mat(Color("b58a5f"), 0.6)
	box(n, Vector3(0.6, 0.08, 0.6), Vector3(0, 0.46, 0), m)
	_legs(n, 0.6, 0.6, 0.44, mat(DARK_WOOD))
	box(n, Vector3(0.6, 0.62, 0.06), Vector3(0, 0.8, -0.28), m)
	n.set_meta("sit_h", 0.5)

static func _couch(n: Node3D, c: Color) -> void:
	var m := mat(c, 0.95)
	box(n, Vector3(2.4, 0.4, 0.95), Vector3(0, 0.22, 0), mat(c.darkened(0.35), 0.95))
	box(n, Vector3(2.1, 0.16, 0.8), Vector3(0, 0.5, 0.06), m)
	box(n, Vector3(2.4, 0.6, 0.26), Vector3(0, 0.72, -0.36), m)
	for sx in [-1.0, 1.0]:
		box(n, Vector3(0.24, 0.36, 0.95), Vector3(sx * 1.08, 0.58, 0), m)
	n.set_meta("sit_h", 0.58)

static func _bed(n: Node3D, c: Color) -> void:
	box(n, Vector3(1.8, 0.35, 2.4), Vector3(0, 0.18, 0), mat(DARK_WOOD))
	box(n, Vector3(1.7, 0.25, 2.3), Vector3(0, 0.47, 0), mat(Color("f4efe6"), 0.95))
	box(n, Vector3(1.74, 0.07, 1.45), Vector3(0, 0.62, 0.4), mat(c, 0.95))
	box(n, Vector3(1.2, 0.16, 0.42), Vector3(0, 0.68, -0.85), mat(Color("ffffff"), 0.95))
	box(n, Vector3(1.8, 1.05, 0.12), Vector3(0, 0.75, -1.18), mat(DARK_WOOD))
	n.set_meta("sit_h", 0.62)

static func _desk(n: Node3D) -> void:
	box(n, Vector3(1.8, 0.06, 0.9), Vector3(0, 0.77, 0), mat(WOOD, 0.5))
	box(n, Vector3(0.5, 0.72, 0.84), Vector3(0.62, 0.37, 0), mat(DARK_WOOD))
	for sx in [-1.0]:
		for sz in [-1.0, 1.0]:
			box(n, Vector3(0.06, 0.74, 0.06), Vector3(sx * 0.84, 0.37, sz * 0.4), mat(DARK_WOOD))
	# a laptop, open
	box(n, Vector3(0.42, 0.02, 0.3), Vector3(-0.25, 0.81, 0.05), mat(Color("2e2a33"), 0.4, 0.5))
	box(n, Vector3(0.42, 0.28, 0.02), Vector3(-0.25, 0.95, -0.11), mat(Color("8ff0ff"), 0.3, 0.0, 1.2), Vector3(-0.25, 0, 0))

static func _bookshelf(n: Node3D) -> void:
	var m := mat(DARK_WOOD)
	for sx in [-1.0, 1.0]:
		box(n, Vector3(0.06, 2.2, 0.45), Vector3(sx * 0.87, 1.1, 0), m)
	box(n, Vector3(1.8, 2.2, 0.03), Vector3(0, 1.1, -0.21), m)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var cols := ["d42a35", "27a3b3", "ffd766", "9b6bff", "3f7a35", "ff9f43", "f4efe6"]
	for i in 5:
		var y := 0.05 + i * 0.52
		box(n, Vector3(1.74, 0.04, 0.42), Vector3(0, y, 0), m)
		if i == 4:
			continue
		var x := -0.8
		while x < 0.75:
			var w := rng.randf_range(0.05, 0.11)
			var h := rng.randf_range(0.28, 0.42)
			box(n, Vector3(w, h, 0.3), Vector3(x + w / 2.0, y + 0.02 + h / 2.0, 0.02),
				mat(Color(cols[rng.randi() % cols.size()]), 0.8))
			x += w + 0.01

static func _rug(n: Node3D, c: Color) -> void:
	cyl(n, 1.4, 1.4, 0.02, Vector3(0, 0.012, 0), mat(c, 1.0), 40)
	cyl(n, 1.05, 1.05, 0.022, Vector3(0, 0.014, 0), mat(c.lightened(0.3), 1.0), 40)
	cyl(n, 0.6, 0.6, 0.024, Vector3(0, 0.016, 0), mat(c.darkened(0.2), 1.0), 40)

static func _school_desk(n: Node3D) -> void:
	# front towards +z, like everything else: you sit on the -z side, facing it
	box(n, Vector3(1.0, 0.05, 0.6), Vector3(0, 0.74, 0.1), mat(Color("d9c3a5"), 0.6))
	for sx in [-1.0, 1.0]:
		box(n, Vector3(0.05, 0.72, 0.5), Vector3(sx * 0.45, 0.36, 0.1), mat(STEEL, 0.4, 0.6))
	box(n, Vector3(0.45, 0.05, 0.4), Vector3(0, 0.44, -0.45), mat(Color("27a3b3"), 0.6))
	box(n, Vector3(0.45, 0.35, 0.04), Vector3(0, 0.66, -0.66), mat(Color("27a3b3"), 0.6))

static func _plant(n: Node3D) -> void:
	cyl(n, 0.28, 0.22, 0.45, Vector3(0, 0.225, 0), mat(Color("c1683c"), 0.9))
	var leaf := mat(Color("3f7a35"), 0.9)
	ball(n, 0.42, Vector3(0, 0.85, 0), leaf)
	ball(n, 0.3, Vector3(0.22, 1.15, 0.05), mat(Color("4f9457"), 0.9))
	ball(n, 0.26, Vector3(-0.2, 1.1, -0.08), leaf)

static func _floor_lamp(n: Node3D, c: Color) -> void:
	cyl(n, 0.22, 0.26, 0.05, Vector3(0, 0.025, 0), mat(Color("2e2a33"), 0.5, 0.5))
	cyl(n, 0.025, 0.025, 1.55, Vector3(0, 0.8, 0), mat(Color("2e2a33"), 0.5, 0.5))
	cyl(n, 0.16, 0.3, 0.32, Vector3(0, 1.62, 0), mat(c, 0.6, 0.0, 1.0))
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = 1.2
	l.omni_range = 6.0
	l.position = Vector3(0, 1.5, 0)
	n.add_child(l)

static func _poster(n: Node3D, art: int) -> void:
	box(n, Vector3(1.7, 2.5, 0.03), Vector3(0, 0, -0.02), mat(Color("16161d")))
	var q := QuadMesh.new()
	q.size = Vector2(1.6, 2.4)
	var m := StandardMaterial3D.new()
	var path := "res://assets/shop/poster%d.jpg" % clampi(art, 1, 3)
	if ResourceLoader.exists(path):
		m.albedo_texture = load(path)
	m.roughness = 0.7
	q.material = m
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.position = Vector3(0, 0, 0.001)
	n.add_child(mi)

static func _neon(n: Node3D, text: String, c: Color) -> void:
	var l := label(n, text, Vector3(0, 0, 0.02), 150, c, true)
	l.pixel_size = 0.006
	var g := OmniLight3D.new()
	g.light_color = c
	g.light_energy = 1.0
	g.omni_range = 5.0
	g.position = Vector3(0, 0, 0.8)
	n.add_child(g)

static func _statue(n: Node3D, who: String) -> void:
	cyl(n, 0.4, 0.45, 0.3, Vector3(0, 0.15, 0), mat(Color("e8e4f0"), 0.4, 0.2))
	var path := "res://assets/characters/character-%s.glb" % who
	if not ResourceLoader.exists(path):
		return
	var m := Models.spawn(path)
	var holder := Node3D.new()
	holder.position = Vector3(0, 0.3, 0)
	n.add_child(holder)
	holder.add_child(m)
	_fit_when_placed(n, m, 1.6)

static func _model(n: Node3D, path: String, height: float) -> void:
	if not ResourceLoader.exists(path):
		return
	var holder := Node3D.new()
	n.add_child(holder)
	var m := Models.spawn(path)
	holder.add_child(m)
	_fit_when_placed(n, m, height)

## A model is measured in the room, not before: fit_height reads the bones'
## places in the world, and a node not yet in the world has none.
static func _fit_when_placed(n: Node3D, m: Node3D, height: float) -> void:
	n.ready.connect(func():
		Models.fit_height(m, height)
		var ap := Models.anim_player(m)
		if ap and ap.has_animation("idle"):
			Models.loop_clips(ap, ["jump"])
			ap.play("idle"), CONNECT_ONE_SHOT)

static func _globe(n: Node3D) -> void:
	cyl(n, 0.3, 0.35, 0.08, Vector3(0, 0.04, 0), mat(Color("5b3a29"), 0.5, 0.3))
	cyl(n, 0.03, 0.03, 0.8, Vector3(0, 0.44, 0), mat(Color("c9a86a"), 0.3, 0.8))
	var s := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.45
	sm.height = 0.9
	s.mesh = sm
	var m := StandardMaterial3D.new()
	if ResourceLoader.exists("res://assets/sky/planet_surface.jpg"):
		m.albedo_texture = load("res://assets/sky/planet_surface.jpg")
	m.roughness = 0.5
	m.emission_enabled = true
	m.emission_texture = m.albedo_texture
	m.emission_energy_multiplier = 0.35
	s.material_override = m
	s.position = Vector3(0, 1.0, 0)
	s.name = "spin"
	n.add_child(s)

static func _crate(n: Node3D) -> void:
	box(n, Vector3(1.0, 1.0, 1.0), Vector3(0, 0.5, 0), mat(Color("a57a4a"), 0.9))
	var edge := mat(Color("6b4a2a"), 0.9)
	for y in [0.06, 0.94]:
		box(n, Vector3(1.02, 0.1, 1.02), Vector3(0, y, 0), edge)
	box(n, Vector3(1.02, 1.0, 0.1), Vector3(0, 0.5, 0), edge, Vector3(0, PI / 4.0, 0))

# ----------------------------------------------------------- interactive

static func _portal(n: Node3D, to: String) -> void:
	# its own materials: a portal fades away when a camera comes right up to
	# it (chatroom.gd), and a shared material would fade them all
	var ring := MeshInstance3D.new()
	ring.name = "ring"
	var t := TorusMesh.new()
	t.inner_radius = 1.25
	t.outer_radius = 1.45
	t.rings = 48
	ring.mesh = t
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color("8ff0ff")
	rm.roughness = 0.2
	rm.metallic = 0.3
	rm.emission_enabled = true
	rm.emission = Color("8ff0ff")
	rm.emission_energy_multiplier = 2.5
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = rm
	ring.rotation = Vector3(PI / 2.0, 0, 0)
	ring.position = Vector3(0, 1.5, 0)
	n.add_child(ring)
	var disc := MeshInstance3D.new()
	disc.name = "disc"
	var q := QuadMesh.new()
	q.size = Vector2(2.6, 2.6)
	disc.mesh = q
	var sm := ShaderMaterial.new()
	sm.shader = Shader.new()
	sm.shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, cull_back, depth_draw_never;
uniform float fade = 1.0;
void fragment(){
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float a = atan(p.y, p.x);
	float swirl = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - TIME * 3.0);
	float k = smoothstep(1.0, 0.2, r);
	ALBEDO = mix(vec3(0.2, 0.5, 1.0), vec3(0.6, 1.0, 1.0), swirl) * 1.4;
	ALPHA = k * (0.35 + 0.4 * swirl) * fade;
}
"""
	disc.material_override = sm
	disc.position = Vector3(0, 1.5, 0)
	n.add_child(disc)
	var tag := label(n, "EXIT TO KORO" if to == "" else "TO ROOM %s" % to, Vector3(0, 3.2, 0), 60, Color("ffe9a8"))
	tag.name = "tag"
	tag.double_sided = false
	var l := OmniLight3D.new()
	l.light_color = Color("8ff0ff")
	l.light_energy = 1.2
	l.omni_range = 5.0
	l.position = Vector3(0, 1.5, 0.6)
	n.add_child(l)

static func _switch(n: Node3D) -> void:
	box(n, Vector3(0.18, 0.28, 0.03), Vector3(0, 0, 0.015), mat(Color("f4efe6"), 0.4))
	var nub := box(n, Vector3(0.05, 0.1, 0.04), Vector3(0, 0.03, 0.045), mat(Color("ffd766"), 0.4, 0.0, 0.6))
	nub.name = "nub"

static func _jukebox(n: Node3D) -> void:
	box(n, Vector3(1.0, 1.3, 0.62), Vector3(0, 0.65, 0), mat(Color("5b3a29"), 0.4, 0.2))
	cyl(n, 0.5, 0.5, 0.62, Vector3(0, 1.3, 0), mat(Color("5b3a29"), 0.4, 0.2), 32).rotation = Vector3(PI / 2.0, 0, 0)
	var panel := box(n, Vector3(0.78, 0.9, 0.04), Vector3(0, 0.95, 0.32), mat(Color("ff9f43"), 0.3, 0.0, 1.4))
	panel.name = "panel"
	box(n, Vector3(0.7, 0.3, 0.04), Vector3(0, 0.32, 0.32), mat(Color("2e2a33"), 0.9))
	var l := label(n, "JUKEBOX", Vector3(0, 1.62, 0.33), 42, Color("ffe9a8"))
	l.name = "tag"

static func _tv(n: Node3D) -> void:
	box(n, Vector3(1.2, 0.5, 0.45), Vector3(0, 0.25, 0), mat(DARK_WOOD))
	box(n, Vector3(2.2, 1.3, 0.08), Vector3(0, 1.2, 0), mat(Color("16161d"), 0.3, 0.4))
	var screen := box(n, Vector3(2.04, 1.14, 0.02), Vector3(0, 1.2, 0.05), mat(Color("1f3b5c"), 0.3, 0.0, 1.0))
	screen.name = "screen"
	var l := label(n, "", Vector3(0, 1.2, 0.07), 64, Color("ffffff"))
	l.name = "text"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.width = 380.0

static func _arcade(n: Node3D) -> void:
	var body := mat(Color("9b6bff"), 0.5, 0.1)
	box(n, Vector3(0.9, 1.9, 0.8), Vector3(0, 0.95, 0), body)
	var screen := box(n, Vector3(0.72, 0.56, 0.04), Vector3(0, 1.38, 0.39), mat(Color("0b0d18"), 0.3, 0.0, 1.0), Vector3(-0.2, 0, 0))
	screen.name = "screen"
	box(n, Vector3(0.9, 0.12, 0.3), Vector3(0, 0.98, 0.5), mat(Color("2e2a33"), 0.6))
	cyl(n, 0.025, 0.025, 0.14, Vector3(-0.2, 1.1, 0.5), mat(Color("d42a35"), 0.3))
	for i in 3:
		cyl(n, 0.035, 0.035, 0.03, Vector3(0.05 + i * 0.1, 1.05, 0.5), mat(Color(["ff6a6a", "ffd766", "8ff0ff"][i]), 0.3, 0.0, 0.8))
	label(n, "ARCADE", Vector3(0, 1.8, 0.41), 40, Color("ffd766"), true)
	var l := label(n, "PRESS E", Vector3(0, 1.37, 0.43), 26, Color("a8e6cf"))
	l.name = "text"
	l.rotation = Vector3(-0.2, 0, 0)

static func _robot(n: Node3D) -> void:
	var body := Node3D.new()
	body.name = "body"
	n.add_child(body)
	var teal := mat(Color("27a3b3"), 0.35, 0.5)
	var dark := mat(Color("2e2a33"), 0.5, 0.4)
	cyl(body, 0.12, 0.12, 0.7, Vector3(-0.3, 0.14, 0), dark).rotation = Vector3(0, 0, PI / 2.0)
	box(body, Vector3(0.7, 0.55, 0.5), Vector3(0, 0.55, 0), teal)
	box(body, Vector3(0.5, 0.34, 0.42), Vector3(0, 1.0, 0), mat(Color("e8e4f0"), 0.3, 0.3))
	for sx in [-1.0, 1.0]:
		ball(body, 0.06, Vector3(sx * 0.11, 1.02, 0.21), mat(Color("8ff0ff"), 0.2, 0.0, 3.0))
		cyl(body, 0.1, 0.1, 0.12, Vector3(sx * 0.37, 0.12, 0.15), dark).rotation = Vector3(0, 0, PI / 2.0)
		cyl(body, 0.1, 0.1, 0.12, Vector3(sx * 0.37, 0.12, -0.15), dark).rotation = Vector3(0, 0, PI / 2.0)
	cyl(body, 0.012, 0.012, 0.3, Vector3(0, 1.3, 0), dark)
	ball(body, 0.05, Vector3(0, 1.46, 0), mat(Color("ff6a6a"), 0.3, 0.0, 2.0))
	var say := label(body, "", Vector3(0, 1.8, 0), 44, Color("ffffff"))
	say.name = "say"
	say.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	say.outline_size = 12
