## THE FLEET: before the Director comes down herself, WFC's fighters (wfc/fighter.glb, the user's model) come up round
## the Meridian Tower's roof. Robin is on her own feet up there. They circle; one at a time they make a run at her — a red
## line across the roof, then the guns walk it — and after a run the ship is spent: it sinks to the roof's edge, smoking,
## its guns cycling, for a few seconds. Get to it and press E (or click): she goes up onto it and brings it down. All
## five down, and the Director comes for her herself (station.gd boss_scene).
##   Fleet.begin(g, done)   Fleet.tick(g, dt)   Fleet.key(g, ev)   Fleet.on, Fleet.hp
class_name Fleet
extends RefCounted

const N := 5
const R_ORBIT := 40.0
static var on := false
static var g
static var ships: Array = []          # {root, holder, state, t, a, line, hit, smoke, mark, home}
static var hp := 100.0
static var next_run := 3.0
static var done_cb: Callable
static var busy := false              # a takedown playing
static var fx                         # Director's effects want an object with .g: the fight does

static func _model(parent: Node) -> Dictionary:
	var root := Node3D.new(); parent.add_child(root)
	var holder := Node3D.new(); root.add_child(holder)
	var m: Node3D = (load("res://assets/tsh/wfc/fighter.glb") as PackedScene).instantiate(); holder.add_child(m)
	m.rotation.y = -PI/2; m.scale = Vector3.ONE*6.5             # nose (+X in the file) to +Z; about six metres long
	var nav := OmniLight3D.new(); nav.light_color = Color(1, 0.2, 0.15); nav.omni_range = 5; nav.light_energy = 2.0; nav.position = Vector3(0, 1.2, 0); holder.add_child(nav)
	var under := OmniLight3D.new(); under.light_color = Color(0.7, 0.8, 1.0); under.omni_range = 8; under.light_energy = 2.5; under.position = Vector3(0, -1.5, 0); holder.add_child(under)
	return {"root": root, "holder": holder, "nav": nav}

static func begin(game, cb: Callable) -> void:
	g = game; done_cb = cb; on = true; hp = 100.0; next_run = 4.0; busy = false; fx = g.fight
	for s in ships: if is_instance_valid(s.root): s.root.queue_free()
	ships = []
	var tc: Vector2 = Tower.C; var T: float = Tower.TOP
	for i in N:
		var d := _model(g.city); var a := i*TAU/N + 0.3
		d.merge({"state": "orbit", "t": 0.0, "a": a, "y": T + 8.0 + i*1.3, "line": null, "hit": false, "smoke": null, "mark": null, "i": i})
		d.root.position = Vector3(tc.x + cos(a)*R_ORBIT, T - 14, tc.y + sin(a)*R_ORBIT)
		ships.append(d)
	_parapet(true)

## a wall round the roof while they are up, so she can't run off it
static var walls: Array = []
static func _parapet(v: bool) -> void:
	var tc: Vector2 = Tower.C; var H: float = Tower.HALF; var T: float = Tower.TOP
	if v and walls.is_empty():
		for w in [[tc.x - H - 1, tc.x + H + 1, tc.y - H - 1, tc.y - H + 0.3], [tc.x - H - 1, tc.x + H + 1, tc.y + H - 0.3, tc.y + H + 1],
				[tc.x - H - 1, tc.x - H + 0.3, tc.y - H - 1, tc.y + H + 1], [tc.x + H - 0.3, tc.x + H + 1, tc.y - H - 1, tc.y + H + 1]]:
			var s := [w[0], w[1], w[2], w[3], T - 1.0, T + 3.0, ""]; g.boots.solids.append(s); walls.append(s)
	elif not v:
		for s in walls: g.boots.solids.erase(s)
		walls = []

static func alive() -> Array: return ships.filter(func(s): return s.state != "dead" and s.state != "falling")

static func tick(game, dt: float) -> void:
	if not on: return
	g = game
	var T: float = Tower.TOP; var tc: Vector2 = Tower.C
	var rp: Vector3 = g.robin.position
	if rp.y < T - 6.0:                                            # off the roof somehow: back on it, and it costs her
		g.place(Vector3(tc.x, T, tc.y), 0.0); hurt(15.0)
	var running := false
	for s in ships:
		if s.state == "dead" or not is_instance_valid(s.root): s.state = "dead"; continue
		s.t += dt
		var root: Node3D = s.root
		match s.state:
			"orbit":
				s.a += dt*0.12
				var to := Vector3(tc.x + cos(s.a)*R_ORBIT, s.y + sin(s.t*0.9 + s.i)*0.8, tc.y + sin(s.a)*R_ORBIT)
				root.position = root.position.lerp(to, minf(1, dt*(2.2 if root.position.y < T else 1.2)))
				_face(s, rp, dt)
			"run":
				running = true
				var S: Dictionary = s.line
				var warn := 1.1; var run := 0.8
				var k := clampf((s.t - warn)/run, 0, 1)
				var head: Vector3 = (S.a as Vector3).lerp(S.b, k)
				root.position = root.position.lerp(head + Vector3(0, 11, 0) - S.dir*6.0, minf(1, dt*3))
				_face(s, head, dt)
				if s.t < warn:
					var pulse := 0.5 + 0.5*sin(s.t*(18.0 + s.t*30.0))
					Director._beam(fx, "fleet%d" % s.i, S.a, S.b, 0.12 + 0.3*pulse, Color(2.5, 0.1, 0.05, 0.25 + 0.55*pulse), true)
				else:
					Director._beam(fx, "fleet%d" % s.i, S.a, S.b, 0.3, Color(2.5, 0.1, 0.05, 0.12), true)
					if not s.get("fired", false): s.fired = true; g.cue("gun")
					_rounds(s, head, dt)
					if not s.hit and Vector2(rp.x - head.x, rp.z - head.z).length() < 1.3 and rp.y < T + 1.5:
						s.hit = true; hurt(14.0)
						var push := (Vector2(rp.x, rp.z) - Vector2(head.x, head.z)).normalized()
						g.boots.vx = push.x*9; g.boots.vz = push.y*9; g.boots.vy = 6; g.boots.ground = false; g.boots.state = "air"
				if k >= 1.0:
					Director._beam(fx, "fleet%d" % s.i, S.a, S.b, 0.3, Color.BLACK, false)
					s.state = "spent"; s.t = 0.0; s.fired = false
					var d := (Vector2(rp.x, rp.z) - tc).normalized() if (Vector2(rp.x, rp.z) - tc).length() > 1 else Vector2(1, 0)
					d = d.rotated(randf_range(-0.6, 0.6))
					s.home = Vector3(tc.x + d.x*(Tower.HALF + 3.2), T + 1.6, tc.y + d.y*(Tower.HALF + 3.2))
					_spent(s, true)
			"spent":                                              # sinking to the edge, smoking: her chance
				root.position = root.position.lerp(s.home + Vector3(0, sin(s.t*7.0)*0.15, 0), minf(1, dt*2.5))
				_face(s, Vector3(tc.x, T, tc.y), dt)
				s.holder.rotation.z = sin(s.t*9.0)*0.06
				if s.mark: s.mark.global_position = root.global_position + Vector3(0, 3.0, 0); s.mark.visible = Vector2(rp.x - root.position.x, rp.z - root.position.z).length() < 9.0
				if s.t > 5.0: _spent(s, false); s.state = "orbit"; s.t = 0.0
			"falling":
				s.v.y -= 14.0*dt; root.position += s.v*dt; root.rotation += Vector3(1.4, 2.2, 0.6)*dt
				if root.position.y < T - 120: s.state = "dead"; root.queue_free()
	if g.autopilot and not busy:                                  # -- auto: she goes for the spent ones herself
		for s in ships:
			if s.state == "spent" and s.t > 1.2:
				var tcv := Vector2(tc.x, tc.y); var sp2 := Vector2(s.root.position.x, s.root.position.z)
				var near := tcv + (sp2 - tcv).normalized()*(Tower.HALF - 3.0)
				g.place(Vector3(near.x, T, near.y), atan2(sp2.x - near.x, sp2.y - near.y)); _takedown(s); break
	next_run -= dt
	if next_run <= 0 and not running and not busy:
		var free := ships.filter(func(s): return s.state == "orbit")
		if free.size():
			var s = free.pick_random()
			var a := randf()*TAU; var dir := Vector3(sin(a), 0, cos(a))
			var c := Vector3(rp.x, T + 0.03, rp.z)
			s.line = {"a": c - dir*16.0, "b": c + dir*16.0, "dir": dir}; s.state = "run"; s.t = 0.0; s.hit = false; s.acc = 0.0
			g.cue("alarm"); print("RUN ", s.i)
		var left := alive().size()
		next_run = lerpf(3.0, 5.5, float(left)/N)
	var left2 := alive().size()
	g.objective("Bring them down — %d left" % left2, ["Wait for one to sink to the edge, smoking — get to it and press E"])
	if left2 == 0 and not busy: _finish()

static func _face(s: Dictionary, at: Vector3, dt: float) -> void:
	var root: Node3D = s.root; var d := at - root.position
	if Vector2(d.x, d.z).length() > 0.5: root.rotation.y = lerp_angle(root.rotation.y, atan2(d.x, d.z), minf(1, dt*3))

static func _rounds(s: Dictionary, head: Vector3, dt: float) -> void:
	s.acc = float(s.get("acc", 0.0)) + dt
	while s.acc > 0.03:
		s.acc -= 0.03
		var at := head + Vector3(randf_range(-0.6, 0.6), 0.02, randf_range(-0.6, 0.6))
		Director._splash(fx, at)
		if randf() < 0.3: Director._scar(fx, at)
		if randf() < 0.4 and g.fight.fx: g.fight.fx.sparks(at + Vector3(0, 0.1, 0), Vector3(randf_range(-0.3, 0.3), 1, randf_range(-0.3, 0.3)), 0.6)
	g.station.shake(0.2, 0.08)

static func _spent(s: Dictionary, v: bool) -> void:
	if v:
		var p := GPUParticles3D.new(); p.amount = 60; p.lifetime = 1.6; p.local_coords = false
		var pm := ParticleProcessMaterial.new(); pm.direction = Vector3(0, 1, 0); pm.spread = 20.0; pm.initial_velocity_min = 1.0; pm.initial_velocity_max = 2.5
		pm.gravity = Vector3(0, 1.2, 0); pm.scale_min = 1.5; pm.scale_max = 3.0; p.process_material = pm
		var q := QuadMesh.new(); q.size = Vector2(0.6, 0.6)
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.albedo_color = Color(0.08, 0.08, 0.09, 0.55); q.material = m; p.draw_pass_1 = q
		s.root.add_child(p); s.smoke = p
		var mk := Label3D.new(); mk.text = "E"; mk.font_size = 96; mk.outline_size = 18; mk.modulate = Color("#ffd23d"); mk.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		mk.no_depth_test = true; g.add_child(mk); s.mark = mk
		s.nav.light_color = Color(1.0, 0.55, 0.1)
	else:
		if s.smoke and is_instance_valid(s.smoke): s.smoke.queue_free()
		if s.mark and is_instance_valid(s.mark): s.mark.queue_free()
		s.smoke = null; s.mark = null; s.nav.light_color = Color(1, 0.2, 0.15)

static func hurt(n: float) -> void:
	hp -= n; g.cue("boom"); g.station.flash(0.3, Color(1, 0.25, 0.2)); g.station.shake(0.5, 0.3)
	if hp <= 0: _again()

## too much: the roof again, every ship back up
static func _again() -> void:
	busy = true
	g.black(true); g.end_text("[font_size=18]THE FLEET HAD HER[/font_size]\nAGAIN")
	g.get_tree().create_timer(2.2).timeout.connect(func():
		g.end_text(""); g.black(false)
		for s in ships: if is_instance_valid(s.root): s.root.queue_free()
		ships = []; begin(g, done_cb)
		g.place(Vector3(Tower.C.x, Tower.TOP, Tower.C.y + 12), PI))

static func key(game, ev: InputEvent) -> bool:
	if not on or busy: return false
	var press: bool = (ev is InputEventKey and ev.pressed and not ev.echo and ev.keycode == KEY_E) or (ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT)
	if not press: return false
	var rp: Vector3 = g.robin.position; var best = null; var bd := 9.0
	for s in ships:
		if s.state != "spent": continue
		var d := Vector2(rp.x - s.root.position.x, rp.z - s.root.position.z).length()
		if d < bd: bd = d; best = s
	if best == null: return false
	_takedown(best); return true

## SHE GOES UP ONTO IT: a leap from the roof onto its back, a blow down through it, and off it as it goes
static func _takedown(s: Dictionary) -> void:
	busy = true; print("TAKEDOWN ", s.i)
	var T: float = Tower.TOP
	var rp: Vector3 = g.robin.position; var R0 := Vector2(rp.x, rp.z)
	var sp: Vector3 = s.root.position; var top := sp + Vector3(0, 1.7, 0)
	var ry := atan2(sp.x - R0.x, sp.z - R0.y)
	var back := Vector2(Tower.C.x, Tower.C.y) + (R0 - Vector2(Tower.C.x, Tower.C.y))*0.8
	var side := Vector3(cos(ry), 0, -sin(ry))
	var shots := [
		{"dur": 0.6, "fov": 50, "cam": Vector3(R0.x, T + 1.2, R0.y) + side*5.0 - Vector3(sin(ry), 0, cos(ry))*2.0, "look": func(k, t): return g.robin.position + Vector3(0, 1, 0),
			"enter": func(): g.cue("launch"),
			"tick": func(dt, t, k): var q := Vector3(R0.x, T, R0.y).lerp(top, k); q.y += sin(k*PI)*2.5; g.stage("flip", q.x, q.y, q.z, ry)},
		{"dur": 0.9, "fov": 40, "cam": top + side*8.5 + Vector3(0, 3.0, 0) - Vector3(sin(ry), 0, cos(ry))*3.0, "look": top + Vector3(0, 0.6, 0),
			"enter": func(): g.stage("fight", top.x, top.y, top.z, ry),
			"beats": [[0.15, func(): g.stage("hook", top.x, top.y, top.z, ry); g.cue("punch")], [0.42, func(): _boom(s)]]},
		{"dur": 1.6, "fov": 58, "cam": Vector3(R0.x, T + 2.5, R0.y) - Vector3(sin(ry), 0, cos(ry))*4.0 + side*2.0, "look": func(k, t): return s.root.position,
			"enter": func(): s.state = "falling"; s.v = Vector3(sin(ry)*3, 2, cos(ry)*3); _spent(s, false),
			"tick": func(dt, t, k): var q := top.lerp(Vector3(back.x, T, back.y), minf(1, k*1.6)); q.y = lerpf(top.y, T, minf(1, k*1.6)) + sin(minf(1, k*1.6)*PI)*1.5; g.stage("flip" if k < 0.6 else "fight", q.x, q.y, q.z, ry + PI)}]
	g.play_reel(shots, func(_x):
		g.dutch = 0.0; g.staged = null; g.place(Vector3(back.x, T, back.y), ry + PI); busy = false
		g.note("%d left" % alive().size()))

## the ship going: a fireball, a flash, sparks, the boom; then it falls burning
static func _boom(s: Dictionary) -> void:
	var at: Vector3 = s.root.position
	g.cue("blast"); g.cue("boom"); g.station.flash(0.6, Color(1, 0.7, 0.4)); g.station.shake(0.9, 0.6)
	var fb := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 1.0; sm.height = 2.0; fb.mesh = sm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(3.0, 1.4, 0.4, 1.0); fb.material_override = m; g.add_child(fb); fb.global_position = at
	var l := OmniLight3D.new(); l.light_color = Color(1, 0.6, 0.25); l.light_energy = 14.0; l.omni_range = 20; fb.add_child(l)
	var tw: Tween = g.create_tween(); tw.set_ignore_time_scale(true)
	tw.tween_property(fb, "scale", Vector3.ONE*4.5, 0.35).set_ease(Tween.EASE_OUT); tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.6); tw.parallel().tween_property(l, "light_energy", 0.0, 0.6)
	tw.tween_callback(fb.queue_free)
	if g.fight.fx: g.fight.fx.sparks(at, Vector3.UP, 2.5)
	# it burns on the way down
	var p := GPUParticles3D.new(); p.amount = 90; p.lifetime = 1.2; p.local_coords = false
	var pm := ParticleProcessMaterial.new(); pm.direction = Vector3(0, 1, 0); pm.spread = 30.0; pm.initial_velocity_min = 1.0; pm.initial_velocity_max = 3.0; pm.scale_min = 1.5; pm.scale_max = 3.5; p.process_material = pm
	var q := QuadMesh.new(); q.size = Vector2(0.7, 0.7)
	var qm := StandardMaterial3D.new(); qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; qm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	qm.albedo_color = Color(1.6, 0.6, 0.15, 0.6); q.material = qm; p.draw_pass_1 = q; s.root.add_child(p)

static func _finish() -> void:
	print("FLEET DONE")
	on = false; _parapet(false); g.objective("")
	for s in ships: if is_instance_valid(s.root): s.root.queue_free()
	ships = []
	if done_cb.is_valid(): done_cb.call()
