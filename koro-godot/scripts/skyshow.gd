## THE SKY SHOW: a ringed planet hanging over the town, and meteor showers.
##
## The planet is a painting (Higgsfield, glb files/sky/) on one camera-facing
## quad, placed out in the world rather than glued to the camera: it sits
## over the town's north-east, rises and sets as you walk round the ball,
## and the hills hide it from the far side, because it is really there.
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
const PLANET_SIZE := 1500.0    # the painting's square — the disc is ~60% of it
const PLANET_UP := 22.0        # degrees above the town's horizon
const POOL := 64
const PEAK := 7.0              # meteors a second at a shower's height

var world: Node3D
var planet: MeshInstance3D
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
	var q := QuadMesh.new()
	q.size = Vector2(PLANET_SIZE, PLANET_SIZE)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.albedo_texture = load("res://assets/sky/planet.png")
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	m.disable_fog = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	q.material = m
	planet = MeshInstance3D.new()
	planet.mesh = q
	planet.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	planet.position = town * Planet.R + d * PLANET_AT
	add_child(planet)

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
