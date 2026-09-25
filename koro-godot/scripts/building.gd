## A BUILDING ON WANO — the Workshop, the Mall, the Library, the Mechanic.
##
## Built the way the browser builds them (public/planet.js, build(), dress(),
## indoors() and each room's own furniture), in the building's own tangent
## frame: +x across, +y up off the ball, +z the way the door faces.
##
## A ROOM IS FLAT AND THE WORLD IS NOT: across a hall seventy metres wide the
## ground falls two metres away from a flat floor. So every building stands on
## a PLATE, level over the room and bent down in a band round the outside to
## meet the ground exactly where the ground is — you walk up an apron onto it
## rather than stepping over a lip. The plate is drawn and it is a collider,
## so what you see and what you stand on cannot drift apart.
##
## Everything that does not move is merged into one mesh per material (a
## building is a couple of hundred boxes, and a couple of hundred draw calls
## would be most of a frame); everything you must not walk through is also a
## box in the building's collider.
class_name Building
extends Node3D

const GAP := 9.0                # the doorway is nine metres wide

var b: Dictionary
var world: Node3D
var body: StaticBody3D
var hw := 0.0
var hd := 0.0
var H := 9.0
var DOOR := 6.0
var _st := {}                   # material -> SurfaceTool
var _mats := {}
var spinners: Array = []        # mannequins that turn on their dais
var usables: Array = []         # {at (local), r, label, act}

func setup(spec: Dictionary, w: Node3D) -> Building:
	b = spec
	world = w
	return self

func _ready() -> void:
	hw = b.w / 2.0
	hd = b.d / 2.0
	H = b.get("h", 9.0)
	DOOR = b.get("door", 6.0)
	body = StaticBody3D.new()
	add_child(body)
	_plate(b.get("plate_visible", true))
	if b.get("pad", false):
		_pad()
	elif b.get("shell", true):
		if b.id == "mechanic" and ResourceLoader.exists(GARAGE):
			_garage_model()
		else:
			_shell()
			_dress()
			_indoors()
		match b.id:
			"workshop":
				_workshop()
			"mall":
				_mall()
			"mechanic":
				_mechanic()
			"library":
				_library()
			"gym":
				_gym()
			"club":
				add_child(Club.new().setup(self))
			"arcade":
				_arcade()
			"house":
				_house()
	_commit()

# ------------------------------------------------------------- the kit

func mat(key: String, col: Color, glow := false) -> String:
	if not _mats.has(key):
		var m := StandardMaterial3D.new()
		m.albedo_color = col
		m.roughness = 0.9
		if glow:
			m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_mats[key] = m
	return key

## One box, merged into the building's mesh for its material, and — if it is
## `solid` — a box in the collider as well.
func box(size: Vector3, at: Vector3, m: String, solid := false, rot := 0.0) -> void:
	if not _st.has(m):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[m] = st
	var xf := Transform3D(Basis(Vector3.UP, rot), at)
	var bm := BoxMesh.new()
	bm.size = size
	(_st[m] as SurfaceTool).append_from(bm, 0, xf)
	if solid:
		_solid(size, xf)

func _solid(size: Vector3, xf: Transform3D) -> void:
	var cs := CollisionShape3D.new()
	var s := BoxShape3D.new()
	s.size = size
	cs.shape = s
	cs.transform = xf
	body.add_child(cs)

func cyl(r: float, h: float, at: Vector3, m: String, segs := 20) -> void:
	if not _st.has(m):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[m] = st
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r * 1.06
	c.height = h
	c.radial_segments = segs
	c.rings = 1
	(_st[m] as SurfaceTool).append_from(c, 0, Transform3D(Basis(), at))

func _commit() -> void:
	for k in _st:
		var st: SurfaceTool = _st[k]
		var mesh := st.commit()
		mesh.surface_set_material(0, _mats[k])
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		add_child(mi)
	_st.clear()

## A place to press E: `act` is called with the world, `label` is the prompt.
func usable(at: Vector3, label: String, act: Callable, r := 3.2) -> void:
	usables.append({"at": at, "r": r, "label": label, "act": act})

## Is this point in the world inside the room (under the lid, within the walls)?
func inside(p: Vector3) -> bool:
	var lp := to_local(p)
	return absf(lp.x) < hw and absf(lp.z) < hd and lp.y < H and lp.y > -2.0

## The nearest thing to use within reach of a point in the world, or {}.
func use_near(p: Vector3) -> Dictionary:
	var lp := to_local(p)
	var best := {}
	var bd := INF
	for u in usables:
		var d: float = Vector2(lp.x - u.at.x, lp.z - u.at.z).length()
		if d < u.r and d < bd and absf(lp.y - u.at.y) < 3.0:
			bd = d
			best = u
	return best

## A console: a slab on a post with a screen that says what it is for.
func panel(x: float, z: float, text: String, bg: Color, rot := 0.0, label := "", act := Callable()) -> Label3D:
	var m := mat("panel_post", Color("2a3350"))
	box(Vector3(0.35, 1.2, 0.35), Vector3(x, 0.6, z), m, true, rot)
	var face := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(2.4, 1.5)
	var fm := StandardMaterial3D.new()
	fm.albedo_color = bg
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	q.material = fm
	face.mesh = q
	face.transform = Transform3D(Basis(Vector3.UP, rot) * Basis(Vector3.RIGHT, -0.35), Vector3(x, 1.75, z))
	add_child(face)
	var back := MeshInstance3D.new()
	var bq := QuadMesh.new()
	bq.size = Vector2(2.5, 1.6)
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = Color("141a2e")
	bq.material = bmat
	back.mesh = bq
	back.transform = Transform3D(Basis(Vector3.UP, rot + PI) * Basis(Vector3.RIGHT, 0.35), Vector3(x, 1.75, z) - Basis(Vector3.UP, rot) * Vector3(0, 0, 0.02))
	add_child(back)
	var lbl := Label3D.new()
	lbl.text = text
	lbl.font_size = 44
	lbl.pixel_size = 0.0075
	lbl.outline_size = 8
	lbl.modulate = Color(0.95, 0.97, 1.0)
	lbl.width = 300
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl.transform = face.transform.translated_local(Vector3(0, 0, 0.02))
	add_child(lbl)
	if act.is_valid():
		var at := Vector3(x, 0, z) + Basis(Vector3.UP, rot) * Vector3(0, 0, 1.4)
		usable(at, label if label != "" else text.split("\n")[0], act)
	return lbl

# ------------------------------------------------------------- the plate

func _plate_y(x: float, z: float) -> float:
	var A := apron()
	var ox := maxf(0.0, absf(x) - (hw + 1.0))
	var oz := maxf(0.0, absf(z) - (hd + 1.0))
	var k := minf(1.0, Vector2(ox, oz).length() / A)
	var s := k * k * (3.0 - 2.0 * k)
	var p := Vector2(x, z).length()
	return (sqrt(maxf(0.0, Planet.R * Planet.R - p * p)) - Planet.R) * s

func apron() -> float:
	return clampf(b.w / 7.0, 3.0, 9.0)

func _plate(visible_plate: bool) -> void:
	var A := apron()
	var W: float = b.w + 2.0 * (1.0 + A)
	var D: float = b.d + 2.0 * (1.0 + A)
	var nx := maxi(14, roundi(W / 2.5))
	var nz := maxi(14, roundi(D / 2.5))
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var faces := PackedVector3Array()
	var pt := func(i: int, j: int) -> Vector3:
		var x := -W / 2.0 + W * i / nx
		var z: float = -D / 2.0 + D * j / nz
		var rim := i == 0 or j == 0 or i == nx or j == nz
		return Vector3(x, _plate_y(x, z) + 0.02 - (0.5 if rim else 0.0), z)
	for j in nz:
		for i in nx:
			var a: Vector3 = pt.call(i, j)
			var c: Vector3 = pt.call(i + 1, j)
			var e: Vector3 = pt.call(i + 1, j + 1)
			var f: Vector3 = pt.call(i, j + 1)
			for v in [a, c, e, a, e, f]:
				st.add_vertex(v)
			faces.append_array([a, c, e, a, e, f])
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	shape.backface_collision = true
	var cs := CollisionShape3D.new()
	cs.shape = shape
	body.add_child(cs)
	if visible_plate:
		st.generate_normals()
		var mesh := st.commit()
		var m := StandardMaterial3D.new()
		m.albedo_color = Color("8b8f9e")
		m.roughness = 1.0
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		mesh.surface_set_material(0, m)
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		add_child(mi)

# ------------------------------------------------------------- the shell

func _put(x: float, z: float, w: float, d: float, h := -1.0, base := 0.0) -> void:
	var hh := H if h < 0.0 else h
	box(Vector3(w, hh, d), Vector3(x, base + hh / 2.0, z), "wall", true)

func _shell() -> void:
	var wall_c: Color = b.wall
	var roof_c: Color = b.roof
	mat("wall", wall_c)
	mat("lid", roof_c)
	mat("under", roof_c.darkened(0.82))
	_put(0, -hd, b.w, 1)
	_put(-hw, 0, 1, b.d)
	_put(hw, 0, 1, b.d)
	var side: float = (b.w - GAP) / 2.0
	_put(-(GAP / 2.0 + side / 2.0), hd, side, 1)
	_put(GAP / 2.0 + side / 2.0, hd, side, 1)
	_put(0, hd, GAP, 1, H - DOOR, DOOR)             # the lintel, over head height
	# the lid: you can land on it; and a dark underside, which is a ceiling
	box(Vector3(b.w + 0.8, 0.8, b.d + 0.8), Vector3(0, H + 0.4, 0), "lid", true)
	box(Vector3(b.w - 0.2, 0.04, b.d - 0.2), Vector3(0, H - 0.03, 0), "under")
	# the name, between the towers and over the door
	var lbl := Label3D.new()
	lbl.text = b.name
	lbl.font_size = 128
	lbl.pixel_size = minf(b.w * 0.62, 26.0) / (b.name.length() * 80.0)
	lbl.outline_size = 18
	lbl.outline_modulate = Color(0.05, 0.05, 0.1)
	lbl.modulate = roof_c.lightened(0.3)
	lbl.position = Vector3(0, H + 2.2, hd + 0.5)
	lbl.shaded = false
	add_child(lbl)

## WHAT MAKES A BOX A BUILDING: a plinth it rises out of, pilasters at the
## corners, a cornice where wall stops and roof starts, lit windows in rows
## (a rectangle with warm windows in it is somewhere with people inside), and
## steps up to the door, which make it a threshold instead of a hole.
func _dress() -> void:
	var wall_c: Color = b.wall
	var roof_c: Color = b.roof
	var stone := mat("stone", wall_c.darkened(0.3))
	var trim := mat("trim", roof_c)
	var sill := mat("sill", roof_c.darkened(0.6))
	var glass := mat("glass", Color("ffe4a8"), true)
	box(Vector3(b.w + 2.2, 3.2, b.d + 2.2), Vector3(0, -1.45, 0), stone)
	# the band round the plinth tops out at the floor, not above it: the
	# browser stood it 0.42 m proud, over the whole footprint, and every room
	# in the game was floored with it
	box(Vector3(b.w + 1.4, 0.42, b.d + 1.4), Vector3(0, -0.18, 0), trim)
	var PW := clampf(b.w * 0.05, 1.4, 2.4)
	var PH := H + 1.1
	for s in [[-1, -1], [1, -1], [-1, 1], [1, 1]]:
		var x: float = s[0] * hw
		var z: float = s[1] * hd
		box(Vector3(PW, PH, PW), Vector3(x, PH / 2.0, z), stone, true)
		box(Vector3(PW + 0.55, 0.55, PW + 0.55), Vector3(x, PH + 0.27, z), trim)
	box(Vector3(b.w + 1.7, 0.75, b.d + 1.7), Vector3(0, H - 0.38, 0), trim)
	var rows := 2 if H > 14.0 else 1
	var win_h := minf(3.0, (H - 3.0) / (rows + 0.7))
	var window := func(x: float, y: float, z: float, wide: float, along_x: bool) -> void:
		var w := wide if along_x else 0.5
		var d := 0.5 if along_x else wide
		box(Vector3(w + 0.9, win_h + 0.9, d + 0.9), Vector3(x, y, z), sill)
		box(Vector3(w, win_h, d), Vector3(x, y, z), glass)
		box(Vector3(w + 1.2, 0.35, d + 1.2), Vector3(x, y - win_h / 2.0 - 0.5, z), trim)
	for r in rows:
		var y := H * (0.52 if rows == 1 else 0.30 + r * 0.34)
		var run_x: float = b.d - PW * 2.0 - 4.0
		var n_x := maxi(2, roundi(run_x / 7.0))
		for i in n_x:
			var z: float = -run_x / 2.0 + run_x * (i + 0.5) / n_x
			window.call(hw + 0.05, y, z, 2.6, false)
			window.call(-hw - 0.05, y, z, 2.6, false)
		var run_z: float = b.w - PW * 2.0 - 4.0
		var n_z := maxi(2, roundi(run_z / 7.0))
		for i in n_z:
			var x := -run_z / 2.0 + run_z * (i + 0.5) / n_z
			window.call(x, y, -hd - 0.05, 2.6, true)
			# the front: anything clear of the opening gets a window
			if absf(x) < GAP / 2.0 + 2.0 and y < DOOR + win_h / 2.0 + 1.0:
				continue
			window.call(x, y, hd + 0.05, 2.6, true)
	for i in 3:
		var out := 1.1 + i * 1.15
		box(Vector3(GAP + 2.4 + i * 1.4, 0.5, out * 2.0), Vector3(0, -0.25 - i * 0.5, hd + out), stone)
	for sx in [-1.0, 1.0]:
		box(Vector3(1.5, DOOR + 1.6, 1.5), Vector3(sx * (GAP / 2.0 + 0.75), (DOOR + 1.6) / 2.0, hd), stone, true)
		box(Vector3(0.7, 0.7, 0.7), Vector3(sx * (GAP / 2.0 + 0.75), DOOR + 0.3, hd + 1.0), glass)
	box(Vector3(GAP + 3.0, 1.1, 1.6), Vector3(0, DOOR + 1.6, hd), trim)
	# the door lamps light the step
	var lamp := OmniLight3D.new()
	lamp.light_color = Color("ffe4a8")
	lamp.light_energy = 1.2
	lamp.omni_range = 9.0
	lamp.position = Vector3(0, DOOR - 0.5, hd + 2.0)
	_fade(lamp)
	add_child(lamp)

func _fade(l: Light3D) -> void:
	l.distance_fade_enabled = true
	l.distance_fade_begin = 90.0
	l.distance_fade_length = 30.0
	l.shadow_enabled = false

## A GENERIC ROOM, under whatever the building puts in it: a floor with a
## border (a floor one colour edge to edge has no readable size), a rail and
## a skirting round the walls — round them, with the doorway left open —
## beams you can read the height of, and light off the walls.
func _indoors() -> void:
	var wall_c: Color = b.wall
	var roof_c: Color = b.roof
	var wood := mat("wood_in", wall_c.darkened(0.25))
	var trim := mat("trim", roof_c)
	var warm := mat("glass", Color("ffe4a8"), true)
	# a hand's breadth at most: the plate you walk on is at zero
	box(Vector3(b.w - 2.5, 0.1, b.d - 2.5), Vector3(0, -0.01, 0), trim)
	box(Vector3(b.w - 5.5, 0.1, b.d - 5.5), Vector3(0, 0.0, 0), wood)
	box(Vector3(GAP - 1.0, 0.1, 3.4), Vector3(0, 0.0, hd - 1.6), wood)
	var side: float = (b.w - GAP) / 2.0
	var runs := [[0.0, -hd + 0.6, b.w - 1.6, 1.0], [-hw + 0.6, 0.0, 1.0, b.d - 1.6], [hw - 0.6, 0.0, 1.0, b.d - 1.6],
		[-(GAP / 2.0 + side / 2.0), hd - 0.6, side - 1.2, 1.0], [GAP / 2.0 + side / 2.0, hd - 0.6, side - 1.2, 1.0]]
	for r in runs:
		var w: float = 0.5 if r[2] == 1.0 else r[2]
		var d: float = 0.5 if r[3] == 1.0 else r[3]
		box(Vector3(w, 0.5, d), Vector3(r[0], 3.1, r[1]), trim)
		box(Vector3(w + 0.2 if r[2] == 1.0 else w, 0.7, d + 0.2 if r[3] == 1.0 else d), Vector3(r[0], 0.35, r[1]), wood)
	var n_b := maxi(3, roundi(b.d / 9.0))
	for i in n_b:
		var z: float = -hd + (i + 0.5) * (b.d / n_b)
		box(Vector3(b.w - 1.2, 0.8, 1.0), Vector3(0, H - 1.1, z), wood)
	var n_l := maxi(2, roundi(b.d / 11.0))
	for i in n_l:
		var z: float = -hd + (i + 0.5) * (b.d / n_l)
		for sx in [-1.0, 1.0]:
			box(Vector3(0.5, 1.3, 0.5), Vector3(sx * (hw - 0.9), 4.6, z), trim)
			box(Vector3(0.8, 0.8, 0.8), Vector3(sx * (hw - 1.3), 5.4, z), warm)
	var glow := OmniLight3D.new()
	glow.light_color = Color("ffe0b0")
	glow.light_energy = 2.0
	glow.omni_range = maxf(b.w, b.d) * 0.9
	glow.omni_attenuation = 0.8
	glow.position = Vector3(0, H * 0.6, 0)
	_fade(glow)
	add_child(glow)

func _strip_lights(zs: Array, col: Color) -> void:
	var tube := mat("tube", col, true)
	for z in zs:
		box(Vector3(hw * 1.2, 0.3, 0.9), Vector3(0, H - 1.4, z), tube)
		var l := OmniLight3D.new()
		l.light_color = col
		l.light_energy = 1.3
		l.omni_range = 40.0
		l.omni_attenuation = 0.9
		l.position = Vector3(0, H - 2.0, z)
		_fade(l)
		add_child(l)

# ---------------------------------------------------------- the workshop

## Benches down both sides with work half-done on them, racks of stock
## against the back, and a clear floor in the middle.
func _workshop() -> void:
	var wood := mat("bench", Color("6b4f3a"))
	var dark := mat("bench_dark", Color("4a3726"))
	var steel := mat("steel", Color("8a93a8"))
	var parts := [Color("ffb4a2"), Color("8fd3ff"), Color("a8e6cf"), Color("cdb4f6"), Color("ffe9a8")]
	for i in parts.size():
		mat("part%d" % i, parts[i])
	for sx in [-1.0, 1.0]:
		var x: float = sx * (hw - 2.6)
		for i in 3:
			var z: float = -hd + 5.0 + i * (b.d - 10.0) / 2.6
			box(Vector3(2.0, 0.30, 5.0), Vector3(x, 1.15, z), wood, true)
			for sz in [-1.0, 1.0]:
				box(Vector3(0.35, 1.0, 0.35), Vector3(x, 0.5, z + sz * 2.0), dark)
			box(Vector3(0.25, 1.5, 4.6), Vector3(x + sx * 0.85, 2.1, z), steel)
			for k in 3:
				var h := 0.5 + ((i + k) % 3) * 0.35
				box(Vector3(0.7, h, 0.7), Vector3(x - sx * 0.3, 1.3 + h / 2.0, z - 1.6 + k * 1.6), "part%d" % ((i * 3 + k) % parts.size()))
	for i in 4:
		var x: float = -hw + 7.0 + i * (b.w - 14.0) / 3.0
		var z: float = -hd + 1.9
		box(Vector3(4.0, 0.25, 1.4), Vector3(x, 1.5, z), steel)
		box(Vector3(4.0, 0.25, 1.4), Vector3(x, 3.0, z), steel)
		for sx in [-1.0, 1.0]:
			box(Vector3(0.3, 3.2, 1.4), Vector3(x + sx * 1.85, 1.6, z), steel, true)
		for k in 3:
			box(Vector3(0.9, 0.9, 0.9), Vector3(x - 1.2 + k * 1.2, 3.6 if k % 2 else 2.1, z), "part%d" % ((i + k) % parts.size()))
	panel(0, -hd + 3.2, "THE WORKSHOP\nBuild anything, with your class", Color("22406b"), 0.0, "the workbench",
		func(w): w.hud.say("The Workshop's block editor is in the browser version for now — everything you build there is saved to your account.", 5.0))

# -------------------------------------------------------------- the mall

## Choosing who you are, standing up: everybody on a dais at your own height,
## turning slowly the way a shop window turns, a console beside each.
func _mall() -> void:
	_strip_lights([-hd * 0.4, hd * 0.3], Color("ffeef6"))
	var ids := Walker.CHARACTERS.keys()
	var n := ids.size()
	var span := minf((hw - 8.0) * 2.0, (n - 1) * 9.0)
	var st := mat("dais", Color("8d93b5"))
	var dk := mat("dais_dark", Color("545a7d"))
	var band := mat("dais_band", Color("a8e6cf"), true)
	for i in n:
		var x := -span / 2.0 + span * float(i) / maxf(1.0, n - 1)
		var z: float = -hd + 6.0
		cyl(1.9, 0.22, Vector3(x, 0.11, z), dk)
		cyl(1.7, 0.24, Vector3(x, 0.34, z), st)
		cyl(1.45, 0.22, Vector3(x, 0.57, z), dk)
		cyl(1.5, 0.1, Vector3(x, 0.70, z), band)
		_solid(Vector3(3.6, 0.7, 3.6), Transform3D(Basis(), Vector3(x, 0.35, z)))
		var stage := Node3D.new()
		stage.position = Vector3(x, 0.76, z)
		add_child(stage)
		var who := Models.spawn("res://assets/characters/character-%s.glb" % ids[i])
		stage.add_child(who)
		Models.use_vertex_colors(who)
		Models.fit_height(who, Walker.HEIGHT * 0.94)
		var ap := Models.anim_player(who)
		if ap and ap.has_animation("idle"):
			Models.loop_clips(ap)
			ap.play("idle")
			ap.seek(randf() * 2.0)
		stage.rotation.y = randf() * TAU
		spinners.append(stage)
		var id: String = ids[i]
		panel(x + 3.1, z + 1.7, Walker.CHARACTERS[id].to_upper() + "\nFREE", Color("1d4030"), 0.0,
			"be " + Walker.CHARACTERS[id], func(w):
				w.player.set_character(id)
				w.hud.say("You are %s now." % Walker.CHARACTERS[id], 2.5))
	panel(hw - 9.0, hd - 7.0, "THE COUNTER\neverybody, in a row", Color("2a2013"), -PI / 2.0, "the counter",
		func(w): w.hud.toggle_picker())

# ----------------------------------------------------------- the mechanic

## A floor with the actual cars standing on it: walk down the bays, look at
## the thing, and the console beside it is where you choose it. What stands on
## the bay is the same car you drive.
func _mechanic() -> void:
	for i in Wallet.CARS.size():
		var c: Dictionary = Wallet.CARS[i]
		var x := -2.0
		var z: float = -hd + 7.0 + i * 6.4
		var car := CarModel.make(c.paint, 5.4)
		car.position = Vector3(x, 0.17, z)
		car.rotation.y = PI / 2.0
		add_child(car)
		_solid(Vector3(2.4, 1.3, 5.6), Transform3D(Basis(Vector3.UP, PI / 2.0), Vector3(x, 0.8, z)))
		var id: String = c.id
		panel(x - 5.4, z, "", Color("22406b"), PI / 2.0, "choose " + c.name, func(w): Wallet.choose_car(w, id))
	_garage_posters()
	_garage_props()
	# Kit, at work: a round of jobs, each [where, facing, sparks?] — and a
	# fourth `false` for a point she only walks through, round a car or a pad
	if ResourceLoader.exists("res://assets/characters/character-kit.glb"):
		add_child(Kit.new().setup(self, [
			[Vector3(-2.0, 0, -4.3), PI, true],                 # the first car, from its side
			[Vector3(_mech_x(0), 0, -hd + 6.9), PI, true],      # the Vanguard's plinth
			[Vector3(_mech_x(1), 0, -hd + 6.9), PI, true],      # the Seraph's
			[Vector3(16.6, 0, -3.0), PI / 2.0, false],          # the bench under the pegboard
			[Vector3(14.5, 0, 3.5), 0.0, false, false],
			[Vector3(16.9, 0, 9.1), PI / 2.0, false],           # the tool chests
			[Vector3(2.4, 0, 5.8), -PI / 2.0, true],            # the third car
			[Vector3(2.4, 0, 9.0), 0.0, false, false],
			[Vector3(-7.0, 0, 9.0), 0.0, false, false],
			[Vector3(-17.8, 0, 9.4), -PI / 2.0, false],         # the lockers
			[Vector3(-9.5, 0, 2.6), 0.0, false, false],
			[Vector3(-6.0, 0, -3.4), 0.0, false, false],
		]))
	_ship_bay()
	_mech_bays()
	panel(0, -hd + 3.4, "", Color("2a2013"), 0.0, "your coins", func(w):
		w.hud.say("You have %d coins, and you are level %d." % [Wallet.coins(), Wallet.level()], 3.0))
	_repaint_bays()

# -------------------------------------------------------- the garage look

## THE GARAGE, built as one model in Higgsfield's 3D Jutsu to the reference
## photo (glb files/shop/, project "KORO — The Mechanic"): brick and steel
## walls, a sawtooth roof, trusses and ducts, the mezzanine office, shelving,
## lockers, pegboards, cage lamps. Glued to the game's own frame: +z is the
## door, the car bays, the ship pad and the mecha plinths sit on its markings.
const GARAGE := "res://assets/mechanic/garage.glb"

func _garage_model() -> void:
	var src := Models.spawn(GARAGE)
	# 700 parts would be 700 draw calls: merged by material, it is a few dozen
	var groups := {}
	for n in src.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		var xf := Transform3D()
		var p: Node = mi
		while p != src and p is Node3D:
			xf = (p as Node3D).transform * xf
			p = p.get_parent()
		for si in mi.mesh.get_surface_count():
			var m: Material = mi.get_active_material(si)
			var key := "%d:%d" % [m.get_instance_id() if m else 0, mi.mesh.surface_get_format(si)]
			if not groups.has(key):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				groups[key] = [st, m]
			(groups[key][0] as SurfaceTool).append_from(mi.mesh, si, xf)
	for key in groups:
		var mesh: ArrayMesh = (groups[key][0] as SurfaceTool).commit()
		var gm: Material = _garage_surface(groups[key][1])
		if gm is BaseMaterial3D and (gm as BaseMaterial3D).emission_enabled:
			# Blender's emission was set for Blender's exposure; under the
			# game's glow it blows out to white, so it is brought down here
			gm = gm.duplicate()
			(gm as BaseMaterial3D).emission_energy_multiplier *= 0.35
		if gm:
			mesh.surface_set_material(0, gm)
		var out := MeshInstance3D.new()
		out.mesh = mesh
		# a hair above the plate every building stands on (+0.02), or the
		# plate covers the painted floor
		out.position.y = 0.03
		add_child(out)
	src.free()
	_garage_solid()
	_garage_lights()
	_garage_air()

## THE SURFACES. The model is boxes in flat colour; what makes a room read as
## brick and steel and wet concrete is texture. These are Higgsfield's
## (assets/garage/), laid on by material name and projected from the world's
## own axes — the boxes have no UVs — at the size the real thing would be.
const SURFACES := {
	"Concrete_Polished": ["concrete", 6.0, 0.16, 0.12, Color(0.6, 0.6, 0.64)],
	"Brick_Red": ["brick", 2.4, 0.85, 0.0, Color(1, 1, 1)],
	"Steel_Panel_Blue": ["cladding", 3.0, 0.45, 0.4, Color(1, 1, 1)],
	"Steel_Dark": ["steel", 2.0, 0.5, 0.55, Color(1, 1, 1)],
	"Roof_Metal": ["roofing", 4.0, 0.55, 0.5, Color(0.9, 0.9, 0.95)],
	"Shelf_Steel": ["steel", 1.5, 0.5, 0.55, Color(1.2, 1.2, 1.25)],
	"Office_Wall": ["cladding", 2.0, 0.6, 0.2, Color(1.5, 1.35, 1.1)],
}

func _garage_surface(m: Material) -> Material:
	if not (m is BaseMaterial3D) or not SURFACES.has(m.resource_name):
		return m
	var spec: Array = SURFACES[m.resource_name]
	var path := "res://assets/garage/%s.jpg" % spec[0]
	if not ResourceLoader.exists(path):
		return m
	var out := (m as BaseMaterial3D).duplicate() as BaseMaterial3D
	out.albedo_texture = load(path)
	out.albedo_color = spec[4]
	out.uv1_triplanar = true
	out.uv1_world_triplanar = true
	out.uv1_scale = Vector3.ONE / float(spec[1])
	out.roughness = spec[2]
	out.metallic = spec[3]
	out.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return out

## THE AIR. Light shafts through the skylights (a fog volume that only this
## room has, lit by the angled skylight spots), a reflection probe for the
## wet floor, and a warm ambient of its own inside, so the night outside
## stops tinting everything blue.
func _garage_air() -> void:
	var fv := FogVolume.new()
	fv.shape = RenderingServer.FOG_VOLUME_SHAPE_BOX
	fv.size = Vector3(b.w - 1.0, 10.0, b.d - 1.0)
	fv.position = Vector3(0, 5.0, 0)
	var fm := FogMaterial.new()
	fm.density = 0.018
	fm.albedo = Color(1.0, 0.92, 0.82)
	fm.height_falloff = 0.0
	fm.edge_fade = 0.1
	fv.material = fm
	add_child(fv)
	var rp := ReflectionProbe.new()
	rp.size = Vector3(b.w - 0.6, 10.0, b.d - 0.6)
	rp.position = Vector3(0, 5.0, 0)
	rp.box_projection = true
	rp.interior = true
	rp.ambient_mode = ReflectionProbe.AMBIENT_COLOR
	rp.ambient_color = Color(0.42, 0.36, 0.3)
	rp.ambient_color_energy = 0.9
	rp.update_mode = ReflectionProbe.UPDATE_ONCE
	add_child(rp)
	# the mezzanine deck and the stair treads in diamond plate
	var dp := StandardMaterial3D.new()
	if ResourceLoader.exists("res://assets/garage/diamond.jpg"):
		dp.albedo_texture = load("res://assets/garage/diamond.jpg")
	dp.uv1_triplanar = true
	dp.uv1_world_triplanar = true
	dp.uv1_scale = Vector3.ONE / 1.2
	dp.metallic = 0.7
	dp.roughness = 0.35
	_quad(Vector2(13.3, 5.4), Transform3D(Basis(Vector3.RIGHT, -PI / 2.0), Vector3(-12.75, 4.235, -10.75)), dp)

## What you bump into, stand on and climb: the model is only a picture.
func _garage_solid() -> void:
	const WH := 10.0
	_solid(Vector3(b.w, WH, 0.5), Transform3D(Basis(), Vector3(0, WH / 2.0, -hd + 0.25)))
	_solid(Vector3(0.5, WH, b.d), Transform3D(Basis(), Vector3(-hw + 0.25, WH / 2.0, 0)))
	_solid(Vector3(0.5, WH, b.d), Transform3D(Basis(), Vector3(hw - 0.25, WH / 2.0, 0)))
	var side: float = (b.w - 9.0) / 2.0
	for sx in [-1.0, 1.0]:
		_solid(Vector3(side, WH, 0.5), Transform3D(Basis(), Vector3(sx * (4.5 + side / 2.0), WH / 2.0, hd - 0.25)))
	_solid(Vector3(9.0, 1.0, 0.5), Transform3D(Basis(), Vector3(0, 9.5, hd - 0.25)))
	# the sawtooth roof, tooth by tooth, so you can land on it and walk it
	var slope := atan2(3.5, 7.0)
	for i in 4:
		var zc: float = hd - 3.5 - i * 7.0
		_solid(Vector3(b.w, 0.3, 7.83), Transform3D(Basis(Vector3.RIGHT, slope), Vector3(0, 11.75, zc)))
	# the mezzanine: its deck, the stairs up (a ramp), the office, the rails
	_solid(Vector3(13.5, 0.3, 5.5), Transform3D(Basis(), Vector3(-12.75, 4.05, -10.75)))
	_solid(Vector3(2.0, 0.2, 7.32), Transform3D(Basis(Vector3.RIGHT, atan2(4.2, 6.0)), Vector3(-18.45, 2.1, -5.0)))
	_solid(Vector3(8.7, 3.0, 4.1), Transform3D(Basis(), Vector3(-14.85, 5.7, -11.25)))
	_solid(Vector3(11.3, 1.1, 0.1), Transform3D(Basis(), Vector3(-11.65, 4.75, -8.15)))
	_solid(Vector3(0.1, 1.1, 5.5), Transform3D(Basis(), Vector3(-6.15, 4.75, -10.75)))
	for x in [-6.3, -12.75]:
		_solid(Vector3(0.35, 4.2, 0.35), Transform3D(Basis(), Vector3(x, 2.1, -8.3)))
	# lockers, the racks under the deck, the tyre rack, barrels and crates
	_solid(Vector3(0.6, 2.0, 4.9), Transform3D(Basis(), Vector3(-19.2, 1.0, 9.6)))
	_solid(Vector3(10.4, 2.8, 0.8), Transform3D(Basis(), Vector3(-13.9, 1.4, -13.1)))
	_solid(Vector3(0.6, 1.9, 2.9), Transform3D(Basis(), Vector3(19.05, 0.95, -10.5)))
	for p in [[-16.6, 12.9, 0.0], [17.6, 12.2, PI / 2.0], [17.4, -5.8, PI / 2.0], [-15.2, -1.2, -0.3]]:
		_solid(Vector3(2.64, 1.2, 1.05), Transform3D(Basis(Vector3.UP, p[2]), Vector3(p[0], 0.6, p[1])))
	for p in [[13.3, 12.4], [-11.5, 12.6], [17.3, 4.2]]:
		_solid(Vector3(2.1, 1.6, 0.9), Transform3D(Basis(), Vector3(p[0], 0.8, p[1])))

## The game's own light: the model's lamps are drawn, these do the lighting.
func _garage_lights() -> void:
	for z in [8.75, 1.75, -5.25, -12.25]:
		for x in [-9.0, 9.0]:
			var sl := SpotLight3D.new()
			sl.light_color = Color("ffd9a8")
			sl.light_energy = 2.8
			sl.spot_range = 13.0
			sl.spot_angle = 48.0
			sl.spot_attenuation = 0.8
			# not straight down: in at an angle, the way sun comes through a roof
			sl.transform = Transform3D(Basis(Vector3.UP, 0.35) * Basis(Vector3.RIGHT, -PI / 2.0 + 0.42), Vector3(x, 9.6, z))
			sl.light_volumetric_fog_energy = 2.5
			_fade(sl)
			add_child(sl)
	# under each cage lamp, over the bays, the mechas and the ship
	for p in [[-2.0, -7.0], [-2.0, -0.6], [-2.0, 5.8], [-2.0, 12.2], [6.0, -8.0], [13.5, -8.0], [10.4, -1.4]]:
		var l := OmniLight3D.new()
		l.light_color = Color("ffc98a")
		l.light_energy = 1.6
		l.omni_range = 8.5
		l.position = Vector3(p[0], 5.7, p[1])
		_fade(l)
		add_child(l)
	# the office windows and the neon throw a little colour of their own
	for p in [[Vector3(-14.8, 6.0, -8.6), Color("ffc27a"), 1.4, 7.0], [Vector3(9.75, 7.2, -12.0), Color("ff7a2a"), 1.6, 9.0]]:
		var g := OmniLight3D.new()
		g.position = p[0]
		g.light_color = p[1]
		g.light_energy = p[2]
		g.omni_range = p[3]
		_fade(g)
		add_child(g)

func _garage_posters() -> void:
	var spots := [[1, Transform3D(Basis(Vector3.UP, -PI / 2.0), Vector3(hw - 0.56, 4.6, 11.4))],
		[2, Transform3D(Basis(Vector3.UP, PI / 2.0), Vector3(-hw + 0.56, 4.6, 3.8))],
		[3, Transform3D(Basis(), Vector3(-2.8, 5.2, -hd + 0.56))]]
	for sp in spots:
		var pmat := StandardMaterial3D.new()
		pmat.albedo_texture = load("res://assets/shop/poster%d.jpg" % sp[0])
		pmat.roughness = 0.7
		_quad(Vector2(1.9, 2.8), sp[1], pmat)

func _quad(size: Vector2, xf: Transform3D, m: Material) -> void:
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.transform = xf
	add_child(mi)

## The Higgsfield props (assets/shop/*.glb), each only if it is there.
## Every prop is [file, height, position, turn].
func _garage_props() -> void:
	var props := [
		["chest", 1.5, Vector3(hw - 1.3, 0, 8.3), -PI / 2.0], ["chest", 1.5, Vector3(hw - 1.3, 0, 9.9), -PI / 2.0],
		["chest", 1.5, Vector3(2.2, 0, -hd + 1.2), 0.0],
		["bench", 1.9, Vector3(hw - 1.6, 0, -3.0), -PI / 2.0],
		["lift", 4.8, Vector3(-2.0, 0, -7.0), PI / 2.0], ["lift", 4.8, Vector3(-2.0, 0, 5.8), PI / 2.0],
	]
	for p in props:
		var path := "res://assets/shop/%s.glb" % p[0]
		if not ResourceLoader.exists(path):
			continue
		# turned in a holder: fit_height centres the model by moving it, and
		# a turn applied to the model itself would swing it off its spot
		var holder := Node3D.new()
		holder.position = p[2]
		holder.rotation.y = p[3]
		add_child(holder)
		var m := Models.spawn(path)
		holder.add_child(m)
		Models.fit_height(m, p[1])

func _repaint_bays() -> void:
	for n in get_children():
		if n is Label3D and n.has_meta("bay"):
			n.queue_free()
	for i in Wallet.CARS.size():
		var c: Dictionary = Wallet.CARS[i]
		var z: float = -hd + 7.0 + i * 6.4
		var line := "IN USE" if Wallet.car_id() == c.id else ("OWNED" if Wallet.owns_car(c.id) else ("FREE" if c.price == 0 else "%d coins" % c.price))
		var lbl := Label3D.new()
		lbl.text = c.name.to_upper() + "\n" + line
		lbl.font_size = 44
		lbl.pixel_size = 0.0075
		lbl.outline_size = 8
		lbl.transform = Transform3D(Basis(Vector3.UP, PI / 2.0) * Basis(Vector3.RIGHT, -0.35), Vector3(-7.4 + 0.02, 1.75, z))
		lbl.set_meta("bay", true)
		add_child(lbl)
	for i in Wallet.MECHS.size():
		var m: Dictionary = Wallet.MECHS[i]
		var line := "IN USE — X" if Wallet.mech_id() == m.id else ("OWNED" if Wallet.owns_mech(m.id) else "%s coins" % _commas(int(m.price)))
		var lbl := Label3D.new()
		lbl.text = m.name.to_upper() + "\n" + line
		lbl.font_size = 44
		lbl.pixel_size = 0.0075
		lbl.outline_size = 8
		lbl.transform = Transform3D(Basis(Vector3.RIGHT, -0.35), Vector3(_mech_x(i), 1.75, -hd + 7.62))
		lbl.set_meta("bay", true)
		add_child(lbl)
	var purse := Label3D.new()
	purse.text = "YOUR COINS\n%d  ·  LV %d" % [Wallet.coins(), Wallet.level()]
	purse.font_size = 44
	purse.pixel_size = 0.0075
	purse.outline_size = 8
	purse.transform = Transform3D(Basis(Vector3.RIGHT, -0.35), Vector3(0, 1.75, -hd + 3.42))
	purse.set_meta("bay", true)
	add_child(purse)

# ---------------------------------------------------------- the mechas

func _mech_x(i: int) -> float:
	return hw * 0.3 + i * 7.5

## Along the back wall, right of the coins: each mecha a scale model on a
## plinth, 7 m of the real 20, with its price in front. E buys it (Wallet).
func _mech_bays() -> void:
	for i in Wallet.MECHS.size():
		var m: Dictionary = Wallet.MECHS[i]
		if not ResourceLoader.exists(m.model):
			continue
		var x := _mech_x(i)
		var z := -hd + 3.2
		cyl(2.6, 0.6, Vector3(x, 0.3, z), mat("bay_deck", Color("3f4a63")))
		cyl(2.35, 0.06, Vector3(x, 0.63, z), mat("mech_ring", Color("ffd766"), true))
		_solid(Vector3(5.2, 0.6, 5.2), Transform3D(Basis(), Vector3(x, 0.3, z)))
		var model := Models.spawn(m.model)
		add_child(model)
		Models.fit_height(model, 7.0)
		model.position += Vector3(x, 0.62, z)
		var ap := Models.anim_player(model)
		if ap and ap.has_animation("idle"):
			Models.loop_clips(ap, ["jump"])
			ap.play("idle")
		var id: String = m.id
		panel(x, z + 4.4, "", Color("4a3a12"), 0.0, "buy " + m.name, func(w): Wallet.choose_mech(w, id))

static func _commas(n: int) -> String:
	var t := str(n)
	var out := ""
	while t.length() > 3:
		out = "," + t.substr(t.length() - 3) + out
		t = t.substr(0, t.length() - 3)
	return t + out

func refresh() -> void:
	if b.id == "mechanic":
		_repaint_bays()
	if b.get("pad", false):
		_pad_ship()

# ------------------------------------------------------------ the ship

static func has_ship() -> bool:
	return bool(Progress.get_value("has_ship", 0))

static func ship_model(length: float) -> Node3D:
	var holder := Node3D.new()
	var m := Models.spawn("res://assets/ship.glb")
	holder.add_child(m)
	var box := Models.bounds(m)
	var s := length / maxf(0.001, maxf(box.size.z, box.size.x))
	var c := box.get_center()
	m.scale = Vector3.ONE * s
	m.position = Vector3(-c.x, -box.position.y, -c.z) * s
	# glTF noses point down -z like the browser's ship; ours face +z
	m.rotation.y = PI
	m.position = Vector3(c.x, -box.position.y, c.z) * s
	return holder

## THE SHIP LIVES AT THE MECHANIC, and you have to come and get it. It costs
## nothing — it is not another thing to buy, it is a reason to walk
## somewhere before the sky opens up.
func _ship_bay() -> void:
	var x := hw * 0.52
	var z := -hd * 0.10
	cyl(4.4, 0.5, Vector3(x, 0.25, z), mat("bay_deck", Color("3f4a63")))
	cyl(4.05, 0.06, Vector3(x, 0.53, z), mat("bay_ring", Color("8ff0ff"), true))
	cyl(3.85, 0.08, Vector3(x, 0.55, z), "bay_deck")
	_solid(Vector3(9.0, 0.5, 9.0), Transform3D(Basis(), Vector3(x, 0.25, z)))
	var ship := ship_model(6.0)
	ship.position = Vector3(x, 1.6, z)
	add_child(ship)
	spinners.append(ship)
	var l := OmniLight3D.new()
	l.light_color = Color("8ff0ff")
	l.light_energy = 1.5
	l.omni_range = 16.0
	l.position = Vector3(x, 5, z)
	_fade(l)
	add_child(l)
	panel(x, z + 5.6, "", Color("12304a"), 0.0, "take the ship", func(w):
		if not has_ship():
			Progress.set_value("has_ship", 1)
			w.hud.say("The ship is yours. It is waiting on THE PAD — out of the door and to the south.", 5.0)
			for bl in w.buildings:
				bl.refresh()
		else:
			w.hud.say("She is already yours — waiting on THE PAD.", 3.0))
	_bay_label = Label3D.new()
	_bay_label.font_size = 44
	_bay_label.pixel_size = 0.0075
	_bay_label.outline_size = 8
	_bay_label.transform = Transform3D(Basis(Vector3.RIGHT, -0.35), Vector3(x, 1.75, z + 5.62))
	add_child(_bay_label)
	_bay_text()

var _bay_label: Label3D
func _bay_text() -> void:
	if _bay_label:
		_bay_label.text = "SHIP\nYOURS" if has_ship() else "TAKE THE SHIP\nFREE"

# ------------------------------------------------------------- the pad

var _pad_ship_node: Node3D
var _pad_ghost: Label3D

## A launch pad on every world, and your ship standing on it. Walk up, press
## E, and fly yourself to the other planet.
func _pad() -> void:
	var deck := mat("pad_deck", Color("3f4a63"))
	var glow := mat("pad_ring", Color("8ff0ff"), true)
	cyl(7.2, 0.5, Vector3(0, 0.25, 0), deck, 32)
	cyl(6.6, 0.06, Vector3(0, 0.53, 0), glow, 32)
	cyl(6.3, 0.08, Vector3(0, 0.55, 0), deck, 32)
	for i in 8:
		var a := TAU * i / 8.0
		box(Vector3(0.5, 0.2, 0.5), Vector3(cos(a) * 7.6, 0.1, sin(a) * 7.6), glow)
	var sign := Label3D.new()
	sign.text = "THE PAD"
	sign.font_size = 96
	sign.pixel_size = 0.02
	sign.outline_size = 16
	sign.modulate = Color("8ff0ff")
	sign.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	sign.position = Vector3(0, 9.5, -8.5)
	add_child(sign)
	var l := OmniLight3D.new()
	l.light_color = Color("8ff0ff")
	l.light_energy = 1.4
	l.omni_range = 18.0
	l.position = Vector3(0, 6, 0)
	_fade(l)
	add_child(l)
	_pad_ship()
	usable(Vector3(0, 0, 0), "board the ship", func(w):
		if Worlds.current == "hub" and not has_ship():
			w.hud.say("Your ship is at THE MECHANIC — take it from the hangar there. It's free.", 4.5)
		else:
			w.hud.travel_open(), 8.5)

func _pad_ship() -> void:
	var here := Worlds.current != "hub" or has_ship()
	if here and _pad_ship_node == null:
		_pad_ship_node = ship_model(9.0)
		_pad_ship_node.position = Vector3(0, 1.2, 0)
		add_child(_pad_ship_node)
	if _pad_ghost == null:
		_pad_ghost = Label3D.new()
		_pad_ghost.font_size = 48
		_pad_ghost.pixel_size = 0.012
		_pad_ghost.outline_size = 10
		_pad_ghost.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_pad_ghost.position = Vector3(0, 4.5, 0)
		add_child(_pad_ghost)
	_pad_ghost.text = "E — board the ship" if here else "fetch your ship from THE MECHANIC"
	_bay_text()

# ------------------------------------------------------------- the gym

var _bots: Array = []
var _bout_t := 1.5

## The floor is the arena you would fight on, chalked out at the size it is —
## ten squares by ten — and on it the two machines, sparring.
func _gym() -> void:
	var N := 10
	var sq := 1.5
	var half := N * sq / 2.0
	box(Vector3(N * sq + 1.2, 0.16, N * sq + 1.2), Vector3(0, 0.02, 1.5), mat("gym_mat", Color("2e2547")))
	var line := mat("gym_line", Color("8fd3ff"), true)
	for i in N + 1:
		var at := -half + i * sq
		box(Vector3(N * sq, 0.04, 0.07), Vector3(0, 0.12, 1.5 + at), line)
		box(Vector3(0.07, 0.04, N * sq), Vector3(at, 0.12, 1.5), line)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color("ffd8f0")
	lamp.light_energy = 2.4
	lamp.omni_range = 36.0
	lamp.position = Vector3(0, H - 3.0, 1.5)
	_fade(lamp)
	add_child(lamp)
	for spec in [["noisyboy", Vector3(-2.2, 0.1, 1.5), PI / 2.0], ["ambush", Vector3(2.2, 0.1, 1.5), -PI / 2.0]]:
		var bot := Models.spawn("res://assets/characters/%s.glb" % spec[0])
		add_child(bot)
		Models.fit_height(bot, 2.7)
		bot.position += spec[1]
		bot.rotation.y = spec[2]
		var ap := Models.anim_player(bot)
		Models.loop_clips(ap, ["jab", "hook", "cross", "roundhouse", "flykick", "sweep", "block", "dodge",
			"hit", "floored", "getup", "roar", "uppercut"])
		if ap:
			ap.play("idle")
		_bots.append(ap)
	_solid(Vector3(N * sq, 3.0, N * sq), Transform3D(Basis(), Vector3(0, 1.5, 1.5)))
	panel(-12, -hd + 4.2, "FIGHT THE LEAGUE", Color("2a1d3d"), 0.0, "the league", func(w):
		w.hud.say("A fight here is a program you write in blocks — that is in the browser for now. Watch these two in the meantime.", 5.0))
	panel(0, -hd + 4.2, "FIGHT A PLAYER", Color("3d1d28"), 0.0, "fight a player", func(w):
		w.hud.say("Player fights are written in blocks too — in the browser for now.", 4.0))

## A bout, over and over: one throws, the other blocks, slips or takes it,
## and now and then somebody goes down and gets up again.
func _spar(delta: float) -> void:
	if _bots.size() < 2 or _bots[0] == null or _bots[1] == null:
		return
	_bout_t -= delta
	if _bout_t > 0.0:
		return
	var a := randi() % 2
	var hit: AnimationPlayer = _bots[a]
	var take: AnimationPlayer = _bots[1 - a]
	var move: String = ["jab", "hook", "cross", "roundhouse", "flykick", "uppercut", "sweep"][randi() % 7]
	var answer: String = ["block", "dodge", "hit", "hit", "block"][randi() % 5]
	if answer == "hit" and randf() < 0.18:
		answer = "floored"
	_bout(hit, move)
	_bout(take, answer)
	_bout_t = 1.3 + randf() * 1.2
	if answer == "floored":
		_bout_t += 2.2
		get_tree().create_timer(1.6).timeout.connect(func(): _bout(take, "getup"))
		get_tree().create_timer(1.8).timeout.connect(func(): _bout(hit, "roar"))

func _bout(ap: AnimationPlayer, clip: String) -> void:
	if ap and ap.has_animation(clip):
		ap.play(clip, 0.12)
		ap.queue("idle")

# ----------------------------------------------------------- the arcade

## Where a game somebody made stops being theirs alone: a cabinet each, with
## its title on the screen. Playing them needs the block language, which is
## in the browser for now.
func _arcade() -> void:
	var body := mat("cab", Color("1b2238"))
	var trim := mat("cab_trim", Color("8ff0ff"), true)
	var screens := [Color("ff6ad5"), Color("8ff0ff"), Color("ffe9a8"), Color("a8e6cf")]
	for i in screens.size():
		mat("screen%d" % i, screens[i].darkened(0.35), true)
	var k := 0
	for row in 2:
		for i in 6:
			var x: float = -hw + 6.0 + i * (b.w - 12.0) / 5.0
			var z: float = -hd + 5.0 + row * 9.0
			box(Vector3(1.6, 2.4, 1.2), Vector3(x, 1.2, z), body, true)
			box(Vector3(1.64, 0.1, 1.24), Vector3(x, 2.45, z), trim)
			box(Vector3(1.2, 0.9, 0.05), Vector3(x, 1.75, z + 0.61), "screen%d" % (k % screens.size()))
			box(Vector3(1.5, 0.12, 0.5), Vector3(x, 1.0, z + 0.75), trim)
			var id := k
			usable(Vector3(x, 0, z + 1.5), "play cabinet %d" % (k + 1), func(w):
				w.hud.say("Games made in the Workshop are block programs — they play in the browser for now. Cabinet %d is waiting." % (id + 1), 4.5), 1.6)
			k += 1
	var sign := Label3D.new()
	sign.text = "PLAY WHAT YOUR CLASS HAS MADE"
	sign.font_size = 64
	sign.pixel_size = 0.012
	sign.outline_size = 12
	sign.modulate = Color("8ff0ff")
	sign.position = Vector3(0, H - 3.0, -hd + 0.8)
	add_child(sign)
	var glow := OmniLight3D.new()
	glow.light_color = Color("8ff0ff")
	glow.light_energy = 1.5
	glow.omni_range = 30.0
	glow.position = Vector3(0, H * 0.5, -hd + 8.0)
	_fade(glow)
	add_child(glow)

# ------------------------------------------------------------- the house

## Yours: a room to be in on a planet nobody else has.
func _house() -> void:
	var sofa := mat("sofa", Color("cdb4f6").darkened(0.35))
	var wood := mat("table", Color("6b4a34"))
	var rug := mat("rug", Color("ffb4a2").darkened(0.2))
	box(Vector3(8.0, 0.06, 6.0), Vector3(0, 0.03, 1.0), rug)
	box(Vector3(5.0, 0.9, 1.6), Vector3(0, 0.45, -3.0), sofa, true)
	box(Vector3(5.0, 1.2, 0.5), Vector3(0, 1.0, -3.8), sofa)
	box(Vector3(2.4, 0.7, 1.4), Vector3(0, 0.35, 0.5), wood, true)
	box(Vector3(3.2, 0.6, 5.2), Vector3(-hw + 3.0, 0.3, -hd + 4.0), mat("bed", Color("8fd3ff").darkened(0.3)), true)
	box(Vector3(3.2, 0.3, 1.2), Vector3(-hw + 3.0, 0.75, -hd + 2.0), mat("pillow", Color("f4f4f0")))
	var name := Label3D.new()
	name.text = Planet.world.get("name", "HOME")
	name.font_size = 80
	name.pixel_size = 0.012
	name.outline_size = 12
	name.modulate = Color("ffe9a8")
	name.position = Vector3(0, H - 3.5, -hd + 0.8)
	add_child(name)
	panel(hw - 4.0, -hd + 3.2, "YOURS\nBuild whatever you like", Color("22406b"), 0.0, "the build desk", func(w):
		w.hud.say("Building on your planet happens in the Workshop's block editor — in the browser for now.", 4.5))

# ------------------------------------------------------------ the library

## Shelves down both side walls, because a library with no books in it is a
## room with a search box — and somebody to ask: ADA, out in front of her
## desk, the whole of her, the way somebody who wants to be asked stands.
func _library() -> void:
	var wood := mat("case", Color("5b4130"))
	var spines := [Color("8fd3ff"), Color("ffb4a2"), Color("a8e6cf"), Color("cdb4f6"), Color("ffe9a8"), Color("e89fb0")]
	for i in spines.size():
		mat("spine%d" % i, spines[i])
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for sx in [-1.0, 1.0]:
		for k in 3:
			var z: float = -hd + 5.5 + k * 5.5
			var x: float = sx * (hw - 1.6)
			box(Vector3(1.6, 4.6, 4.6), Vector3(x, 2.3, z), wood, true)
			for sh in 3:
				for i in 9:
					var h := 0.9 + rng.randf() * 0.5
					box(Vector3(0.2, h, 0.34), Vector3(x - sx * 0.85, 1.1 + sh * 1.45 + h / 2.0 - 0.45, z - 1.9 + i * 0.46), "spine%d" % ((i + sh + k) % spines.size()))
	var x := 5.5
	var z: float = -hd + 3.6
	box(Vector3(5.6, 0.3, 1.5), Vector3(x, 0.95, z), mat("desk", Color("6b4a34")), true)
	box(Vector3(5.6, 0.95, 0.45), Vector3(x, 0.47, z + 0.5), mat("desk_front", Color("59402f")))
	_solid(Vector3(5.6, 1.1, 1.8), Transform3D(Basis(), Vector3(x, 0.55, z)))
	for i in 3:
		box(Vector3(1.1, 0.16, 0.8), Vector3(x - 1.9, 1.18 + i * 0.17, z), "spine%d" % i, false, (i - 1) * 0.12)
	# never the character the player is wearing: two of you is a bug, not a cast
	var mine := Walker.cast_of(str(Progress.get_value("char", "nia")))
	var ada_id := "zuri" if mine != "zuri" else "theo"
	var ada := Models.spawn("res://assets/characters/character-%s.glb" % ada_id)
	add_child(ada)
	Models.use_vertex_colors(ada)
	Models.fit_height(ada, Walker.HEIGHT * 0.94)
	ada.position += Vector3(x, 0.1, z + 2.4)
	var ap := Models.anim_player(ada)
	if ap:
		Models.loop_clips(ap)
		ap.play("talk" if ap.has_animation("talk") else "idle")
	var tag := Label3D.new()
	tag.text = "ADA — the librarian"
	tag.font_size = 40
	tag.pixel_size = 0.008
	tag.outline_size = 8
	tag.modulate = Color("ffe9a8")
	tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	tag.position = Vector3(x, 2.5, z + 2.4)
	add_child(tag)
	usable(Vector3(x, 0, z + 2.4), "talk to Ada", func(w):
		w.hud.talk_open("ada", "Ada", "Hello! Stuck on something you are building, or just curious? Ask me anything about the language."))
	panel(-5.5, -hd + 3.2, "THE LIBRARY\nLook up any word in the language", Color("22406b"), 0.0, "the catalogue",
		func(w): w.hud.library_open(""))

func _process(delta: float) -> void:
	for s in spinners:
		(s as Node3D).rotation.y += 0.35 * delta
	if b.id == "gym":
		_spar(delta)
