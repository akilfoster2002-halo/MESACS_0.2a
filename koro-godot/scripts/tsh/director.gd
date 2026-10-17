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
static var shots: Array = []     # {node, v, t}

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
	_tick_shots(f, dt)
	match e.state:
		"circle":
			e.rolled = false
			return false
		"approach":
			if not e.get("rolled", false) and f.R.grabbed_by == null:      # each time she comes in: one of her own, or (else) the ordinary blow
				e.rolled = true
				var r := randf()
				if r < 0.4 and d > 2.5:
					e.state = "charge"; e.t = 0.0; f.play(e, "roar", 0.1); f.g.cue("rise"); return true
				if r < 0.75 and not piles.is_empty():
					var best = null; var bd := 1e9
					for pl in piles:
						var dd: float = Vector2(pl.at.x - e.x, pl.at.z - e.z).length()
						if dd < bd: bd = dd; best = pl
					e.state = "to_pile"; e.t = 0.0; e.pile = best; return true
			return false
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
				f._step(e, atan2(dv.x, dv.y), float(e.K.run), dt); f.play(e, "sprint")
			else:
				e.state = "volley"; e.t = 0.0; e.n_shot = 0; e.next_shot = 0.35
			if e.t > 4.0: e.state = "circle"; e.t = 0.0; e.cool = 0.5
			return true
		"volley":
			e.yaw = f.turn_to(e.yaw, to_her, dt*8)
			if e.t >= e.next_shot:
				e.n_shot += 1; e.next_shot = e.t + 0.55
				f.hit1(e, "jab" if e.n_shot % 2 else "cross"); e.anim_k = 1.6
				f.later(0.12, func(): _punch_out(f, e))
			if e.n_shot >= SHOTS and e.t > e.next_shot - 0.1:
				e.state = "recover"; e.t = 0.0; e.anim_k = 1.0
			return true
	return false

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
	if shots.is_empty(): return
	var rp: Vector3 = f.g.robin.position + Vector3(0, 1.0, 0)
	var keep := []
	for s in shots:
		s.t += dt
		var n: MeshInstance3D = s.node
		if not is_instance_valid(n): continue
		n.global_position += s.v*dt; n.rotation += s.spin*dt
		if n.global_position.distance_to(rp) < 0.9 and f.R.iframe <= 0 and f.R.act != "down":
			var h0: float = f.R.hp
			f.hurt(s.e, float(s.e.K.dmg)*0.4)
			if f.R.hp < h0: f.g.cue("boom"); f.shake(0.4, 0.3); f._flash(0.2)
			n.queue_free(); continue
		if s.t > 2.0: n.queue_free(); continue
		keep.append(s)
	shots = keep

static func clear() -> void:
	for s in shots: if is_instance_valid(s.node): s.node.queue_free()
	shots.clear()
	for p in piles: if is_instance_valid(p.node): p.node.queue_free()
	piles.clear()
