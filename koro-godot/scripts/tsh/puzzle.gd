## TSH · ROBIN'S BENCH — public/tshpuzzle.js, ported: the inside of a machine turned into something you can touch.
##   ROUTE     circuit tiles: turn them until power runs from the cell to the processor (then the network: every
##             tile lit, no loose ends)
##   GEARS     rings, each dragging the one inside it: line every notch up
##   FREQ      the field's wave and the robot's, held still: match the SPEED, then the TIMING
##   DIAGNOSE  examine it, then say what is actually wrong
## The boards come from the browser's own seeded generator (the same numbers, so the same boards). Drawn on one
## canvas in a card over the room, in her colours: black glass, teal power, pink for what is wrong.
##
##   puzzle.open("route", {"levels": 3, "psi": true}, func(): ...)
class_name Puzzle
extends Control

const TEAL := Color("#38ffd0"); const PINK := Color("#ff3fd0"); const DIM := Color("#1f3a36"); const INK := Color("#e8fff8")
const VIOLET := Color("#b48aff")
const DIRS := [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]     # dx, dy, my side, its side
const STEPS := 8
const FREQS := [
	{"keys": ["f"], "target": {"f": 3.0, "p": 0.0}, "start": {"f": 1.5, "p": 0.0}},
	{"keys": ["f", "p"], "target": {"f": 2.5, "p": 90.0}, "start": {"f": 4.0, "p": 270.0}}]
const FSTEP := {"f": 0.5, "p": 30.0}; const FMIN := {"f": 0.5, "p": 0.0}; const FMAX := {"f": 6.0, "p": 330.0}
const FNAME := {"f": "SPEED", "p": "TIMING"}; const FWHAT := {"f": "how many waves", "p": "slide the peaks"}
const CASE0 := {
	"checks": [["light", "Status light", "Blinking red, steady: two short, one long. Something is getting power."],
		["battery", "Battery", "3.9 V under load. Fine."],
		["motor", "Motor (bench test)", "Driven straight off the bench supply it spins clean both ways. Nothing caught in it."],
		["log", "Firmware log", "boot OK · checksum OK · v2.3 · calibrating… waiting for SENSOR_1… timeout. retry. timeout."],
		["sensor", "Sensor feed (raw)", "0.000 0.000 0.000 0.000 — covered, uncovered, in the light, in the dark. Flat."]],
	"causes": [["power", "Power failure", "It has power: the light is blinking and the battery reads 3.9 V."], ["sensor", "Sensor malfunction", null],
		["software", "Software error", "The firmware boots and checks out. It is waiting on something."], ["blockage", "Mechanical blockage", "The motor spins clean on the bench."]]}

var g
var kind := ""
var o := {}
var done_cb: Callable
var t0 := 0
var card: PanelContainer; var title_l: Label; var lv_l: Label; var sub_l: Label; var board: Control; var side: VBoxContainer; var msg_l: Label
var font: Font
# the open puzzle's state
var lv := 0; var L := {}; var solved := 0.0; var spin := {}
var R: Array = []; var ang: Array = []
var v := {}; var held := 0.0; var last := 0.0
var seen := {}

func _init(game) -> void: g = game

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT); mouse_filter = Control.MOUSE_FILTER_STOP; visible = false
	font = ThemeDB.fallback_font
	var dim := ColorRect.new(); dim.color = Color(0, 0, 0, 0.55); dim.set_anchors_preset(Control.PRESET_FULL_RECT); dim.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(dim)
	card = PanelContainer.new()
	var sb := StyleBoxFlat.new(); sb.bg_color = Color(0.02, 0.05, 0.05, 0.94); sb.border_color = Color(TEAL, 0.5); sb.set_border_width_all(2); sb.set_corner_radius_all(14); sb.set_content_margin_all(18)
	card.add_theme_stylebox_override("panel", sb); add_child(card)
	var vb := VBoxContainer.new(); vb.add_theme_constant_override("separation", 6); card.add_child(vb)
	var hb := HBoxContainer.new(); vb.add_child(hb)
	title_l = _label(22, TEAL); title_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL; hb.add_child(title_l)
	lv_l = _label(14, Color(INK, 0.7)); hb.add_child(lv_l)
	sub_l = _label(15, Color(INK, 0.85)); sub_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; sub_l.custom_minimum_size = Vector2(640, 0); vb.add_child(sub_l)
	board = Control.new(); board.custom_minimum_size = Vector2(640, 520); board.mouse_filter = Control.MOUSE_FILTER_STOP; vb.add_child(board)
	board.draw.connect(_draw_board); board.gui_input.connect(_board_input)
	side = VBoxContainer.new(); side.add_theme_constant_override("separation", 6); vb.add_child(side)
	msg_l = _label(16, TEAL); msg_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; msg_l.custom_minimum_size = Vector2(640, 0); vb.add_child(msg_l)
func _label(sz: int, c: Color) -> Label:
	var l := Label.new(); l.add_theme_font_size_override("font_size", sz); l.add_theme_color_override("font_color", c); return l

var on: bool:
	get: return visible

func open(k: String, opts: Dictionary, done: Callable) -> void:
	kind = k; o = opts; done_cb = done; t0 = Time.get_ticks_msec(); lv = 0; solved = 0.0; spin = {}; held = 0.0; last = 0.0; seen = {}
	for c in side.get_children(): c.queue_free()
	msg_l.text = ""; msg_l.add_theme_color_override("font_color", TEAL)
	board.visible = k != "diagnose"
	match k:
		"route":
			var psi: bool = o.get("psi", false)
			title_l.text = o.get("title", "ROUTE THE PSI ENERGY" if psi else "ROUTE THE POWER")
			sub_l.text = o.get("sub", "Tap a conduit to turn it. Carry the field's energy to the robot's core — and nowhere else." if psi else "Click a tile to turn it. Get power from the cell to the processor.")
			L = _route_make(0)
		"gears":
			var psi2: bool = o.get("psi", false)
			title_l.text = o.get("title", "STABILISE THE ACTUATORS" if psi2 else "ALIGN THE DRIVE")
			sub_l.text = o.get("sub", "Tap a ring to turn it (right-click or shift: the other way). Each actuator drags the one inside it. Line every one up with the field's swing, so none of them fights it." if psi2 else "Click a ring to turn it (right-click: the other way). Each ring drags the one inside it. Line every notch up with the shaft.")
			_gears_load()
		"freq":
			title_l.text = o.get("title", "MATCH THE FIELD"); sub_l.text = o.get("sub", "Make the robot's wave (pink) the same as the field's (violet). Count the humps first.")
			_freq_load()
		"diagnose":
			var C: Dictionary = o.get("case", CASE0)
			title_l.text = C.get("title", "WHAT IS ACTUALLY WRONG"); sub_l.text = C.get("sub", "It will not start. Examine it, then say what is wrong with it.")
			_diag_paint()
	visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await get_tree().process_frame
	card.position = (get_viewport_rect().size - card.size)/2
func close() -> void:
	visible = false; Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
func _finish() -> void:
	close(); g.cue("win")
	if done_cb.is_valid(): done_cb.call()
## for the photographs: solve whatever is open
func solve() -> void:
	match kind:
		"route": L.g = L.sol.map(func(r): return r.duplicate())
		"gears": for i in R.size(): R[i] = 0
		"freq": for k in FREQS[lv].keys: v[k] = FREQS[lv].target[k]
		"diagnose": _diag_answer(_diag_right())

func _process(_dt: float) -> void:
	if visible:
		card.position = (get_viewport_rect().size - card.size)/2
		board.queue_redraw()
func _ms() -> float: return float(Time.get_ticks_msec() - t0)

# ================================================================== drawing helpers
func _glow(pts: PackedVector2Array, c: Color, w: float, glow: float) -> void:
	if glow > 0: board.draw_polyline(pts, Color(c, 0.22), w + glow*0.7, true)
	board.draw_polyline(pts, c, w, true)
func _text(p: Vector2, s: String, sz: int, c: Color, align := HORIZONTAL_ALIGNMENT_LEFT, w := -1.0) -> void:
	board.draw_string(font, p - (Vector2(w/2, 0) if align == HORIZONTAL_ALIGNMENT_CENTER else (Vector2(w, 0) if align == HORIZONTAL_ALIGNMENT_RIGHT else Vector2.ZERO)), s, align, w, sz, c)
func _rr(r: Rect2, c: Color, filled := true, wd := 2.0) -> void:
	var sb := StyleBoxFlat.new(); sb.set_corner_radius_all(int(minf(10, r.size.x*0.15)))
	if filled: sb.bg_color = c
	else: sb.bg_color = Color(0, 0, 0, 0); sb.border_color = c; sb.set_border_width_all(int(wd))
	board.draw_style_box(sb, r)

## the browser's generator: s = s*16807 % 2147483647, the same numbers for the same seed
class Rnd:
	var s: int
	func _init(seed: int) -> void: s = seed
	func f() -> float:
		s = (s*16807) % 2147483647
		return float(s - 1)/2147483646.0

# ================================================================== ROUTE (a tile is a mask: N 1, E 2, S 4, W 8)
static func rot(m: int) -> int: return ((m << 1) | (m >> 3)) & 15
func _boards() -> Array: return [[4, "route"], [5, "net"], [6, "net"]].slice(0, o.get("levels", 3))
func _route_make(i: int) -> Dictionary:
	var B: Array = _boards()[i]
	return _net_level(B[0], 211 + i*53) if B[1] == "net" else _route_level(B[0], 101 + i*37)
func _route_level(n: int, seed: int) -> Dictionary:
	var r := Rnd.new(seed)
	var gr := []
	for y in n: var row := []; row.resize(n); row.fill(0); gr.append(row)
	var sy := int(floor(r.f()*n)); var ey := int(floor(r.f()*n))
	var x := 0; var y := sy; var seen_ := {"0,%d" % sy: true}; var path := [[0, sy]]
	while not (x == n - 1 and y == ey):
		var opts := []
		for d in DIRS:
			var a: int = x + d[0]; var b: int = y + d[1]
			if a >= 0 and b >= 0 and a < n and b < n and not seen_.has("%d,%d" % [a, b]): opts.append([a, b])
		if opts.is_empty(): return _route_level(n, seed + 7)
		# the browser sorts with a key that draws a random number for each comparison: keep its order of draws
		opts = _js_sort(opts, func(p, q): return (absf(p[0] - (n - 1)) + absf(p[1] - ey) + r.f()*2.2) - (absf(q[0] - (n - 1)) + absf(q[1] - ey) + r.f()*2.2))
		x = opts[0][0]; y = opts[0][1]; seen_["%d,%d" % [x, y]] = true; path.append([x, y])
	for i in path.size():
		var a2: int = path[i][0]; var b2: int = path[i][1]
		var link := func(c: int, d: int) -> int:
			for D in DIRS:
				if a2 + D[0] == c and b2 + D[1] == d: return D[2]
			return 0
		var m := 0
		if i == 0: m |= 8
		else: m |= link.call(path[i - 1][0], path[i - 1][1])
		if i == path.size() - 1: m |= 2
		else: m |= link.call(path[i + 1][0], path[i + 1][1])
		gr[b2][a2] = m
	var pieces := [5, 3, 7, 5, 3, 11, 15]
	for b in n:
		for a in n:
			if gr[b][a] == 0: gr[b][a] = pieces[int(floor(r.f()*pieces.size()))] if r.f() < 0.15 + n*0.06 else 0
	var sol := gr.map(func(row): return row.duplicate())
	for b in n:
		for a in n:
			var k := 1 + int(floor(r.f()*3))
			while k > 0: gr[b][a] = rot(gr[b][a]); k -= 1
	return {"n": n, "g": gr, "sy": sy, "ey": ey, "sol": sol, "net": false}
## Array.prototype.sort with a comparator, as the browser's engine runs it on a short array (binary insertion, each
## element against the sorted ones before it): the same comparisons, in the same order, so the same random draws
func _js_sort(arr: Array, cmp: Callable) -> Array:
	var a := arr.duplicate()
	for start in range(1, a.size()):
		var pivot = a[start]; var left := 0; var right := start
		while left < right:
			var mid := left + ((right - left) >> 1)
			if cmp.call(pivot, a[mid]) < 0: right = mid
			else: left = mid + 1
		var j := start
		while j > left: a[j] = a[j - 1]; j -= 1
		a[left] = pivot
	return a
func _bits(m: int) -> int: return (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1)
func _net_level(n: int, seed: int) -> Dictionary:
	var r := Rnd.new(seed)
	var gr := []
	for y in n: var row := []; row.resize(n); row.fill(0); gr.append(row)
	var sy := int(floor(r.f()*n)); var ey := int(floor(r.f()*n))
	var in_t := {"0,%d" % sy: true}; var edges := []
	var add_edges := func(a: int, b: int):
		for D in DIRS:
			var c: int = a + D[0]; var d: int = b + D[1]
			if c >= 0 and d >= 0 and c < n and d < n: edges.append([a, b, c, d, D[2], D[3]])
	add_edges.call(0, sy)
	while in_t.size() < n*n:
		var i := int(floor(r.f()*edges.size())); var e: Array = edges[i]; edges.remove_at(i)
		var a: int = e[0]; var b: int = e[1]; var c: int = e[2]; var d: int = e[3]
		if in_t.has("%d,%d" % [c, d]): continue
		if _bits(gr[b][a]) >= 3 and r.f() < 0.8:
			edges.append(e)
			if edges.size() > 4*n*n: edges.clear()
			continue
		gr[b][a] |= e[4]; gr[d][c] |= e[5]; in_t["%d,%d" % [c, d]] = true; add_edges.call(c, d)
	gr[sy][0] |= 8; gr[ey][n - 1] |= 2
	var sol := gr.map(func(row): return row.duplicate())
	for b in n:
		for a in n:
			var k := 1 + int(floor(r.f()*3))
			while k > 0: gr[b][a] = rot(gr[b][a]); k -= 1
	return {"n": n, "g": gr, "sy": sy, "ey": ey, "sol": sol, "net": true}
func _powered() -> Dictionary:
	var n: int = L.n; var gr: Array = L.g
	var lit := {}; var q := []
	if gr[L.sy][0] & 8: lit["0,%d" % L.sy] = true; q.append([0, L.sy])
	while q.size():
		var p: Array = q.pop_front(); var m: int = gr[p[1]][p[0]]
		for D in DIRS:
			var c: int = p[0] + D[0]; var d: int = p[1] + D[1]
			if not (m & D[2]) or c < 0 or d < 0 or c >= n or d >= n: continue
			if (gr[d][c] & D[3]) and not lit.has("%d,%d" % [c, d]): lit["%d,%d" % [c, d]] = true; q.append([c, d])
	var reach: bool = lit.has("%d,%d" % [n - 1, L.ey]) and (gr[L.ey][n - 1] & 2) != 0
	var loose := {}
	if not L.net: return {"on": lit, "done": reach, "loose": loose}
	for b in n:
		for a in n:
			var m: int = gr[b][a]
			for D in DIRS:
				if not (m & D[2]): continue
				var c: int = a + D[0]; var d: int = b + D[1]
				if c < 0 and b == L.sy and D[2] == 8: continue
				if c >= n and b == L.ey and D[2] == 2: continue
				if c < 0 or d < 0 or c >= n or d >= n or not (gr[d][c] & D[3]): loose["%d,%d,%d" % [a, b, D[2]]] = true
	return {"on": lit, "loose": loose, "done": reach and lit.size() == n*n and loose.is_empty()}
func _rgeo() -> Dictionary:
	var n: int = L.n; var s := minf(400.0/n, 84.0); var w := s*n
	return {"n": n, "s": s, "ox": (640 - w)/2, "oy": (520 - w)/2 + 6}
func _draw_route(t: float) -> void:
	var psi: bool = o.get("psi", false); var SRC: String = o.get("src", "FIELD" if psi else "CELL"); var DST: String = o.get("dst", "CORE" if psi else "CPU")
	var G := _rgeo(); var pw := _powered(); var s: float = G.s; var n: int = G.n
	var cy: float = G.oy + (L.sy + 0.5)*s; var py: float = G.oy + (L.ey + 0.5)*s
	_rr(Rect2(G.ox - 70, cy - 26, 52, 52), Color("#0b1513")); _rr(Rect2(G.ox - 70, cy - 26, 52, 52), TEAL, false)
	_text(Vector2(G.ox - 44, cy + 4), SRC, 12, TEAL, HORIZONTAL_ALIGNMENT_CENTER, 60)
	_glow(PackedVector2Array([Vector2(G.ox - 18, cy), Vector2(G.ox, cy)]), TEAL, 6, 12)
	var ex: float = G.ox + n*s
	_rr(Rect2(ex + 18, py - 30, 60, 60), Color("#0b1513")); _rr(Rect2(ex + 18, py - 30, 60, 60), TEAL if pw.done else Color("#556"), false)
	for k in 4:
		board.draw_rect(Rect2(ex + 26 + k*12, py - 36, 4, 6), TEAL if pw.done else Color("#556")); board.draw_rect(Rect2(ex + 26 + k*12, py + 30, 4, 6), TEAL if pw.done else Color("#556"))
	_text(Vector2(ex + 48, py + 4), DST, 12, TEAL if pw.done else Color("#889"), HORIZONTAL_ALIGNMENT_CENTER, 60)
	_glow(PackedVector2Array([Vector2(ex, py), Vector2(ex + 18, py)]), TEAL if pw.done else Color("#334"), 6, 12 if pw.done else 0)
	for b in n:
		for a in n:
			var X0: float = G.ox + a*s; var Y0: float = G.oy + b*s; var m: int = L.g[b][a]; var lit: bool = pw.on.has("%d,%d" % [a, b])
			_rr(Rect2(X0 + 3, Y0 + 3, s - 6, s - 6), Color("#0d1715")); _rr(Rect2(X0 + 3, Y0 + 3, s - 6, s - 6), Color(TEAL, 0.12), false, 1)
			if m == 0: continue
			var sp: float = spin.get("%d,%d" % [a, b], 0.0)
			board.draw_set_transform(Vector2(X0 + s/2, Y0 + s/2), -sp*PI/2)
			for D in DIRS:
				if not (m & D[2]): continue
				var bad: bool = lit and pw.loose.has("%d,%d,%d" % [a, b, D[2]])
				_glow(PackedVector2Array([Vector2.ZERO, Vector2(D[0]*s/2, D[1]*s/2)]), PINK if bad else (TEAL if lit else DIM), s*0.16, 14 if lit else 0)
			board.draw_circle(Vector2.ZERO, s*0.11, TEAL if lit else Color("#2a4a46"))
			board.draw_set_transform(Vector2.ZERO)
	lv_l.text = "BOARD %d / %d" % [lv + 1, _boards().size()]
	if pw.done and solved == 0:
		solved = t; msg_l.text = "The field reaches the core." if psi else "Power to the processor."; g.cue("win")
	if solved > 0 and t - solved > 1100:
		solved = 0; lv += 1
		if lv >= _boards().size(): _finish(); return
		L = _route_make(lv); spin = {}
		msg_l.text = (("Unstable energy leaks out of any open end. Every conduit lit, no loose ends (pink)." if psi else "The whole board is the circuit now. Every tile lit, no loose ends (pink).") if lv == 1
			else ("The main manifold. Same rules, bigger." if psi else "The main board. Same rules, bigger."))
	if solved == 0 and L.net:
		var lo := 0
		for k in pw.loose: var sp2: PackedStringArray = k.split(","); if pw.on.has(sp2[0] + "," + sp2[1]): lo += 1
		lv_l.text += " · %d / %d lit" % [pw.on.size(), n*n] + (" · %d loose" % lo if lo else "")
	for k in spin.keys():
		spin[k] *= 0.75
		if spin[k] < 0.01: spin.erase(k)

# ================================================================== GEARS
func _gears_levels() -> Array: return [{"n": 3, "seed": 5}, {"n": 4, "seed": 9}].slice(0, o.get("levels", 2))
func _gears_load() -> void:
	var Lv: Dictionary = _gears_levels()[lv]; var r := Rnd.new(Lv.seed*101)
	R = []; ang = []
	for i in Lv.n: R.append(0); ang.append(0.0)
	for k in 6 + Lv.n*3:
		var i := int(floor(r.f()*Lv.n)); _turn(i, 1 if r.f() < 0.5 else -1, true)
	if R.all(func(x): return x == 0): _turn(Lv.n - 1, 1, true)
func _turn(i: int, d: int, quiet: bool) -> void:
	R[i] = (R[i] + d + STEPS) % STEPS
	if i > 0: R[i - 1] = (R[i - 1] - d + STEPS) % STEPS
	if not quiet: g.cue("gear")
func _rad(i: int) -> float: return 52.0 + i*54
func _draw_gears(t: float) -> void:
	var psi: bool = o.get("psi", false)
	var cx := 320.0; var cy := 268.0; var n := R.size()
	var aligned := R.map(func(x): return x == 0)
	board.draw_dashed_line(Vector2(cx, cy), Vector2(cx, cy - _rad(n - 1) - 40), Color(1, 1, 1, 0.08), 1, 8)
	for i in range(n - 1, -1, -1):
		ang[i] += (float(R[i])/STEPS*TAU - ang[i])*0.25
		var r0 := _rad(i); var teeth := 12 + i*6
		board.draw_set_transform(Vector2(cx, cy), ang[i])
		var pts := PackedVector2Array()
		for k in teeth*2:
			var a := float(k)/(teeth*2)*TAU; var rr_ := r0 + (0.0 if k % 2 else 7.0)
			pts.append(Vector2(cos(a)*rr_, sin(a)*rr_))
		board.draw_colored_polygon(pts, Color("#121c1a"))
		pts.append(pts[0]); board.draw_polyline(pts, TEAL if aligned[i] else Color("#2c4a46"), 2, true)
		board.draw_circle(Vector2.ZERO, r0 - 18, Color("#0a0f0e"))
		for k in 4: board.draw_line(Vector2.ZERO, Vector2(cos(k*PI/2 + 0.4), sin(k*PI/2 + 0.4))*(r0 - 20), Color("#1a2a28"), 3)
		var nc: Color = TEAL if aligned[i] else PINK
		board.draw_rect(Rect2(-9, -r0 - 9, 18, 28), Color(nc, 0.25)); board.draw_rect(Rect2(-6, -r0 - 6, 12, 22), nc)
		board.draw_set_transform(Vector2.ZERO)
	board.draw_circle(Vector2(cx, cy), 20, Color("#2a3a38"))
	var all_: bool = aligned.all(func(x): return x)
	if all_: _glow(PackedVector2Array([Vector2(cx, cy), Vector2(cx, cy - _rad(n - 1) - 40)]), TEAL, 8, 18); board.draw_circle(Vector2(cx, cy), 12, TEAL)
	lv_l.text = ("JOINT " if psi else "DRIVE ") + "%d / %d · %d / %d" % [lv + 1, _gears_levels().size(), aligned.filter(func(x): return x).size(), n] + (" with the field" if psi else " aligned")
	if all_ and solved == 0:
		solved = t; msg_l.text = o.get("win", "It moves with the field now, not against it." if psi else "The drive runs."); g.cue("win")
	if solved > 0 and t - solved > 1200:
		solved = 0; lv += 1
		if lv >= _gears_levels().size(): _finish(); return
		_gears_load(); msg_l.text = "The legs: four actuators." if psi else "The leg joint: four rings."

# ================================================================== FREQ
func _freq_levels() -> Array: return FREQS.slice(0, o.get("levels", FREQS.size()))
func _freq_load() -> void:
	v = (_freq_levels()[lv].start as Dictionary).duplicate(); _freq_paint()
func _pd(k: String, a: float, b: float) -> float: return fposmod(a - b + 540.0, 360.0) - 180.0 if k == "p" else a - b
func _match() -> bool:
	var Lv: Dictionary = _freq_levels()[lv]
	return Lv.keys.all(func(k): return is_equal_approx(v[k], Lv.target[k]))
func _fval(k: String, n: float) -> String:
	if k == "f": return ("%s wave" if n == 1 else "%s waves") % _num(n)
	return ("→ %d°" % int(n)) if n != 0 else "0°"
func _num(n: float) -> String: return str(int(n)) if n == floor(n) else str(n)
func _hint(k: String) -> String:
	var d := _pd(k, v[k], _freq_levels()[lv].target[k])
	if is_zero_approx(d): return "✓ right"
	return ("more waves" if d < 0 else "fewer waves") if k == "f" else ("slide them right" if d < 0 else "slide them left")
func _fset(k: String, n: float) -> void:
	if k == "p": n = fposmod(n + 360, 360)
	else: n = clampf(n, FMIN[k], FMAX[k])
	n = round(n/FSTEP[k])*FSTEP[k]
	var tg: float = _freq_levels()[lv].target[k]
	if absf(_pd(k, n, tg)) <= FSTEP[k] + 1e-9 and n != tg: n = tg
	v[k] = n; g.cue("ui"); _freq_paint()
func _freq_paint() -> void:
	for c in side.get_children(): c.queue_free()
	for k in _freq_levels()[lv].keys:
		var ok := is_equal_approx(v[k], _freq_levels()[lv].target[k])
		var hb := HBoxContainer.new(); hb.add_theme_constant_override("separation", 10); side.add_child(hb)
		var nm := _label(15, TEAL if ok else INK); nm.text = "%s  (%s)" % [FNAME[k], FWHAT[k]]; nm.custom_minimum_size.x = 230; hb.add_child(nm)
		for d in [-1, 1]:
			var b := Button.new(); b.text = "◀" if d < 0 else "▶"; b.focus_mode = Control.FOCUS_NONE
			b.pressed.connect(func(): if solved == 0: _fset(k, v[k] + d*FSTEP[k]))
			hb.add_child(b)
			if d < 0:
				var val := _label(17, TEAL if ok else PINK); val.text = _fval(k, v[k]); val.custom_minimum_size.x = 90; val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; hb.add_child(val)
		var hi := _label(14, Color(INK, 0.7)); hi.text = _hint(k); hb.add_child(hi)
func _wave(vv: Dictionary, x: float, t: float) -> float: return sin(TAU*(vv.f*x - vv.p/360.0) + t)
func _draw_freq(t: float) -> void:
	var dt := minf(0.05, (t - last)/1000.0); last = t
	var ox := 30.0; var w := 580.0; var cy := 250.0; var amp := 120.0; var m := _match(); var shimmer := 0.85 + 0.15*sin(t/300.0)
	var Lv: Dictionary = _freq_levels()[lv]
	for k in 11: board.draw_line(Vector2(ox + k*w/10, cy - 160), Vector2(ox + k*w/10, cy + 160), Color(TEAL, 0.07))
	for k in range(-4, 5): board.draw_line(Vector2(ox, cy + k*40), Vector2(ox + w, cy + k*40), Color(TEAL, 0.07))
	var yt := []; var yr := []
	for i in 201: yt.append(cy - _wave(Lv.target, i/200.0, 0)*amp); yr.append(cy - _wave(v, i/200.0, 0)*amp)
	if not m:
		var poly := PackedVector2Array()
		for i in 201: poly.append(Vector2(ox + i/200.0*w, yt[i]))
		for i in range(200, -1, -1): poly.append(Vector2(ox + i/200.0*w, yr[i]))
		var tris := Geometry2D.triangulate_polygon(poly)
		if tris.size(): board.draw_colored_polygon(poly, Color(PINK, 0.16))
	var pts := func(a: Array) -> PackedVector2Array:
		var p := PackedVector2Array()
		for i in a.size(): p.append(Vector2(ox + i/200.0*w, a[i]))
		return p
	_glow(pts.call(yt), Color(VIOLET, shimmer), 7, 18)
	_glow(pts.call(yr), TEAL if m else PINK, 3, 14 if m else 6)
	for pair in [[yt, VIOLET, 7.0], [yr, TEAL if m else PINK, 4.5]]:
		var a: Array = pair[0]
		for i in range(1, 200):
			if a[i] < a[i - 1] and a[i] <= a[i + 1] and a[i] < cy - amp*0.6: board.draw_circle(Vector2(ox + i/200.0*w, a[i]), pair[2], pair[1])
	_text(Vector2(ox, 40), "Ψ FIELD · " + _fval("f", Lv.target.f), 13, VIOLET)
	_text(Vector2(ox + 190, 40), "ROBOT · " + _fval("f", v.f), 13, TEAL if m else PINK)
	var e := 0.0
	for k in Lv.keys: e += absf(_pd(k, v[k], Lv.target[k]))/(180.0 if k == "p" else 2.0)
	var sync := maxi(0, int(round(100 - e*55)))
	_text(Vector2(ox + w, 40), "SYNC %d%%" % (100 if m else mini(99, sync)), 13, TEAL if m else INK, HORIZONTAL_ALIGNMENT_RIGHT, 200)
	held = held + dt if m else 0.0
	lv_l.text = "STAGE %d / %d" % [lv + 1, _freq_levels().size()]
	if held > 0.5 and solved == 0: solved = t; msg_l.text = "Locked to the field."; g.cue("win")
	if solved > 0 and t - solved > 1200:
		solved = 0; held = 0; lv += 1
		if lv >= _freq_levels().size(): _finish(); return
		_freq_load(); msg_l.text = "This time the field is out of step too. Match the SPEED, then slide the peaks onto the field's with TIMING."

# ================================================================== DIAGNOSE
func _diag_paint() -> void:
	for c in side.get_children(): c.queue_free()
	var C: Dictionary = o.get("case", CASE0)
	for ch in C.checks:
		var b := Button.new(); b.focus_mode = Control.FOCUS_NONE; b.alignment = HORIZONTAL_ALIGNMENT_LEFT; b.custom_minimum_size = Vector2(640, 0)
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.text = ch[1] + "  —  " + (ch[2] if seen.has(ch[0]) else "examine")
		b.pressed.connect(func(): seen[ch[0]] = true; g.cue("ui"); _diag_paint())
		side.add_child(b)
	var q := _label(14, Color(INK, 0.7)); q.text = "WHAT IS WRONG?" if seen.size() >= 2 else "Examine at least two things first."; side.add_child(q)
	var hb := HFlowContainer.new(); side.add_child(hb)
	for c in C.causes:
		var b2 := Button.new(); b2.text = c[1]; b2.focus_mode = Control.FOCUS_NONE; b2.disabled = seen.size() < 2
		b2.pressed.connect(func(): _diag_answer(c[0]))
		hb.add_child(b2)
func _diag_right() -> String:
	for c in o.get("case", CASE0).causes:
		if c[2] == null: return c[0]
	return ""
func _diag_answer(k: String) -> void:
	var C: Dictionary = o.get("case", CASE0)
	for c in C.causes:
		if c[0] != k: continue
		if c[2] != null:
			msg_l.text = "No. " + c[2]; msg_l.add_theme_color_override("font_color", PINK); g.cue("fail"); return
		msg_l.text = C.get("ok", "The sensor. Its connector has backed out of the socket: pushed home, the feed comes alive."); msg_l.add_theme_color_override("font_color", TEAL)
		g.cue("win")
		for b in side.get_children(): if b is Button: b.disabled = true
		get_tree().create_timer(1.8).timeout.connect(func(): if visible: close(); if done_cb.is_valid(): done_cb.call())

# ================================================================== the board
func _draw_board() -> void:
	if not visible: return
	var t := _ms()
	match kind:
		"route": _draw_route(t)
		"gears": _draw_gears(t)
		"freq": _draw_freq(t)
func _board_input(ev: InputEvent) -> void:
	if not (ev is InputEventMouseButton and ev.pressed) or solved > 0: return
	var p: Vector2 = ev.position
	match kind:
		"route":
			var G := _rgeo(); var a := int(floor((p.x - G.ox)/G.s)); var b := int(floor((p.y - G.oy)/G.s))
			if a < 0 or b < 0 or a >= L.n or b >= L.n or L.g[b][a] == 0: return
			L.g[b][a] = rot(L.g[b][a]); spin["%d,%d" % [a, b]] = 1.0; g.cue("ui")
		"gears":
			var d := p.distance_to(Vector2(320, 268))
			for i in R.size():
				if d < _rad(i) + 10: _turn(i, -1 if (ev.button_index == MOUSE_BUTTON_RIGHT or ev.shift_pressed) else 1, false); return
func _unhandled_key_input(ev: InputEvent) -> void:
	if not visible or not (ev is InputEventKey and ev.pressed): return
	if kind == "freq" and solved == 0:
		var ks: Array = _freq_levels()[lv].keys; var k: String = ks[ks.size() - 1] if ev.shift_pressed else ks[0]
		if ev.keycode == KEY_LEFT or ev.keycode == KEY_A: _fset(k, v[k] - FSTEP[k]); get_viewport().set_input_as_handled()
		elif ev.keycode == KEY_RIGHT or ev.keycode == KEY_D: _fset(k, v[k] + FSTEP[k]); get_viewport().set_input_as_handled()
