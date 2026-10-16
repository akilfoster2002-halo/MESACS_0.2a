## THE CUES WITH NO RECORDING (tsh.js cue): the browser shapes these out of oscillators and filtered noise when
## tsh/sfx/ has no file for them — the alarm clock, the phone ringing, the school PA, the suspense stabs, the zip,
## the window, tyres. The same recipes, rendered once into a buffer the first time each is heard. And the bed
## (tsh.js startBed): rain all night (muffled indoors), the city's low rumble under it, gone dry by day.
class_name Synth
extends RefCounted

const SR := 22050
static var _cache := {}
static var _lock := Mutex.new()

## the kinds this can make
const KINDS := ["pa", "jam", "alert", "alert2", "sus", "rise", "sting", "heat", "pick", "step", "kick", "ui", "scan", "ring",
	"hangup", "zip", "gear", "window", "phone", "punch", "door", "fail", "win", "swish", "boom", "blast", "clang", "hurt",
	"grab", "lock", "launch", "skid", "alarm", "flash", "beep", "siren", "fridge"]

static func stream(kind: String) -> AudioStreamWAV:
	_lock.lock(); var have = _cache.get(kind); _lock.unlock()
	if have != null: return have
	if not KINDS.has(kind): return null
	var s := Synth.new(); s._make(kind)
	var w := _wav(s.out, false)
	_lock.lock(); _cache[kind] = w; _lock.unlock()
	return w
## made ahead, off the main thread, so the first sting does not stall a film: every kind with no recording
static func warm() -> void:
	WorkerThreadPool.add_task(func():
		for k in KINDS:
			if not ResourceLoader.exists("res://assets/tsh/sfx/%s-0.mp3" % k): stream(k))

# ------------------------------------------------------------------ the parts
var out := PackedFloat32Array()
func _need(n: int) -> void:
	if out.size() < n: out.resize(n)

## an envelope: [[t, v], ...], exponential between points (setValueAtTime + exponentialRampToValueAtTime); a point
## with a third element true is a step (setValueAtTime) instead
static func _env(pts: Array, t: float) -> float:
	if t <= pts[0][0]: return pts[0][1]
	for i in range(1, pts.size()):
		var b: Array = pts[i]
		if t < b[0]:
			var a: Array = pts[i - 1]
			if b.size() > 2: return a[1]
			return a[1]*pow(b[1]/a[1], (t - a[0])/(b[0] - a[0]))
	return pts[-1][1]

static func _blep(t: float, dt: float) -> float:
	if t < dt: t /= dt; return t + t - t*t - 1.0
	if t > 1.0 - dt: t = (t - 1.0)/dt; return t*t + t + t + 1.0
	return 0.0
static func _wave(type: String, ph: float, dt: float) -> float:
	match type:
		"square": return (1.0 if ph < 0.5 else -1.0) + _blep(ph, dt) - _blep(fmod(ph + 0.5, 1.0), dt)
		"sawtooth": return 2.0*ph - 1.0 - _blep(ph, dt)
		"triangle": return 1.0 - 4.0*absf(ph - 0.5)
	return sin(ph*TAU)

## an oscillator from `at` for `dur` into buf (or out), its frequency and gain on envelopes
func _osc(at: float, dur: float, type: String, freq: Array, gain: Array, buf = null, detune := 0.0) -> void:
	var dst: PackedFloat32Array = out if buf == null else buf
	var i0 := int(at*SR); var n := int(dur*SR)
	if dst.size() < i0 + n:
		if buf == null: _need(i0 + n); dst = out
		else: n = dst.size() - i0
	var ph := 0.0; var dm := pow(2.0, detune/1200.0)
	for i in n:
		var t := at + float(i)/SR
		var f := _env(freq, t)*dm; var dt := f/SR
		dst[i0 + i] += _wave(type, ph, dt)*_env(gain, t)
		ph = fmod(ph + dt, 1.0)
	if buf == null: out = dst
## tsh.js tone(): a sweep from f0 to f1, its gain falling from vol to nothing
func tone(f0: float, f1: float, dur: float, type := "sine", vol := 0.08, at := 0.0) -> void:
	_osc(at, dur + 0.05, type, [[at, f0], [at + dur, f1]], [[at, vol], [at + dur, 0.0008]])

## a biquad over a whole buffer (WebAudio's: a bandpass's Q is plain, a lowpass's in dB), its frequency on an envelope
static func _filter(src: PackedFloat32Array, kind: String, freq: Array, q: float, at := 0.0) -> PackedFloat32Array:
	var o := PackedFloat32Array(); o.resize(src.size())
	var x1 := 0.0; var x2 := 0.0; var y1 := 0.0; var y2 := 0.0
	var b0 := 0.0; var b1 := 0.0; var b2 := 0.0; var a1 := 0.0; var a2 := 0.0
	for i in src.size():
		if i % 16 == 0:
			var f := clampf(_env(freq, at + float(i)/SR), 10.0, SR*0.49)
			var w0 := TAU*f/SR; var cw := cos(w0); var sw := sin(w0)
			var al := sw/(2.0*(q if kind == "bandpass" else pow(10.0, q/20.0)))
			var a0 := 1.0 + al
			match kind:
				"bandpass": b0 = al/a0; b1 = 0.0; b2 = -al/a0
				"lowpass": b0 = (1.0 - cw)/2.0/a0; b1 = (1.0 - cw)/a0; b2 = b0
				"highpass": b0 = (1.0 + cw)/2.0/a0; b1 = -(1.0 + cw)/a0; b2 = b0
			a1 = -2.0*cw/a0; a2 = (1.0 - al)/a0
		var x := src[i]
		var y := b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2
		x2 = x1; x1 = x; y2 = y1; y1 = y; o[i] = y
	return o
static func _noise(secs: float, brown := false) -> PackedFloat32Array:
	var b := PackedFloat32Array(); b.resize(int(secs*SR)); var last := 0.0
	for i in b.size():
		var w := randf()*2.0 - 1.0
		if brown: last = (last + 0.02*w)/1.02; b[i] = last*3.5
		else: b[i] = w
	return b
## adds src into out at `at`, times a gain envelope
func _mix(src: PackedFloat32Array, at: float, gain: Array) -> void:
	var i0 := int(at*SR); _need(i0 + src.size())
	for i in src.size(): out[i0 + i] += src[i]*_env(gain, at + float(i)/SR)
## tsh.js burst(): white noise through a bandpass, falling from vol
func burst(dur: float, f: float, vol: float, q := 0.7, at := 0.0) -> void:
	_mix(_filter(_noise(dur), "bandpass", [[0.0, f]], q), at, [[at, vol], [at + dur, 0.0008]])
## noise through a sweeping bandpass
func sweep(dur: float, freq: Array, q: float, gain: Array, at := 0.0) -> void:
	_mix(_filter(_noise(dur), "bandpass", freq, q), at, gain)

# ------------------------------------------------------------------ the recipes (tsh.js cue, as written there)
func _make(kind: String) -> void:
	match kind:
		"flash": burst(0.5, 3000, 0.5, 0.4); tone(2200, 300, 0.4, "square", 0.05)
		# the school PA: three notes up, each ringing on in the building (an echo a beat behind)
		"pa":
			for nt in [[523.25, 0.0], [659.25, 0.42], [783.99, 0.84]]:
				for j in 2:
					var t0: float = nt[1] + [0.0, 0.18][j]
					_osc(t0, 1.4, "sine", [[0.0, nt[0]]], [[t0, 0.0001], [t0 + 0.02, 0.035 if j else 0.11], [t0 + 1.3, 0.0005]])
		"jam": tone(200, 1800, 0.5, "sawtooth", 0.04); tone(1800, 200, 0.5, "sawtooth", 0.03)
		"alert": tone(520, 780, 0.18, "square", 0.06); tone(780, 520, 0.18, "square", 0.06, 0.17)
		"alert2": tone(780, 520, 0.18, "square", 0.06)
		# somebody noticed: a low stab
		"sus":
			var b := PackedFloat32Array(); b.resize(int(1.25*SR))
			for f in [98.0, 103.8]: _osc(0.0, 1.25, "sawtooth", [[0.0, f]], [[0.0, 1.0]], b)
			_mix(_filter(b, "lowpass", [[0.0, 900.0], [1.1, 180.0]], 4.0), 0.0, [[0.0, 0.0001], [0.03, 0.07], [1.2, 0.0008]])
			tone(62, 44, 0.9, "sine", 0.22)
		# the floor pulled up under a shot before a reveal
		"rise":
			sweep(2.3, [[0.0, 260.0], [2.1, 5200.0]], 2.2, [[0.0, 0.0001], [2.05, 0.16], [2.25, 0.0005]])
			_osc(0.0, 2.3, "sine", [[0.0, 110.0], [2.1, 440.0]], [[0.0, 0.0001], [2.0, 0.06], [2.2, 0.0005]])
		# the reveal: a sub falling away under a cluster a semitone apart that opens and closes
		"sting":
			tone(58, 34, 2.6, "sine", 0.38)
			var b := PackedFloat32Array(); b.resize(int(3.05*SR))
			for fc in [[110.0, -7.0], [116.5, 6.0], [164.8, -4.0], [233.1, 9.0]]: _osc(0.0, 3.05, "sawtooth", [[0.0, fc[0]]], [[0.0, 1.0]], b, fc[1])
			_mix(_filter(b, "lowpass", [[0.0, 260.0], [1.0, 2600.0], [2.9, 380.0]], 3.0), 0.0, [[0.0, 0.0001], [0.25, 0.06], [1.1, 0.06], [3.0, 0.0006]])
			burst(0.35, 6500, 0.12, 1.5)
		"heat": tone(900, 600, 0.25, "square", 0.05); tone(900, 600, 0.25, "square", 0.05, 0.28)
		"pick": tone(700, 1200, 0.12, "sine", 0.07)
		"step": burst(0.08, 900, 0.05)
		"kick": burst(0.3, 250, 0.4, 0.5); tone(120, 60, 0.3, "sine", 0.2)
		"ui": tone(900, 900, 0.06, "sine", 0.04)
		"beep": tone(2700, 2700, 0.07, "square", 0.045)
		"horn": tone(311, 300, 1.1, "sawtooth", 0.07); tone(370, 360, 1.1, "sawtooth", 0.06); tone(155, 150, 1.1, "square", 0.05)
		"scan": tone(1500, 1500, 0.05, "sine", 0.03)
		"ring":
			var ds := [0.0, 0.13, 0.26, 0.52, 0.65, 0.78]; var fs := [1319.0, 1568.0, 1976.0, 1319.0, 1568.0, 1976.0]
			for i in 6: _osc(ds[i], 0.14, "triangle", [[0.0, fs[i]]], [[ds[i], 0.0001], [ds[i] + 0.01, 0.09], [ds[i] + 0.12, 0.0008]])
		"hangup": tone(620, 620, 0.06, "square", 0.03); burst(0.05, 2500, 0.08)
		"zip": sweep(0.45, [[0.0, 1800.0], [0.4, 5200.0]], 3.0, [[0.0, 0.12], [0.42, 0.0008]])
		"gear": tone(260, 1700, 0.42, "sawtooth", 0.025); tone(1700, 1700, 0.1, "sine", 0.05, 0.4)
		"window": burst(0.7, 500, 0.22, 0.5); burst(1.6, 1200, 0.06, 0.3)
		"phone": tone(1320, 1320, 0.12, "sine", 0.05); tone(1760, 1760, 0.12, "sine", 0.05, 0.15)
		"punch": burst(0.15, 400, 0.5); tone(1200, 3000, 0.4, "sine", 0.06)
		"door": burst(0.25, 500, 0.2)
		"fail": tone(300, 120, 0.6, "sawtooth", 0.05)
		"win": tone(520, 1040, 0.5, "sine", 0.06)
		"swish": sweep(0.18, [[0.0, 700.0], [0.16, 2600.0]], 1.2, [[0.0, 0.0001], [0.05, 0.18], [0.18, 0.0008]])
		"boom", "blast": burst(0.5, 160, 0.7, 0.4); tone(90, 32, 0.55, "sine", 0.45); tone(2400, 600, 0.25, "sawtooth", 0.03)
		"clang": tone(1800, 1750, 0.5, "triangle", 0.09); tone(2650, 2600, 0.35, "sine", 0.05); burst(0.06, 4000, 0.25)
		"hurt": burst(0.2, 300, 0.55, 0.6); tone(220, 90, 0.25, "sine", 0.18)
		"grab": tone(300, 1600, 0.3, "sawtooth", 0.04); burst(0.2, 2200, 0.12, 0.8)
		"lock": tone(1900, 1900, 0.045, "square", 0.03)
		"launch": burst(0.5, 900, 0.3, 0.5); tone(300, 1400, 0.4, "sawtooth", 0.04)
		"skid": burst(0.9, 1600, 0.22, 2.5); burst(0.5, 300, 0.25, 0.5)
		# a refrigerator's compressor starting somewhere in the flat: a low hum that rises and settles
		"fridge":
			_osc(0.0, 2.6, "sawtooth", [[0.0, 50.0], [0.4, 60.0]], [[0.0, 0.0001], [0.5, 0.025], [2.2, 0.02], [2.6, 0.0001]])
			_osc(0.0, 2.6, "sine", [[0.0, 120.0]], [[0.0, 0.0001], [0.5, 0.012], [2.6, 0.0001]])
		# a siren in the distance: two slow wails
		"siren":
			for d in [0.0, 1.7]:
				_osc(d, 1.75, "triangle", [[d, 640.0], [d + 0.85, 1250.0], [d + 1.7, 640.0]], [[d, 0.0001], [d + 0.2, 0.05], [d + 1.5, 0.05], [d + 1.75, 0.0001]])
		# her alarm clock (tsh.js alarm): two short beeps, every 0.9 s while it goes
		"beep":
			for d in [0.0, 0.16]: _osc(d, 0.13, "square", [[0.0, 1760.0]], [[d, 0.0001], [d + 0.01, 0.05], [d + 0.09, 0.05], [d + 0.11, 0.0001]])
		# the WFC alarm: five beeps, each 880 then 660
		"alarm":
			for d in [0.0, 0.32, 0.64, 0.96, 1.28]:
				_osc(d, 0.32, "square", [[d, 880.0], [d + 0.16, 660.0, true], [d + 9.0, 660.0]], [[d, 0.0001], [d + 0.01, 0.035], [d + 0.3, 0.0008]])

static func _wav(buf: PackedFloat32Array, loop: bool) -> AudioStreamWAV:
	var b := PackedByteArray(); b.resize(buf.size()*2)
	for i in buf.size(): b.encode_s16(i*2, int(clampf(buf[i], -1.0, 1.0)*32767.0))
	var w := AudioStreamWAV.new(); w.format = AudioStreamWAV.FORMAT_16_BITS; w.mix_rate = SR; w.stereo = false; w.data = b
	if loop: w.loop_mode = AudioStreamWAV.LOOP_FORWARD; w.loop_begin = 0; w.loop_end = buf.size()
	return w

# ------------------------------------------------------------------ the bed
## loops, rendered once: rain (noise, highpass 300, lowpass 1400 — or 380 indoors), and the city's hum (brown
## noise; by day only its low rumble, under 320 Hz)
static func bed_streams() -> Dictionary:
	if _cache.has("_bed"): return _cache["_bed"]
	var rain := _filter(_noise(3.0), "highpass", [[0.0, 300.0]], 1.0)
	var d := {"rain": _wav(_seam(_filter(rain, "lowpass", [[0.0, 1400.0]], 1.0)), true),
		"rain_in": _wav(_seam(_filter(rain, "lowpass", [[0.0, 380.0]], 1.0)), true)}
	var hum := _noise(4.0, true)
	d.hum = _wav(_seam(hum), true); d.hum_day = _wav(_seam(_filter(hum, "lowpass", [[0.0, 320.0]], 1.0)), true)
	_cache["_bed"] = d; return d
## a loop with no click where it meets itself: its last quarter-second faded into its start
static func _seam(b: PackedFloat32Array) -> PackedFloat32Array:
	var x := int(0.25*SR); var n := b.size() - x
	var o := b.slice(0, n)
	for i in x:
		var k := float(i)/x
		o[i] = b[i]*k + b[n + i]*(1.0 - k)
	return o
