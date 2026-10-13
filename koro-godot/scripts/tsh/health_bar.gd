## HER HEALTH, above the radar: a heart, the bar, the number. In a fight it is the fight's (fight.R.hp); on the run
## each knockdown takes half (chase.hits of chase.HITS); otherwise she is whole. It flashes red when she is hurt and
## goes red when she is low; it is hidden in the films, the puzzles and the guitar.
class_name HealthBar
extends Control

var g
var shown := 100.0; var flash := 0.0; var last := 100.0
func _init(game) -> void:
	g = game; mouse_filter = Control.MOUSE_FILTER_IGNORE

func value() -> float:
	if g.fight and g.fight.on and g.fight.R is Dictionary and g.fight.R.has("hp"): return clampf(float(g.fight.R.hp), 0, 100)
	if g.chase and g.chase.on: return 100.0*float(Chase.HITS - g.chase.hits)/float(Chase.HITS)
	return 100.0

func _process(dt: float) -> void:
	var v := value()
	if v < last - 0.5: flash = 1.0
	last = v
	shown = move_toward(shown, v, dt*(160.0 if v > shown else 60.0))
	flash = maxf(0, flash - dt*2.5)
	queue_redraw()

func _draw() -> void:
	var w := size.x; var h := 18.0; var y := 16.0
	var v := last; var low := v < 35
	var f := ThemeDB.fallback_font
	# the heart
	var hc := Color("#ff4d6a") if not (low and int(Time.get_ticks_msec()/300.0) % 2 == 0) else Color("#ff9aa8")
	var o := Vector2(12, y + h*0.5)
	draw_circle(o + Vector2(-4.5, -3), 5.5, hc); draw_circle(o + Vector2(4.5, -3), 5.5, hc)
	draw_colored_polygon(PackedVector2Array([o + Vector2(-10, -1.5), o + Vector2(10, -1.5), o + Vector2(0, 9)]), hc)
	# the bar: a dark well, what she lost (lagging, pale), what she has, a shine
	var x0 := 30.0; var bw := w - x0 - 44.0
	draw_rect(Rect2(x0 - 2, y - 2, bw + 4, h + 4), Color(0, 0, 0, 0.65))
	draw_rect(Rect2(x0, y, bw, h), Color(0.12, 0.12, 0.14, 0.9))
	draw_rect(Rect2(x0, y, bw*shown/100.0, h), Color(1, 0.85, 0.85, 0.55))
	var c := Color("#3cd25a").lerp(Color("#f5d23c"), clampf((70 - v)/35.0, 0, 1)).lerp(Color("#ff4d4d"), clampf((40 - v)/20.0, 0, 1))
	draw_rect(Rect2(x0, y, bw*v/100.0, h), c)
	draw_rect(Rect2(x0, y, bw*v/100.0, h*0.35), Color(1, 1, 1, 0.22))
	for i in range(1, 4): draw_line(Vector2(x0 + bw*i/4.0, y), Vector2(x0 + bw*i/4.0, y + h), Color(0, 0, 0, 0.35), 1.0)
	if flash > 0: draw_rect(Rect2(x0 - 2, y - 2, bw + 4, h + 4), Color(1, 0.2, 0.2, flash*0.8), false, 3.0)
	draw_string_outline(f, Vector2(x0 + bw + 8, y + h - 3), "%d" % roundi(v), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0, 0, 0, 0.8))
	draw_string(f, Vector2(x0 + bw + 8, y + h - 3), "%d" % roundi(v), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
	draw_string_outline(f, Vector2(x0, y - 5), "HEALTH", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, Color(0, 0, 0, 0.8))
	draw_string(f, Vector2(x0, y - 5), "HEALTH", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1, 1, 1, 0.75))
