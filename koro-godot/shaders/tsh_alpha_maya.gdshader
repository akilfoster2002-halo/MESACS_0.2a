// TSH · ALPHA, IN MAYA (public/tshalpha.js apply): the black comes up out of her hands, up her arms, over all of her
// — glossy black, pale lights opening in it — and while it takes her it tears into bands of colour. Her own colours
// underneath (albedo_tex), her skinning and her clips untouched.
shader_type spatial;
#include "res://shaders/tsh_alpha_noise.gdshaderinc"
uniform sampler2D albedo_tex : source_color, hint_default_white;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform float roughness = 0.7;
uniform float uCover = 0.0; uniform float uGlitch = 0.0; uniform float uT = 0.0;
uniform vec3 uMin = vec3(0.0); uniform vec3 uMax = vec3(1.0);
uniform float uArm[128];
varying vec3 vAP; varying float vArm;
void vertex(){
	vAP = (VERTEX - uMin)/max(uMax - uMin, vec3(1e-4));
	vArm = uArm[min(int(BONE_INDICES.x), 127)]*BONE_WEIGHTS.x + uArm[min(int(BONE_INDICES.y), 127)]*BONE_WEIGHTS.y + uArm[min(int(BONE_INDICES.z), 127)]*BONE_WEIGHTS.z + uArm[min(int(BONE_INDICES.w), 127)]*BONE_WEIGHTS.w;
}
void fragment(){
	vec3 base = texture(albedo_tex, UV).rgb*albedo_color.rgb;
	float aN = aNoise(vAP*vec3(9.0, 22.0, 9.0) + vec3(0.0, uT*0.35, 0.0));
	float aE = vArm*0.85 + aN*0.15 - (1.0 - uCover*1.15);
	float aOn = smoothstep(0.0, 0.08, aE);
	float aR = smoothstep(0.0, 0.05, aE) - smoothstep(0.05, 0.16, aE);
	ALBEDO = mix(base, vec3(0.012, 0.012, 0.018), aOn);
	ROUGHNESS = mix(roughness, 0.12, aOn);
	vec3 e = vec3(0.0);
	float node = smoothstep(0.74, 0.8, aNoise(vAP*vec3(20.0, 46.0, 20.0) + 3.1))*(0.6 + 0.4*sin(uT*3.0 + vAP.y*40.0));
	e += vec3(0.85, 0.92, 1.0)*node*aOn*4.0;
	e += vec3(0.35, 0.3, 0.55)*aR*0.6;
	float band = step(0.965, fract(vAP.y*7.0 + uT*5.0 + aNoise(vec3(vAP.y*30.0, uT*9.0, 0.0))*2.0))*step(0.45, aNoise(vec3(vAP.y*4.0, floor(uT*12.0), 1.0)));
	e += aHue(vAP.x*3.0 + vAP.y*2.0 + uT*0.7)*band*uGlitch*(0.4 + aOn)*2.0;
	EMISSION = e;
}
