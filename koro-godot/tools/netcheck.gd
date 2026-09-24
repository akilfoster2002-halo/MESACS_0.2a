## Two-way check against a real server: sign in, stand in the Meadow with
## whoever else is there, talk, sync the progress bag, read a text.
##   KORO_PROFILE=netcheck godot --path . res://tools/netcheck.tscn -- <server> <out_dir>
extends Node

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var args := OS.get_cmdline_user_args()
	var out: String = args[1] if args.size() > 1 else "/tmp"
	var w: Node3D = load("res://scenes/main.tscn").instantiate()
	add_child(w)
	await get_tree().create_timer(2.0).timeout
	var net: Net = w.net
	net.set_server(args[0])
	net.set_room("meadow")
	var e: String = await net.register("godotkyle", "secret123", "Kyle (godot)")
	if e != "":
		e = await net.login("godotkyle", "secret123")
	print("godot signed in: ", e == "", " ", net.me.get("display", e))
	var t := 0.0
	while not net.live and t < 10.0:
		await get_tree().create_timer(0.25).timeout
		t += 0.25
	print("room live: ", net.live)
	# face the spot the browser player is pacing on
	var p: Walker = w.player
	var there := Planet.dir_of(1.2, 14.2)
	p.fwd = (there - p.dir * there.dot(p.dir)).normalized()
	p.pitch = -0.1
	await get_tree().create_timer(3.0).timeout
	print("player alt %.2f floor %.2f ground %.2f on_ground %s vy %.2f clip %s" % [p.alt, w.floor_at(p.dir, p.alt), Planet.height(p.dir), p.on_ground, p.vy, p.ap.current_animation])
	print("godot sees: ", net.roster.map(func(x): return "%s at %.2f,%.2f act=%s" % [x.display, x.x, x.z, x.get("act")]))
	net.say("hello from godot")
	Progress.set_value("w_coins", 42)
	await get_tree().create_timer(3.0).timeout
	await _shot(out + "/net_1_meadow.png")
	w.hud.phone_open()
	await get_tree().create_timer(1.0).timeout
	await _shot(out + "/net_2_nearby.png")
	w.hud.phone._tab_to("texts")
	await get_tree().create_timer(2.0).timeout
	w.hud.phone._open("webmia")
	await get_tree().create_timer(2.0).timeout
	await _shot(out + "/net_3_texts.png")
	get_tree().quit()

func _shot(path: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
