## THE GUITAR (Guitar Hero, in her room). Her song (beabadoobee, "Worth It", from 2:14: tools/song/worth_it.py) plays;
## where its electric guitar comes in, the highway slides up and its hits come down four lanes — the ARROW keys as each
## note reaches the line; where the guitar drops out the highway slides away and the scene watches her room. A miss
## dips the song and scratches; a run of hits raises the multiplier. As
## the real game does. Every ten in a row raises the multiplier (to ×4); the rock meter, green to red, is how the
## room thinks it is going. At the end: how many she hit, her best streak, her stars.
class_name GuitarGame
extends Control

const LANES := 4
const KEYS := [[KEY_LEFT, KEY_A], [KEY_DOWN, KEY_S], [KEY_UP, KEY_W], [KEY_RIGHT, KEY_D]]
const COLS := [Color("#3cd25a"), Color("#e8384a"), Color("#f5d23c"), Color("#3c8cf0")]
const NAMES := ["←", "↓", "↑", "→"]
const AHEAD := 2.0              # seconds of highway on screen
const WINDOW := 0.11            # how far either side of the line a note can be hit
const PERFECT := 0.045
var g
var chart := {}; var notes: Array = []
var band: AudioStreamPlayer; var lead: AudioStreamPlayer
var on := false; var playing := false; var shown := 0.0
var now := 0.0; var _clk := 0.0
var score := 0; var streak := 0; var best := 0; var hits := 0; var misses := 0; var meter := 0.5
var lead_on := true; var held := [false, false, false, false]; var flare := [0.0, 0.0, 0.0, 0.0]; var dip := 0.0
var judge := ""; var judge_t := 0.0
var done_cb: Callable; var strum_cb: Callable
var finished := false; var results := false
var auto := false               # the photo pass plays it by itself
var sparks: Array = []          # [pos, vel, life, color]: the burst off a hit fret
var flames := [0.0, 0.0, 0.0, 0.0]   # the flame column off each fret as it is hit
var judge_pop := 0.0
var font: Font

func _init(game) -> void:
	g = game
	mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_preset(Control.PRESET_FULL_RECT); visible = false
	chart = g._json("res://assets/tsh/worth_chart.json")
	band = AudioStreamPlayer.new(); band.stream = load("res://assets/tsh/music/worth_it.mp3"); band.volume_db = -3; game.add_child(band)
	lead = AudioStreamPlayer.new(); game.add_child(lead)
	var sf := SystemFont.new(); sf.font_names = PackedStringArray(["Avenir Next Condensed", "Futura", "Helvetica Neue", "Arial"]); sf.font_weight = 800; sf.font_italic = true
	font = sf

## the song from the top (the montage plays over its intro)
func song() -> void:
	g.music.stop()                                              # one song at a time
	band.play(0.0); _clk = 0.0; now = 0.0
## the game: from here the notes come down; done(result) when the song is over
func start(done: Callable, strum := Callable()) -> void:
	done_cb = done; strum_cb = strum
	notes = []
	for n in chart.notes: notes.append({"t": float(n.t), "len": float(n.len), "lane": int(n.lane), "hit": false, "missed": false})
	score = 0; streak = 0; best = 0; hits = 0; misses = 0; meter = 0.5; lead_on = true; finished = false; results = false
	on = true; playing = true; visible = true; shown = 0.0; dip = 0.0
func stop() -> void:
	on = false; playing = false; visible = false; band.stop(); lead.stop()
## inside one of the song's guitar sections
func in_play(t: float) -> bool:
	for w in chart.play:
		if t >= float(w[0]) and t <= float(w[1]): return true
	return false
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
	# the highway: up from a moment before a guitar section (so its first notes are seen coming), away after it
	shown = clampf(shown + dt*2.5*(1.0 if in_play(now + AHEAD*0.9) or in_play(now - 0.3) else -1.0), 0.0, 1.0)
	for i in LANES: flare[i] = maxf(0, flare[i] - dt*4); flames[i] = maxf(0, flames[i] - dt*3.2)
	judge_pop = maxf(0, judge_pop - dt*6)
	for sp in sparks: sp[1] += Vector2(0, 900)*dt; sp[0] += sp[1]*dt; sp[2] -= dt
	sparks = sparks.filter(func(sp): return sp[2] > 0)
	dip = maxf(0, dip - dt); band.volume_db = -3.0 - 9.0*minf(1, dip*3)
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
	for i in LANES:
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
	flare[n.lane] = 0.6; flames[n.lane] = 1.0
	set_meta("burst", n.lane)

	_say("PERFECT" if perfect else "GOOD", Color("#9ff8ff") if perfect else Color("#ffffff"))
	if streak in [10, 20, 30]: _say("×%d" % mult(), Color("#ffd23d"))
	if strum_cb.is_valid(): strum_cb.call(n.lane)
func _miss() -> void:
	misses += 1; streak = 0; meter = maxf(0, meter - 0.06)
	dip = 0.35; g.cue("fail")
	_say("MISS", Color("#ff5a5a"))
func _say(t: String, c: Color) -> void: judge = t; judge_t = 0.7; judge_pop = 1.0; set_meta("jc", c)

func result() -> Dictionary:
	var total := notes.size(); var pct := float(hits)/maxf(1, total)
	var stars := 5 if pct >= 0.95 else (4 if pct >= 0.85 else (3 if pct >= 0.7 else (2 if pct >= 0.5 else 1)))
	return {"score": score, "hits": hits, "total": total, "pct": pct, "best": best, "stars": stars}

# ------------------------------------------------------------------ the highway
## the look: a dark fretboard running away into the dark, each lane faintly its colour; chrome rails with a glow;
## the beat going by in fret wires; five (four) chrome-ringed buttons on the strike line, lit while held; the notes
## as gems, squashed by the perspective, with a highlight on top; a hit throws a flame up and sparks off its button;
## the multiplier in a badge filling towards the next; the rock meter a gauge with a needle
const GEM_SQ := 0.62                     # the perspective's squash on the round things
func _ell(c: Vector2, r: float, col: Color, sq := GEM_SQ) -> void:
	draw_set_transform(c, 0, Vector2(1, sq)); draw_circle(Vector2.ZERO, r, col); draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
func _ell_ring(c: Vector2, r: float, col: Color, w: float, sq := GEM_SQ) -> void:
	draw_set_transform(c, 0, Vector2(1, sq)); draw_arc(Vector2.ZERO, r, 0, TAU, 48, col, w, true); draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
func _text(at: Vector2, t: String, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, w := -1.0, outline := 6) -> void:
	draw_string_outline(font, at, t, align, w, size, outline, Color(0, 0, 0, col.a*0.85))
	draw_string(font, at, t, align, w, size, col)

func _draw() -> void:
	if not on: return
	if shown <= 0.001 and not results: return
	# the highway on the right of the screen (her on the left of it); the meter and the score to its left
	var a := shown; var ease_in := a*a*(3 - 2*a)
	var vp := size; var w_near := minf(500.0, vp.x*0.37); var cx := vp.x - w_near*0.5 - maxf(40.0, vp.x*0.055)
	var drop := (1.0 - ease_in)*260.0                                  # it rises into place
	var y_strike := vp.y*0.80 + drop; var y_far := vp.y*0.13 + drop          # inside the letterbox
	var persp := func(p: float) -> float: return 1.0/(1.0 + p*3.2)
	var at := func(p: float, lane: float) -> Vector2:
		var s: float = persp.call(p); var s1: float = persp.call(1.0)
		var y := y_strike - (y_strike - y_far)*(1.0 - s)/(1.0 - s1)
		return Vector2(cx + (lane - 1.5)*w_near/4.0*s, y)
	var lw := w_near/4.0
	# THE BOARD: strips from near to far, darker and more transparent as they go; each lane its own faint tint
	var N := 16
	for i in N:
		var pa := float(i)/N; var pb := float(i + 1)/N
		var fa := (1.0 - pa)*0.9 + 0.1; var fb := (1.0 - pb)*0.9 + 0.1
		for l in LANES:
			var q := PackedVector2Array([at.call(pa, l - 0.5), at.call(pa, l + 0.5), at.call(pb, l + 0.5), at.call(pb, l - 0.5)])
			var base := Color(0.035, 0.04, 0.06).lerp(COLS[l], 0.07 + (0.06 if held[l] else 0.0) + flare[l]*0.12)
			draw_polygon(q, PackedColorArray([Color(base, 0.9*a*fa), Color(base, 0.9*a*fa), Color(base, 0.9*a*fb), Color(base, 0.9*a*fb)]))
	# under the strike line: the board runs on a little and stops
	var u0: Vector2 = at.call(0, -0.5); var u1: Vector2 = at.call(0, 3.5)
	draw_polygon(PackedVector2Array([u0, u1, u1 + Vector2(0, 46), u0 + Vector2(0, 46)]), PackedColorArray([Color(0.035, 0.04, 0.06, 0.9*a), Color(0.035, 0.04, 0.06, 0.9*a), Color(0, 0, 0, 0), Color(0, 0, 0, 0)]))
	# THE BEAT: fret wires going by — a thin one each beat, a bright one each bar
	var beat := 60.0/float(chart.bpm)
	var k0 := ceilf(now/beat)
	for i in int(AHEAD/beat) + 2:
		var t := (k0 + i)*beat; var p := (t - now)/AHEAD
		if p < 0 or p > 1: continue
		var on_bar := false
		for b in chart.bars: if absf(float(b) - t) < beat*0.3: on_bar = true; break
		var s: float = persp.call(p); var fade := 1.0 - p*0.85
		draw_line(at.call(p, -0.5), at.call(p, 3.5), Color(0.75, 0.82, 0.95, (0.42 if on_bar else 0.16)*a*fade), (3.5 if on_bar else 1.6)*s + 0.5, true)
	# the strings: one down each lane's middle, faint
	for l in LANES:
		draw_line(at.call(0, l), at.call(1, l), Color(0.8, 0.85, 0.95, 0.10*a), 1.5, true)
	# THE RAILS: chrome, with a glow outside them
	for side in [-0.5, 3.5]:
		var p0: Vector2 = at.call(0, side) + Vector2(0, 46); var p1: Vector2 = at.call(1, side)
		draw_line(p0, p1, Color(0.4, 0.75, 1.0, 0.18*a), 14.0, true)
		draw_line(p0, p1, Color(0.85, 0.92, 1.0, 0.9*a), 3.0, true)
	# far end: the board fading into the dark
	# THE STRIKE LINE, glowing
	draw_line(u0, u1, Color(1, 1, 1, 0.12*a), 16.0, true)
	draw_line(u0, u1, Color(1, 1, 1, 0.85*a), 3.0, true)
	# THE BUTTONS: a shadow, a chrome ring, the colour, the black well — lit while held, flaring as hit
	for i in LANES:
		var p: Vector2 = at.call(0, i); var r := lw*0.40
		_ell(p + Vector2(0, 6), r + 6, Color(0, 0, 0, 0.55*a))
		_ell(p, r + 4, Color(0.55, 0.58, 0.62, a)); _ell(p + Vector2(0, -1.5), r + 2, Color(0.88, 0.9, 0.94, a))
		_ell(p, r, COLS[i].darkened(0.25)*Color(1, 1, 1, a))
		_ell(p, r*0.7, Color(0.02, 0.02, 0.03, a) if not held[i] else COLS[i].lightened(0.35)*Color(1, 1, 1, a))
		if held[i]: _ell(p, r*1.35, COLS[i]*Color(1, 1, 1, 0.25*a))
		_ell_ring(p, r*0.7, Color(1, 1, 1, 0.25*a), 1.5)
		if flare[i] > 0: _ell_ring(p, r + 6 + 46*(0.6 - flare[i]), Color(COLS[i].lightened(0.5), flare[i]*1.4*a), 4.0)
		_text(p + Vector2(-lw*0.5, r + 34), NAMES[i], 20, Color(1, 1, 1, 0.7*a), HORIZONTAL_ALIGNMENT_CENTER, lw, 4)
	# THE NOTES, back to front: gems
	for k in range(notes.size() - 1, -1, -1):
		var n: Dictionary = notes[k]
		if n.hit: continue
		var p0: float = (n.t - now)/AHEAD
		if p0 > 1.02 or p0 < -0.12: continue
		var col: Color = COLS[n.lane]
		if n.missed: col = col.darkened(0.6)
		var fade := clampf((1.02 - p0)*6.0, 0, 1)*a                   # out of the dark at the far end
		var s: float = persp.call(maxf(0, p0)); var q: Vector2 = at.call(maxf(-0.12, p0), n.lane); var r: float = lw*0.36*s/float(persp.call(0))
		if n.len > 0.45:
			var p1: float = minf(1.0, (n.t + n.len*0.8 - now)/AHEAD)
			if p1 > maxf(0, p0): draw_line(at.call(maxf(0, p0), n.lane), at.call(p1, n.lane), Color(col, 0.75*fade), r*0.5, true)
		_ell(q + Vector2(0, r*0.32), r*1.05, Color(0, 0, 0, 0.5*fade))                # its shadow
		_ell(q + Vector2(0, r*0.16), r, col.darkened(0.45)*Color(1, 1, 1, fade))      # its side
		_ell(q, r, col*Color(1, 1, 1, fade))                                          # its top
		_ell(q, r*0.62, col.lightened(0.25)*Color(1, 1, 1, fade))
		_ell(q + Vector2(0, -r*0.06), r*0.34, Color(1, 1, 1, 0.95*fade))              # the white cap
		_ell(q + Vector2(-r*0.35, -r*0.28), r*0.18, Color(1, 1, 1, 0.55*fade))        # a glint
		_ell_ring(q, r, Color(0, 0, 0, 0.55*fade), maxf(1.0, r*0.08))
	# THE HIT: a flame up off the button, sparks
	if has_meta("burst"):
		var l: int = get_meta("burst"); remove_meta("burst")
		var p: Vector2 = at.call(0, l)
		for j in 14:
			var an := randf_range(-PI*0.95, -PI*0.05)
			sparks.append([p, Vector2(cos(an), sin(an))*randf_range(220, 620), randf_range(0.25, 0.5), COLS[l].lightened(0.4)])
	for i in LANES:
		if flames[i] <= 0: continue
		var p: Vector2 = at.call(0, i); var f: float = flames[i]; var h: float = 170.0*f; var w: float = lw*0.42*(0.6 + f*0.4)
		var c: Color = COLS[i].lightened(0.3)
		draw_polygon(PackedVector2Array([p + Vector2(-w, 0), p + Vector2(w, 0), p + Vector2(w*0.25, -h), p + Vector2(-w*0.25, -h)]),
			PackedColorArray([Color(c, 0.75*f*a), Color(c, 0.75*f*a), Color(c, 0), Color(c, 0)]))
		draw_polygon(PackedVector2Array([p + Vector2(-w*0.45, 0), p + Vector2(w*0.45, 0), p + Vector2(0, -h*0.8)]),
			PackedColorArray([Color(1, 1, 1, 0.8*f*a), Color(1, 1, 1, 0.8*f*a), Color(1, 1, 1, 0)]))
	for sp in sparks:
		var v: Vector2 = sp[1]
		draw_line(sp[0], sp[0] - v*0.025, Color(sp[3], minf(1, sp[2]*3)*a), 2.5, true)
	# THE MULTIPLIER: a badge, its ring filling toward the next
	var bx := cx - w_near*0.5 - 92; var by := y_strike - 70
	var mcol: Color = [Color(0.9, 0.9, 0.95), Color("#ff9a2e"), Color("#3cd25a"), Color("#c46bff")][mult() - 1]
	draw_circle(Vector2(bx, by), 40, Color(0, 0, 0, 0.7*a))
	draw_arc(Vector2(bx, by), 36, 0, TAU, 48, Color(1, 1, 1, 0.12*a), 6.0, true)
	var fill := 1.0 if mult() == 4 else float(streak % 10)/10.0
	if fill > 0: draw_arc(Vector2(bx, by), 36, -PI/2, -PI/2 + TAU*fill, 48, Color(mcol, a), 6.0, true)
	_text(Vector2(bx - 40, by + 13), "×%d" % mult(), 34, Color(mcol, a), HORIZONTAL_ALIGNMENT_CENTER, 80, 5)
	# THE SCORE above it, and the streak
	_text(Vector2(bx - 260, by - 64), "%d" % score, 46, Color(1, 1, 1, a), HORIZONTAL_ALIGNMENT_RIGHT, 300, 8)
	if streak >= 5: _text(Vector2(bx - 260, by + 72), "%d NOTE STREAK" % streak, 20, Color(1, 0.85, 0.3, a), HORIZONTAL_ALIGNMENT_RIGHT, 300, 4)
	# THE ROCK METER: a half gauge, red to yellow to green, a needle
	var gc := Vector2(bx - 150, by + 30); var gr := 46.0
	draw_circle(gc, gr + 10, Color(0, 0, 0, 0.6*a))
	for seg in 3:
		var a0 := PI + seg*PI/3.0; var a1 := a0 + PI/3.0
		draw_arc(gc, gr, a0 + 0.03, a1 - 0.03, 16, Color([Color("#e8384a"), Color("#f5d23c"), Color("#3cd25a")][seg], 0.9*a), 9.0, true)
	var na := PI + PI*meter
	draw_line(gc, gc + Vector2(cos(na), sin(na))*(gr - 4), Color(1, 1, 1, a), 3.0, true); draw_circle(gc, 5, Color(1, 1, 1, a))
	_text(Vector2(gc.x - 40, gc.y + 26), "ROCK", 16, Color(1, 1, 1, 0.8*a), HORIZONTAL_ALIGNMENT_CENTER, 80, 4)
	# THE CALL: a pop above the line
	if judge_t > 0:
		var jc: Color = get_meta("jc", Color.WHITE); var sc := 1.0 + judge_pop*0.35
		var jp := Vector2(cx, y_strike - 250)
		draw_set_transform(jp, -0.05, Vector2(sc, sc))
		_text(Vector2(-200, 0), judge, 38, Color(jc, minf(1, judge_t*3)*a), HORIZONTAL_ALIGNMENT_CENTER, 400, 8)
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	if results:
		var r := result()
		var rc := Rect2(vp.x*0.5 - 280, vp.y*0.24, 560, 250)
		draw_rect(rc, Color(0.02, 0.025, 0.04, 0.88)); draw_rect(rc, Color(1, 1, 1, 0.25), false, 2.0)
		_text(Vector2(rc.position.x, rc.position.y + 52), "ROBIN · LIVE FROM HER BEDROOM", 24, Color("#9fb4c0"), HORIZONTAL_ALIGNMENT_CENTER, rc.size.x, 4)
		_text(Vector2(rc.position.x, rc.position.y + 112), "★".repeat(r.stars) + "☆".repeat(5 - r.stars), 50, Color("#ffd23d"), HORIZONTAL_ALIGNMENT_CENTER, rc.size.x, 6)
		_text(Vector2(rc.position.x, rc.position.y + 166), "%d / %d notes  ·  %d%%" % [r.hits, r.total, roundi(r.pct*100)], 26, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, rc.size.x, 4)
		_text(Vector2(rc.position.x, rc.position.y + 210), "best streak %d  ·  score %d" % [r.best, r.score], 22, Color(1, 1, 1, 0.8), HORIZONTAL_ALIGNMENT_CENTER, rc.size.x, 4)
