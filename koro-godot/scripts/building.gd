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
	if b.get("shell", true):
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
	_strip_lights([-hd * 0.45, hd * 0.15], Color("fff6e0"))
	var paint := mat("bay_mark", Color("3b3128"))
	for i in Wallet.CARS.size():
		var c: Dictionary = Wallet.CARS[i]
		var x := -2.0
		var z: float = -hd + 7.0 + i * 6.4
		box(Vector3(6.2, 0.08, 4.6), Vector3(x, 0.13, z), paint)
		var car := CarModel.make(c.paint, 5.4)
		car.position = Vector3(x, 0.17, z)
		car.rotation.y = PI / 2.0
		add_child(car)
		_solid(Vector3(2.4, 1.3, 5.6), Transform3D(Basis(Vector3.UP, PI / 2.0), Vector3(x, 0.8, z)))
		var id: String = c.id
		panel(x - 5.4, z, "", Color("22406b"), PI / 2.0, "choose " + c.name, func(w): Wallet.choose_car(w, id))
	# the Mechanic, among the cars
	var who := Models.spawn("res://assets/characters/mechanic.glb")
	add_child(who)
	Models.use_vertex_colors(who)
	Models.fit_height(who, 1.75)
	who.position += Vector3(6.0, 0.1, 2.0)
	who.rotation.y = PI * 0.75
	var ap := Models.anim_player(who)
	if ap and ap.has_animation("idle"):
		Models.loop_clips(ap)
		ap.play("idle")
	usable(Vector3(6.0, 0, 2.0), "talk to the Mechanic", func(w):
		w.hud.say("THE MECHANIC — \"Walk down the bays. E at a price to take one. The big one outside? She's yours to drive — E next to her.\"", 5.5))
	panel(0, -hd + 3.4, "", Color("2a2013"), 0.0, "your coins", func(w):
		w.hud.say("You have %d coins, and you are level %d." % [Wallet.coins(), Wallet.level()], 3.0))
	_repaint_bays()

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
	var purse := Label3D.new()
	purse.text = "YOUR COINS\n%d  ·  LV %d" % [Wallet.coins(), Wallet.level()]
	purse.font_size = 44
	purse.pixel_size = 0.0075
	purse.outline_size = 8
	purse.transform = Transform3D(Basis(Vector3.RIGHT, -0.35), Vector3(0, 1.75, -hd + 3.42))
	purse.set_meta("bay", true)
	add_child(purse)

func refresh() -> void:
	if b.id == "mechanic":
		_repaint_bays()

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
	var mine := str(Progress.get_value("char", "s"))
	var ada_id := "t" if mine != "t" else "u"
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
	usable(Vector3(x, 0, z + 2.4), "ask Ada what to read", func(w): w.hud.library_ask())
	panel(-5.5, -hd + 3.2, "THE LIBRARY\nLook up any word in the language", Color("22406b"), 0.0, "the catalogue",
		func(w): w.hud.library_open(""))

func _process(delta: float) -> void:
	for s in spinners:
		(s as Node3D).rotation.y += 0.35 * delta
