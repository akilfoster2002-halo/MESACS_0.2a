## Steady-state frame time: warm up (shaders compile on first sight), then
## time a few seconds at each spot. vsync off so the number is the real cost.
extends Node
func _ready() -> void:
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	var w: Node3D = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await get_tree().create_timer(4.0).timeout
	await _measure("start (facing Mission Control)")
	w.player.fwd = w.player.fwd.rotated(w.player.dir, PI * 0.8)
	await get_tree().create_timer(2.0).timeout
	await _measure("out over the country")
	w.player.dir = w.mecha.dir
	w._use()
	await get_tree().create_timer(2.0).timeout
	await _measure("in the mecha")
	get_tree().quit()

func _measure(label: String) -> void:
	var frames := 0
	var t0 := Time.get_ticks_usec()
	while Time.get_ticks_usec() - t0 < 3_000_000:
		await get_tree().process_frame
		frames += 1
	var ms := (Time.get_ticks_usec() - t0) / 1000.0 / frames
	print("%-32s %5.1f FPS  (%.1f ms/frame)  %d draw calls" % [label, 1000.0 / ms, ms,
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)])
