## HER ROOM, LIVED IN (the song's cut-aways look round it): homework she never handed in — chem write-ups stamped
## MISSING and LATE, a test with SEE ME on it — on the floor by the bed, on the bench, pinned up; cables everywhere,
## bench to amp, desk to wall, a tangle on the bench; and a drafting board by the window with her robot on it: an
## actuator rig, front and side, dimensioned, its Ψ-field sensor circled, notes to herself in the margins.
## `spots` — where each is, for the camera: {name: [look-at, from]}
class_name RoomDressing
extends Node3D

var g
var spots := {}
func _init(game) -> void: g = game

# ------------------------------------------------------------------ textures, drawn once
func _paint(size: Vector2i, draw: Callable) -> Texture2D:
	var vp := SubViewport.new(); vp.size = size; vp.render_target_update_mode = SubViewport.UPDATE_ONCE; vp.transparent_bg = false; vp.disable_3d = true
	add_child(vp)
	var c := Control.new(); c.size = Vector2(size); vp.add_child(c)
	c.draw.connect(func(): draw.call(c, Vector2(size)))
	return vp.get_texture()
func _txt(c: Control, at: Vector2, s: String, size: int, col: Color, w := -1.0) -> void:
	c.draw_string(ThemeDB.fallback_font, at, s, HORIZONTAL_ALIGNMENT_LEFT, w, size, col)
func _homework(title: String, stamp: String, grade: String) -> Texture2D:
	return _paint(Vector2i(340, 440), func(c: Control, S: Vector2):
		c.draw_rect(Rect2(Vector2.ZERO, S), Color("#f4f1e8"))
		_txt(c, Vector2(22, 40), title, 22, Color("#2a3a5a"))
		_txt(c, Vector2(22, 66), "Name: Robin Ryu      Per. 3", 15, Color("#555a66"))
		for i in 14:
			var y := 96.0 + i*22.0
			c.draw_line(Vector2(22, y), Vector2(S.x - 22, y), Color(0.55, 0.65, 0.85, 0.5), 1.0)
			if i < 3: c.draw_line(Vector2(26, y - 6), Vector2(26 + randf_range(80, 260), y - 6), Color(0.25, 0.25, 0.35, 0.8), 1.4)
		c.draw_line(Vector2(56, 0), Vector2(56, S.y), Color(0.9, 0.4, 0.45, 0.5), 1.2)
		# the stamp, crooked
		c.draw_set_transform(Vector2(S.x*0.5, S.y*0.62), -0.32, Vector2.ONE)
		var w := stamp.length()*26.0 + 30.0
		c.draw_rect(Rect2(Vector2(-w/2, -32), Vector2(w, 60)), Color(0.82, 0.12, 0.15, 0.85), false, 5.0)
		_txt(c, Vector2(-w/2 + 16, 14), stamp, 40, Color(0.82, 0.12, 0.15, 0.85))
		c.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
		if grade != "":
			c.draw_arc(Vector2(S.x - 60, 62), 34, 0, TAU, 32, Color(0.85, 0.1, 0.12), 3.0)
			_txt(c, Vector2(S.x - 82, 80), grade, 46, Color(0.85, 0.1, 0.12)))
func _schematic() -> Texture2D:
	return _paint(Vector2i(1024, 720), func(c: Control, S: Vector2):
		var bg := Color("#163a63"); var ink := Color(0.88, 0.95, 1.0); var faint := Color(0.6, 0.78, 1.0, 0.25); var hi := Color("#ffd23d")
		c.draw_rect(Rect2(Vector2.ZERO, S), bg)
		for x in range(0, int(S.x), 32): c.draw_line(Vector2(x, 0), Vector2(x, S.y), faint, 1.0)
		for y in range(0, int(S.y), 32): c.draw_line(Vector2(0, y), Vector2(S.x, y), faint, 1.0)
		c.draw_rect(Rect2(Vector2(14, 14), S - Vector2(28, 28)), ink, false, 3.0)
		_txt(c, Vector2(40, 62), "ACTUATOR RIG  —  v3", 34, ink)
		_txt(c, Vector2(40, 92), "R. RYU  ·  LAB 120  ·  DO NOT TOUCH", 18, Color(ink, 0.8))
		# FRONT VIEW: a torso, a head with one big eye, two arms with joints, tracks
		var o := Vector2(280, 410)
		c.draw_rect(Rect2(o + Vector2(-90, -120), Vector2(180, 170)), ink, false, 3.0)                 # the body
		c.draw_rect(Rect2(o + Vector2(-60, -210), Vector2(120, 80)), ink, false, 3.0)                  # the head
		c.draw_arc(o + Vector2(0, -170), 24, 0, TAU, 40, ink, 3.0); c.draw_arc(o + Vector2(0, -170), 9, 0, TAU, 20, ink, 2.0)
		c.draw_line(o + Vector2(-20, -130), o + Vector2(-20, -120), ink, 3.0); c.draw_line(o + Vector2(20, -130), o + Vector2(20, -120), ink, 3.0)
		for sx in [-1, 1]:
			var sh: Vector2 = o + Vector2(sx*90, -100); var el: Vector2 = sh + Vector2(sx*70, 50); var hand: Vector2 = el + Vector2(sx*20, 80)
			c.draw_line(sh, el, ink, 6.0); c.draw_line(el, hand, ink, 6.0)
			c.draw_arc(sh, 12, 0, TAU, 20, ink, 2.5); c.draw_arc(el, 10, 0, TAU, 20, ink, 2.5)
			c.draw_line(hand, hand + Vector2(sx*14, 22), ink, 3.0); c.draw_line(hand, hand + Vector2(-sx*6, 26), ink, 3.0)
		for sx in [-1, 1]: c.draw_rect(Rect2(o + Vector2(sx*60 - 30, 50), Vector2(60, 70)), ink, false, 3.0)
		c.draw_rect(Rect2(o + Vector2(-110, 120), Vector2(220, 34)), ink, false, 3.0)
		for i in 7: c.draw_arc(o + Vector2(-95 + i*31, 137), 11, 0, TAU, 16, Color(ink, 0.7), 1.5)
		# dimensions
		c.draw_line(o + Vector2(-150, -210), o + Vector2(-150, 154), Color(ink, 0.7), 1.2)
		_txt(c, o + Vector2(-210, -20), "820", 18, Color(ink, 0.8))
		c.draw_line(o + Vector2(-110, 190), o + Vector2(110, 190), Color(ink, 0.7), 1.2); _txt(c, o + Vector2(-20, 214), "440", 18, Color(ink, 0.8))
		_txt(c, o + Vector2(-60, 250), "FRONT", 20, ink)
		# the Ψ-field sensor, circled in yellow
		c.draw_arc(o + Vector2(0, -60), 26, 0, TAU, 32, ink, 2.5); _txt(c, o + Vector2(-9, -52), "Ψ", 24, ink)
		c.draw_arc(o + Vector2(0, -60), 44, 0, TAU, 40, hi, 3.0)
		c.draw_line(o + Vector2(36, -86), o + Vector2(150, -190), hi, 2.0)
		_txt(c, o + Vector2(152, -196), "Ψ-FIELD SENSOR", 18, hi)
		_txt(c, o + Vector2(152, -174), "output spikes when field DIPS ??", 16, hi)
		# SIDE VIEW: the arm's actuator, exploded
		var q := Vector2(720, 380)
		c.draw_rect(Rect2(q + Vector2(-50, -130), Vector2(100, 170)), ink, false, 3.0)
		c.draw_rect(Rect2(q + Vector2(-40, -210), Vector2(80, 80)), ink, false, 3.0)
		c.draw_line(q + Vector2(50, -100), q + Vector2(170, -40), ink, 6.0); c.draw_arc(q + Vector2(170, -40), 14, 0, TAU, 20, ink, 2.5)
		for i in 5: c.draw_line(q + Vector2(70 + i*18, -90 + i*9), q + Vector2(78 + i*18, -74 + i*9), Color(ink, 0.8), 2.0)
		_txt(c, q + Vector2(-30, 90), "SIDE", 20, ink)
		_txt(c, q + Vector2(80, -80), "ACTUATOR  (x4)", 16, Color(ink, 0.85))
		_txt(c, q + Vector2(80, -58), "servo + gearbox 1:50", 14, Color(ink, 0.7))
		# notes in the margin, in her hand
		_txt(c, Vector2(560, 600), "TODO: stop it fighting itself", 18, Color("#ff9aa8"))
		_txt(c, Vector2(560, 626), "feedback loop → const. output ✗", 16, Color("#ff9aa8"))
		_txt(c, Vector2(560, 652), "ask Canon for the solder (he has it)", 16, Color(ink, 0.7))
		c.draw_rect(Rect2(Vector2(S.x - 260, S.y - 120), Vector2(230, 90)), ink, false, 2.0)
		_txt(c, Vector2(S.x - 248, S.y - 88), "SHEET 2 / 5", 16, ink); _txt(c, Vector2(S.x - 248, S.y - 60), "SCALE 1:4    REV C", 16, ink))

# ------------------------------------------------------------------ the pieces
func _quad(tex: Texture2D, size: Vector2, at: Vector3, rot: Vector3) -> MeshInstance3D:
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = size; q.mesh = qm
	var m := StandardMaterial3D.new(); m.albedo_texture = tex; m.roughness = 0.9; m.cull_mode = BaseMaterial3D.CULL_DISABLED; q.material_override = m
	q.position = at; q.rotation = rot; add_child(q); return q
func _mat(c: Color, rough := 0.6, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.roughness = rough; m.metallic = metal; return m
func _cable(pts: Array, col: Color, r := 0.007) -> void:
	# a cable: a smooth curve through the points, a thin tube along it
	var curve := Curve3D.new()
	for p in pts: curve.add_point(p)
	for i in curve.point_count:
		var a: Vector3 = pts[maxi(0, i - 1)]; var b: Vector3 = pts[mini(pts.size() - 1, i + 1)]
		curve.set_point_in(i, (a - b)*0.25); curve.set_point_out(i, (b - a)*0.25)
	var path := Path3D.new(); path.curve = curve; add_child(path)
	var poly := CSGPolygon3D.new(); poly.mode = CSGPolygon3D.MODE_PATH; poly.path_node = NodePath("..")
	var circ := PackedVector2Array()
	for k in 6: circ.append(Vector2(cos(k*TAU/6), sin(k*TAU/6))*r)
	poly.polygon = circ; poly.path_interval = 0.04; poly.path_rotation = CSGPolygon3D.PATH_ROTATION_PATH_FOLLOW; poly.smooth_faces = true
	poly.material = _mat(col, 0.5, 0.1); path.add_child(poly)

func build() -> void:
	var R: Dictionary = g.room.room
	var B: Vector3 = g._v(R.bench.at); var P: Vector3 = g._v(R.packing.at); var bed: Dictionary = R.bed
	seed(1407)
	# HOMEWORK: on the floor by the bed, fanned; one on the bench; two pinned to the cork board
	var hw := [["Chem Lab Write-up #4", "MISSING", ""], ["Chem Lab Write-up #5", "MISSING", ""], ["Physics: Problem Set 7", "LATE", "D"],
		["Chem Lab Write-up #6", "MISSING", ""], ["Unit 3 Test", "SEE ME", "F"], ["English: Essay Draft", "LATE", ""]]
	var tex := []
	for h in hw: tex.append(_homework(h[0], h[1], h[2]))
	var floor_at := Vector3(bed.x + 1.3, 0.004, bed.z - 1.6)
	for i in 4:
		_quad(tex[i], Vector2(0.21, 0.27), floor_at + Vector3(randf_range(-0.35, 0.35), i*0.0015, randf_range(-0.3, 0.3)), Vector3(-PI/2, randf_range(-0.9, 0.9), 0))
	spots.homework = [floor_at, floor_at + Vector3(0.55, 0.75, 0.6)]
	_quad(tex[4], Vector2(0.21, 0.27), B + Vector3(-0.35, 0.012, 0.18), Vector3(-PI/2, 0.35, 0))
	spots.test = [B + Vector3(-0.35, 0.01, 0.18), B + Vector3(-0.15, 0.55, 0.65)]
	var cork: Vector3 = g._v(R.cork.at)
	_quad(tex[5], Vector2(0.21, 0.27), cork + Vector3(0.35, -0.05, 0.03), Vector3(0, 0, 0.08))
	_quad(tex[2], Vector2(0.21, 0.27), cork + Vector3(-0.3, -0.12, 0.03), Vector3(0, 0, -0.1))
	spots.pinned = [cork + Vector3(0, -0.08, 0), cork + Vector3(0.1, -0.3, 0.95)]
	# THE DRAFTING BOARD by the window: a tilted board on a stand, the schematic on it, a lamp clamped to it
	var D := Vector3(295.25, 0, -0.4)
	var stand := Node3D.new(); stand.position = D; stand.rotation.y = PI/2; add_child(stand)
	for sx in [-0.45, 0.45]:
		var leg := MeshInstance3D.new(); var lb := BoxMesh.new(); lb.size = Vector3(0.04, 1.0, 0.04); leg.mesh = lb; leg.material_override = _mat(Color(0.15, 0.15, 0.17), 0.4, 0.6)
		leg.position = Vector3(sx, 0.5, 0); stand.add_child(leg)
	var board := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1.1, 0.78, 0.03); board.mesh = bm; board.material_override = _mat(Color(0.82, 0.8, 0.74))
	board.position = Vector3(0, 1.25, 0.05); board.rotation.x = -0.55; stand.add_child(board)
	var sheet := MeshInstance3D.new(); var sm := QuadMesh.new(); sm.size = Vector2(1.0, 0.7); sheet.mesh = sm
	var stex := _schematic(); var smat := StandardMaterial3D.new(); smat.albedo_texture = stex; smat.roughness = 0.85; smat.emission_enabled = true; smat.emission_texture = stex; smat.emission_energy_multiplier = 0.25
	sheet.material_override = smat; sheet.position = Vector3(0, 0, 0.018); board.add_child(sheet)
	var lamp := OmniLight3D.new(); lamp.light_color = Color(1.0, 0.92, 0.75); lamp.light_energy = 1.4; lamp.omni_range = 1.8; lamp.position = Vector3(0.4, 1.9, 0.5); stand.add_child(lamp)
	spots.schematic = [D + Vector3(0.0, 1.27, 0.0), D + Vector3(1.05, 1.62, 0.05)]
	spots.sensor = [D + Vector3(0.0, 1.2, -0.05), D + Vector3(0.5, 1.4, 0.0)]
	# CABLES: bench to amp across the floor, the desk to the wall, a tangle on the bench, the amp's lead to the guitar
	var cols := [Color(0.05, 0.05, 0.06), Color(0.75, 0.12, 0.15), Color(0.9, 0.75, 0.15), Color(0.1, 0.3, 0.8), Color(0.05, 0.05, 0.06)]
	_cable([B + Vector3(0.6, 0.0, 0.1), B + Vector3(0.8, -0.5, 0.25), Vector3(B.x + 1.2, 0.01, B.z + 0.7), Vector3(300.6, 0.01, -2.4), Vector3(302.3, 0.01, -3.0), Vector3(302.5, 0.3, -3.35)], cols[0], 0.008)
	_cable([P + Vector3(-0.3, 0.0, -0.3), Vector3(P.x - 0.4, 0.01, P.z - 0.6), Vector3(304.8, 0.01, -1.6), Vector3(305.4, 0.2, -1.8)], cols[4], 0.008)
	for k in 4:
		var a := B + Vector3(randf_range(-0.6, 0.6), 0.01, randf_range(-0.05, 0.25))
		var pts := [a]
		for j in 4: pts.append(a + Vector3(randf_range(-0.3, 0.3), 0.012 + randf_range(0, 0.04), randf_range(-0.12, 0.25)))
		_cable(pts, cols[k % cols.size()], 0.004)
	_cable([Vector3(302.5, 0.3, -3.35), Vector3(302.2, 0.01, -2.6), Vector3(301.4, 0.01, -2.2), Vector3(300.9, 0.01, -1.9)], cols[1], 0.006)
	# a power strip on the floor, its light on
	var ps := MeshInstance3D.new(); var pb := BoxMesh.new(); pb.size = Vector3(0.32, 0.04, 0.06); ps.mesh = pb; ps.material_override = _mat(Color(0.9, 0.9, 0.88))
	ps.position = Vector3(300.6, 0.02, -2.4); add_child(ps)
	var led := OmniLight3D.new(); led.light_color = Color(1, 0.3, 0.2); led.light_energy = 0.3; led.omni_range = 0.4; led.position = ps.position + Vector3(0.14, 0.05, 0); add_child(led)
	spots.wires = [Vector3(301.0, 0.05, -2.3), Vector3(301.9, 0.35, -1.5)]
	spots.tangle = [B + Vector3(0.0, 0.03, 0.12), B + Vector3(0.55, 0.42, 0.65)]
