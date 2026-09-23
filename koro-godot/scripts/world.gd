## WANO — the whole slice, stood up in code the way the browser version does
## it, so the two can be compared side by side.
extends Node3D

var player: Walker
var mecha: Mecha
var pandas: Array = []
var hud_fps: Label
var hud_prompt: Label
var hud_help: Label
var hud_mecha: Label
var cockpit: Control
var solid := []          # buildings you cannot walk through

const KEYS := {
	"forward": [KEY_W, KEY_UP], "back": [KEY_S, KEY_DOWN],
	"left": [KEY_A, KEY_LEFT], "right": [KEY_D, KEY_RIGHT],
	"run": [KEY_SHIFT], "jump": [KEY_SPACE], "use": [KEY_E],
	"off": [KEY_R], "view": [KEY_V], "slam": [KEY_Q], "mouse": [KEY_ESCAPE],
}

func _ready() -> void:
	randomize()
	seed(20260923)                         # the same Wano every time you open it
	_inputs()
	_sky()
	var ground := MeshInstance3D.new()
	ground.mesh = Planet.build_mesh(6)
	add_child(ground)
	_buildings()
	_island()
	_scenery()
	_creatures()
	_hud()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _inputs() -> void:
	for action in KEYS:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in KEYS[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)

## Night over Wano: a deep blue sky, stars, a cool moon that throws real
## shadows (only near the camera — far shadows are the expensive kind), a
## little fog and glow.
func _sky() -> void:
	var env := Environment.new()
	# ONE COLOUR, NOT A SKY. Godot's sky gradient is laid out along the
	# world's Y axis, and on a ball "up" is wherever you are standing — so
	# its horizon band came out slanted across the view. The night is the
	# same in every direction; the stars do the rest.
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.025, 0.03, 0.085)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.60, 0.80)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.fog_enabled = true
	env.fog_light_color = Color(0.12, 0.13, 0.25)
	env.fog_density = 0.0016
	env.fog_sky_affect = 0.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var town := Planet.dir_of(0, 0)
	var f := Planet.frame_at(town)
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.85, 0.88, 1.0)
	moon.light_energy = 1.15
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 140.0
	add_child(moon)
	moon.look_at_from_position((town * 1.0 + f.x * 0.45 + f.z * 0.3).normalized() * 1000.0, Vector3.ZERO, f.z)

	# stars: one MultiMesh, one draw call
	var star := QuadMesh.new()
	star.size = Vector2(4, 4)
	var sm2 := StandardMaterial3D.new()
	sm2.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm2.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	sm2.albedo_color = Color(1, 1, 1)
	sm2.disable_fog = true
	star.material = sm2
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = star
	mm.instance_count = 2500
	for i in mm.instance_count:
		var d := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized()
		var sc := randf_range(0.4, 1.3)
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * sc), d * 3000.0))
	var stars := MultiMeshInstance3D.new()
	stars.multimesh = mm
	stars.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(stars)

func _buildings() -> void:
	# Mission Control, the temple built in Blender for the browser version
	var t := Models.spawn("res://assets/temple.glb")
	add_child(t)
	# THE LIGHT IS IN THE PICTURE. The temple was lit and baked in Blender;
	# its T_ meshes carry that light in their textures, so they are drawn
	# unlit — lit again on top, they came out twice as dark.
	for mi in t.find_children("T_*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for i in m.mesh.get_surface_count():
			var src := m.get_active_material(i) as StandardMaterial3D
			if src == null:
				continue
			var mat := src.duplicate() as StandardMaterial3D
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			m.set_surface_override_material(i, mat)
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var d := Planet.dir_of(0, 7)
	t.global_transform = Transform3D(Planet.frame_at(d), d * Planet.R)
	solid.append({"dir": d, "basis": Planet.frame_at(d), "w": 64.0, "d": 46.0, "h": 18.0})

## The waterfall island, hanging where it hangs in the browser (no water yet).
func _island() -> void:
	var isl := Models.spawn("res://assets/falls.glb")
	add_child(isl)
	var box := Models.bounds(isl)
	var reach := maxf(box.size.x, box.size.z) / 2.0
	var s := 34.0 / maxf(0.01, reach)
	var d := Planet.dir_of(13, 16)
	var c := box.get_center()
	var inner := Transform3D(Basis().scaled(Vector3.ONE * s), Vector3(-c.x, -(box.position.y + box.size.y * 0.72), -c.z) * s)
	isl.global_transform = Transform3D(Planet.frame_at(d, 0.35), d * (Planet.R + 62.0)) * inner

func _scenery() -> void:
	var town := Planet.dir_of(0, 0)
	var sakura := Scatter.anywhere(90, town, 300.0) + Scatter.anywhere(40, town, 900.0)
	Scatter.grow(self, "res://assets/sakura.glb", sakura, 5.0, 8.0, 0.9, 360.0)
	var bamboo := Scatter.groves(town, 30, Vector2i(5, 11), 260.0, 5.0) + Scatter.anywhere(40, town, 280.0)
	Scatter.grow(self, "res://assets/bamboo.glb", bamboo, 6.0, 11.0, 0.7, 300.0)

func _creatures() -> void:
	var town := Planet.dir_of(0, 0)
	var f := Planet.frame_at(town)
	for i in 36:
		var a := randf() * TAU
		var r := randf_range(30.0, 140.0) if i % 2 == 0 else randf_range(60.0, 360.0)
		var d := Planet.walk(town, (f.x * cos(a) + f.z * sin(a)).normalized(), r)
		if Planet.pad_k(d) < 0.5:
			continue
		var p := Panda.new()
		p.world = self
		p.dir = d
		p.fwd = Planet.frame_at(d, randf() * TAU).z
		add_child(p)
		pandas.append(p)

	# the mecha, beside the Mechanic
	mecha = Mecha.new()
	mecha.world = self
	add_child(mecha)
	var mb := Planet.dir_of(-34, 6)
	var mf := Planet.frame_at(mb)
	mecha.park(Planet.walk(mb, mf.x, 38.0), mf.z)

	# you, out in front of Mission Control, looking at its door
	player = Walker.new()
	player.world = self
	add_child(player)
	var start := Planet.dir_of(0, -3.5)
	player.place(start, Planet.dir_of(0, 7) - start)

func blocked(to: Vector3, alt: float) -> bool:
	for b in solid:
		var basis: Basis = b.basis
		var p: Vector3 = to * (Planet.R + alt) - (b.dir as Vector3) * Planet.R
		var lx := p.dot(basis.x)
		var lz := p.dot(basis.z)
		if absf(lx) < b.w / 2.0 and absf(lz) < b.d / 2.0 and alt < b.h:
			return true
	return false

func _unhandled_input(ev: InputEvent) -> void:
	if ev.is_action_pressed("mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif ev is InputEventMouseButton and ev.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif ev.is_action_pressed("use"):
		_use()
	elif ev.is_action_pressed("off"):
		if mecha.piloting:
			mecha.leave()
		elif player.mount:
			player.mount.dismount()
			player.mount = null
	elif ev.is_action_pressed("view"):
		if mecha.piloting:
			mecha.first_person = not mecha.first_person
		else:
			player.first_person = not player.first_person

func _use() -> void:
	if mecha.piloting or player.mount:
		return
	if player.dir.angle_to(mecha.dir) * Planet.R < 16.0:
		mecha.enter(player)
		return
	var p := _near_panda()
	if p:
		player.dir = p.dir
		player.fwd = p.fwd
		player.mount = p
		p.mount(player)

func _near_panda() -> Panda:
	var best: Panda = null
	var bd := 5.5
	for x in pandas:
		var p: Panda = x
		var d := p.dir.angle_to(player.dir) * Planet.R
		if d < bd:
			bd = d
			best = p
	return best

func _hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	cockpit = _cockpit()
	layer.add_child(cockpit)
	hud_fps = Label.new()
	hud_fps.position = Vector2(14, 10)
	hud_fps.add_theme_font_size_override("font_size", 16)
	layer.add_child(hud_fps)
	hud_prompt = Label.new()
	hud_prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hud_prompt.position = Vector2(-160, -120)
	hud_prompt.size = Vector2(320, 30)
	hud_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_prompt.add_theme_font_size_override("font_size", 22)
	layer.add_child(hud_prompt)
	hud_mecha = Label.new()
	hud_mecha.set_anchors_preset(Control.PRESET_CENTER_TOP)
	hud_mecha.position = Vector2(-300, 14)
	hud_mecha.size = Vector2(600, 30)
	hud_mecha.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_mecha.add_theme_font_size_override("font_size", 16)
	layer.add_child(hud_mecha)
	hud_help = Label.new()
	hud_help.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hud_help.position = Vector2(14, -34)
	hud_help.add_theme_font_size_override("font_size", 13)
	hud_help.modulate = Color(1, 1, 1, 0.7)
	layer.add_child(hud_help)

## A simple cockpit frame round the view, for the mecha's first person.
func _cockpit() -> Control:
	var c := Control.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var dark := Color(0.05, 0.07, 0.11, 0.96)
	for spec in [[Control.PRESET_TOP_WIDE, Vector2(0, 70)], [Control.PRESET_BOTTOM_WIDE, Vector2(0, 170)],
			[Control.PRESET_LEFT_WIDE, Vector2(120, 0)], [Control.PRESET_RIGHT_WIDE, Vector2(120, 0)]]:
		var r := ColorRect.new()
		r.color = dark
		r.set_anchors_preset(spec[0])
		r.custom_minimum_size = spec[1]
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		c.add_child(r)
		if spec[0] == Control.PRESET_BOTTOM_WIDE:
			r.offset_top = -170
		if spec[0] == Control.PRESET_RIGHT_WIDE:
			r.offset_left = -120
	var edge := ColorRect.new()
	edge.color = Color(0.37, 0.88, 1.0, 0.8)
	edge.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	edge.offset_top = -172
	edge.offset_bottom = -169
	edge.offset_left = 120
	edge.offset_right = -120
	c.add_child(edge)
	c.visible = false
	return c

func _process(_delta: float) -> void:
	var calls := Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	var tris := Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
	hud_fps.text = "%d FPS   %d draw calls   %.1fM triangles" % [Engine.get_frames_per_second(), calls, tris / 1e6]
	var prompt := ""
	if mecha.piloting:
		hud_help.text = "W/S walk · A/D turn · SHIFT dash · SPACE mega jump (hold to boost) · Q slam · V cockpit · R climb out"
		hud_mecha.text = "%d km/h   ALT %d m   BOOST %d%%" % [absf(mecha.spd) * 3.6, maxf(0.0, mecha.alt - Planet.height(mecha.dir)), mecha.fuel / Mecha.FUEL * 100.0]
	else:
		hud_mecha.text = ""
		if player.mount:
			hud_help.text = "W go · SHIFT gallop · A/D turn · SPACE hop · R get off · V view · ESC mouse"
		else:
			hud_help.text = "WASD walk · mouse look · SHIFT run · SPACE jump · E ride / climb in · V view · ESC mouse"
			if player.dir.angle_to(mecha.dir) * Planet.R < 16.0:
				prompt = "E — climb into the mecha"
			elif _near_panda():
				prompt = "E — ride the panda"
	hud_prompt.text = prompt
	cockpit.visible = mecha.piloting and mecha.first_person
