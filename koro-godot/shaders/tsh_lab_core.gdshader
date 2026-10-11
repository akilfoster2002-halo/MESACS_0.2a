// TSH · the Psi field's core (public/tshlab.js coreMat): plasma swirling, banded the way a comic colours it, and
// the krackle's black blots boiling up through it
shader_type spatial;
render_mode unshaded, fog_disabled;
uniform float uPulse = 0.6;
varying vec3 vP;
float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
	return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
		mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.03 + 1.7; a *= 0.5; } return s; }
void vertex(){ vP = VERTEX; }
void fragment(){
	float uT = TIME;
	float ndv = abs(dot(normalize(NORMAL), normalize(VIEW))), rim = 1.0 - ndv;
	vec3 p = vP*4.2; float a = uT*0.9 + p.y*0.6; p.xz = mat2(vec2(cos(a), -sin(a)), vec2(sin(a), cos(a)))*p.xz;
	float n = fbm(p + vec3(0.0, -uT*1.3, uT*0.4));
	float band = smoothstep(0.47, 0.5, fract(n*3.0 - uT*0.35));
	vec3 hot = vec3(1.25, 0.85, 1.3), mag = vec3(1.5, 0.12, 1.0), vio = vec3(0.45, 0.12, 1.4), cy = vec3(0.15, 1.2, 1.6);
	vec3 col = mix(hot, mag, smoothstep(0.0, 0.45, rim + n*0.5 - 0.15));
	col = mix(col, vio, smoothstep(0.55, 0.95, rim));
	col = mix(col, cy, band*0.45*(1.0 - rim));
	col *= 0.55 + uPulse*0.4;
	float blot = smoothstep(0.66, 0.7, fbm(p*1.6 + vec3(uT*0.7, 0.0, -uT*0.5)));
	col = mix(col, vec3(0.02, 0.0, 0.05), blot*0.92);
	ALBEDO = col;
}
