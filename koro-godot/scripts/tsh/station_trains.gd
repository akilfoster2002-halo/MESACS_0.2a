## THE HALL WIDER, AND TRAINS THROUGH IT. The station had one track sunk beside its platform, a car parked on it and
## walls at both ends. This, on the station once it is built (before StationLook ages it):
##   · the far wall 6 m further out, a second track, both tracks raised to the platform's level and the barrier
##     between gone — one floor, platform and tracks, to fight across;
##   · the end walls opened over the tracks into tunnels, dark;
##   · the parked car (Kai and Maya come out of it) pulls out into the tunnel when the fight starts (depart());
##   · then TRAINS, on either track, through at speed: first the rails sing and its light grows in the tunnel and its
##     horn goes, then it is through — and anyone on that track when it passes is dead (her, Kai, Maya, anyone);
##   · torn, faded posters on the walls (the station's own, and more on the new wall).
##   StationTrains.build(g, sub, spots)   tick(g, dt) each frame
class_name StationTrains
extends RefCounted

const WIDEN := 6.0                       # metres the far wall goes out
const X_OLD := 529.0                     # the far wall's inner face, as it was
const TRACKS := [526.0, 532.0]           # the two tracks' middles
const HALF := 1.55                       # half a train's width
const Z_IN := -88.3; const Z_OUT := -128.3
const SPEED := 34.0                      # metres a second
const CAR := 15.0; const CARS := 4
static var parked: Node3D
static var gone := false
static var departing := 0.0
static var trains: Array = []            # {node, track, z, dir, warn, light}
static var next := 4.0
static var g

static func _near(a: float, b: float, e := 0.15) -> bool: return absf(a - b) < e

static func build(game, sub: Node3D, spots: Dictionary) -> void:
	g = game
	var dark := StandardMaterial3D.new(); dark.albedo_color = Color(0.05, 0.05, 0.05); dark.roughness = 0.95
	var meshes: Array = sub.find_children("*", "MeshInstance3D", true, false)
	parked = Node3D.new(); parked.name = "ParkedCar"; sub.add_child(parked)
	var sleepers: Array = []
	for mi in meshes:
		var a: AABB = mi.global_transform*mi.get_aabb()
		var x0 := a.position.x; var x1 := a.end.x; var y0 := a.position.y; var y1 := a.end.y
		var inhall := a.position.z > Z_OUT - 0.5 and a.end.z < Z_IN + 0.5
		# the far wall out
		if inhall and x0 > X_OLD - 0.1 and x1 < X_OLD + 0.5 and a.size.y > 4: mi.global_position.x += WIDEN; continue
		# what spans to the far wall (the ceiling, the track bed): stretched out to it
		if _near(x1, X_OLD + 0.3, 0.2) or _near(x1, X_OLD, 0.1):
			if a.size.z < 1.0 and (absf(a.position.z - Z_IN) < 0.6 or absf(a.end.z - Z_OUT) < 0.6):
				# an end wall: cut back to the platform's edge (the rest is the tunnel's mouth)
				if x0 < 523.0:
					var k := (523.0 - x0)/a.size.x; mi.global_transform = _scale_x(mi.global_transform, x0, k)
					_lintel(sub, a, dark)
				else: mi.visible = false; _lintel(sub, a, dark)
				continue
			var k2 := (x1 + WIDEN - x0)/a.size.x; mi.global_transform = _scale_x(mi.global_transform, x0, k2)
			if y1 < -0.5: mi.global_position.y += 1.18      # the track bed up to the platform
			continue
		# the tracks' parts, sunk: up to the floor; the sleepers and rails copied for the second track
		if inhall and x0 > 523.0 and x1 < X_OLD and y1 < -0.5:
			mi.global_position.y += 1.18; sleepers.append(mi); continue
		# the parked car: everything between the platform's edge and the old wall, above the floor
		if inhall and x0 > 523.2 and x1 < X_OLD - 0.2 and y1 > -0.2:
			var t: Transform3D = mi.global_transform; mi.get_parent().remove_child(mi); parked.add_child(mi); mi.global_transform = t
			var m = mi.get_active_material(0)
			if m is StandardMaterial3D and m.emission_enabled:     # its windows: dark and filthy now
				var dm := (m as StandardMaterial3D).duplicate(); dm.emission_energy_multiplier = 0.08; dm.albedo_color = Color(0.05, 0.06, 0.07); mi.material_override = dm
	for s in sleepers:
		var c: MeshInstance3D = s.duplicate(); sub.add_child(c); c.global_transform = s.global_transform; c.global_position.x += TRACKS[1] - TRACKS[0]
	_tunnel(sub, Z_IN, 1.0, dark); _tunnel(sub, Z_OUT, -1.0, dark)
	_solids()
	spots.arena.x2 = X_OLD + WIDEN - 0.6
	_posters(sub, meshes)

static func _scale_x(t: Transform3D, x0: float, k: float) -> Transform3D:
	var o := Transform3D(Basis.from_scale(Vector3(k, 1, 1)), Vector3(x0 - k*x0, 0, 0))
	return o*t
## over a tunnel's mouth: the wall above it, from 5 m up to the ceiling
static func _lintel(sub: Node3D, a: AABB, mat: Material) -> void:
	var w := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(X_OLD + WIDEN + 0.3 - 523.0, a.end.y - 5.0, a.size.z); w.mesh = bm
	var m := StandardMaterial3D.new(); m.albedo_color = Color(0.42, 0.42, 0.4); m.roughness = 0.9; w.material_override = m
	sub.add_child(w); w.global_position = Vector3((523.0 + X_OLD + WIDEN + 0.3)*0.5, (5.0 + a.end.y)*0.5, a.get_center().z)
## a tunnel out of the hall: walls, roof and bed, 60 m of it into the dark
static func _tunnel(sub: Node3D, z: float, dir: float, mat: Material) -> void:
	var t := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(X_OLD + WIDEN - 523.0, 5.0, 60.0); bm.flip_faces = true; t.mesh = bm
	t.material_override = mat; sub.add_child(t)
	t.global_position = Vector3((523.0 + X_OLD + WIDEN)*0.5, 2.5, z + dir*30.2)
## the solids: the barrier between platform and track gone; the far wall out; the end walls' track parts kept (you
## cannot walk into the tunnels), stretched to the new wall
static func _solids() -> void:
	var S: Array = g.boots.solids
	for i in range(S.size() - 1, -1, -1):
		var q: Array = S[i]
		if _near(q[0], 523.0) and _near(q[1], 523.3) and q[2] < -120 and q[3] > -95: S.remove_at(i); continue
		if _near(q[0], X_OLD) and _near(q[1], X_OLD + 0.3) and q[2] < -120: q[0] += WIDEN; q[1] += WIDEN; continue
		if _near(q[1], X_OLD + 0.3) and (absf(q[2] - Z_OUT) < 0.4 or absf(q[3] - Z_IN) < 0.4 or absf(q[2] - Z_IN - 0.0) < 0.4): q[1] += WIDEN

## TORN, FADED POSTERS: the station's own posters, and a row of them on the new wall
const POSTER := """
shader_type spatial;
render_mode cull_disabled, depth_prepass_alpha;
uniform sampler2D tex : source_color, filter_linear_mipmap;
uniform sampler2D noise : filter_linear_mipmap, repeat_enable;
uniform float seed = 0.0;
void fragment(){
	vec2 uv = UV;
	vec3 c = texture(tex, uv).rgb;
	float n = texture(noise, uv*1.3 + seed).r;
	float f = texture(noise, uv*6.0 + seed*2.0).r;
	// faded: washed toward the paper, yellowed, its colour gone thin
	float l = dot(c, vec3(0.3, 0.59, 0.11));
	c = mix(c, vec3(l), 0.55);
	c = mix(c, vec3(0.78, 0.72, 0.58), 0.45);
	c *= mix(0.55, 1.0, n);                                  // damp and dirt
	c *= 1.0 - smoothstep(0.75, 1.0, uv.y)*0.4*n;            // dirt run down from the top
	// torn: the edges eaten, a corner gone, a strip ripped off
	float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
	float tear = edge*6.0 + (n - 0.5)*0.9 + (f - 0.5)*0.25;
	float corner = length(uv - vec2(fract(seed*3.7) > 0.5 ? 1.0 : 0.0, 1.0)) - (0.25 + 0.2*fract(seed*7.1)) + (f - 0.5)*0.1;
	float strip = abs(uv.x - fract(seed*5.3)) - 0.06 - (f - 0.5)*0.05;
	if (tear < 0.12 || corner < 0.0 || (strip < 0.0 && uv.y < 0.55 + 0.3*fract(seed*2.3))) discard;
	// where it is torn, the paper's white core shows at the edge
	c = mix(vec3(0.85, 0.82, 0.74), c, smoothstep(0.12, 0.2, tear));
	ALBEDO = c; ROUGHNESS = 0.92;
}
"""
static func _posters(sub: Node3D, meshes: Array) -> void:
	var sh := Shader.new(); sh.code = POSTER
	var nt := NoiseTexture2D.new(); var fn := FastNoiseLite.new(); fn.frequency = 0.02; fn.fractal_octaves = 5; nt.noise = fn; nt.seamless = true; nt.width = 256; nt.height = 256
	var texs: Array = []
	var i := 0
	for mi in meshes:
		var m = mi.get_active_material(0)
		if m is StandardMaterial3D and m.albedo_texture and String(m.albedo_texture.resource_path).get_file().begins_with("sub_") and int(String(m.albedo_texture.resource_path).get_file().trim_prefix("sub_").get_basename()) >= 37:
			var pm := ShaderMaterial.new(); pm.shader = sh; pm.set_shader_parameter("tex", m.albedo_texture); pm.set_shader_parameter("noise", nt); pm.set_shader_parameter("seed", i*0.173 + 0.05)
			mi.material_override = pm; texs.append(m.albedo_texture); i += 1
	# the new wall: a row of them, at a poster's height, some crooked
	var rng := RandomNumberGenerator.new(); rng.seed = 404
	var z := -92.0
	while z > -125.0 and texs.size():
		var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(1.0, 1.4)*rng.randf_range(0.9, 1.3); q.mesh = qm
		var pm2 := ShaderMaterial.new(); pm2.shader = sh; pm2.set_shader_parameter("tex", texs[rng.randi() % texs.size()]); pm2.set_shader_parameter("noise", nt); pm2.set_shader_parameter("seed", rng.randf()*9.0)
		q.material_override = pm2; sub.add_child(q)
		q.global_position = Vector3(X_OLD + WIDEN - 0.02, rng.randf_range(1.3, 1.9), z); q.rotation = Vector3(0, -PI/2, rng.randf_range(-0.08, 0.08))
		z -= rng.randf_range(1.6, 4.5)

## the car pulls out: slow, then away into the tunnel
static func depart() -> void:
	if gone or parked == null: return
	gone = true; departing = 0.001
	g.cue("thud")

static func tick(dt: float) -> void:
	if g == null or parked == null or not g.sub.visible: return
	if departing > 0:
		departing += dt
		parked.position.z = -0.6*departing*departing*departing      # creeping, then going
		if parked.position.z < -80: parked.visible = false; departing = 0.0
	var live: bool = gone and g.mode == "fight" or (g.station and g.station.B != null)
	if live and trains.is_empty():
		next -= dt
		if next <= 0: _send(); next = randf_range(6.0, 12.0)
	for tr in trains.duplicate():
		tr.t += dt
		if tr.t < tr.warn:                                   # coming: its light in the tunnel, the rails, the horn
			var k: float = tr.t/tr.warn
			tr.light.light_energy = 1.0 + 9.0*k*k
			tr.light.global_position = Vector3(tr.x, 1.2, tr.z0 + tr.dir*lerpf(-40.0, -1.0, k))
			if k > 0.35 and not tr.horn: tr.horn = true; g.cue("horn")
			if g.station and randf() < dt*k*8: g.station.shake(0.05 + 0.15*k, 0.2)
			continue
		tr.z += tr.dir*SPEED*dt
		tr.node.global_position.z = tr.z
		tr.light.global_position = Vector3(tr.x, 1.2, tr.z + tr.dir*0.3)
		if g.station: g.station.shake(0.35, 0.2)
		_hits(tr)
		if (tr.dir < 0 and tr.z < Z_OUT - CAR*CARS - 5) or (tr.dir > 0 and tr.z > Z_IN + CAR*CARS + 5):
			tr.node.queue_free(); tr.light.queue_free(); trains.erase(tr)

static func _send() -> void:
	var k := randi() % 2; var x: float = TRACKS[k]
	var dir := -1.0 if randf() < 0.5 else 1.0
	var z0 := Z_IN + 30.0 if dir < 0 else Z_OUT - 30.0      # its nose starts in the tunnel
	var n := _train(); g.sub.add_child(n); n.global_position = Vector3(x, 0, z0); n.rotation.y = 0.0 if dir < 0 else PI
	var l := SpotLight3D.new(); l.light_color = Color(1, 0.92, 0.75); l.spot_range = 45; l.spot_angle = 28; l.shadow_enabled = true; l.light_volumetric_fog_energy = 1.2; g.sub.add_child(l)
	l.rotation.y = 0.0 if dir < 0 else PI                    # its beam ahead of it, down the track
	trains.append({"node": n, "light": l, "x": x, "z": z0, "z0": z0, "dir": dir, "t": 0.0, "warn": 2.6, "horn": false})
	if g.fight and g.fight.fx and absf(g.robin.position.x - x) < 6.0: g.fight.fx.sense(Vector3(x, 1.5, z0))      # near its track: she feels it coming
	g.cue("rise")

## a train: four cars, dark and dirty, lit windows going by, headlights at its nose (it runs toward -z; its nose at z)
static func _train() -> Node3D:
	var root := Node3D.new()
	var body := StandardMaterial3D.new(); body.albedo_color = Color(0.3, 0.31, 0.33); body.metallic = 0.35; body.roughness = 0.5
	var win := StandardMaterial3D.new(); win.albedo_color = Color(1, 0.9, 0.7); win.emission_enabled = true; win.emission = Color(1, 0.88, 0.65); win.emission_energy_multiplier = 6.0
	var stripe := StandardMaterial3D.new(); stripe.albedo_color = Color(0.75, 0.12, 0.08); stripe.roughness = 0.5
	var head := StandardMaterial3D.new(); head.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; head.albedo_color = Color(4, 3.8, 3.2)
	for c in CARS:
		var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(HALF*2, 3.3, CAR - 0.6); b.mesh = bm; b.material_override = body
		b.position = Vector3(0, 1.8, c*CAR + CAR*0.5); root.add_child(b)
		for side in [-1.0, 1.0]:
			var w := MeshInstance3D.new(); var wm := BoxMesh.new(); wm.size = Vector3(0.02, 0.8, CAR - 3.0); w.mesh = wm; w.material_override = win
			w.position = Vector3(side*(HALF + 0.01), 2.2, c*CAR + CAR*0.5); root.add_child(w)
			var st := MeshInstance3D.new(); var sbm := BoxMesh.new(); sbm.size = Vector3(0.02, 0.18, CAR - 0.6); st.mesh = sbm; st.material_override = stripe
			st.position = Vector3(side*(HALF + 0.012), 1.3, c*CAR + CAR*0.5); root.add_child(st)
		var il := OmniLight3D.new(); il.light_color = Color(1, 0.88, 0.65); il.light_energy = 0.8; il.omni_range = 3.5; il.light_volumetric_fog_energy = 0.0; il.position = Vector3(0, 2.2, c*CAR + CAR*0.5); root.add_child(il)
	for sx in [-0.9, 0.9]:
		var h := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.16; sm.height = 0.32; h.mesh = sm; h.material_override = head
		h.position = Vector3(sx, 1.0, -0.02); root.add_child(h)
	return root

## anyone on its track as it goes by: dead
static func _hits(tr: Dictionary) -> void:
	var lo := minf(tr.z, tr.z - tr.dir*CAR*CARS); var hi := maxf(tr.z, tr.z - tr.dir*CAR*CARS)
	var on := func(x: float, z: float) -> bool: return absf(x - tr.x) < HALF + 0.35 and z > lo and z < hi
	var p: Vector3 = g.robin.position
	if on.call(p.x, p.z):
		g.cue("boom"); g.station.flash(0.8, Color(1, 1, 1)); g.station.shake(1.0, 0.8)
		if g.fight.on: g.fight.R.hp = 0.0
		if g.station.B != null: g.station.B.hp = 0.0
		g.robin.position.x = tr.x + (-HALF - 1.2 if p.x < tr.x else HALF + 1.2)      # thrown clear of it, dead
	for e in g.fight.E:
		if g.fight.standing(e) and on.call(e.x, e.z):
			e.hp = 0.0; g.cue("boom")
			g.fight.throw_off(e, 0.0 if tr.dir > 0 else PI, 14.0, 1.4)
