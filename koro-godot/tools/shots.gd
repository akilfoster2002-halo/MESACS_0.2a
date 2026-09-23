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
	var t0 := Time.get_ticks_msec()
	w = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	print("world built in %d ms" % (Time.get_ticks_msec() - t0))
	await _wait(2.5)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var p: Walker = w.player
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
		["09_mecha", func():
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

func _put(at: Vector3, look: Vector3) -> void:
	var p: Walker = w.player
	p.dir = at.normalized()
	var f := look - p.dir * look.dot(p.dir)
	p.fwd = f.normalized()
	p.alt = w.floor_at(p.dir, Planet.height(p.dir) + 0.5)
	p.on_ground = true
	p.vy = 0.0

func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out.path_join(name + ".png"))
	print("%s  %d FPS  %d draw calls  %.2fM triangles" % [name, Engine.get_frames_per_second(),
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1e6])
