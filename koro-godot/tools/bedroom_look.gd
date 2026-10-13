## Robin's bedroom, alone: the apartment, its dressing (scripts/tsh/bedroom.gd) and the cat, lit for the night and
## photographed from the opening's angles — quicker than the whole film to look at the set:
##   godot --path koro-godot res://tools/bedroom_look.tscn -- <out_dir> [top]
extends Node3D

var cam: Camera3D

func _ready() -> void:
	var args := OS.get_cmdline_user_args(); var out: String = args[0] if args.size() else "user://bedroom"
	DirAccess.make_dir_recursive_absolute(out)
	var R: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/tsh/apt.json"))
	var apt: Node3D = (load("res://assets/tsh/apt.glb") as PackedScene).instantiate(); add_child(apt)
	for h in JSON.parse_string(FileAccess.get_file_as_string("res://assets/tsh/apt_parts.json")).hidden:
		var n := apt.find_child(h, true, false) as Node3D
		if n: n.visible = false
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.008, 0.016, 0.016)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.45, 0.62, 0.66); env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = 1.2*1.45          # as the game has it (game.gd _world, _look)
	env.glow_enabled = true; env.glow_intensity = 0.6; env.glow_bloom = 0.05; env.glow_hdr_threshold = 1.1; env.ssao_enabled = true
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var lamp := OmniLight3D.new(); lamp.light_color = Color(1.0, 0.82, 0.6); lamp.light_energy = 1.6; lamp.omni_range = 9
	lamp.position = Vector3(R.room.bed.x + 0.6, 2.2, R.room.bed.z - 1.0); add_child(lamp)
	var fill := OmniLight3D.new(); fill.light_color = Color(0.7, 0.85, 0.9); fill.light_energy = 0.35; fill.omni_range = 12; fill.position = Vector3(300, 2.8, 0); add_child(fill)
	var bd := Bedroom.new(); bd.build(apt, R.room)
	if "solo" in args:
		bd.cat.position = Vector3(302.9, 0.0, 2.6); bd.cat.rotation.y = 0.0
		var sl := DirectionalLight3D.new(); sl.light_energy = 0.8; sl.rotation = Vector3(-0.9, 0.6, 0); add_child(sl)
	if "awake" in args: bd.cat.wake(1.0, Vector3(301.6, 1.0, -0.2))
	if "dark" in args: bd.lights(false); lamp.light_energy = 0.0; bd.cat.shine = 1.0
	cam = Camera3D.new(); add_child(cam); cam.current = true
	await get_tree().create_timer(1.5).timeout
	var bed: Dictionary = R.room.bed
	var views := {
		"top": [Vector3(300, 9.5, 0.01), Vector3(300, 0, 0), 70],
		"bed_wide": [Vector3(301.6, 1.5, -0.2), Vector3(298.4, 0.9, 2.9), 62],
		"bed_wall": [Vector3(298.7, 1.4, 0.4), Vector3(298.7, 1.3, 4.0), 70],
		"cat": [Vector3(bed.x + 1.4, 1.0, bed.z - 0.6), Vector3(bed.x + 0.7, 0.65, bed.z + 0.2), 40],
		"window": [Vector3(297.5, 1.5, 0.5), Vector3(294.5, 1.4, 2.6), 60],
		"night": [Vector3(296.9, 1.2, 1.4), Vector3(296.8, 0.7, 3.5), 55],
		"wall": [Vector3(298.4, 1.75, 0.9), Vector3(298.4, 1.75, 4.0), 60],
		"catclose": [Vector3(bed.x + 1.15, 1.0, bed.z - 0.25), Vector3(bed.x + 0.72, 0.7, bed.z + 0.22), 28],
		"catfront": [Vector3(bed.x + 1.15, 0.82, bed.z - 0.4), Vector3(bed.x + 0.72, 0.7, bed.z + 0.22), 22],
		"solo_a": [Vector3(303.45, 0.45, 2.0), Vector3(302.9, 0.08, 2.6), 30],
		"solo_b": [Vector3(302.9, 0.9, 2.61), Vector3(302.9, 0.0, 2.6), 30],
		"solo_c": [Vector3(302.3, 0.3, 2.1), Vector3(302.9, 0.08, 2.6), 30],
		"back": [Vector3(300.5, 1.5, 3.4), Vector3(299.5, 1.3, -4.0), 70],
	}
	var N: Vector3 = bd.spots.nightstand; var ID: Vector3 = bd.spots.id; var HW: Vector3 = bd.spots.homework
	views["ns"] = [N + Vector3(-0.35, 0.25, -0.55), N + Vector3(-0.0, 0.12, 0.0), 32]
	views["id"] = [ID + Vector3(-0.1, 0.05, -0.3), ID, 24]
	views["hw"] = [HW + Vector3(0.0, 0.42, 0.12), HW, 30]
	var only: Array = Array(args.slice(1)).filter(func(a): return not a in ["awake", "dark", "solo"])
	for k in views:
		if only.size() and not k in only: continue
		var v: Array = views[k]
		cam.fov = v[2]
		if k == "top": cam.position = v[0]; cam.rotation = Vector3(-PI/2, 0, 0)
		else: cam.look_at_from_position(v[0], v[1])
		await get_tree().process_frame; await RenderingServer.frame_post_draw; await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(out.path_join(k + ".png")); print("shot ", k)
	get_tree().quit()
