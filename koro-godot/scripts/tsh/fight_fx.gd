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

func _process(dt: float) -> void:
	var real := dt/maxf(0.05, Engine.time_scale)
	for s in streaks: s.t += real
	streaks = streaks.filter(func(s): return s.t < 0.26)
	for q in parts:
		q.t += real; q.v *= exp(-real*3.0); q.v.y += 1500.0*real; q.p += q.v*real
	parts = parts.filter(func(q): return q.t < q.life)
	queue_redraw()

func _draw() -> void:
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
