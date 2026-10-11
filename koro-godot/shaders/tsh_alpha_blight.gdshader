// TSH · THE BLIGHT (public/tshalpha.js): where it puts a foot down, the floor goes the way it is — a wet black blot
// spreading out from the footprint, veins of black creeping on past it, colour tearing through it, pale lights in it
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, fog_disabled;
#include "res://shaders/tsh_alpha_noise.gdshaderinc"
uniform float uT = 0.0; uniform float uAge = 99.0; uniform float uSeed = 0.0; uniform float uLife = 30.0;
void fragment(){
	vec2 p = UV*2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
	float grow = 1.0 - exp(-uAge*1.6);
	float fade = 1.0 - smoothstep(uLife*0.6, uLife, uAge);
	float n = aNoise(vec3(p*3.0, uSeed)) + 0.5*aNoise(vec3(p*7.0, uSeed + 3.0));
	float blot = 1.0 - smoothstep(0.38*grow, 0.38*grow + 0.05, r + (n - 0.75)*0.45);
	float vein = (1.0 - smoothstep(0.0, 0.05 + 0.03*(1.0 - r), abs(sin(a*6.0 + n*5.0 + uSeed))))*(1.0 - smoothstep(0.95*grow, 1.0*grow, r))*step(0.3, r);
	float ink = max(blot, vein*0.85);
	vec3 c = vec3(0.004, 0.004, 0.008);
	float st = smoothstep(0.8, 0.9, aNoise(vec3(p.x*30.0, p.y*2.0 - uT*0.8, uSeed) + floor(uT*7.0)*3.1));
	float which = aHash(floor(vec3(p.x*30.0, uT*3.0, uSeed)));
	c += (which < 0.4 ? vec3(2.2, 0.15, 1.4) : which < 0.75 ? vec3(0.1, 1.8, 2.2) : vec3(2.4, 0.8, 0.1))*st*blot;
	vec2 cell = floor(p*9.0); float h = aHash(vec3(cell, uSeed)); vec2 f = fract(p*9.0) - 0.5;
	c += vec3(2.4, 2.5, 2.7)*(1.0 - smoothstep(0.06, 0.14, length(f)))*step(0.86, h)*max(0.0, sin(uT*(0.6 + h*1.4) + h*40.0))*blot;
	c += vec3(0.08, 0.05, 0.12)*(smoothstep(0.42*grow - 0.08, 0.42*grow, r + (n - 0.75)*0.35)*blot);
	ALBEDO = c; ALPHA = ink*fade*0.95;
}
