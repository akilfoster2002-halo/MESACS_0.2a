## THE MERIDIAN TOWER: the tallest thing in Harbor Lane, out past the east edge of town, where the WFC chase sends her.
## A glass tower 140 m high and its roof — 60 m square, big enough to fight across: a helipad, the lift housing, plant
## (AC units, a water tank), a mast with its red light, floodlights, a parapet round the edge. Built once, the first
## time it is wanted; its body is a wall she can run at (bld:TOWER) and its roof a roof she can land on.
##   Tower.build(g)   Tower.TOP, Tower.C, Tower.HALF   Tower.arena() / blocks() for the fight
class_name Tower
extends RefCounted

const C := Vector2(335.0, 25.0)           # the middle of it: east of town, in a gap in the skyline round it (nothing over 80 m)
const HALF := 30.0                        # half its width
const TOP := 140.0                        # the roof
static var node: Node3D
static var wet: Array = []                # the roof's materials, made to shine when it rains

# the roof IS the helipad: one open deck, edge to edge; all that stands on it is the stair hut in a corner [x, z, w, d, h]
const PLANT := [[-24.5, -24.5, 6.0, 6.0, 3.2]]
const PAD := Vector2(0.0, 0.0)            # its middle, about the roof's

static func _std(c: Color, r := 0.8, m := 0.0) -> StandardMaterial3D:
	var s := StandardMaterial3D.new(); s.albedo_color = c; s.roughness = r; s.metallic = m; return s
static func _box(p: Node3D, size: Vector3, at: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var b := BoxMesh.new(); b.size = size; mi.mesh = b; mi.material_override = m; mi.position = at; p.add_child(mi); return mi

static func arena() -> Dictionary: return {"x1": C.x - HALF + 1.6, "x2": C.x + HALF - 1.6, "z1": C.y - HALF + 1.6, "z2": C.y + HALF - 1.6}
static func blocks() -> Array:
	var out := []
	for q in PLANT: out.append({"x1": C.x + q[0] - q[2]/2, "x2": C.x + q[0] + q[2]/2, "z1": C.y + q[1] - q[3]/2, "z2": C.y + q[1] + q[3]/2})
	return out

static func build(g) -> void:
	if node != null and is_instance_valid(node): return
	node = Node3D.new(); node.name = "MeridianTower"; g.city.add_child(node)
	# the body: dark glass, a grid of windows, some lit
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform vec3 base : source_color = vec3(0.035, 0.05, 0.07);
varying vec3 wp;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 uv = abs(NORMAL.x) > 0.5 ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y);
	vec2 cell = floor(uv / vec2(3.0, 3.6));
	vec2 f = fract(uv / vec2(3.0, 3.6));
	float frame = step(0.08, f.x) * step(f.x, 0.92) * step(0.14, f.y) * step(f.y, 0.86);
	float lit = step(0.83, h(cell)) * frame;
	float band = step(0.96, fract(uv.y / 14.4));
	ALBEDO = mix(base, vec3(0.16, 0.18, 0.2), band) + frame * vec3(0.02, 0.03, 0.04);
	METALLIC = 0.85 * frame; ROUGHNESS = mix(0.6, 0.12, frame);
	EMISSION = lit * mix(vec3(1.0, 0.82, 0.55), vec3(0.75, 0.85, 1.0), h(cell + 3.1)) * 1.6;
}"""
	var glass := ShaderMaterial.new(); glass.shader = sh
	_box(node, Vector3(HALF*2, TOP - 0.3, HALF*2), Vector3(C.x, (TOP - 0.3)/2, C.y), glass)     # (its top under the roof: the windows are not on the roof)
	# a stepped crown under the roof edge, and the roof slab
	var conc := _std(Color(0.2, 0.21, 0.22), 0.75); var dark := _std(Color(0.08, 0.085, 0.09), 0.6, 0.3)
	_box(node, Vector3(HALF*2 + 1.2, 2.4, HALF*2 + 1.2), Vector3(C.x, TOP - 1.2, C.y), dark)
	var roof := _std(Color(0.16, 0.165, 0.17), 0.85); wet.append(roof)
	_box(node, Vector3(HALF*2, 0.2, HALF*2), Vector3(C.x, TOP - 0.1, C.y), roof)
	# the parapet
	for s in [[0, -1], [0, 1], [-1, 0], [1, 0]]:
		var along_x: bool = s[0] == 0
		var sz := Vector3(HALF*2 + 1.2 if along_x else 0.6, 1.1, 0.6 if along_x else HALF*2 + 1.2)
		_box(node, sz, Vector3(C.x + s[0]*(HALF + 0.3), TOP + 0.55, C.y + s[1]*(HALF + 0.3)), conc)
	# THE DECK: the whole roof marked as one great pad — a dark non-slip deck, a broad yellow ring, a white aiming circle,
	# a huge H, the tower's name along one side, chevrons in from the corners, and lights all the way round the edge
	var deck := ShaderMaterial.new(); deck.shader = _deck_shader(false); wet.append(deck)
	_box(node, Vector3(HALF*2 - 0.4, 0.04, HALF*2 - 0.4), Vector3(C.x, TOP + 0.02, C.y), deck)
	var yel := ShaderMaterial.new(); yel.shader = _deck_shader(true); yel.set_shader_parameter("paint", Color(0.95, 0.72, 0.1))
	var wht := ShaderMaterial.new(); wht.shader = yel.shader; wht.set_shader_parameter("paint", Color(0.86, 0.86, 0.82))
	wet.append(yel); wet.append(wht)
	var P := Vector3(C.x + PAD.x, TOP + 0.05, C.y + PAD.y)
	var ring := func(r_in: float, r_out: float, m: Material, y := 0.0):
		var mi := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = r_in; tm.outer_radius = r_out; tm.rings = 96; mi.mesh = tm
		mi.scale = Vector3(1, 0.02, 1); mi.material_override = m; mi.position = P + Vector3(0, y, 0); node.add_child(mi)
	ring.call(24.0, 25.6, yel)                       # the edge of the landing area
	ring.call(14.0, 14.8, wht)                       # the touchdown circle
	# the H, 16 m tall
	for q in [-5.0, 5.0]: _box(node, Vector3(2.4, 0.03, 16.0), P + Vector3(q, 0.0, 0), wht)
	_box(node, Vector3(10.0, 0.03, 2.4), P, wht)
	# a white border just inside the parapet, and yellow chevrons pointing in from the corners
	for s2 in [[0, -1], [0, 1], [-1, 0], [1, 0]]:
		var ax: bool = s2[0] == 0
		_box(node, Vector3(HALF*2 - 2.4 if ax else 0.5, 0.03, 0.5 if ax else HALF*2 - 2.4), Vector3(C.x + s2[0]*(HALF - 1.4), TOP + 0.05, C.y + s2[1]*(HALF - 1.4)), wht)
	for cx in [-1.0, 1.0]:
		for cz in [-1.0, 1.0]:
			if cx < 0 and cz < 0: continue           # (the stair hut's corner)
			for k2 in 3:
				var at := Vector3(C.x + cx*(HALF - 4.5 - k2*1.6), TOP + 0.05, C.y + cz*(HALF - 4.5 - k2*1.6))
				var bar := _box(node, Vector3(3.0, 0.03, 0.6), at, yel); bar.rotation.y = PI/4*cx*cz
	# the edge lights: green round the landing ring, white along the parapet
	var green := StandardMaterial3D.new(); green.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; green.albedo_color = Color(0.4, 1.8, 0.6)
	var white := StandardMaterial3D.new(); white.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; white.albedo_color = Color(1.6, 1.6, 1.5)
	var bead := SphereMesh.new(); bead.radius = 0.14; bead.height = 0.28
	for i in 32:
		var a := i*TAU/32; var l := MeshInstance3D.new(); l.mesh = bead; l.material_override = green
		l.position = P + Vector3(sin(a)*26.2, 0.12, cos(a)*26.2); node.add_child(l)
	for i in 15:
		var t := -HALF + 2.0 + i*(HALF*2 - 4.0)/14.0
		for e in [Vector2(t, -HALF + 0.6), Vector2(t, HALF - 0.6), Vector2(-HALF + 0.6, t), Vector2(HALF - 0.6, t)]:
			var l2 := MeshInstance3D.new(); l2.mesh = bead; l2.material_override = white; l2.position = Vector3(C.x + e.x, TOP + 0.12, C.y + e.y); node.add_child(l2)
	# the stair hut in its corner, its red door
	for q in PLANT: _box(node, Vector3(q[2], q[4], q[3]), Vector3(C.x + q[0], TOP + q[4]/2, C.y + q[1]), conc)
	var door := _std(Color(0.3, 0.06, 0.05), 0.6); _box(node, Vector3(1.3, 2.3, 0.08), Vector3(C.x - 24.5 + 1.5, TOP + 1.15, C.y - 24.5 + 3.05), door)
	# a windsock on its pole in the far corner
	var wpole := Vector3(C.x + HALF - 2.0, TOP, C.y - HALF + 2.0)
	_box(node, Vector3(0.12, 4.5, 0.12), wpole + Vector3(0, 2.25, 0), dark)
	var sock := MeshInstance3D.new(); var sc := CylinderMesh.new(); sc.top_radius = 0.4; sc.bottom_radius = 0.15; sc.height = 2.2; sock.mesh = sc
	sock.material_override = _std(Color(1.0, 0.4, 0.05), 0.8); sock.rotation.z = PI/2*0.85; sock.position = wpole + Vector3(-1.1, 4.2, 0); node.add_child(sock)
	# the mast, and its red light
	_box(node, Vector3(0.5, 22.0, 0.5), Vector3(C.x - 24, TOP + 11, C.y - 24), dark)
	var red := OmniLight3D.new(); red.light_color = Color(1, 0.1, 0.08); red.light_energy = 3.0; red.omni_range = 8; red.position = Vector3(C.x - 24, TOP + 22.3, C.y - 24); node.add_child(red)
	var rb := MeshInstance3D.new(); var rs := SphereMesh.new(); rs.radius = 0.3; rs.height = 0.6; rb.mesh = rs
	var rm := StandardMaterial3D.new(); rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; rm.albedo_color = Color(3, 0.2, 0.15); rb.material_override = rm; rb.position = red.position; node.add_child(rb)
	# floodlights on the corners, down across the roof (so the fight is lit, hard, from the edges)
	for s in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var at := Vector3(C.x + s.x*(HALF - 1.0), TOP + 5.5, C.y + s.y*(HALF - 1.0))
		_box(node, Vector3(0.25, 5.5, 0.25), at - Vector3(0, 2.75, 0), dark)
		var sp := SpotLight3D.new(); sp.light_color = Color(1.0, 0.72, 0.42); sp.light_energy = 1.4; sp.spot_range = 46; sp.spot_angle = 34; sp.shadow_enabled = true; sp.shadow_bias = 0.12; sp.shadow_normal_bias = 2.5; sp.light_volumetric_fog_energy = 1.6
		node.add_child(sp); sp.look_at_from_position(at, Vector3(C.x - s.x*6, TOP, C.y - s.y*6))
	# the world: a wall she can run at, a roof she can land on, its plant in her way
	g.boots.solids.append([C.x - HALF, C.x + HALF, C.y - HALF, C.y + HALF, -1.0, TOP, "bld:TOWER"])
	g.boots.roofs.append({"id": "TOWER", "x1": C.x - HALF, "x2": C.x + HALF, "z1": C.y - HALF, "z2": C.y + HALF, "top": TOP})
	for q in PLANT: g.boots.solids.append([C.x + q[0] - q[2]/2, C.x + q[0] + q[2]/2, C.y + q[1] - q[3]/2, C.y + q[1] + q[3]/2, TOP, TOP + q[4]])

## the painted skyline round the city (the "manhattan" backdrop) has a tower of its own beside this one: off while
## we are up here, back when we leave
## (not off: anything of it within ~45 m of the camera fades out — the tower's neighbour — and the rest stands round her)
static var faded := {}
static func skyline(g, on: bool) -> void:
	for m in g.city.find_children("*", "MeshInstance3D", true, false):       # the city's own sky box (1.8 km round it): off, so the storm shows
		if (m as MeshInstance3D).get_aabb().size.x > 1500: m.visible = on
	for m in g.city.find_children("manhattan*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			if on:
				if faded.has(mi): mi.set_surface_override_material(i, faded[mi][i])
				continue
			if not faded.has(mi): faded[mi] = []
			var was_m = mi.get_surface_override_material(i); faded[mi].append(was_m)
			var src = was_m if was_m else mi.mesh.surface_get_material(i)
			if src is StandardMaterial3D:
				var d: StandardMaterial3D = src.duplicate()
				d.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_DITHER; d.distance_fade_min_distance = 45.0; d.distance_fade_max_distance = 75.0
				d.emission_enabled = true; d.emission = Color(0.9, 0.7, 0.45); d.emission_energy_multiplier = 0.05     # (a little of the city's own light on them)
				mi.set_surface_override_material(i, d)
	if on: faded.clear()

## THE STORM SKY: low cloud rolling over, lit from under by the city (amber at the horizon), lit through when it flashes
static var sky_mat: ShaderMaterial
static func _sky() -> Sky:
	var sh := Shader.new()
	sh.code = """
shader_type sky;
uniform float flash = 0.0;
uniform float t = 0.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
	return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 6; i++) { s += a*n(p); p *= 2.07; a *= 0.5; } return s; }
void sky() {
	vec3 d = EYEDIR;
	float up = clamp(d.y, -0.2, 1.0);
	vec3 top = vec3(0.004, 0.006, 0.012); vec3 hor = vec3(0.07, 0.045, 0.03);
	vec3 col = mix(hor, top, smoothstep(-0.02, 0.45, up));
	vec2 uv = d.xz/max(d.y + 0.12, 0.05);
	float c = fbm(uv*0.6 + vec2(t*0.02, t*0.013));
	float c2 = fbm(uv*1.7 - vec2(t*0.035, 0.0));
	float cloud = smoothstep(0.35, 0.8, c*0.75 + c2*0.35);
	vec3 under = mix(vec3(0.1, 0.06, 0.04), vec3(0.025, 0.03, 0.045), smoothstep(0.0, 0.5, up));
	col = mix(col, under*(0.6 + 0.6*c2), cloud*smoothstep(-0.05, 0.08, up));
	col += vec3(0.75, 0.82, 1.0)*flash*(0.25 + 1.2*cloud)*smoothstep(-0.05, 0.3, up);
	col += vec3(0.16, 0.08, 0.035)*exp(-abs(d.y)*10.0);
	COLOR = col;
}"""
	sky_mat = ShaderMaterial.new(); sky_mat.shader = sh
	var sky := Sky.new(); sky.sky_material = sky_mat; return sky

## rain on the roof: it goes dark and shines
static func soak(k: float) -> void:
	for m in wet:
		if m is ShaderMaterial: (m as ShaderMaterial).set_shader_parameter("wet", k)
		else: (m as StandardMaterial3D).roughness = lerpf(0.85, 0.32, k); (m as StandardMaterial3D).metallic = lerpf(0.0, 0.15, k)

## the deck: dark, gritty, stained; puddles that fill as it rains (mirror-smooth, darker); the paint worn and chipped
static func _deck_shader(paint: bool) -> Shader:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform vec3 paint : source_color = vec3(0.9);
uniform float wet = 0.0;
varying vec3 wp;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a*n(p); p *= 2.03; a *= 0.5; } return s; }
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float grit = n(p*9.0)*0.5 + n(p*31.0)*0.5;
	float stain = fbm(p*0.12);
	float puddle = smoothstep(0.5 - 0.14*wet, 0.53 - 0.14*wet, fbm(p*0.09 + 3.7)) * smoothstep(0.05, 0.4, wet);
	// rain rings on the water: little circles opening and gone, everywhere at once
	vec2 cell = floor(p*2.2); vec2 fp = fract(p*2.2) - 0.5;
	float ph = fract(TIME*1.3 + h(cell)*7.0);
	float ring = smoothstep(0.05, 0.0, abs(length(fp - (vec2(h(cell + 1.3), h(cell + 2.7)) - 0.5)*0.5) - ph*0.45)) * (1.0 - ph);
	NORMAL_MAP = normalize(vec3(0.5 + ring*0.35*puddle*(fp.x), 0.5 + ring*0.35*puddle*(fp.y), 1.0));
	vec3 base = %s;
	base *= mix(0.75, 1.1, grit) * mix(0.7, 1.15, stain);
	%s
	ALBEDO = base * mix(1.0, 0.35, puddle) * mix(1.0, 0.8, wet);
	ROUGHNESS = mix(mix(0.82, 0.55, wet), 0.0, puddle);
	METALLIC = 0.0; SPECULAR = mix(mix(0.4, 0.75, wet), 1.0, puddle);
}""" % ["paint" if paint else "vec3(0.07, 0.075, 0.085)",
		"if (fbm(p*1.7) < 0.36 || n(p*14.0) < 0.12) discard;" if paint else ""]
	return sh

## NIGHT ON THE TOWER: the sky gone black-blue, no sun, a low cold ambient, and a haze the lights cut shafts through
static var was := {}
static func night(g, on: bool) -> void:
	var env: Environment = g.env
	if on:
		if was.is_empty():
			was = {"bgm": env.background_mode, "bg": env.background_color, "amb": env.ambient_light_color, "ambE": env.ambient_light_energy, "fog": env.fog_light_color,
				"fd": env.fog_density, "exp": env.tonemap_exposure, "vf": env.volumetric_fog_enabled, "vfd": env.volumetric_fog_density, "vfa": env.volumetric_fog_albedo,
				"vfl": env.volumetric_fog_length, "vfe": env.volumetric_fog_emission_energy, "vfan": env.volumetric_fog_anisotropy, "sun": g.sun.light_energy if g.sun else 1.0,
				"glow": env.glow_enabled, "gi": env.glow_intensity}
		if not was.has("sky"): was.sky = env.sky
		env.background_mode = Environment.BG_SKY; env.sky = _sky()
		if not was.has("rls"): was.rls = env.reflected_light_source; was.asc = env.ambient_light_sky_contribution
		env.reflected_light_source = Environment.REFLECTION_SOURCE_BG; env.ambient_light_sky_contribution = 0.0      # (the sky is not what lights the roof)
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.25, 0.32, 0.48); env.ambient_light_energy = 0.12
		env.fog_light_color = Color(0.03, 0.035, 0.05); env.fog_density = 0.0022
		if not was.has("fsa"): was.fsa = env.fog_sky_affect
		env.fog_sky_affect = 0.15
		env.volumetric_fog_enabled = true; env.volumetric_fog_density = 0.011; env.volumetric_fog_albedo = Color(0.7, 0.76, 0.85)
		env.volumetric_fog_emission_energy = 0.0; env.volumetric_fog_anisotropy = 0.6; env.volumetric_fog_length = 70.0
		env.tonemap_exposure = 1.05; env.glow_enabled = true; env.glow_intensity = 1.1
		if not was.has("ssr"): was.ssr = env.ssr_enabled
		env.ssr_enabled = true; env.ssr_max_steps = 96; env.ssr_fade_in = 0.1; env.ssr_fade_out = 2.0       # the puddles show the lights
		if g.sun: g.sun.light_energy = 0.0
		if not was.has("dl"):                                  # (and the city's teal moon: every far light off but the lightning)
			was.dl = []
			for l in g.get_tree().root.find_children("*", "DirectionalLight3D", true, false):
				if l != Rain.sky and l != g.sun: was.dl.append([l, l.light_energy]); l.light_energy = 0.0
		return
	if was.is_empty(): return
	env.background_mode = was.bgm; env.background_color = was.bg; env.sky = was.get("sky"); sky_mat = null; env.fog_sky_affect = was.get("fsa", 1.0); env.reflected_light_source = was.get("rls", Environment.REFLECTION_SOURCE_SKY); env.ambient_light_sky_contribution = was.get("asc", 1.0); env.ssr_enabled = was.get("ssr", false); env.ambient_light_color = was.amb; env.ambient_light_energy = was.ambE
	env.fog_light_color = was.fog; env.fog_density = was.fd; env.tonemap_exposure = was.exp; env.volumetric_fog_enabled = was.vf
	env.volumetric_fog_density = was.vfd; env.volumetric_fog_albedo = was.vfa; env.volumetric_fog_length = was.vfl; env.volumetric_fog_emission_energy = was.vfe
	env.volumetric_fog_anisotropy = was.vfan; env.glow_enabled = was.glow; env.glow_intensity = was.gi
	if g.sun: g.sun.light_energy = was.sun
	for pr in was.get("dl", []): if is_instance_valid(pr[0]): pr[0].light_energy = pr[1]
	was = {}
