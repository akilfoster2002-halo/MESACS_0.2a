// TSH · the lab's emitter beams (public/tshlab.js): bands running along them, brightest face-on; added
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, fog_disabled;
uniform vec3 uCol = vec3(0.5, 0.2, 1.0);
uniform float uK = 1.0;
void fragment(){
	float uT = TIME; vec2 vUv = vec2(UV.x, 1.0 - UV.y);
	float c = pow(abs(dot(normalize(NORMAL), normalize(VIEW))), 2.0);
	float s = 0.55 + 0.45*sin(vUv.y*46.0 - uT*24.0); float s2 = 0.5 + 0.5*sin(vUv.y*13.0 + uT*9.0);
	ALBEDO = uCol*c*(s*0.7 + s2*0.5)*uK;
}
