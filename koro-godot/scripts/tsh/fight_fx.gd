## FIGHT FX, in the manner of a shonen fight (trying it on the fight with Kai): no bursts, no frames — speed lines and
## sparks, drawn thin and fast over the screen.
##   lines(at, dir, k)   SPEED LINES — thin streaks running with a movement (a lunge, a heavy swing), trailing behind
##                       where it goes, sliding on and gone in a quarter of a second
##   sparks(at, dir, k)  SPARKS — bright hot splinters thrown off a blow along `dir` (and a few every way), each a
##                       short streak along its own path, falling and going out
## at and dir are in the world; they are put on the screen through the game's camera.
class_name FightFX
extends Control

var g
var streaks: Array = []     # {p, d: Vector2 (screen, unit), t, k, seed}
var parts: Array = []       # {p, v: Vector2, t, life, w, hot}
var arcs: Array = []        # a sword's swing: {pts: [[tip, mid] on the screen, age]...}, the slash cut along where it went
var swing := {}             # the open one, by whoever swings: id → arc

func _init(game) -> void:
	g = game; mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_preset(Control.PRESET_FULL_RECT)

func _scr(at: Vector3) -> Vector2:
	if g.cam == null or g.cam.is_position_behind(at): return size*0.5
	return g.cam.unproject_position(at)
func _sdir(at: Vector3, dir: Vector3) -> Vector2:
	var d := _scr(at + dir.normalized()*0.6) - _scr(at)
	return d.normalized() if d.length() > 1.0 else Vector2.RIGHT

func lines(at: Vector3, dir: Vector3, k := 1.0) -> void:
	streaks.append({"p": _scr(at), "d": _sdir(at, dir), "t": 0.0, "k": k, "seed": randi()})
func sparks(at: Vector3, dir: Vector3, k := 1.0) -> void:
	var p := _scr(at); var d := _sdir(at, dir)
	for i in int(26*k) + 8:
		var spread := 0.6 if i % 4 else PI          # most along the blow, a few every way
		var a := d.angle() + randf_range(-spread, spread)
		var sp: float = randf_range(500, 1500)*(0.7 + 0.3*k)
		parts.append({"p": p + Vector2(randf_range(-6, 6), randf_range(-6, 6)), "v": Vector2(cos(a), sin(a))*sp, "t": 0.0,
			"life": randf_range(0.18, 0.4), "w": randf_range(1.8, 3.6)*k, "hot": randf() < 0.55})

## SLASH LINES: while a blade swings, its tip and its middle each frame; a crescent of thin lines is cut along the
## path, and when the swing ends the lines stream on in its direction and fade. end_swing(id) closes it.
func swing_at(id: int, tip: Vector3, mid: Vector3) -> void:
	if not swing.has(id): swing[id] = {"pts": [], "t": 0.0, "open": true, "seed": randi()}; arcs.append(swing[id])
	(swing[id].pts as Array).append([_scr(tip), _scr(mid), 0.0])
func end_swing(id: int) -> void:
	if not swing.has(id): return
	var a: Dictionary = swing[id]; a.open = false; swing.erase(id)
	var P: Array = a.pts
	if P.size() >= 2:                                     # the swing's speed thrown off its end
		var d: Vector2 = (P[-1][0] as Vector2) - (P[-2][0] as Vector2)
		if d.length() > 2: streaks.append({"p": P[-1][0], "d": -d.normalized(), "t": 0.0, "k": 1.1, "seed": randi()})

func _process(dt: float) -> void:
	var real := dt/maxf(0.05, Engine.time_scale)
	for a in arcs:
		for q in a.pts: q[2] += real
		if not a.open: a.t += real
	arcs = arcs.filter(func(a): return a.open or a.t < 0.4)
	for s in streaks: s.t += real
	streaks = streaks.filter(func(s): return s.t < 0.26)
	for q in parts:
		q.t += real; q.v *= exp(-real*3.0); q.v.y += 1500.0*real; q.p += q.v*real
	parts = parts.filter(func(q): return q.t < q.life)
	queue_redraw()

func _draw() -> void:
	for a in arcs:
		var P0: Array = a.pts
		if P0.size() < 2: continue
		var fade: float = 1.0 - a.t/0.4
		# the path smoothed into a curve (Catmull-Rom through the frames' points), four between each
		var P: Array = []
		for i in P0.size() - 1:
			var A: Array = P0[maxi(0, i - 1)]; var B: Array = P0[i]; var C: Array = P0[i + 1]; var D: Array = P0[mini(P0.size() - 1, i + 2)]
			for k in 4:
				var u := k/4.0
				P.append([_cr(A[0], B[0], C[0], D[0], u), _cr(A[1], B[1], C[1], D[1], u), lerpf(B[2], C[2], u)])
		P.append(P0[-1])
		var n := P.size()
		# the swept crescent between the tip's path and the blade's middle, pale
		for i in range(1, n):
			var al0: float = clampf(1.0 - float(P[i][2])/0.35, 0, 1)*fade
			if al0 > 0: draw_colored_polygon(PackedVector2Array([P[i - 1][0], P[i][0], P[i][1], P[i - 1][1]]), Color(0.85, 0.93, 1.0, 0.13*al0))
		# four cuts along it, each tapering thin at both ends and thickest in the middle of the swing
		for layer in 4:
			var f := layer/4.0; var w0: float = 7.0 - layer*1.4
			var c := Color(1, 1, 1) if layer < 2 else Color(0.78, 0.9, 1.0)
			for i in range(1, n):
				var al: float = clampf(1.0 - float(P[i][2])/0.35, 0, 1)*fade
				if al <= 0: continue
				var taper := sin(PI*float(i)/n)
				var p0: Vector2 = (P[i - 1][0] as Vector2).lerp(P[i - 1][1], f*0.7)
				var p1: Vector2 = (P[i][0] as Vector2).lerp(P[i][1], f*0.7)
				draw_line(p0, p1, Color(c.r, c.g, c.b, (0.95 - f*0.6)*al), maxf(0.5, w0*taper*al), true)
	for s in streaks:
		var rng := RandomNumberGenerator.new(); rng.seed = s.seed
		var u: float = s.t/0.26; var a: float = (1.0 - u)*(1.0 - u)
		var d: Vector2 = s.d; var nrm := Vector2(-d.y, d.x)
		for i in int(26*s.k):
			var off: float = rng.randf_range(-170, 170)*s.k               # across the movement
			var back: float = rng.randf_range(-40, 220)                   # behind it
			var ln: float = rng.randf_range(70, 300)*s.k
			var slide := u*rng.randf_range(80, 220)                 # streaming back as they fade
			var head: Vector2 = s.p + nrm*off - d*(back + slide)
			var tail: Vector2 = head - d*ln
			var w: float = rng.randf_range(0.6, 1.8)
			var c := Color(1, 1, 1, rng.randf_range(0.18, 0.45)*a)
			draw_colored_polygon(PackedVector2Array([head + nrm*w*0.3, head - nrm*w*0.3, tail - nrm*w, tail + nrm*w]), Color(c.r, c.g, c.b, 0.0) if false else c)
	for q in parts:
		var u: float = q.t/q.life; var al: float = 1.0 - u
		var col: Color = (Color(1, 0.96, 0.8) if u < 0.35 else Color(1, 0.62, 0.18)) if q.hot else Color(1, 1, 1)
		col.a = al
		var tail: Vector2 = q.p - (q.v as Vector2)*0.022
		draw_line(tail, q.p, Color(col.r, col.g*0.8, col.b*0.5, al*0.5), q.w*1.8, true)
		draw_line(tail.lerp(q.p, 0.4), q.p, col, q.w, true)

static func _cr(a: Vector2, b: Vector2, c: Vector2, d: Vector2, u: float) -> Vector2:
	return 0.5*((2.0*b) + (-a + c)*u + (2.0*a - 5.0*b + 4.0*c - d)*u*u + (-a + 3.0*b - 3.0*c + d)*u*u*u)
