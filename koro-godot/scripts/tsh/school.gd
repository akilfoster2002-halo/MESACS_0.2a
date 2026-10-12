## TSH · HARBOR LANE HIGH — public/tshschool.js (the building, its people, the sneak), tshlab.js (Room 120 alive) and
## the school's films from tsh.js (lobbyScene, schoolPA, caughtScene, labScene, benchPuzzles, robotLives, talkScene,
## outsideScene), ported. The school is the browser's own, exported with its moving parts named (export_day.js).
##
## THE SNEAK. She is late, her teacher is in the lobby, and Room 114 is up the hall and round the corner. Her teacher
## walks a round and sees down a cone in front of her (drawn on the floor). Inside it, with nothing in the way, a
## meter fills, faster the closer she is. What is in the way: the walls; a student walking between them; the bulletin
## board (E: read it, back to the room — it does not fool her up close); the bathroom (E: in, wait, out — and she is
## right there). Every way it can go ends the same: "Robin."
class_name School
extends Node

const SX := 400.0
const STUDENTS := ["s", "t", "u", "v", "x", "nia", "zuri"]          # walk-s … walk-x, nia, zuri (people/*.glb)
## her round: [x (plan), z, wait at it, which way she looks while she waits]
const TEACHER_ROUTE := [[2.5, -4.2, 2.5, 0.0], [-8.6, 2, 3.5, -PI/2], [-3, 6.5, 0.8, 0.0], [2, -5, 1.2, PI], [2, -16, 2.2, -PI/2],
	[2, -26, 2.4, PI/2], [2, -32.8, 0.6, PI], [2, -36, 3.5, 0.0], [2, -31, 0.5, 0.0], [2, -20, 1.5, PI/2], [2, -5, 1, 0.0]]
const CONE := {"half": 0.62, "range": 9.0}
const PA_AFTER := 150.0

var g
var data := {}; var parts := {}; var sp := {}
var built := false
var people: Array = []
var teacher = null; var guard = null
var sn = null                  # the sneak: {meter, hidden, board, done, t, pa, warned}
var cone: MeshInstance3D; var cone_mat: StandardMaterial3D
var seen_bar: Control; var seen_fill: ColorRect
var lights_node: Node3D; var lab_light: OmniLight3D; var t_light: OmniLight3D
var nodes := {}
var robot := {"on": false, "field": false, "fix": 0, "t": 0.0}
var lab := {"t": 0.0, "arc_t": 0.0}
var core_mat: ShaderMaterial
var bolts: MeshInstance3D; var bolts_im: ImmediateMesh; var t_arcs: MeshInstance3D; var t_im: ImmediateMesh
var mood := 0.0
var bench = null
var phones: Node3D
var out_civs: Array = []

func _init(game) -> void: g = game
func X(v: float) -> float: return SX + v
func _a(v) -> Vector2: return Vector2(v[0], v[1])

# ================================================================== the building
func build() -> void:
	if built: return
	built = true
	data = g._json("res://assets/tsh/school.json"); parts = g._json("res://assets/tsh/school_parts.json"); sp = data.spots
	var stack: Array = [g.school]
	while stack.size():
		var n: Node = stack.pop_back(); stack.append_array(n.get_children())
		if n.name.begins_with("robot") or n.name.begins_with("lab_") or n.name.begins_with("SH"): nodes[String(n.name)] = n
	for h in parts.hidden:
		var n = g.school.find_child(h, true, false)
		if n: n.visible = false
	# the four shaders
	var SH := [load("res://shaders/tsh_lab_fresnel.gdshader"), load("res://shaders/tsh_lab_core.gdshader"), null, load("res://shaders/tsh_lab_stripes.gdshader")]
	for s in parts.shaders:
		var mi = nodes.get(s.name)
		if mi == null or not mi is MeshInstance3D: continue
		var m := ShaderMaterial.new(); m.shader = SH[int(s.k)]
		for k in s.u:
			if k == "uT" or s.u[k] == null: continue
			var v = s.u[k]
			m.set_shader_parameter(k, Vector3(v[0], v[1], v[2]) if v is Array else float(v))
		if int(s.k) != 1: m.render_priority = 101
		else: core_mat = m
		(mi as MeshInstance3D).material_override = m
	# the krackle swarm: points orbiting the field
	var kr = load("res://shaders/tsh_lab_krackle.gdshader")
	for c in parts.clouds:
		var aS: Array = c.aS; var nP := aS.size()/4
		var arr := []; arr.resize(Mesh.ARRAY_MAX)
		var pos := PackedVector3Array(); var cu := PackedFloat32Array()
		for i in nP: pos.append(Vector3.ZERO); cu.append_array([aS[i*4], aS[i*4 + 1], aS[i*4 + 2], aS[i*4 + 3]])
		arr[Mesh.ARRAY_VERTEX] = pos; arr[Mesh.ARRAY_CUSTOM0] = cu
		var am := ArrayMesh.new()
		am.add_surface_from_arrays(Mesh.PRIMITIVE_POINTS, arr, [], {}, Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT)
		var mi2 := MeshInstance3D.new(); mi2.mesh = am; mi2.extra_cull_margin = 4
		var m2 := ShaderMaterial.new(); m2.shader = kr; m2.set_shader_parameter("uRim", Vector3(c.u.uRim[0], c.u.uRim[1], c.u.uRim[2])); m2.set_shader_parameter("uScale", float(c.u.uScale))
		mi2.material_override = m2
		var M: Array = c.m; mi2.position = Vector3(M[12], M[13], M[14])
		g.school.add_child(mi2)
	# lightning: re-drawn twenty times a second
	var at: Array = parts.lab.at
	bolts_im = ImmediateMesh.new(); bolts = MeshInstance3D.new(); bolts.mesh = bolts_im; bolts.position = Vector3(at[0], 0, at[2])
	var bm := StandardMaterial3D.new(); bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; bm.albedo_color = Color(1.4, 0.8, 2.2); bm.render_priority = 101
	bolts.material_override = bm; g.school.add_child(bolts)
	t_im = ImmediateMesh.new(); t_arcs = MeshInstance3D.new(); t_arcs.mesh = t_im; t_arcs.material_override = bm; g.school.add_child(t_arcs)
	# the building's lights (the browser's pool, as fixed lights here)
	lights_node = Node3D.new(); lights_node.name = "SchoolLights"; g.add_child(lights_node)
	for l in data.lights:
		var o := OmniLight3D.new(); o.position = Vector3(l.x, l.y, l.z); o.omni_range = float(l.d); o.light_energy = float(l.k)*0.035
		o.light_color = Color(1.0, 0.97, 0.92); lights_node.add_child(o); o.set_meta("e", o.light_energy)
		if l.has("mul") and absf(l.x - at[0]) < 0.1 and absf(l.z - at[2]) < 0.1: lab_light = o; o.light_color = Color(0.62, 0.3, 1.0); o.light_energy = float(l.k)*0.3
		elif l.has("mul"): t_light = o; o.light_color = Color(0.7, 0.55, 1.0)
	lights_node.visible = false
	# her teacher's eyes, on the floor
	cone = MeshInstance3D.new(); var cm := ArrayMesh.new(); var pts := PackedVector3Array([Vector3(0, 0.02, 0)]); var seg := 24
	for i in seg + 1: var a: float = -CONE.half + float(i)/seg*CONE.half*2; pts.append(Vector3(sin(a)*CONE.range, 0.02, cos(a)*CONE.range))
	var idx := PackedInt32Array(); for i in range(1, seg + 1): idx.append_array([0, i + 1, i])
	var arr2 := []; arr2.resize(Mesh.ARRAY_MAX); arr2[Mesh.ARRAY_VERTEX] = pts; arr2[Mesh.ARRAY_INDEX] = idx
	cm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr2); cone.mesh = cm
	cone_mat = StandardMaterial3D.new(); cone_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cone_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cone_mat.cull_mode = BaseMaterial3D.CULL_DISABLED; cone_mat.albedo_color = Color(1, 0.82, 0.38, 0.18); cone_mat.render_priority = 101; cone_mat.no_depth_test = false
	cone.material_override = cone_mat; cone.visible = false; g.add_child(cone)
	# the meter: how close she is to seeing you
	seen_bar = Control.new(); seen_bar.set_anchors_preset(Control.PRESET_CENTER_TOP); seen_bar.position = Vector2(-130, 60); seen_bar.size = Vector2(260, 30); seen_bar.visible = false
	var back := ColorRect.new(); back.color = Color(0, 0, 0, 0.5); back.size = Vector2(260, 10); back.position = Vector2(0, 18); seen_bar.add_child(back)
	seen_fill = ColorRect.new(); seen_fill.color = Color(1, 0.82, 0.38); seen_fill.size = Vector2(0, 10); seen_fill.position = Vector2(0, 18); seen_bar.add_child(seen_fill)
	var lb := Label.new(); lb.text = "👁  SEEN"; lb.add_theme_font_size_override("font_size", 13); seen_bar.add_child(lb)
	g.hud.add_child(seen_bar)
	populate()

func populate() -> void:
	for n in people: n.node.queue_free()
	people.clear()
	guard = _add("guard", sp.guard[0], sp.guard[1], PI*0.75)
	teacher = _add("teacher", sp.teacherLobby[0], sp.teacherLobby[1], 0.0)
	teacher.route = TEACHER_ROUTE.map(func(r): return {"x": X(r[0]), "z": r[1], "w": r[2], "look": r[3]})
	var k := 0
	for w in [[0, 2.6, -10, 0.95, -32, -7], [1, 3.6, -26, 1.1, -32, -7], [2, 0.4, -18, 0.85, -32, -7], [3, 1.4, -8, 1.0, -32, -7], [4, -3, 6, 0.9, 1, 14], [5, 6.6, 2, 1.05, -4, 12]]:
		var n := _add(STUDENTS[w[0]], X(w[1]), w[2], 0.0); n.walk = {"a": w[4], "b": w[5], "dir": 1 if k % 2 else -1, "sp": w[3], "x": X(w[1])}; k += 1
	for st in [[6, -0.3, -22, PI/2], [1, 5.6, 9, PI*0.9], [2, 12, -25.2, PI], [3, 13, -26.8, 0.0]]:
		var n2 := _add(STUDENTS[st[0]], X(st[1]), st[2], st[3]); n2.chat = true
func _add(file: String, x: float, z: float, yaw: float) -> Dictionary:
	var node: Node3D = (load("res://assets/tsh/people/%s.glb" % file) as PackedScene).instantiate(); g.school.add_child(node)
	var ap: AnimationPlayer = g._find(node, func(q): return q is AnimationPlayer)
	if ap:
		for nm in ap.get_animation_list(): ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
	var n := {"node": node, "ap": ap, "x": x, "z": z, "yaw": yaw, "clip": "", "t": randf()*5, "hold": false, "walk": null, "chat": false, "moving": false, "ri": 0, "wait": 0.0, "route": []}
	people.append(n); _place(n)
	return n
func _place(n: Dictionary) -> void:
	n.node.position = Vector3(n.x, 0, n.z); n.node.rotation.y = n.yaw
func play(n: Dictionary, nm: String) -> void:
	if n.ap and n.clip != nm and n.ap.has_animation(nm): n.clip = nm; n.ap.play(nm, 0.2)

## a save in the school picks up here
func enter_at(step: String) -> void:
	into_school()
	match step:
		"sneak": g.place(Vector3(sp.lobbyStop[0], 0, sp.lobbyStop[1] + 0.4), 0.0); sneak_begin()
		"detention", "after": detention()
		_: g.place(Vector3(sp.inside[0], 0, sp.inside[1]), 0.0); lobby()

func into_school() -> void:
	build()
	g.kit_all(false); g.kit_set(g.SCHOOL_KIT); g.shades(false)
	g.indoor = "school"; g.show_place("school")
	g.boots.ground = true

# ================================================================== every frame
func tick(dt: float) -> void:
	if not built: return
	if not g.school.visible: _lab_mood(0.0, dt); return
	for n in people: _tick_person(n, dt)
	_tick_sneak(dt)
	_tick_robot(dt)
	_tick_lab(dt)
	if bench != null:
		g.cam.global_position = bench.cam; g.cam.look_at(bench.look); g.cam.fov = 50
	# the board and the bathroom: E
	if sn != null and not sn.done and g.mode == "":
		var p: Vector3 = g.robin.position
		if Vector2(p.x - sp.board[0], p.z - sp.board[1]).length() < 1.7: g.set_caption("E — read the bulletin board")
		elif Vector2(p.x - sp.bathroom[0], p.z - sp.bathroom[1]).length() < 1.9: g.set_caption("E — the bathroom")
func _tick_person(n: Dictionary, dt: float) -> void:
	n.t += dt; n.moving = false
	if n == teacher: _tick_teacher(n, dt)
	elif n.walk != null and not n.hold:
		var w: Dictionary = n.walk; var zt: float = w.b if w.dir > 0 else w.a; var dz: float = zt - n.z
		if absf(dz) < 0.2: w.dir = -w.dir
		else: n.z += signf(dz)*w.sp*dt; n.x += (w.x - n.x)*minf(1, dt*2); n.yaw = 0.0 if dz > 0 else PI; n.moving = true
	if n.moving: play(n, "walk")
	elif n.chat: play(n, "talk" if sin(n.t*0.7 + n.x) > 0.6 else "idle")
	elif n != teacher or not n.has("cut"): play(n, "idle")
	_place(n)
func _tick_teacher(n: Dictionary, dt: float) -> void:
	if sn == null or n.hold: return
	var R: Array = n.route; var p: Dictionary = R[n.ri]
	if n.wait > 0:
		n.wait -= dt; n.yaw += Fight.ang_diff(p.look, n.yaw)*minf(1, dt*3)
		if n.wait < 1.2 and n.wait > 0.9: n.yaw += sin(n.t*6)*dt*2
		return
	var dx: float = p.x - n.x; var dz: float = p.z - n.z; var d := sqrt(dx*dx + dz*dz)
	if d < 0.15: n.wait = p.w; n.ri = (n.ri + 1) % R.size(); return
	var step := minf(d, 1.15*dt)
	n.x += dx/d*step; n.z += dz/d*step; n.yaw += Fight.ang_diff(atan2(dx, dz), n.yaw)*minf(1, dt*6); n.moving = true

## a line of sight through the building: no solid box between the two points
func los(a: Vector3, b: Vector3) -> bool:
	var d := b - a
	for s in g.boots.solids:
		if s[0] > maxf(a.x, b.x) or s[1] < minf(a.x, b.x) or s[2] > maxf(a.z, b.z) or s[3] < minf(a.z, b.z): continue
		var t0 := 0.0; var t1 := 1.0; var ok := true
		for ax in 3:
			var lo: float = [s[0], s[4], s[2]][ax]; var hi: float = [s[1], s[5], s[3]][ax]; var o: float = a[ax]; var dd: float = d[ax]
			if absf(dd) < 1e-6:
				if o < lo or o > hi: ok = false; break
			else:
				var ta := (lo - o)/dd; var tb := (hi - o)/dd
				if ta > tb: var tt := ta; ta = tb; tb = tt
				t0 = maxf(t0, ta); t1 = minf(t1, tb)
				if t0 > t1: ok = false; break
		if ok: return false
	return true
## her eyes: a cone 70° wide and nine metres long, walls in the way, a student in the way
func sees(px: float, pz: float, py: float) -> float:
	var t = teacher
	if t == null or py > 2.5: return 0.0
	var dx: float = px - t.x; var dz: float = pz - t.z; var d := sqrt(dx*dx + dz*dz)
	if d > CONE.range: return 0.0
	if absf(Fight.ang_diff(atan2(dx, dz), t.yaw)) > CONE.half and d > 1.2: return 0.0
	if not los(Vector3(t.x, 1.6, t.z), Vector3(px, 1.3, pz)): return 0.0
	for n in people:
		if n == t or n == guard: continue
		var k: float = ((n.x - t.x)*dx + (n.z - t.z)*dz)/(d*d)
		if k <= 0.05 or k >= 0.95: continue
		if Vector2(n.x - (t.x + dx*k), n.z - (t.z + dz*k)).length() < 0.42: return 0.0
	return 3.0 if d < 2.2 else 1.0 + (CONE.range - d)/CONE.range*1.5

# ================================================================== the sneak
func sneak_begin() -> void:
	teacher.ri = 1; teacher.wait = 0.6; teacher.hold = false
	sn = {"meter": 0.0, "hidden": null, "board": false, "done": false, "t": 0.0, "pa": false, "warned": false}
	cone.visible = true; seen_bar.visible = true
	g.objective(g.QUEST.sneak.goal, ["Room 114: up the hall and round the corner.", "Out of her cone — or something between you. E at the board: read it. E at the bathroom: hide."])
	g.S.step = "sneak"; g._save()
func sneak_stop() -> void:
	sn = null; cone.visible = false; seen_bar.visible = false
func _tick_sneak(dt: float) -> void:
	if sn == null or sn.done: return
	var t = teacher; var p: Vector3 = g.robin.position
	cone.position = Vector3(t.x, 0, t.z); cone.rotation.y = t.yaw
	if sn.hidden != null:
		sn.hidden.t -= dt
		if sn.hidden.t <= 0: sn.hidden = null; caught_by("bathroom")
		return
	sn.t += dt
	if not sn.pa and sn.t > PA_AFTER: pa(); return
	if sn.pa: return
	var k := sees(p.x, p.z, p.y)
	if sn.board: k *= 1.4 if Vector2(p.x - t.x, p.z - t.z).length() < 2.4 else 0.2
	if k > 0:
		sn.meter = minf(1, sn.meter + k*dt*0.55)
		if not sn.warned and sn.meter > 0.35: sn.warned = true; g.cue("sus")
	else: sn.meter = maxf(0, sn.meter - dt*0.25)
	cone_mat.albedo_color = Color(1, 0.82 - sn.meter*0.6, 0.38 - sn.meter*0.3, 0.16 + sn.meter*0.2)
	seen_fill.size.x = 260*sn.meter; seen_fill.color = cone_mat.albedo_color; seen_fill.color.a = 1
	if sn.meter >= 1: caught_by("seen"); return
	if Vector2(p.x - sp.room114[0], p.z - sp.room114[1]).length() < 1.3:
		var near: bool = Vector2(p.x - t.x, p.z - t.z).length() < 9 and los(Vector3(t.x, 1.6, t.z), Vector3(p.x, 1.3, p.z))
		if near: caught_by("door")
		else: pa()
## E: the board (read it, back to the hall) or the bathroom (in, and wait it out)
func key(ev: InputEventKey) -> bool:
	if sn == null or sn.done or not ev.pressed or ev.echo: return false
	if g.mode == "read": read_stop(); return true
	if g.mode != "" or ev.keycode != KEY_E: return false
	var p: Vector3 = g.robin.position
	if Vector2(p.x - sp.board[0], p.z - sp.board[1]).length() < 1.7:
		g.mode = "read"; g.stage("idle", sp.board[0], 0, sp.board[1], -PI/2); sn.board = true; g.cue("ui")
		g.note("📌 Very interested in the Robotics Club. (Any key to stop.)"); return true
	if Vector2(p.x - sp.bathroom[0], p.z - sp.bathroom[1]).length() < 1.9 and sn.hidden == null:
		g.black(true); g.get_tree().create_timer(0.4).timeout.connect(func(): g.black(false))
		g.mode = "wc"; g.robin.visible = false; sn.hidden = {"t": 4.5}; g.cue("door"); g.note("🚻 Give it a minute."); return true
	return false
func read_stop() -> void:
	g.staged = null; if sn != null: sn.board = false
	g.mode = ""; g.place(g.robin.position, g.cam_yaw)
## THE PA: three notes, and her name over every speaker in the building
func pa() -> void:
	if sn == null or sn.pa: return
	sn.pa = true; sn.meter = 0.0; seen_bar.visible = false
	if g.mode == "read": read_stop()
	var at: Vector3 = g.robin.position; var face: float = g.cam_yaw + PI
	g.play_reel([{"mood": "annoyed", "dur": g.lines_len("pa") + 2.2, "fov": 36, "inside": true, "cam": g.rel(at.x, at.z, face, 1.4, 0.3, at.y + 1.35), "look": at + Vector3(0, 1.55, 0),
		"enter": func(): g.stage("idle", at.x, at.y, at.z, face); g.cue("pa"),
		"beats": [[1.5, func(): g.talk("pa")], [g.lines_len("pa") + 1.5, func(): g.stage("idle", at.x, at.y, at.z, face + 0.6)]]}],
		func(_s): g.black(true); g.get_tree().create_timer(0.4).timeout.connect(func(): g.black(false); caught_by("pa")))
func caught_by(how: String) -> void:
	if sn == null or sn.done: return
	sn.done = true; cone.visible = false; seen_bar.visible = false
	var p: Vector3 = g.robin.position; var t = teacher
	match how:
		"bathroom": t.x = sp.bathroom[0] + 2.2; t.z = sp.bathroom[1] + 0.4
		"door": t.x = p.x - 2.0; t.z = p.z + 0.3
		"pa": t.x = sp.room120In[0]; t.z = sp.room120In[1] - 0.4
	t.yaw = atan2(p.x - t.x, p.z - t.z); t.hold = true
	caught_scene(how)

# ================================================================== the films
func _person_look(n) -> Vector3: return Vector3(n.x, 1.55, n.z)
## INT. HARBOR LANE HIGH — 9:01 AM. In through the revolving door; the atrium; "Morning, Robin." "Long night?";
## and across the lobby, her teacher. "...Nope."
func lobby() -> void:
	into_school()
	var t = teacher; var gd = guard
	var door := Vector2(sp.door[0], 15.2); var in_ := Vector2(sp.inside[0], 12.4); var stop := _a(sp.lobbyStop); var north := PI; var tl := _a(sp.teacherLobby)
	t.x = tl.x; t.z = tl.y; t.yaw = PI; t.hold = true; gd.hold = true
	var faceT := atan2(t.x - stop.x, t.z - stop.y); var faceG := atan2(stop.x - gd.x, stop.y - gd.z)
	var ln: float = g.lines_len("lobby")
	var shots := [
		{"dur": 2.4, "fov": 46, "inside": true, "cam": Vector3(X(5.6), 1.6, 9.2), "look": Vector3(X(2), 1.4, 14),
			"enter": func(): g.set_caption("INT. HARBOR LANE HIGH — 9:01 AM"); g.cue("door"),
			"tick": func(dt, tt, k): g.walk_stage(door, in_, k)},
		{"dur": 3.6, "fov": 62, "cam": [Vector3(X(1.0), 1.3, 13.4), Vector3(X(0.6), 1.2, 13.0)], "look": func(k, tt): return Vector3(X(4 + k*3), 3 + k*14, 4 - k*4),
			"enter": func(): g.stage("idle", in_.x, 0, in_.y, north)},
		{"dur": ln + 0.6, "fov": 50, "cam": Vector3(X(5.2), 2.0, 14.4), "look": func(k, tt): return Vector3((g.robin.position.x + gd.x)/2, 1.3, (g.robin.position.z + gd.z)/2),
			"enter": func(): g.talk("lobby"); gd.yaw = faceG,
			"tick": func(dt, tt, k):
				if tt < ln*0.55: g.walk_stage(in_, stop, minf(1, tt/(ln*0.55)))
				else: g.stage("idle", stop.x, 0, stop.y, north)
				gd.yaw += Fight.ang_diff(atan2(g.robin.position.x - gd.x, g.robin.position.z - gd.z), gd.yaw)*minf(1, dt*3)},
		{"dur": 1.8, "fov": 32, "cam": g.rel(gd.x, gd.z, faceG, 1.5, 0.35, 1.72), "look": Vector3(gd.x, 1.6, gd.z),
			"enter": func(): g.stage("idle", stop.x, 0, stop.y, north); gd.yaw = faceG},
		{"mood": "tired", "dur": 1.6, "fov": 30, "cam": g.rel(stop.x, stop.y, faceT, -0.6, 0.35, 1.68), "look": Vector3(t.x, 1.55, t.z)},
		{"dur": 1.6, "fov": 26, "cam": g.rel(t.x, t.z, faceT + PI, 2.2, 0.2, 1.6), "look": Vector3(t.x, 1.6, t.z),
			"enter": func(): t.yaw = PI,
			"tick": func(dt, tt, k): if tt > 0.5: t.yaw += Fight.ang_diff(faceT + PI, t.yaw)*minf(1, dt*6)},
		{"mood": "nervous", "dur": g.lines_len("nope") + 0.9, "fov": 36, "cam": g.rel(stop.x, stop.y, faceT + PI, 1.6, 0.3, 1.6), "look": Vector3(stop.x, 1.45, stop.y),
			"enter": func(): g.stage("idle", stop.x, 0, stop.y, faceT); g.talk("nope"),
			"tick": func(dt, tt, k): g.stage("idle", stop.x, 0, stop.y, faceT + PI*clampf((tt - 0.25)/0.35, 0, 1))}]
	g.play_reel(shots, func(_s):
		g.staged = null
		g.place(Vector3(stop.x, 0, stop.y + 0.4), faceT)
		t.hold = false; gd.hold = false; gd.yaw = PI*0.25
		g.outcome("spotted"))

## "Robin." However it went. "I was here yesterday." "That's not really how attendance works." "Worth a shot."
## The assignment she hasn't done — and instead of detention: "Come on. I need your help."
func caught_scene(how: String) -> void:
	if g.mode == "read": read_stop()
	g.robin.visible = true; g.mode = ""
	var t = teacher
	var at: Vector2
	match how:
		"bathroom": at = Vector2(sp.bathroom[0] + 0.9, sp.bathroom[1])
		"pa": at = Vector2(sp.room120Door[0], sp.room120Door[1] + 1.4)
		_: at = Vector2(g.robin.position.x, g.robin.position.z)
	if how == "pa": g.place(Vector3(at.x, 0, at.y), 0.0); t.yaw = atan2(at.x - t.x, at.y - t.z)
	var away: float = PI/2 if how == "bathroom" else (atan2(t.x - at.x, t.z - at.y) if how == "pa" else atan2(at.x - t.x, at.y - t.z))
	var toT := atan2(t.x - at.x, t.z - at.y); var side := atan2(at.x - t.x, at.y - t.z)
	var mid := Vector2((t.x + at.x)/2, (t.z + at.y)/2); var two := free_cam(mid, side, 3.0, 1.6)
	var mine: Vector3 = g.rel(at.x, at.y, toT, 1.15, -0.25, 1.58); var hers: Vector3 = g.rel(t.x, t.z, side, 1.25, 0.2, 1.62)
	var still := func(): g.stage("idle", at.x, 0, at.y, toT)
	var tf: float = minf(72, 40/two.k); var tl := Vector3(mid.x, 1.45, mid.y)
	var shots := [
		{"dur": g.lines_len("caught") + 0.7, "fov": 38, "inside": true, "cam": g.rel(t.x, t.z, side, -1.1, 0.45, 1.75), "look": Vector3(at.x, 1.35, at.y),
			"enter": func(): g.stage("idle", at.x, 0, at.y, away); g.talk("caught"); g.cue("ui")},
		{"mood": "nervous", "dur": 1.5, "fov": 34, "cam": g.rel(at.x, at.y, toT, 1.3, -0.25, 1.6), "look": Vector3(at.x, 1.5, at.y),
			"tick": func(dt, tt, k): g.stage("idle", at.x, 0, at.y, away + Fight.ang_diff(toT, away)*clampf((tt - 0.55)/0.5, 0, 1))},
		{"mood": "sheepish", "dur": g.lines_len("caught2") + 0.4, "fov": tf, "cam": two.p, "look": tl, "enter": func(): still.call(); g.talk("caught2")},
		{"mood": "grin", "dur": g.lines_len("caught3") + 0.9, "fov": 30, "cam": mine, "look": Vector3(at.x, 1.55, at.y), "enter": func(): still.call(); g.talk("caught3")},
		{"dur": g.lines_len("assign") + 0.5, "fov": 30, "cam": hers, "look": _person_look(t), "enter": func(): g.talk("assign")},
		{"mood": "sheepish", "dur": 1.7, "fov": 30, "cam": mine, "look": Vector3(at.x, 1.55, at.y), "tick": func(dt, tt, k): g.stage("idle", at.x, 0, at.y, toT + sin(tt*2.2)*0.12)},
		{"dur": g.lines_len("frustrate") + 0.4, "fov": tf, "cam": two.p, "look": tl, "enter": func(): still.call(); g.talk("frustrate")},
		{"mood": "tired", "dur": 2.2, "fov": 28, "cam": mine, "look": Vector3(at.x, 1.55, at.y), "tick": func(dt, tt, k): if tt > 0.9: g.stage("idle", at.x, 0, at.y, toT + 0.45)},
		{"mood": "skeptical", "dur": g.lines_len("help") + 0.3, "fov": tf, "cam": two.p, "look": tl, "enter": func(): still.call(); g.talk("help")},
		{"mood": "soft", "dur": 1.8, "fov": 28, "cam": mine, "look": Vector3(at.x, 1.55, at.y), "enter": still}]
	g.play_reel(shots, func(_s):
		g.staged = null
		if not "assignment" in g.S.seen: g.S.seen.append("assignment")
		g.S.step = "detention"; g._save()
		g.black(true); g.get_tree().create_timer(0.5).timeout.connect(func(): g.black(false); detention()))
## a camera to one side of two people: whichever side is not inside a desk, a wall or a locker
func free_cam(mid: Vector2, along: float, d: float, y: float) -> Dictionary:
	var solid_at := func(x: float, z: float) -> bool:
		for s in g.boots.solids:
			if x > s[0] - 0.25 and x < s[1] + 0.25 and z > s[2] - 0.25 and z < s[3] + 0.25 and y < s[5] and y > s[4]: return true
		return false
	for k in [1.0, 0.75, 0.5]:
		for sg in [1, -1]:
			var c: Vector3 = g.rel(mid.x, mid.y, along + sg*PI/2, d*k, 0, y)
			var ok: bool = not solid_at.call(c.x, c.z)
			for j in range(1, 8):
				if not ok: break
				var f := j/8.0; ok = not solid_at.call(lerpf(c.x, mid.x, f), lerpf(c.z, mid.y, f))
			if ok: return {"p": c, "k": k}
	return {"p": g.rel(mid.x, mid.y, along + PI/2, d*0.4, 0, y), "k": 0.4}

## THE LAB (Room 120): not a classroom — a containment rig with a few centimetres of Psi Energy held in it
func detention() -> void:
	into_school(); sneak_stop()
	teacher.x = sp.teacherDesk[0]; teacher.z = sp.teacherDesk[1]; teacher.hold = true
	g.place(Vector3(sp.seat[0], 0, sp.seat[1] + 0.3), PI)
	var R: Node3D = nodes.get("robot"); if R: R.position = Vector3(sp.seatDesk[0], 0.77, sp.seatDesk[1] - 0.05); R.rotation.y = 0
	robot.fix = 0
	if g.S.step == "after": talk_scene(); return
	lab_scene()
func seated() -> void: g.stage("ride", sp.seat[0], 0, sp.seat[1] + 0.1, PI)
func stand_spots() -> Dictionary: return {"ex": Vector2(sp.seat[0], sp.seat[1] + 0.3), "T2": Vector2(sp.seat[0] - 1.45, sp.seat[1] + 0.85)}
func _t_go(a: Vector2, b: Vector2, k: float) -> void:
	teacher.x = lerpf(a.x, b.x, k); teacher.z = lerpf(a.y, b.y, k); teacher.yaw = atan2(b.x - a.x, b.y - a.y); teacher.moving = k < 1
	if k < 1: play(teacher, "walk")
func lab_scene() -> void:
	var t = teacher; var at: Array = parts.lab.at
	var rig := Vector2(at[0], at[2]); var door := Vector2(sp.room120Door[0], sp.room120Door[1] - 0.6)
	var A := Vector2(X(3.4), -38.0); var B := Vector2(X(4.8), -37.6); var S2 := stand_spots(); var ex: Vector2 = S2.ex; var T2: Vector2 = S2.T2; var d := _a(sp.seatDesk)
	var faceA := atan2(rig.x - A.x, rig.y - A.y); var faceB := atan2(A.x - B.x, A.y - B.y)
	var toBot := atan2(d.x - ex.x, d.y - ex.y); var toRobin := atan2(ex.x - T2.x, ex.y - T2.y); var toTeach := atan2(T2.x - ex.x, T2.y - ex.y)
	var mid := (A + B)/2; var away := atan2(mid.x - rig.x, mid.y - rig.y)
	var twoRig := Vector3(mid.x + sin(away)*2.4 + cos(away)*0.6, 1.6, mid.y + cos(away)*2.4 - sin(away)*0.6)
	var hers: Vector3 = g.rel(T2.x, T2.y, toRobin, 0.95, 0.4, 1.62); var mine: Vector3 = g.rel(ex.x, ex.y, toTeach, 0.9, -0.4, 1.56)
	robot.on = false; robot.field = false; robot.fix = 0
	g.objective("")
	if not "psi" in g.S.seen: g.S.seen.append("psi")
	var shots := [
		{"dur": 3.8, "fov": 56, "inside": true, "cam": Vector3(X(-3.6), 3.4, -35.0), "look": Vector3(rig.x, 1.3, rig.y),
			"enter": func(): g.set_caption("INT. ROBOTICS LAB — ROOM 120"); g.cue("door"),
			"tick": func(dt, tt, k): g.walk_stage(door, A, minf(1, k*1.25)); _t_go(Vector2(door.x + 0.6, door.y + 0.3), B, minf(1, k*1.2))},
		{"mood": "focused", "dur": 2.6, "fov": 30, "cam": g.rel(A.x, A.y, faceA, 1.1, 0.25, 1.6), "look": Vector3(A.x, 1.55, A.y),
			"enter": func(): g.stage("idle", A.x, 0, A.y, faceA); t.x = B.x; t.z = B.y; t.yaw = faceB},
		{"dur": 3.4, "fov": 48, "cam": func(k, tt): return Vector3(lerpf(rig.x + 0.6, rig.x + 0.25, k), lerpf(1.2, 1.6, k), lerpf(rig.y + 4.6, rig.y + 3.3, k)), "look": Vector3(rig.x, 1.6, rig.y),
			"beats": [[0.3, func(): g.cue("rise")]]},
		{"dur": 2.4, "fov": 44, "cam": Vector3(X(4.6), 1.8, -44.6), "look": func(k, tt): return Vector3(X(5.0 + k*2.6), 1.95, -47.7)},
		{"mood": "focused", "dur": g.lines_len("psi") + 0.4, "fov": 44, "cam": twoRig, "look": Vector3((mid.x + rig.x)/2, 1.45, (mid.y + rig.y)/2),
			"enter": func(): g.stage("idle", A.x, 0, A.y, faceA); g.talk("psi"),
			"tick": func(dt, tt, k): t.yaw += Fight.ang_diff(faceB if fmod(tt, 5.0) < 2.6 else atan2(rig.x - B.x, rig.y - B.y), t.yaw)*minf(1, dt*3)},
		{"dur": g.lines_len("psi2") + 1.4, "fov": 40, "inside": true, "cam": Vector3(d.x - 1.4, 1.4, d.y + 1.5), "look": Vector3(d.x, 1.05, d.y),
			"enter": func(): g.talk("psi2"), "beats": [[1.2, func(): robot.field = true; g.cue("fail")]]},
		{"dur": 2.4, "fov": 46, "cam": Vector3(X(4.2), 1.7, -36.6), "look": func(k, tt): return Vector3(g.robin.position.x, 1.2, g.robin.position.z),
			"tick": func(dt, tt, k): g.walk_stage(A, ex, k); _t_go(B, T2, minf(1, k*1.1))},
		{"mood": "focused", "dur": g.lines_len("spike") + 0.4, "fov": 34, "cam": Vector3(d.x + 0.95, 1.7, d.y - 1.05), "look": Vector3(ex.x - 0.05, 1.45, ex.y),
			"enter": func(): g.stage("idle", ex.x, 0, ex.y, toBot); t.x = T2.x; t.z = T2.y; t.yaw = toRobin; g.talk("spike")},
		{"dur": g.lines_len("what") + 0.5, "fov": 30, "cam": hers, "look": Vector3(T2.x, 1.6, T2.y), "enter": func(): g.talk("what")},
		{"dur": g.lines_len("fighting") + 0.4, "fov": 40, "cam": Vector3(ex.x + 1.6, 1.55, (ex.y + d.y)/2 + 0.35), "look": Vector3(ex.x - 0.2, 1.2, (ex.y + d.y)/2),
			"enter": func(): g.stage("talk", ex.x, 0, ex.y, toBot + 0.35); g.talk("fighting")},
		{"dur": g.lines_len("fighting2") + 0.6, "fov": 30, "cam": mine, "look": Vector3(ex.x, 1.55, ex.y), "enter": func(): g.stage("idle", ex.x, 0, ex.y, toTeach); g.talk("fighting2")},
		{"dur": g.lines_len("keepYou") + 0.8, "fov": 30, "cam": hers, "look": Vector3(T2.x, 1.6, T2.y), "enter": func(): g.talk("keepYou")}]
	g.play_reel(shots, func(_s): bench_puzzles())
## at the stand: the puzzles, over a camera on her shoulder — route the energy, match its frequency, stabilise the actuators
func bench_puzzles() -> void:
	var d := _a(sp.seatDesk)
	g.mode = "puzzle"; bench = {"cam": Vector3(d.x + 0.6, 1.6, d.y + 1.05), "look": Vector3(d.x, 1.0, d.y - 0.05)}; seated()
	robot.field = true
	g.objective("Stop the prototype fighting the field.", ["Route the Psi energy.", "Match its frequency.", "Stabilise the actuators."])
	var step := func(): robot.fix += 1; g.cue("gear")
	g.puzzle.open("route", {"levels": 3, "psi": true}, func():
		step.call()
		g.puzzle.open("freq", {"levels": 2}, func():
			step.call()
			g.puzzle.open("gears", {"levels": 2, "psi": true}, func():
				step.call(); bench = null; g.mode = ""; robot_lives())))
## it runs, in the field. "You did it." "Obviously." "Most people aren't me."
func robot_lives() -> void:
	var d := _a(sp.seatDesk); var t = teacher; var S2 := stand_spots(); var ex: Vector2 = S2.ex; var T2: Vector2 = S2.T2
	var toRobin := atan2(ex.x - T2.x, ex.y - T2.y); var toTeach := atan2(T2.x - ex.x, T2.y - ex.y)
	var two := free_cam((ex + T2)/2, toTeach, 2.6, 1.55); var hers: Vector3 = g.rel(T2.x, T2.y, toRobin, 0.95, 0.4, 1.62)
	t.x = T2.x; t.z = T2.y; t.yaw = toRobin; t.hold = true
	var tl := Vector3((ex.x + T2.x)/2, 1.45, (ex.y + T2.y)/2); var tf: float = minf(70, 42/two.k)
	if not "repair" in g.S.seen: g.S.seen.append("repair")
	var shots := [
		{"dur": 3.4, "fov": 44, "inside": true, "cam": Vector3(d.x + 1.3, 1.5, d.y + 1.0), "look": Vector3(d.x + 0.05, 1.1, d.y - 0.05),
			"enter": func(): seated(); robot.field = true; robot.on = true; robot.t = 0.0; g.cue("win")},
		{"mood": "smug", "dur": g.lines_len("didIt") + 0.5, "fov": tf, "cam": two.p, "look": tl, "enter": func(): g.stage("idle", ex.x, 0, ex.y, toTeach); g.talk("didIt")},
		{"mood": "grin", "dur": g.lines_len("most") + 0.4, "fov": tf, "cam": two.p, "look": tl, "enter": func(): g.talk("most")},
		{"dur": g.lines_len("laugh") + 0.8, "fov": 30, "cam": hers, "look": Vector3(T2.x, 1.6, T2.y), "enter": func(): g.talk("laugh")}]
	g.play_reel(shots, func(_s): g.S.step = "after"; g._save(); talk_scene())
## "That's exactly what I'm worried about." Brilliant — and starting to disappear. "Your mom knows how talented you
## are." It hits her. "Yeah." "I should get to class."
func talk_scene() -> void:
	var d := _a(sp.seatDesk); var t = teacher; var S2 := stand_spots(); var ex: Vector2 = S2.ex; var T2: Vector2 = S2.T2
	var toRobin := atan2(ex.x - T2.x, ex.y - T2.y); var toTeach := atan2(T2.x - ex.x, T2.y - ex.y)
	t.x = T2.x; t.z = T2.y; t.yaw = toRobin; t.hold = true
	robot.on = true; robot.field = true
	if not "mother" in g.S.seen: g.S.seen.append("mother")
	var mine: Vector3 = g.rel(ex.x, ex.y, toTeach, 0.9, -0.4, 1.56); var hers: Vector3 = g.rel(T2.x, T2.y, toRobin, 0.95, 0.4, 1.62)
	var two := free_cam((ex + T2)/2, toTeach, 2.6, 1.55); var tl := Vector3((ex.x + T2.x)/2, 1.45, (ex.y + T2.y)/2); var tf: float = minf(70, 42/two.k)
	var still := func(k := 0.0): g.stage("idle", ex.x, 0, ex.y, toTeach + k)
	var her_look := Vector3(T2.x, 1.6, T2.y); var my_look := Vector3(ex.x, 1.55, ex.y)
	var tc: float = g.lines_len("toClass")
	var shots := [
		{"dur": g.lines_len("worried") + 0.6, "fov": 30, "inside": true, "cam": hers, "look": her_look, "enter": func(): still.call(0.7); g.talk("worried"); g.music.stop()},
		{"mood": "skeptical", "dur": 1.4, "fov": 30, "cam": mine, "look": my_look, "tick": func(dt, tt, k): still.call(0.7*(1 - clampf(tt/0.6, 0, 1)))},
		{"dur": g.lines_len("brilliant") + 0.4, "fov": tf, "cam": two.p, "look": tl, "enter": func(): still.call(); g.talk("brilliant")},
		{"dur": g.lines_len("intuition") + 0.3, "fov": 30, "cam": hers, "look": her_look, "enter": func(): g.talk("intuition")},
		{"mood": "tired", "dur": g.lines_len("but") + 0.3, "fov": 28, "cam": mine, "look": my_look, "enter": func(): still.call(0.25); g.talk("but")},
		{"dur": g.lines_len("disappear") + 0.3, "fov": 30, "cam": hers, "look": her_look, "enter": func(): g.talk("disappear")},
		{"mood": "tired", "dur": 2.2, "fov": 28, "cam": mine, "look": my_look, "enter": func(): still.call(0.3)},
		{"dur": g.lines_len("best") + 0.4, "fov": 30, "cam": hers, "look": her_look, "enter": func(): g.talk("best")},
		{"mood": "sad", "dur": 1.8, "fov": 30, "cam": mine, "look": my_look, "tick": func(dt, tt, k): still.call(0.75*clampf(tt/0.8, 0, 1))},
		{"dur": g.lines_len("mom") + 0.4, "fov": 30, "cam": hers, "look": Vector3(T2.x, 1.58, T2.y), "enter": func(): g.talk("mom")},
		{"mood": "sad", "dur": 3.6, "fov": 26, "cam": g.rel(ex.x, ex.y, toTeach + 0.75, 0.95, -0.1, 1.56), "look": Vector3(ex.x, 1.52, ex.y),
			"tick": func(dt, tt, k): if tt > 1.4: still.call(0.75 + 0.25*clampf((tt - 1.4)/1.2, 0, 1))},
		{"dur": 1.8, "fov": 30, "cam": hers, "look": Vector3(T2.x, 1.58, T2.y)},
		{"mood": "sad", "dur": g.lines_len("yeah") + 1.1, "fov": 28, "cam": g.rel(ex.x, ex.y, toTeach + 0.9, 1.0, 0.1, 1.55), "look": Vector3(ex.x, 1.5, ex.y), "enter": func(): still.call(1.0); g.talk("yeah")},
		{"mood": "sad", "dur": 2.2, "fov": 40, "cam": g.rel(ex.x, ex.y, toTeach + 0.4, 1.7, 0, 1.45), "look": Vector3(ex.x, 1.1, ex.y),
			"enter": func(): g.stage("text", ex.x, 0, ex.y, PI*0.9), "beats": [[0.8, func(): g.cue("zip")]]},
		{"mood": "sad", "dur": tc + 2.4, "fov": 44, "cam": g.rel(ex.x, ex.y, toTeach, 2.8, 0.6, 1.6), "look": func(k, tt): return Vector3(g.robin.position.x, 1.3, g.robin.position.z),
			"enter": func(): still.call(0.4); g.talk("toClass"),
			"tick": func(dt, tt, k):
				if tt < tc: still.call(0.4)
				else: g.walk_stage(ex, Vector2(sp.room120Door[0], sp.room120Door[1] - 0.8), minf(1, (tt - tc)/2.4))}]
	g.play_reel(shots, func(_s):
		g.outcome("out")
		g.black(true); g.get_tree().create_timer(0.5).timeout.connect(func(): g.black(false); outside_scene()))

## OUTSIDE. Through the school doors into the sun; students everywhere. Headphones in. She walks — not bouncing now
## — and looks up at the city, and past it at the sky.
func headphones(v: bool) -> void:
	if phones: phones.queue_free(); phones = null
	if not v: return
	var sk: Skeleton3D = g._find(g.model, func(x): return x is Skeleton3D)
	var bi := -1
	for i in sk.get_bone_count(): if sk.get_bone_name(i).ends_with("Head"): bi = i
	if bi < 0: return
	var att := BoneAttachment3D.new(); att.bone_idx = bi; sk.add_child(att)
	var gr := Node3D.new(); att.add_child(gr)
	gr.scale = Vector3.ONE/maxf(0.001, sk.global_basis.get_scale().x)
	var shell := StandardMaterial3D.new(); shell.albedo_color = Color("#111316"); shell.roughness = 0.35; shell.metallic = 0.4
	var band := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.087; tm.outer_radius = 0.109; band.mesh = tm; band.material_override = shell
	band.rotation.x = PI/2; band.position = Vector3(0, 0.075, 0); band.scale = Vector3(1, 1, 0.6); gr.add_child(band)
	for sd in [-1, 1]:
		var cup := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.042; cm.bottom_radius = 0.042; cm.height = 0.03; cup.mesh = cm; cup.material_override = shell
		cup.rotation.z = PI/2; cup.position = Vector3(sd*0.094, 0.07, 0); gr.add_child(cup)
		var ring := MeshInstance3D.new(); var rm := TorusMesh.new(); rm.inner_radius = 0.024; rm.outer_radius = 0.04; ring.mesh = rm
		var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_color = Color(0.2, 1.4, 1.1); ring.material_override = gm
		ring.rotation.z = PI/2; ring.position = Vector3(sd*0.111, 0.07, 0); gr.add_child(ring)
	phones = att
func leave_school() -> void:
	_lab_mood(0.0, 10.0); sneak_stop()
	g.show_place("city")
func outside_scene() -> void:
	leave_school()
	g.S.dm = 15*60 + 20
	if not "outside" in g.S.seen: g.S.seen.append("outside")
	var d: Array = g.nav.spots.schoolDoor
	var lane := Vector2(d[0] - 1.0, d[1] - 4.2); var far := Vector2(d[0] - 7, d[1] - 4.6)
	for c in out_civs: c.node.queue_free()
	out_civs.clear()
	var i := 0
	for ab in [[1.5, -1.2], [-2.4, -2.0], [3.2, -3.4], [-4.5, -3.6], [2.0, -5.2], [-1.0, -6.0], [5.0, -2.2]]:
		var node: Node3D = (load("res://assets/tsh/people/%s.glb" % STUDENTS[i]) as PackedScene).instantiate(); g.add_child(node)
		node.position = Vector3(d[0] + ab[0], 0, d[1] + ab[1]); node.rotation.y = atan2(1 if i % 2 else -1, -1)
		var ap: AnimationPlayer = g._find(node, func(q): return q is AnimationPlayer)
		if ap: ap.get_animation("idle").loop_mode = Animation.LOOP_LINEAR; ap.play("idle")
		out_civs.append({"node": node}); i += 1
	var shots := [
		{"dur": 3.0, "fov": 46, "inside": false, "cam": Vector3(d[0] + 3.2, 1.7, d[1] - 6.2), "look": Vector3(d[0], 1.4, d[1] - 0.6),
			"enter": func(): g.set_caption("EXT. HARBOR LANE HIGH — 3:20 PM"); g.cue("door"),
			"tick": func(dt, tt, k): g.walk_stage(Vector2(d[0], d[1] + 0.6), lane, k*0.8)},
		{"mood": "sad", "dur": 2.4, "fov": 30, "cam": g.rel(lane.x, lane.y, PI, 1.0, 0.25, 1.6), "look": Vector3(lane.x, 1.55, lane.y),
			"enter": func(): g.stage("idle", lane.x, 0, lane.y, PI), "beats": [[0.7, func(): headphones(true); g.cue("ui")]]},
		{"mood": "sad", "dur": 4.0, "fov": 40, "cam": func(k, tt): return Vector3(lerpf(lane.x + 1.6, far.x + 1.6, k), 1.5, lerpf(lane.y - 2.6, far.y - 2.6, k)),
			"look": func(k, tt): return Vector3(g.robin.position.x, 1.3, g.robin.position.z),
			"tick": func(dt, tt, k): g.walk_stage(lane, far, k)},
		{"mood": "sad", "dur": 2.8, "fov": 50, "cam": g.rel(far.x, far.y, -PI/2, 0.6, 0.3, 1.0), "look": Vector3(far.x - 20, 26, far.y - 10),
			"enter": func(): g.stage("idle", far.x, 0, far.y, -PI/2 + 0.3)},
		{"dur": 3.0, "fov": 44, "cam": Vector3(far.x + 0.3, 1.6, far.y + 0.4), "look": func(k, tt): return Vector3(far.x - 10, 30 + k*60, far.y - 30)}]
	g.play_reel(shots, func(_s):
		g.staged = null
		g.place(Vector3(far.x, 0, far.y), -PI/2)
		if g.S.step == "after": g.outcome("out")
		g.objective("")
		g.courtyard_begin())

# ================================================================== the robot, and the lab alive
func _robot_part(nm: String) -> Node3D: return nodes.get(nm) as Node3D
func _glow_of(n: Node3D) -> Array:
	var out := []
	if n == null: return out
	var stack: Array = [n]
	while stack.size():
		var c: Node = stack.pop_back(); stack.append_array(c.get_children())
		if c is MeshInstance3D:
			var mi := c as MeshInstance3D
			var m = mi.material_override if mi.material_override else mi.get_active_material(0)
			if m is StandardMaterial3D:
				if not mi.has_meta("own"): m = m.duplicate(); mi.material_override = m; mi.set_meta("own", true)
				out.append(m)
	return out
func _emit(n: Node3D, c: Color, k: float) -> void:
	for m in _glow_of(n): m.emission_enabled = true; m.emission = c; m.emission_energy_multiplier = k
func _tick_robot(dt: float) -> void:
	robot.t += dt
	var body := _robot_part("robot_body"); var head := _robot_part("robot_head"); var arm := _robot_part("robot_arm")
	var eye := _robot_part("robot_eye"); var panel := _robot_part("robot_panel")
	if body == null: return
	if not robot.on:
		if robot.field:
			var k := maxf(0, 1 - robot.fix/3.0); var j := func(): return (randf() - 0.5)*k
			body.rotation.x = 0.15 + j.call()*0.5; body.rotation.z = j.call()*0.4
			if head: head.rotation = Vector3(j.call()*0.8, j.call()*1.2, 0)
			if arm: arm.rotation.z = 0.8 + j.call()*2.2
			_emit(eye, Color(1, 0.2, 0.2), 2.5*k if randf() < 0.5 else 0.2)
			_emit(panel, Color(1, 0.25 + robot.fix*0.2, 0.15), 1.5)
			for i in 8: _emit(_robot_part("robot_ring%d" % i), Color(1, 0.2 + robot.fix*0.25, 0.2), 1.5 + randf()*2.5*k)
		return
	body.rotation.x += -body.rotation.x*minf(1, dt*4); body.rotation.z += -body.rotation.z*minf(1, dt*4)
	if head: head.rotation.x += -head.rotation.x*minf(1, dt*4); head.rotation.y = sin(robot.t*1.3)*0.6
	if arm: arm.rotation.z = 2.4 + sin(robot.t*9)*0.4 if robot.t < 4 else 0.2 + sin(robot.t*2)*0.1
	_emit(eye, Color(0.2, 0.9, 1.0), 2.2 + sin(robot.t*4)*0.4)
	_emit(panel, Color(0.2, 1, 0.5), 1.5)
	for i in 8: _emit(_robot_part("robot_ring%d" % i), Color(0.2, 1, 1.1), 2.2)
func _bolt(im: ImmediateMesh, a: Vector3, b: Vector3, seg: int, jag: float) -> void:
	var prev := a
	for i in range(1, seg + 1):
		var k := float(i)/seg
		var p := a.lerp(b, k) + (Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5)*jag*sin(k*PI)*2.0 if i < seg else Vector3.ZERO)
		im.surface_add_vertex(prev); im.surface_add_vertex(p); prev = p
func _tick_lab(dt: float) -> void:
	lab.t += dt; var t: float = lab.t
	var pulse := 0.55 + 0.25*sin(t*3.1) + 0.15*sin(t*11.7) + (0.6 if randf() < 0.03 else 0.0)
	if core_mat: core_mat.set_shader_parameter("uPulse", pulse)
	var core: Node3D = nodes.get("SH1_1_lab_core"); var ink: Node3D = nodes.get("lab_ink")
	if core: core.scale = Vector3.ONE*(0.95 + pulse*0.12)
	if ink: ink.scale = Vector3.ONE*(0.95 + pulse*0.12)*1.09
	var lat: Node3D = nodes.get("lab_lattice"); var lat2: Node3D = nodes.get("lab_lattice2")
	if lat: lat.rotation = Vector3(t*0.7, t*1.1, t*0.3)
	if lat2: lat2.rotation = Vector3(-t*0.4, t*0.6, t*0.9)
	for i in 3:
		var sh: Node3D = nodes.get("SH0_%d_lab_shell%d" % [i + 2, i])
		if sh: sh.scale = Vector3.ONE*(1 + 0.08*sin(t*2.2 + i) + pulse*0.05)
		var r: Node3D = nodes.get("lab_ring%d" % i)
		if r: r.rotation.x += dt*(0.45 + i*0.25); r.rotation.y += dt*(0.6 - i*0.2)
		var w: Node3D = nodes.get("lab_wave%d" % i)
		if w:
			var k: float = fmod(t*0.55 + parts.lab.waves[i], 1.0); w.scale = Vector3.ONE*(0.2 + k*2.6)
			for m in _glow_of(w): m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.render_priority = 101; m.albedo_color.a = (1 - k)*0.9
	for i in 2:
		var q: float = t*0.5 + parts.lab.arms[i]
		var base: Node3D = nodes.get("lab_arm%d_base" % i); var sh2: Node3D = nodes.get("lab_arm%d_sh" % i); var el: Node3D = nodes.get("lab_arm%d_el" % i); var wr: Node3D = nodes.get("lab_arm%d_wr" % i)
		if base: base.rotation.y = sin(q)*0.9
		if sh2: sh2.rotation.z = -0.35 + sin(q*1.3)*0.3
		if el: el.rotation.z = 1.0 + sin(q*0.9)*0.4
		if wr: wr.rotation.y = q*2
	var holo: Node3D = nodes.get("lab_holo")
	if holo: holo.rotation.y = t*0.6
	for i in 20:
		var f: Node3D = nodes.get("lab_flick%d" % i)
		if f: f.visible = sin(t*(3 + i) + i*1.7) > -0.85
	if lab_light: lab_light.light_energy = 2.7*(0.75 + pulse*0.55)
	# lightning, re-drawn: four to the coil tips, the rest wild, off the core to somewhere on the glass
	lab.arc_t -= dt
	if lab.arc_t <= 0:
		lab.arc_t = 0.045 + randf()*0.04
		var at: Array = parts.lab.at; var o0 := Vector3(0, at[1], 0)
		bolts_im.clear_surfaces(); bolts_im.surface_begin(Mesh.PRIMITIVE_LINES)
		for b in int(parts.lab.NB):
			var tip: Array = parts.lab.tips[b] if b < 4 else []
			var end := Vector3(tip[0], tip[1], tip[2]) if b < 4 else (Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized()*0.9 + o0)
			if randf() < (0.7 if b < 4 else 0.5): _bolt(bolts_im, o0 + (end - o0).normalized()*0.18, end, int(parts.lab.SEG), 0.14 if b < 4 else 0.08)
		bolts_im.surface_add_vertex(o0); bolts_im.surface_add_vertex(o0)
		bolts_im.surface_end()
		var te: Array = parts.lab.tesla; var tp := Vector3(te[0], te[1], te[2])
		t_im.clear_surfaces(); t_im.surface_begin(Mesh.PRIMITIVE_LINES)
		for b in 4:
			if randf() < 0.6: _bolt(t_im, tp, tp + Vector3(randf_range(-0.35, 0.35), randf_range(-0.1, 0.35), randf_range(-0.35, 0.35)), 10, 0.05)
		t_im.surface_add_vertex(tp); t_im.surface_add_vertex(tp)
		t_im.surface_end()
		if t_light: t_light.light_energy = 0.4*(0.5 + randf())
	# in here, the room is the field's: dark, violet
	var c: Vector3 = g.cam.global_position
	_lab_mood(1.0 if (c.x > X(-5) and c.x < X(11) and c.z > -48 and c.z < -34 and c.y < 5) else 0.0, dt)
## THE LAB'S LIGHT: the rest of the school is daylight through glass; in Room 120 the sky light goes almost to nothing,
## what is left is violet (tshschool.js labMood)
func _lab_mood(want: float, dt: float) -> void:
	if g.place_now != "school" and want == 0.0 and mood == 0.0: return
	mood += (want - mood)*minf(1, dt*4)
	if absf(mood - want) < 0.003: mood = want
	var k := mood
	if g.place_now == "school":
		g.env.ambient_light_color = Color("#e4ecf2").lerp(Color("#3a2a6a"), k); g.env.ambient_light_energy = lerpf(0.55, 0.18, k)
		g.env.background_color = Color("#e6ece8").lerp(Color("#0a0612"), k)
		g.env.glow_intensity = lerpf(0.6, 1.1, k)
		if lights_node:
			for l in lights_node.get_children():
				if l != lab_light and l != t_light: l.light_energy = float(l.get_meta("e"))*(1 - 0.8*k)
