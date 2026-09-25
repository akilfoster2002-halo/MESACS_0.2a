## Every chat room template, stood up in the real game and photographed —
## walking in, and from the editor's doll's-house view:
##   godot --path . res://tools/roomshots.tscn -- <out_dir> [template…]
## No server: the room is built from the catalogue as the server would hand
## it over, so this looks at the building, not the sharing (roomtest.gd).
extends Node

var driving := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if driving:
		_run()
		return
	var d = load("res://tools/roomshots.gd").new()
	d.driving = true
	get_tree().root.add_child.call_deferred(d)
	queue_free()

func _shot(path: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)

func _first(room: ChatRoom, type: String) -> String:
	for id in room.nodes:
		if str((room.nodes[id] as Node3D).get_meta("type")) == type:
			return id
	return ""

func _ok(what: String, cond: bool) -> void:
	print(("PASS  " if cond else "FAIL  ") + what)

## What the things do, pressed here with nobody else about (no server: a
## change of state is applied here and simply not passed on).
func _behave(w: Node, key: String, out: String) -> void:
	var room: ChatRoom = w.room
	if key == "bedroom":
		var jb := _first(room, "jukebox")
		(room.use_near(room.nodes[jb].global_position).act as Callable).call(w)
		await get_tree().create_timer(0.6).timeout
		var ap := (room.nodes[jb] as Node3D).get_node("audio") as AudioStreamPlayer3D
		_ok("the jukebox plays when pressed (%s)" % str(room.state.get(jb, {})), ap.playing)
		var tv := _first(room, "tv")
		room.set_state(tv, {"on": false})
		var txt := (room.nodes[tv] as Node3D).get_node("v").find_child("text", true, false) as Label3D
		_ok("the TV goes off", not txt.visible)
		room.set_state(tv, {"on": true})
		_ok("and on again, with its words", txt.visible and txt.text == "MY ROOM")
		var sw := _first(room, "light_switch")
		(room.use_near(room.nodes[sw].global_position).act as Callable).call(w)
		_ok("the switch turns the lights off", not room.lights_on and (room.lamps[0][0] as OmniLight3D).light_energy < 0.5)
		await get_tree().create_timer(0.5).timeout
		await _shot("%s/bedroom_dark.png" % out)
		(room.use_near(room.nodes[sw].global_position).act as Callable).call(w)
		_ok("and on again", room.lights_on)
		var couch := _first(room, "couch")
		var u: Dictionary = room.use_near(room.nodes[couch].global_position + Vector3(0, 0, -0.8))
		_ok("a couch offers a seat (%s)" % u.get("label", "-"), str(u.get("label", "")) == "sit down")
	if key == "arcade":
		var cab := _first(room, "arcade")
		w.player.dir = (room.nodes[cab].global_position + room.global_transform.basis.z * 1.6).normalized()
		await get_tree().process_frame
		await get_tree().process_frame
		room.arcade_press(cab)
		_ok("the cabinet says wait", room.arcade.stage == "wait")
		await get_tree().create_timer(4.0).timeout
		_ok("then says now", room.arcade.stage == "go")
		room.arcade_press(cab)
		var best := int((room.state.get(cab, {}) as Dictionary).get("best", 0))
		_ok("a time is scored and kept as the best (%d ms)" % best, room.arcade.stage == "done" and best > 0)
		await _shot("%s/arcade_score.png" % out)
	if key == "classroom":
		var bot := _first(room, "robot")
		room.set_state(bot, {"run": 1})
		await get_tree().create_timer(3.0).timeout
		var h: Node3D = room.nodes[bot]
		var home: Array = room.record(bot).p
		_ok("the robot runs its program", Vector2(h.position.x - float(home[0]), h.position.z - float(home[2])).length() > 1.0)
		w.edit_room()
		await get_tree().create_timer(0.5).timeout
		w.editor._select(bot)
		w.editor._program_open()
		await get_tree().create_timer(0.8).timeout
		await _shot("%s/robot_program.png" % out)
		w.editor.prog.queue_free()
		w.editor.prog = null
		w.editor._finish()
		await get_tree().create_timer(0.3).timeout

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out: String = args[0] if args.size() > 0 else "/tmp"
	var cat := ChatRoom.catalog()
	var which: Array = args.slice(1) if args.size() > 1 else cat.templates.keys()
	var n := 0
	for key in which:
		var t: Dictionary = cat.templates[key]
		var objs: Array = (t.objects as Array).duplicate(true)
		for o in objs:
			n += 1
			o.id = "t%d" % n
			if not o.has("props"):
				o.props = (ChatRoom.spec(o.type).get("props", {}) as Dictionary).duplicate(true)
		Worlds.room = {"id": 0, "name": str(t.name).to_upper(), "access": "private", "template": key, "mine": true,
			"owner": {"id": 0, "display": "You"}, "env": t.env, "objects": objs}
		Worlds.room_server = ""
		Worlds.current = "chatroom"
		get_tree().change_scene_to_file("res://scenes/main.tscn")
		await get_tree().create_timer(4.0).timeout
		var w: Node = get_tree().current_scene
		await _shot("%s/%s_walk.png" % [out, key])
		w.edit_room()
		await get_tree().create_timer(1.0).timeout
		w.editor.yaw = 0.5
		await get_tree().create_timer(0.5).timeout
		await _shot("%s/%s_edit.png" % [out, key])
		w.editor._finish()
		await get_tree().create_timer(0.5).timeout
		await _behave(w, key, out)
		if key == "bedroom":
			# the screens: the room's menu, its info, and making a room
			w.hud.room_menu_open()
			await get_tree().create_timer(0.8).timeout
			await _shot("%s/ui_menu.png" % out)
			w.hud.rooms._info_page()
			await get_tree().create_timer(0.8).timeout
			await _shot("%s/ui_info.png" % out)
			w.hud.rooms.open_browser()
			w.hud.rooms.show_page("create")
			await get_tree().create_timer(0.8).timeout
			await _shot("%s/ui_create.png" % out)
			w.hud.rooms_close()
		print("shot ", key)
	get_tree().quit()
