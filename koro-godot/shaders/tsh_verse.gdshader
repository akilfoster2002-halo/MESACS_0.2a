// INTO THE SPIDER-VERSE, as TSH draws it in the browser (public/tshlook.js, `verse`): a painted (Kuwahara) finish,
// the colour plates off register more with distance (the depth buffer), sharpened after the brush, ink wherever one
// thing stands in front of another, and the glow round every light printed as halftone dots. A full-screen quad in
// front of the camera (tsh/stage.gd puts it there); `verse` 0 turns it all off.
shader_type spatial;
render_mode unshaded, depth_test_disabled, depth_draw_never, cull_disabled, fog_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform float verse : hint_range(0.0, 1.0) = 1.0;
uniform float glow_threshold = 0.85;
uniform float dot_size = 4.0;

void vertex(){ POSITION = vec4(VERTEX.xy, 1.0, 1.0); }

float view_z(vec2 uv, mat4 inv_proj){
	float d = texture(depth_tex, uv).r;
	vec4 v = inv_proj*vec4(uv*2.0 - 1.0, d, 1.0);
	return -v.z/v.w;
}
vec3 kuwahara(vec2 uv, vec2 px){
	vec3 best = texture(screen_tex, uv).rgb; float bv = 1e9;
	for(int q = 0; q < 4; q++){
		vec2 dir = vec2(q == 0 || q == 3 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
		vec3 m = vec3(0.0), m2 = vec3(0.0);
		for(int i = 0; i < 3; i++) for(int j = 0; j < 3; j++){
			vec3 c = texture(screen_tex, uv + dir*vec2(float(i), float(j))*px*0.5).rgb;
			m += c; m2 += c*c; }
		m /= 9.0; vec3 v = m2/9.0 - m*m; float vv = v.r + v.g + v.b;
		if(vv < bv){ bv = vv; best = m; }
	}
	return best;
}
void fragment(){
	vec2 res = VIEWPORT_SIZE, px = 1.0/res;
	vec2 uv = SCREEN_UV, d = uv - 0.5; float r2 = dot(d, d);
	uv = 0.5 + d*(1.0 - 0.02*verse*r2*4.0);                                   // a touch of barrel lens
	vec3 c0 = texture(screen_tex, uv).rgb;
	vec3 col = c0;
	if(verse > 0.001){
		vec3 paint = kuwahara(uv, px*(1.4 + verse*0.6));
		float vz = view_z(uv, INV_PROJECTION_MATRIX);
		float far = smoothstep(4.0, 40.0, vz);
		vec2 off = vec2(1.0, 0.35)*px*(0.8 + 2.7*far)*verse;
		vec3 fr = vec3(texture(screen_tex, uv + off).r - c0.r, 0.0, texture(screen_tex, uv - off).b - c0.b);
		col = mix(col, paint, 0.45*verse) + fr*verse*0.8;
		vec3 nb = texture(screen_tex, uv + vec2(px.x, 0.0)).rgb + texture(screen_tex, uv - vec2(px.x, 0.0)).rgb
			+ texture(screen_tex, uv + vec2(0.0, px.y)).rgb + texture(screen_tex, uv - vec2(0.0, px.y)).rgb;
		col = max(col + (c0 - nb*0.25)*0.6*verse, vec3(0.0));
		// ink where the depth jumps
		float zl = view_z(uv - vec2(px.x, 0.0), INV_PROJECTION_MATRIX), zr = view_z(uv + vec2(px.x, 0.0), INV_PROJECTION_MATRIX);
		float zu = view_z(uv + vec2(0.0, px.y), INV_PROJECTION_MATRIX), zd = view_z(uv - vec2(0.0, px.y), INV_PROJECTION_MATRIX);
		float jump = (abs(zl + zr - 2.0*vz) + abs(zu + zd - 2.0*vz))/max(vz, 0.5);
		float ink = smoothstep(0.06, 0.2, jump)*(1.0 - smoothstep(25.0, 60.0, vz));
		col = mix(col, col*0.12, ink*0.85*verse);
		// the glow printed as dots: the light that spills (a blurred, thresholded copy of the picture) only where a dot is
		vec3 glow = max(textureLod(screen_tex, uv, 4.0).rgb + textureLod(screen_tex, uv, 5.5).rgb*0.7 - glow_threshold, vec3(0.0));
		float bl = dot(glow, vec3(0.333)); bl = bl/(1.0 + bl);
		vec2 g = mat2(vec2(0.966, 0.259), vec2(-0.259, 0.966))*(FRAGCOORD.xy/dot_size);
		float rad = sqrt(clamp(bl*1.6, 0.0, 1.0))*0.62, dt = length(fract(g) - 0.5);
		float dotm = 1.0 - smoothstep(rad - 0.06, rad + 0.06, dt);
		col += glow*dotm*1.4*verse;
	}
	ALBEDO = col;
}
