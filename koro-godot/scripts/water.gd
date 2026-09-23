## WATER — the shaders and the shapes they are drawn on.
##
## Ported from the browser's islands.js, and for the same reason they are
## shaders there: every streak, drop, splash and ripple is a function of the
## clock, so the CPU does no work per frame at all. The falls are WORKED OUT,
## not drawn — the sheet is a ribbon along the projectile the water actually
## follows, parameterised by seconds since it left the lip, so the streaks
## ride with the water: slow and bunched at the top, stretched at the bottom.
##
## The browser wrote its colours straight to the screen; Godot works in
## linear light and converts on the way out, so every colour here goes
## through lin() first or the water comes out washed pale.
class_name Water
extends RefCounted

const GRAV := 9.8

const NOISE := """
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }
vec3 lin(vec3 c){ return pow(max(c, vec3(0.)), vec3(2.2)); }
"""

static var _cache := {}

static func _shader(key: String, code: String) -> Shader:
	if not _cache.has(key):
		var s := Shader.new()
		s.code = code
		_cache[key] = s
	return _cache[key]

## THE SHEET. u runs across it, v is SECONDS SINCE THE LIP. Coherent and
## glassy where it leaves, torn into ropes and holes further down.
static func sheet(seed: float, alpha: float, tf: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("sheet", """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix;
uniform float seed; uniform float alpha_k; uniform float tf; uniform float light = 0.9;
""" + NOISE + """
void fragment(){
	float t=UV.y, k=clamp(t/tf,0.,1.), u=UV.x;
	float along=(t-TIME)*2.4;
	float rope=fbm(vec2(u*7.+seed, along));
	float fine=vn(vec2(u*31.+seed*3., (t-TIME)*9.));
	float frayed=u*(1.-u)*4.;
	float edge=smoothstep(0., .35+.35*k, frayed*(.55+.9*rope));
	float holes=mix(1., smoothstep(.28, .62, rope+fine*.25), .25+.6*k);
	float a=alpha_k*edge*holes*mix(1., .75, k);
	vec3 col=mix(vec3(.58,.78,.9), vec3(.97,.99,1.), clamp(rope*.9+fine*.45+k*.35,0.,1.));
	ALBEDO=lin(col*light); ALPHA=a;
}
""")
	m.set_shader_parameter("seed", seed)
	m.set_shader_parameter("alpha_k", alpha)
	m.set_shader_parameter("tf", tf)
	m.render_priority = 2
	return m

## A ribbon along the arc p(t) = lip + v·t − ½·g·t²·up, denser near the lip
## where the arc bends hardest.
static func arc_ribbon(lip: Vector3, vel: Vector3, side: Vector3, tf: float, w0: float,
		grow: float, n := 64) -> ArrayMesh:
	var pos := PackedVector3Array()
	var uv := PackedVector2Array()
	var idx := PackedInt32Array()
	for i in n + 1:
		var s := float(i) / n
		var t := tf * s * s * 0.35 + tf * s * 0.65
		var c := lip + vel * t
		c.y += -0.5 * GRAV * t * t
		var w := (w0 + grow * t) * 0.5
		pos.append(c - side * w)
		pos.append(c + side * w)
		uv.append(Vector2(0, t))
		uv.append(Vector2(1, t))
		if i < n:
			var a := i * 2
			idx.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
	return _mesh(pos, uv, idx)

static func _mesh(pos: PackedVector3Array, uv: PackedVector2Array, idx: PackedInt32Array,
		nrm := PackedVector3Array()) -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = pos
	if nrm.size() == pos.size():
		arr[Mesh.ARRAY_NORMAL] = nrm
	arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m

## PARTICLES ON THE GRAPHICS CARD. Each quad carries four random numbers and
## nothing else; where it is is the projectile equation at its own age. Three
## kinds share the program: 0 drops off the lip, 1 splash, 2 mist.
static func particles(n: int, mode: int, u: Dictionary) -> MultiMeshInstance3D:
	var mat := ShaderMaterial.new()
	mat.shader = _shader("parts", """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix, skip_vertex_transform;
uniform float mode; uniform vec3 lip; uniform vec3 vel; uniform vec3 side; uniform float tf;
uniform vec3 hit; uniform float surf; uniform float w; uniform float size; uniform float alpha_k;
varying float vA;
const float G = 9.8;
void vertex(){
	vec4 s = INSTANCE_CUSTOM;
	vec3 p; float sz = size; vA = 1.;
	float T = TIME;
	if(mode < 0.5){
		float life=tf*(1.+.12*s.w);
		float age=fract(T/life+s.x)*life;
		vec3 v=vel*(.8+.4*s.z) + side*(s.w-.5)*1.6 + vec3(0.,(s.z-.5)*1.2,0.);
		p=lip + side*(s.y-.5)*w + v*age + vec3(0.,-.5*G*age*age,0.);
		vA=smoothstep(0.,.25,age)*step(surf,p.y);
		sz*= .6+.8*s.y;
	} else if(mode < 1.5){
		float life=.7+1.1*s.w;
		float age=fract(T/life+s.x)*life;
		float a=s.y*6.2832;
		vec3 o=vec3(cos(a),0.,sin(a));
		float hs=1.2+4.5*s.z*s.z, vy=3.5+8.*s.w;
		p=hit + o*(s.z*w*.5) + o*hs*age + vec3(0.,vy*age-.5*G*age*age,0.);
		vA=(1.-age/life)*step(surf-.2,p.y);
		sz*= .5+1.1*s.z;
	} else {
		float life=4.+3.*s.w;
		float age=fract(T/life+s.x)*life;
		float a=s.y*6.2832;
		vec3 o=vec3(cos(a),0.,sin(a));
		p=hit + o*(1.+s.z*w) + o*age*(.8+s.z) + vec3(0.,age*(1.+1.4*s.w),0.);
		vA=sin(3.1416*age/life);
		sz*= (.6+age/life*1.6)*(.7+.6*s.z);
	}
	vec4 mv = MODELVIEW_MATRIX * vec4(p, 1.0);
	mv.xy += VERTEX.xy * sz * 0.56;
	VERTEX = mv.xyz;
}
void fragment(){
	float d = length(UV - .5);
	float a = smoothstep(.5, 0., d) * vA * alpha_k;
	if(a < .01) discard;
	ALBEDO = vec3(.85,.93,1.); ALPHA = a;
}
""")
	mat.set_shader_parameter("mode", float(mode))
	for k in ["lip", "vel", "side", "hit"]:
		mat.set_shader_parameter(k, u.get(k, Vector3.ZERO))
	mat.set_shader_parameter("tf", u.get("tf", 1.0))
	mat.set_shader_parameter("surf", u.get("surf", 0.0))
	mat.set_shader_parameter("w", u.get("w", 1.0))
	mat.set_shader_parameter("size", u.get("size", 1.0))
	mat.set_shader_parameter("alpha_k", u.get("alpha", 1.0))
	mat.render_priority = 3
	var q := QuadMesh.new()
	q.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = q
	mm.instance_count = n
	for i in n:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(randf(), randf(), randf(), randf()))
	mm.custom_aabb = AABB(Vector3(-200, -200, -200), Vector3(400, 400, 400))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

## THE PLUNGE POOL: deep in the middle, clearer over the shelf, rings running
## out from where the column hits and white water churned up round it.
static func pool(radius: float, foam: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("pool", """
shader_type spatial;
render_mode cull_back, depth_draw_always, blend_mix;
uniform float R; uniform float foam_r; uniform vec2 hit;
varying vec3 vP;
""" + NOISE + """
void vertex(){ vP = VERTEX; }
void fragment(){
	vec2 q=vP.xz-hit;
	float r=length(q);
	float ring=sin(r*1.35-TIME*4.2)*exp(-r*.07);
	float n=fbm(vP.xz*.22+vec2(TIME*.05,-TIME*.04));
	float chop=fbm(vP.xz*1.1+vec2(TIME*.4,TIME*.3));
	float foamN=fbm(q*.8+normalize(q+1e-4)*(-TIME*1.6));
	float foam=smoothstep(foam_r,foam_r*.25,r)*smoothstep(.32,.62,foamN+.18*ring);
	foam=max(foam, smoothstep(foam_r*.4,0.,r)*(.75+.25*foamN));
	float shelf=smoothstep(R*.45,R*1.02,length(vP.xz));
	vec3 col=mix(vec3(.05,.22,.34), vec3(.16,.47,.56), shelf*.7+n*.35);
	col+=vec3(.20,.28,.30)*max(0.,ring)*smoothstep(R,0.,r)*.55;
	col+=vec3(.06)*smoothstep(.55,.8,chop);
	col=mix(col, vec3(.9,.96,1.), clamp(foam,0.,1.));
	ALBEDO=lin(col); ALPHA=mix(.86,.97,foam);
	ROUGHNESS=mix(.08,.6,foam); SPECULAR=.6;
	EMISSION=lin(col)*.18;
}
""")
	m.set_shader_parameter("R", radius)
	m.set_shader_parameter("foam_r", foam)
	m.set_shader_parameter("hit", Vector2.ZERO)
	m.render_priority = 1
	return m

## FLOWING WATER on a ribbon whose v is metres downstream: bands of foam and
## glints carried along, white at the banks. The river and the island's
## stream are both this.
static func flow(speed: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("flow", """
shader_type spatial;
render_mode cull_disabled, depth_draw_always, blend_mix, skip_vertex_transform;
uniform float spd;
uniform float pull = 1.4;
""" + NOISE + """
// DRAWN A LITTLE NEARER THAN IT IS. The ground is a mesh of five-metre
// triangles and the river is draped on the true hills, which the mesh only
// touches at its corners — so here and there the grass stands a hand's
// breadth above the water. Sliding every vertex along the line to the eye
// changes its depth and nothing else: it lands on the same pixel.
void vertex(){
	vec4 v = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	float d = length(v.xyz);
	v.xyz *= max(0.05, d - pull) / d;
	VERTEX = v.xyz;
	NORMAL = normalize((MODELVIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment(){
	float u=UV.x, v=UV.y;
	float fl=fbm(vec2(u*3.2, v*2.4-TIME*spd));
	float glint=vn(vec2(u*14., v*9.-TIME*spd*2.2));
	float bank=1.-smoothstep(0.,.16,u)*smoothstep(1.,.84,u);
	vec3 col=mix(vec3(.10,.36,.52), vec3(.22,.58,.70), fl);
	col=mix(col, vec3(.88,.95,1.), clamp(smoothstep(.62,.9,fl)*.6+bank*.55*fl+smoothstep(.8,.97,glint)*.5,0.,1.));
	ALBEDO=lin(col); ALPHA=.9;
	ROUGHNESS=.12; SPECULAR=.6;
	EMISSION=lin(col)*.12;
}
""")
	m.set_shader_parameter("spd", speed)
	m.render_priority = 1
	return m

## A cap, not a disc, because the planet is a ball: every vertex at one
## ALTITUDE, which is what level means on a sphere. Built in a frame whose
## origin is on the ground at R0 from the middle of the planet.
static func cap(r: float, r0: float, surf: float, rings := 14, segs := 72) -> ArrayMesh:
	var pos := PackedVector3Array()
	var uv := PackedVector2Array()
	var idx := PackedInt32Array()
	var top := r0 + surf
	var nrm := PackedVector3Array()
	for j in rings + 1:
		var d := r * float(j) / rings
		for i in segs:
			var a := TAU * i / segs
			var x := cos(a) * d
			var z := sin(a) * d
			var y := sqrt(maxf(0.0, top * top - d * d)) - r0
			pos.append(Vector3(x, y, z))
			nrm.append(Vector3(x, y + r0, z).normalized())
			uv.append(Vector2(x, z))
	for j in rings:
		for i in segs:
			var a := j * segs + i
			var b := j * segs + (i + 1) % segs
			var c := a + segs
			var e := b + segs
			idx.append_array([a, e, b, a, c, e])
	return _mesh(pos, uv, idx, nrm)

## A ribbon through points, laid along their own right, `wide` a function of
## how far along it is. v is metres downstream / `per`.
static func ribbon(pts: Array, ups: Array, wide: Callable, per: float) -> ArrayMesh:
	var pos := PackedVector3Array()
	var uv := PackedVector2Array()
	var idx := PackedInt32Array()
	var n := pts.size()
	var run := 0.0
	var nrm := PackedVector3Array()
	for i in n:
		var p: Vector3 = pts[i]
		var nx: Vector3 = pts[mini(n - 1, i + 1)]
		var pv: Vector3 = pts[maxi(0, i - 1)]
		var t := (nx - pv).normalized()
		var up: Vector3 = ups[i]
		var right := up.cross(t).normalized()
		var w: float = wide.call(float(i) / maxf(1.0, n - 1))
		if i > 0:
			run += p.distance_to(pts[i - 1])
		pos.append(p + right * w)
		pos.append(p - right * w)
		nrm.append(up.normalized())
		nrm.append(up.normalized())
		uv.append(Vector2(0, run / per))
		uv.append(Vector2(1, run / per))
		if i < n - 1:
			var a := i * 2
			idx.append_array([a, a + 1, a + 2, a + 1, a + 3, a + 2])
	return _mesh(pos, uv, idx, nrm)
