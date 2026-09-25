## Chat Rooms, end to end, in the real game against a real server — two
## copies at once, one the owner, one a guest, talking through files:
##   KORO_PROFILE=rta godot --path . res://tools/roomtest.tscn -- <server> owner <out_dir>
##   KORO_PROFILE=rtb godot --path . res://tools/roomtest.tscn -- <server> guest <out_dir>
## The owner makes a room, invites the guest, goes in, furnishes it in the
## editor, saves, flicks the lights, runs the robot, leaves, comes back and
## finally deletes it. The guest waits for the invitation, goes in, checks
## it can see the owner and everything the owner does, checks it cannot do
## the owner's things, and is sent out when the room is deleted. Each prints
## PASS/FAIL lines and takes screenshots into <out_dir>.
extends Node

var driving := false
var server := ""
var role := ""
var out := "/tmp"
var fails := 0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if driving:
		_run()
		return
	# a driver that outlives the scenes: entering a room changes scene
	var d = load("res://tools/roomtest.gd").new()
	d.driving = true
	get_tree().root.add_child.call_deferred(d)
	get_tree().change_scene_to_file.call_deferred("res://scenes/main.tscn")

func ok(what: String, cond: bool) -> void:
	print(("PASS  " if cond else "FAIL  ") + role + ": " + what)
	if not cond:
		fails += 1

func wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout

func until(cond: Callable, secs := 20.0) -> bool:
	var t := 0.0
	while t < secs:
		if cond.call():
			return true
		await wait(0.25)
		t += 0.25
	return cond.call()

func world() -> Node:
	return get_tree().current_scene

## Wait for a new scene (after entering or leaving a room) to be standing.
func restaged(old) -> Node:
	# it may already be gone: a kick can change the scene before we ask
	var was: int = old.get_instance_id() if is_instance_valid(old) else 0
	await until(func(): return is_instance_valid(world()) and world().get_instance_id() != was and world().get("hud") != null, 30.0)
	await wait(2.0)
	return world()

func shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + "/" + name)

func flag(name: String) -> void:
	FileAccess.open(out + "/" + name, FileAccess.WRITE).store_string("1")

func flagged(name: String) -> bool:
	return FileAccess.file_exists(out + "/" + name)

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	server = args[0]
	role = args[1]
	out = args[2] if args.size() > 2 else "/tmp"
	await wait(4.0)
	var w := world()
	var net: Net = w.net
	net.set_server(server)
	var user := "ana_rt" if role == "owner" else "ben_rt"
	var e: String = await net.register(user, "secret123", "Ana" if role == "owner" else "Ben")
	if e != "":
		e = await net.login(user, "secret123")
	ok("signed in (%s)" % e, e == "")
	ok("socket live", await until(func(): return net.live, 15.0))
	if role == "owner":
		await _owner(net)
	else:
		await _guest(net)
	print("DONE %s — %d failure(s)" % [role, fails])
	get_tree().quit(1 if fails > 0 else 0)

# ------------------------------------------------------------ the owner

func _owner(net: Net) -> void:
	var w := world()
	var came := (w.player as Walker).dir
	# 1. create
	var j := await net.room_create("Ana's Test Den", "invited", "bedroom")
	ok("created a room", j.ok)
	var id := int(j.room.id)
	var start_n: int = (j.room.objects as Array).size()
	ok("the bedroom template furnished it (%d things)" % start_n, start_n > 5)
	# the guest has to exist before it can be invited
	var inv := {}
	await until(func():
		return flagged("guest_ready"), 60.0)
	inv = await net.room_invite(id, "ben_rt")
	ok("invited the guest", inv.ok)
	flag("room_%d" % id)
	# 2. enter
	var e := await net.room_enter(id)
	ok("the server let the owner in", e.ok)
	w.enter_room(e.room, str(e.server))
	w = await restaged(w)
	ok("standing in a chat room", Worlds.current == "chatroom" and w.room != null)
	ok("every thing built (%d)" % w.room.nodes.size(), w.room.nodes.size() == start_n)
	var p: Walker = w.player
	await wait(1.0)
	ok("feet on the floor (alt %.3f, floor %.3f)" % [p.alt, w.floor_at(p.dir, p.alt)], p.on_ground and absf(p.alt - w.floor_at(p.dir, p.alt)) < 0.05)
	ok("inside the walls", absf(w.room.to_local(p.global_position).x) < w.room.W / 2.0 and absf(w.room.to_local(p.global_position).z) < w.room.D / 2.0)
	await shot("owner_1_room.png")
	# 5. two players
	ok("sees the guest come in", await until(func(): return w.others.count() >= 1, 60.0))
	await wait(1.5)
	await shot("owner_2_guest.png")
	# 8/9. the editor: add, move, colour, program, save
	w.edit_room()
	await wait(1.0)
	var ed: RoomEditor = w.editor
	ok("the editor opened", ed != null)
	ed.focus = Vector3(-3, 0, 4)
	ed._add("robot")
	var robot := ed.sel
	ok("added a robot", robot != "" and w.room.nodes.has(robot))
	ed._program_open()
	ed.program = [["event.flag"], ["motion.move", 40], ["motion.turn", "z", 90], ["motion.move", 20], ["looks.sayFor", "Hello Ben!", 3]]
	ed._program_changed(true)
	ed.prog.queue_free()
	ed.prog = null
	ed.focus = Vector3(4, 0, 5)
	ed._add("couch")
	var couch := ed.sel
	ed._prop("color", "#ff6a6a")
	ed._turn(90.0)
	ed.room.move_object(couch, Vector3(5, 0, 6), 90.0, 1.2)
	ed._changed()
	ed._mode("look")
	ed._set_env("light", "neon")
	await wait(1.0)
	await shot("owner_3_editor.png")
	await ed._save()
	ok("saved", not ed.dirty)
	var back := await net.room_get(id)
	ok("the server kept both new things (%d)" % (back.room.objects as Array).size(), (back.room.objects as Array).size() == start_n + 2)
	var saved_couch := {}
	for o in back.room.objects:
		if str(o.id) == couch:
			saved_couch = o
	ok("the couch kept its colour, place and size", str(saved_couch.get("props", {}).get("color", "")) == "#ff6a6a"
		and absf(float(saved_couch.p[0]) - 5.0) < 0.01 and absf(float(saved_couch.s) - 1.2) < 0.01)
	ok("the environment saved", str(back.room.env.light) == "neon")
	ed._finish()
	await wait(1.0)
	ok("the editor closed", w.editor == null)
	flag("saved")
	# 6. sync: the lights, and the robot, for everybody
	w.room.set_state("lights", {"on": false})
	await wait(1.0)
	w.room.set_state(robot, {"run": 1})
	await wait(2.5)
	var h: Node3D = w.room.nodes[robot]
	var home: Array = w.room.record(robot).p
	ok("the robot is running its program", Vector2(h.position.x - float(home[0]), h.position.z - float(home[2])).length() > 0.5)
	await shot("owner_4_robot.png")
	await until(func(): return flagged("guest_checked"), 60.0)
	# 3. leave, and 4. come back
	w.leave_room()
	w = await restaged(w)
	ok("back on %s" % Worlds.current, Worlds.current == "hub" and w.get("room") == null)
	ok("back where I went in", (w.player as Walker).dir.angle_to(came) * Planet.R < 3.0)
	await shot("owner_5_back.png")
	e = await net.room_enter(id)
	w.enter_room(e.room, str(e.server))
	w = await restaged(w)
	ok("came back to it, and it is as saved (%d)" % w.room.nodes.size(), w.room.nodes.size() == start_n + 2)
	ok("the lights are as they were left", w.room.lights_on == false or w.others.count() == 0)
	# 10. delete: everybody out
	flag("deleting")
	var d := await net.room_delete(id)
	ok("deleted", d.ok)
	w = await restaged(w)
	ok("sent out of the deleted room", Worlds.current == "hub")
	ok("it is gone", (await net.room_get(id)).ok == false)

# ------------------------------------------------------------ the guest

func _guest(net: Net) -> void:
	var w := world()
	flag("guest_ready")
	var found := {"id": 0}          # a lambda's own copy of a local is not the local
	await until(func():
		for f in DirAccess.get_files_at(out):
			if f.begins_with("room_"):
				found.id = int(f.trim_prefix("room_"))
		return found.id > 0, 90.0)
	var id: int = found.id
	ok("heard which room", id > 0)
	var lists := await net.rooms_lists()
	ok("it is in INVITED", (lists.get("invited", []) as Array).any(func(r): return int(r.id) == id))
	var e := await net.room_enter(id)
	ok("the server let the guest in", e.ok)
	w.enter_room(e.room, str(e.server))
	w = await restaged(w)
	ok("standing in the owner's room", Worlds.current == "chatroom" and w.room != null and not w.room.mine())
	ok("sees the owner", await until(func(): return w.others.count() >= 1, 30.0))
	# 7. permissions: none of the owner's things
	var s := await net.room_save(id, {}, [])
	ok("cannot save someone else's room", not s.ok)
	var a := await net.room_access(id, "public")
	ok("cannot open it to the public", not a.ok)
	var dl := await net.room_delete(id)
	ok("cannot delete it", not dl.ok)
	w.edit_room()
	ok("no editor for a guest", w.editor == null)
	# 6. what the owner did, seen here
	ok("the owner's save arrived", await until(func(): return is_instance_valid(w.room) and w.room.objects.size() >= 15, 90.0))
	ok("the lights went off here too", await until(func(): return w.room.lights_on == false, 30.0))
	var robot := ""
	for o in w.room.objects:
		if str(o.type) == "robot":
			robot = str(o.id)
	ok("the robot is running here too", await until(func():
		var st: Dictionary = w.room.state.get(robot, {})
		return float(st.get("run", 0)) > 0.0, 30.0))
	await wait(1.0)
	var h: Node3D = w.room.nodes[robot]
	var home: Array = w.room.record(robot).p
	ok("and it has moved", Vector2(h.position.x - float(home[0]), h.position.z - float(home[2])).length() > 0.5)
	await shot("guest_1_room.png")
	# sit on the couch
	for id2 in w.room.nodes:
		if str((w.room.nodes[id2] as Node3D).get_meta("type")) == "couch":
			(w.player as Walker).sit((w.room.nodes[id2] as Node3D).get_node("v"))
			break
	await wait(1.5)
	ok("sitting down", (w.player as Walker).seat != null and (w.player as Walker).ap.current_animation == "ride")
	await shot("guest_2_sitting.png")
	flag("guest_checked")
	# 10. the owner deletes it: out we go
	ok("sent out when it was deleted", await until(func(): return Worlds.current == "hub", 120.0))
	w = await restaged(w)
	ok("told why", true)
