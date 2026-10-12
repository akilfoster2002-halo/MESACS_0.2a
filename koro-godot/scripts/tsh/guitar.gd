## THE GUITAR (Guitar Hero, in her room). Her song (tools/song/rock.py: the band and the lead guitar as two stems)
## plays; from the first verse its lead line comes down a highway of five frets — A S D F G (or 1–5) as each note
## reaches the line. A note hit keeps the lead in the song; a note missed drops it out until the next one lands, as
## the real game does. Every ten in a row raises the multiplier (to ×4); the rock meter, green to red, is how the
## room thinks it is going. At the end: how many she hit, her best streak, her stars.
class_name GuitarGame
extends Control

const KEYS := [[KEY_A, KEY_1], [KEY_S, KEY_2], [KEY_D, KEY_3], [KEY_F, KEY_4], [KEY_G, KEY_5]]
const COLS := [Color("#3cd25a"), Color("#e8384a"), Color("#f5d23c"), Color("#3c8cf0"), Color("#f59a32")]
const NAMES := ["A", "S", "D", "F", "G"]
const AHEAD := 2.0              # seconds of highway on screen
const WINDOW := 0.11            # how far either side of the line a note can be hit
const PERFECT := 0.045
var g
var chart := {}; var notes: Array = []
var band: AudioStreamPlayer; var lead: AudioStreamPlayer
var on := false; var playing := false; var shown := 0.0
var now := 0.0; var _clk := 0.0
var score := 0; var streak := 0; var best := 0; var hits := 0; var misses := 0; var meter := 0.5
var lead_on := true; var held := [false, false, false, false, false]; var flare := [0.0, 0.0, 0.0, 0.0, 0.0]
var judge := ""; var judge_t := 0.0
var done_cb: Callable; var strum_cb: Callable
var finished := false; var results := false
var auto := false               # the photo pass plays it by itself

func _init(game) -> void:
	g = game
	mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_preset(Control.PRESET_FULL_RECT); visible = false
	chart = g._json("res://assets/tsh/rock_chart.json")
	band = AudioStreamPlayer.new(); band.stream = load("res://assets/tsh/music/rock_band.mp3"); band.volume_db = -4; game.add_child(band)
	lead = AudioStreamPlayer.new(); lead.stream = load("res://assets/tsh/music/rock_lead.mp3"); lead.volume_db = -4; game.add_child(lead)

## the song from the top (the montage plays over its intro)
func song() -> void:
	band.play(0.0); lead.play(0.0); lead.volume_db = -4; _clk = 0.0; now = 0.0
## the game: from here the notes come down; done(result) when the song is over
func start(done: Callable, strum := Callable()) -> void:
	done_cb = done; strum_cb = strum
	notes = []
	for n in chart.notes: notes.append({"t": float(n.t), "len": float(n.len), "lane": int(n.lane), "hit": false, "missed": false})
	score = 0; streak = 0; best = 0; hits = 0; misses = 0; meter = 0.5; lead_on = true; finished = false; results = false
	on = true; playing = true; visible = true; shown = 0.0
func stop() -> void:
	on = false; playing = false; visible = false; band.stop(); lead.stop()
func mult() -> int: return mini(4, 1 + streak/10)

func _clock() -> float:
	# the song's own clock, corrected for what has not been heard yet
	if not band.playing: return now
	var t := band.get_playback_position() + AudioServer.get_time_since_last_mix() - AudioServer.get_output_latency()
	_clk = t if absf(t - _clk) > 0.08 else lerpf(_clk, t, 0.5)
	return _clk

func _process(dt: float) -> void:
	if band.playing or playing: now = _clock()
	if not on: return
	shown = minf(1.0, shown + dt*2)
	for i in 5: flare[i] = maxf(0, flare[i] - dt*4)
	judge_t = maxf(0, judge_t - dt)
	if playing:
		for n in notes:
			if n.hit or n.missed: continue
			if auto and now >= n.t - 0.01: _hit(n, 0.0)
			elif now - n.t > WINDOW: n.missed = true; _miss()
		if now >= float(chart.end) - 0.5 and not finished:
			finished = true; playing = false; results = true
			g.get_tree().create_timer(4.2).timeout.connect(func(): if on: var r := result(); stop(); if done_cb.is_valid(): done_cb.call(r))
	queue_redraw()

func key(ev: InputEventKey) -> bool:
	if not on or not playing: return false
	for i in 5:
		if ev.keycode in KEYS[i] or ev.physical_keycode in KEYS[i]:
			held[i] = ev.pressed
			if ev.pressed and not ev.echo: _press(i)
			return true
	return false

func _press(lane: int) -> void:
	flare[lane] = 0.35
	var best_n = null; var bd := 9.0
	for n in notes:
		if n.hit or n.missed or n.lane != lane: continue
		var d := absf(n.t - now)
		if d < bd: bd = d; best_n = n
		if n.t - now > WINDOW: break
	if best_n != null and bd <= WINDOW: _hit(best_n, bd)
	else:
		# a strum with nothing under it: the streak goes, a little of the room with it
		streak = 0; meter = maxf(0, meter - 0.015); _say("OVERSTRUM", Color("#ff8a6a"))

func _hit(n: Dictionary, err: float) -> void:
	n.hit = true; hits += 1; streak += 1; best = maxi(best, streak)
	var perfect := err <= PERFECT
	score += (60 if perfect else 50)*mult()
	meter = minf(1, meter + 0.03)
	flare[n.lane] = 0.6
	if not lead_on: lead_on = true; lead.volume_db = -4
	_say("PERFECT" if perfect else "GOOD", Color("#9ff8ff") if perfect else Color("#ffffff"))
	if streak in [10, 20, 30]: _say("×%d" % mult(), Color("#ffd23d"))
	if strum_cb.is_valid(): strum_cb.call(n.lane)
func _miss() -> void:
	misses += 1; streak = 0; meter = maxf(0, meter - 0.06)
	if lead_on: lead_on = false; lead.volume_db = -60; g.cue("fail")
	_say("MISS", Color("#ff5a5a"))
func _say(t: String, c: Color) -> void: judge = t; judge_t = 0.6; set_meta("jc", c)

func result() -> Dictionary:
	var total := notes.size(); var pct := float(hits)/maxf(1, total)
	var stars := 5 if pct >= 0.95 else (4 if pct >= 0.85 else (3 if pct >= 0.7 else (2 if pct >= 0.5 else 1)))
	return {"score": score, "hits": hits, "total": total, "pct": pct, "best": best, "stars": stars}

# ------------------------------------------------------------------ the highway
func _draw() -> void:
	if not on: return
	var vp := size; var cx := vp.x*0.5
	var y_strike := vp.y - 120.0; var y_far := 150.0
	var w_near := minf(560.0, vp.x*0.5); var a := shown
	var persp := func(p: float) -> float: return 1.0/(1.0 + p*3.0)            # how big a thing is p of the way up the highway
	var at := func(p: float, lane: float) -> Vector2:
		var s: float = persp.call(p); var s1: float = persp.call(1.0)
		var y := y_strike - (y_strike - y_far)*(1.0 - s)/(1.0 - s1)
		return Vector2(cx + (lane - 2.0)*w_near/5.0*s, y)
	# the board
	var c0: Vector2 = at.call(0, -0.5); var c1: Vector2 = at.call(0, 4.5); var c2: Vector2 = at.call(1, 4.5); var c3: Vector2 = at.call(1, -0.5)
	draw_colored_polygon(PackedVector2Array([c0 + Vector2(0, 40), c1 + Vector2(0, 40), c2, c3]), Color(0.03, 0.04, 0.06, 0.82*a))
	# the frets' strings, and bar lines going by
	for l in 6:
		var p0: Vector2 = at.call(0, l - 0.5); var p1: Vector2 = at.call(1, l - 0.5)
		draw_line(p0 + Vector2(0, 40), p1, Color(0.5, 0.6, 0.7, 0.35*a), 2.0 if l in [0, 5] else 1.0)
	var bar := 60.0/float(chart.bpm)*4.0
	var b0 := ceilf(now/bar)*bar
	for i in 4:
		var p := (b0 + i*bar - now)/AHEAD
		if p < 0 or p > 1: continue
		draw_line(at.call(p, -0.5), at.call(p, 4.5), Color(0.6, 0.7, 0.8, 0.25*a), 2.0)
	# the line, and the five frets on it
	draw_line(at.call(0, -0.5), at.call(0, 4.5), Color(1, 1, 1, 0.8*a), 3.0)
	for i in 5:
		var p: Vector2 = at.call(0, i)
		draw_circle(p, 30, Color(0, 0, 0, 0.6*a))
		draw_arc(p, 28, 0, TAU, 32, COLS[i]*Color(1, 1, 1, a), 5.0, true)
		if held[i]: draw_circle(p, 22, COLS[i]*Color(1, 1, 1, 0.6*a))
		if flare[i] > 0: draw_circle(p, 30 + 40*(0.6 - flare[i]), Color(1, 0.9, 0.6, flare[i]*a))
		draw_string(ThemeDB.fallback_font, p + Vector2(-6, 58), NAMES[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1, 1, 1, 0.75*a))
	# the notes (back to front)
	for k in range(notes.size() - 1, -1, -1):
		var n: Dictionary = notes[k]
		if n.hit: continue
		var p0: float = (n.t - now)/AHEAD
		if p0 > 1.02 or p0 < -0.15: continue
		var col: Color = COLS[n.lane]*(Color(0.45, 0.45, 0.45) if n.missed else Color(1, 1, 1))
		if n.len > 0.45:                                                # a long note: its tail
			var p1: float = minf(1.0, (n.t + n.len*0.8 - now)/AHEAD)
			if p1 > maxf(0, p0): draw_line(at.call(maxf(0, p0), n.lane), at.call(p1, n.lane), col*Color(1, 1, 1, 0.7*a), 9.0*persp.call(maxf(0, p0)) + 3.0)
		var s: float = persp.call(maxf(0, p0)); var q: Vector2 = at.call(maxf(-0.15, p0), n.lane)
		draw_circle(q, 26*s + 4, Color(0, 0, 0, 0.7*a))
		draw_circle(q, 24*s + 3, col*Color(1, 1, 1, a))
		draw_circle(q + Vector2(0, -4*s), 10*s + 1, Color(1, 1, 1, 0.55*a))
	# the score, the streak, the multiplier, the rock meter
	var f := ThemeDB.fallback_font
	draw_string(f, Vector2(cx + w_near*0.5 + 40, y_strike - 60), "%d" % score, HORIZONTAL_ALIGNMENT_LEFT, -1, 34, Color(1, 1, 1, a))
	draw_string(f, Vector2(cx + w_near*0.5 + 40, y_strike - 24), "×%d   streak %d" % [mult(), streak], HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color("#ffd23d")*Color(1, 1, 1, a))
	var mx := cx - w_near*0.5 - 70; var mh := 220.0; var my := y_strike - mh
	draw_rect(Rect2(mx, my, 18, mh), Color(0, 0, 0, 0.6*a))
	var mc := Color("#e8384a").lerp(Color("#f5d23c"), clampf(meter*2, 0, 1)).lerp(Color("#3cd25a"), clampf(meter*2 - 1, 0, 1))
	draw_rect(Rect2(mx, my + mh*(1 - meter), 18, mh*meter), mc*Color(1, 1, 1, a))
	draw_string(f, Vector2(mx - 30, my - 10), "ROCK", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1, 1, 1, 0.8*a))
	if judge_t > 0:
		var jc: Color = get_meta("jc", Color.WHITE)
		draw_string(f, Vector2(cx - 200, y_strike - 260), judge, HORIZONTAL_ALIGNMENT_CENTER, 400, 30, jc*Color(1, 1, 1, minf(1, judge_t*3)*a))
	if results:
		var r := result()
		draw_rect(Rect2(cx - 260, vp.y*0.25, 520, 230), Color(0, 0, 0, 0.82))
		draw_string(f, Vector2(cx - 260, vp.y*0.25 + 50), "ROBIN · LIVE FROM HER BEDROOM", HORIZONTAL_ALIGNMENT_CENTER, 520, 22, Color("#9fb4c0"))
		draw_string(f, Vector2(cx - 260, vp.y*0.25 + 100), "★".repeat(r.stars) + "☆".repeat(5 - r.stars), HORIZONTAL_ALIGNMENT_CENTER, 520, 40, Color("#ffd23d"))
		draw_string(f, Vector2(cx - 260, vp.y*0.25 + 150), "%d / %d notes  ·  %d%%" % [r.hits, r.total, roundi(r.pct*100)], HORIZONTAL_ALIGNMENT_CENTER, 520, 22, Color.WHITE)
		draw_string(f, Vector2(cx - 260, vp.y*0.25 + 190), "best streak %d  ·  score %d" % [r.best, r.score], HORIZONTAL_ALIGNMENT_CENTER, 520, 20, Color(1, 1, 1, 0.8))
