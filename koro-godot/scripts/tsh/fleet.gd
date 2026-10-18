## THE FLEET: before the Director comes down herself, WFC's fighters (wfc/fighter.glb, the user's model) come up round
## the Meridian Tower's roof. Robin is on her own feet up there. They circle; one at a time they make a run at her — a red
## line across the roof, then the guns walk it — and after a run the ship is spent: it sinks to the roof's edge, smoking,
## its guns cycling, for a few seconds. Get to it and press E (or click): she goes up onto it and brings it down. All
## five down, and the Director comes for her herself (station.gd boss_scene).
##   Fleet.begin(g, done)   Fleet.tick(g, dt)   Fleet.key(g, ev)   Fleet.on, Fleet.hp
class_name Fleet
extends RefCounted

const N := 3
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
	var mz := []
	for side in [-1.0, 1.0]:                                     # the two nose guns' muzzles
		var l := OmniLight3D.new(); l.light_color = Color(1.0, 0.7, 0.3); l.omni_range = 7; l.light_energy = 0.0; l.position = Vector3(side*0.75, 0.1, 3.3); holder.add_child(l)
		var fl := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.28; sm.height = 0.56; fl.mesh = sm
		var fm := StandardMaterial3D.new(); fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; fm.albedo_color = Color(3.0, 1.8, 0.6); fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; fl.material_override = fm; fl.visible = false; l.add_child(fl)
		mz.append({"l": l, "f": fl})
	return {"root": root, "holder": holder, "nav": nav, "mz": mz}

static func begin(game, cb: Callable) -> void:
	g = game; done_cb = cb; on = true; g.boots.vertical_only = true; hp = 100.0; next_run = 4.0; busy = false; fx = g.fight
	for s in ships: if is_instance_valid(s.root): s.root.queue_free()
	ships = []
	var tc: Vector2 = Tower.C; var T: float = Tower.TOP
	for i in N:
		var d := _model(g.city); var a := i*TAU/N + 0.3
		d.merge({"state": "orbit", "t": 0.0, "a": a, "y": T + 8.0 + i*1.3, "line": null, "hit": false, "smoke": null, "mark": null, "i": i})
		d.root.position = Vector3(tc.x + cos(a)*R_ORBIT, T - 14, tc.y + sin(a)*R_ORBIT)
		ships.append(d)
	_parapet(true)
	if gs.is_empty() or not is_instance_valid(gs.rig):
		var rig := GunshipRig.make(g.city); rig.position = Vector3(tc.x, T + 40.0, tc.y - 30.0)
		gs = {"rig": rig, "a": 0.0, "line": null, "next": 6.0}
	else: gs.line = null; gs.next = 6.0

## a wall round the roof while they are up, so she can't run off it
static var walls: Array = []
static func _parapet(v: bool) -> void:
	var tc: Vector2 = Tower.C; var H: float = Tower.HALF; var T: float = Tower.TOP
	if v and walls.is_empty():
		for w in [[tc.x - H - 1, tc.x + H + 1, tc.y - H - 1, tc.y - H + 0.3], [tc.x - H - 1, tc.x + H + 1, tc.y + H - 0.3, tc.y + H + 1],
				[tc.x - H - 1, tc.x - H + 0.3, tc.y - H - 1, tc.y + H + 1], [tc.x + H - 0.3, tc.x + H + 1, tc.y - H - 1, tc.y + H + 1]]:
			var s := [w[0], w[1], w[2], w[3], T - 1.0, T + 0.9, ""]; g.boots.solids.append(s); walls.append(s)
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
	_tick_tracers(dt)
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
				s.cool = float(s.get("cool", randf_range(1.0, 4.0))) - dt
				var firing := ships.filter(func(q): return q.state == "burst").size()
				if s.cool <= 0 and firing < 2 and not busy and root.position.y > T:
					var tcv := Vector2(tc.x, tc.y); var dv := (Vector2(root.position.x, root.position.z) - tcv).normalized()
					s.hold = Vector3(tc.x + dv.x*(Tower.HALF + 10.0), T + 7.0, tc.y + dv.y*(Tower.HALF + 10.0))
					s.state = "burst"; s.t = 0.0; s.acc = 0.0
			"burst":                                              # hanging there, both guns on her
				root.position = root.position.lerp(s.hold, minf(1, dt*2.5))
				_face(s, rp, dt*2.0)
				var mzp: Vector3 = (s.mz[0].l as OmniLight3D).global_position.lerp((s.mz[1].l as OmniLight3D).global_position, 0.5)
				if s.t < 0.75:                                         # the lock: a red line on her, flickering faster — her cue to move
					var fl: bool = fmod(s.t*(10.0 + s.t*30.0), 1.0) < 0.6
					Director._beam(fx, "aim%d" % s.i, mzp, rp + Vector3(0, 1.0, 0), 0.025, Color(3, 0.1, 0.08, 0.85 if fl else 0.3), true)
					if not s.get("locked", false): s.locked = true; g.cue("beep")
				else: Director._beam(fx, "aim%d" % s.i, mzp, rp, 0.02, Color.BLACK, false)
				if s.t > 0.75 and s.t < 1.85:
					if not s.get("fired", false): s.fired = true; g.cue("gun")
					_rounds(s, rp, dt)
				else: _muzzles_off(s)
				if s.t >= 2.2:
					s.fired = false; s.locked = false; _muzzles_off(s); s.bursts = int(s.get("bursts", 0)) + 1
					if s.bursts >= 2:                                 # its guns too hot: down it goes to the edge, smoking
						s.state = "spent"; s.t = 0.0; s.bursts = 0
						var d := (Vector2(rp.x, rp.z) - tc).normalized() if (Vector2(rp.x, rp.z) - tc).length() > 1 else Vector2(1, 0)
						d = d.rotated(randf_range(-0.6, 0.6))
						s.home = Vector3(tc.x + d.x*(Tower.HALF + 2.6), T - 0.1, tc.y + d.y*(Tower.HALF + 2.6)); s.hp = 5
						_spent(s, true)
					else: s.state = "orbit"; s.t = 0.0; s.cool = randf_range(2.5, 4.5)
			"spent":                                              # down at the edge, smoking: jump on and break it
				root.position = root.position.lerp(s.home, minf(1, dt*3.0))
				_face(s, Vector3(tc.x, T, tc.y), dt)
				s.holder.rotation.z = lerpf(s.holder.rotation.z, 0.0, minf(1, dt*6)) + sin(s.t*9.0)*0.02
				_deck(s, true)
				var on_it := _on(s)
				if s.mark:
					s.mark.global_position = root.global_position + Vector3(0, 3.2, 0)
					s.mark.text = "CLICK" if on_it else "JUMP ON"
					s.mark.visible = Vector2(rp.x - root.position.x, rp.z - root.position.z).length() < 12.0
				var limit := 9.0 if on_it else 6.0
				if s.t > limit:                                     # it gets its engines back: off it she goes, and it climbs away
					if on_it: _throw_off(s)
					_deck(s, false); _spent(s, false); s.state = "orbit"; s.t = 0.0
			"falling":
				s.v.y -= 14.0*dt; root.position += s.v*dt; root.rotation += Vector3(1.4, 2.2, 0.6)*dt
				if root.position.y < T - 120: s.state = "dead"; root.queue_free()
	if g.autopilot and not busy and ships.filter(func(q): return q.state == "spent").is_empty():      # -- auto: she keeps moving
		var a2 := Time.get_ticks_msec()/1000.0*0.6; var to2 := Vector3(tc.x + cos(a2)*12.0, T, tc.y + sin(a2)*12.0)
		g.robin.position = g.robin.position.lerp(to2, minf(1, dt*1.5)); g.boots.x = g.robin.position.x; g.boots.z = g.robin.position.z
	if g.autopilot and not busy:                                  # -- auto: she goes for the spent ones herself
		for s in ships:
			if s.state == "spent" and s.t > 1.2:
				if not _on(s): var p: Vector3 = s.root.position; g.place(p + Vector3(0, DECK_Y, 0), 0.0)
				elif fmod(s.t, 0.35) < dt: _strike(s)
				break
	_tick_gunship(dt)
	var left2 := alive().size()
	g.objective("Bring them down — %d left" % left2, ["Keep moving. Smoking at the edge: jump on, CLICK"])
	if left2 == 0 and not busy: _finish()

## a round in flight: a hot streak from the muzzle to where it lands
static func _tracer(from: Vector3, to: Vector3, live := false) -> void:
	var tr := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.06, 0.06, 2.6); tr.mesh = bm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(3.2, 2.2, 0.7); tr.material_override = m
	tr.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; g.add_child(tr)
	tr.global_position = from; tr.look_at(to, Vector3.UP)
	tracers.append({"n": tr, "a": from, "b": to, "t": 0.0, "live": live, "speed": BULLET/maxf(1.0, from.distance_to(to))})
static func _tick_tracers(dt: float) -> void:
	grace -= dt
	var keep := []
	var rp: Vector3 = g.robin.position + Vector3(0, 1.0, 0)
	for q in tracers:
		q.t += dt*float(q.get("speed", 7.0))
		if q.t >= 1.0 or not is_instance_valid(q.n):
			if is_instance_valid(q.n): q.n.queue_free()
			if q.get("live", false):
				Director._splash(fx, q.b)
				if randf() < 0.3: Director._scar(fx, q.b)
				if randf() < 0.3 and g.fight.fx: g.fight.fx.sparks(q.b + Vector3(0, 0.1, 0), Vector3(randf_range(-0.3, 0.3), 1, randf_range(-0.3, 0.3)), 0.5)
		else:
			var p: Vector3 = (q.a as Vector3).lerp(q.b, q.t); q.n.global_position = p
			if q.get("live", false) and Vector2(p.x - rp.x, p.z - rp.z).length() < 0.5 and p.y < rp.y + 0.9 and p.y > rp.y - 1.1 and not busy:      # it found her
				q.live = false; q.t = 1.0
				if grace <= 0: grace = 0.35; hurt(3.0); struck(p, (q.b as Vector3) - (q.a as Vector3))
			keep.append(q)
	tracers = keep
static func _muzzles_off(s: Dictionary) -> void:
	for m in s.get("mz", []): m.l.light_energy = 0.0; m.f.visible = false

static func _face(s: Dictionary, at: Vector3, dt: float) -> void:
	var root: Node3D = s.root; var d := at - root.position
	if Vector2(d.x, d.z).length() > 0.5: root.rotation.y = lerp_angle(root.rotation.y, atan2(d.x, d.z), minf(1, dt*3))

const BULLET := 32.0                     # metres a second: quick, but she can get out of its way
static var tracers: Array = []
static var grace := 0.0                # after a round finds her, a beat before the next can
## THE BIG ONE: the gunship over the roof, and only it lays the red lines and walks its guns down them
static var gs := {}
static func _tick_gunship(dt: float) -> void:
	if gs.is_empty() or busy: return
	var T: float = Tower.TOP; var tc: Vector2 = Tower.C; var rp: Vector3 = g.robin.position
	var rig: GunshipRig = gs.rig
	if gs.line == null:
		gs.a += dt*0.08
		rig.position = rig.position.lerp(Vector3(tc.x + cos(gs.a)*24.0, T + 16.0, tc.y + sin(gs.a)*24.0), minf(1, dt*1.5))
		rig.rotation.y = lerp_angle(rig.rotation.y, atan2(rp.x - rig.position.x, rp.z - rig.position.z), minf(1, dt*2))
		rig.aim_at = rp + Vector3(0, 1, 0); rig.firing = false
		gs.next -= dt
		if gs.next <= 0:
			var a := randf()*TAU; var dir := Vector3(sin(a), 0, cos(a)); var c := Vector3(rp.x, T + 0.03, rp.z)
			gs.line = {"a": c - dir*16.0, "b": c + dir*16.0, "dir": dir, "t": 0.0, "hit": false, "acc": 0.0}; g.cue("alarm")
		return
	var S: Dictionary = gs.line; S.t += dt
	var warn := 1.2; var run := 0.8
	var k := clampf((S.t - warn)/run, 0, 1); var head: Vector3 = (S.a as Vector3).lerp(S.b, k)
	rig.position = rig.position.lerp(head + Vector3(0, 13, 0) - S.dir*7.0, minf(1, dt*2.5))
	rig.rotation.y = lerp_angle(rig.rotation.y, atan2(S.dir.x, S.dir.z), minf(1, dt*3))
	rig.aim_at = head
	if S.t < warn:
		var pulse := 0.5 + 0.5*sin(S.t*(18.0 + S.t*30.0))
		Director._beam(fx, "gsline", S.a, S.b, 0.12 + 0.3*pulse, Color(2.5, 0.1, 0.05, 0.25 + 0.55*pulse), true)
		Director._reticle(fx, S, true, S.t/warn)
		return
	Director._reticle(fx, S, false, 1.0)
	Director._beam(fx, "gsline", S.a, S.b, 0.3, Color(2.5, 0.1, 0.05, 0.12), true)
	rig.firing = true
	if not S.get("fired", false): S.fired = true; g.cue("gun")
	S.acc += dt
	while S.acc > 0.025:
		S.acc -= 0.025
		var at := head + Vector3(randf_range(-0.6, 0.6), 0.02, randf_range(-0.6, 0.6))
		Director._splash(fx, at)
		if randf() < 0.35: Director._scar(fx, at)
		if randf() < 0.4 and g.fight.fx: g.fight.fx.sparks(at + Vector3(0, 0.1, 0), Vector3(randf_range(-0.3, 0.3), 1, randf_range(-0.3, 0.3)), 0.6)
	g.station.shake(0.22, 0.08)
	if not S.hit and Vector2(rp.x - head.x, rp.z - head.z).length() < 1.3 and rp.y < T + 1.5:
		S.hit = true; hurt(14.0); struck(rp + Vector3(0, 1.0, 0), Vector3(0, -1, 0))
		var push := (Vector2(rp.x, rp.z) - Vector2(head.x, head.z)).normalized()
		g.boots.vx = push.x*9; g.boots.vz = push.y*9; g.boots.vy = 6; g.boots.ground = false; g.boots.state = "air"
	if k >= 1.0:
		Director._beam(fx, "gsline", S.a, S.b, 0.3, Color.BLACK, false); rig.firing = false
		gs.line = null; gs.next = randf_range(5.5, 8.0)
static func _rounds(s: Dictionary, head: Vector3, dt: float) -> void:
	s.acc = float(s.get("acc", 0.0)) + dt
	for m in s.mz:                                               # the muzzles flashing
		var on_: bool = randf() < 0.65
		m.l.light_energy = randf_range(4, 9) if on_ else 0.0; m.f.visible = on_; m.f.scale = Vector3.ONE*randf_range(0.6, 1.3)
	while s.acc > 0.09:
		s.acc -= 0.09
		var mzp: Vector3 = (s.mz[0].l as OmniLight3D).global_position
		var fly := mzp.distance_to(head)/BULLET                      # where she will be when it gets there, if she keeps on as she is
		var lead := Vector3(g.boots.vx, 0, g.boots.vz)*fly
		var m: Dictionary = s.mz[randi() % s.mz.size()]
		var from := (m.l as OmniLight3D).global_position
		var to := Vector3(head.x, Tower.TOP + 0.02, head.z) + lead + Vector3(randf_range(-0.35, 0.35), 0, randf_range(-0.35, 0.35))      # down into the deck at her feet
		_tracer(from, to, true)
	g.station.shake(0.06, 0.05)

static func _spent(s: Dictionary, v: bool) -> void:
	if v:
		var p := GPUParticles3D.new(); p.amount = 60; p.lifetime = 1.6; p.local_coords = false
		var pm := ParticleProcessMaterial.new(); pm.direction = Vector3(0, 1, 0); pm.spread = 20.0; pm.initial_velocity_min = 1.0; pm.initial_velocity_max = 2.5
		pm.gravity = Vector3(0, 1.2, 0); pm.scale_min = 1.5; pm.scale_max = 3.0; p.process_material = pm
		var q := QuadMesh.new(); q.size = Vector2(0.6, 0.6)
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.albedo_color = Color(0.08, 0.08, 0.09, 0.55); q.material = m; p.draw_pass_1 = q
		s.root.add_child(p); s.smoke = p
		var mk := Label3D.new(); mk.text = "JUMP ON"; mk.font_size = 64; mk.font_size = 96; mk.outline_size = 18; mk.modulate = Color("#ffd23d"); mk.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		mk.no_depth_test = true; g.add_child(mk); s.mark = mk
		s.nav.light_color = Color(1.0, 0.55, 0.1)
	else:
		if s.smoke and is_instance_valid(s.smoke): s.smoke.queue_free()
		if s.mark and is_instance_valid(s.mark): s.mark.queue_free()
		s.smoke = null; s.mark = null; s.nav.light_color = Color(1, 0.2, 0.15)

## A ROUND FINDS HER: a flash and sparks where it lands on her, her whole body flashing red, a flinch and a step back,
## the screen's edge pulsing red
static var tint: StandardMaterial3D
static var edge: ColorRect
static func struck(at: Vector3, dir: Vector3) -> void:
	g.cue("hurt"); g.cue("punch")
	if g.fight.fx: g.fight.fx.sparks(at, -dir.normalized() + Vector3.UP*0.3, 1.3)
	var fl := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.25; sm.height = 0.5; fl.mesh = sm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(3.0, 1.6, 0.6, 1.0); fl.material_override = m; g.add_child(fl); fl.global_position = at
	var tw: Tween = g.create_tween(); tw.tween_property(fl, "scale", Vector3.ONE*2.2, 0.12); tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.12); tw.tween_callback(fl.queue_free)
	# her body red, a moment
	if tint == null:
		tint = StandardMaterial3D.new(); tint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; tint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		tint.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; tint.albedo_color = Color(1.0, 0.1, 0.05, 0.0)
	for mi in g.model.find_children("*", "MeshInstance3D", true, false): (mi as MeshInstance3D).material_overlay = tint
	tint.albedo_color.a = 0.75
	var tw2: Tween = g.create_tween(); tw2.tween_property(tint, "albedo_color:a", 0.0, 0.35)
	# a flinch, a step back
	var ap: AnimationPlayer = g.anim
	if ap.has_animation("hit"): ap.play("hit", 0.03, 1.6)
	var d := Vector2(dir.x, dir.z).normalized()
	g.boots.vx += d.x*4.0; g.boots.vz += d.y*4.0
	# the edge of the screen, red
	if edge == null or not is_instance_valid(edge):
		var layer := CanvasLayer.new(); layer.layer = 19; g.add_child(layer)
		edge = ColorRect.new(); edge.set_anchors_preset(Control.PRESET_FULL_RECT); edge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var sh := Shader.new(); sh.code = "shader_type canvas_item; uniform float a = 0.0; void fragment() { vec2 c = UV - 0.5; float v = smoothstep(0.25, 0.75, length(c*vec2(1.0, 1.3))); COLOR = vec4(0.9, 0.02, 0.02, v*a); }"
		var sm2 := ShaderMaterial.new(); sm2.shader = sh; edge.material = sm2; layer.add_child(edge)
	(edge.material as ShaderMaterial).set_shader_parameter("a", 0.85)
	var tw3: Tween = g.create_tween(); tw3.tween_method(func(v): (edge.material as ShaderMaterial).set_shader_parameter("a", v), 0.85, 0.0, 0.45)
static func hurt(n: float) -> void:
	hp -= n; g.station.shake(0.45 if n > 5 else 0.25, 0.25)
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
	for s in ships:
		if s.state == "spent" and _on(s): _strike(s); return true
	return false

const DECK_Y := 1.45                       # her feet on its back, above where it hangs
## a floor on its back while it is down, so she can stand on it
static func _deck(s: Dictionary, v: bool) -> void:
	if s.get("plat") != null: g.boots.plats.erase(s.plat); s.plat = null
	if not v: return
	var p: Vector3 = s.root.position
	s.plat = [p.x - 2.2, p.x + 2.2, p.z - 2.2, p.z + 2.2, p.y + DECK_Y]; g.boots.plats.append(s.plat)
static func _on(s: Dictionary) -> bool:
	var rp: Vector3 = g.robin.position; var p: Vector3 = s.root.position
	return absf(rp.x - p.x) < 2.4 and absf(rp.z - p.z) < 2.4 and absf(rp.y - (p.y + DECK_Y)) < 0.6
## a blow into its back: it rocks, sparks, a piece of it gone; the fifth breaks it
static func _strike(s: Dictionary) -> void:
	var ap: AnimationPlayer = g.anim
	var clip: String = ["jab", "cross", "hook", "kick"][(5 - int(s.hp)) % 4]
	if ap.has_animation(clip): ap.play(clip, 0.05, 1.6)
	s.hp = int(s.hp) - 1; s.t = minf(s.t, 4.0)                 # (keeping at it buys time)
	var at: Vector3 = s.root.position + Vector3(0, DECK_Y - 0.2, 0)
	g.cue("punch"); g.station.shake(0.35, 0.15)
	if g.fight.fx: g.fight.fx.sparks(at, Vector3(randf_range(-0.5, 0.5), 1, randf_range(-0.5, 0.5)), 1.4)
	s.holder.rotation.z = randf_range(-0.18, 0.18); s.holder.rotation.x = randf_range(-0.1, 0.1)
	if s.hp <= 0: _destroy(s)
## it goes: the blast, she is thrown back onto the roof, it falls burning
static func _destroy(s: Dictionary) -> void:
	_boom(s); _deck(s, false); _spent(s, false)
	_throw_off(s)
	s.state = "falling"; s.v = (s.root.position - Vector3(Tower.C.x, s.root.position.y, Tower.C.y)).normalized()*4.0 + Vector3(0, 2, 0)
	g.note("%d left" % alive().size())
static func _throw_off(s: Dictionary) -> void:
	if not _on(s): return
	var rp: Vector3 = g.robin.position; var c := Vector2(Tower.C.x, Tower.C.y)
	var d := (c - Vector2(rp.x, rp.z)).normalized()
	g.boots.vx = d.x*9.0; g.boots.vz = d.y*9.0; g.boots.vy = 7.0; g.boots.ground = false; g.boots.state = "air"

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
	if not gs.is_empty(): Director._beam(fx, "gsline", Vector3.ZERO, Vector3.ONE, 0.3, Color.BLACK, false); if is_instance_valid(gs.rig): gs.rig.queue_free()
	gs = {}
	on = false; g.boots.vertical_only = false; _parapet(false); g.objective("")
	for s in ships: if is_instance_valid(s.root): s.root.queue_free()
	ships = []
	if done_cb.is_valid(): done_cb.call()
