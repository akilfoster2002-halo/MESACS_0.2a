## A WORLD — Wano, VOLTA or your home planet (worlds.gd) — stood up in code
## the way the browser version does it, so the two can be compared side by side.
##
## THE WORLD ANSWERS FOUR QUESTIONS, and everything that moves asks them:
##   floor_at(dir, alt)   the highest thing under your knees — the hills, an
##                        island's deck, a roof, the lip of the pool
##   blocked(dir, alt)    would a body standing there be inside a wall
##   water_at(dir)        how high the water is here, if there is any
##   fall_push(point)     how hard the waterfall is pushing on it
## The hills are sums (planet.gd); everything solid on top of them is a
## physics collider, so a new building is solid the moment it has colliders.
extends Node3D

const STEP := 0.55             # the tallest step you walk up without a jump

var player: Walker
var mecha: Mecha
var car: Car
var islands: Islands
var temple: Temple
var hud: Hud
var net: Net
var others: Others
var pandas: Array = []
var buildings: Array = []
var env: Environment
var ui_open := false
var W: Dictionary
var pad: Building

const KEYS := {
	"forward": [KEY_W, KEY_UP], "back": [KEY_S, KEY_DOWN],
	"left": [KEY_A, KEY_LEFT], "right": [KEY_D, KEY_RIGHT],
	"run": [KEY_SHIFT], "jump": [KEY_SPACE], "use": [KEY_E],
	"off": [KEY_R], "view": [KEY_V], "slam": [KEY_Q], "mouse": [KEY_ESCAPE],
	"fly": [KEY_F], "dance": [KEY_G], "emote1": [KEY_1], "emote2": [KEY_2], "emote3": [KEY_3],
	"who": [KEY_B], "pause": [KEY_P], "phone": [KEY_T], "roster": [KEY_O], "music": [KEY_M],
}

var _t0 := 0
## KORO_TIMING=1 in the environment prints how long each part of Wano takes to stand up.
func _lap(what: String) -> void:
	if OS.get_environment("KORO_TIMING") != "":
		print("  %-12s %5d ms" % [what, Time.get_ticks_msec() - _t0])
	_t0 = Time.get_ticks_msec()

## THE BIG MODELS LOAD WHILE THE GROUND IS BEING BUILT: each on a thread of
## its own, asked for first, and picked up by the ordinary load() when the
## code that stands them up gets to them.
const HEAVY := ["res://assets/temple.glb", "res://assets/garden.glb", "res://assets/falls.glb",
	"res://assets/car.glb", "res://assets/mecha.glb", "res://assets/panda.glb"]

func hub() -> bool:
	return W.id == "hub"

func _ready() -> void:
	_t0 = Time.get_ticks_msec()
	W = Worlds.here()
	Planet.use(W)
	if hub():
		for path in HEAVY:
			ResourceLoader.load_threaded_request(path, "", true)
	randomize()
	seed(20260923 + int(W.seed))           # the same world every time you open it
	_inputs()
	_sky()
	# the pool is dug before the ground is built, so the mesh, your feet and
	# the trees all agree where the bank is
	if hub():
		Islands.dig()
	var ground := MeshInstance3D.new()
	ground.mesh = Planet.build_mesh(6 if Planet.R > 200.0 else 5)
	add_child(ground)
	_lap("ground")
	_buildings()
	_lap("buildings")
	if hub():
		islands = Islands.new()
		islands.world = self
		add_child(islands)
		_lap("islands")
	var flies := Fireflies.new()
	flies.tint = W.flies
	add_child(flies)
	_lap("fireflies")
	_scenery()
	_lap("flora")
	_creatures()
	_lap("creatures")
	others = Others.new()
	others.world = self
	add_child(others)
	net = get_node("/root/Online")
	net.world = self
	net.players_in.connect(others.show_list)
	tree_exiting.connect(func():
		net.players_in.disconnect(others.show_list)
		net.world = null)
	hud = Hud.new()
	hud.world = self
	add_child(hud)
	Sound.here(self)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if Worlds.by_ship:
		hud.say("Welcome to %s — %s." % [W.name, W.sub], 5.0)
	else:
		hud.say("Welcome to Wano.  F to fly · R for your car · E to ride · B to change who you are", 6.0)
	Worlds.by_ship = false

func _inputs() -> void:
	for action in KEYS:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in KEYS[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)

## Night over Wano: a deep blue, stars, a cool moon that throws real shadows
## (only near the camera — far shadows are the expensive kind), a little fog.
func _sky() -> void:
	env = Environment.new()
	# ONE COLOUR, NOT A SKY: Godot's sky gradient runs along world Y, and on a
	# ball "up" is wherever you are standing
	env.background_mode = Environment.BG_COLOR
	env.background_color = W.sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = W.ambient
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.fog_enabled = true
	env.fog_light_color = Color(0.12, 0.13, 0.25)
	env.fog_density = 0.0016 * 320.0 / Planet.R
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
	for spec in Planet.BUILDINGS:
		var d := Planet.dir_of(spec.lon, spec.lat)
		var xf := Transform3D(Planet.frame_at(d), d * Planet.R)
		if spec.get("pad", false):
			pad = Building.new().setup(spec, self)
			add_child(pad)
			pad.global_transform = xf
			buildings.append(pad)
			continue
		if spec.id == "missions":
			temple = Temple.new()
			add_child(temple)
			temple.global_transform = xf
			# the temple brings its own walls and floors; it needs the plate
			# under it, which the model covers, so only the collider
			var plate := Building.new().setup(spec.merged({"shell": false, "plate_visible": false}), self)
			add_child(plate)
			plate.global_transform = xf
			continue
		var bld := Building.new().setup(spec, self)
		add_child(bld)
		bld.global_transform = xf
		buildings.append(bld)

## The console, desk or person within reach, if there is one.
func _usable() -> Dictionary:
	var p := player.global_position
	for bld in buildings:
		if bld.global_position.distance_to(p) > 70.0:
			continue
		var u: Dictionary = bld.use_near(p)
		if not u.is_empty():
			return u
	return {}

## Trees stand where nothing else does: off the plates, out of the pool and
## off the river.
func _clear(d: Vector3) -> bool:
	if Planet.pad_k(d) <= 0.6 or Planet.near_basin(d, 1.2):
		return false
	if islands:
		for p in islands.river_path:
			if d.dot(p) > cos(9.0 / Planet.R):
				return false
	return true

func _scenery() -> void:
	if W.flora == "crystal":
		Flora.crystals(self, _clear)
		return
	if W.flora == "wood":
		Flora.wood(self, _clear)
		return
	var town := Planet.dir_of(0, 0)
	var sakura := (Scatter.anywhere(90, town, 300.0) + Scatter.anywhere(40, town, 900.0)).filter(_clear)
	Scatter.grow(self, "res://assets/sakura.glb", sakura, 5.0, 8.0, 0.9, 360.0)
	var bamboo := (Scatter.groves(town, 30, Vector2i(5, 11), 260.0, 5.0) + Scatter.anywhere(40, town, 280.0)).filter(_clear)
	Scatter.grow(self, "res://assets/bamboo.glb", bamboo, 6.0, 11.0, 0.7, 300.0)

func _creatures() -> void:
	if hub():
		_wano_life()
	# you: in front of Mission Control's door the first time, off the pad when
	# you came by ship, and in front of the first building anywhere else
	var start: Vector3
	var facing: Vector3
	var pd := Planet.dir_of(W.pad.lon, W.pad.lat)
	var pf := Planet.frame_at(pd)
	if Worlds.by_ship:
		start = Planet.walk(pd, pf.z, 13.0)
		facing = pf.z
	else:
		var first: Dictionary = W.buildings[0]
		var td := Planet.dir_of(first.lon, first.lat)
		var tf := Planet.frame_at(td)
		start = Planet.walk(td, tf.z, first.d / 2.0 + 21.0)
		facing = td - start
	player = Walker.new()
	player.world = self
	add_child(player)
	player.place(start, facing)
	# and your car, parked beside you
	car = Car.new()
	car.world = self
	add_child(car)
	var sf := Planet.frame_at(start)
	car.park(Planet.walk(start, sf.x, 6.0), facing)

func _wano_life() -> void:
	var town := Planet.dir_of(0, 0)
	var f := Planet.frame_at(town)
	for i in 36:
		var a := randf() * TAU
		var r := randf_range(30.0, 140.0) if i % 2 == 0 else randf_range(60.0, 360.0)
		var d := Planet.walk(town, (f.x * cos(a) + f.z * sin(a)).normalized(), r)
		if Planet.pad_k(d) < 0.5 or not _clear(d):
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

# ------------------------------------------------------------ the questions

func floor_at(dir: Vector3, alt: float, step := STEP) -> float:
	var g := Planet.height(dir)
	var from := alt + step
	if from <= g + 0.01:
		return g
	var q := PhysicsRayQueryParameters3D.create(dir * (Planet.R + from), dir * (Planet.R + g - 0.05))
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return g
	return maxf(g, (hit.position as Vector3).length() - Planet.R)

var _caps := {}
## Would a body of radius r and height h, standing at alt over dir, be inside
## something solid? The body starts a step up from the feet, so a kerb or a
## stair is something you walk up, not into.
func blocked(to: Vector3, alt: float, r := 0.35, h := 1.75, step := STEP) -> bool:
	var key := Vector3(r, h, step)
	if not _caps.has(key):
		var s := CapsuleShape3D.new()
		s.radius = r
		s.height = maxf(2.0 * r, h - step)
		var q := PhysicsShapeQueryParameters3D.new()
		q.shape = s
		_caps[key] = q
	var q: PhysicsShapeQueryParameters3D = _caps[key]
	var mid: float = alt + step + (q.shape as CapsuleShape3D).height * 0.5
	q.transform = Transform3D(Planet.frame_at(to), to * (Planet.R + mid))
	return not get_world_3d().direct_space_state.intersect_shape(q, 1).is_empty()

## The floor a body stands on when nothing is lifting it — the hills, or a
## building's plate — without the islands or the roofs. Height over it is what
## travels to everybody else, so it means the same on a hill as in the Mall.
func base_floor(dir: Vector3) -> float:
	return floor_at(dir, Planet.height(dir) + 2.2, 0.3)

func water_at(dir: Vector3) -> float:
	return islands.water_at(dir) if islands else NAN

func fall_push(p: Vector3) -> Dictionary:
	return islands.fall_push(p) if islands else {}

## Where a camera wanting to be at `want` can actually be, looking at `from`:
## pulled in front of whatever wall is between them.
func clear_view(from: Vector3, want: Vector3) -> Vector3:
	var q := PhysicsRayQueryParameters3D.create(from, want)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return want
	var p: Vector3 = hit.position
	return p + (from - p).normalized() * 0.35

# ------------------------------------------------------------------ keys

func _unhandled_input(ev: InputEvent) -> void:
	if ui_open:
		return
	if ev.is_action_pressed("mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif ev.is_action_pressed("pause"):
		hud.toggle_pause()
	elif ev.is_action_pressed("who"):
		hud.toggle_picker()
	elif ev.is_action_pressed("phone"):
		hud.phone_open()
	elif ev.is_action_pressed("roster"):
		hud.who_toggle()
	elif ev.is_action_pressed("music"):
		Sound.toggle_music()
		hud.say("Music off." if Sound.muted() else "Music on.", 1.5)
	elif ev.is_action_pressed("use"):
		_use()
	elif ev.is_action_pressed("off"):
		_off()
	elif ev.is_action_pressed("fly"):
		_fly()
	elif ev.is_action_pressed("view"):
		if piloting():
			mecha.first_person = not mecha.first_person
		else:
			player.first_person = not player.first_person
	elif ev.is_action_pressed("dance"):
		_emote(["dance"])
	elif ev.is_action_pressed("emote1"):
		_emote(["dance"])
	elif ev.is_action_pressed("emote2"):
		_emote(["salsa", "talk"])
	elif ev.is_action_pressed("emote3"):
		_emote(["flip", "talk2"])

func _emote(clips: Array) -> void:
	if player.hidden:
		return
	for c in clips:
		if player.play_emote(c):
			return

func _fly() -> void:
	if piloting():
		hud.say("The mecha jumps instead — SPACE, and hold it to boost.")
		return
	if player.car:
		hud.say("You cannot fly a car. R to get out first.")
		return
	player.toggle_fly()
	if player.flying:
		hud.say("W to fly · A D to bank · SPACE up · SHIFT down · F to land")
	else:
		hud.say("Down.  F to take off again.", 2.0)

func _use() -> void:
	if piloting() or player.mount or player.car:
		return
	if player.flying:
		return
	var u := _usable()
	if not u.is_empty():
		(u.act as Callable).call(self)
		return
	if _near_mecha():
		mecha.enter(player)
		return
	if _near_car():
		car.enter(player)
		hud.say("W go · S brake / reverse · A D steer · mouse looks round · R get out", 4.0)
		return
	var p := _near_panda()
	if p:
		player.dir = p.dir
		player.fwd = p.fwd
		player.mount = p
		p.mount(player)

## R: out of whatever you are in — or, on your own two feet, your car comes to you.
func _off() -> void:
	if piloting():
		mecha.leave()
	elif player.car:
		player.car.leave()
	elif player.mount:
		player.mount.dismount()
		player.mount = null
	elif not player.flying and not player.swimming and player.on_ground:
		var right := player.fwd.cross(player.dir).normalized()
		car.park(Planet.walk(player.dir, right, 3.5), player.fwd)
		car.enter(player)
		hud.say("W go · S brake / reverse · A D steer · mouse looks round · R get out", 4.0)

func piloting() -> bool:
	return mecha != null and mecha.piloting

func _near_mecha() -> bool:
	return mecha != null and player.dir.angle_to(mecha.dir) * Planet.R < 16.0

## Off you go: the ship takes you to `dest` and you fly the whole way.
func launch(dest: String) -> void:
	Worlds.from = Worlds.current
	Cruise.target = dest
	get_tree().paused = false
	Ctl.blocked = false
	get_tree().change_scene_to_file("res://scenes/cruise.tscn")

func _near_car() -> bool:
	return player.dir.angle_to(car.dir) * Planet.R < 4.5 and absf(player.alt - car.alt) < 2.0

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

func _process(_delta: float) -> void:
	ui_open = hud.any_open()
	var inside := false
	for b in buildings:
		if not b.b.get("pad", false) and b.inside(player.global_position):
			inside = true
	if temple and temple.to_local(player.global_position).length() < 34.0:
		inside = true
	Sound.indoors(inside)
	var calls := Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	var tris := Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
	hud.fps.text = "%d FPS   %d draw calls   %.1fM triangles" % [Engine.get_frames_per_second(), calls, tris / 1e6]
	var prompt := ""
	var status := ""
	if piloting():
		hud.help.text = "W/S walk · A/D turn · SHIFT dash · SPACE mega jump (hold to boost) · Q slam · V cockpit · R climb out"
		status = "%d km/h   ALT %d m   BOOST %d%%" % [absf(mecha.spd) * 3.6, maxf(0.0, mecha.alt - Planet.height(mecha.dir)), mecha.fuel / Mecha.FUEL * 100.0]
	elif player.car:
		hud.help.text = "W go · S brake / reverse · A D steer · mouse look round · R get out · P pause"
		status = "%d km/h" % (absf(car.spd) * 3.6)
	elif player.flying:
		hud.help.text = "W fly · S slow · A D bank · mouse look · SPACE up · SHIFT down · F land · P pause"
		status = "%d km/h   ALT %d m" % [absf(player.air) * 3.6, maxf(0.0, player.alt - floor_at(player.dir, player.alt))]
	elif player.mount:
		hud.help.text = "W go · SHIFT gallop · A/D turn · SPACE hop · R get off · F fly · V view"
	elif player.swimming:
		hud.help.text = "WASD swim · SPACE kick out · F fly out of the water · P pause"
	else:
		hud.help.text = "WASD walk · mouse look · SHIFT run · SPACE jump · F fly · E ride / climb in · R car · G dance · B who you are · P pause"
		var u := _usable()
		if not u.is_empty():
			prompt = "E — " + str(u.label)
		elif _near_mecha():
			prompt = "E — climb into the mecha"
		elif _near_car():
			prompt = "E — get in"
		elif _near_panda():
			prompt = "E — ride the panda"
	hud.prompt.text = prompt
	hud.status.text = status
	hud.cockpit.visible = piloting() and mecha.first_person
