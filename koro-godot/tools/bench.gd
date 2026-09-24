## Steady-state frame time: warm up (shaders compile on first sight), then
## time a few seconds at each spot. vsync off so the number is the real cost,
## and the CPU and GPU halves apart, so a slow spot says which one to fix.
##   godot --path . res://tools/bench.tscn
extends Node

var w: Node3D

func _ready() -> void:
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)
	var args := OS.get_cmdline_user_args()
	if args.size() > 0 and args[0] != "hub":
		Worlds.current = args[0]
		Worlds.by_ship = true
		w = load("res://scenes/main.tscn").instantiate()
		add_child(w)
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		await get_tree().create_timer(4.0).timeout
		await _measure(Worlds.current + ": off the ship")
		for bl in w.buildings:
			if bl.b.get("pad", false):
				continue
			w.player.dir = bl.to_global(Vector3(0, 0, bl.hd - 4.0)).normalized()
			w.player.alt = w.floor_at(w.player.dir, 1.0)
			await get_tree().create_timer(2.0).timeout
			await _measure(Worlds.current + ": in " + str(bl.b.id))
		for c in w.find_children("*", "Club", true, false):
			c.process_mode = Node.PROCESS_MODE_DISABLED
		await get_tree().create_timer(1.0).timeout
		await _measure(Worlds.current + ": the club switched off")
		get_tree().quit()
		return
	w = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await get_tree().create_timer(4.0).timeout
	await _measure("start (facing Mission Control)")
	w.player.fwd = w.player.fwd.rotated(w.player.dir, PI * 0.8)
	await get_tree().create_timer(2.0).timeout
	await _measure("out over the country")
	var pd: Vector3 = w.islands.pool.dir
	w.player.dir = Planet.walk(pd, Planet.frame_at(pd).z, 70.0)
	var look: Vector3 = Planet.dir_of(13, 16)
	w.player.fwd = (look - w.player.dir * look.dot(w.player.dir)).normalized()
	w.player.take_off()
	w.player.alt = Planet.height(w.player.dir) + 55.0
	await get_tree().create_timer(2.0).timeout
	await _measure("flying at the falls")
	w.player.land()
	w.player.dir = w.mecha.dir
	w.player.alt = w.mecha.alt
	w._use()
	await get_tree().create_timer(2.0).timeout
	await _measure("in the mecha")
	get_tree().quit()

func _measure(label: String) -> void:
	var frames := 0
	var cpu := 0.0
	var gpu := 0.0
	var t0 := Time.get_ticks_usec()
	var vp := get_viewport().get_viewport_rid()
	while Time.get_ticks_usec() - t0 < 3_000_000:
		await get_tree().process_frame
		frames += 1
		cpu += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		gpu += RenderingServer.viewport_get_measured_render_time_gpu(vp)
	var ms := (Time.get_ticks_usec() - t0) / 1000.0 / frames
	print("%-32s %5.1f FPS  (%.1f ms/frame; scripts %.1f ms, GPU %.1f ms)  %d draw calls" % [label,
		1000.0 / ms, ms, cpu / frames, gpu / frames,
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)])
