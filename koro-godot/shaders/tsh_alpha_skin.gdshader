// TSH · ITS SKIN (public/tshalpha.js, the monster's material): Alpha's black — glossy, wet, alive: the surface crawls,
// pale lights open and shut in it, and torn streaks of colour flicker down it
shader_type spatial;
#include "res://shaders/tsh_alpha_noise.gdshaderinc"
uniform float uT = 0.0;
uniform float uAmp = 0.05;
varying vec3 vSP;
void vertex(){
	vSP = VERTEX;
	float nn = aNoise(VERTEX*4.0 + vec3(0.0, uT*1.1, uT*0.5)) + 0.6*aNoise(VERTEX*8.5 - vec3(uT*1.6));
	VERTEX += NORMAL*(nn - 0.8)*uAmp;
}
void fragment(){
	ALBEDO = vec3(0.012, 0.012, 0.02); ROUGHNESS = 0.07; METALLIC = 0.4; SPECULAR = 0.7;
	vec3 e = vec3(0.0);
	vec3 cell = floor(vSP*5.0); float h = aHash(cell + 7.1);
	vec3 f = fract(vSP*5.0) - 0.5; float d = length(f);
	float open = max(0.0, sin(uT*(0.6 + h*1.4) + h*40.0));
	e += vec3(2.4, 2.5, 2.7)*(1.0 - smoothstep(0.05, 0.12 + 0.04*open, d))*step(0.82, h)*open;
	float sn = aNoise(vec3(vSP.x*38.0, vSP.y*1.6 - uT*0.9, vSP.z*38.0) + floor(uT*7.0)*3.1);
	float st = smoothstep(0.78, 0.88, sn)*1.6;
	float which = aHash(floor(vec3(vSP.x*38.0, uT*3.0, vSP.z*38.0)));
	e += (which < 0.4 ? vec3(2.2, 0.15, 1.4) : which < 0.75 ? vec3(0.1, 1.8, 2.2) : vec3(2.4, 0.8, 0.1))*st;
	EMISSION = e;
}
