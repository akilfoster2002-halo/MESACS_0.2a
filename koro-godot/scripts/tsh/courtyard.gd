## TSH · AFTER SCHOOL — "you coming?" Canon, by the boarded-up stair of Harbor Lane Station: closed since before they
## were born, and he has found a way in. Down there, in the dark, they explore it together, and every way on is a thing
## she has to work out: the power (a breaker), the barrier on to the tracks (the old signal switch), a hatch two and a
## half metres up a wall (a boost, and a hand), a security door somebody has made sure stays shut. In the tunnel the
## wall hums: Canon's gizmo hears it, and Robin knows it — Psi, the field from the lab — and tunes it.
## (tsh.js courtyardBegin … doorOpen, and tshsubway.js's gates and lights, ported. Maya and Kai: station.gd.)
class_name Courtyard
extends Node

const ENTRY := Vector2(-14, 45.6)
const EXIT := Vector2(16, 47.6)
const DOOR_CASE := {
	"title": "WHY WON'T IT OPEN", "sub": "The keypad takes Canon's guess (1-2-3-4, really). The door does not move. Look at it, then say what is wrong.",
	"checks": [["pad", "Keypad", "Lit. It takes the code and beeps twice: ACCEPTED."], ["power", "Door power", "48 V at the controller. Fine."],
		["motor", "Door motor", "It hums when the code goes in — and the door does not move an inch."],
		["log", "Controller log", "OPEN → motor ON → bolt: LOCKED. OPEN → motor ON → bolt: LOCKED."], ["bolt", "Bolt solenoid", "No click. Its wire has been cut. Cleanly. Recently."]],
	"causes": [["power", "No power", "The controller has 48 V, and the motor hums."], ["code", "Wrong code", "The keypad accepted it. Somehow."],
		["bolt", "The bolt never pulls back", null], ["motor", "The motor is dead", "It hums. It is pushing against something."]],
	"ok": "The bolt. Somebody cut its wire. Two strands twisted back together — click — and the door rolls."}

var g
var watch := ""               # which of the chapter's triggers is live (tsh.js aftWatch)
var tun = null
var canon = null              # {node, ap, x, z, yaw, follow, clip, face_to, pose}
var props: Node3D
var sub_data := {}; var sp := {}
var sub_built := false
var gates := {}               # shutter/barrier/door: {node, s (the solid), t (0..1 open), y0/x0}
var bulbs: Array = []         # {node, light, on, at, emerg, z, glow}
var powered := false
var sub_t := 0.0
var lights_node: Node3D
var psi_light: OmniLight3D
var gizmo: Node3D
var gizmo_dropped := false      # it fell out of her jacket in the fight with Maya (station.gd drop_scene)

func _init(game) -> void: g = game
func TX(v: float) -> float: return 520.0 + v

# ================================================================== the street
## the boarded stair on Harbor Lane, with its railings, its globes, its sign; and the manhole they come up out of
func station_props() -> void:
	if props != null: return
	props = Node3D.new(); g.city.add_child(props)
	var green := _std(Color(0.12, 0.29, 0.2), 0.5, 0.4); var ply := _std(Color(0.55, 0.43, 0.28), 0.9)
	var x := ENTRY.x; var z := ENTRY.y
	var hole := _box(_unl(Color(0.02, 0.024, 0.027)), x, 0.02, z - 0.4, 2.0, 0.01, 3.6)
	for k in 4: _box(_std(Color(0.16, 0.17, 0.17), 0.9), x, -0.1 - k*0.25, z - 2.0 + k*0.5, 2.0, 0.08, 0.5)
	_box(green, x - 1.05, 0.5, z - 0.4, 0.06, 1.0, 3.6); _box(green, x + 1.05, 0.5, z - 0.4, 0.06, 1.0, 3.6); _box(green, x, 0.5, z + 1.4, 2.16, 1.0, 0.06)
	_box(green, x - 1.05, 1.0, z - 0.4, 0.08, 0.06, 3.6); _box(green, x + 1.05, 1.0, z - 0.4, 0.08, 0.06, 3.6)
	for dx in [-1.05, 1.05]:
		_box(green, x + dx, 1.3, z + 1.4, 0.07, 2.6, 0.07)
		var gl := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.16; sm.height = 0.32; gl.mesh = sm
		var gm := _std(Color(0.1, 0.1, 0.1), 0.4); gm.emission_enabled = true; gm.emission = Color(0.16, 0.35, 0.23); gm.emission_energy_multiplier = 0.6; gl.material_override = gm
		gl.position = Vector3(x + dx, 2.7, z + 1.4); props.add_child(gl)
	_box(ply, x - 0.5, 0.6, z - 2.15, 0.95, 1.2, 0.04)
	var loose := _box(ply, x + 0.7, 0.55, z - 2.15, 0.95, 1.1, 0.04); loose.rotation.z = 0.5
	var sign := Node3D.new(); sign.position = Vector3(x, 2.25, z + 1.43); sign.rotation.y = PI; props.add_child(sign)
	var bg := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(2.0, 0.5); bg.mesh = qm; bg.material_override = _unl(Color("#0f2a20")); sign.add_child(bg)
	var l1 := Label3D.new(); l1.text = "HARBOR LANE"; l1.font_size = 64; l1.pixel_size = 0.0045; l1.modulate = Color("#efe6cc"); l1.position = Vector3(0, 0.07, 0.01); l1.outline_size = 0; sign.add_child(l1)
	var l2 := Label3D.new(); l2.text = "STATION CLOSED"; l2.font_size = 40; l2.pixel_size = 0.0045; l2.modulate = Color("#ff6a5a"); l2.position = Vector3(0, -0.12, 0.01); l2.outline_size = 0; sign.add_child(l2)
	for lb in [l1, l2]: lb.render_priority = 101
	var mh := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.42; cm.bottom_radius = 0.42; cm.height = 0.03; mh.mesh = cm
	mh.material_override = _std(Color(0.23, 0.24, 0.24), 0.4, 0.8); mh.position = Vector3(EXIT.x, 0.015, EXIT.y); props.add_child(mh)
func _std(c: Color, rough := 0.6, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.roughness = rough; m.metallic = metal; return m
func _unl(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c; return m
func _box(m: Material, x: float, y: float, z: float, w: float, h: float, d: float, parent: Node = null) -> MeshInstance3D:
	var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(w, h, d); b.mesh = bm; b.material_override = m; b.position = Vector3(x, y, z)
	(parent if parent else props).add_child(b); return b

## her phone, big, with a thread on it: [[who, text], …] — "me" is Robin
func thread(name: String, msgs) -> void:
	if msgs == null: g.phone_show(""); return
	var s := "[color=#9fb4c0]%s[/color]\n" % g.dclock(g.S.get("dm", 900))
	for m in msgs:
		if m[0] == "me": s += "\n[right][bgcolor=#1f6f60] %s [/bgcolor][/right]" % m[1]
		else: s += "\n[color=#9fb4c0]MESSAGES · NOW[/color]\n[b]%s[/b]\n[bgcolor=#2a3a3a] %s [/bgcolor]" % [name, m[1]]
	g.phone_msg = ""; g.phone.visible = true; g.phone_text.text = s

func begin(resume := false) -> void:
	station_props()
	g.S.dm = maxf(g.S.get("dm", 0), 15*60 + 22)
	g.hs.headphones(false)
	var st: int = g.S.get("tun", 0)
	if resume and st >= 7: g.station.street_scene(); return
	if resume and st >= 1: tunnels_resume(st); return
	if canon == null: canon_up(Vector3(ENTRY.x + 1.6, 0, ENTRY.y + 2.2), -PI/2, g.city)
	if resume:
		var d: Array = g.nav.spots.schoolDoor; g.place(Vector3(d[0] - 7, 0, d[1] - 4.6), -PI/2)
	var later := func(t: float, f: Callable): g.get_tree().create_timer(t).timeout.connect(f)
	later.call(0.6 if resume else 1.2, func():
		if g.S.step != "courtyard": return
		g.cue("ring"); thread("Canon", [["canon", "you coming?"]])
		later.call(1.5, func():
			thread("Canon", [["canon", "you coming?"], ["me", "where?"]]); g.cue("ui")
			later.call(1.5, func():
				thread("Canon", [["canon", "you coming?"], ["me", "where?"], ["canon", "old harbor lane station. trust me"]]); g.cue("ring")
				later.call(2.2, func():
					thread("", null)
					if g.S.step == "courtyard": g.note("Canon is at the old station, along Harbor Lane.")))))
	g.marker.position = Vector3(ENTRY.x, 30, ENTRY.y); g.marker.visible = true
	watch = "entry"

# ================================================================== Canon
func canon_up(at: Vector3, yaw: float, parent: Node) -> Dictionary:
	if canon != null and is_instance_valid(canon.node): canon.node.queue_free()
	var node: Node3D = (load("res://assets/tsh/people/theo.glb") as PackedScene).instantiate(); parent.add_child(node)
	var ap: AnimationPlayer = g._find(node, func(q): return q is AnimationPlayer)
	if ap:
		for nm in ap.get_animation_list():
			if not nm in ["jump", "fall", "getup", "ko", "hit"]: ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
	canon = {"node": node, "ap": ap, "x": at.x, "z": at.z, "y": at.y, "yaw": yaw, "follow": false, "clip": "", "face_to": null, "pose": null, "walking": false, "running": false}
	_canon_place()
	return canon
func _canon_play(nm: String) -> void:
	if canon.ap and canon.clip != nm and canon.ap.has_animation(nm): canon.clip = nm; canon.ap.play(nm, 0.2)
func _canon_place() -> void:
	canon.node.position = Vector3(canon.x, canon.get("y", 0.0), canon.z); canon.node.rotation.y = canon.yaw
## he keeps with her: a step or two behind, walking (running if she does)
func _canon_tick(dt: float) -> void:
	if canon == null or not is_instance_valid(canon.node): return
	var p: Vector3 = g.robin.position
	if canon.follow and g.mode == "":
		var d := Vector2(p.x - canon.x, p.z - canon.z).length(); var want := 1.8
		if d > want + 0.25:
			var spd := minf(5.2, 1.4 + (d - want)*1.6); var a := atan2(p.x - canon.x, p.z - canon.z); var s := minf(d - want, spd*dt)
			canon.x += sin(a)*s; canon.z += cos(a)*s; canon.yaw = a; canon.walking = true; canon.running = spd > 3; canon.face_to = null; canon.pose = null
		else: canon.walking = false; canon.running = false; canon.face_to = Vector2(p.x, p.z)
	if canon.face_to != null and not canon.walking:
		var f: Vector2 = canon.face_to; canon.yaw = lerp_angle(canon.yaw, atan2(f.x - canon.x, f.y - canon.z), minf(1, dt*6))
	if canon.pose != null: _canon_play(canon.pose)
	elif canon.walking: _canon_play("sprint" if canon.running else "walk")
	elif g.talk_q.size() and g.sub_label.text.contains("CANON"): _canon_play("talk")
	else: _canon_play("idle")
	_canon_place()
func canon_at(T: Vector2, face: Vector2) -> void:
	if canon == null: return
	canon.follow = false; canon.walking = false; canon.x = T.x; canon.z = T.y; canon.face_to = face; canon.yaw = atan2(face.x - T.x, face.y - T.y); _canon_place()

# ================================================================== a new angle for every line (tsh.js pairAngles, lineShots)
func _solid_at(x: float, z: float, y: float) -> bool:
	for q in g.boots.solids:
		if x > q[0] - 0.2 and x < q[1] + 0.2 and z > q[2] - 0.2 and z < q[3] + 0.2 and y > q[4] and y < q[5]: return true
	return false
## how far the camera can go from M along n before something solid (6 m at most)
func room_along(M: Vector2, n: Vector2, y: float) -> float:
	var s := 0.3
	while s <= 6:
		if _solid_at(M.x + n.x*s, M.y + n.y*s, y): return s
		s += 0.2
	return 6.0
func pair_angles(R: Vector2, T: Vector2, fR: Vector2, fT: Vector2, n: Vector2, hR: float, hT: float) -> Dictionary:
	var h := (hR + hT)/2; var M := (R + T)/2; var ln := maxf(0.001, R.distance_to(T)); var u := (T - R)/ln
	var room := room_along(M, n, h); var back := room_along(M, -n, h)
	if back > room + 0.5: n = -n; var r_ := room; room = back; back = r_
	var P_ := func(b: Vector2, terms: Array) -> Vector2:
		var p := b
		for tm in terms:
			var v: Vector2 = tm[0]; var k: float = tm[1]
			if v == n: k = minf(k, room - 0.35) if k > 0 else -minf(-k, back - 0.35)
			p += v*k
		return p
	var at := func(p: Vector2, y: float) -> Vector3: return Vector3(p.x, y, p.y)
	var rh := Vector3(R.x, hR, R.y); var th := Vector3(T.x, hT, T.y); var mid := Vector3(M.x, h - 0.15, M.y)
	return {
		"her": {"cam": at.call(P_.call(R, [[fR, 0.8], [n, 0.7], [u, 0.25]]), hR + 0.06), "look": rh, "fov": 28},
		"him": {"cam": at.call(P_.call(T, [[fT, 0.8], [n, 0.7], [u, -0.25]]), hT + 0.06), "look": th, "fov": 28},
		"herTight": {"cam": at.call(P_.call(R, [[fR, 0.7], [n, 0.4]]), hR + 0.02), "look": rh, "fov": 24},
		"himTight": {"cam": at.call(P_.call(T, [[fT, 0.7], [n, 0.4]]), hT + 0.02), "look": th, "fov": 24},
		"overHim": {"cam": at.call(P_.call(T, [[u, 0.6], [n, 0.45]]), maxf(hT, hR) + 0.12), "look": rh, "fov": 32},
		"overHer": {"cam": at.call(P_.call(R, [[u, -0.6], [n, 0.45]]), maxf(hT, hR) + 0.12), "look": th, "fov": 32},
		"two": {"cam": at.call(P_.call(M, [[n, 2.4]]), h - 0.05), "look": mid, "fov": 36},
		"wide": {"cam": at.call(P_.call(M, [[n, 4.2], [u, 2.0]]), h + 0.9), "look": mid, "fov": 46},
		"low": {"cam": at.call(P_.call(M, [[n, 1.6], [u, -0.4]]), 0.4), "look": Vector3(M.x, h, M.y), "fov": 44},
		"high": {"cam": at.call(P_.call(M, [[n, 2.0], [u, -1.0]]), h + 2.4), "look": mid, "fov": 40},
		"profileL": {"cam": at.call(P_.call(M, [[u, -3.0], [n, 0.5]]), h - 0.05), "look": mid, "fov": 30},
		"profileR": {"cam": at.call(P_.call(M, [[u, 3.0], [n, 0.5]]), h - 0.05), "look": mid, "fov": 30},
		"behind": {"cam": at.call(P_.call(M, [[n, -1.8], [u, -0.6]]), h + 0.5), "look": Vector3(M.x + n.x, h - 0.3, M.y + n.y), "fov": 44}}
## a pair standing face to face, close: Robin at R, the other gap metres off along ry (her heading)
func facing(R: Vector2, ry: float, gap: float, h := 1.62) -> Dictionary:
	var f := Vector2(sin(ry), cos(ry)); var T := R + f*gap; var n := Vector2(f.y, -f.x)
	return {"R": R, "T": T, "ry": ry, "A": pair_angles(R, T, f, -f, n, h, h)}
## one shot a line: o.ins [[regex, angle, also]] cuts to that angle on the line that matches; o.pools which angles
## each speaker gets, in turn; every shot eases in a little toward what it looks at
func line_shots(keys: Array, A: Dictionary, o := {}) -> Array:
	var pools := {"robin": ["her", "overHim", "herTight", "low", "profileL", "her", "high", "two"], "other": ["him", "overHer", "himTight", "profileR", "wide", "him", "behind", "two"]}
	pools.merge(o.get("pools", {}), true)
	var ix := {}; var prev = null; var out := []
	for key in keys:
		for ln in g.lines.get(key, []):
			var w: String = ln[0]; var x: String = ln[1]
			var nm = null; var also = null
			for ins in o.get("ins", []):
				var re := RegEx.create_from_string(ins[0])
				if re.search(x): nm = ins[1]; also = ins[2] if ins.size() > 2 else null; break
			if nm == null or not A.has(nm):
				var side: String = w if pools.has(w) else ("robin" if w == "robin" else "other")
				var p: Array = pools[side]; ix[side] = ix.get(side, 0)
				for j in p.size():
					nm = p[ix[side] % p.size()]; ix[side] += 1
					if nm != prev and A.has(nm): break
			prev = nm
			var a: Dictionary = A[nm]
			var cam = a.cam
			if not cam is Callable and not a.look is Callable:
				var c0: Vector3 = a.cam; var l0: Vector3 = a.look
				cam = func(k, t): return c0 + (l0 - c0)*k*0.07
			var each = o.get("each"); var line := [[w, x]]
			out.append({"dur": g.line_len(w, x) + 0.12, "fov": a.fov, "cam": cam, "look": a.look, "tick": o.get("tick", null),
				"enter": func():
					if each is Callable: each.call()
					if also is Callable: also.call()
					g.talk(line)})
	for s in out: if s.tick == null: s.erase("tick")
	return out

# ================================================================== the station (tshsubway.js: its gates, its lights)
func build_sub() -> void:
	if sub_built: return
	sub_built = true
	sub_data = g._json("res://assets/tsh/sub.json"); var parts = g._json("res://assets/tsh/sub_parts.json"); sp = parts.spots
	lights_node = Node3D.new(); lights_node.name = "SubLights"; g.add_child(lights_node); lights_node.visible = false
	var lts := []
	for l in parts.lights:
		var o := OmniLight3D.new(); o.position = Vector3(l.x, l.y, l.z); o.omni_range = float(l.d)
		o.light_color = Color(l.col[0], l.col[1], l.col[2]) if l.col != null else Color(1, 0.85, 0.6)
		o.set_meta("e", float(l.k)*0.5); o.light_energy = 0.0; lights_node.add_child(o); lts.append(o)
		if absf(l.z + 46) < 0.5 and absf(l.x - TX(-2.0)) < 0.5: psi_light = o
	var stack: Array = [g.sub]
	var found := {}
	while stack.size():
		var n: Node = stack.pop_back(); stack.append_array(n.get_children())
		if String(n.name).begins_with("sub_"): found[String(n.name)] = n
	for k in found:
		if not k.begins_with("sub_bulb"): continue
		var b: Node3D = found[k]; var bp := b.global_position
		var best = null; var bd := 1.2
		for o in lts:
			if o.position.distance_to(bp) < bd: bd = o.position.distance_to(bp); best = o
		var cone_name = "sub_cone" + k.substr(8).replace("_e", "")
		bulbs.append({"node": b, "light": best, "cone": found.get(cone_name), "emerg": k.ends_with("_e"), "z": bp.z, "on": 1.0 if k.ends_with("_e") else 0.0, "at": null})
	for o in lts:
		var tied := bulbs.any(func(bb): return bb.light == o)
		if not tied: o.light_energy = float(o.get_meta("e"))      # the emergency lamps, the panel's LED, the Psi
	# the lamps make pools: brighter, shadows cast, and through the haze
	for bb in bulbs:
		var o = bb.light
		if o == null: continue
		o.set_meta("e", float(o.get_meta("e"))*1.8); o.shadow_enabled = true; o.light_volumetric_fog_energy = 3.0
		o.omni_attenuation = 1.6
	for nm in ["shutter", "barrier", "door"]:
		var node: Node3D = found.get("sub_" + nm)
		gates[nm] = {"node": node, "t": 0.0, "open": false, "y0": node.position.y if node else 0.0, "x0": node.position.x if node else 0.0, "sy": node.scale.y if node else 1.0, "s": _gate_solid(nm)}
	reset_sub()
	StationLook.apply(g.sub, sp)                   # aged, wrecked, its air and its failing lamps (station_look.gd)
func _gate_solid(nm: String):
	var want: Array = {"shutter": [TX(-2.5), TX(2.5), 1.9, 2.3], "barrier": [TX(-2.5), TX(2.5), -32.3, -31.9], "door": [TX(-2), TX(2), -88.3, -87.9]}[nm]
	for s in sub_data.solids:
		if absf(s.x1 - want[0]) < 0.05 and absf(s.x2 - want[1]) < 0.05 and absf(s.z1 - want[2]) < 0.05 and absf(s.z2 - want[3]) < 0.05:
			return [s.x1, s.x2, s.z1, s.z2, s.get("y1", -1.0), s.get("y2", 60.0)]
	return [want[0], want[1], want[2], want[3], -1.0, 60.0]
func _solid_on(s: Array, on: bool) -> void:
	var i := -1
	for j in g.boots.solids.size():
		var q: Array = g.boots.solids[j]
		if absf(q[0] - s[0]) < 0.01 and absf(q[1] - s[1]) < 0.01 and absf(q[2] - s[2]) < 0.01 and absf(q[3] - s[3]) < 0.01: i = j; break
	if on and i < 0: g.boots.solids.append(s.duplicate())
	if not on and i >= 0: g.boots.solids.remove_at(i)
func open_gate(nm: String) -> void:
	var G_: Dictionary = gates[nm]; G_.open = true; _solid_on(G_.s, false)
	if G_.t <= 0: G_.t = 0.001
	var led = g.sub.find_child("sub_swLed" if nm == "barrier" else ("sub_padLed" if nm == "door" else "x"), true, false)
	if led: _led(led, Color(0.2, 1, 0.3))
func opened(nm: String) -> bool: return gates.has(nm) and gates[nm].open
func _led(n: Node, c: Color) -> void:
	for mi in [n] + n.get_children():
		if mi is MeshInstance3D:
			var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c*2.0; mi.material_override = m
## the power: the lights come on down the line, one after the other, with a flicker
func power(on: bool) -> void:
	powered = on
	var pl = g.sub.find_child("sub_panelLed", true, false)
	if pl: _led(pl, Color(0.2, 1, 0.3) if on else Color(1, 0.15, 0.1))
	for b in bulbs:
		if b.emerg: continue
		b.at = sub_t + 0.25 + maxf(0, 2 - b.z)*0.035 if on else null
		if not on: b.on = 0.0; _bulb(b, 0.0)
func _bulb(b: Dictionary, v: float) -> void:
	if b.light: b.light.light_energy = float(b.light.get_meta("e"))*v
	if b.cone: b.cone.visible = v > 0.05
	b.node.visible = true
	for mi in [b.node] + b.node.get_children():
		if mi is MeshInstance3D:
			if not mi.has_meta("m"):
				var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mi.set_meta("m", true); mi.material_override = m
			(mi.material_override as StandardMaterial3D).albedo_color = Color(0.15, 0.14, 0.12).lerp(Color(2.4, 2.1, 1.6), v)
func reset_sub() -> void:
	for nm in gates:
		var G_: Dictionary = gates[nm]; G_.open = false; G_.t = 0.0; _solid_on(G_.s, true)
		if G_.node: G_.node.position.y = G_.y0; G_.node.position.x = G_.x0; G_.node.scale.y = G_.sy
	for nm2 in ["sub_swLed", "sub_padLed"]:
		var led = g.sub.find_child(nm2, true, false)
		if led: _led(led, Color(1, 0.6, 0.1) if nm2 == "sub_swLed" else Color(1, 0.15, 0.1))
	power(false)
	for b in bulbs: if b.emerg: _bulb(b, 1.0)
func tick_sub(dt: float) -> void:
	if not sub_built or not g.sub.visible: return
	sub_t += dt
	for b in bulbs:
		if b.emerg or b.at == null or b.on >= 1: continue
		var k: float = sub_t - b.at
		if k < 0: continue
		var v := 1.0 if k > 0.5 else (1.0 if sin(k*70) > 0.2 else 0.1)
		_bulb(b, v)
		if k > 0.5: b.on = 1.0
	StationLook.tick(bulbs, dt)
	# the Psi: it breathes
	var br := 0.6 + 0.4*sin(sub_t*2.3) + (0.5 if randf() < 0.03 else 0.0)
	if psi_light: psi_light.light_energy = float(psi_light.get_meta("e"))*(0.6 + 0.6*br)
	for nm in gates:
		var G_: Dictionary = gates[nm]
		if G_.t <= 0 or G_.t >= 1 or G_.node == null: continue
		match nm:
			"shutter": G_.t = minf(1, G_.t + dt/2.2); G_.node.position.y = G_.y0 + G_.t*3.2; G_.node.scale.y = G_.sy*(1 - G_.t*0.7)
			"barrier": G_.t = minf(1, G_.t + dt/1.6); G_.node.position.y = G_.y0 + G_.t*3.0
			"door": G_.t = minf(1, G_.t + dt/1.8); G_.node.position.x = G_.x0 - G_.t*3.8
func up_to(n: int) -> void:
	if n >= 2: power(true); open_gate("shutter"); _finish_gate("shutter")
	if n >= 3: open_gate("barrier"); _finish_gate("barrier")
	if n >= 6: open_gate("door"); _finish_gate("door")
func _finish_gate(nm: String) -> void:
	var G_: Dictionary = gates[nm]; G_.t = 0.999
	tick_sub(0.1)

# ================================================================== into the station, and out
func into_sub(at: Vector2, yaw: float) -> void:
	build_sub()
	g.indoor = "sub"; g.show_place("sub")
	g.boots.ground = true
	g.place(Vector3(at.x, 0, at.y), yaw)
func out_of_sub() -> void:
	g.show_place("city")

# ================================================================== every frame
func tick(dt: float) -> void:
	tick_sub(dt)
	_canon_tick(dt)
	if watch == "" or g.mode != "": return
	var p: Vector3 = g.robin.position
	match watch:
		"entry":
			if g.S.step == "courtyard" and Vector2(p.x - ENTRY.x, p.z - ENTRY.y).length() < 3.4: watch = ""; g.marker.visible = false; entry_scene()
		"tun": _tick_tunnels(dt)
		_: g.station.tick_watch(watch, dt)

# ================================================================== "You came." — the loose board — and down
func entry_scene() -> void:
	g.talk_q.clear()
	if not "canon" in g.S.seen: g.S.seen.append("canon")
	var from := Vector2(g.robin.position.x, g.robin.position.z)
	var R := Vector2(ENTRY.x - 0.2, ENTRY.y + 2.6); var F := facing(R, PI/2, 0.95); var A: Dictionary = F.A
	var shots := [
		{"dur": 2.4, "fov": 40, "cam": Vector3(ENTRY.x - 4.5, 1.7, ENTRY.y + 5.2), "look": Vector3(ENTRY.x, 1.2, ENTRY.y + 2.0),
			"enter": func(): canon_at(F.T, R), "tick": func(dt, tt, k): g.walk_stage(from, R, k)}]
	shots.append_array(line_shots(["canonHi", "canonIn"], A, {"each": func(): g.stage("idle", R.x, 0, R.y, F.ry), "ins": [["Closed since before", "wide"]]}))
	shots.append_array([
		{"dur": 2.2, "fov": 44, "cam": Vector3(ENTRY.x + 1.6, 1.0, ENTRY.y - 3.6), "look": Vector3(ENTRY.x, 0.4, ENTRY.y - 1.0), "enter": func(): g.cue("door")},
		{"dur": 1.8, "fov": 50, "cam": Vector3(ENTRY.x, 2.4, ENTRY.y + 1.2), "look": Vector3(ENTRY.x, -1.2, ENTRY.y - 2.2), "enter": func(): g.stage("walk", ENTRY.x, 0, ENTRY.y - 0.2, PI)}])
	g.play_reel(shots, func(_s):
		g.staged = null; g.phone_show("")
		g.black(true); g.get_tree().create_timer(0.5).timeout.connect(func(): g.black(false); tunnels_begin()))

# ================================================================== the tunnels
func canon_down() -> Dictionary:
	return canon_up(Vector3(TX(0.8), 0, 8.4), PI, g.sub)
func tunnels_begin() -> void:
	build_sub(); reset_sub()
	into_sub(_a(sp.start), 0.0)
	var c := canon_down(); c.follow = true
	g.set_caption("INT. HARBOR LANE STATION — CLOSED")
	tun = {"said": {}, "t": 0.0}
	g.S.tun = 1; g._save()
	watch = "tun"
	g.get_tree().create_timer(0.9).timeout.connect(func(): if tun != null: g.talk("canonDark"))
	g.note("Find a way to get the power back on.")
	g.objective("Find a way to get the power back on.")
func _a(v) -> Vector2: return Vector2(v[0], v[1])
## picked up partway: every gate she got through is still open, and she is just past the last of them
## (1 inside · 2 the power on · 3 the barrier up · 4 the gizmo tuned · 5 through the hatch · 6 the door open)
func tunnels_resume(n: int) -> void:
	build_sub(); reset_sub(); up_to(n)
	var at: Vector2 = Vector2(TX(0), -86) if n >= 6 else (Vector2(TX(0), -75) if n >= 5 else (Vector2(TX(0), -50) if n >= 4 else (Vector2(TX(0), -34) if n >= 3 else (Vector2(TX(0), -2) if n >= 2 else _a(sp.start)))))
	into_sub(at, 0.0)
	var c := canon_down(); c.x = at.x + 0.8; c.z = at.y + 1.2; c.follow = true
	tun = {"said": {"canonDark": 1, "walkA": n >= 3, "walkB": n >= 3, "canonSwitch": n >= 3, "boostHint": n >= 5}, "t": 0.0, "aDone": n >= 3, "psi": n >= 4, "hatch": n >= 5, "quiet": n >= 6, "met": false}
	if n >= 4: g.S.tuned = true
	watch = "tun"
func say_once(key: String, done := Callable()) -> void:
	if tun.said.get(key, false): return
	tun.said[key] = true; g.talk(key, done)
func _tick_tunnels(dt: float) -> void:
	var p: Vector3 = g.robin.position
	tun.t += dt
	if powered and p.z < -3: say_once("walkA", func(): tun.aDone = true)
	if tun.get("aDone", false) and p.z < -12: say_once("walkB")
	if powered and p.z < -22: say_once("canonSwitch")
	if opened("barrier") and p.z < -41 and not tun.get("psi", false): tun.psi = true; watch = ""; gizmo_scene(); return
	if g.S.get("tuned", false) and p.z < -64 and not tun.said.get("boostHint", false): tun.said.boostHint = true; g.note("A hatch, high in the wall. Canon could boost you.")
	if tun.get("hatch", false) and p.z < sp.quiet and not tun.get("quiet", false): tun.quiet = true; watch = ""; quiet_scene(); return
	if opened("door") and p.z < -93 and not tun.get("met", false): tun.met = true; watch = ""; g.station.meet(); return
	var t: Variant = _thing()
	if t != null: g.set_caption("E — " + t[1])
## the gates, at the things in the walls: [spot, verb, act]
func _thing() -> Variant:
	if watch != "tun" or g.mode != "" or tun == null: return null
	var p := Vector2(g.robin.position.x, g.robin.position.z)
	if not powered and p.distance_to(_a(sp.panel)) < 1.8: return ["panel", "Get the power back on"]
	if powered and not opened("barrier") and p.distance_to(_a(sp.switch)) < 1.8: return ["switch", "Throw the signal switch"]
	if g.S.get("tuned", false) and not tun.get("hatch", false) and p.distance_to(_a(sp.hatch)) < 2.2: return ["hatch", "Boost up to the hatch"]
	if tun.get("hatch", false) and not opened("door") and p.distance_to(_a(sp.door)) < 1.8: return ["door", "Work out the door"]
	return null
func key(ev: InputEventKey) -> bool:
	if not ev.pressed or ev.echo or ev.keycode != KEY_E: return false
	var t: Variant = _thing()
	if t == null: return false
	watch = ""
	match t[0]:
		"panel": puzzle_then("route", {"levels": 1, "title": "RESTORE THE POWER", "sub": "The breaker is fine. The feed is not. Turn the pieces until power runs from the mains to the station's lights.", "src": "MAINS", "dst": "LIGHTS"}, power_on)
		"switch": puzzle_then("gears", {"levels": 1, "title": "THROW THE SWITCH", "sub": "Signal 4 still works the barrier. Click a gear to turn it (right-click: the other way); each one drags the one inside it. Line every notch up with the lever."}, barrier_up)
		"hatch": boost_scene()
		"door": puzzle_then("diagnose", {"case": DOOR_CASE}, door_open)
	return true
func puzzle_then(kind: String, opts: Dictionary, next: Callable) -> void:
	g.mode = "puzzle"
	g.puzzle.open(kind, opts, func(): g.mode = ""; g.place(g.robin.position, g.cam_yaw); next.call())
func _done(f: Callable) -> Callable:
	return func(_s): g.talk_q.clear(); g.phone_show(""); g.staged = null; f.call()
func _resume_tun(stage: int, msg := "") -> void:
	g.place(g.robin.position, g.cam_yaw)
	if canon: canon.follow = true; canon.pose = null
	if stage > 0: g.S.tun = stage; g._save()
	watch = "tun"
	if msg != "": g.note(msg)

## the lights come on down the platform, one after another
func power_on() -> void:
	g.talk_q.clear()
	power(true); g.get_tree().create_timer(0.9).timeout.connect(func(): open_gate("shutter"); g.cue("door"))
	var at := Vector2(TX(-2.2), -2.6); var F := facing(at, PI/2, 0.9)
	var shots := [
		{"dur": 1.6, "fov": 30, "cam": Vector3(TX(-1.6), 1.55, 4.6), "look": Vector3(TX(-2.45), 1.5, 3.6), "enter": func(): g.stage("idle", TX(-1.8), 0, 3.6, -PI/2); g.cue("clang")},
		{"dur": 3.0, "fov": 48, "cam": [Vector3(TX(0), 1.8, 4.5), Vector3(TX(0), 2.0, 3.8)], "look": Vector3(TX(-1), 1.5, -24), "enter": func(): canon_at(F.T, at)}]
	shots.append_array(line_shots(["canonLit"], F.A, {"each": func(): g.stage("idle", at.x, 0, at.y, F.ry)}))
	g.play_reel(shots, _done(func(): g.place(Vector3(at.x, 0, at.y), 0.0); g.objective(""); _resume_tun(2, "The platform. There will be a way on to the tracks.")))
func barrier_up() -> void:
	g.talk_q.clear()
	open_gate("barrier"); g.cue("clang")
	var shots := [
		{"dur": 2.0, "fov": 40, "cam": Vector3(TX(-1.5), 1.2, -27.5), "look": Vector3(TX(0), 1.6, -32), "enter": func(): g.stage("idle", TX(-5.8), 0, -27, -PI/2)},
		{"dur": 1.6, "fov": 46, "cam": Vector3(TX(0.5), 1.0, -34.5), "look": Vector3(TX(-1), 1.4, -28), "enter": func(): g.cue("zip")}]
	g.play_reel(shots, _done(func(): _resume_tun(3, "The tunnel.")))

## THE GIZMO. It hums near the crack in the wall. She knows that hum.
func gizmo_prop() -> Node3D:
	if gizmo != null: return gizmo
	gizmo = Node3D.new(); g.sub.add_child(gizmo)
	var body := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.075, 0.13, 0.02); body.mesh = bm; body.material_override = _std(Color(0.16, 0.18, 0.2), 0.4, 0.6); gizmo.add_child(body)
	var scr := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(0.06, 0.07); scr.mesh = qm; scr.material_override = _unl(Color(0.5, 0.25, 1.2)); scr.position = Vector3(0, 0.02, 0.011); scr.name = "scr"; gizmo.add_child(scr)
	var ant := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.003; cm.bottom_radius = 0.003; cm.height = 0.09; ant.mesh = cm; ant.material_override = _std(Color(0.78, 0.78, 0.77), 0.3, 0.8); ant.position = Vector3(0.028, 0.105, 0); gizmo.add_child(ant)
	var led := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.006; sm.height = 0.012; led.mesh = sm; led.material_override = _unl(Color(1.2, 0.4, 2)); led.position = Vector3(0.028, 0.15, 0); led.name = "led"; gizmo.add_child(led)
	return gizmo
func gizmo_in(at: Vector2, ry: float) -> Node3D:
	var gz := gizmo_prop(); gz.visible = true
	gz.position = Vector3(at.x + sin(ry)*0.32, 1.22, at.y + cos(ry)*0.32); gz.rotation = Vector3(-0.35, ry, 0)
	return gz
func gizmo_scene() -> void:
	g.talk_q.clear()
	var p: Vector3 = g.robin.position; var at := Vector2(TX(-0.4), minf(p.z, -43.6)); var ry := PI
	var F := facing(at, ry, 0.85); var A: Dictionary = F.A
	var crack := Vector3(TX(-2.45), 1.4, -46)
	A.gizmo = {"cam": func(k, t): var gz := gizmo_prop(); return gz.position + Vector3(0.42, 0.16, 0.3), "look": func(k, t): return gizmo_prop().position, "fov": 30}
	A.crack = {"cam": Vector3(TX(-0.8), 1.5, -44.2), "look": crack, "fov": 34}
	var place := func(): g.stage("idle", at.x, 0, at.y, ry); canon_at(F.T, at)
	var hold := func(who: String):
		return func():
			var gz := gizmo_in(F.T if who == "canon" else at, ry + PI if who == "canon" else ry)
			(gz.get_node("scr") as MeshInstance3D).material_override.albedo_color = Color(0.5 + randf()*0.5, 0.2, 1.2)
	var shots := [{"dur": 2.2, "fov": 40, "cam": Vector3(TX(1.8), 1.6, at.y + 3.2), "look": Vector3(TX(-1), 1.4, at.y - 2), "enter": func(): place.call(); g.cue("ui")}]
	shots.append_array(line_shots(["canonGizmo"], A, {"each": place, "ins": [["dead phone and a radio", "gizmo", hold.call("canon")], ["It just hums", "gizmo", hold.call("canon")]]}))
	shots.append({"dur": 2.6, "fov": 34, "cam": [Vector3(TX(-0.6), 1.5, -43.8), Vector3(TX(-1.2), 1.45, -44.6)], "look": crack, "enter": func(): g.cue("ring")})
	var hr: Callable = hold.call("robin")
	shots.append_array(line_shots(["canonPsi"], A, {"each": func(): place.call(); hr.call(), "ins": [["That's not noise", "gizmo"], ["oscillating", "crack"], ["A few centimetres", "herTight"], ["loose down here", "crack"], ["If I match it", "gizmo"]]}))
	g.play_reel(shots, _done(func():
		place.call()
		puzzle_then("freq", {"levels": 2, "title": "TUNE IT TO THE FIELD", "sub": "Canon's gizmo hears the Psi in the wall. Make its wave (pink) the field's (violet), the way you did in the lab: count the humps, then line up the peaks."}, func(): tuned(at))))
func tuned(at: Vector2) -> void:
	g.talk_q.clear()
	g.S.tuned = true
	if not "gizmo" in g.S.seen: g.S.seen.append("gizmo")
	var ry := PI; var F := facing(at, ry, 0.8); var A: Dictionary = F.A
	var gz := gizmo_in(at, ry)
	(gz.get_node("scr") as MeshInstance3D).material_override.albedo_color = Color(0.6, 0.3, 1.6); (gz.get_node("led") as MeshInstance3D).material_override.albedo_color = Color(0.6, 0.3, 2.4)
	A.gizmo = {"cam": gz.position + Vector3(0.4, 0.16, 0.3), "look": gz.position, "fov": 28}
	var place := func(): g.stage("idle", at.x, 0, at.y, ry); canon_at(F.T, at)
	var shots := [{"dur": 1.8, "fov": 26, "cam": A.gizmo.cam, "look": A.gizmo.look, "enter": func(): place.call(); g.cue("win")}]
	shots.append_array(line_shots(["canonTuned"], A, {"each": place, "ins": [["^Keep it\\.$", "himTight"], ["understands it", "two"]]}))
	shots.append_array([
		{"mood": "soft", "dur": 2.2, "fov": 24, "cam": A.herTight.cam, "look": A.herTight.look, "enter": place},
		{"dur": 1.0, "fov": A.two.fov, "cam": A.two.cam, "look": A.two.look, "enter": func(): gz.visible = false; g.cue("zip")}])
	g.play_reel(shots, _done(func(): gz.visible = false; _resume_tun(4, "On, down the tunnel.")))
## the hatch: he boosts her, she pulls him up, and for a second neither of them lets go
func boost_scene() -> void:
	g.talk_q.clear()
	var h := _a(sp.hatch); var wallZ := -71.6; var base := Vector2(h.x + 0.2, wallZ + 0.9); var ledge := Vector2(h.x + 0.2, wallZ + 0.25)
	var after := Vector2(TX(0.2), -74.6); var F := facing(after, PI, 0.7)
	var Rb := Vector2(base.x, base.y + 1.4); var Fb := facing(Rb, -PI/2, 0.9)
	var Ab: Dictionary = Fb.A.duplicate(); Ab.hatch = {"cam": Vector3(Rb.x - 0.6, 1.2, Rb.y + 1.6), "look": Vector3(h.x + 0.2, 3.0, wallZ), "fov": 36}
	var shots := line_shots(["canonBoost"], Ab, {"ins": [["There's a hatch", "hatch"], ["Two and a half metres", "hatch"]],
		"each": func(): g.stage("idle", Rb.x, 0, Rb.y, -PI/2); canon_at(Fb.T, Rb)})
	shots.append_array([
		{"dur": 1.3, "fov": 44, "cam": Vector3(base.x + 2.4, 1.2, base.y + 2.6), "look": Vector3(base.x, 2.0, wallZ), "enter": func(): g.cue("step"),
			"tick": func(dt, tt, k): g.stage("idle" if k < 0.3 else "jump", base.x, sin(minf(1, k)*PI*0.5)*2.5, lerpf(base.y + 0.6, ledge.y, k), PI)},
		{"dur": 1.4, "fov": 40, "cam": Vector3(base.x - 0.6, 1.0, base.y + 1.4), "look": Vector3(h.x + 0.2, 3.0, wallZ), "enter": func(): g.stage("idle", ledge.x, 2.55, ledge.y, PI); g.cue("door")},
		{"dur": 1.4, "fov": 34, "cam": Vector3(base.x + 1.2, 1.9, base.y + 1.3), "look": Vector3(base.x, 2.0, base.y),
			"enter": func(): g.stage("idle", ledge.x, 2.55, ledge.y, 0); if canon: canon.pose = "jump", "beats": [[0.9, func(): g.cue("punch")]]},
		{"mood": "soft", "dur": 1.0, "fov": 46, "cam": Vector3(after.x + 1.6, 1.6, after.y - 2.4), "look": Vector3(after.x, 1.2, after.y + 0.5),
			"enter": func(): g.stage("idle", after.x, 0, after.y, PI); if canon: canon.pose = null; canon_at(F.T, after)}])
	shots.append_array(line_shots(["canonHand"], F.A, {"each": func(): g.stage("idle", after.x, 0, after.y, PI), "pools": {"robin": ["herTight", "her", "overHim"], "canon": ["himTight", "overHer", "him"]}}))
	g.play_reel(shots, _done(func():
		g.place(Vector3(after.x, 0, after.y), 0.0)
		tun.hatch = true; _resume_tun(5)))
## the passage: "Can I tell you something?"
func quiet_scene() -> void:
	g.talk_q.clear()
	if not "quiet" in g.S.seen: g.S.seen.append("quiet")
	var p: Vector3 = g.robin.position; var at := Vector2(TX(-0.3), minf(p.z, -80.5)); var F := facing(at, PI/2, 0.62); var A: Dictionary = F.A
	var place := func(): g.stage("idle", at.x, 0, at.y, PI/2); canon_at(F.T, at)
	A.door = {"cam": Vector3(TX(0.6), 1.6, -84), "look": Vector3(TX(0), 1.6, -88), "fov": 40}
	var shots := [{"mood": "soft", "dur": 2.0, "fov": 42, "cam": Vector3(at.x - 0.4, 1.7, at.y + 4.2), "look": Vector3(at.x + 0.3, 1.3, at.y), "enter": place}]
	shots.append_array(line_shots(["canonQuiet"], A, {"each": place, "pools": {"robin": ["herTight", "overHim", "her", "profileL", "herTight"], "canon": ["himTight", "overHer", "him", "profileR", "low"]}}))
	shots.append({"mood": "soft", "dur": 2.4, "fov": 30, "cam": A.profileL.cam, "look": A.two.look})
	shots.append_array(line_shots(["canonDoor"], A, {"each": place, "ins": [["No admittance", "door"]]}))
	g.play_reel(shots, _done(func(): _resume_tun(0)))
func door_open() -> void:
	g.talk_q.clear()
	open_gate("door"); g.cue("door")
	g.play_reel([{"dur": 2.4, "fov": 44, "cam": Vector3(TX(1.2), 1.5, -84.5), "look": Vector3(TX(0), 1.4, -92), "enter": func(): g.stage("idle", TX(1.0), 0, -86.8, PI)}],
		_done(func(): _resume_tun(6)))
