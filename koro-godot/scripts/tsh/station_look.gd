## THE OLD HARBOR LANE STATION, ABANDONED. The station came over from the browser in flat colours; this gives every
## surface of it age, and leaves the wreck of years on its platforms:
##   · every material through a grime shader (its own colour or texture kept): mottled dirt, water run down the walls
##     in streaks and a tide line of filth at their foot, grouted tiles on the pale walls (and some of them gone), rust
##     on the metal, and on the floors standing water that holds the lamps in it;
##   · rubble and fallen tiles, newspaper, bin bags, loose cable along the walls, scattered along the platform;
##   · dust in the air where the lamps are;
##   · some of its lamps failing — they flicker (tick()).
##   StationLook.apply(g.sub, spots)  once the station is built;  StationLook.tick(bulbs, dt) with its lamps each frame
class_name StationLook
extends RefCounted

const SHADER := """
shader_type spatial;
render_mode cull_disabled;
uniform vec4 base : source_color = vec4(1.0);
uniform sampler2D tex : source_color, hint_default_white, filter_linear_mipmap, repeat_enable;
uniform bool has_tex = false;
uniform bool metal = false;
uniform sampler2D noise : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform sampler2D fine : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform float tiles = 0.0;
varying vec3 wp;
varying vec3 wn;
void vertex(){
	wp = (MODEL_MATRIX*vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX*vec4(NORMAL, 0.0)).xyz);
}
float tri(sampler2D s, vec3 p, vec3 n, float k){
	vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
	return texture(s, p.zy*k).r*w.x + texture(s, p.xz*k).r*w.y + texture(s, p.xy*k).r*w.z;
}
void fragment(){
	vec3 c = base.rgb;
	if (has_tex) c *= texture(tex, UV).rgb;
	float up = wn.y;
	bool wall = abs(up) < 0.4;
	bool floor_ = up > 0.6;
	float big = tri(noise, wp, wn, 0.09);
	float sm = tri(fine, wp, wn, 0.9);
	float lum = dot(c, vec3(0.3, 0.59, 0.11));
	// dirt: mottled, everywhere, more of it where it is pale
	c *= mix(0.5, 1.0, smoothstep(0.25, 0.8, big*0.6 + sm*0.4))*mix(1.0, 0.82, lum);
	float rough = 0.82 + 0.15*sm;
	if (wall) {
		vec2 hp = abs(wn.x) > abs(wn.z) ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y);
		// tiles, on what was pale: grout, each tile a little different, some gone to the concrete behind
		if (tiles > 0.5 && lum > 0.35) {
			vec2 tc = vec2(hp.x*3.3, hp.y*6.6); vec2 id = floor(tc); vec2 f = fract(tc);
			float h = fract(sin(dot(id, vec2(12.9898, 78.233)))*43758.5453);
			float grout = step(f.x, 0.05) + step(f.y, 0.08);
			c *= 0.88 + 0.16*h;
			c = mix(c, vec3(0.12, 0.12, 0.11), clamp(grout, 0.0, 1.0)*0.75);
			if (h > 0.93 && big > 0.45) c = vec3(0.16, 0.15, 0.14)*(0.7 + 0.5*sm);
			rough = mix(0.35, 0.9, clamp(grout + (1.0 - big), 0.0, 1.0));
		}
		// water down the walls: streaks, long and thin
		float st = texture(fine, vec2(hp.x*1.7, hp.y*0.05)).r;
		float run = smoothstep(0.55, 0.85, st)*smoothstep(0.2, 0.7, big);
		c = mix(c, c*vec3(0.42, 0.38, 0.33), run*0.8);
		// the tide line of filth at their foot
		c *= mix(0.45, 1.0, smoothstep(-0.2, 0.9, wp.y - 0.0 + sm*0.3));
	}
	if (metal) {
		float rust = smoothstep(0.45, 0.8, big*0.5 + sm*0.5);
		c = mix(c, vec3(0.28, 0.12, 0.05)*(0.6 + 0.6*sm), rust*0.75);
		rough = mix(0.45, 0.95, rust);
	}
	float wet = 0.0;
	if (floor_) {
		// standing water: low places, dark and mirror-smooth
		wet = smoothstep(0.58, 0.68, tri(noise, wp + vec3(13.0), wn, 0.05));
		c = mix(c, c*0.35, wet);
		rough = mix(rough, 0.04, wet);
	}
	ALBEDO = c;
	ROUGHNESS = rough;
	METALLIC = metal ? 0.5 : 0.0;
	SPECULAR = mix(0.4, 0.9, wet);
}
"""

static var _cache := {}
static var _shader: Shader
static var _noise: Texture2D
static var _fine: Texture2D
static var dust: GPUParticles3D

static func _tex(freq: float, seed: int) -> Texture2D:
	var n := FastNoiseLite.new(); n.seed = seed; n.frequency = freq; n.fractal_octaves = 5
	var t := NoiseTexture2D.new(); t.width = 512; t.height = 512; t.seamless = true; t.noise = n; t.generate_mipmaps = true
	return t

static func _mat(m: StandardMaterial3D) -> Material:
	if _cache.has(m): return _cache[m]
	var s := ShaderMaterial.new(); s.shader = _shader
	s.set_shader_parameter("base", m.albedo_color)
	if m.albedo_texture: s.set_shader_parameter("tex", m.albedo_texture); s.set_shader_parameter("has_tex", true)
	var c := m.albedo_color; var lum := c.r*0.3 + c.g*0.59 + c.b*0.11
	s.set_shader_parameter("metal", m.metallic > 0.3 or (absf(c.r - c.b) < 0.06 and lum > 0.3 and lum < 0.6 and m.albedo_texture == null))
	s.set_shader_parameter("tiles", 1.0 if lum > 0.55 and m.albedo_texture == null else 0.0)
	s.set_shader_parameter("noise", _noise); s.set_shader_parameter("fine", _fine)
	_cache[m] = s
	return s

static func apply(sub: Node3D, spots: Dictionary) -> void:
	_shader = Shader.new(); _shader.code = SHADER
	_noise = _tex(0.012, 7); _fine = _tex(0.05, 19)
	# every surface: aged, unless it is a light or a screen (those glow and stay as they are)
	for mi in sub.find_children("*", "MeshInstance3D", true, false):
		var nm := String(mi.name)
		if nm.begins_with("sub_bulb") or nm.begins_with("sub_cone") or nm.contains("Led"): continue
		for i in mi.mesh.get_surface_count():
			var m = mi.get_active_material(i)
			if m is StandardMaterial3D and not (m as StandardMaterial3D).emission_enabled and (m as StandardMaterial3D).transparency == BaseMaterial3D.TRANSPARENCY_DISABLED:
				mi.set_surface_override_material(i, _mat(m))
	var root := Node3D.new(); root.name = "Wreck"; sub.add_child(root)
	var A: Dictionary = spots.arena
	_wreck(root, A)
	_air(root, A)
	_spots(root, A)

## the wreck of years: rubble, tiles, paper, bags, cables — mostly at the walls and round the pillars, little in the middle
static func _wreck(root: Node3D, A: Dictionary) -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 1977
	var concrete := StandardMaterial3D.new(); concrete.albedo_color = Color(0.33, 0.32, 0.3); concrete.roughness = 0.95
	var tile := StandardMaterial3D.new(); tile.albedo_color = Color(0.72, 0.7, 0.62); tile.roughness = 0.4
	var paper := StandardMaterial3D.new(); paper.albedo_color = Color(0.62, 0.6, 0.52); paper.roughness = 0.9; paper.cull_mode = BaseMaterial3D.CULL_DISABLED
	var bag := StandardMaterial3D.new(); bag.albedo_color = Color(0.03, 0.03, 0.035); bag.roughness = 0.25; bag.metallic = 0.1
	var cable := StandardMaterial3D.new(); cable.albedo_color = Color(0.04, 0.04, 0.04); cable.roughness = 0.6
	var x1: float = A.x1 - 1.0; var x2: float = A.x2 + 0.6; var z1: float = A.z1 - 8.0; var z2: float = A.z2 + 70.0
	var edge := func() -> Vector3:                      # near a wall, mostly
		var x := rng.randf_range(x1, x2)
		if rng.randf() < 0.7: x = (x1 + rng.randf()*1.6) if rng.randf() < 0.5 else (x2 - rng.randf()*1.6)
		return Vector3(x, 0.0, rng.randf_range(z1, z2))
	# rubble: heaps of broken concrete
	for h in 26:
		var c: Vector3 = edge.call()
		for i in rng.randi_range(5, 14):
			var b := MeshInstance3D.new(); var bm := BoxMesh.new()
			var s := rng.randf_range(0.06, 0.32); bm.size = Vector3(s*rng.randf_range(0.6, 1.6), s*rng.randf_range(0.4, 1.0), s*rng.randf_range(0.6, 1.5)); b.mesh = bm
			b.material_override = concrete
			b.position = c + Vector3(rng.randf_range(-0.6, 0.6), s*0.3, rng.randf_range(-0.6, 0.6))
			b.rotation = Vector3(rng.randf_range(-0.5, 0.5), rng.randf()*TAU, rng.randf_range(-0.5, 0.5)); root.add_child(b)
	# fallen tiles, flat on the floor, some broken
	for i in 90:
		var t := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.15, 0.012, 0.075)*rng.randf_range(0.5, 1.0); t.mesh = bm
		t.material_override = tile; var p: Vector3 = edge.call(); t.position = p + Vector3(0, 0.006, 0); t.rotation.y = rng.randf()*TAU; root.add_child(t)
	# paper: newspaper, flyers, in drifts
	for i in 60:
		var q := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(rng.randf_range(0.18, 0.42), rng.randf_range(0.22, 0.5)); q.mesh = pm
		q.material_override = paper; q.position = Vector3(rng.randf_range(x1, x2), 0.01, rng.randf_range(z1, z2))
		q.rotation = Vector3(rng.randf_range(-0.15, 0.15), rng.randf()*TAU, rng.randf_range(-0.15, 0.15)); root.add_child(q)
	# bin bags, slumped against the walls
	for i in 12:
		var g0 := MeshInstance3D.new(); var sm := SphereMesh.new(); var r := rng.randf_range(0.25, 0.4); sm.radius = r; sm.height = r*1.4; g0.mesh = sm
		g0.material_override = bag; var p: Vector3 = edge.call(); g0.position = p + Vector3(0, r*0.55, 0)
		g0.scale = Vector3(1.0, rng.randf_range(0.7, 1.0), rng.randf_range(0.9, 1.3)); g0.rotation.y = rng.randf()*TAU; root.add_child(g0)
	# cables fallen along the foot of the walls: loose runs on the floor, kinked here and there
	for i in 8:
		var e0: Vector3 = edge.call(); var d0 := Vector3(rng.randf_range(-0.4, 0.4), 0, 1).normalized()
		var prev := e0 + Vector3(0, 0.02, 0); var n := 12
		for k in range(1, n + 1):
			d0 = (d0 + Vector3(rng.randf_range(-0.5, 0.5), 0, rng.randf_range(-0.2, 0.2))).normalized()
			var p: Vector3 = prev + d0*rng.randf_range(0.25, 0.45); p.y = 0.02
			var seg := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.016; cm.bottom_radius = 0.016; cm.height = prev.distance_to(p); cm.radial_segments = 6; cm.rings = 1
			seg.mesh = cm; seg.material_override = cable
			root.add_child(seg); seg.position = (prev + p)*0.5
			seg.basis = Basis(Quaternion(Vector3.UP, (p - prev).normalized()))
			prev = p

## SPOTLIGHTS: old caged work lamps hung down the hall, each a hard cone straight down (or angled across), casting
## shadows of everyone under it onto the floor and the walls, seen in the haze
static func _spots(root: Node3D, A: Dictionary) -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 88
	var lamp := StandardMaterial3D.new(); lamp.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lamp.albedo_color = Color(3.0, 2.6, 1.9)
	var cage := StandardMaterial3D.new(); cage.albedo_color = Color(0.08, 0.08, 0.08); cage.metallic = 0.6
	var z: float = A.z2 + 2.0
	var i := 0
	while z > A.z1 - 2.0:
		var x: float = lerpf(A.x1 + 1.5, A.x2 - 1.5, 0.25 if i % 2 == 0 else 0.7) + rng.randf_range(-1.0, 1.0)
		var at := Vector3(x, 5.2, z)
		var sl := SpotLight3D.new(); sl.light_color = Color(1.0, 0.85, 0.62) if i % 3 else Color(0.75, 0.88, 1.0)
		sl.light_energy = 9.0; sl.spot_range = 9.0; sl.spot_angle = rng.randf_range(24, 34); sl.spot_attenuation = 0.8; sl.spot_angle_attenuation = 2.0
		sl.shadow_enabled = true; sl.shadow_blur = 0.6; sl.light_volumetric_fog_energy = 2.5
		root.add_child(sl); sl.global_position = at
		sl.rotation = Vector3(-PI/2 + rng.randf_range(-0.35, 0.35), 0, rng.randf_range(-0.35, 0.35))
		var b := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.12; cm.bottom_radius = 0.2; cm.height = 0.22; b.mesh = cm; b.material_override = cage
		root.add_child(b); b.global_position = at + Vector3(0, 0.1, 0)
		var bulb := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.08; sm.height = 0.16; bulb.mesh = sm; bulb.material_override = lamp
		root.add_child(bulb); bulb.global_position = at - Vector3(0, 0.05, 0)
		z -= rng.randf_range(6.0, 9.0); i += 1

## the air: dust that hangs in the lamps' light; water dripping off the ceiling
static func _air(root: Node3D, A: Dictionary) -> void:
	var box := Vector3(A.x2 - A.x1 + 2, 4.0, 110.0); var mid := Vector3((A.x1 + A.x2)*0.5, 2.0, (A.z1 + A.z2 + 70.0)*0.5)
	dust = GPUParticles3D.new(); dust.amount = 2400; dust.lifetime = 12.0; dust.preprocess = 12.0
	var pm := ParticleProcessMaterial.new(); pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX; pm.emission_box_extents = box*0.5
	pm.gravity = Vector3(0, -0.01, 0); pm.initial_velocity_min = 0.01; pm.initial_velocity_max = 0.05; pm.spread = 180
	pm.turbulence_enabled = true; pm.turbulence_noise_strength = 0.4; pm.turbulence_noise_speed_random = 0.3
	pm.scale_min = 0.6; pm.scale_max = 1.4
	dust.process_material = pm
	var q := QuadMesh.new(); q.size = Vector2(0.012, 0.012)
	var m := StandardMaterial3D.new(); m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.9, 0.88, 0.8, 0.55); m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL; m.roughness = 1.0
	q.material = m; dust.draw_pass_1 = q
	dust.visibility_aabb = AABB(-box, box*2); dust.position = mid; root.add_child(dust)

## failing lamps: one in three flickers — mostly steady, then dropping out, buzzing back, sometimes out for a beat
static var _fl := {}
static func tick(bulbs: Array, dt: float) -> void:
	for i in bulbs.size():
		var b: Dictionary = bulbs[i]
		if b.emerg or b.light == null or i % 3 != 1 or b.on < 1.0 or b.light.has_meta("e0"): continue      # (not while the alpha has the station dark)
		var s: Dictionary = _fl.get(i, {"t": 0.0, "v": 1.0, "next": randf_range(1.0, 6.0)})
		s.t += dt
		if s.t > s.next:
			s.v = 0.05 if randf() < 0.5 else randf_range(0.3, 0.7)
			if s.t > s.next + randf_range(0.04, 0.5): s.t = 0.0; s.next = randf_range(0.6, 7.0); s.v = 1.0
		else: s.v = 1.0 if randf() > 0.02 else 0.6
		_fl[i] = s
		b.light.light_energy = float(b.light.get_meta("e"))*s.v
		if b.cone: b.cone.visible = s.v > 0.4
