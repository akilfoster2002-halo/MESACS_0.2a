## A CHAT ROOM — a place a player owns inside KORO, stood up from what the
## server says it is (server/chatrooms.js) out of the parts data/chatrooms.json
## lists: a floor, four walls, a ceiling or the sky, the lights, and the
## things in it — furniture to sit on, a jukebox, a TV, arcade cabinets, a
## robot that runs a program made of Koro's own blocks, and a portal home.
##
## A ROOM IS ONE MORE KORO WORLD. world.gd builds it where it would build a
## planet (Worlds.chatroom(): a big, flat, bare ball with nothing growing on
## it) and everything else is what it always is: the Walker you walk with,
## the Others you see, the same socket (the room is the socket room
## `cr:<id>`), the same HUD. The room sits on the ball's north pole, where
## "up" is +Y, so inside it the room's own axes are the world's.
##
## WHAT IT IS AND WHAT IS HAPPENING IN IT ARE KEPT APART. `room` is the
## saved room — only the owner changes it, through the editor and a Save
## the server checks. `state` is the live half: which switch is down, which
## track is on, when the robot was set going, the best score on a cabinet.
## Every change of state goes to the server (Net.room_state) and comes back
## to everybody inside, and anybody who walks in later is handed the room's
## state as it stands — so what one player does, everybody sees.
class_name ChatRoom
extends Node3D

## The pick shapes the editor clicks on: Areas, on a layer of their own, so
## neither your feet (world.floor_at, world.blocked) nor the camera ever
## meet them.
const PICK_LAYER := 1 << 19
const REACH := 2.4
const STEP_M := 0.1            # one "step" of motion.move, as in public/vm.js

static var _cat := {}

static func catalog() -> Dictionary:
	if _cat.is_empty():
		var j = JSON.parse_string(FileAccess.get_file_as_string("res://data/chatrooms.json"))
		_cat = j if j is Dictionary else {"size": {"w": 26, "d": 26, "h": 9}, "objects": {}, "templates": {}, "env": {}}
	return _cat

static func spec(type: String) -> Dictionary:
	return catalog().get("objects", {}).get(type, {})

static func new_id() -> String:
	const CH := "abcdefghijklmnopqrstuvwxyz0123456789"
	var s := ""
	for i in 9:
		s += CH[randi() % CH.length()]
	return s

var world: Node3D
var room: Dictionary = {}
var env: Dictionary = {}
var objects: Array = []        # the saved objects, in order: what Save sends
var nodes := {}                # id -> the object's holder
var state := {}                # id -> live state
var W := 26.0
var D := 26.0
var H := 9.0

var shell: Node3D
var walls_n: Array = []        # the four walls, each knowing which way is out
var lid: Node3D                # the ceiling, if there is one
var lamps: Array = []          # [OmniLight3D, energy]
var glow_mats: Array = []      # [material, energy] — the ceiling panels, neon strips
var lights_on := true
var sky_show: SkyShow
var sun: DirectionalLight3D
var skew := 0.0                # the server's clock minus ours, in seconds
var t := 0.0
var editing := false
var arcade := {}               # the game you are playing: {id, stage, t, go}
var _beats := {}

func setup(r: Dictionary, w: Node3D) -> ChatRoom:
	world = w
	_take(r)
	var S: Dictionary = catalog().get("size", {})
	W = float(S.get("w", 26))
	D = float(S.get("d", 26))
	H = float(S.get("h", 9))
	return self

func _take(r: Dictionary) -> void:
	room = r
	env = (r.get("env", {}) as Dictionary).duplicate(true)
	objects = (r.get("objects", []) as Array).duplicate(true)

func _ready() -> void:
	_build_shell()
	for o in objects:
		_add(o)
	_dress_sky()

func mine() -> bool:
	return bool(room.get("mine", false))

func now_server() -> float:
	return Time.get_unix_time_from_system() + skew

# ============================================================ the shell

func _build_shell() -> void:
	if shell:
		shell.queue_free()
	lamps.clear()
	glow_mats.clear()
	walls_n.clear()
	lid = null
	shell = Node3D.new()
	shell.name = "shell"
	add_child(shell)
	_floor()
	_walls()
	_ceiling()
	_bounds()
	_lights()
	_apply_lights()
	# the room reflects itself, not the sky outside: a floor that shines
	# shows the walls and the lamps (taken once, when the room is built)
	var probe := ReflectionProbe.new()
	probe.size = Vector3(W, H, D)
	probe.position = Vector3(0, H / 2.0, 0)
	probe.box_projection = true
	probe.interior = true
	probe.intensity = 0.7
	probe.update_mode = ReflectionProbe.UPDATE_ONCE
	shell.add_child(probe)

func _col(k: String, dflt: String) -> Color:
	return Color(str(env.get(k, dflt)))

const FLOOR_SHADER := """
shader_type spatial;
uniform int kind = 0;
uniform vec3 tint : source_color = vec3(1.0);
uniform vec3 glow : source_color = vec3(0.56, 0.94, 1.0);
uniform float glow_k = 1.0;
uniform sampler2D tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform float tex_scale = 0.25;
varying vec3 lp;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
void vertex(){ lp = VERTEX; }
void fragment(){
	vec2 p = lp.xz;
	vec3 c = tint;
	float rough = 0.85;
	float metal = 0.0;
	vec3 em = vec3(0.0);
	if (kind == 0) {            // wood: staggered planks with a grain
		float w = 0.24;
		float row = floor(p.y / w);
		float off = h1(vec2(row, 3.0)) * 2.4;
		float u = (p.x + off) / 2.4;
		float id = h1(vec2(row, floor(u)));
		float grain = vn(vec2(p.x * 1.2, p.y * 36.0) + id * 17.0);
		c = tint * (0.8 + 0.32 * id) * (0.84 + 0.26 * grain);
		float seam = min(min(fract(p.y / w), 1.0 - fract(p.y / w)) * w, min(fract(u), 1.0 - fract(u)) * 2.4);
		c *= mix(0.5, 1.0, smoothstep(0.0, 0.01, seam));
		rough = 0.5;
	} else if (kind == 1) {     // tile: metre squares, grout between
		vec2 g = fract(p);
		float e = min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y));
		c = tint * (0.9 + 0.14 * h1(floor(p)));
		c = mix(c * 0.5, c, smoothstep(0.01, 0.025, e));
		rough = 0.28;
	} else if (kind == 2) {     // carpet: soft, fine and thick
		float n = vn(p * 34.0) * 0.45 + vn(p * 6.0) * 0.55;
		c = tint * (0.78 + 0.34 * n);
		rough = 1.0;
	} else if (kind == 3) {     // concrete
		c = tint * texture(tex, p * tex_scale).rgb * 1.55;
		rough = 0.9;
	} else if (kind == 4) {     // grid: glowing lines on the dark
		vec2 g = abs(fract(p * 0.5) - 0.5);
		float d = 0.5 - max(g.x, g.y);
		float line = 1.0 - smoothstep(0.0, 0.012, d);
		c = tint * 0.6;
		em = glow * line * 2.2 * glow_k;
		rough = 0.25;
		metal = 0.3;
	} else if (kind == 5) {     // grass
		c = tint * texture(tex, p * tex_scale).rgb * 1.7;
		rough = 1.0;
	} else {                    // metal: checker plate
		c = tint * texture(tex, p * tex_scale).rgb * 1.45;
		rough = 0.42;
		metal = 0.65;
	}
	ALBEDO = c;
	ROUGHNESS = rough;
	METALLIC = metal;
	EMISSION = em;
}
"""
const FLOORS := ["wood", "tile", "carpet", "concrete", "grid", "grass", "metal"]
const FLOOR_TEX := {"concrete": ["res://assets/garage/concrete.jpg", 0.18],
	"grass": ["res://assets/textures/grass_grain.jpg", 0.25],
	"metal": ["res://assets/garage/diamond.jpg", 0.6]}

var floor_mat: ShaderMaterial

func _floor() -> void:
	var kind := str(env.get("floor", "concrete"))
	floor_mat = ShaderMaterial.new()
	floor_mat.shader = Shader.new()
	floor_mat.shader.code = FLOOR_SHADER
	floor_mat.set_shader_parameter("kind", maxi(0, FLOORS.find(kind)))
	floor_mat.set_shader_parameter("tint", _col("floorColor", "#9aa3b5"))
	floor_mat.set_shader_parameter("glow", _col("lightColor", "#8ff0ff"))
	if FLOOR_TEX.has(kind) and ResourceLoader.exists(FLOOR_TEX[kind][0]):
		floor_mat.set_shader_parameter("tex", load(FLOOR_TEX[kind][0]))
		floor_mat.set_shader_parameter("tex_scale", FLOOR_TEX[kind][1])
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(W + 0.6, 0.3, D + 0.6)
	mi.mesh = b
	mi.material_override = floor_mat
	mi.position = Vector3(0, -0.15, 0)
	shell.add_child(mi)

func _wall_mat(style: String, c: Color) -> Material:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.9
	match style:
		"brick":
			if ResourceLoader.exists("res://assets/garage/brick.jpg"):
				m.albedo_texture = load("res://assets/garage/brick.jpg")
				m.uv1_triplanar = true
				m.uv1_scale = Vector3(0.3, 0.3, 0.3)
			m.albedo_color = c.lerp(Color.WHITE, 0.45)
		"panel":
			if ResourceLoader.exists("res://assets/garage/cladding.jpg"):
				m.albedo_texture = load("res://assets/garage/cladding.jpg")
				m.uv1_triplanar = true
				m.uv1_scale = Vector3(0.25, 0.25, 0.25)
			m.albedo_color = c.lerp(Color.WHITE, 0.25)
			m.metallic = 0.35
			m.roughness = 0.55
		"glass":
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.albedo_color = Color(c.r, c.g, c.b, 0.14)
			m.roughness = 0.05
			m.metallic = 0.4
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _walls() -> void:
	var style := str(env.get("walls", "plain"))
	var c := _col("wallColor", "#e8e4f0")
	var sides := [[Vector3(0, H / 2.0, -D / 2.0 - 0.15), Vector3(W + 0.6, H, 0.3)],
		[Vector3(0, H / 2.0, D / 2.0 + 0.15), Vector3(W + 0.6, H, 0.3)],
		[Vector3(-W / 2.0 - 0.15, H / 2.0, 0), Vector3(0.3, H, D)],
		[Vector3(W / 2.0 + 0.15, H / 2.0, 0), Vector3(0.3, H, D)]]
	var trim := RoomThings.mat(Color("16161d") if style != "glass" else Color("9aa3b5"), 0.5, 0.5 if style == "glass" else 0.0)
	if style == "none":
		# no walls to see, only the edge of the floor, lit
		for s in sides:
			var edge: Vector3 = s[1]
			RoomThings.box(shell, Vector3(edge.x, 0.06, edge.z), Vector3(s[0].x, 0.03, s[0].z),
				RoomThings.mat(_col("lightColor", "#8ff0ff"), 0.3, 0.0, 1.6))
		return
	var m := _wall_mat(style, c)
	for s in sides:
		var sz: Vector3 = s[1]
		var at: Vector3 = s[0]
		var inward := -Vector3(signf(at.x), 0, signf(at.z))
		# each wall and what hangs on it is one node, so the editor can lift
		# away the walls between its camera and the room
		var wall := Node3D.new()
		wall.set_meta("out", -inward)
		shell.add_child(wall)
		walls_n.append(wall)
		RoomThings.box(wall, s[1], s[0], m)
		# a skirting board along the bottom, and on glass the frame's rails
		var long := Vector3(sz.x if sz.x > 1.0 else 0.08, 0.16, sz.z if sz.z > 1.0 else 0.08)
		RoomThings.box(wall, long, Vector3(at.x, 0.08, at.z) + inward * 0.17, trim)
		if style == "glass":
			RoomThings.box(wall, long, Vector3(at.x, H - 0.08, at.z) + inward * 0.1, trim)
			var along := Vector3(1, 0, 0) if sz.x > 1.0 else Vector3(0, 0, 1)
			for k in [-2, -1, 0, 1, 2]:
				RoomThings.box(wall, Vector3(0.14, H, 0.14), at + along * k * W / 4.2 + inward * 0.05, trim)
		if style == "panel":
			var strip := StandardMaterial3D.new()
			strip.albedo_color = _col("lightColor", "#8ff0ff")
			strip.emission_enabled = true
			strip.emission = strip.albedo_color
			strip.emission_energy_multiplier = 2.0
			glow_mats.append([strip, 2.0])
			RoomThings.box(wall, Vector3(long.x, 0.06, long.z), Vector3(at.x, 2.6, at.z) + inward * 0.17, strip)

func _ceiling() -> void:
	if not bool(env.get("ceiling", true)):
		return
	var c := _col("ceilingColor", "#f4efe6")
	lid = Node3D.new()
	shell.add_child(lid)
	RoomThings.box(lid, Vector3(W + 0.6, 0.3, D + 0.6), Vector3(0, H + 0.15, 0), RoomThings.mat(c, 0.95))
	# light panels let into it, lit by the room's lights
	var panel := StandardMaterial3D.new()
	panel.albedo_color = _col("lightColor", "#ffffff").lerp(Color.WHITE, 0.5)
	panel.emission_enabled = true
	panel.emission = panel.albedo_color
	panel.emission_energy_multiplier = 1.6
	glow_mats.append([panel, 1.6])
	for x in [-W / 4.0, W / 4.0]:
		for z in [-D / 4.0, D / 4.0]:
			RoomThings.box(lid, Vector3(2.6, 0.05, 2.6), Vector3(x, H - 0.01, z), panel)

## Solid whatever the walls look like: glass and "none" still keep you in,
## and a lid stops a flyer leaving through a roof that is not there.
func _bounds() -> void:
	var body := StaticBody3D.new()
	shell.add_child(body)
	var parts := [[Vector3(0, -0.2, 0), Vector3(W + 2, 0.4, D + 2)],
		[Vector3(0, H + 0.25, 0), Vector3(W + 2, 0.5, D + 2)],
		[Vector3(0, H / 2.0, -D / 2.0 - 0.25), Vector3(W + 2, H + 1, 0.5)],
		[Vector3(0, H / 2.0, D / 2.0 + 0.25), Vector3(W + 2, H + 1, 0.5)],
		[Vector3(-W / 2.0 - 0.25, H / 2.0, 0), Vector3(0.5, H + 1, D + 2)],
		[Vector3(W / 2.0 + 0.25, H / 2.0, 0), Vector3(0.5, H + 1, D + 2)]]
	for p in parts:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = p[1]
		cs.shape = bs
		cs.position = p[0]
		body.add_child(cs)

## THE LIGHT PRESETS. Four lamps under the ceiling and one in the middle
## that throws the room's only shadow (one light's shadow is cheap; five is
## not, on the machines a classroom has).
const LIGHTS := {
	"warm": {"energy": 1.5, "ambient": Color(0.55, 0.45, 0.35), "amb": 0.5},
	"cool": {"energy": 1.4, "ambient": Color(0.4, 0.5, 0.62), "amb": 0.5},
	"neon": {"energy": 1.6, "ambient": Color(0.3, 0.2, 0.42), "amb": 0.45},
	"daylight": {"energy": 1.7, "ambient": Color(0.6, 0.62, 0.66), "amb": 0.75},
	"dim": {"energy": 0.55, "ambient": Color(0.3, 0.28, 0.32), "amb": 0.25},
	"party": {"energy": 1.8, "ambient": Color(0.3, 0.2, 0.4), "amb": 0.35},
}

func _lights() -> void:
	var preset := str(env.get("light", "daylight"))
	var c := _col("lightColor", "#ffffff")
	var P: Dictionary = LIGHTS.get(preset, LIGHTS.daylight)
	var bright := float(env.get("brightness", 1.0))
	var q := W / 4.0
	var spots := [Vector3(-q, H - 1.0, -q), Vector3(q, H - 1.0, -q), Vector3(-q, H - 1.0, q), Vector3(q, H - 1.0, q)]
	for i in spots.size():
		var l := OmniLight3D.new()
		l.position = spots[i]
		l.omni_range = 15.0
		l.omni_attenuation = 1.2
		l.light_color = c
		if preset == "neon":
			l.light_color = c if i % 2 == 0 else Color("8ff0ff")
		elif preset == "daylight":
			l.light_color = c.lerp(Color.WHITE, 0.6)
		shell.add_child(l)
		lamps.append([l, float(P.energy) * bright])
	var mid := OmniLight3D.new()
	mid.position = Vector3(0, H - 0.8, 0)
	mid.omni_range = 22.0
	mid.light_color = c.lerp(Color.WHITE, 0.5)
	mid.shadow_enabled = true
	mid.omni_shadow_mode = OmniLight3D.SHADOW_DUAL_PARABOLOID
	shell.add_child(mid)
	lamps.append([mid, float(P.energy) * 0.8 * bright])

func _apply_lights() -> void:
	var k := 1.0 if lights_on else 0.2
	for l in lamps:
		(l[0] as OmniLight3D).light_energy = float(l[1]) * k
	for g in glow_mats:
		(g[0] as StandardMaterial3D).emission_energy_multiplier = float(g[1]) * (1.0 if lights_on else 0.05)
	if floor_mat:
		floor_mat.set_shader_parameter("glow_k", 1.0 if lights_on else 0.3)
	if world and world.env:
		var P: Dictionary = LIGHTS.get(str(env.get("light", "daylight")), LIGHTS.daylight)
		world.env.ambient_light_color = P.ambient
		world.env.ambient_light_energy = float(P.amb) * float(env.get("brightness", 1.0)) * (1.0 if lights_on else 0.5)

## THE EDITOR'S CUTAWAY: from a camera at `eye` (room space) the roof and
## the walls between it and the room are lifted away, the way a doll's house
## opens. Off, and they are all back.
func cutaway(on: bool, eye := Vector3.ZERO) -> void:
	if lid:
		lid.visible = not on
	for w in walls_n:
		var n: Vector3 = w.get_meta("out")
		(w as Node3D).visible = not on or Vector2(eye.x, eye.z).normalized().dot(Vector2(n.x, n.z)) < 0.25

# ============================================================== the sky

const SKY_SHADER := """
shader_type sky;
uniform int mode = 0;       // 0 stars, 1 nebula, 2 sunset, 3 day, 4 void, 5 Wano's night
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
float stars(vec3 d, float dens){
	vec3 p = d * 260.0;
	vec3 i = floor(p);
	float h = hash(i);
	vec3 c = i + 0.5 + (vec3(hash(i + 1.3), hash(i + 2.1), hash(i + 3.7)) - 0.5) * 0.7;
	float s = step(1.0 - dens, h) * smoothstep(0.42, 0.0, length(p - c));
	return s * (0.5 + 0.8 * hash(i + 5.0));
}
void sky(){
	vec3 d = EYEDIR;
	vec3 col;
	if (mode == 3) {
		col = mix(vec3(0.78, 0.87, 0.97), vec3(0.22, 0.47, 0.88), pow(clamp(d.y, 0.0, 1.0), 0.55));
		float cl = fbm(vec3(d.xz / max(0.12, d.y + 0.2) * 1.6, 1.0));
		col = mix(col, vec3(1.0), smoothstep(0.52, 0.78, cl) * smoothstep(-0.02, 0.2, d.y) * 0.85);
		col = mix(col, vec3(0.55, 0.62, 0.55), smoothstep(0.0, -0.08, d.y));
	} else if (mode == 2) {
		float up = clamp(d.y, -0.2, 1.0);
		col = mix(vec3(1.0, 0.55, 0.32), vec3(0.95, 0.35, 0.45), smoothstep(0.0, 0.25, up));
		col = mix(col, vec3(0.28, 0.18, 0.45), smoothstep(0.2, 0.75, up));
		float sunv = pow(max(0.0, dot(d, normalize(vec3(0.0, 0.08, -1.0)))), 300.0);
		col += vec3(1.0, 0.85, 0.6) * sunv * 3.0;
		col += stars(d, 0.006) * smoothstep(0.35, 0.8, up) * 0.8;
		col = mix(col, vec3(0.2, 0.12, 0.18), smoothstep(0.0, -0.1, d.y));
	} else if (mode == 4) {
		col = vec3(0.004, 0.004, 0.01);
	} else {
		col = mode == 5 ? vec3(0.025, 0.03, 0.085) : vec3(0.01, 0.012, 0.03);
		if (mode == 1) {
			float n = fbm(d * 2.3 + vec3(3.0));
			float m = fbm(d * 4.1 + vec3(9.0, 1.0, 4.0));
			col += vec3(0.45, 0.12, 0.55) * smoothstep(0.42, 0.85, n) * 0.9;
			col += vec3(0.08, 0.35, 0.6) * smoothstep(0.45, 0.9, m) * 0.8;
			col += vec3(0.9, 0.4, 0.3) * pow(smoothstep(0.55, 0.95, n * m * 1.8), 2.0) * 0.4;
		}
		col += vec3(stars(d, mode == 1 ? 0.02 : 0.014));
	}
	COLOR = col;
}
"""
const SKIES := ["stars", "nebula", "sunset", "day", "void", "wano"]

func _dress_sky() -> void:
	if world == null or world.env == null:
		return
	var which := str(env.get("sky", "stars"))
	var sm := ShaderMaterial.new()
	sm.shader = Shader.new()
	sm.shader.code = SKY_SHADER
	sm.set_shader_parameter("mode", maxi(0, SKIES.find(which)))
	var sky := Sky.new()
	sky.sky_material = sm
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	var e: Environment = world.env
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	var open := not bool(env.get("ceiling", true)) or str(env.get("walls", "")) in ["glass", "none"]
	e.reflected_light_source = Environment.REFLECTION_SOURCE_SKY if open else Environment.REFLECTION_SOURCE_DISABLED
	e.fog_enabled = false
	e.volumetric_fog_enabled = false
	# Wano's planet and its meteors, seen from here (skyshow.gd)
	if sky_show:
		sky_show.queue_free()
		sky_show = null
	if which == "wano":
		sky_show = SkyShow.new()
		sky_show.world = world
		sky_show.home = Vector3.UP
		get_parent().add_child.call_deferred(sky_show)
	# with the roof off, a sun (or a moon) throws the shadows
	if sun:
		sun.queue_free()
		sun = null
	if not bool(env.get("ceiling", true)):
		sun = DirectionalLight3D.new()
		var day := which == "day" or which == "sunset"
		sun.light_color = Color(1.0, 0.8, 0.6) if which == "sunset" else (Color(1, 0.97, 0.9) if day else Color(0.7, 0.78, 1.0))
		sun.light_energy = 1.1 if day else 0.35
		sun.shadow_enabled = true
		sun.directional_shadow_max_distance = 60.0
		add_child(sun)
		sun.rotation = Vector3(deg_to_rad(-50 if which != "sunset" else -12), deg_to_rad(25), 0)
	_apply_lights()

## A new environment, from the editor or a save: floor, walls, lights and
## sky rebuilt; the things in the room stay where they are.
func set_env(e: Dictionary) -> void:
	env = e.duplicate(true)
	_build_shell()
	_dress_sky()

# ============================================================ the things

## Stand one object up in the room. It is a holder at its spot and turned its
## way, holding what it looks like (scaled), the box your feet meet (if it has
## one) and the box the editor clicks on.
func _add(o: Dictionary) -> Node3D:
	var type := str(o.get("type", ""))
	var sp := spec(type)
	if sp.is_empty():
		return null
	var id := str(o.get("id", ""))
	if id == "":
		id = new_id()
		o["id"] = id
	var props: Dictionary = o.get("props", {}) if o.get("props", {}) is Dictionary else {}
	var s := float(o.get("s", 1.0))
	var holder := Node3D.new()
	holder.name = "o_" + id
	holder.set_meta("id", id)
	holder.set_meta("type", type)
	var v := RoomThings.build(type, props, sp)
	v.name = "v"
	v.scale = Vector3.ONE * s
	holder.add_child(v)
	# the box: the catalog's solid size if it has one, else what it measures
	var box: AABB
	if sp.has("solid"):
		var sd: Array = sp.solid
		var size := Vector3(float(sd[0]), float(sd[1]), float(sd[2])) * s
		box = AABB(Vector3(-size.x / 2.0, 0, -size.z / 2.0), size)
	elif type == "neon_sign":
		# a label measures nothing until it is drawn; a letter is about half a metre
		var wide := maxf(1.0, str(props.get("text", "")).length() * 0.5) * s
		box = AABB(Vector3(-wide / 2.0, -0.5 * s, -0.05), Vector3(wide, s, 0.15))
	else:
		box = Models.bounds(v)
		box = AABB(box.position * s, box.size * s)
		box = box.grow(0.05)
	holder.set_meta("box", box)
	var behavior := str(sp.get("behavior", ""))
	if sp.has("solid") and behavior != "robot" and behavior != "portal":
		var body := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = box.size
		cs.shape = bs
		cs.position = box.get_center()
		body.add_child(cs)
		holder.add_child(body)
	var pick := Area3D.new()
	pick.collision_layer = PICK_LAYER
	pick.collision_mask = 0
	pick.monitoring = false
	pick.set_meta("id", id)
	var pcs := CollisionShape3D.new()
	var pbs := BoxShape3D.new()
	pbs.size = box.size.max(Vector3.ONE * 0.2)
	pcs.shape = pbs
	pcs.position = box.get_center()
	pick.add_child(pcs)
	holder.add_child(pick)
	_place(holder, o)
	add_child(holder)
	nodes[id] = holder
	_behave(holder, type, props)
	if state.has(id):
		_apply_state(id, state[id])
	return holder

func _place(holder: Node3D, o: Dictionary) -> void:
	var p: Array = o.get("p", [0, 0, 0])
	holder.position = Vector3(float(p[0]), float(p[1]), float(p[2]))
	holder.rotation = Vector3(0, deg_to_rad(float(o.get("r", 0))), 0)

func record(id: String) -> Dictionary:
	for o in objects:
		if str(o.get("id", "")) == id:
			return o
	return {}

## The editor's verbs. Each changes the record (what Save sends) and the
## thing you see together, so they can never disagree.
func add_object(type: String, at: Vector3, r := 0.0) -> String:
	var sp := spec(type)
	var o := {"id": new_id(), "type": type, "p": [snappedf(at.x, 0.01), snappedf(maxf(0.0, at.y), 0.01), snappedf(at.z, 0.01)],
		"r": r, "s": 1.0, "props": (sp.get("props", {}) as Dictionary).duplicate(true)}
	objects.append(o)
	_add(o)
	return o.id

func move_object(id: String, p: Vector3, r: float, s: float) -> void:
	var o := record(id)
	if o.is_empty():
		return
	p.x = clampf(p.x, -W / 2.0 + 0.2, W / 2.0 - 0.2)
	p.z = clampf(p.z, -D / 2.0 + 0.2, D / 2.0 - 0.2)
	p.y = clampf(p.y, 0.0, H - 0.2)
	o.p = [snappedf(p.x, 0.01), snappedf(p.y, 0.01), snappedf(p.z, 0.01)]
	o.r = fposmod(r, 360.0)
	var was := float(o.get("s", 1.0))
	o.s = clampf(s, 0.2, 4.0)
	if absf(was - float(o.s)) > 1e-4:
		rebuild(id)
	elif nodes.has(id):
		_place(nodes[id], o)

func rebuild(id: String) -> void:
	if nodes.has(id):
		(nodes[id] as Node3D).free()
		nodes.erase(id)
	var o := record(id)
	if not o.is_empty():
		_add(o)

func remove_object(id: String) -> void:
	for i in objects.size():
		if str(objects[i].get("id", "")) == id:
			objects.remove_at(i)
			break
	if nodes.has(id):
		(nodes[id] as Node3D).queue_free()
		nodes.erase(id)

func duplicate_object(id: String) -> String:
	var o := record(id)
	if o.is_empty():
		return ""
	var c: Dictionary = o.duplicate(true)
	c.id = new_id()
	var p: Array = c.p
	c.p = [clampf(float(p[0]) + 1.2, -W / 2.0 + 0.2, W / 2.0 - 0.2), p[1], clampf(float(p[2]) + 1.2, -D / 2.0 + 0.2, D / 2.0 - 0.2)]
	objects.append(c)
	_add(c)
	return c.id

func set_prop(id: String, key: String, value: Variant) -> void:
	var o := record(id)
	if o.is_empty():
		return
	if not (o.get("props") is Dictionary):
		o.props = {}
	o.props[key] = value
	rebuild(id)

## What the owner's Save sends: the room as it now stands.
func snapshot() -> Dictionary:
	return {"env": env.duplicate(true), "objects": objects.duplicate(true)}

## The room again, as the server now says it is — after a save, a rename, or
## somebody else's edit. What is happening in it (the state) carries over.
func reload(r: Dictionary) -> void:
	for id in nodes:
		(nodes[id] as Node3D).free()
	nodes.clear()
	var old_env := env
	_take(r)
	if JSON.stringify(old_env) != JSON.stringify(env):
		_build_shell()
		_dress_sky()
	for o in objects:
		_add(o)

## The object the editor's ray from `from` along `dir` hits first, if any.
func pick(from: Vector3, dir: Vector3) -> String:
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 200.0, PICK_LAYER)
	q.collide_with_areas = true
	q.collide_with_bodies = false
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return ""
	var c: Object = hit.collider
	return str(c.get_meta("id", "")) if c else ""

# ============================================================ arriving

## Where you come in: in front of the way out, facing into the room.
func spawn() -> Array:
	var best: Node3D = null
	for id in nodes:
		var h: Node3D = nodes[id]
		if str(h.get_meta("type")) == "portal":
			var o := record(id)
			if str((o.get("props", {}) as Dictionary).get("to", "")) == "" or best == null:
				best = h
	var at := global_transform * Vector3(0, 0.05, D / 2.0 - 3.0)
	var face := Vector3(0, 0, -1)
	if best:
		var front := best.global_transform.basis.z.normalized()
		at = best.global_position + front * 5.0
		face = front
	return [at, face]

# ============================================================ what things do

## A behaviour is set up once per thing: the materials that change are made
## its own (the builders share materials between things that look alike).
func _behave(holder: Node3D, type: String, _props: Dictionary) -> void:
	var v := holder.get_node("v")
	for n in ["screen", "panel", "nub"]:
		var mi := v.find_child(n, true, false) as MeshInstance3D
		if mi and mi.material_override:
			mi.material_override = mi.material_override.duplicate()
	match type:
		"jukebox":
			var ap := AudioStreamPlayer3D.new()
			ap.name = "audio"
			ap.position = Vector3(0, 1.2, 0.4)
			ap.unit_size = 9.0
			ap.max_distance = 45.0
			ap.volume_db = -4.0
			holder.add_child(ap)
		"tv":
			_tv(holder, true)
		"arcade":
			_arcade_screen(holder, "PRESS E", Color("0b0d18"))
		"light_switch":
			_switch_look(holder)

## The thing within reach you would use, and what E would do there.
func use_near(p: Vector3) -> Dictionary:
	if editing:
		return {}
	var here := to_local(p)
	var best := {}
	var bd := INF
	var sat := world != null and world.player != null and world.player.seat != null
	for id in nodes:
		var h: Node3D = nodes[id]
		var type := str(h.get_meta("type"))
		var beh := str(spec(type).get("behavior", ""))
		if beh == "":
			continue
		if beh == "seat" and sat:
			continue
		var box: AABB = h.get_meta("box")
		var reach := REACH + maxf(box.size.x, box.size.z) * 0.5
		var d := Vector2(here.x - h.position.x, here.z - h.position.z).length()
		if beh == "lights":
			reach = 1.8
		elif beh == "portal":
			reach = 2.4
		if d > reach or d >= bd:
			continue
		var u := _usage(id, type, beh, h)
		if u.is_empty():
			continue
		bd = d
		best = u
	return best

func _usage(id: String, type: String, beh: String, h: Node3D) -> Dictionary:
	var o := record(id)
	var props: Dictionary = o.get("props", {}) if o.get("props", {}) is Dictionary else {}
	var st: Dictionary = state.get(id, {})
	match beh:
		"seat":
			return {"label": "sit down", "act": func(w): w.player.sit(h.get_node("v"))}
		"portal":
			var to := str(props.get("to", ""))
			if to == "":
				return {"label": "leave the room", "act": func(w): w.leave_room()}
			return {"label": "go to room %s" % to, "act": func(w): w.goto_room(to)}
		"lights":
			return {"label": "lights " + ("off" if lights_on else "on"), "act": func(_w): set_state("lights", {"on": not lights_on})}
		"jukebox":
			var tr := int(st.get("track", -1)) if int(st.get("run", 0)) > 0 else -1
			var next := tr + 1
			var label := "play %s" % JUKE[next].name if next < JUKE.size() else "stop the music"
			return {"label": label, "act": func(_w): set_state(id, {"run": 1, "track": next} if next < JUKE.size() else {"run": 0, "track": -1})}
		"tv":
			var on := bool(st.get("on", true))
			return {"label": "turn the TV " + ("off" if on else "on"), "act": func(_w): set_state(id, {"on": not on})}
		"arcade":
			var label := "play"
			if arcade.get("id", "") == id:
				label = {"wait": "wait for green…", "go": "NOW!", "done": "play again", "early": "play again"}.get(arcade.stage, "play")
			return {"label": label, "act": func(_w): arcade_press(id)}
		"robot":
			var running := float(st.get("run", 0)) > 0.0
			return {"label": "stop the robot" if running and _robot_left(id) > 0.0 else "run the robot's program",
				"act": func(_w): set_state(id, {"run": 0} if running and _robot_left(id) > 0.0 else {"run": 1})}
	return {}

# ------------------------------------------------------------ live state

## Change something everybody sees. It happens here at once, and the server
## hands it on (and back, stamped with its clock if it runs over time).
func set_state(id: String, s: Dictionary) -> void:
	var local := s.duplicate()
	if local.has("run") and float(local.run) > 0.0:
		local.run = now_server() * 1000.0
	_apply_state(id, local)
	if world and world.net:
		world.net.room_state(id, s)

## What the server said (net.gd → room_said): one change, or all of them.
func heard(m: Dictionary) -> void:
	if m.has("now"):
		skew = float(m.now) / 1000.0 - Time.get_unix_time_from_system()
	match str(m.get("t", "")):
		"cro":
			_apply_state(str(m.get("o", "")), m.get("s", {}) if m.get("s") is Dictionary else {})
		"cro_all":
			for x in m.get("states", []):
				if x is Dictionary:
					_apply_state(str(x.get("o", "")), x.get("s", {}) if x.get("s") is Dictionary else {})

func _apply_state(id: String, s: Dictionary) -> void:
	state[id] = s
	if id == "lights":
		lights_on = bool(s.get("on", true))
		_apply_lights()
		for k in nodes:
			if str((nodes[k] as Node3D).get_meta("type")) == "light_switch":
				_switch_look(nodes[k])
		return
	if not nodes.has(id):
		return
	var h: Node3D = nodes[id]
	match str(h.get_meta("type")):
		"jukebox":
			_juke(h, s)
		"tv":
			_tv(h, bool(s.get("on", true)))
		"arcade":
			if not (arcade.get("id", "") == id):
				_arcade_idle(h)
		"robot":
			if float(s.get("run", 0)) <= 0.0:
				_robot_home(id)

func _switch_look(h: Node3D) -> void:
	var nub := h.get_node("v").find_child("nub", true, false) as MeshInstance3D
	if nub == null:
		return
	nub.position.y = 0.03 if lights_on else -0.03
	var m := nub.material_override as StandardMaterial3D
	if m:
		m.emission_energy_multiplier = 0.8 if lights_on else 0.0

# ------------------------------------------------------------ the TV

func _tv(h: Node3D, on: bool) -> void:
	var v := h.get_node("v")
	var screen := v.find_child("screen", true, false) as MeshInstance3D
	var text := v.find_child("text", true, false) as Label3D
	var o := record(str(h.get_meta("id")))
	var words := str((o.get("props", {}) as Dictionary).get("text", ""))
	if screen and screen.material_override:
		var m := screen.material_override as StandardMaterial3D
		m.albedo_color = Color("1f3b5c") if on else Color("0b0c10")
		m.emission = m.albedo_color
		m.emission_energy_multiplier = 1.0 if on else 0.0
	if text:
		text.text = words
		text.visible = on

# ------------------------------------------------------------ the jukebox

## What it plays: Wano's theme, and two loops made the way THE LOOP makes its
## set (club.gd): sixteen steps mixed once into a sample that goes round.
const JUKE := [
	{"name": "WANO THEME", "file": "res://assets/music/ludus-main-theme.mp3"},
	{"name": "THE LOOP", "bpm": 124.0, "pat": [
		[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
		[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]]},
	{"name": "SLOW JAM", "bpm": 86.0, "pat": [
		[1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
		[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1], [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]]},
]

func _juke_stream(i: int) -> AudioStream:
	if _beats.has(i):
		return _beats[i]
	var tr: Dictionary = JUKE[i]
	var s: AudioStream
	if tr.has("file"):
		var mp := load(tr.file) as AudioStreamMP3
		if mp:
			mp.loop = true
		s = mp
	else:
		var per := int(15.0 / float(tr.bpm) * Sound.RATE)
		var n := per * 16
		var mix := PackedFloat32Array()
		mix.resize(n)
		var kit := [Sound.kick(), Sound.clap(), Sound.hat()]
		var line := [0, 0, 3, 0, 5, 0, 3, 0, 0, 0, 7, 0, 5, 3, 0, -2]
		for ix in 16:
			for row in 4:
				if not tr.pat[row][ix]:
					continue
				var d: PackedFloat32Array = kit[row] if row < 3 else Sound.bass(55.0 * pow(2.0, line[ix] / 12.0), 0.5)
				for k in d.size():
					var j := (ix * per + k) % n
					mix[j] += d[k]
		for k in n:
			mix[k] = clampf(mix[k] * 0.8, -1.0, 1.0)
		s = Sound._wav(mix, true)
	_beats[i] = s
	return s

func _juke(h: Node3D, s: Dictionary) -> void:
	var ap := h.get_node_or_null("audio") as AudioStreamPlayer3D
	var tag := h.get_node("v").find_child("tag", true, false) as Label3D
	var tr := int(s.get("track", -1))
	var run := float(s.get("run", 0))
	if ap == null:
		return
	if run <= 0.0 or tr < 0 or tr >= JUKE.size():
		ap.stop()
		if tag:
			tag.text = "JUKEBOX"
		return
	var stream := _juke_stream(tr)
	if stream == null:
		return
	ap.volume_db = -80.0 if Sound.muted() else -4.0
	# everybody hears the same bar: the track started when the server says —
	# and our own change coming back, restamped, is not a reason to skip
	var len := maxf(0.1, stream.get_length())
	var at := fposmod(now_server() - run / 1000.0, len)
	if ap.playing and ap.stream == stream and absf(ap.get_playback_position() - at) < 0.35:
		return
	ap.stream = stream
	ap.play(at)
	if tag:
		tag.text = "♪ " + str(JUKE[tr].name)

# ------------------------------------------------------------ the arcade

## REACTION: wait for green, hit E. The fastest in the room is on the
## cabinet for everybody (its state), until somebody beats it.
func arcade_press(id: String) -> void:
	if not nodes.has(id):
		return
	var h: Node3D = nodes[id]
	if arcade.get("id", "") != id or arcade.stage in ["done", "early"]:
		arcade = {"id": id, "stage": "wait", "t": 0.0, "go": randf_range(1.4, 3.6)}
		_arcade_screen(h, "WAIT FOR\nGREEN…", Color("5c1020"))
		return
	if arcade.stage == "wait":
		arcade.stage = "early"
		_arcade_screen(h, "TOO SOON!", Color("5c1020"))
		return
	if arcade.stage == "go":
		var ms := int((arcade.t - arcade.go) * 1000.0)
		arcade.stage = "done"
		var st: Dictionary = state.get(id, {})
		var best := int(st.get("best", 0))
		var who := str(world.net.me.get("display", "you")) if world and world.net and world.net.signed_in() else "you"
		if best <= 0 or ms < best:
			set_state(id, {"best": ms, "who": who.substr(0, 16)})
			_arcade_screen(h, "%d ms\nNEW BEST!" % ms, Color("0e3b2a"))
			if world and world.hud:
				world.hud.say("%d ms — the best in the room." % ms, 3.0)
		else:
			_arcade_screen(h, "%d ms\nBEST %d" % [ms, best], Color("1a1f3a"))

func _arcade_tick(delta: float) -> void:
	if arcade.is_empty() or not nodes.has(arcade.id):
		arcade = {}
		return
	var h: Node3D = nodes[arcade.id]
	arcade.t += delta
	if arcade.stage == "wait" and arcade.t >= arcade.go:
		arcade.stage = "go"
		_arcade_screen(h, "NOW!", Color("1f9d4a"))
	# walk away and the game is over
	if world and world.player and to_local(world.player.global_position).distance_to(h.position) > 5.0:
		_arcade_idle(h)
		arcade = {}

func _arcade_idle(h: Node3D) -> void:
	var st: Dictionary = state.get(str(h.get_meta("id")), {})
	var best := int(st.get("best", 0))
	_arcade_screen(h, "PRESS E" if best <= 0 else "BEST %d ms\n%s" % [best, str(st.get("who", ""))], Color("0b0d18"))

func _arcade_screen(h: Node3D, text: String, c: Color) -> void:
	var v := h.get_node("v")
	var screen := v.find_child("screen", true, false) as MeshInstance3D
	var l := v.find_child("text", true, false) as Label3D
	if screen and screen.material_override:
		var m := screen.material_override as StandardMaterial3D
		m.albedo_color = c
		m.emission = c
	if l:
		l.text = text

# ------------------------------------------------------------ the robot

## A ROBOT RUNS A PROGRAM MADE OF KORO'S BLOCKS — the same ids, the same
## meanings as public/vm.js: `move 30 steps` is three metres forward, `turn z
## by 90` a quarter turn, `repeat` and `forever` loop what is inside them up
## to their `end`. It runs from `when ▶ the game starts`.
##
## THE RUN IS A FUNCTION OF TIME. The program is unrolled once into a
## timeline of glides, turns, waits and speech; where the robot is is then
## worked out from how long ago the server says it was set going. Every
## screen asks the same question with the same clock, so everybody sees the
## robot in the same place — including somebody who walks in halfway.
var _programs := {}            # id -> {key, segs, total}

func _timeline(id: String) -> Dictionary:
	var o := record(id)
	var prog: Array = (o.get("props", {}) as Dictionary).get("program", [])
	var p: Array = o.get("p", [0, 0, 0])
	var key := JSON.stringify([prog, p, o.get("r", 0)])
	if _programs.has(id) and _programs[id].key == key:
		return _programs[id]
	var tl := compile(prog, Vector2(float(p[0]), float(p[2])), deg_to_rad(float(o.get("r", 0))), W, D)
	tl.key = key
	_programs[id] = tl
	return tl

## The steps after the flag, loops unrolled — a forever is capped, so a
## timeline is always finite (ten minutes, or four hundred steps).
static func unroll(prog: Array) -> Array:
	var start := -1
	for i in prog.size():
		if prog[i] is Array and str(prog[i][0]) == "event.flag":
			start = i
			break
	var out := []
	if start < 0:
		return out
	_unroll(prog.slice(start + 1), 0, prog.size() - start - 1, out)
	return out

static func _end_of(body: Array, i: int) -> int:
	var depth := 0
	for k in range(i + 1, body.size()):
		var op := str(body[k][0])
		if op == "ctrl.repeat" or op == "ctrl.forever":
			depth += 1
		elif op == "ctrl.end":
			if depth == 0:
				return k
			depth -= 1
	return body.size()

static func _unroll(body: Array, from: int, to: int, out: Array) -> void:
	var i := from
	while i < to and out.size() < 400:
		var step: Array = body[i]
		var op := str(step[0])
		if op == "ctrl.repeat" or op == "ctrl.forever":
			var e := mini(_end_of(body, i), to)
			var n := 1000 if op == "ctrl.forever" else clampi(int(float(step[1]) if step.size() > 1 else 0.0), 0, 1000)
			for _k in n:
				var before := out.size()
				_unroll(body, i + 1, e, out)
				if out.size() >= 400 or out.size() == before:
					break
			i = e + 1
		elif op == "ctrl.end" or op == "event.flag":
			i += 1
		else:
			out.append(step)
			i += 1

## The timeline: [{t0, t1, p0, p1, y0, y1, say}], a robot's pose between.
## Yaw is Godot's (rotation about up); `turn z by 90` turns it to its right.
static func compile(prog: Array, home: Vector2, yaw: float, w: float, d: float) -> Dictionary:
	var segs := []
	var pos := home
	var y := yaw
	var tt := 0.0
	var lim := Vector2(w / 2.0 - 0.6, d / 2.0 - 0.6)
	for step in unroll(prog):
		var op := str(step[0])
		var a1: Variant = step[1] if step.size() > 1 else null
		var a2: Variant = step[2] if step.size() > 2 else null
		var seg := {"t0": tt, "p0": pos, "y0": y, "say": ""}
		var dur := 0.0
		match op:
			"motion.move":
				var dist := float(a1) * STEP_M
				var to := pos + Vector2(sin(y), cos(y)) * dist
				# a wall stops it: it glides as far as it can, and waits out the rest
				var fr := 1.0
				var delta := to - pos
				for ax in 2:
					if absf(delta[ax]) > 1e-6:
						if to[ax] > lim[ax]:
							fr = minf(fr, (lim[ax] - pos[ax]) / delta[ax])
						elif to[ax] < -lim[ax]:
							fr = minf(fr, (-lim[ax] - pos[ax]) / delta[ax])
				fr = clampf(fr, 0.0, 1.0)
				pos = pos + delta * fr
				dur = maxf(0.15, absf(dist) / 1.6)
				seg.frac = fr
			"motion.turn":
				var n := float(a2)
				if str(a1) == "z":
					y -= deg_to_rad(n)
				dur = maxf(0.1, absf(n) / 200.0)
			"motion.face":
				# 0 is away from the door (-z), 90 to the right (+x)
				var want := PI - deg_to_rad(float(a1))
				var dy := wrapf(want - y, -PI, PI)
				y += dy
				dur = maxf(0.1, absf(rad_to_deg(dy)) / 200.0)
			"ctrl.wait":
				dur = clampf(float(a1), 0.0, 60.0)
			"looks.sayFor":
				seg.say = str(a1)
				dur = clampf(float(a2), 0.0, 60.0)
		seg.t1 = tt + dur
		seg.p1 = pos
		seg.y1 = y
		segs.append(seg)
		tt += dur
		if tt > 600.0:
			break
	return {"segs": segs, "total": tt, "home": home, "yaw": yaw}

## Where the robot is `at` seconds into its run: {p, y, say, moving}.
static func pose_at(tl: Dictionary, at: float) -> Dictionary:
	var segs: Array = tl.segs
	if segs.is_empty():
		return {"p": tl.home, "y": tl.yaw, "say": "", "moving": false}
	if at >= float(tl.total):
		var last: Dictionary = segs[segs.size() - 1]
		return {"p": last.p1, "y": last.y1, "say": "", "moving": false}
	for s in segs:
		if at < float(s.t1):
			var u := clampf((at - float(s.t0)) / maxf(1e-4, float(s.t1) - float(s.t0)), 0.0, 1.0)
			var e := u * u * (3.0 - 2.0 * u)
			var p: Vector2 = s.p0
			if s.has("frac"):
				var fr: float = s.frac
				p = (s.p0 as Vector2).lerp(s.p1, clampf(e / maxf(1e-4, fr), 0.0, 1.0) if fr > 0.0 else 0.0)
			return {"p": p, "y": lerp_angle(float(s.y0), float(s.y1), e), "say": s.say,
				"moving": (s.p0 as Vector2).distance_to(s.p1) > 0.01 or absf(float(s.y1) - float(s.y0)) > 0.01}
	var z: Dictionary = segs[segs.size() - 1]
	return {"p": z.p1, "y": z.y1, "say": "", "moving": false}

func _robot_left(id: String) -> float:
	var run := float((state.get(id, {}) as Dictionary).get("run", 0))
	if run <= 0.0:
		return 0.0
	return float(_timeline(id).total) - (now_server() - run / 1000.0)

func _robot_home(id: String) -> void:
	if not nodes.has(id):
		return
	var h: Node3D = nodes[id]
	_place(h, record(id))
	var say := h.get_node("v").find_child("say", true, false) as Label3D
	if say:
		say.text = ""

## Test a program in the editor without telling anybody: the same timeline,
## on this screen alone.
var trial := {}                # {id, prog, t}

func try_program(id: String, prog: Array) -> void:
	var o := record(id)
	if o.is_empty():
		return
	var p: Array = o.get("p", [0, 0, 0])
	trial = {"id": id, "t": 0.0, "tl": compile(prog, Vector2(float(p[0]), float(p[2])), deg_to_rad(float(o.get("r", 0))), W, D)}

func _robots(delta: float) -> void:
	if not trial.is_empty():
		trial.t += delta
		_pose(trial.id, trial.tl, trial.t)
		if trial.t > float(trial.tl.total) + 1.5:
			_robot_home(trial.id)
			trial = {}
	if editing:
		return
	for id in state:
		if not nodes.has(id) or str((nodes[id] as Node3D).get_meta("type")) != "robot":
			continue
		var run := float((state[id] as Dictionary).get("run", 0))
		if run <= 0.0:
			continue
		_pose(id, _timeline(id), now_server() - run / 1000.0)

func _pose(id: String, tl: Dictionary, at: float) -> void:
	if not nodes.has(id):
		return
	var h: Node3D = nodes[id]
	var ps := pose_at(tl, at)
	var p: Vector2 = ps.p
	var base: Array = record(id).get("p", [0, 0, 0])
	h.position = Vector3(p.x, float(base[1]) + (absf(sin(t * 18.0)) * 0.03 if ps.moving else 0.0), p.y)
	h.rotation = Vector3(0, float(ps.y), 0)
	var say := h.get_node("v").find_child("say", true, false) as Label3D
	if say:
		say.text = str(ps.say)

# ============================================================== the clock

## A PORTAL STEPS ASIDE FOR THE CAMERA. It stands just off a wall, and a
## camera behind you backs up against that wall — straight through the ring,
## which then fills the screen with light. Close up, it fades away.
func _portals() -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	for id in nodes:
		var h: Node3D = nodes[id]
		if str(h.get_meta("type")) != "portal":
			continue
		var v := h.get_node("v")
		var f := clampf((cam.global_position.distance_to(h.global_position + Vector3(0, 1.5, 0)) - 2.2) / 2.8, 0.0, 1.0)
		var ring := v.get_node_or_null("ring") as MeshInstance3D
		if ring:
			ring.visible = f > 0.01
			var m := ring.material_override as StandardMaterial3D
			m.albedo_color.a = f
			m.emission_energy_multiplier = 2.5 * f
		var disc := v.get_node_or_null("disc") as MeshInstance3D
		if disc:
			disc.visible = f > 0.01
			(disc.material_override as ShaderMaterial).set_shader_parameter("fade", f)
		var tag := v.get_node_or_null("tag") as Label3D
		if tag:
			tag.modulate.a = f
			tag.outline_modulate.a = f

func _process(delta: float) -> void:
	t += delta
	_robots(delta)
	if not arcade.is_empty():
		_arcade_tick(delta)
	# the globe turns; the party lights go round the colours
	for id in nodes:
		var h: Node3D = nodes[id]
		if str(h.get_meta("type")) == "globe":
			var g := h.get_node("v").get_node_or_null("spin") as Node3D
			if g:
				g.rotation.y += delta * 0.25
	_portals()
	if str(env.get("light", "")) == "party" and lights_on:
		for i in lamps.size():
			(lamps[i][0] as OmniLight3D).light_color = Color.from_hsv(fposmod(t * 0.12 + i * 0.21, 1.0), 0.75, 1.0)
