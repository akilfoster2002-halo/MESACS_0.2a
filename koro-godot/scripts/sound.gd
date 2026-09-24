## SOUND — the soundtrack, the air, and the club's kit (public/music.js,
## public/club.js).
##
## Wano's theme plays out on the hub and nowhere else: not indoors, not on
## VOLTA and not between them — a theme that follows you everywhere is not a
## theme, it is a hold tone. M turns the music off, and the choice is kept,
## because a soundtrack you cannot find the off switch for is one a teacher
## bans on day one.
##
## Everything else is made here, not downloaded: wind is noise that opens up
## as you fly faster, a take-off is the same noise swept up and let go, and
## the club's four voices are the browser's WebAudio patches rendered to
## samples once (an oscillator and a filter are a dozen lines of arithmetic).
class_name Sound
extends RefCounted

const RATE := 22050
static var music: AudioStreamPlayer
static var wind_player: AudioStreamPlayer
static var fx: AudioStreamPlayer
static var _cache := {}

static func muted() -> bool:
	return bool(Settings.get_value("music_off", false))

static func toggle_music() -> void:
	Settings.set_value("music_off", not muted())
	if music:
		music.volume_db = -80.0 if muted() else -7.0

## Set a world's sound going: its theme (if it has one) and the air.
static func here(world: Node) -> void:
	music = AudioStreamPlayer.new()
	if Worlds.current == "hub":
		var s := load("res://assets/music/ludus-main-theme.mp3") as AudioStreamMP3
		s.loop = true
		music.stream = s
		music.volume_db = -80.0
		world.add_child(music)
		music.play()
		if not muted():
			var tw := music.create_tween()
			tw.tween_property(music, "volume_db", -7.0, 1.4)
	wind_player = AudioStreamPlayer.new()
	wind_player.stream = _noise_loop()
	wind_player.volume_db = -80.0
	world.add_child(wind_player)
	fx = AudioStreamPlayer.new()
	world.add_child(fx)

## Indoors the theme drops away; out of the door it comes back.
static func indoors(inside: bool) -> void:
	if music == null or music.stream == null or muted():
		return
	var want := -30.0 if inside else -7.0
	if absf(music.volume_db - want) > 0.5:
		music.volume_db = lerpf(music.volume_db, want, 0.05)

## How hard the air is going past: 0 standing still, 1 flat out. Squared, so a
## gentle drift is nearly silent and the top of the throttle is unmistakable.
static func wind(x: float) -> void:
	if wind_player == null:
		return
	x = clampf(x, 0.0, 1.0)
	if x < 0.01:
		wind_player.volume_db = lerpf(wind_player.volume_db, -80.0, 0.1)
		if wind_player.volume_db < -60.0 and wind_player.playing:
			wind_player.stop()
		return
	if not wind_player.playing:
		wind_player.play()
	wind_player.volume_db = linear_to_db(0.35 * x * x + 0.0001)
	wind_player.pitch_scale = 0.55 + x * 1.1

static func whoosh() -> void:
	play(_whoosh(), -6.0)

static func play(s: AudioStream, db := 0.0) -> void:
	if fx == null:
		return
	fx.stream = s
	fx.volume_db = db
	fx.play()

# ------------------------------------------------------------- the maths

static func _wav(data: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(data.size() * 2)
	for i in data.size():
		bytes.encode_s16(i * 2, int(clampf(data[i], -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = data.size()
	return w

## Two seconds of noise, smoothed one pole — white noise is harsh and hissy,
## and that one pole is the difference between a broken speaker and moving air.
static func _noise_loop() -> AudioStreamWAV:
	if _cache.has("wind"):
		return _cache.wind
	var n := RATE * 2
	var d := PackedFloat32Array()
	d.resize(n)
	var last := 0.0
	var slow := 0.0
	for i in n:
		last = (last + (randf() * 2.0 - 1.0) * 0.42) / 1.42
		slow += (last - slow) * 0.08
		d[i] = (last * 0.6 + slow * 2.2)
	_cache.wind = _wav(d, true)
	return _cache.wind

## A biquad (the RBJ cookbook), run over a buffer in place: what WebAudio's
## BiquadFilterNode is, with its frequency allowed to move per sample.
static func _biquad(x: PackedFloat32Array, kind: String, f0: Callable, q: float) -> PackedFloat32Array:
	var y := PackedFloat32Array()
	y.resize(x.size())
	var x1 := 0.0
	var x2 := 0.0
	var y1 := 0.0
	var y2 := 0.0
	for i in x.size():
		var w0 := TAU * clampf(f0.call(float(i) / RATE), 20.0, RATE * 0.45) / RATE
		var cw := cos(w0)
		var al := sin(w0) / (2.0 * q)
		var b0: float
		var b1: float
		var b2: float
		match kind:
			"low":
				b0 = (1.0 - cw) / 2.0
				b1 = 1.0 - cw
				b2 = b0
			"high":
				b0 = (1.0 + cw) / 2.0
				b1 = -(1.0 + cw)
				b2 = b0
			_:
				b0 = al
				b1 = 0.0
				b2 = -al
		var a0 := 1.0 + al
		var a1 := -2.0 * cw
		var a2 := 1.0 - al
		var v := (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
		x2 = x1
		x1 = x[i]
		y2 = y1
		y1 = v
		y[i] = v
	return y

## The envelope the browser uses: 4 ms up, hold, then an exponential fall.
static func _env(t: float, peak: float, hold: float, fall: float) -> float:
	if t < 0.004:
		return peak * t / 0.004
	if t < 0.004 + hold:
		return peak
	return peak * exp(-(t - 0.004 - hold) / (fall / 6.9))

static func _whoosh() -> AudioStreamWAV:
	if _cache.has("whoosh"):
		return _cache.whoosh
	var n := int(RATE * 0.65)
	var x := PackedFloat32Array()
	x.resize(n)
	for i in n:
		x[i] = randf() * 2.0 - 1.0
	var y := _biquad(x, "band", func(t): return 180.0 * pow(1900.0 / 180.0, minf(1.0, t / 0.45)), 1.1)
	for i in n:
		var t := float(i) / RATE
		var g := 0.11 * (t / 0.08) if t < 0.08 else 0.11 * exp(-(t - 0.08) * 9.0)
		y[i] *= g * 6.0
	_cache.whoosh = _wav(y)
	return _cache.whoosh

# ------------------------------------------------------------- the kit

static func kick() -> PackedFloat32Array:
	var n := int(RATE * 0.4)
	var d := PackedFloat32Array()
	d.resize(n)
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		var f := 150.0 * pow(46.0 / 150.0, minf(1.0, t / 0.11))
		ph += TAU * f / RATE
		d[i] = sin(ph) * _env(t, 0.95, 0.012, 0.24)
	return d

static func _burst(dur: float, kind: String, f: float, q: float, peak: float) -> PackedFloat32Array:
	var n := int(RATE * (dur + 0.05))
	var x := PackedFloat32Array()
	x.resize(n)
	for i in n:
		x[i] = randf() * 2.0 - 1.0
	var y := _biquad(x, kind, func(_t): return f, q)
	for i in n:
		y[i] *= _env(float(i) / RATE, peak, 0.0, dur) * (1.6 if kind == "band" else 1.0)
	return y

static func clap() -> PackedFloat32Array:
	return _burst(0.17, "band", 1500.0, 1.2, 0.55)

static func hat() -> PackedFloat32Array:
	return _burst(0.045, "high", 7200.0, 0.7, 0.30)

## A sawtooth through a resonant low-pass that opens with the room: a bassline
## that sounds the same whether four voices are running or one is a bassline
## nobody notices they have turned on.
static func bass(hz: float, energy: float) -> PackedFloat32Array:
	var n := int(RATE * 0.35)
	var x := PackedFloat32Array()
	x.resize(n)
	var ph := 0.0
	for i in n:
		ph = fmod(ph + hz / RATE, 1.0)
		x[i] = ph * 2.0 - 1.0
	var top := 220.0 + 900.0 * energy
	var y := _biquad(x, "low", func(t): return top * pow(160.0 / top, minf(1.0, t / 0.2)), 6.0)
	for i in n:
		y[i] *= _env(float(i) / RATE, 0.42, 0.02, 0.2)
	return y
