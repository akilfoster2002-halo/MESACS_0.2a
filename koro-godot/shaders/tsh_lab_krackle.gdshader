// TSH · the krackle swarm (public/tshlab.js): dots orbiting the field, each a black core in a coloured rim, inked.
// A cloud of points; each point's orbit is its CUSTOM0 (aS: phase, radius, speed, size)
shader_type spatial;
render_mode unshaded, fog_disabled, cull_disabled;
uniform vec3 uRim = vec3(1.0, 0.1, 0.7);
uniform float uScale = 420.0;
varying float vPu;
void vertex(){
	vec4 aS = CUSTOM0; float uT = TIME;
	float a = aS.x + uT*aS.z, r = aS.y*(1.0 + 0.18*sin(uT*2.3 + aS.x*3.0));
	vec3 p = vec3(cos(a)*r, sin(a*1.31 + aS.x)*r*0.55, sin(a)*r); float t = aS.x*2.0;
	p.xy = mat2(vec2(cos(t), -sin(t)), vec2(sin(t), cos(t)))*p.xy;
	VERTEX = p;
	vec4 mv = MODELVIEW_MATRIX*vec4(p, 1.0); vPu = 0.55 + 0.45*sin(uT*6.0 + aS.x*7.0);
	POINT_SIZE = aS.w*vPu*uScale/max(0.2, -mv.z);
}
void fragment(){
	vec2 c = POINT_COORD - 0.5; float d = length(c); if(d > 0.5) discard;
	float core = smoothstep(0.3, 0.24, d), ink = smoothstep(0.43, 0.47, d);
	vec3 col = mix(uRim*(2.0 + vPu), vec3(0.03, 0.0, 0.07), core); col = mix(col, vec3(0.02, 0.0, 0.04), ink);
	ALBEDO = col;
}
