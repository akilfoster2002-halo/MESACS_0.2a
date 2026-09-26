## CRUISE — flying there yourself (public/cruise.js).
##
## A world you can reach by pressing a button is not somewhere you went. So
## the ship is a real ship: you board it on the Pad and fly the crossing
## yourself, through the only part of this game that is purely worth looking
## at — nebulae, arches of light, comets, a field of tumbling rock.
##
## THE SHIP NEVER MOVES. It sits at the origin pointing wherever you point it,
## and the sky moves past it the other way at the ship's own speed. That is
## what keeps the numbers small: a thirty-six kilometre journey flown honestly
## would put the ship where a float has no centimetres left.
##
## THE CAR'S CONTROLS, because it is the same question: W to go, S to slow,
## let go and it runs down; the mouse (or the arrows) turns the nose and the
## roll follows the turn; SHIFT is the boost. You start stopped, and you
## arrive because you flew there — pointing away, the ETA says so.
class_name Cruise
extends Node3D

const TOP := 300.0
const REVERSE := -80.0
const ACCEL := 130.0
const BRAKE := 240.0
const DRAG := 30.0
const BOOST := 1.8
const TRIP_SECONDS := 120.0
const TRIP := TOP * TRIP_SECONDS
const ARRIVE := 780.0
const DRAW_MAX := 15000.0
const FIELD := 4200.0
const GLOBE_R := 900.0

## Where each world hangs in the one frame everybody shares.
const AT := {"hub": Vector3(0, 0, 0), "arena": Vector3(0, 0, -TRIP), "home": Vector3(TRIP * 0.72, TRIP * 0.12, -TRIP * 0.35)}

static var target := "arena"

var field: Node3D
var ship: Node3D
var glow: MeshInstance3D
var cam: Camera3D
var rocks: MultiMeshInstance3D
var rock_spin: Array = []
var things: Array = []           # nebulae, arches and comets, recycled as you pass
var dest_globe: Node3D
var home_globe: Node3D
var where := Vector3.ZERO
var dest_at := Vector3.ZERO
var home_at := Vector3.ZERO
var start_dist := TRIP
var real_dist := TRIP
var speed := 0.0
var boost := 0.0
var yaw := 0.0
var pitch := 0.0
var roll := 0.0
var roll_v := 0.0
var look := Vector2.ZERO
var q := Basis()
var fwd := Vector3(0, 0, -1)
var clock := 0.0
var done := false
var hud_line: Label
var hud_bar: ColorRect
var hud_mark: Label
var hud_say: Label
var streaks: MultiMeshInstance3D
## EVERYBODY ELSE OUT HERE (net.gd's in_space, public/cruise.js's seePlayers):
## the ships crossing at the same time as you, each eased onto the last place
## it said it was, drawn along its true bearing from where WE are.
var net: Net
var crowd: Node3D
var mates := {}                  # id -> {node, at, to, yaw, tyaw, pit, tpit}
var sent_t := 0.0

func _ready() -> void:
	randomize()
	var from_id := Worlds.current
	dest_at = AT.get(target, Vector3.ZERO)
	home_at = AT.get(from_id, Vector3.ZERO)
	# leave from just outside the orbit of where you were, pointed at the way
	var away := (dest_at - home_at).normalized()
	where = home_at + away * (ARRIVE + 260.0)
	yaw = atan2(-away.x, -away.z)
	pitch = asin(clampf(away.y, -1.0, 1.0))
	start_dist = (dest_at - where).length()
	real_dist = start_dist
	_space()
	_ship()
	_sky()
	_hud()
	_room()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_say("Fire the engines: W. Steer with the mouse. %s is the marker." % Worlds.get_world(target).name, 4.0)

## THE ROOM COMES WITH YOU. The socket is the game's, not the world's, so it
## is still open out here — and it has to be told, because a ship that stops
## reporting does not leave the planet it took off from, it stands still on
## it. What goes out is in_space(); what comes back is everybody else's, and
## the ones who are also out here get drawn.
func _room() -> void:
	crowd = Node3D.new()
	add_child(crowd)
	net = get_node("/root/Online")
	net.players_in.connect(_see)
	tree_exiting.connect(func(): net.players_in.disconnect(_see))

func _space() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.008, 0.008, 0.02)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.55, 0.75)
	env.ambient_light_energy = 0.5
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.9
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.95, 0.85)
	sun.light_energy = 1.4
	sun.rotation = Vector3(-0.5, 0.8, 0)
	add_child(sun)
	field = Node3D.new()
	add_child(field)

func _ship() -> void:
	ship = Building.ship_model(9.0)
	add_child(ship)
	glow = MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.9
	cone.bottom_radius = 0.1
	cone.height = 4.0
	glow.mesh = cone
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.55, 0.9, 1.0, 0.7)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	glow.material_override = m
	glow.rotation.x = -PI / 2.0
	glow.position = Vector3(0, 1.0, 5.4)
	ship.add_child(glow)
	cam = Camera3D.new()
	cam.far = 20000.0
	cam.fov = 66.0
	add_child(cam)
	cam.current = true

# ------------------------------------------------------------- the sky

func _soft() -> Shader:
	var s := Shader.new()
	s.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, fog_disabled;
uniform vec4 tint : source_color;
void vertex(){
	// face the camera, keep the size
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0, 0, 0), vec4(0, length(MODEL_MATRIX[1].xyz), 0, 0), vec4(0, 0, 1, 0), vec4(0, 0, 0, 1));
}
void fragment(){
	float d = length(UV - 0.5) * 2.0;
	float a = pow(max(0.0, 1.0 - d), 2.2);
	ALBEDO = tint.rgb * a * tint.a;
}
"""
	return s

func _sky() -> void:
	# two shells of stars that sit on the ship, so they never get closer
	for shell in [[2600, 2400.0, 3.0], [1400, 1800.0, 2.0]]:
		var star := QuadMesh.new()
		star.size = Vector2(shell[2], shell[2])
		var sm := StandardMaterial3D.new()
		sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		star.material = sm
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = star
		mm.instance_count = shell[0]
		for i in mm.instance_count:
			var d := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized()
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * randf_range(0.5, 1.4)), d * shell[1]))
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		add_child(mi)
	var soft := _soft()
	# NEBULAE: a dozen soft blobs in two colours each, so it has depth
	var pal := [[Color("ff6ad5"), Color("7a4fd0")], [Color("8ff0ff"), Color("2a6fd0")], [Color("ffb4a2"), Color("ff6a6a")], [Color("a8e6cf"), Color("3a9a7a")]]
	for n in 9:
		var g := Node3D.new()
		var cols: Array = pal[n % pal.size()]
		for i in 12:
			var q2 := QuadMesh.new()
			var mat := ShaderMaterial.new()
			mat.shader = soft
			var c: Color = cols[i % 2]
			c.a = randf_range(0.10, 0.22)
			mat.set_shader_parameter("tint", c)
			q2.material = mat
			var mi := MeshInstance3D.new()
			mi.mesh = q2
			var sz := randf_range(260.0, 900.0)
			mi.scale = Vector3(sz, sz, 1)
			mi.position = Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * 520.0
			mi.custom_aabb = AABB(Vector3(-1, -1, -1), Vector3(2, 2, 2))
			g.add_child(mi)
		field.add_child(g)
		_place(g, true)
		things.append({"n": g, "pad": 900.0, "spin": 0.0})
	# ARCHES: rings of light hanging in space, big enough to fly through
	for n in 6:
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		var r := randf_range(55.0, 110.0)
		tm.inner_radius = r
		tm.outer_radius = r + 5.0
		tm.rings = 64
		ring.mesh = tm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = [Color("8ff0ff"), Color("ff6ad5"), Color("ffe9a8")][n % 3]
		ring.material_override = m
		var g := Node3D.new()
		g.add_child(ring)
		ring.rotation.x = PI / 2.0
		field.add_child(g)
		_place(g, true)
		things.append({"n": g, "pad": 150.0, "spin": randf_range(-0.2, 0.2)})
	# COMETS: a hot head and a tail
	for n in 5:
		var g := Node3D.new()
		var head := MeshInstance3D.new()
		var sm2 := SphereMesh.new()
		sm2.radius = 6.0
		sm2.height = 12.0
		var hm := StandardMaterial3D.new()
		hm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		hm.albedo_color = Color("f4fbff")
		sm2.material = hm
		head.mesh = sm2
		g.add_child(head)
		var tail := MeshInstance3D.new()
		var tc := CylinderMesh.new()
		tc.top_radius = 0.0
		tc.bottom_radius = 7.0
		tc.height = 160.0
		var tmat := StandardMaterial3D.new()
		tmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		tmat.albedo_color = Color(0.6, 0.85, 1.0, 0.35)
		tmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		tmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		tc.material = tmat
		tail.mesh = tc
		tail.position = Vector3(80.0, 0, 0)
		tail.rotation.z = PI / 2.0
		g.add_child(tail)
		field.add_child(g)
		_place(g, true)
		things.append({"n": g, "pad": 200.0, "spin": 0.0, "drift": Vector3(randf_range(-30, 30), randf_range(-10, 10), randf_range(-30, 30))})
	# ROCK: two hundred and forty, tumbling, one draw call
	var rock := SphereMesh.new()
	rock.radius = 1.0
	rock.height = 1.7
	rock.radial_segments = 6
	rock.rings = 3
	var rmat := StandardMaterial3D.new()
	rmat.albedo_color = Color("6e6b74")
	rmat.roughness = 1.0
	rock.material = rmat
	var mm2 := MultiMesh.new()
	mm2.transform_format = MultiMesh.TRANSFORM_3D
	mm2.mesh = rock
	mm2.instance_count = 240
	for i in mm2.instance_count:
		var p := _somewhere(true)
		var s := randf_range(3.0, 22.0)
		mm2.set_instance_transform(i, Transform3D(Basis.from_euler(Vector3(randf() * 3, randf() * 3, randf() * 3)).scaled(Vector3.ONE * s), p))
		rock_spin.append(Vector3(randf_range(-0.4, 0.4), randf_range(-0.4, 0.4), randf_range(-0.4, 0.4)))
	mm2.custom_aabb = AABB(Vector3.ONE * -FIELD * 3.0, Vector3.ONE * FIELD * 6.0)
	rocks = MultiMeshInstance3D.new()
	rocks.multimesh = mm2
	field.add_child(rocks)
	# the two worlds, drawn at their true bearing and shrunk to fit the sky
	dest_globe = _globe(Worlds.get_world(target))
	home_globe = _globe(Worlds.here())
	# speed streaks, in the camera's own space
	streaks = _streak_field()
	cam.add_child(streaks)

func _globe(w: Dictionary) -> Node3D:
	var g := Node3D.new()
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	s.radial_segments = 48
	s.rings = 24
	var m := StandardMaterial3D.new()
	m.albedo_color = w.globe
	m.emission_enabled = true
	m.emission = (w.globe as Color) * 0.25
	m.rim_enabled = true
	m.rim = 1.0
	m.rim_tint = 0.2
	s.material = m
	mi.mesh = s
	mi.custom_aabb = AABB(Vector3(-2, -2, -2), Vector3(4, 4, 4))
	g.add_child(mi)
	var tag := Label3D.new()
	tag.text = str(w.name)
	tag.font_size = 64
	tag.pixel_size = 0.004
	tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	tag.fixed_size = true
	tag.no_depth_test = true
	tag.modulate = w.globe.lightened(0.4)
	tag.position = Vector3(0, 1.25, 0)
	g.add_child(tag)
	add_child(g)
	return g

func _streak_field() -> MultiMeshInstance3D:
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, fog_disabled;
uniform float k = 0.0;
uniform float spd = 0.0;
varying float vA;
void vertex(){
	vec4 c = INSTANCE_CUSTOM;
	float a = c.x * 6.2832;
	float r = 6.0 + c.y * 26.0;
	float u = fract(TIME * (0.6 + spd / 200.0) + c.z);
	float z = -160.0 + u * 180.0;
	vec3 tan = vec3(-sin(a), cos(a), 0.0);
	VERTEX = vec3(cos(a), sin(a), 0.0) * r + vec3(0.0, 0.0, z) + tan * VERTEX.x * 0.12 + vec3(0.0, 0.0, 1.0) * VERTEX.y * (8.0 + c.w * 14.0);
	vA = k * sin(3.1416 * u);
}
void fragment(){ ALBEDO = vec3(0.8, 0.9, 1.0) * vA * 0.6; }
"""
	var q2 := QuadMesh.new()
	q2.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = q2
	mm.instance_count = 140
	for i in mm.instance_count:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(randf(), randf(), randf(), randf()))
	mm.custom_aabb = AABB(Vector3(-40, -40, -200), Vector3(80, 80, 240))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	return mi

## A point inside the field, relative to the field node; `anywhere` scatters
## through the whole sphere, otherwise it is put out ahead of the nose.
func _somewhere(anywhere: bool) -> Vector3:
	var p: Vector3
	if anywhere:
		p = Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized() * FIELD * sqrt(randf())
	else:
		var side := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * FIELD * 0.6
		p = fwd * FIELD * randf_range(0.6, 0.95) + side
	return p - field.position

func _place(n: Node3D, anywhere: bool) -> void:
	n.position = _somewhere(anywhere)
	n.rotation = Vector3(randf() * TAU, randf() * TAU, randf() * TAU)

# ------------------------------------------------------------- the HUD

func _hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud_line = Label.new()
	hud_line.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hud_line.offset_left = -400
	hud_line.offset_right = 400
	hud_line.offset_top = -92
	hud_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_line.add_theme_font_size_override("font_size", 20)
	layer.add_child(hud_line)
	var back := ColorRect.new()
	back.color = Color(1, 1, 1, 0.15)
	back.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	back.offset_left = -300
	back.offset_right = 300
	back.offset_top = -52
	back.offset_bottom = -46
	layer.add_child(back)
	hud_bar = ColorRect.new()
	hud_bar.color = Color("8ff0ff")
	hud_bar.position = Vector2(0, 0)
	hud_bar.size = Vector2(0, 6)
	back.add_child(hud_bar)
	hud_mark = Label.new()
	hud_mark.add_theme_font_size_override("font_size", 22)
	hud_mark.add_theme_color_override("font_color", Color("ffe9a8"))
	layer.add_child(hud_mark)
	hud_say = Label.new()
	hud_say.set_anchors_preset(Control.PRESET_CENTER_TOP)
	hud_say.offset_left = -420
	hud_say.offset_right = 420
	hud_say.offset_top = 60
	hud_say.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_say.add_theme_font_size_override("font_size", 22)
	layer.add_child(hud_say)
	var keys := Label.new()
	keys.text = "W go · S slow · mouse / arrows steer · A D roll · SHIFT boost · R turn back"
	keys.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	keys.offset_left = 16
	keys.offset_top = -30
	keys.add_theme_font_size_override("font_size", 14)
	keys.modulate = Color(1, 1, 1, 0.7)
	layer.add_child(keys)

var _say_t := 0.0
func _say(t: String, secs := 3.0) -> void:
	hud_say.text = t
	_say_t = secs

# ------------------------------------------------------------- flying

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		look += ev.relative
	elif ev is InputEventMouseButton and ev.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif ev is InputEventKey and ev.pressed and not ev.echo:
		if ev.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif ev.physical_keycode == KEY_R:
			_turn_back()

func _process(delta: float) -> void:
	clock += delta
	_fly(delta)
	_sky_tick(delta)
	_paint()
	_say_t -= delta
	hud_say.modulate.a = clampf(_say_t / 0.6, 0.0, 1.0)
	Sound.wind(clampf(speed / (TOP * BOOST), 0.0, 1.0) * 0.6)
	_mates_tick(delta)
	# eleven times a second, the same rate the ground uses
	sent_t -= delta
	if sent_t <= 0.0:
		sent_t = 0.09
		net.in_space(where, yaw, pitch)
	if not done and real_dist <= ARRIVE:
		_arrive()

# ------------------------------------------------------ everybody else out here

func _see(list: Array) -> void:
	if crowd == null:
		return
	var seen := {}
	for p in list:
		if str(p.get("at", "")) != "space":   # they are on a planet, not out here
			continue
		var id := int(p.id)
		seen[id] = true
		var at := Vector3(float(p.get("x", 0)), float(p.get("y", 0)), float(p.get("z", 0)))
		var m: Dictionary = mates.get(id, {})
		if m.is_empty():
			var n := Node3D.new()
			crowd.add_child(n)
			# the hull is scaled down when they are drawn short of where they
			# really are; the name over it is not, so it stays legible
			var hull := Building.ship_model(9.0)
			n.add_child(hull)
			var tag := Label3D.new()
			tag.text = str(p.get("display", "?")).substr(0, 16)
			tag.font_size = 48
			tag.pixel_size = 0.004
			tag.outline_size = 8
			tag.modulate = Color("8fd3ff")
			tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			# a ship forty kilometres off is a pixel, and a name tag on a pixel
			# is unreadable — so the tag holds its size however far away they are
			tag.fixed_size = true
			tag.no_depth_test = true
			tag.position = Vector3(0, 1.25, 0)
			n.add_child(tag)
			m = {"node": n, "hull": hull, "at": at, "to": at, "yaw": float(p.get("yaw", 0)),
				"tyaw": float(p.get("yaw", 0)), "pit": float(p.get("pit", 0)),
				"tpit": float(p.get("pit", 0))}
			mates[id] = m
		m.to = at
		m.tyaw = float(p.get("yaw", 0))
		m.tpit = float(p.get("pit", 0))
	for id in mates.keys():
		if not seen.has(id):
			(mates[id].node as Node3D).queue_free()
			mates.erase(id)

## Presence lands about eleven times a second, which is nowhere near a frame
## rate — so what arrives is a TARGET and the frame eases onto it, the way the
## ground does with people walking. Drawn along their true bearing and pulled
## in to the far plane if they are past it, exactly as a planet is (_show).
func _mates_tick(delta: float) -> void:
	if mates.is_empty():
		return
	var k := 1.0 - pow(0.0009, minf(delta, 0.1))
	for id in mates:
		var m: Dictionary = mates[id]
		m.at = (m.at as Vector3).lerp(m.to, k)
		m.yaw += wrapf(m.tyaw - m.yaw, -PI, PI) * k
		m.pit += (m.tpit - m.pit) * k
		var n: Node3D = m.node
		var to: Vector3 = m.at - where
		var dist := maxf(1.0, to.length())
		var f := minf(dist, DRAW_MAX) / dist
		n.position = to * f
		n.basis = Basis(Vector3.UP, m.yaw) * Basis(Vector3.RIGHT, m.pit)
		(m.hull as Node3D).scale = Vector3.ONE * f

func _fly(delta: float) -> void:
	var kx := Input.get_axis("ui_left", "ui_right")
	var ky := Input.get_axis("ui_up", "ui_down")
	var mx := look.x * 0.0016 + kx * delta * 1.15
	var my := look.y * 0.0016 + ky * delta * 0.95
	look = Vector2.ZERO
	yaw -= mx
	pitch = clampf(pitch - my, -1.35, 1.35)
	var hand := (1.0 if Input.is_physical_key_pressed(KEY_A) else 0.0) - (1.0 if Input.is_physical_key_pressed(KEY_D) else 0.0)
	# the roll follows the turn: a ship that banks into its own turns flies itself
	roll_v += (-mx * 9.0 + hand * 1.6 - roll_v) * minf(1.0, delta * 3.2)
	roll += roll_v * delta
	roll *= pow(0.06, delta)
	var want_boost := 1.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 0.0
	boost += (want_boost - boost) * minf(1.0, delta * 2.6)
	var top := TOP * (1.0 + boost * (BOOST - 1.0))
	var th := (1.0 if Input.is_physical_key_pressed(KEY_W) else 0.0) - (1.0 if Input.is_physical_key_pressed(KEY_S) else 0.0)
	if th > 0.0:
		speed += ACCEL * (1.0 + boost * 0.8) * delta
	elif th < 0.0:
		speed -= (BRAKE if speed > 2.0 else ACCEL * 0.7) * delta
	else:
		speed -= signf(speed) * minf(absf(speed), DRAG * delta)
	speed = clampf(speed, REVERSE, top)
	q = Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, pitch) * Basis(Vector3.BACK, roll)
	ship.basis = q
	fwd = -(q.z)
	# THE SKY MOVES, NOT THE SHIP — and this is the only thing that travels
	var vel := fwd * speed
	field.position -= vel * delta
	where += vel * delta
	# the chase camera, hung back and above, easing rather than welded on
	var back := q.z * (26.0 + boost * 10.0) + q.y * 7.5
	cam.position = cam.position.lerp(back, minf(1.0, delta * 6.0))
	cam.look_at(fwd * 60.0, q.y)
	var k := 0.28 + maxf(0.0, speed / TOP) * 0.9 + boost * 0.8
	glow.scale = Vector3(k, k * (1.7 + boost * 2.6), k)
	ship.position.y = sin(clock * 1.7) * 0.25

func _sky_tick(delta: float) -> void:
	for t in things:
		var n: Node3D = t.n
		n.rotation.z += t.spin * delta
		if t.has("drift"):
			n.position += t.drift * delta
		var p := n.position + field.position
		var d := p.length()
		if d > FIELD + t.pad or (d > t.pad * 1.5 + 300.0 and p.dot(fwd) < -t.pad * 0.35):
			_place(n, false)
	var mm := rocks.multimesh
	for i in mm.instance_count:
		var xf := mm.get_instance_transform(i)
		var s: Vector3 = rock_spin[i]
		xf.basis = xf.basis * Basis.from_euler(s * delta)
		if (xf.origin + field.position).length() > FIELD:
			xf.origin = _somewhere(false)
		mm.set_instance_transform(i, xf)
	var to_dest := dest_at - where
	real_dist = maxf(1.0, to_dest.length())
	_show(dest_globe, to_dest, real_dist)
	dest_globe.rotate_y(delta * 0.03)
	var to_home := home_at - where
	_show(home_globe, to_home, maxf(1.0, to_home.length()))
	var fast := maxf(0.0, speed / TOP - 0.55) / 1.2
	streaks.visible = fast > 0.01
	var sm := (streaks.multimesh.mesh as QuadMesh).material as ShaderMaterial
	sm.set_shader_parameter("k", clampf(fast, 0.0, 1.0))
	sm.set_shader_parameter("spd", speed)

## Drawn along its true bearing, pulled in to the far plane if it is past it
## and shrunk by the same factor — so it covers exactly the angle it should,
## and grows because you are closing on it, not because a timer says so.
func _show(g: Node3D, to: Vector3, dist: float) -> void:
	var draw := minf(dist, DRAW_MAX)
	var k := draw / dist
	g.position = to * k
	# only the sphere is scaled: a fixed-size label under a ×900 parent
	# swells to fill the screen and, drawn without depth, tints everything
	var r := GLOBE_R * k
	(g.get_child(0) as Node3D).scale = Vector3.ONE * r
	(g.get_child(1) as Node3D).position = Vector3(0, r * 1.25, 0)

func _paint() -> void:
	var p := clampf(1.0 - (real_dist - ARRIVE) / maxf(1.0, start_dist - ARRIVE), 0.0, 1.0)
	hud_bar.size.x = 600.0 * p
	var to := (dest_at - where).normalized()
	var closing := (fwd * speed).dot(to)
	var eta := "ARRIVING" if real_dist <= ARRIVE else ("— · —" if closing < 8.0 else "%d:%02d" % [int(real_dist / closing / 60.0), int(fmod(real_dist / closing, 60.0))])
	hud_line.text = "%s   %.1f km   %s   %d u/s" % [Worlds.get_world(target).name, real_dist / 1000.0, eta, speed]
	# THE COURSE MARKER: on the destination when it is ahead, on the edge of
	# the screen when it is not, so which way is answered by looking
	var vp := get_viewport().get_visible_rect().size
	var ahead := to.dot(-cam.global_basis.z) > 0.0
	var sp := cam.unproject_position(dest_globe.global_position) if ahead else vp / 2.0 - (cam.unproject_position(cam.global_position - (dest_globe.global_position - cam.global_position)) - vp / 2.0)
	var c := vp / 2.0
	var off := sp - c
	var lim := vp / 2.0 * 0.9
	if not ahead or absf(off.x) > lim.x or absf(off.y) > lim.y:
		var s := maxf(absf(off.x) / lim.x, absf(off.y) / lim.y)
		off /= maxf(s, 0.001)
	hud_mark.text = "◆ " + Worlds.get_world(target).name
	hud_mark.position = c + off - Vector2(10, 14)

func _arrive() -> void:
	done = true
	_say("Entering orbit over %s…" % Worlds.get_world(target).name, 3.0)
	await get_tree().create_timer(1.7).timeout
	_land(target)

func _turn_back() -> void:
	if done:
		return
	done = true
	_say("Turning back.", 2.0)
	await get_tree().create_timer(0.9).timeout
	_land(Worlds.current)

func _land(id: String) -> void:
	Sound.wind(0.0)
	Worlds.current = id
	Worlds.by_ship = true
	get_tree().change_scene_to_file("res://scenes/main.tscn")
