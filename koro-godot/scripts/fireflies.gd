## FIREFLIES — four thousand of them, and one draw call.
##
## Each one owns a slow lissajous round a home spot a little over the grass,
## in that spot's own tangent frame, and a phase of its own. The browser
## rewrote every position into a buffer each frame; here the orbit is worked
## out on the graphics card from the clock, so it costs the CPU nothing.
## Most of them near the town, where you will walk through them; the rest
## anywhere on the ball. They pulse, all slightly out of step.
class_name Fireflies
extends MultiMeshInstance3D

const COUNT := 4000
const SPREAD := 170.0

func _ready() -> void:
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, skip_vertex_transform;
uniform vec3 tint : source_color = vec3(1.0, 0.94, 0.63);
uniform float size = 0.62;
varying float vPh;
varying float vNear;
void vertex(){
	vec4 c = INSTANCE_CUSTOM;              // phase, speed, how far, 0
	float tt = TIME * c.y + c.x * 6.2832;
	vec3 off = vec3(sin(tt) * c.z, sin(tt * 1.31) * 0.5, sin(tt * 0.73 + 1.1) * c.z);
	vec4 mv = MODELVIEW_MATRIX * vec4(off, 1.0);
	mv.xy += VERTEX.xy * size;
	VERTEX = mv.xyz;
	vPh = c.x;
	// one right in front of the lens is a blur the size of the screen, not an insect
	vNear = smoothstep(0.8, 4.0, -mv.z);
}
void fragment(){
	float d = length(UV - 0.5) * 2.0;
	// the soft round falloff of the browser's spark texture
	float a = d < 0.25 ? mix(1.0, 0.85, d / 0.25)
			: d < 0.6 ? mix(0.85, 0.18, (d - 0.25) / 0.35)
			: mix(0.18, 0.0, clamp((d - 0.6) / 0.4, 0.0, 1.0));
	float pulse = 0.55 + 0.4 * abs(sin(TIME * 1.6 + vPh * 2.0));
	ALBEDO = tint * a * pulse * vNear;
}
"""
	var q := QuadMesh.new()
	q.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = q
	mm.instance_count = COUNT
	var town := Planet.dir_of(0, 0)
	var fr := Planet.frame_at(town)
	for i in COUNT:
		var d: Vector3
		if randf() < 0.75:
			var a := randf() * TAU
			var r := sqrt(randf()) * SPREAD
			d = Planet.walk(town, (fr.x * cos(a) + fr.z * sin(a)).normalized(), r)
		else:
			d = Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized()
		# not indoors and not over the pool: out in the grass
		var tries := 0
		while (Planet.pad_k(d) < 0.9 or Planet.near_basin(d, 1.05)) and tries < 8:
			d = Planet.walk(d, Planet.frame_at(d, randf() * TAU).z, 30.0)
			tries += 1
		var h := Planet.height(d) + 0.4 + randf() * 1.8
		mm.set_instance_transform(i, Transform3D(Planet.frame_at(d), d * (Planet.R + h)))
		mm.set_instance_custom_data(i, Color(randf(), 0.35 + randf() * 0.9, 0.7 + randf() * 1.8, 0))
	mm.custom_aabb = AABB(Vector3.ONE * -Planet.R * 1.2, Vector3.ONE * Planet.R * 2.4)
	multimesh = mm
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
