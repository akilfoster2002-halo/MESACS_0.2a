## THE DIRECTOR FIGHTS LIKE SOMETHING OUT OF DRAGON BALL Z. Between her ordinary blows, two moves of her own:
##   · THE CHARGE: she plants, fists down, and powers up — a roaring aura round her, the deck shaking, the rain
##     blown off her, a rising hum — then crosses the gap in an instant and throws one blow that sends Robin
##     flying. You have the whole charge to see it coming: be out of line (SPACE) when she goes.
##   · THE VOLLEY: she runs to one of the piles of junk on the roof (crates, pipe, barrels) and punches it at
##     Robin, piece after piece, each one a streak across the roof; dodge them or be hit.
## Fight.tick hands her to Director.tick each frame; true means it has her this frame.
class_name Director
extends RefCounted

const CHARGE := 1.25             # seconds powering up
const RUSH := 26.0               # metres a second across the roof
const BIG := 1.8                 # the blow, against her ordinary one
const SHOTS := 5                 # pieces punched in a volley
static var piles: Array = []     # {node, at: Vector3, left}
static var shots: Array = []
static var scatter: Array = []   # {node, v, spin, down}: broken bits blown across the roof     # {node, v, t}

## THE PROMPT: a big SPACE key in the middle of the screen, bouncing, pressing down with every press; a bar under it
## filling toward free; and BREAK FREE! when it goes
static var ui: Dictionary = {}
static func _mash_ui(f, show: bool, k: float) -> void:
	if ui.is_empty():
		var layer := CanvasLayer.new(); layer.layer = 20; f.g.add_child(layer)
		var root := Control.new(); root.set_anchors_preset(Control.PRESET_FULL_RECT); root.mouse_filter = Control.MOUSE_FILTER_IGNORE; layer.add_child(root)
		var box := Control.new(); box.mouse_filter = Control.MOUSE_FILTER_IGNORE; box.custom_minimum_size = Vector2(220, 44); root.add_child(box)
		var st := {"press": 0.0, "k": 0.0}
		box.draw.connect(func():                                   # a small key, the words beside it, a thin bar under
			var dy: float = 3.0*st.press
			var key := Rect2(Vector2(0, dy), Vector2(74, 26))
			box.draw_rect(key, Color(0, 0, 0, 0.45), true)
			box.draw_rect(key, Color(1, 1, 1, 0.9), false, 1.5)
			box.draw_rect(Rect2(Vector2(0, 26 + dy), Vector2(74, 2.5 - dy*0.8)), Color(1, 1, 1, 0.35), true)
			box.draw_rect(Rect2(Vector2(0, 38), Vector2(220, 3)), Color(0, 0, 0, 0.5), true)
			box.draw_rect(Rect2(Vector2(0, 38), Vector2(220*float(st.k), 3)), Color("#ffd23d"), true))
		var kl := Label.new(); kl.text = "SPACE"; kl.add_theme_font_size_override("font_size", 13); kl.add_theme_color_override("font_color", Color.WHITE)
		kl.position = Vector2(14, 4); box.add_child(kl)
		var tl := Label.new(); tl.text = "break free"; tl.add_theme_font_size_override("font_size", 15); tl.add_theme_color_override("font_color", Color("#9fb4c0"))
		tl.add_theme_constant_override("outline_size", 5); tl.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85)); tl.position = Vector2(86, 3); box.add_child(tl)
		var pop := Label.new(); pop.text = "free"; pop.add_theme_font_size_override("font_size", 22); pop.add_theme_color_override("font_color", Color("#ffd23d"))
		pop.add_theme_constant_override("outline_size", 6); pop.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85)); pop.modulate.a = 0.0; root.add_child(pop)
		ui = {"layer": layer, "box": box, "st": st, "pop": pop, "last": 0}
	var vp: Vector2 = f.g.get_viewport().get_visible_rect().size
	ui.box.visible = show
	if not show: return
	var pressed: int = int(f.R.get("cuff", {}).get("k", 0))
	if pressed != ui.last: ui.last = pressed; ui.st.press = 1.0
	ui.st.press = maxf(0.0, ui.st.press - 0.12); ui.st.k = lerpf(float(ui.st.k), k, 0.4)
	ui.box.position = Vector2(vp.x/2 - 110, vp.y - 150); ui.box.queue_redraw()
static func _pop(f) -> void:
	if ui.is_empty(): return
	var vp: Vector2 = f.g.get_viewport().get_visible_rect().size
	var p: Label = ui.pop; p.position = Vector2(vp.x/2 - 20, vp.y - 156); p.modulate.a = 1.0
	var tw: Tween = f.g.create_tween(); tw.set_ignore_time_scale(true)
	tw.tween_property(p, "position:y", vp.y - 176, 0.5); tw.parallel().tween_property(p, "modulate:a", 0.0, 0.5)

static var cuff := {}             # the cuff in flight
static var strafe := {}           # the gunship's runs: {next, on: {a, b, t, phase, line, hit}}
static var fx_nodes := {}

static func _hand(f, e: Dictionary) -> Vector3: return Vector3(e.x + sin(e.yaw)*0.45, f.floor_y + 1.35, e.z + cos(e.yaw)*0.45)
static func _unlit(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; m.render_priority = 106; m.cull_mode = BaseMaterial3D.CULL_DISABLED; return m
## a thin line between two points (a stretched box), made once and moved
static func _beam(f, key: String, a: Vector3, b: Vector3, w: float, c: Color, on: bool) -> void:
	if not fx_nodes.has(key):
		var mi := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1, 1, 1); mi.mesh = bm; mi.material_override = _unlit(c); f.g.add_child(mi); fx_nodes[key] = mi
	var n: MeshInstance3D = fx_nodes[key]
	n.visible = on and a.distance_to(b) > 0.05
	if not n.visible: return
	(n.material_override as StandardMaterial3D).albedo_color = c
	var mid := (a + b)/2; var dv := b - a
	n.global_transform = Transform3D(Basis.looking_at(dv.normalized(), Vector3.UP if absf(dv.normalized().y) < 0.99 else Vector3.RIGHT).scaled(Vector3(w, w, dv.length())), mid)
static func _laser(f, e: Dictionary, on: bool) -> void:
	var c := Color(3.0, 0.15, 0.1, 0.8 if fmod(e.t*12.0, 1.0) < 0.6 else 0.35)
	_beam(f, "laser", _hand(f, e), f.g.robin.position + Vector3(0, 1.0, 0), 0.02, c, on)
## THE TASER LINE: a steel cable from her hand, sagging, twitching with the current; and round Robin, coils of it
static var rope_mat: StandardMaterial3D
static func _rope_material() -> StandardMaterial3D:
	if rope_mat == null:
		rope_mat = StandardMaterial3D.new(); rope_mat.albedo_color = Color(0.12, 0.13, 0.15); rope_mat.metallic = 0.8; rope_mat.roughness = 0.35
		rope_mat.emission_enabled = true; rope_mat.emission = Color(0.35, 0.6, 1.0); rope_mat.emission_energy_multiplier = 0.0
	return rope_mat
## a run of points drawn as a cable: short cylinders end to end, pooled under a key
static func _cable(f, key: String, pts: Array, r: float) -> void:
	if not fx_nodes.has(key): fx_nodes[key] = []
	var pool: Array = fx_nodes[key]
	while pool.size() < pts.size() - 1:
		var mi := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 1.0; cm.bottom_radius = 1.0; cm.height = 1.0; cm.radial_segments = 6; cm.rings = 1
		mi.mesh = cm; mi.material_override = _rope_material(); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; f.g.add_child(mi); pool.append(mi)
	for i in pool.size():
		var mi: MeshInstance3D = pool[i]
		if i >= pts.size() - 1: mi.visible = false; continue
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]; var dv := b - a; var L := dv.length()
		if L < 0.001: mi.visible = false; continue
		mi.visible = true
		var y := dv/L; var x := y.cross(Vector3.UP if absf(y.y) < 0.95 else Vector3.RIGHT).normalized(); var z := x.cross(y)
		mi.global_transform = Transform3D(Basis(x*r, y*(L + r), z*r), (a + b)/2)
static func _hide_cable(key: String) -> void:
	for mi in fx_nodes.get(key, []): if is_instance_valid(mi): mi.visible = false
## from her hand to a point: hanging a little, and buzzing while it carries current
static func _line_pts(a: Vector3, b: Vector3, live: float) -> Array:
	var out := []; var n := 18
	for i in n + 1:
		var k := float(i)/n
		var q := a.lerp(b, k)
		q.y -= sin(k*PI)*0.18*(1.0 - live*0.6)
		if live > 0 and i > 0 and i < n: q += Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1))*0.025*live
		out.append(q)
	return out
## coils round her: three turns from her hips to her chest, closing in from loose to tight
static func _coil_pts(c: Vector3, k: float, yaw: float) -> Array:
	var out := []; var n := 54; var r := lerpf(0.55, 0.24, clampf(k, 0, 1))
	for i in n + 1:
		var u := float(i)/n; var a := yaw + u*TAU*3.0
		out.append(c + Vector3(sin(a)*r*(1.0 + 0.12*sin(u*TAU*6.0)), lerpf(0.85, 1.45, u), cos(a)*r*0.8))
	return out
static func _arc(f, e: Dictionary, on: bool) -> void:
	if not on:
		_hide_cable("line"); _hide_cable("coil"); _rope_material().emission_energy_multiplier = 0.0; return
	var rp: Vector3 = f.g.robin.position
	var k := clampf(float(e.get("t", 0.0))/0.25, 0, 1)            # the coils close in a quarter second
	var coil := _coil_pts(Vector3(rp.x, rp.y, rp.z), k, float(e.yaw))
	_cable(f, "coil", coil, 0.012)
	_cable(f, "line", _line_pts(_hand(f, e), coil[0], 1.0), 0.008)
	_rope_material().emission_energy_multiplier = 1.5 + 2.5*randf()     # the current in it, flickering
static func _cuff_mesh(f) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.08; tm.outer_radius = 0.13; mi.mesh = tm
	mi.material_override = _unlit(Color(0.7, 0.9, 3.0, 1.0)); f.g.add_child(mi)
	var l := OmniLight3D.new(); l.light_color = Color(0.5, 0.75, 1.0); l.light_energy = 2.0; l.omni_range = 2.5; mi.add_child(l)
	return mi
## the cuff flying: on her it locks; past her it is gone
static func _tick_cuff(f, dt: float) -> void:
	if cuff.is_empty(): return
	var n: MeshInstance3D = cuff.node
	var want: Vector3 = (f.g.robin.position + Vector3(0, 1.0, 0) - n.global_position).normalized()*26.0
	cuff.v = (cuff.v as Vector3).lerp(want, minf(1, dt*3.5))           # it seeks her a little: dodge it, don't just walk
	cuff.t += dt; n.global_position += cuff.v*dt; n.rotation += Vector3(9, 4, 0)*dt
	var e: Dictionary = cuff.e
	_cable(f, "line", _line_pts(_hand(f, e), n.global_position, 0.0), 0.008)     # the wire paying out behind it
	var rp: Vector3 = f.g.robin.position + Vector3(0, 1.0, 0)
	if n.global_position.distance_to(rp) < 0.75 and f.R.iframe <= 0 and f.R.act != "down" and e.state == "fire":
		n.queue_free(); cuff = {}
		f.R.grabbed_by = e; f.R.act = "grabbed"; f.R.t = 0.0; f.R.dash = null; f.R.cuff = {"k": 0}; f.robin_clip("hit", true)
		e.state = "tether"; e.t = 0.0; e.cuffed = true
		f.g.cue("hurt"); f.shake(0.3, 0.3)
		return
	if cuff.t > 1.0: n.queue_free(); cuff = {}; f.g.cue("swish"); _hide_cable("line")

## THE GUNSHIP'S RUNS: a red line across the roof through where Robin is; a second later the guns walk down it
static func _tick_strafe(f, e: Dictionary, dt: float) -> void:
	var st = f.g.station
	var gun = st.gun if st else null
	var T: float = f.floor_y
	if strafe.on == null:
		strafe.next -= dt
		if strafe.next <= 0 and f.R.act != "down":
			var rp: Vector3 = f.g.robin.position; var a := randf()*TAU; var dir := Vector3(sin(a), 0, cos(a))
			var A := Vector3(rp.x, T + 0.03, rp.z) - dir*16.0; var B := Vector3(rp.x, T + 0.03, rp.z) + dir*16.0
			strafe.on = {"a": A, "b": B, "t": 0.0, "hit": false}
			f.g.cue("alarm")
		return
	var S: Dictionary = strafe.on
	S.t += dt
	var warn := 1.1; var run := 0.7
	if gun: gun.g.global_position = gun.g.global_position.lerp(S.a.lerp(S.b, clampf((S.t - warn)/run, 0, 1)) + Vector3(0, 13, 0), minf(1, dt*3))
	if S.t < warn:
		var pulse := 0.5 + 0.5*sin(S.t*30.0)
		_beam(f, "strafe", S.a, S.b, 0.35, Color(2.5, 0.1, 0.05, 0.25 + 0.45*pulse), true)
		return
	_beam(f, "strafe", S.a, S.b, 0.35, Color(2.5, 0.1, 0.05, 0.15), true)
	var k := clampf((S.t - warn)/run, 0, 1)
	var head: Vector3 = S.a.lerp(S.b, k)
	if not S.get("fired", false): S.fired = true; f.g.cue("gun")         # one burst down the line
	if Engine.get_process_frames() % 2 == 0:
		if f._ink(e): f.fx.sparks(head + Vector3(randf_range(-0.2, 0.2), 0.1, randf_range(-0.2, 0.2)), Vector3.UP, 0.7)
	f.shake(0.12, 0.08)
	var rp2: Vector3 = f.g.robin.position
	if not S.hit and Vector2(rp2.x - head.x, rp2.z - head.z).length() < 1.1 and f.R.iframe <= 0 and f.R.act != "down":
		S.hit = true; var h0: float = f.R.hp; f.hurt(e, 15.0)
		if f.R.hp < h0: f.g.cue("boom"); f._flash(0.3)
	if k >= 1.0:
		_beam(f, "strafe", S.a, S.b, 0.35, Color.BLACK, false); strafe.on = null; strafe.next = randf_range(4.5, 6.5)

## HER STRINGS: three or four, the big ones in them, the last the biggest
const COMBOS := [["cross", "hook", "round"], ["jab", "elbow", "knee", "hook"], ["flurry", "flykick"], ["hook", "cross", "sweep"],
	["elbow", "round", "flykick"], ["jab", "cross", "elbow"], ["knee", "elbow", "hook", "round"]]      # (no hurricane kick: cut)
const HIT_AT := {"jab": 0.32, "cross": 0.36, "hook": 0.4, "elbow": 0.38, "knee": 0.42, "round": 0.45, "spin": 0.5, "flykick": 0.5, "sweep": 0.42, "flurry": 0.3, "kick": 0.42}
static func _move(f, e: Dictionary) -> void:
	var clip: String = e.seq[e.ci]
	if not e.ap.has_animation(clip): clip = "hook"
	var k := 1.45
	var ln: float = f.hit1(e, clip); e.anim_k = k
	e.mv_len = ln/k; e.mv_hit = e.mv_len*float(HIT_AT.get(clip, 0.4)); e.mv_done = false; e.state = "combo"; e.t = 0.0
	f.event("windup", {"e": e})

## a blow of hers that lands: a shockwave off it, the world stopping for it, Robin thrown back — the last of a string, across the roof
static func _power_hit(f, e: Dictionary, p: Vector2, fin: bool) -> void:
	if f.R.parry_t > 0: f.parried(e); return
	if f.R.iframe > 0 or f.R.act == "down": f.event("whiff", {"e": e, "dodged": true}); return
	var h0: float = f.R.hp
	f.hurt(e, float(e.K.dmg)*(1.25 if fin else 0.55))
	if f.R.hp >= h0: return
	var a: float = f.ang_to(e.x, e.z, p.x, p.y); var push := 5.5 if fin else 1.6
	f.R.dash = {"x0": p.x, "z0": p.y, "x1": clampf(p.x + sin(a)*push, f.arena.x1, f.arena.x2), "z1": clampf(p.y + cos(a)*push, f.arena.z1, f.arena.z2), "t": 0.0, "len": 0.4 if fin else 0.18, "arc": 1.0 if fin else 0.0}
	var at: Vector3 = f.g.robin.position + Vector3(0, 1.2, 0)
	var hd: Vector3 = at - Vector3(e.x, at.y, e.z)
	if f._ink(e): f.fx.sparks(at, hd, 2.4 if fin else 1.6); f.fx.lines(at, hd, 1.8 if fin else 1.2)
	_shockwave(f, at, hd, fin)
	f.hitstop(0.2 if fin else 0.1); f.shake(1.0 if fin else 0.55, 0.6 if fin else 0.3); f._flash(0.5 if fin else 0.22); f.g.cue("boom")
	if fin: f.slow_for(0.3, 0.8); f.cine("finisher", 0.18, 0.32, 0.8, at); f.knockdown()

## a ring of air off the blow, flat to the line it came along, out fast and gone
static func _shockwave(f, at: Vector3, dir: Vector3, big: bool) -> void:
	return                                                     # (the ring looked cheap: off)
	var mi := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.35; tm.outer_radius = 0.42; tm.rings = 48; mi.mesh = tm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(1.0, 0.95, 0.85, 0.9); m.render_priority = 107; mi.material_override = m; f.g.add_child(mi)
	mi.global_position = at
	if dir.length() > 0.01: mi.look_at(at + dir.normalized(), Vector3.UP); mi.rotate_object_local(Vector3.RIGHT, PI/2)
	var tw: Tween = f.g.create_tween(); tw.set_ignore_time_scale(true)
	tw.tween_property(mi, "scale", Vector3.ONE*(6.0 if big else 3.5), 0.28).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_EXPO)
	tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.28); tw.tween_callback(mi.queue_free)

## the junk piles: four heaps round the roof, each a few boxes and drums she can punch apart
static func build_piles(g, c: Vector2, top: float) -> void:
	for p in piles: if is_instance_valid(p.node): p.node.queue_free()
	piles.clear()
	var crate := StandardMaterial3D.new(); crate.albedo_color = Color(0.3, 0.22, 0.13); crate.roughness = 0.85
	var drum := StandardMaterial3D.new(); drum.albedo_color = Color(0.45, 0.12, 0.08); drum.roughness = 0.6; drum.metallic = 0.3
	var steel := StandardMaterial3D.new(); steel.albedo_color = Color(0.35, 0.37, 0.4); steel.roughness = 0.4; steel.metallic = 0.7
	for q in [Vector2(-17, 6), Vector2(17, -5), Vector2(-4, -19), Vector2(6, 19)]:
		var n := Node3D.new(); g.city.add_child(n); n.position = Vector3(c.x + q.x, top, c.y + q.y)
		for i in 7:
			var mi := MeshInstance3D.new()
			if i % 3 == 1:
				var cm := CylinderMesh.new(); cm.top_radius = 0.3; cm.bottom_radius = 0.3; cm.height = 0.9; mi.mesh = cm; mi.material_override = drum
			elif i % 3 == 2:
				var pm := CylinderMesh.new(); pm.top_radius = 0.07; pm.bottom_radius = 0.07; pm.height = 1.6; mi.mesh = pm; mi.material_override = steel; mi.rotation.z = PI/2
			else:
				var bm := BoxMesh.new(); bm.size = Vector3(0.7, 0.6, 0.7); mi.mesh = bm; mi.material_override = crate
			mi.position = Vector3(randf_range(-1.1, 1.1), 0.3 + (i/3)*0.55, randf_range(-1.1, 1.1)); mi.rotation.y = randf()*TAU
			n.add_child(mi)
		piles.append({"node": n, "at": n.position})

## the aura: a light on her and a glowing shell round her, wavering, that grows through the charge
static func _aura(f, e: Dictionary, k: float) -> void:
	if not e.has("aura"):
		var n := Node3D.new(); f.g.add_child(n)
		var l := OmniLight3D.new(); l.light_color = Color(0.45, 0.75, 1.0); l.omni_range = 7; l.light_energy = 0.0; l.shadow_enabled = false; n.add_child(l)
		var shell := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.75; sm.height = 2.3; shell.mesh = sm
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; m.cull_mode = BaseMaterial3D.CULL_DISABLED; m.albedo_color = Color(0.4, 0.75, 1.0, 0.0); m.render_priority = 105
		shell.material_override = m; shell.position.y = 1.0; n.add_child(shell)
		var p := GPUParticles3D.new(); p.amount = 160; p.lifetime = 0.5; p.local_coords = false
		var pm := ParticleProcessMaterial.new(); pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING; pm.emission_ring_radius = 0.6; pm.emission_ring_inner_radius = 0.2; pm.emission_ring_height = 0.1
		pm.direction = Vector3(0, 1, 0); pm.spread = 12.0; pm.initial_velocity_min = 4.0; pm.initial_velocity_max = 8.0; pm.gravity = Vector3.ZERO
		pm.scale_min = 0.6; pm.scale_max = 1.4; p.process_material = pm
		var q := QuadMesh.new(); q.size = Vector2(0.06, 0.5)
		var qm := StandardMaterial3D.new(); qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; qm.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y; qm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		qm.albedo_color = Color(0.6, 0.85, 1.0); qm.render_priority = 106; q.material = qm; p.draw_pass_1 = q; p.emitting = false; n.add_child(p)
		e.aura = {"n": n, "l": l, "shell": shell, "m": m, "p": p}
	var A: Dictionary = e.aura
	A.n.global_position = Vector3(e.x, e.y, e.z)
	var w := k*(0.85 + 0.15*sin(Time.get_ticks_msec()*0.04))
	A.l.light_energy = 9.0*w; A.m.albedo_color.a = 0.28*w; A.shell.scale = Vector3.ONE*(0.9 + 0.35*w)
	A.p.emitting = k > 0.05; A.p.amount_ratio = clampf(k, 0.1, 1.0)

static func _aura_off(e: Dictionary) -> void:
	if e.has("aura"):
		e.aura.l.light_energy = 0.0; e.aura.m.albedo_color.a = 0.0; e.aura.p.emitting = false

static func tick(f, e: Dictionary, dt: float, d: float, to_her: float, p: Vector2) -> bool:
	e.cuff_cd = maxf(0.0, float(e.get("cuff_cd", 3.0)) - dt)
	if not e.get("phase2", false) and e.hp > 0 and e.hp <= float(e.K.hp)*0.5:      # HALF HER HEALTH: she calls the gunship in
		e.phase2 = true; strafe = {"next": 2.5, "on": null}
		f.g.cue("alert"); f.g.note("She's called in the gunship — get out of the red!"); f.shake(0.3, 0.5)
	if not strafe.is_empty() and e.hp > 0: _tick_strafe(f, e, dt)
	var mine := _tick(f, e, dt, d, to_her, p)
	if mine: f._place(e)                                       # (her model where she is: without this she lagged and jumped)
	return mine
static func _tick(f, e: Dictionary, dt: float, d: float, to_her: float, p: Vector2) -> bool:
	_tick_shots(f, dt)
	match e.state:
		"circle":
			e.rolled = false
			if d > 3.2 and d < 11.0 and float(e.get("cuff_cd", 0.0)) <= 0.0 and f.R.grabbed_by == null and randf() < dt*1.2:      # at range: the cuffs
				e.state = "aim"; e.t = 0.0; e.cuff_cd = 8.0; f.g.cue("lock"); return true
			e.cool = minf(e.cool, 0.9)                           # she doesn't wait long (but a breath, to hit her in)
			return false
		"approach":
			if not e.get("rolled", false) and f.R.grabbed_by == null:      # each time she comes in: one of her own, or (else) the ordinary blow
				e.rolled = true
				var r := randf()
				if d > 3.0 and d < 10.0 and r < 0.35 and float(e.get("cuff_cd", 0.0)) <= 0.0:      # THE TASER CUFFS
					e.state = "aim"; e.t = 0.0; e.cuff_cd = 9.0; f.g.cue("lock"); return true
				var best = null; var bd := 1e9                         # junk only if there is some right by her: she doesn't go looking for it
				for pl in piles:
					var dd: float = Vector2(pl.at.x - e.x, pl.at.z - e.z).length()
					if dd < bd: bd = dd; best = pl
				if best != null and bd < 4.0 and r < 0.7:
					e.state = "to_pile"; e.t = 0.0; e.pile = best; return true
				e.seq = COMBOS.pick_random(); e.ci = 0
				if d > 2.0: e.state = "run_in"; e.t = 0.0; return true     # she runs at her first, then the string
				_move(f, e); return true
			return false
		"aim":                                                     # the laser on her: half a second to see it coming
			e.yaw = f.turn_to(e.yaw, to_her, dt*10); f.play(e, "fight")
			if e.t >= 0.55:
				_laser(f, e, false); f.hit1(e, "jab"); e.anim_k = 1.6; f.g.cue("zip")
				var from := _hand(f, e); var rp: Vector3 = f.g.robin.position + Vector3(0, 1.0, 0)
				cuff = {"node": _cuff_mesh(f), "at": from, "v": (rp - from).normalized()*26.0, "t": 0.0, "e": e}
				cuff.node.global_position = from
				e.state = "fire"; e.t = 0.0
			return true
		"fire":
			e.yaw = f.turn_to(e.yaw, to_her, dt*6)
			if cuff.is_empty() and e.state == "fire": e.state = "recover"; e.t = 0.0; e.anim_k = 1.0
			return true
		"tether":                                                  # her current through the cuff into Robin
			e.yaw = f.turn_to(e.yaw, to_her, dt*6); f.play(e, "fight")
			_arc(f, e, true)
			if f.R.grabbed_by != e:                                # broken free (or pulsed her off)
				_arc(f, e, false); e.erase("cuffed"); f.R.erase("cuff"); f.g.model.rotation.x = 0.0; _mash_ui(f, false, 0)
				if e.state == "tether": e.state = "stagger"; e.t = 0.0; e.parried = true; f.hit1(e, "stagger")
				return true
			f.R.hp -= 5.0*dt; f.shake(0.05, 0.1)
			_mash_ui(f, true, clampf(float(f.R.cuff.k)/8.0, 0, 1))
			# Robin: braced, arms up, leaning back from the pull, shaking with the current; dragged in a step at a time
			var away: float = f.ang_to(e.x, e.z, p.x, p.y)
			f.R.face = away + PI; f.robin_clip("block")
			f.g.model.rotation.x = 0.22 + sin(e.t*40.0)*0.04          # heels dug in
			if Vector2(p.x - e.x, p.y - e.z).length() > 2.0: f.move_to(p.x - sin(away)*0.6*dt, p.y - cos(away)*0.6*dt)
			if fmod(e.t, 0.5) < dt: f.g.cue("zip")                 # the current, buzzing
			if int(f.R.cuff.k) >= 8:                               # she broke it: the Director thrown off balance, open
				_arc(f, e, false); f.R.grabbed_by = null; f.R.act = null; f.R.erase("cuff"); e.erase("cuffed"); f.g.model.rotation.x = 0.0
				e.state = "stagger"; e.t = 0.0; e.parried = true; f.hit1(e, "stagger")
				f.g.cue("clang"); f.hitstop(0.1); f._flash(0.3); _mash_ui(f, false, 0); _pop(f)
				if f._ink(e): f.fx.sparks(f.g.robin.position + Vector3(0, 1.2, 0), Vector3.UP, 1.4)
				return true
			if e.t >= 1.9:                                         # too slow: YANKED — and the cross already coming
				_arc(f, e, false); _mash_ui(f, false, 0)
				var to := Vector2(e.x, e.z) + Vector2(p.x - e.x, p.y - e.z).normalized()*0.9
				e.reel = {"from": p, "to": to}
				var ln: float = f.hit1(e, "cross"); e.anim_k = 1.5
				e.reel_hit = ln/1.5*0.36                           # the fist lands as she arrives
				e.state = "reel"; e.t = 0.0
				f.g.cue("zip"); f.shake(0.25, 0.2)
			return true
		"reel":
			var R0: Vector2 = e.reel.from; var R1: Vector2 = e.reel.to
			var k := clampf(e.t/float(e.reel_hit), 0, 1); var q := k*k               # quicker and quicker, into the fist
			if not e.get("reeled", false):
				f.move_to(lerpf(R0.x, R1.x, q), lerpf(R0.y, R1.y, q))
				f.R.face = f.ang_to(R1.x, R1.y, e.x, e.z); f.R.act = "grabbed"; f.R.grabbed_by = e
				f.robin_clip("hit"); f.g.model.rotation.x = -0.35*k            # pitched forward, off her feet
				_cable(f, "line", _line_pts(_hand(f, e), f.g.robin.position + Vector3(0, 1.05, 0), 0.4), 0.008)
			if e.t >= float(e.reel_hit) and not e.get("reeled", false):
				e.reeled = true; _hide_cable("line"); _hide_cable("coil"); _rope_material().emission_energy_multiplier = 0.0
				f.R.grabbed_by = null; f.R.act = null; f.R.erase("cuff"); e.erase("cuffed"); f.g.model.rotation.x = 0.0
				f.R.iframe = 0.0; _power_hit(f, e, f.P(), true)
			if e.t >= float(e.reel_hit) + 0.45: e.reeled = false; e.state = "recover"; e.t = 0.0; e.anim_k = 1.0
			return true
		"run_in":
			e.yaw = f.turn_to(e.yaw, to_her, dt*10)
			f._step(e, to_her, float(e.K.run), dt, true); f.play(e, "sprint", 0.1); e.anim_k = 1.25
			if d <= 1.9: e.anim_k = 1.0; _move(f, e)
			elif e.t > 3.0: e.state = "circle"; e.t = 0.0; e.anim_k = 1.0
			return true
		"combo":
			e.yaw = f.turn_to(e.yaw, to_her, dt*(10.0 if e.t < e.mv_hit else 1.5))
			var reach: float = 1.9 if e.seq[e.ci] in ["flykick", "spin", "round", "sweep"] else 1.5      # her fist or foot has to reach her
			if e.t < e.mv_hit and d > 0.95: f._step(e, to_her, minf((d - 0.9)/maxf(e.mv_hit - e.t, 0.05), 13.0 if e.seq[e.ci] == "flykick" else 8.0), dt, true)      # closing the gap by the time the blow lands
			if e.t >= e.mv_hit and not e.mv_done:
				e.mv_done = true
				var fin: bool = e.ci == (e.seq as Array).size() - 1
				f.g.cue("swish")
				if f._ink(e): f.fx.lines(Vector3(e.x, f.floor_y + 1.3, e.z), Vector3(sin(e.yaw), 0, cos(e.yaw)), 1.4 if fin else 1.0)
				var a: float = absf(f.ang_diff(to_her, e.yaw))
				if d < reach and a < 0.9: _power_hit(f, e, p, fin)
				else: f.event("whiff", {"e": e, "dodged": f.R.since_dodge < 0.9})
			if e.t >= e.mv_len*0.82:
				e.ci += 1
				if e.ci < (e.seq as Array).size() and d < 5.0: _move(f, e)
				else: e.state = "recover"; e.t = 0.0; e.anim_k = 1.0
			return true
		"charge":
			e.yaw = f.turn_to(e.yaw, to_her, dt*5)
			var k: float = clampf(e.t/CHARGE, 0.0, 1.0)
			_aura(f, e, k)
			f.shake(0.04 + 0.12*k, 0.1)
			if e.t > CHARGE*0.5 and not e.get("warned", false): e.warned = true; f.g.note("She's charging — SPACE to get out of the way!")
			if e.t >= CHARGE:
				e.warned = false; e.state = "rush"; e.t = 0.0; e.rush_a = to_her; e.rush_hit = false
				f.g.cue("launch"); f._flash(0.3); f.play(e, "sprint", 0.05); e.anim_k = 2.5
				if f._ink(e): f.fx.lines(Vector3(e.x, f.floor_y + 1.2, e.z), Vector3(sin(to_her), 0, cos(to_her)), 1.6)
			return true
		"rush":
			_aura(f, e, 1.0)
			var step := RUSH*dt
			e.x += sin(e.rush_a)*step; e.z += cos(e.rush_a)*step; e.yaw = e.rush_a
			e.x = clampf(e.x, f.arena.x1, f.arena.x2); e.z = clampf(e.z, f.arena.z1, f.arena.z2)
			f._place(e)
			var dd: float = Vector2(e.x, e.z).distance_to(p)
			if dd < 1.4 and not e.rush_hit:
				e.rush_hit = true; e.state = "smash"; e.t = 0.0; f.hit1(e, "hook"); e.anim_k = 1.8
				return true
			if e.t > 0.9: e.state = "recover"; e.t = 0.0; e.anim_k = 1.0; _aura_off(e); f.g.cue("swish"); f.event("whiff", {"e": e, "dodged": true})
			return true
		"smash":
			_aura(f, e, 1.0 - e.t*2)
			if e.t >= 0.12 and not e.get("smashed", false):
				e.smashed = true
				var h0: float = f.R.hp
				if f.R.iframe <= 0 and f.R.parry_t <= 0:
					f.hurt(e, float(e.K.dmg)*BIG)
					if f.R.hp < h0:                          # off her feet: thrown across the roof
						var a: float = f.ang_to(e.x, e.z, p.x, p.y)
						f.R.dash = {"x0": p.x, "z0": p.y, "x1": clampf(p.x + sin(a)*6.5, f.arena.x1, f.arena.x2), "z1": clampf(p.y + cos(a)*6.5, f.arena.z1, f.arena.z2), "t": 0.0, "len": 0.45, "arc": 1.2}
						f.hitstop(0.22); f.slow_for(0.25, 0.9); f.shake(1.0, 0.7); f._flash(0.6); f.g.cue("boom")
						if f._ink(e):
							var hd: Vector3 = f.g.robin.position - Vector3(e.x, f.g.robin.position.y, e.z)
							f.fx.sparks(f.g.robin.position + Vector3(0, 1.2, 0), hd, 2.2); f.fx.lines(f.g.robin.position + Vector3(0, 1.2, 0), hd, 1.8)
						f.cine("finisher", 0.2, 0.35, 0.9, f.g.robin.position + Vector3(0, 1.2, 0))
				elif f.R.parry_t > 0: f.parried(e)
				else: f.g.cue("swish")
			if e.t > 0.7: e.smashed = false; e.state = "recover"; e.t = 0.0; e.anim_k = 1.0; _aura_off(e)
			return true
		"to_pile":
			var pl: Dictionary = e.pile
			var at := Vector2(pl.at.x, pl.at.z); var dv := at - Vector2(e.x, e.z)
			if dv.length() > 2.0:
				f._step(e, atan2(dv.x, dv.y), float(e.K.run), dt); f.play(e, "sprint"); e.anim_k = 1.25
			else:
				e.anim_k = 1.0; e.state = "volley"; e.t = 0.0; e.n_shot = 0; e.next_shot = 0.35
			if e.t > 4.0: e.state = "circle"; e.t = 0.0; e.cool = 0.5
			return true
		"volley":
			# first she smashes the heap: it bursts into pieces that hang in the air round her fist; then she punches
			# them at Robin one by one
			var pl: Dictionary = e.pile
			if not e.get("broke", false):
				e.yaw = f.turn_to(e.yaw, f.ang_to(e.x, e.z, pl.at.x, pl.at.z), dt*10)
				if not e.get("swung", false): e.swung = true; f.hit1(e, "hook"); e.anim_k = 2.2
				if e.t >= 0.16: e.broke = true; _smash(f, e); e.next_shot = e.t + 0.22; e.n_shot = 0
				return true
			e.yaw = f.turn_to(e.yaw, to_her, dt*8)
			_tick_debris(f, e, dt)
			var left: Array = e.debris.filter(func(q): return is_instance_valid(q.node) and not q.gone)
			if e.t >= e.next_shot and left.size():
				e.n_shot += 1; e.next_shot = e.t + 0.24
				f.hit1(e, "jab" if e.n_shot % 2 else "cross"); e.anim_k = 2.6
				var q: Dictionary = left[0]
				f.later(0.06, func(): _launch(f, e, q))
			if left.is_empty() and e.t > e.next_shot - 0.1:
				e.state = "recover"; e.t = 0.0; e.anim_k = 1.0; e.broke = false; e.swung = false
			return true
	return false

## THE HEAP BURSTS: every piece of it thrown up off the roof round her, and held there a moment, turning
static func _smash(f, e: Dictionary) -> void:
	var pl: Dictionary = e.pile
	e.debris = []
	var front := Vector3(e.x + sin(e.yaw)*1.0, f.floor_y, e.z + cos(e.yaw)*1.0)
	var frags: Array = []
	for c in pl.node.get_children():                           # every piece of it broken in three or four
		var mi := c as MeshInstance3D
		var ab: AABB = mi.get_aabb(); var at: Vector3 = mi.global_position
		for k in randi_range(3, 4):
			var fr := MeshInstance3D.new(); var bm := BoxMesh.new()
			bm.size = Vector3(ab.size.x*randf_range(0.3, 0.55), ab.size.y*randf_range(0.3, 0.55), ab.size.z*randf_range(0.3, 0.55)); fr.mesh = bm
			fr.material_override = mi.material_override; f.g.add_child(fr)
			fr.global_position = at + Vector3(randf_range(-0.2, 0.2), randf_range(0.0, 0.3), randf_range(-0.2, 0.2)); fr.rotation = Vector3(randf()*TAU, randf()*TAU, randf()*TAU)
			frags.append(fr)
	pl.node.queue_free(); piles.erase(pl)
	frags.shuffle()
	for i in frags.size():
		var fr: MeshInstance3D = frags[i]
		if i < SHOTS:                                          # five hang in front of her, to be punched
			var home := front + Vector3(randf_range(-1.0, 1.0), randf_range(1.0, 1.9), randf_range(-0.5, 0.5))
			e.debris.append({"node": fr, "home": home, "t": 0.0, "gone": false, "spin": Vector3(randf_range(-3, 3), randf_range(-3, 3), randf_range(-3, 3))})
		else:                                                  # the rest blown across the roof
			var a := randf()*TAU
			scatter.append({"node": fr, "v": Vector3(sin(a)*randf_range(3, 7), randf_range(3, 6), cos(a)*randf_range(3, 7)), "spin": Vector3(randf_range(-8, 8), randf_range(-8, 8), randf_range(-8, 8))})
	f.g.cue("boom"); f.shake(0.6, 0.35); f.hitstop(0.06)
	if f._ink(e): f.fx.sparks(front + Vector3(0, 0.8, 0), Vector3(sin(e.yaw), 0.4, cos(e.yaw)), 2.0); f.fx.lines(front + Vector3(0, 0.8, 0), Vector3(sin(e.yaw), 0, cos(e.yaw)), 1.0)
	_shockwave(f, front + Vector3(0, 0.6, 0), Vector3(sin(e.yaw), 0, cos(e.yaw)), true)
## the pieces float up to where they hang, and turn slowly there
static func _tick_debris(f, e: Dictionary, dt: float) -> void:
	for q in e.get("debris", []):
		if q.gone or not is_instance_valid(q.node): continue
		q.t += dt
		var n: MeshInstance3D = q.node
		n.global_position = n.global_position.lerp(q.home + Vector3(0, sin(q.t*3.0)*0.06, 0), minf(1, dt*16))
		n.rotation += q.spin*dt*0.4
## one hanging piece, punched: straight at where Robin is going
static func _launch(f, e: Dictionary, q: Dictionary) -> void:
	if not is_instance_valid(q.node): return
	q.gone = true
	var piece: MeshInstance3D = q.node
	var from: Vector3 = piece.global_position
	var rp: Vector3 = f.g.robin.position
	var to := Vector3(rp.x, f.floor_y + 1.0, rp.z)
	var v := (to - from).normalized()*36.0
	shots.append({"node": piece, "v": v, "t": 0.0, "spin": Vector3(randf_range(-9, 9), randf_range(-9, 9), randf_range(-9, 9)), "e": e})
	f.g.cue("punch"); f.shake(0.15, 0.12)
	_shockwave(f, from, v, false)
	if f._ink(e): f.fx.lines(from, v.normalized(), 0.9)

## one piece off the heap, punched: away from her fist at the place Robin is about to be
static func _punch_out(f, e: Dictionary) -> void:
	var pl: Dictionary = e.pile
	var kids: Array = pl.node.get_children()
	var src: MeshInstance3D = kids.pick_random() if kids.size() else null
	var piece := MeshInstance3D.new()
	if src: piece.mesh = src.mesh; piece.material_override = src.material_override
	else: var bm := BoxMesh.new(); bm.size = Vector3(0.6, 0.5, 0.6); piece.mesh = bm
	f.g.add_child(piece)
	var from := Vector3(e.x + sin(e.yaw)*0.8, f.floor_y + 1.2, e.z + cos(e.yaw)*0.8)
	var rp: Vector3 = f.g.robin.position
	var lead := Vector3(f.g.boots.vx, 0, f.g.boots.vz)*0.15 if "boots" in f.g and f.g.boots else Vector3.ZERO
	var to := Vector3(rp.x, f.floor_y + 1.0, rp.z) + lead
	var v := (to - from).normalized()*30.0
	piece.global_position = from
	shots.append({"node": piece, "v": v, "t": 0.0, "spin": Vector3(randf_range(-9, 9), randf_range(-9, 9), randf_range(-9, 9)), "e": e})
	f.g.cue("punch"); f.shake(0.15, 0.12)
	if f._ink(e): f.fx.lines(from, v.normalized(), 0.9)

static func _tick_shots(f, dt: float) -> void:
	_tick_cuff(f, dt)
	for q in scatter:
		var n: MeshInstance3D = q.node
		if not is_instance_valid(n) or q.get("down", false): continue
		q.v.y -= 18.0*dt; n.global_position += q.v*dt; n.rotation += q.spin*dt
		if n.global_position.y < f.floor_y + 0.08:
			n.global_position.y = f.floor_y + 0.08; q.down = true
			var tw: Tween = f.g.create_tween(); tw.tween_interval(5.0); tw.tween_callback(n.queue_free)
	scatter = scatter.filter(func(q): return is_instance_valid(q.node) and not q.get("down", false))
	if shots.is_empty(): return
	var rp: Vector3 = f.g.robin.position + Vector3(0, 1.0, 0)
	var keep := []
	for s in shots:
		s.t += dt
		var n: MeshInstance3D = s.node
		if not is_instance_valid(n): continue
		s.v.y -= 4.0*dt
		n.global_position += s.v*dt; n.rotation += s.spin*dt
		if n.global_position.y < f.floor_y + 0.25 or s.t > 1.6:      # missed: it comes down and lies on the roof
			n.global_position.y = maxf(n.global_position.y, f.floor_y + 0.25); f.g.cue("thud")
			var tw: Tween = f.g.create_tween(); tw.tween_interval(4.0); tw.tween_callback(n.queue_free)
			continue
		if n.global_position.distance_to(rp) < 0.9 and f.R.iframe <= 0 and f.R.act != "down":
			var h0: float = f.R.hp
			f.hurt(s.e, float(s.e.K.dmg)*0.4)
			if f.R.hp < h0: f.g.cue("boom"); f.shake(0.4, 0.3); f._flash(0.2)
			n.queue_free(); continue
		keep.append(s)
	shots = keep

static func clear() -> void:
	for s in shots: if is_instance_valid(s.node): s.node.queue_free()
	shots.clear(); scatter.clear()
	if not cuff.is_empty() and is_instance_valid(cuff.node): cuff.node.queue_free()
	cuff = {}; strafe = {}
	if not ui.is_empty() and is_instance_valid(ui.layer): ui.layer.queue_free()
	ui = {}
	for k in fx_nodes:
		var v = fx_nodes[k]
		for mi in (v if v is Array else [v]): if is_instance_valid(mi): mi.queue_free()
	fx_nodes = {}
	for p in piles: if is_instance_valid(p.node): p.node.queue_free()
	piles.clear()
