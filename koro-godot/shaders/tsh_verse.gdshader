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
// HAYWIRE (tsh.js tickHaywire, the alpha): the picture tears into bands and slips its colour plates, the colour goes
// round the wheel, the edges darken. All 0 = untouched.
uniform float glitch = 0.0;
uniform float ca = 0.0;
uniform float hue = 0.0;
uniform float vig = 0.0;
uniform float contrast = 0.0;
uniform float time = 0.0;
// THE COMIC (tshlook.js uComic): ink where the light changes, Ben-Day dots in the half shadow, hatching in the dark,
// the colour posterised — printed, not rendered. The station goes to it as it goes haywire.
uniform float comic = 0.0;

float lum_of(vec2 p){ vec3 c = texture(screen_tex, p).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); return l/(1.0 + l); }
// the browser grades after its tonemapping; here the picture is still linear light, so the grade is done in a
// stand-in for display values (Reinhard, then gamma) and taken back out
vec3 to_disp(vec3 c){ return pow(c/(1.0 + c), vec3(1.0/2.2)); }
vec3 from_disp(vec3 t){ vec3 l = pow(clamp(t, 0.0, 0.995), vec3(2.2)); return l/(1.0 - l); }
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
	if(glitch > 0.0){ float band = floor(uv.y*24.0 + floor(time*14.0)*7.0); float h = fract(sin(band*91.7 + floor(time*14.0))*43758.5);
		uv.x += (h - 0.5)*glitch*0.25*step(0.6, h); }
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
	// the plates off register: red one way, blue the other, further towards the edges (tshlook.js: uCA, and uComic/uGlitch)
	vec2 mis = vec2(2.2, -1.4)*px*(comic + glitch*9.0*(0.6 + 0.4*sin(time*23.0)))*(1.0 + r2*6.0);
	if(ca > 0.0 || comic > 0.0 || glitch > 0.0){
		col.r += texture(screen_tex, uv - d*ca*r2 + mis).r - c0.r; col.b += texture(screen_tex, uv + d*ca*r2 - mis).b - c0.b; col = max(col, vec3(0.0)); }
	if(hue != 0.0){ vec3 k = vec3(0.57735); col = col*cos(hue) + cross(k, col)*sin(hue) + k*dot(k, col)*(1.0 - cos(hue)); }   // radians, as the browser's
	if(vig > 0.0){ col *= 1.0 - vig*smoothstep(0.15, 0.7, r2*2.0); }
	if(contrast > 0.0 || comic > 0.0){
		vec3 c1 = to_disp(col);
		// high contrast: the blacks crushed, the lights pushed, an S through the middle
		if(contrast > 0.0) c1 = mix(c1, smoothstep(0.07, 0.82, c1)*1.08, contrast);
		if(comic > 0.001){
			vec3 cc = c1;
			float tl = lum_of(uv + px*vec2(-1.0, -1.0)), t_ = lum_of(uv + px*vec2(0.0, -1.0)), tr = lum_of(uv + px*vec2(1.0, -1.0));
			float l_ = lum_of(uv + px*vec2(-1.0, 0.0)), r_ = lum_of(uv + px*vec2(1.0, 0.0));
			float bl = lum_of(uv + px*vec2(-1.0, 1.0)), b_ = lum_of(uv + px*vec2(0.0, 1.0)), br = lum_of(uv + px*vec2(1.0, 1.0));
			float gx = -tl - 2.0*l_ - bl + tr + 2.0*r_ + br, gy = -bl - 2.0*b_ - br + tl + 2.0*t_ + tr;
			float edge = smoothstep(0.13, 0.3, length(vec2(gx, gy)));
			float lum = dot(cc, vec3(0.299, 0.587, 0.114));
			vec3 ink = vec3(0.05, 0.015, 0.1);
			vec2 g = mat2(vec2(0.7071, 0.7071), vec2(-0.7071, 0.7071))*(FRAGCOORD.xy/5.5);
			float dd = length(fract(g) - 0.5), rad = sqrt(clamp(1.0 - lum*1.7, 0.0, 1.0))*0.6;
			float dots = 1.0 - smoothstep(rad - 0.07, rad + 0.07, dd);
			vec3 cm = mix(cc, cc*0.35 + ink*0.4, dots*smoothstep(0.62, 0.18, lum)*0.85);
			vec2 g2 = mat2(vec2(0.966, 0.259), vec2(-0.259, 0.966))*(FRAGCOORD.xy/4.0);
			float hd = 1.0 - smoothstep(0.18, 0.26, length(fract(g2) - 0.5));
			float sat = max(cc.r, max(cc.g, cc.b)) - min(cc.r, min(cc.g, cc.b));
			cm = mix(cm, cm*vec3(1.08, 0.82, 1.12), hd*smoothstep(0.55, 0.9, lum)*sat);
			float hatch = step(0.62, fract((FRAGCOORD.x + FRAGCOORD.y)/5.0));
			cm = mix(cm, ink, hatch*smoothstep(0.14, 0.03, lum)*0.75);
			cm = mix(cm, floor(cm*7.0 + 0.5)/7.0, 0.3);
			float m = dot(cm, vec3(0.333)); cm = mix(vec3(m), cm, 1.25);
			cm = mix(cm, ink, edge*0.92);
			c1 = mix(cc, clamp(cm, 0.0, 1.0), comic);
		}
		col = from_disp(c1);
	}
	ALBEDO = col;
}
