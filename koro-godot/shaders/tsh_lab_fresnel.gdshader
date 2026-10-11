// TSH · the lab's glow (public/tshlab.js, its fresnel ShaderMaterial): bright at the edges, optionally a hex grid
// and a scan running up it; added onto what is behind it
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, fog_disabled;
uniform vec3 uCol = vec3(0.1, 0.7, 1.0);
uniform float uK = 1.0;
uniform float uPow = 2.0;
uniform float uHex = 0.0;
uniform float uScan = 0.0;
void fragment(){
	float uT = TIME;
	float f = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), uPow);
	float a = f;
	vec2 vUv = vec2(UV.x, 1.0 - UV.y);
	if(uHex > 0.5){ vec2 g = vUv*vec2(48.0, 22.0); vec2 r = vec2(1.0, 1.732); vec2 h = r*0.5;
		vec2 q1 = mod(g, r) - h, q2 = mod(g - h, r) - h; vec2 q = dot(q1, q1) < dot(q2, q2) ? q1 : q2;
		float edge = smoothstep(0.42, 0.47, max(abs(q.x)*0.866 + abs(q.y)*0.5, abs(q.y))); a += edge*0.22; }
	if(uScan > 0.5){ float s = fract(vUv.y - uT*0.25); a += smoothstep(0.0, 0.02, s)*smoothstep(0.06, 0.02, s)*1.6; a += step(0.5, fract(vUv.y*120.0))*0.04; }
	ALBEDO = uCol*a*uK;
}
