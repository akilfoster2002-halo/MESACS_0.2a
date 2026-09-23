## Takes screenshots of the slice from a few places and prints the frame
## rate — a check that needs no hands on the keyboard.
##   godot --path . res://tools/shots.tscn -- <out_dir>
extends Node

var out := "/tmp"

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var w: Node3D = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	await _wait(3.0)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await _shot(w, "1_start")
	# turn round to look out over the country
	w.player.fwd = w.player.fwd.rotated(w.player.dir, PI * 0.8)
	await _wait(1.0)
	await _shot(w, "2_country")
	# ride the nearest panda
	var p: Panda = null
	var bd := 1e9
	for x in w.pandas:
		var d: float = x.dir.angle_to(w.player.dir)
		if d < bd:
			bd = d
			p = x
	w.player.dir = p.dir
	w.player.fwd = p.fwd
	w.player.mount = p
	p.mount(w.player)
	await _wait(1.5)
	await _shot(w, "3_panda")
	p.dismount()
	w.player.mount = null
	# into the mecha
	w.player.dir = w.mecha.dir
	w._use()
	await _wait(1.5)
	await _shot(w, "4_mecha")
	w.mecha.first_person = true
	await _wait(1.0)
	await _shot(w, "5_cockpit")
	get_tree().quit()

func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func _shot(w: Node3D, name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out.path_join(name + ".png"))
	print("%s  %d FPS  %d draw calls  %.2fM triangles" % [name, Engine.get_frames_per_second(),
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1e6])
