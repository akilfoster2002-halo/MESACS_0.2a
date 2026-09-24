## Takes screenshots of Wano from a set of places and prints the frame rate —
## a check that needs no hands on the keyboard.
##   godot --path . res://tools/shots.tscn -- <out_dir> [only]
extends Node

var out := "/tmp"
var only := ""
var w: Node3D

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	if args.size() > 1:
		only = args[1]
	if args.size() > 2 and args[2] == "cruise":
		await _cruise()
		return
	# a third argument stands you on another world, off the ship
	if args.size() > 2:
		Worlds.current = args[2]
		Worlds.by_ship = true
	if Worlds.current != "hub":
		await _other_world()
		return
	var t0 := Time.get_ticks_msec()
	w = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	print("world built in %d ms" % (Time.get_ticks_msec() - t0))
	await _wait(2.5)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var p: Walker = w.player
	process_mode = Node.PROCESS_MODE_ALWAYS
	var shots := [
		["01_start", func(): pass],
		["02_temple_atrium", func():
			_put(w.temple.to_global(Vector3(0, 0, 7)), w.temple.to_global(Vector3(0, 0, -4)))
			p.pitch = -0.05],
		["03_falls_from_pool", func():
			var pd: Vector3 = w.islands.pool.dir
			var fr := Planet.frame_at(pd)
			var at := Planet.walk(pd, -fr.x, 48.0)
			_put(at * Planet.R, pd * Planet.R)
			p.pitch = 0.35
			p.zoom = 5.0],
		["04_flying", func():
			var pd: Vector3 = w.islands.pool.dir
			_put(Planet.walk(pd, Planet.frame_at(pd).z, 70.0) * Planet.R, Planet.dir_of(13, 16) * Planet.R)
			p.take_off()
			p.alt = Planet.height(p.dir) + 55.0
			p.air = 28.0
			p.pitch = -0.1],
		["05_garden_island", func():
			if p.flying:
				p.land()
			var d := Planet.dir_of(-16, 9)
			var fr := Planet.frame_at(d, -0.9)
			var at := Planet.walk(d, fr.z, 8.0)
			_put(at * Planet.R, Planet.walk(d, fr.z, -20.0) * Planet.R)
			p.alt = w.floor_at(p.dir, 200.0)
			p.on_ground = true
			p.pitch = -0.15],
		["06_swimming", func():
			var pd: Vector3 = w.islands.pool.dir
			_put(Planet.walk(pd, Planet.frame_at(pd).x, 10.0) * Planet.R, Planet.dir_of(13, 16) * Planet.R)
			p.alt = w.water_at(p.dir)
			p.on_ground = false
			p.gait_f = 1.0
			p.pitch = 0.1],
		["07_car", func():
			var d := Planet.dir_of(0, 7)
			var s := Planet.walk(d, Planet.frame_at(d).z, 44.0)
			_put(s * Planet.R, d * Planet.R)
			p.swimming = false
			p.flying = false
			w._off()
			w.car.spd = 12.0],
		["08_river", func():
			w.player.car.leave() if w.player.car else null
			var path: Array = w.islands.river_path
			var at: Vector3 = path[mini(40, path.size() - 1)]
			var nx: Vector3 = path[mini(60, path.size() - 1)]
			var fr := Planet.frame_at(at)
			_put(Planet.walk(at, (nx - at).cross(at).normalized(), 9.0) * Planet.R, nx * Planet.R)
			p.pitch = -0.3],
		["10_mall", func(): _inside("mall")],
		["11_mechanic", func(): _inside("mechanic")],
		["12_library", func(): _inside("library")],
		["13_workshop_outside", func():
			var bl := _bld("workshop")
			_put(bl.to_global(Vector3(-14, 0, 30)), bl.to_global(Vector3(0, 4, 0)))
			p.pitch = -0.05],
		["14_book", func(): w.hud.library_ask()],
		["15_picker", func():
			w.hud.library_close()
			w.hud.toggle_picker()],
		["16_pause", func():
			w.hud.toggle_picker()
			w.hud.toggle_pause()],
		["09_mecha", func():
			if w.hud.is_paused():
				w.hud.toggle_pause()
			p.dir = w.mecha.dir
			w._use()],
	]
	for s in shots:
		if only != "" and not (s[0] as String).contains(only):
			continue
		s[1].call()
		await _wait(1.2)
		await _shot(s[0])
	get_tree().quit()

## VOLTA or home: the pad you land on, and every room there is.
func _other_world() -> void:
	w = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	process_mode = Node.PROCESS_MODE_ALWAYS
	await _wait(2.5)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var p: Walker = w.player
	await _shot(Worlds.current + "_1_pad")
	p.fwd = p.fwd.rotated(p.dir, PI)
	p.pitch = -0.25
	await _wait(1.0)
	await _shot(Worlds.current + "_2_ship")
	for bl in w.buildings:
		if bl.b.get("pad", false):
			continue
		_inside(bl.b.id)
		await _wait(1.5)
		await _shot(Worlds.current + "_3_" + str(bl.b.id))
	if Worlds.current == "arena":
		var club: Building = _bld("club")
		var c: Club = null
		for ch in club.get_children():
			if ch is Club:
				c = ch
		w.hud.decks_open(c)
		await _wait(1.0)
		await _shot("arena_4_decks")
	get_tree().quit()

## The flight: leaving Wano, at speed through the field, and arriving.
func _cruise() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Cruise.target = "arena"
	var c: Cruise = load("res://scenes/cruise.tscn").instantiate()
	add_child(c)
	await _wait(2.0)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await _shot("cruise_1_leaving")
	for t in c.things:
		(t.n as Node3D).visible = false
	await _wait(0.5)
	await _shot("cruise_1b_no_sky_things")
	for t in c.things:
		(t.n as Node3D).visible = true
	c.speed = 290.0
	c.boost = 0.6
	await _wait(3.0)
	await _shot("cruise_2_flying")
	c.where = c.dest_at + (c.where - c.dest_at).normalized() * 3000.0
	await _wait(1.0)
	await _shot("cruise_3_close")
	# arriving swaps the scene out from under this tool, so it stops just short
	c.where = c.dest_at + (c.where - c.dest_at).normalized() * 700.0
	await _wait(0.3)
	print("arriving: ", c.done)
	get_tree().quit()

func _bld(id: String) -> Building:
	for bl in w.buildings:
		if bl.b.id == id:
			return bl
	return null

func _inside(id: String) -> void:
	var bl := _bld(id)
	var p: Walker = w.player
	if p.car:
		p.car.leave()
	_put(bl.to_global(Vector3(0, 0, bl.hd - 4.0)), bl.to_global(Vector3(0, 0, -bl.hd)))
	p.alt = w.floor_at(p.dir, 1.0)
	p.pitch = -0.08
	p.zoom = 4.0

func _put(at: Vector3, look: Vector3) -> void:
	var p: Walker = w.player
	p.dir = at.normalized()
	var f := look - p.dir * look.dot(p.dir)
	p.fwd = f.normalized()
	p.alt = w.floor_at(p.dir, Planet.height(p.dir) + 0.5)
	p.on_ground = true
	p.vy = 0.0

func _wait(s: float) -> void:
	await get_tree().create_timer(s, true).timeout

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out.path_join(name + ".png"))
	print("%s  %d FPS  %d draw calls  %.2fM triangles" % [name, Engine.get_frames_per_second(),
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1e6])
