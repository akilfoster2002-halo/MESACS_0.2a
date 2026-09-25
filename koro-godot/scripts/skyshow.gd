## THE SKY SHOW: a ringed planet hanging over the town, and meteor showers.
##
## The planet is a real body, not a picture: a sphere wrapped in a Higgsfield
## map (assets/sky/planet_surface.jpg), lit from one side with a night side
## and a glowing limb, a halo of air, and rings the planet shadows. It sits
## 2.6 km out over the town's north-east, rises and sets as you walk round
## the ball, and the hills hide it from the far side — it is really there,
## so flying never loses it the way a camera-facing card got culled.
##
## A SHOWER happens over a PLACE. Every few minutes one picks a spot on the
## world — the temple, the Mall, the falls — and for most of a minute
## meteors cross the sky above it, every one on the same heading. Parallel
## paths are what make a real shower seem to pour out of one point of the
## sky, and they do here for the same reason. In between, the odd single
## shooting star crosses the sky wherever you are.
##
## Every meteor is one instance of one MultiMesh: one draw call, however
## many are in the sky. KORO_METEORS=1 starts a shower straight away.
class_name SkyShow
extends Node3D

const PLANET_AT := 2600.0      # from the town; the stars are a shell at 3000
const PLANET_R := 330.0        # ~15 degrees of sky from the town, rings twice that
const PLANET_UP := 22.0        # degrees above the town's horizon
const POOL := 64
const PEAK := 7.0              # meteors a second at a shower's height

var world: Node3D
var planet: Node3D
var sun := Vector3.UP
var mm: MultiMesh
var live: Array = []           # {p, v, age, life, len, w, col}
var shower := {}               # {spot, frame, v, t, dur, acc}
var next_shower := 0.0
var next_single := 0.0

func _ready() -> void:
	_planet()
	_field()
	next_shower = randf_range(45.0, 75.0)
	next_single = randf_range(5.0, 12.0)
	if OS.get_environment("KORO_METEORS") != "":
		next_shower = 2.0

# ------------------------------------------------------------ the planet

func _planet() -> void:
	var town := Planet.dir_of(0, 0)
	var north := (Planet.dir_of(0, 10) - town).normalized()
	var east := (Planet.dir_of(10, 0) - town).normalized()
	var level := (north * 0.8 + east * 0.6).normalized()
	var up := deg_to_rad(PLANET_UP)
	var d := (town * sin(up) + level * cos(up)).normalized()
	planet = Node3D.new()
	planet.position = town * Planet.R + d * PLANET_AT
	# THE RINGS SEEN NEARLY EDGE-ON, the way Saturn's are: the ring plane's
	# normal is the sky's "up" behind the planet, tipped 16 degrees towards
	# the town, then the whole system leaned 22 degrees across the sky
	var sky_up := (town - d * town.dot(d)).normalized()
	var right := d.cross(town).normalized()
	var n := (sky_up * cos(deg_to_rad(16.0)) - d * sin(deg_to_rad(16.0))).normalized()
	n = n.rotated(d, deg_to_rad(22.0))
	var bx := d.cross(n).normalized()
	planet.basis = Basis(bx, n, bx.cross(n).normalized())
	add_child(planet)
	# the sun from over your left shoulder, mostly behind you: from the town
	# the planet is nearly full, with a sliver of night down its right edge
	sun = (-right * 0.55 + town * 0.3 - d * 0.75).normalized()
	var surface: Texture2D = load("res://assets/sky/planet_surface.jpg") if ResourceLoader.exists("res://assets/sky/planet_surface.jpg") else null
	# THE BODY: a sphere wrapped in the Higgsfield map, turning slowly
	var body := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = PLANET_R
	sm.height = PLANET_R * 2.0
	sm.radial_segments = 96
	sm.rings = 48
	body.mesh = sm
	var bm := ShaderMaterial.new()
	bm.shader = Shader.new()
	bm.shader.code = BODY
	bm.set_shader_parameter("surface", surface)
	bm.set_shader_parameter("sun_dir", sun)
	body.material_override = bm
	_sky_thing(body)
	# THE AIR: a thin halo round the edge, bright where the sun is
	var air := MeshInstance3D.new()
	var am := SphereMesh.new()
	am.radius = PLANET_R * 1.05
	am.height = PLANET_R * 2.1
	am.radial_segments = 96
	am.rings = 48
	air.mesh = am
	var amat := ShaderMaterial.new()
	amat.shader = Shader.new()
	amat.shader.code = AIR
	amat.set_shader_parameter("sun_dir", sun)
	air.material_override = amat
	_sky_thing(air)
	# THE RINGS: a disc in the planet's own equator, banded, with gaps, and
	# the planet's shadow falling across them
	var ring := MeshInstance3D.new()
	ring.mesh = _annulus(PLANET_R * 1.4, PLANET_R * 2.35, 160)
	var rm := ShaderMaterial.new()
	rm.shader = Shader.new()
	rm.shader.code = RINGS
	rm.set_shader_parameter("sun_dir", sun)
	rm.set_shader_parameter("planet_r", PLANET_R)
	rm.set_shader_parameter("r0", PLANET_R * 1.4)
	rm.set_shader_parameter("r1", PLANET_R * 2.35)
	ring.material_override = rm
	_sky_thing(ring)

func _sky_thing(mi: MeshInstance3D) -> void:
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	planet.add_child(mi)

func _annulus(r0: float, r1: float, n: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in n:
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		var p := [Vector3(cos(a0) * r0, 0, sin(a0) * r0), Vector3(cos(a0) * r1, 0, sin(a0) * r1),
			Vector3(cos(a1) * r1, 0, sin(a1) * r1), Vector3(cos(a1) * r0, 0, sin(a1) * r0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.add_vertex(p[k])
	return st.commit()

const BODY := """
shader_type spatial;
render_mode unshaded, fog_disabled;
uniform sampler2D surface : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 sun_dir;
varying vec3 wn;
void vertex(){ wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	vec2 uv = UV;
	uv.x = fract(uv.x + TIME * 0.0035);
	vec3 c = texture(surface, uv).rgb;
	float ndl = dot(normalize(wn), normalize(sun_dir));
	float day = smoothstep(-0.10, 0.30, ndl);
	// the night side: nearly black, the brightest storms still faintly lit
	vec3 night = c * 0.025 + pow(max(c - vec3(0.55), vec3(0.0)), vec3(1.6)) * vec3(0.4, 0.9, 1.0) * 0.5;
	vec3 lit = c * (0.2 + 1.15 * max(ndl, 0.0));
	vec3 col = mix(night, lit, day);
	// the limb: a bright edge of atmosphere where the light grazes it
	float rim = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), 3.5);
	col += vec3(0.35, 0.85, 1.0) * rim * (0.1 + 1.1 * day);
	ALBEDO = col;
}
"""

const AIR := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, fog_disabled;
uniform vec3 sun_dir;
varying vec3 wn;
void vertex(){ wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	float f = 1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	float lit = smoothstep(-0.35, 0.45, dot(normalize(wn), normalize(sun_dir)));
	ALBEDO = vec3(0.35, 0.8, 1.0) * 1.8;
	ALPHA = pow(f, 5.0) * (0.1 + 0.9 * lit);
}
"""

const RINGS := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, fog_disabled;
uniform vec3 sun_dir;
uniform float planet_r;
uniform float r0;
uniform float r1;
varying vec3 lp;
varying vec3 centre;
void vertex(){
	lp = VERTEX;
	centre = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
}
void fragment(){
	float t = (length(lp.xz) - r0) / (r1 - r0);
	float band = 0.55 + 0.22 * sin(t * 83.0) + 0.14 * sin(t * 211.0 + 1.3) + 0.09 * sin(t * 37.0 + 0.4);
	float gaps = smoothstep(0.015, 0.045, abs(t - 0.62)) * smoothstep(0.008, 0.025, abs(t - 0.3));
	float edge = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.88, t);
	vec3 col = mix(vec3(0.95, 0.72, 0.4), vec3(0.62, 0.52, 0.95), smoothstep(0.15, 0.95, t));
	col = mix(col, vec3(0.55, 0.9, 1.0), 0.18 * sin(t * 57.0) * sin(t * 57.0));
	// in the planet's shadow? a ray from here towards the sun, against the sphere
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 L = normalize(sun_dir);
	vec3 oc = wp - centre;
	float b = dot(oc, L);
	float c = dot(oc, oc) - planet_r * planet_r;
	float h = b * b - c;
	float shade = (h > 0.0 && b < 0.0) ? 0.12 : 1.0;
	ALBEDO = col * (0.22 + 0.7 * shade);
	ALPHA = clamp(band * gaps * edge * 0.62, 0.0, 1.0);
}
"""

# ------------------------------------------------------------ the meteors

func _field() -> void:
	var q := QuadMesh.new()
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, fog_disabled;
varying vec4 tint;
void vertex(){ tint = INSTANCE_CUSTOM; }
void fragment(){
	// UV.x runs tail (0) to head (1); UV.y across the streak
	float across = 1.0 - abs(UV.y * 2.0 - 1.0);
	float head = smoothstep(0.86, 1.0, UV.x) * 3.0;
	float trail = pow(UV.x, 2.4);
	ALBEDO = tint.rgb * 2.2;
	ALPHA = clamp((trail + head) * pow(across, 1.8) * tint.a, 0.0, 1.0);
}
"""
	q.material = mat
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = q
	mm.instance_count = POOL
	for i in POOL:
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), Vector3.ZERO))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the streaks move a long way; never let a stale box cull them
	mi.custom_aabb = AABB(Vector3.ONE * -4000.0, Vector3.ONE * 8000.0)
	add_child(mi)

## Somewhere worth naming, and where it is.
func _places() -> Array:
	var out := []
	for spec in Planet.BUILDINGS:
		if spec.get("pad", false):
			continue
		out.append([str(spec.name), Planet.dir_of(spec.lon, spec.lat)])
	if world and world.get("islands") and world.islands:
		out.append(["THE FALLS", (world.islands.pool.dir as Vector3)])
	return out

func _start_shower() -> void:
	var places := _places()
	var pick: Array = places[randi() % places.size()]
	start_over(pick[1], pick[0])

## A shower over `spot` now, announced by name.
func start_over(spot: Vector3, name: String) -> void:
	var fr := Planet.frame_at(spot, randf() * TAU)
	var dive := deg_to_rad(randf_range(22.0, 40.0))
	shower = {"spot": spot, "frame": fr, "t": 0.0, "dur": randf_range(38.0, 55.0), "acc": 0.0,
		"v": (fr.z * cos(dive) - spot * sin(dive)).normalized()}
	if world and world.hud:
		world.hud.say("A meteor shower over %s — look up!" % name, 5.0)

func _spawn(spot: Vector3, fr: Basis, heading: Vector3, spread: float) -> void:
	if live.size() >= POOL:
		return
	var v := (heading + Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * 0.03).normalized()
	var p := spot * (Planet.R + randf_range(160.0, 260.0)) \
		+ fr.x * randf_range(-spread, spread) + fr.z * randf_range(-spread, spread) - v * 90.0
	var r := randf()
	var col := Color(1.0, 0.93, 0.78) if r < 0.6 else (Color(0.6, 1.0, 0.95) if r < 0.8 else Color(1.0, 0.68, 0.92))
	live.append({"p": p, "v": v * randf_range(190.0, 320.0), "age": 0.0, "life": randf_range(0.6, 1.3),
		"len": randf_range(26.0, 60.0), "w": randf_range(1.0, 2.2), "col": col})

func _process(delta: float) -> void:
	# the shower: rises, peaks and dies away over the place it chose
	next_shower -= delta
	if shower.is_empty() and next_shower <= 0.0:
		_start_shower()
	if not shower.is_empty():
		shower.t += delta
		var k: float = shower.t / shower.dur
		if k >= 1.0:
			shower = {}
			next_shower = randf_range(150.0, 260.0)
		else:
			shower.acc += PEAK * sin(PI * k) * delta
			while shower.acc >= 1.0:
				shower.acc -= 1.0
				_spawn(shower.spot, shower.frame, shower.v, 230.0)
	# a stray one now and then, over wherever you are
	next_single -= delta
	if next_single <= 0.0 and world and world.player:
		next_single = randf_range(7.0, 20.0)
		var here: Vector3 = world.player.dir
		var fr := Planet.frame_at(here, randf() * TAU)
		var spot := (here + fr.x * randf_range(-0.5, 0.5) + fr.z * randf_range(-0.5, 0.5)).normalized()
		var dive := deg_to_rad(randf_range(15.0, 35.0))
		_spawn(spot, fr, (fr.z * cos(dive) - spot * sin(dive)).normalized(), 60.0)
	_draw_meteors(delta)

func _draw_meteors(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	var eye := cam.global_position if cam else Vector3.ZERO
	var i := 0
	while i < live.size():
		var m: Dictionary = live[i]
		m.age += delta
		if m.age >= m.life:
			live.remove_at(i)
			continue
		m.p += m.v * delta
		i += 1
	for j in POOL:
		if j >= live.size():
			mm.set_instance_transform(j, Transform3D(Basis().scaled(Vector3.ZERO), Vector3.ZERO))
			continue
		var m: Dictionary = live[j]
		var dir: Vector3 = (m.v as Vector3).normalized()
		var mid: Vector3 = m.p - dir * m.len * 0.5
		# turned about its own length to face you, so it is never edge-on
		var side := dir.cross(eye - mid).normalized()
		var t: float = m.age / m.life
		var a := smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.0, t))
		mm.set_instance_transform(j, Transform3D(Basis(dir * m.len, side * m.w, dir.cross(side)), mid))
		var c: Color = m.col
		mm.set_instance_custom_data(j, Color(c.r, c.g, c.b, a))
