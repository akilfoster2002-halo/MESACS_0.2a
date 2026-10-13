## ROBIN'S ROOM, LIVED IN. The apartment as exported is a set: a bed, walls, a few posters. This dresses her corner of
## it as a sixteen-year-old's room — the wall behind the bed painted warm and covered (band posters, the moon, a print
## that says good things take time, vinyl, a wire grid of polaroids), fairy lights swagged under ivy along the top of
## it, a sherpa duvet and a chunky knit throw, pillows and a teddy and a bunny and a heart, a nightstand (the lamp, a
## candle, tulips, her instant camera, books, her school ID on its lanyard), a low shelf of records and plants behind
## the bed, her school bag and her homework — and her cat, black, asleep (bedroom_cat.gd).
## The soft things are sculpted in tools/bedroom_props.py; everything else is made here, its pictures drawn here.
## Built once into the apartment (it shows and hides with it).
class_name Bedroom
extends Node3D

const PROPS := "res://assets/tsh/props/room/"
const WALL_Z := 3.996                      # the wall behind the bed (the apartment's south wall is at z = 4)

var R: Dictionary
var cat: BedroomCat
var fairy: Array = []                      # [light, energy]
var bulbs: MultiMeshInstance3D
var candle: OmniLight3D; var flame: MeshInstance3D
var lamp: OmniLight3D; var shade_m: StandardMaterial3D
var spots := {}                            # what the opening frames: name → Vector3
var lit := true
var _t := 0.0
var _rng := RandomNumberGenerator.new()

func build(apt: Node3D, room: Dictionary) -> void:
	R = room; _rng.seed = 2044
	apt.add_child(self); name = "Bedroom"
	var bed: Dictionary = R.bed; var top: float = bed.top
	var bx: float = bed.x; var bz: float = bed.z
	_wall()
	_shelf(Vector3(bx + 0.35, 0, 3.78))
	_nightstand(Vector3(bx - 1.32, 0, bz + 0.05))
	_bedding(bx, bz, top)
	_collage(bx)
	_fairy_lights(bx)
	_rug(Vector3(bx + 0.1, 0, bz - 1.25))
	_school(bx, bz, top)
	cat = BedroomCat.new(); add_child(cat)
	cat.spots = {
		"bed": [Vector3(bx + 0.74, top + 0.085, bz + 0.2), 2.6],
		"shelf": [Vector3(bx + 0.75, 0.725, 3.79), 0.0],
	}
	cat.place("bed")
	spots.cat = cat.global_position

func _process(dt: float) -> void:
	_t += dt
	if candle and lit:
		var f := 0.75 + 0.18*sin(_t*11.0) + 0.1*sin(_t*23.0 + 1.3) + 0.06*sin(_t*37.0)
		candle.light_energy = 0.3*f; flame.scale = Vector3(1, 0.85 + 0.25*f, 1)
	if lit:
		for i in fairy.size(): (fairy[i][0] as OmniLight3D).light_energy = fairy[i][1]*(0.93 + 0.07*sin(_t*1.7 + i*1.9))

## the fairy lights, the candle and the lamp, on or off (the lamp goes off at the end of the opening)
func lights(v: bool) -> void:
	lit = v
	for f in fairy: (f[0] as OmniLight3D).light_energy = f[1] if v else 0.0
	if bulbs: bulbs.visible = v
	if candle: candle.light_energy = 0.3 if v else 0.0; flame.visible = v
	if lamp: lamp.light_energy = 0.45 if v else 0.0
	if shade_m: shade_m.emission_energy_multiplier = 0.7 if v else 0.0

# ================================================================== making things
func _mat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.roughness = rough; m.metallic = metal
	if metal == 0.0: m.metallic_specular = 0.25                    # matte things: the teal of the room not mirrored in them
	return m
func _tex_mat(t: Texture2D, rough := 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_texture = t; m.roughness = rough; m.metallic_specular = 0.2; m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC; return m
func _glow(c: Color, e: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c*e; return m
func _box(size: Vector3, at: Vector3, m: Material, parent: Node3D = self) -> MeshInstance3D:
	var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = size; b.mesh = bm; b.material_override = m; b.position = at; parent.add_child(b); return b
func _cyl(r: float, h: float, at: Vector3, m: Material, parent: Node3D = self, r2 := -1.0, seg := 24) -> MeshInstance3D:
	var b := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = r; cm.bottom_radius = r if r2 < 0 else r2; cm.height = h
	cm.radial_segments = seg; cm.rings = 1; b.mesh = cm; b.material_override = m; b.position = at; parent.add_child(b); return b
func _ball(r: float, at: Vector3, m: Material, parent: Node3D = self) -> MeshInstance3D:
	var b := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = r; sm.height = r*2; sm.radial_segments = 16; sm.rings = 8
	b.mesh = sm; b.material_override = m; b.position = at; parent.add_child(b); return b
## a soft thing from tools/bedroom_props.py, its own colours (vertex colours) as its albedo, a little fuzz on it
func prop(nm: String, at: Vector3, ry := 0.0, parent: Node3D = self, fuzz := 0.6) -> Node3D:
	var n: Node3D = (load(PROPS + nm + ".glb") as PackedScene).instantiate(); parent.add_child(n)
	n.position = at; n.rotation.y = ry
	var m := StandardMaterial3D.new(); m.vertex_color_use_as_albedo = true; m.roughness = 0.95
	m.normal_enabled = true; m.normal_texture = _fuzz(); m.normal_scale = fuzz; m.uv1_triplanar = true; m.uv1_scale = Vector3.ONE*14
	m.rim_enabled = true; m.rim = 0.25; m.rim_tint = 0.6; m.metallic_specular = 0.15
	for c in n.find_children("*", "MeshInstance3D", true, false): (c as MeshInstance3D).material_override = m
	return n
## a picture, flat on a wall: its face to `face` (+Z or -Z or ±X), standing off the wall a hair
func picture(t: Texture2D, w: float, h: float, at: Vector3, face := Vector3(0, 0, -1), tilt := 0.0, rough := 0.7) -> MeshInstance3D:
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(w, h); q.mesh = qm
	q.material_override = _tex_mat(t, rough); add_child(q); q.position = at
	q.look_at(at - face, Vector3.UP); q.rotate_object_local(Vector3(0, 0, 1), tilt)
	return q
func text3(s: String, at: Vector3, size: float, c: Color, face := Vector3(0, 0, -1), parent: Node3D = self, w := 0.0) -> Label3D:
	var l := Label3D.new(); l.text = s; l.pixel_size = size/64.0; l.font_size = 64; l.modulate = c; l.outline_size = 0
	# drawn in the opaque pass: the Spider-Verse quad reads the screen before anything transparent draws (TSH_PORT.md)
	l.alpha_cut = Label3D.ALPHA_CUT_DISCARD
	l.shaded = true; l.double_sided = false; l.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	if w > 0: l.autowrap_mode = TextServer.AUTOWRAP_WORD; l.width = w/l.pixel_size
	parent.add_child(l); l.position = at; l.look_at(at - face, Vector3.UP)
	return l

# ================================================================== pictures (drawn here: no files)
static var _fz: Texture2D
func _fuzz() -> Texture2D:
	if _fz: return _fz
	var n := FastNoiseLite.new(); n.frequency = 0.09; n.fractal_octaves = 3
	var t := NoiseTexture2D.new(); t.width = 256; t.height = 256; t.seamless = true; t.as_normal_map = true; t.bump_strength = 6.0; t.noise = n
	_fz = t; return t
func _img(w: int, h: int, c: Color) -> Image:
	var im := Image.create(w, h, false, Image.FORMAT_RGBA8); im.fill(c); return im
func _tex(im: Image) -> ImageTexture:
	im.generate_mipmaps(); return ImageTexture.create_from_image(im)
func _rect(im: Image, x: int, y: int, w: int, h: int, c: Color) -> void:
	im.fill_rect(Rect2i(x, y, w, h).intersection(Rect2i(0, 0, im.get_width(), im.get_height())), c)
func _disc(im: Image, cx: float, cy: float, r: float, c: Color, ring := -1.0) -> void:
	for y in range(maxi(0, int(cy - r - 1)), mini(im.get_height(), int(cy + r + 2))):
		for x in range(maxi(0, int(cx - r - 1)), mini(im.get_width(), int(cx + r + 2))):
			var d := Vector2(x + 0.5 - cx, y + 0.5 - cy).length()
			if d <= r and (ring < 0 or d >= r - ring):
				var a := clampf(r - d, 0, 1)*c.a
				im.set_pixel(x, y, im.get_pixel(x, y).lerp(Color(c, 1), a))
func _vgrad(im: Image, a: Color, b: Color, y0 := 0, y1 := -1) -> void:
	if y1 < 0: y1 = im.get_height()
	for y in range(y0, y1):
		var c := a.lerp(b, float(y - y0)/maxf(1, y1 - y0 - 1))
		for x in im.get_width(): im.set_pixel(x, y, c)
func _skyline(im: Image, y0: int, c: Color, seed: int) -> void:
	var r := RandomNumberGenerator.new(); r.seed = seed; var x := 0
	while x < im.get_width():
		var w := r.randi_range(3, 9); var h := r.randi_range(4, int(im.get_height()*0.35))
		_rect(im, x, y0 - h, w, h + im.get_height(), c); x += w + r.randi_range(0, 2)

## a band poster: black, a white waveform across its middle
func _poster_wave() -> Texture2D:
	var im := _img(256, 340, Color("#0d0d0f"))
	for i in 120:
		var x := 18 + i*1.85; var a := absf(sin(i*0.21)*cos(i*0.05))*58.0 + absf(sin(i*0.9))*10 + 2
		_rect(im, int(x), int(190 - a), 1, int(a*2), Color("#f4efe6"))
	return _tex(im)
## a band poster: mountains as contour lines, black on cream border
func _poster_lines() -> Texture2D:
	var im := _img(256, 340, Color("#111113"))
	for j in 26:
		var base := 120 + j*7.0
		for x in 236:
			var y := base - 60.0*exp(-pow((x - 128.0)/52.0, 2))*(1.0 - j/30.0) - 8*sin(x*0.07 + j)
			_rect(im, 10 + x, int(y), 1, 1, Color("#e9e4da").darkened(j*0.015))
	return _tex(im)
## the moon, big and grey over a black field, a few stars
func _poster_moon() -> Texture2D:
	var im := _img(256, 340, Color("#0b0b0d")); var r := RandomNumberGenerator.new(); r.seed = 7
	for i in 90: _rect(im, r.randi_range(0, 255), r.randi_range(0, 339), 1, 1, Color(0.9, 0.9, 0.95, 1)*r.randf_range(0.3, 1))
	var n := FastNoiseLite.new(); n.frequency = 0.035; n.seed = 3
	var cx := 128.0; var cy := 150.0; var R0 := 92.0
	for y in range(int(cy - R0), int(cy + R0) + 1):
		for x in range(int(cx - R0), int(cx + R0) + 1):
			var d := Vector2(x - cx, y - cy).length()
			if d > R0: continue
			var v := 0.62 + 0.25*n.get_noise_2d(x, y) - 0.18*smoothstep(0.55, 1.0, d/R0)
			var mare := n.get_noise_2d(x*0.5 + 300, y*0.5)
			if mare > 0.15: v -= 0.18
			im.set_pixel(x, y, Color(v, v, v*1.02).lerp(im.get_pixel(x, y), clampf(d - R0 + 1, 0, 1)))
	for i in 14: _disc(im, cx + r.randf_range(-70, 70), cy + r.randf_range(-70, 70), r.randf_range(3, 9), Color(0.35, 0.35, 0.37, 0.35), 1.5)
	# flowers in silhouette at its foot
	for i in 9:
		var x := 20 + i*27 + r.randi_range(-6, 6); var top := r.randi_range(250, 290)
		_rect(im, x, top, 2, 340 - top, Color("#050505")); _disc(im, x + 1, top, r.randf_range(5, 9), Color("#050505"))
	return _tex(im)
## "good things take time": cream, terracotta — the words are Label3D, this is the paper
func _poster_cream() -> Texture2D:
	var im := _img(200, 250, Color("#efe4d2"))
	_rect(im, 8, 8, 184, 1, Color("#b5532f")); _rect(im, 8, 241, 184, 1, Color("#b5532f"))
	return _tex(im)
## butterflies, pinned in rows, on cream
func _poster_butterflies() -> Texture2D:
	var im := _img(240, 300, Color("#f1e9dc")); var r := RandomNumberGenerator.new(); r.seed = 11
	var cols := [Color("#c9732f"), Color("#8f4a24"), Color("#e2a04a"), Color("#6b3a22"), Color("#d98b3a")]
	for j in 6:
		for i in 5:
			var cx := 26 + i*47.0; var cy := 26 + j*48.0; var c: Color = cols[r.randi() % cols.size()]
			_disc(im, cx - 7, cy - 4, 9, c); _disc(im, cx + 7, cy - 4, 9, c); _disc(im, cx - 5, cy + 7, 6, c.darkened(0.2)); _disc(im, cx + 5, cy + 7, 6, c.darkened(0.2))
			_disc(im, cx - 8, cy - 5, 3, Color("#2a1a10")); _disc(im, cx + 8, cy - 5, 3, Color("#2a1a10"))
			_rect(im, int(cx) - 1, int(cy) - 10, 2, 22, Color("#21160f"))
	return _tex(im)
## pink flowers on dark green: IN BLOOM (the words are Label3D)
func _poster_bloom() -> Texture2D:
	var im := _img(240, 320, Color("#1e2a24")); var r := RandomNumberGenerator.new(); r.seed = 5
	for i in 22:
		var cx := r.randf_range(15, 225); var cy := r.randf_range(80, 310); var s := r.randf_range(10, 20)
		var c := Color("#f08aa0").lerp(Color("#ffd0d8"), r.randf())
		for p in 5: var a := p*TAU/5 + r.randf(); _disc(im, cx + cos(a)*s*0.55, cy + sin(a)*s*0.55, s*0.5, c)
		_disc(im, cx, cy, s*0.25, Color("#f6c35a"))
	return _tex(im)
## a black-and-white spiral
func _poster_spiral() -> Texture2D:
	var im := _img(200, 200, Color("#f0ece4"))
	for y in 200:
		for x in 200:
			var p := Vector2(x - 100, y - 100); var a := atan2(p.y, p.x); var d := p.length()
			if d < 92 and fmod(d*0.16 + a/TAU*2.0 + 10.0, 1.0) < 0.5: im.set_pixel(x, y, Color("#141414"))
	return _tex(im)
## a sunset, flowers black against it
func _poster_sunset() -> Texture2D:
	var im := _img(220, 300, Color.BLACK); _vgrad(im, Color("#3b1d2a"), Color("#f39a4a")); var r := RandomNumberGenerator.new(); r.seed = 9
	_disc(im, 150, 190, 34, Color("#ffd28a", 0.8))
	for i in 16:
		var x := r.randi_range(5, 215); var top := r.randi_range(90, 230)
		_rect(im, x, top, 2, 300 - top, Color("#140a0a"))
		for p in 8: var a := p*TAU/8; _disc(im, x + 1 + cos(a)*7, top + sin(a)*7, 4, Color("#140a0a"))
	return _tex(im)
## a show: the crowd's hands up, the stage lights, black and white
func _poster_crowd() -> Texture2D:
	var im := _img(320, 220, Color("#0a0a0a")); var r := RandomNumberGenerator.new(); r.seed = 13
	for i in 7:
		var x0 := 30 + i*45.0
		for y in 150:
			var w := y*0.25
			for x in range(int(x0 - w), int(x0 + w)):
				if x >= 0 and x < 320: im.set_pixel(x, y, im.get_pixel(x, y).lerp(Color(0.85, 0.85, 0.85), 0.04*(1 - y/150.0)*3))
		_disc(im, x0, 4, 6, Color(1, 1, 1))
	for i in 80:
		var x := r.randf_range(0, 320); var y := r.randf_range(150, 200)
		_disc(im, x, y, r.randf_range(7, 12), Color("#050505"))
		if r.randf() < 0.4: _rect(im, int(x), int(y - r.randf_range(25, 45)), 3, 40, Color("#050505"))
	_rect(im, 0, 190, 320, 30, Color("#050505"))
	return _tex(im)
## a polaroid: the white frame, a small photograph in it — sunsets, the city at night, the sea, friends against the sky
func _polaroid(seed: int) -> Texture2D:
	var im := _img(60, 72, Color("#f3f0e8")); var r := RandomNumberGenerator.new(); r.seed = seed
	var ph := _img(52, 50, Color.BLACK)
	match seed % 5:
		0: _vgrad(ph, Color("#30254a"), Color("#f2925a")); _skyline(ph, 44, Color("#120c14"), seed)
		1: _vgrad(ph, Color("#06101c"), Color("#1d3550")); _skyline(ph, 46, Color("#02060a"), seed)
		2: _vgrad(ph, Color("#7fb6d6"), Color("#e7d6b0")); _rect(ph, 0, 34, 52, 16, Color("#2f6d86"))
		3: _vgrad(ph, Color("#f4b26a"), Color("#d2593c"))
		4: _vgrad(ph, Color("#1a1a22"), Color("#5b4a6a"))
	if seed % 5 in [1, 4]:
		for i in 12: _disc(ph, r.randf_range(0, 52), r.randf_range(0, 40), r.randf_range(0.6, 1.6), Color(1.0, 0.8, 0.5, 0.9))
	if seed % 3 == 0:                          # people: two or three silhouettes, heads and shoulders
		for i in r.randi_range(1, 3):
			var x := 10 + i*14 + r.randf_range(-3, 3)
			_disc(ph, x, 30, 6, Color("#0d0b0c")); _rect(ph, int(x - 9), 36, 18, 14, Color("#0d0b0c"))
	im.blit_rect(ph, Rect2i(0, 0, 52, 50), Vector2i(4, 4))
	return _tex(im)
## the wall: plaster, warm
func _plaster() -> Texture2D:
	var im := _img(256, 256, Color("#d8c4b0")); var n := FastNoiseLite.new(); n.frequency = 0.05; n.seed = 21
	for y in 256:
		for x in 256:
			var v := n.get_noise_2d(x, y)*0.04
			im.set_pixel(x, y, Color("#d8c4b0").lightened(v) if v > 0 else Color("#d8c4b0").darkened(-v))
	return _tex(im)
## an ivy leaf (three lobes), and a grey ground under it to cut away
func _leaf() -> Texture2D:
	var im := _img(64, 64, Color(0, 0, 0, 0))
	for y in 64:
		for x in 64:
			var p := Vector2(x - 32, 60 - y)/30.0
			var a := atan2(p.x, p.y); var d := p.length()
			var rr := 0.62 + 0.32*absf(cos(a*1.5))
			if d < rr and p.y > -0.05:
				var c := Color("#3f7a33").lerp(Color("#2a5524"), d)
				if absf(p.x) < 0.035 or absf(absf(p.x) - p.y*0.9) < 0.03: c = c.lightened(0.25)
				im.set_pixel(x, y, c)
	return _tex(im)
## a chunky cable knit: rows of fat V stitches
func _knit(c: Color) -> Array:
	var W := 128; var al := _img(W, W, c); var hm := Image.create(W, W, false, Image.FORMAT_RGBA8)
	for y in W:
		for x in W:
			var cx := fmod(float(x), 16.0) - 8.0; var cy := fmod(float(y) + absf(cx)*0.9, 16.0) - 8.0
			var h := clampf(1.0 - (cx*cx/30.0 + cy*cy/50.0), 0, 1)
			var hh := h*0.8 + 0.2*sin(y*1.6)*h
			al.set_pixel(x, y, c.darkened(0.18*(1.0 - h))); hm.set_pixel(x, y, Color(hh, hh, hh))
	hm.bump_map_to_normal_map(6.0)
	return [_tex(al), _tex(hm)]
## sherpa: a cream fleece, all little curls
func _sherpa() -> Array:
	var W := 256; var n := FastNoiseLite.new(); n.frequency = 0.22; n.fractal_octaves = 2; n.noise_type = FastNoiseLite.TYPE_CELLULAR; n.seed = 4
	var al := _img(W, W, Color.WHITE); var hm := Image.create(W, W, false, Image.FORMAT_RGBA8)
	for y in W:
		for x in W:
			var v := clampf(0.5 + 0.5*n.get_noise_2d(x, y), 0, 1)
			al.set_pixel(x, y, Color("#d8cdbd").darkened(0.12*(1.0 - v))); hm.set_pixel(x, y, Color(v, v, v))
	hm.bump_map_to_normal_map(4.0)
	return [_tex(al), _tex(hm)]

# ================================================================== the set
## the wall behind the bed, painted: a warm plaster over the apartment's teal, from the window's corner to the door
func _wall() -> void:
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(7.8, 3.2); q.mesh = qm
	var m := _tex_mat(_plaster(), 0.95); m.uv1_scale = Vector3(7.8, 3.2, 1); q.material_override = m
	add_child(q); q.position = Vector3(294.5 + 3.9 + 0.004, 1.6, WALL_Z); q.rotation.y = PI
	# a skirting board along its foot
	_box(Vector3(7.8, 0.09, 0.015), Vector3(298.4, 0.045, WALL_Z - 0.008), _mat(Color("#efe9df"), 0.6))

## the low shelf behind the bed: records in it, plants and a turntable and the soft toys on it
func _shelf(at: Vector3) -> void:
	var wood := _mat(Color("#8a5a3a"), 0.6); var dark := _mat(Color("#2b1c14"), 0.8)
	var W := 1.9; var H := 0.7; var D := 0.38
	_box(Vector3(W, 0.03, D), at + Vector3(0, H, 0), wood)
	_box(Vector3(W, 0.03, D), at + Vector3(0, 0.08, 0), wood)
	_box(Vector3(W, 0.03, D), at + Vector3(0, 0.39, 0), wood)
	for x in [-W/2, -W/6, W/6, W/2]: _box(Vector3(0.03, H, D), at + Vector3(x, H/2, 0), wood)
	_box(Vector3(W, H, 0.01), at + Vector3(0, H/2, D/2 - 0.005), dark)
	# records on their edges in the bottom cubbies; books in the top ones
	var r := _rng
	for cub in 3:
		var x0 := at.x - W/2 + 0.03 + cub*(W/3)
		for i in 26:
			var c := Color.from_hsv(r.randf(), r.randf_range(0.25, 0.7), r.randf_range(0.25, 0.85))
			if cub == 1:   # books, upright, their heights all different
				var bh := r.randf_range(0.2, 0.28)
				if i > 14: break
				_box(Vector3(0.028, bh, 0.24), Vector3(x0 + 0.02 + i*0.036, 0.405 + bh/2, at.z - 0.02), _mat(c, 0.8))
			else:
				_box(Vector3(0.008, 0.29, 0.3), Vector3(x0 + 0.02 + i*0.021, 0.095 + 0.145, at.z - 0.02), _mat(c, 0.6))
		if cub != 1:
			for i in 9:
				var c := Color.from_hsv(r.randf(), 0.5, 0.6)
				_box(Vector3(0.026, r.randf_range(0.18, 0.27), 0.22), Vector3(x0 + 0.04 + i*0.03, 0.405 + 0.12, at.z - 0.03), _mat(c, 0.8))
	var top := at + Vector3(0, H + 0.015, 0)
	# the turntable
	var tt := Node3D.new(); add_child(tt); tt.position = top + Vector3(-0.66, 0, 0)
	_box(Vector3(0.42, 0.09, 0.33), Vector3(0, 0.045, 0), _mat(Color("#c79a6b"), 0.5), tt)
	_cyl(0.15, 0.012, Vector3(-0.04, 0.095, 0), _mat(Color("#141414"), 0.35), tt)
	_cyl(0.045, 0.014, Vector3(-0.04, 0.096, 0), _mat(Color("#d9483b"), 0.6), tt)
	_box(Vector3(0.015, 0.012, 0.2), Vector3(0.15, 0.105, 0.0), _mat(Color("#cfd2d6"), 0.3, 0.8), tt).rotation.y = 0.35
	# a pothos trailing over the edge, a little cactus, a jar candle
	var pot := _cyl(0.07, 0.12, top + Vector3(0.8, 0.06, 0.02), _mat(Color("#e6dccb"), 0.7), self, 0.055)
	_leaves(top + Vector3(0.8, 0.13, 0.02), 40, 0.13, 0.5, 0.22)
	spots.shelf = top
	# the soft toys, sitting along it at the bed's end
	prop("teddy", top + Vector3(-0.3, 0, 0.0), PI + 0.25)
	prop("bunny", top + Vector3(-0.06, 0, 0.04), PI - 0.3)

## a clump of leaves: ivy/pothos — a MultiMesh of leaf cards round a point, hanging down `drop`
func _leaves(at: Vector3, n: int, spread: float, drop: float, size: float) -> void:
	var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
	var qm := QuadMesh.new(); qm.size = Vector2(size*0.32, size*0.32); qm.center_offset = Vector3(0, size*0.16, 0); mm.mesh = qm; mm.instance_count = n
	for i in n:
		var p := Vector3(_rng.randf_range(-spread, spread), -_rng.randf()*drop*(0.4 + 0.6*_rng.randf()), _rng.randf_range(-spread, spread)*0.6)
		if p.y < -0.05: p.z = absf(p.z)*-1.0 - 0.05                 # what hangs, hangs over the front
		var b := Basis.from_euler(Vector3(_rng.randf_range(-1.2, 0.6), _rng.randf()*TAU, _rng.randf_range(-0.6, 0.6)))
		mm.set_instance_transform(i, Transform3D(b, p))
	var mi := MultiMeshInstance3D.new(); mi.multimesh = mm; add_child(mi); mi.position = at
	mi.material_override = _leaf_mat()
var _lm: StandardMaterial3D
func _leaf_mat() -> StandardMaterial3D:
	if _lm: return _lm
	_lm = _tex_mat(_leaf(), 0.6); _lm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR; _lm.alpha_scissor_threshold = 0.5
	_lm.cull_mode = BaseMaterial3D.CULL_DISABLED; return _lm

## the nightstand at the bed's head: the lamp (lit), a candle, tulips, her instant camera, books, her school ID
func _nightstand(at: Vector3) -> void:
	var white := _mat(Color("#ece8e2"), 0.55)
	_box(Vector3(0.46, 0.56, 0.42), at + Vector3(0, 0.3, 0), white)
	for i in 4: _box(Vector3(0.025, 0.04, 0.025), at + Vector3(-0.2 + (i % 2)*0.4, 0.02, -0.18 + (i/2)*0.36), white)
	_box(Vector3(0.4, 0.2, 0.006), at + Vector3(0, 0.42, -0.211), _mat(Color("#dcd6ce"), 0.5))
	_ball(0.012, at + Vector3(-0.12, 0.555, -0.218), _mat(Color("#b89a6a"), 0.3, 0.8))
	var top := at + Vector3(0, 0.58, 0)
	spots.nightstand = top
	# the lamp: a brass stem, a pleated cream shade glowing from inside
	_cyl(0.07, 0.025, top + Vector3(0.1, 0.0125, 0.08), _mat(Color("#b8915a"), 0.3, 0.9))
	_cyl(0.009, 0.36, top + Vector3(0.1, 0.19, 0.08), _mat(Color("#b8915a"), 0.3, 0.9))
	shade_m = _mat(Color("#f3e3c4"), 0.9); shade_m.emission_enabled = true; shade_m.emission = Color("#ffb062"); shade_m.emission_energy_multiplier = 0.7
	shade_m.cull_mode = BaseMaterial3D.CULL_DISABLED
	var sh := _cyl(0.1, 0.17, top + Vector3(0.1, 0.42, 0.08), shade_m, self, 0.14, 20)
	lamp = OmniLight3D.new(); lamp.light_color = Color("#ffb46a"); lamp.light_energy = 0.45; lamp.omni_range = 3.6; lamp.shadow_enabled = true
	lamp.position = top + Vector3(0.1, 0.38, 0.08); add_child(lamp)
	# the candle in its jar, flickering
	_cyl(0.035, 0.08, top + Vector3(-0.13, 0.04, -0.1), _mat(Color("#f2ead8"), 0.4))
	flame = _ball(0.007, top + Vector3(-0.13, 0.095, -0.1), _glow(Color("#ffb347"), 3.0)); flame.scale = Vector3(1, 1.6, 1)
	candle = OmniLight3D.new(); candle.light_color = Color("#ff9a40"); candle.light_energy = 0.3; candle.omni_range = 1.3
	candle.position = top + Vector3(-0.13, 0.14, -0.1); add_child(candle)
	# tulips in a glass vase
	var vase_m := _mat(Color(0.85, 0.95, 0.95, 0.35), 0.05); vase_m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; vase_m.render_priority = 101
	_cyl(0.045, 0.16, top + Vector3(-0.1, 0.08, 0.1), vase_m, self, 0.035)
	for i in 9:
		var a := i*TAU/9 + _rng.randf()*0.4; var lean := Vector3(cos(a), 0, sin(a))*_rng.randf_range(0.03, 0.08)
		var base := top + Vector3(-0.1, 0.1, 0.1); var head := base + Vector3(0, _rng.randf_range(0.18, 0.26), 0) + lean
		var stem := _cyl(0.004, base.distance_to(head), (base + head)/2, _mat(Color("#4f7d3a"), 0.8), self, -1.0, 6)
		stem.look_at_from_position((base + head)/2, head, Vector3(1, 0, 0)); stem.rotate_object_local(Vector3(1, 0, 0), PI/2)
		var tul := _ball(0.022, head, _mat(Color("#ef7a6c").lerp(Color("#f6a1a8"), _rng.randf()), 0.6)); tul.scale = Vector3(0.9, 1.35, 0.9)
	# her instant camera, cream and boxy; two books under it; her school ID on its lanyard, hung off the lamp
	_box(Vector3(0.19, 0.035, 0.13), top + Vector3(-0.05, 0.0175, -0.02), _mat(Color("#4a5b6e"), 0.8))
	_box(Vector3(0.17, 0.03, 0.12), top + Vector3(-0.04, 0.05, -0.03), _mat(Color("#c25e45"), 0.8)).rotation.y = 0.12
	var cam := Node3D.new(); add_child(cam); cam.position = top + Vector3(0.08, 0.065, -0.11); cam.rotation.y = 0.5
	_box(Vector3(0.12, 0.1, 0.075), Vector3(0, 0.05, 0), _mat(Color("#eae3d6"), 0.5), cam)
	_cyl(0.03, 0.02, Vector3(0, 0.045, -0.045), _mat(Color("#191919"), 0.3), cam).rotation.x = PI/2
	_cyl(0.018, 0.022, Vector3(0, 0.045, -0.047), _mat(Color("#2a3a4a"), 0.05, 0.4), cam).rotation.x = PI/2
	spots.camera = cam.global_position
	var id := Node3D.new(); add_child(id); id.position = at + Vector3(-0.12, 0.42, -0.222)          # hung over the drawer's knob, down its face
	_box(Vector3(0.008, 0.1, 0.003), Vector3(-0.016, 0.085, 0.002), _mat(Color("#2f5fa8"), 0.8), id).rotation.z = 0.25
	_box(Vector3(0.008, 0.1, 0.003), Vector3(0.016, 0.085, 0.002), _mat(Color("#2f5fa8"), 0.8), id).rotation.z = -0.25
	var card := _box(Vector3(0.054, 0.085, 0.002), Vector3(0, 0.0, 0), _mat(Color("#f4f4f0"), 0.4), id)
	_box(Vector3(0.054, 0.02, 0.0025), Vector3(0, 0.032, 0), _mat(Color("#2f5fa8"), 0.5), id)
	_box(Vector3(0.016, 0.022, 0.0025), Vector3(-0.017, 0.002, 0), _mat(Color("#3a2a2a"), 0.7), id)
	var f := Vector3(0, 0, -1)
	text3("HARBOR HIGH", id.position + Vector3(0, 0.032, -0.0015), 0.007, Color.WHITE, f)
	text3("ROBIN RYU\nGRADE 11", id.position + Vector3(0.009, 0.002, -0.0015), 0.0042, Color("#1a1a1a"), f).horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	text3("STUDENT", id.position + Vector3(0, -0.03, -0.0015), 0.006, Color("#2f5fa8"), f)
	spots.id = id.global_position

## the bed made up: a cream sherpa duvet draped over the mattress, a rust knit throw across its foot and down its side,
## pillows against the headboard
func _bedding(bx: float, bz: float, top: float) -> void:
	var sh := _sherpa(); var dm := _tex_mat(sh[0], 1.0); dm.normal_enabled = true; dm.normal_texture = sh[1]; dm.normal_scale = 1.4
	dm.uv1_scale = Vector3(3, 3, 1); dm.cull_mode = BaseMaterial3D.CULL_DISABLED
	# the mattress is 2 x 1 m about (bx, bz), its top at `top`: the duvet from a hand below the pillows to its foot
	add_child(_drape(Rect2(bx - 0.62, bz - 0.5, 1.6, 1.0), top + 0.03, 0.34, 0.07, dm, 0.035))
	var kn := _knit(Color("#8d5442")); var km := _tex_mat(kn[0], 0.95); km.normal_enabled = true; km.normal_texture = kn[1]; km.normal_scale = 0.9
	km.uv1_scale = Vector3(9, 9, 1); km.cull_mode = BaseMaterial3D.CULL_DISABLED
	var throw := _drape(Rect2(bx + 0.48, bz - 0.55, 0.5, 1.1), top + 0.07, 0.45, 0.09, km, 0.05, 1)
	add_child(throw)
	# the pillows: two cream ones lying against the headboard (her head goes on them), the dark and knit ones in front
	# along the wall side, the heart
	var hx: float = bx - 0.82
	var p1 := prop("pillow_cream", Vector3(hx + 0.12, top + 0.08, bz - 0.24), PI/2, self, 0.3); p1.rotation = Vector3(-1.2, PI/2, 0)
	var p2 := prop("pillow_cream", Vector3(hx + 0.12, top + 0.08, bz + 0.26), PI/2, self, 0.3); p2.rotation = Vector3(-1.2, PI/2, 0)
	var p3 := prop("pillow_brown", Vector3(hx + 0.24, top + 0.2, bz + 0.33), 0, self, 0.9); p3.rotation = Vector3(-0.35, PI/2 + 0.15, 0)
	var p4 := prop("pillow_black", Vector3(hx + 0.27, top + 0.17, bz - 0.36), 0, self, 0.5); p4.rotation = Vector3(-0.4, PI/2 - 0.2, 0)
	var ht := prop("heart", Vector3(hx + 0.4, top + 0.03, bz + 0.36), PI/2 + 0.4, self, 0.5); ht.rotation.x = -0.25
	spots.pillows = Vector3(hx + 0.2, top + 0.15, bz)

## a cloth over a box: its top flat at `y` over `r` (x, z), its sides falling `drop` with a soft roll at the edge and
## a few folds in the fall. `sides` 0: all four; 1: not the head (-X) end
func _drape(r: Rect2, y: float, drop: float, roll: float, m: Material, thick := 0.03, sides := 0) -> MeshInstance3D:
	var nx := 48; var nz := 32
	var ox := r.position.x - drop; var oz := r.position.y - drop
	var W := r.size.x + drop*2; var D := r.size.y + drop*2
	if sides == 1: ox = r.position.x; W = r.size.x + drop
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var hf := func(x: float, z: float) -> float:
		var dx := maxf(maxf(r.position.x - x, x - (r.position.x + r.size.x)), 0.0)
		var dz := maxf(maxf(r.position.y - z, z - (r.position.y + r.size.y)), 0.0)
		if sides == 1 and x < r.position.x: dx = 0.0
		var d := sqrt(dx*dx + dz*dz)
		var h := y - (d*d/(roll*2.0) if d < roll else (roll*0.5 + (d - roll)*2.2))
		h += 0.012*sin(x*9.0 + z*3.0)*sin(z*7.0 - x*2.0)                  # folds
		h -= 0.02*smoothstep(0.0, 0.3, d)*sin(x*14.0 + z*11.0)
		return maxf(h, y - drop)
	for j in nz + 1:
		for i in nx + 1:
			var x := ox + W*i/nx; var z := oz + D*j/nz
			var dx := maxf(maxf(r.position.x - x, x - (r.position.x + r.size.x)), 0.0); var dz := maxf(maxf(r.position.y - z, z - (r.position.y + r.size.y)), 0.0)
			if sides == 1 and x < r.position.x: dx = 0.0
			# pull the fallen sides in toward the box, so they hang rather than flare
			var out := Vector2(signf(x - (r.position.x + r.size.x*0.5))*dx, signf(z - (r.position.y + r.size.y*0.5))*dz)
			var pull := clampf((sqrt(dx*dx + dz*dz) - roll)/maxf(drop, 0.01), 0, 1)
			var px := x - out.x*pull*0.85; var pz := z - out.y*pull*0.85
			st.set_uv(Vector2(i*1.0/nx, j*1.0/nz)); st.add_vertex(Vector3(px, hf.call(x, z), pz))
	for j in nz:
		for i in nx:
			var a := j*(nx + 1) + i; var b := a + 1; var c := a + nx + 1; var d := c + 1
			st.add_index(a); st.add_index(b); st.add_index(c); st.add_index(b); st.add_index(d); st.add_index(c)
	st.generate_normals(); st.generate_tangents()
	var mi := MeshInstance3D.new(); mi.mesh = st.commit(); mi.material_override = m
	return mi

## the wall behind the bed, covered: posters, vinyl, prints, the polaroids on their wire grid
func _collage(bx: float) -> void:
	# the apartment's own two posters hang at x 297.45–299.15, y 1.4–2.6: everything goes round them
	var z := WALL_Z - 0.006; var f := Vector3(0, 0, -1)
	picture(_poster_crowd(), 0.66, 0.46, Vector3(296.62, 2.45, z), f, 0.015)
	picture(_poster_lines(), 0.42, 0.56, Vector3(299.45, 1.55, z), f, -0.015)
	text3("THE 2044", Vector3(299.45, 1.75, z - 0.002), 0.06, Color("#f4efe6"), f)
	picture(_poster_moon(), 0.56, 0.74, Vector3(300.05, 1.75, z), f)
	picture(_poster_wave(), 0.4, 0.53, Vector3(299.95, 2.47, z - 0.001), f, 0.02)
	text3("NEON TIDE", Vector3(299.95, 2.65, z - 0.003), 0.07, Color("#f4efe6"), f).rotation.z = 0.02
	text3("LIVE AT PULSE · KILN ST", Vector3(299.95, 2.27, z - 0.003), 0.018, Color("#c9c3b8"), f).rotation.z = 0.02
	picture(_poster_cream(), 0.36, 0.45, Vector3(300.62, 2.3, z), f, 0.03)
	var l := text3("good\nthings\ntake\ntime", Vector3(300.62, 2.3, z - 0.002), 0.07, Color("#b5532f"), f); l.line_spacing = -18; l.rotation.z = 0.03
	picture(_poster_bloom(), 0.38, 0.5, Vector3(300.66, 1.52, z), f, -0.02)
	text3("IN BLOOM", Vector3(300.66, 1.71, z - 0.002), 0.055, Color("#ffd6dd"), f).rotation.z = -0.02
	picture(_poster_butterflies(), 0.42, 0.52, Vector3(301.17, 2.38, z), f)
	picture(_poster_spiral(), 0.3, 0.3, Vector3(301.15, 1.76, z), f, 0.04)
	picture(_poster_sunset(), 0.44, 0.6, Vector3(301.7, 2.0, z), f)
	# vinyl on the wall: black, their labels' colours
	for v in [[299.42, 2.28, "#e8a33c"], [297.85, 1.22, "#e2e2dc"], [301.7, 1.4, "#d34a4a"], [298.75, 1.38, "#e7b6c1"]]:
		var d := _cyl(0.15, 0.004, Vector3(v[0], v[1], z - 0.003), _mat(Color("#0c0c0c"), 0.25, 0.1), self, -1.0, 40); d.rotation.x = PI/2
		var lb := _cyl(0.05, 0.005, Vector3(v[0], v[1], z - 0.004), _mat(Color(v[2]), 0.6), self, -1.0, 24); lb.rotation.x = PI/2
		_cyl(0.004, 0.006, Vector3(v[0], v[1], z - 0.005), _mat(Color("#222"), 0.5), self, -1.0, 8).rotation.x = PI/2
	# polaroids, scattered between, a little crooked
	var spots_p := [[299.2, 2.7], [299.68, 2.05], [300.35, 2.62], [300.28, 1.95], [300.95, 1.95], [301.45, 1.55], [301.48, 2.62],
		[300.98, 1.38], [300.25, 1.22], [299.62, 1.08], [297.25, 1.62], [296.95, 2.05], [302.0, 2.45], [302.05, 1.6], [298.35, 2.68], [297.2, 2.72]]
	for i in spots_p.size():
		var p: Array = spots_p[i]
		picture(_polaroid(i + 3), 0.1, 0.12, Vector3(p[0], p[1], z - 0.004 - (i % 3)*0.0007), f, _rng.randf_range(-0.2, 0.2), 0.5)
	# the wire grid by the window, polaroids clipped to it
	var grid := Node3D.new(); add_child(grid); grid.position = Vector3(295.95, 1.62, z - 0.01)
	var wire := _mat(Color("#1a1a1a"), 0.4, 0.7)
	for i in 6: _box(Vector3(0.004, 1.0, 0.004), Vector3(-0.35 + i*0.14, 0, 0), wire, grid)
	for j in 8: _box(Vector3(0.74, 0.004, 0.004), Vector3(0, -0.49 + j*0.14, 0), wire, grid)
	for j in 3:
		for i in 4:
			var pz := grid.position + Vector3(-0.27 + i*0.18, 0.3 - j*0.3, -0.005)
			picture(_polaroid(40 + j*4 + i), 0.11, 0.132, pz, f, _rng.randf_range(-0.08, 0.08), 0.5)
			_box(Vector3(0.012, 0.022, 0.008), pz + Vector3(0, 0.06, -0.003), _mat(Color("#c9a26a"), 0.6), self)
	spots.wall = Vector3(299.4, 1.9, z)
	spots.grid = grid.position

## the fairy lights: swagged along the top of the wall under a trail of ivy, down the corner by the window; warm
func _fairy_lights(bx: float) -> void:
	var pts: Array = []
	var x0 := 294.6; var x1 := bx + 2.6; var z := WALL_Z - 0.04
	# along the wall's top, in five swags
	var n := 5
	for s in n:
		var a := x0 + (x1 - x0)*s/n; var b := x0 + (x1 - x0)*(s + 1)/n
		for i in 22:
			var k := i/22.0; pts.append(Vector3(lerpf(a, b, k), 2.95 - 0.28*sin(k*PI), z))
	# down the corner by the window, and across the window's head
	for i in 26: pts.append(Vector3(294.56, 2.95 - i*0.09, z - 0.05 - 0.03*sin(i*0.8)))
	for i in 30: var k := i/30.0; pts.append(Vector3(294.56, 2.55 - 0.18*sin(k*PI), 3.6 - k*2.4))
	var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
	var sm := SphereMesh.new(); sm.radius = 0.011; sm.height = 0.022; sm.radial_segments = 8; sm.rings = 4; mm.mesh = sm
	mm.instance_count = pts.size()
	for i in pts.size(): mm.set_instance_transform(i, Transform3D(Basis(), pts[i]))
	bulbs = MultiMeshInstance3D.new(); bulbs.multimesh = mm; bulbs.material_override = _glow(Color("#ffc46b"), 3.2); add_child(bulbs)
	bulbs.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the wire, and the ivy along it
	var wm := MultiMesh.new(); wm.transform_format = MultiMesh.TRANSFORM_3D; var bm := BoxMesh.new(); bm.size = Vector3(1, 0.003, 0.003); wm.mesh = bm
	wm.instance_count = pts.size() - 1
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]; var d := b - a
		var bs := Basis.looking_at(d.normalized() if d.length() > 0.001 else Vector3.RIGHT, Vector3.UP if absf(d.normalized().y) < 0.95 else Vector3.FORWARD)
		bs = bs*Basis(Vector3.UP, PI/2); bs = bs.scaled(Vector3(d.length(), 1, 1))
		wm.set_instance_transform(i, Transform3D(Basis(bs.x.normalized()*d.length(), bs.y.normalized(), bs.z.normalized()), (a + b)/2))
	var wi := MultiMeshInstance3D.new(); wi.multimesh = wm; wi.material_override = _mat(Color("#203a1c"), 0.8); add_child(wi)
	var ivy := MultiMesh.new(); ivy.transform_format = MultiMesh.TRANSFORM_3D
	var qm := QuadMesh.new(); qm.size = Vector2(0.075, 0.075); qm.center_offset = Vector3(0, 0.035, 0); ivy.mesh = qm
	var leaves: Array = []
	for i in pts.size():
		for k in 3:
			var p: Vector3 = pts[i] + Vector3(_rng.randf_range(-0.04, 0.04), _rng.randf_range(-0.05, 0.03), _rng.randf_range(-0.02, 0.01))
			var b := Basis.from_euler(Vector3(_rng.randf_range(-0.4, 0.5) + PI, _rng.randf_range(-0.6, 0.6), _rng.randf_range(-0.8, 0.8)))
			leaves.append(Transform3D(b, p))
	# and trails of it hanging down from the swags
	for t in 9:
		var p0: Vector3 = pts[_rng.randi() % (n*22)]; var len := _rng.randf_range(0.25, 0.7)
		for i in int(len/0.04):
			leaves.append(Transform3D(Basis.from_euler(Vector3(PI + _rng.randf_range(-0.4, 0.4), _rng.randf_range(-0.7, 0.7), _rng.randf_range(-0.5, 0.5))),
				p0 + Vector3(_rng.randf_range(-0.03, 0.03), -i*0.04, 0.01)))
	ivy.instance_count = leaves.size()
	for i in leaves.size(): ivy.set_instance_transform(i, leaves[i])
	var ii := MultiMeshInstance3D.new(); ii.multimesh = ivy; ii.material_override = _leaf_mat(); add_child(ii)
	# their light: a few warm lights spread along them (the bulbs themselves are only glow)
	for i in 6:
		var p: Vector3 = pts[int(i*(pts.size() - 1)/5.0)]
		var l := OmniLight3D.new(); l.light_color = Color("#ffb45c"); l.light_energy = 0.3; l.omni_range = 2.4; l.position = p + Vector3(0, -0.15, -0.25)
		add_child(l); fairy.append([l, l.light_energy])
	spots.fairy = pts[30]

## a shaggy cream rug beside the bed
func _rug(at: Vector3) -> void:
	var sh := _sherpa(); var m := _tex_mat(sh[0], 1.0); m.albedo_color = Color("#c9bba6"); m.normal_enabled = true; m.normal_texture = sh[1]; m.normal_scale = 3.0; m.uv1_scale = Vector3(7, 7, 1)
	var mi := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.8; cm.bottom_radius = 0.83; cm.height = 0.025; cm.radial_segments = 48
	mi.mesh = cm; mi.material_override = m; add_child(mi); mi.position = at + Vector3(0, 0.012, 0); mi.scale = Vector3(1.0, 1, 0.62)

## school: her bag against the nightstand, its pins and keyrings; the homework on the bed, a pencil, a highlighter;
## the calendar on the wall with Friday circled
func _school(bx: float, bz: float, top: float) -> void:
	var bag := Node3D.new(); add_child(bag); bag.position = Vector3(bx - 1.3, 0, bz - 0.42); bag.rotation = Vector3(-0.12, 0.35, 0)
	var bm := _mat(Color("#c8a8d8"), 0.85)
	var body := _box(Vector3(0.3, 0.4, 0.15), Vector3(0, 0.2, 0), bm, bag)
	_box(Vector3(0.24, 0.17, 0.05), Vector3(0, 0.12, -0.09), _mat(Color("#b494c6"), 0.85), bag)
	_box(Vector3(0.24, 0.006, 0.006), Vector3(0, 0.2, -0.118), _mat(Color("#d8d8dc"), 0.3, 0.8), bag)
	for i in 5:
		var pin := _cyl(0.016, 0.006, Vector3(-0.09 + i*0.045, 0.32 - (i % 2)*0.04, -0.077), _mat([Color("#f2c84b"), Color("#e2574c"), Color("#3fb6c6"), Color("#ffffff"), Color("#7ac35a")][i], 0.4), bag)
		pin.rotation.x = PI/2
	var kr := _ball(0.022, Vector3(0.13, 0.06, -0.1), _mat(Color("#f7a1c4"), 0.6), bag)
	spots.bag = bag.global_position + Vector3(0, 0.25, 0)
	# the homework: two sheets on the duvet, a textbook open, a pencil
	var hw := Node3D.new(); add_child(hw); hw.position = Vector3(bx - 0.3, top + 0.075, bz - 0.3); hw.rotation.y = 0.3          # clear of her phone (bed.x + 0.15)
	var paper := _mat(Color("#b9b5ab"), 0.85)                   # (paper under her lamp: a whiter one burns out)
	_box(Vector3(0.21, 0.002, 0.28), Vector3(0, 0, 0), paper, hw)
	_box(Vector3(0.21, 0.002, 0.28), Vector3(0.06, 0.002, 0.04), paper, hw).rotation.y = -0.25
	var up := Vector3(0, 1, 0)
	var t1 := text3("AP PHYSICS · PROBLEM SET 6\nDue FRI\n\n1. A 2 kg drone ...\n2. v = d / t ✓\n3.  ??", Vector3(0, 0.003, 0), 0.012, Color("#24304a"), up, hw, 0.18)
	t1.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT; t1.rotation = Vector3(-PI/2, 0, 0)
	var dood := text3("☆ ♪ ♡", Vector3(0.05, 0.003, 0.1), 0.02, Color("#d0503a"), up, hw); dood.rotation = Vector3(-PI/2, 0, 0.2)
	var book := Node3D.new(); hw.add_child(book); book.position = Vector3(-0.27, 0.0, 0.05); book.rotation.y = -0.2
	_box(Vector3(0.2, 0.018, 0.27), Vector3(-0.1, 0.009, 0), _mat(Color("#cfcabd"), 0.85), book).rotation.z = 0.06
	_box(Vector3(0.2, 0.018, 0.27), Vector3(0.1, 0.009, 0), _mat(Color("#cfcabd"), 0.85), book).rotation.z = -0.06
	_box(Vector3(0.42, 0.008, 0.28), Vector3(0, -0.002, 0), _mat(Color("#2a5d8f"), 0.7), book)
	var pen := _cyl(0.004, 0.17, Vector3(0.12, 0.006, -0.05), _mat(Color("#f2c230"), 0.6), hw, -1.0, 6); pen.rotation = Vector3(PI/2, 0, 0.9)
	spots.homework = hw.global_position
	# a calendar on the wall by the grid
	var cal := picture(_calendar(), 0.28, 0.36, Vector3(294.5 + 0.52, 1.0, WALL_Z - 0.006), Vector3(0, 0, -1), 0.01)
	text3("OCTOBER", Vector3(294.5 + 0.52, 1.14, WALL_Z - 0.008), 0.03, Color("#1d1d1d"), Vector3(0, 0, -1))
func _calendar() -> Texture2D:
	var im := _img(140, 180, Color("#faf7f0"))
	for j in 5:
		for i in 7: _rect(im, 8 + i*18, 40 + j*26, 16, 1, Color("#c8c2b8")); _rect(im, 8 + i*18, 40 + j*26, 1, 24, Color("#c8c2b8"))
	_disc(im, 8 + 5*18 + 8, 40 + 2*26 + 12, 10, Color("#e04545"), 2.0)            # Friday
	_rect(im, 8 + 2*18 + 2, 40 + 3*26 + 6, 12, 4, Color("#f2c84b"))
	return _tex(im)
