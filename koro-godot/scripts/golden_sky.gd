## WANO'S SKY, the website's (koro-landing src/shared/sky.js, and the web
## game's public/skydome.js): golden hour instead of night. A gradient from
## horizon to zenith, the sun as a disc with a close glow and a wide bloom,
## a few stars where the sky is dark enough. The mood is the demo island's:
## MOODS.gold mixed toward MOODS.dusk by 0.34, the sun 12 degrees up in the
## south-west.
##
## ON A BALL, "UP" IS WHEREVER YOU ARE STANDING. Godot's sky is drawn along
## world directions, so the shader is handed the camera's own up every frame
## (the line from the middle of the planet through the camera) and measures
## height against that; the sun is set in that same frame, so it sits at the
## same height over every horizon on Wano. The light that was the moon
## follows the sun round and takes its colour, and the ambient and the fog
## warm to match.
class_name GoldenSky
extends Node

const MIX := 0.34
const SUN_ELEV := 12.0
const SUN_AZ := 205.0

static func _mix(a: String, b: String) -> Color:
	return Color(a).lerp(Color(b), MIX)

var env: Environment
var sun_light: DirectionalLight3D
var mat: ShaderMaterial

const SHADER := """
shader_type sky;
uniform vec3 up_dir = vec3(0.0, 1.0, 0.0);
uniform vec3 sun_dir = vec3(0.0, 0.2, -1.0);
uniform vec3 zenith : source_color;
uniform vec3 mid : source_color;
uniform vec3 horizon : source_color;
uniform vec3 ground : source_color;
uniform vec3 sun_color : source_color;
uniform float sun_size = 1.43;
uniform float sun_glow = 0.6;
uniform float stars = 0.1;

float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }

void sky() {
	vec3 d = normalize(EYEDIR);
	float h = dot(d, normalize(up_dir));
	vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
	col = mix(col, zenith, smoothstep(0.22, 0.95, h));
	col = mix(col, ground, smoothstep(0.0, -0.35, h));
	if (stars > 0.0) {
		vec3 p = d * 260.0;
		float r = hash3(floor(p));
		vec3 f = fract(p) - 0.5;
		float star = smoothstep(0.08, 0.0, length(f)) * step(0.985, r);
		float tw = 0.65 + 0.35 * sin(TIME * (1.0 + r * 4.0) + r * 60.0);
		col += vec3(1.0, 0.95, 0.9) * star * tw * stars * smoothstep(0.35, 0.8, h) * 2.2;
	}
	float sd = max(dot(d, normalize(sun_dir)), 0.0);
	float ang = acos(clamp(sd, -1.0, 1.0));
	float size = radians(sun_size);
	float disc = smoothstep(size, size * 0.92, ang);
	col = mix(col, sun_color * 3.0, disc);
	col += sun_color * (pow(sd, 90.0) * 0.9 + pow(sd, 10.0) * 0.35 + pow(sd, 2.5) * 0.12) * sun_glow;
	COLOR = col;
}
"""

func setup(e: Environment, light: DirectionalLight3D) -> GoldenSky:
	env = e
	sun_light = light
	var sh := Shader.new()
	sh.code = SHADER
	mat = ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("zenith", _mix("#2f5fae", "#10133d"))
	mat.set_shader_parameter("mid", _mix("#7fa3d6", "#4a2f86"))
	mat.set_shader_parameter("horizon", _mix("#ffd4a0", "#ff8a5c"))
	mat.set_shader_parameter("ground", _mix("#6a7ba0", "#2a1d3e"))
	mat.set_shader_parameter("sun_color", _mix("#fff1d6", "#ffc98f"))
	var sky := Sky.new()
	sky.sky_material = mat
	# a background, not a light source: the ambient stays a colour, so a
	# uniform that changes every frame costs nothing in radiance updates
	sky.process_mode = Sky.PROCESS_MODE_REALTIME
	sky.radiance_size = Sky.RADIANCE_SIZE_32
	env.sky = sky
	env.background_mode = Environment.BG_SKY
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = _mix("#cfe0ff", "#9d86e6")
	env.ambient_light_energy = 0.75
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.fog_light_color = _mix("#d9b9a6", "#8e5f94")
	env.fog_density *= 0.6
	if sun_light:
		sun_light.light_color = _mix("#ffe2bd", "#ffa878")
		sun_light.light_energy = 1.6
	return self

## The sun in the camera's own frame: SUN_ELEV up from its horizon, SUN_AZ
## round from its north (the way the web version measures it).
func _process(_dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if not cam or not mat:
		return
	var up := cam.global_position.normalized()
	if up.length_squared() < 0.5:
		return
	var north := (Vector3.UP - up * up.y).normalized()
	if north.length_squared() < 0.5:
		north = Vector3(0, 0, -1)
	var east := north.cross(up).normalized()
	var e := deg_to_rad(SUN_ELEV)
	var a := deg_to_rad(SUN_AZ)
	var s := (east * sin(a) * cos(e) + up * sin(e) + north * cos(a) * cos(e)).normalized()
	mat.set_shader_parameter("up_dir", up)
	mat.set_shader_parameter("sun_dir", s)
	if sun_light:
		# a directional light only has a direction: shine along the sun's
		sun_light.global_transform.basis = Basis.looking_at(-s, up)
