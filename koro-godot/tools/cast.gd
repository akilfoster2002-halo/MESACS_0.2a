## The cast side by side, in the game's own light, playing one clip:
##   godot --path . res://tools/cast.tscn -- <out.png> [clip]
extends Node3D
func _ready() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.05, 0.06, 0.12)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.60, 0.80)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.1
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.18
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new(); sun.light_energy = 1.15; sun.light_color = Color(0.85, 0.88, 1.0)
	sun.shadow_enabled = true; add_child(sun); sun.look_at_from_position(Vector3(3, 6, 6), Vector3.ZERO)
	var ids := ["nia", "sable", "kofi", "theo", "zuri"]
	var x := -4.0
	for id in ids:
		var m := Models.spawn("res://assets/characters/character-%s.glb" % id)
		add_child(m)
		Models.fit_height(m, Walker.HEIGHT * 0.94)
		m.position.x += x
		m.rotation.y = 0.0
		var ap := Models.anim_player(m)
		Models.loop_clips(ap)
		ap.play(OS.get_cmdline_user_args()[1] if OS.get_cmdline_user_args().size() > 1 else "idle")
		x += 2.0
	var floor := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(14, 6); floor.mesh = pm; add_child(floor)
	var cam := Camera3D.new(); add_child(cam); cam.fov = 40; cam.look_at_from_position(Vector3(0, 1.2, 9.5), Vector3(0, 0.9, 0))
	cam.make_current()
	await get_tree().create_timer(1.2).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
