## THE LOOP — VOLTA's nightclub, and the decks in it (public/club.js).
##
## The one room in this game that is not marked, not unlocked and not a
## mission: a floor with people on it and a set you can play. It is still a
## loop, though, and says so on the sign — what you are handed at the decks
## is sixteen steps going round for ever with four tracks across them, which
## is the `repeat` block drawn as a grid, with the playhead showing the thing
## a loop never shows you: where in the body it currently is.
##
## THE SET IS ALREADY PLAYING when you walk in — four on the floor, a clap on
## the backbeat, hats off the beat, a bassline that moves — so the first
## thing you do at the decks is change something rather than build out of
## silence. The more voices are going, the harder the crowd dances.
##
## THE BAR IS RENDERED, NOT SCHEDULED: whenever the grid or the tempo changes,
## the whole sixteen steps are mixed once into one looping sample (tails that
## run past the end wrap round to the start, so the loop point is seamless)
## and the room plays that from the booth. A sixteenth lands exactly on its
## sixteenth however the frames are falling, and playing it costs nothing;
## where the playhead is is read back off the playback position.
class_name Club
extends Node3D

const TRACKS := [["KICK", Color("ff6ad5")], ["CLAP", Color("8ff0ff")], ["HAT", Color("ffe9a8")], ["BASS", Color("a8e6cf")]]
const STEPS := 16
const OPENING := [
	[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
	[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
	[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
	[1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
]
## Two bars of a minor line, one note per step, in semitones off the root.
const LINE := [0, 0, 3, 0, 5, 0, 3, 0, 0, 0, 7, 0, 5, 3, 0, -2]
const ROOT := 55.0

var bld: Building
var pat: Array = []
var bpm := 124.0
var step := 0                  # the one you can hear
var energy := 0.55
var drop_t := 0.0

var player: AudioStreamPlayer3D
var kit := {}
var bar: AudioStreamWAV
var beat_flash := 0.0
var _last_step := -1

var tiles: MultiMeshInstance3D
var beams: Array[SpotLight3D] = []
var dancers: Array = []
var t := 0.0

func setup(b: Building) -> Club:
	bld = b
	pat = OPENING.map(func(r): return (r as Array).duplicate())
	return self

func _ready() -> void:
	_kit()
	_room()
	_crowd()
	_audio()

func _kit() -> void:
	kit.kick = Sound.kick()
	kit.clap = Sound.clap()
	kit.hat = Sound.hat()
	for semi in [0, 3, 5, 7, -2]:
		kit["bass%d" % semi] = Sound.bass(ROOT * pow(2.0, semi / 12.0), energy)

# ------------------------------------------------------------- the room

func _room() -> void:
	var hd: float = bld.hd
	# THE FLOOR: eight by eight, each tile its own colour on the beat
	const N := 8
	const SQ := 2.2
	var q := BoxMesh.new()
	q.size = Vector3(SQ - 0.12, 0.06, SQ - 0.12)
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = true
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	q.material = m
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = q
	mm.instance_count = N * N
	for j in N:
		for i in N:
			mm.set_instance_transform(j * N + i, Transform3D(Basis(), Vector3((i - N / 2.0 + 0.5) * SQ, 0.09, 1.5 + (j - N / 2.0 + 0.5) * SQ)))
			mm.set_instance_color(j * N + i, Color(0.1, 0.05, 0.2))
	tiles = MultiMeshInstance3D.new()
	tiles.multimesh = mm
	add_child(tiles)
	# THE BOOTH, at the back, facing the floor
	bld.box(Vector3(7.0, 1.1, 2.0), Vector3(0, 0.55, -hd + 4.0), bld.mat("booth", Color("1a1230")), true)
	bld.box(Vector3(7.2, 0.08, 2.2), Vector3(0, 1.12, -hd + 4.0), bld.mat("booth_edge", Color("ff6ad5"), true))
	for sx in [-1.8, 1.8]:
		bld.cyl(0.55, 0.08, Vector3(sx, 1.2, -hd + 4.0), bld.mat("deck", Color("2a2a38")))
	bld.box(Vector3(9.0, 3.0, 0.3), Vector3(0, 2.5, -hd + 1.2), bld.mat("screen_wall", Color("ff6ad5").darkened(0.5), true))
	var sign := Label3D.new()
	sign.text = "THE LOOP"
	sign.font_size = 128
	sign.pixel_size = 0.02
	sign.outline_size = 18
	sign.modulate = Color("ff6ad5")
	sign.position = Vector3(0, 6.5, -hd + 1.0)
	add_child(sign)
	bld.usable(Vector3(0, 0, -hd + 6.0), "play the decks", func(w): w.hud.decks_open(self), 3.0)
	# the DJ, behind the decks
	var dj := Models.spawn("res://assets/characters/character-w.glb")
	add_child(dj)
	Models.use_vertex_colors(dj)
	Models.fit_height(dj, Walker.HEIGHT * 0.94)
	dj.position += Vector3(0, 0.1, -hd + 2.6)
	var ap := Models.anim_player(dj)
	if ap:
		Models.loop_clips(ap)
		ap.play("dance" if ap.has_animation("dance") else "idle")
	# BEAMS: four spots sweeping the floor from the ceiling
	var cols := [Color("ff6ad5"), Color("8ff0ff"), Color("ffe9a8"), Color("a8e6cf")]
	for i in 4:
		var s := SpotLight3D.new()
		s.light_color = cols[i]
		s.light_energy = 6.0
		s.spot_range = 22.0
		s.spot_angle = 14.0
		s.shadow_enabled = false
		s.position = Vector3((i - 1.5) * 5.0, bld.H - 1.5, 1.5)
		add_child(s)
		beams.append(s)
	var fill := OmniLight3D.new()
	fill.light_color = Color("7a4fd0")
	fill.light_energy = 1.2
	fill.omni_range = 30.0
	fill.position = Vector3(0, bld.H - 3.0, 0)
	add_child(fill)

## The whole roster, alternating, on the floor.
func _crowd() -> void:
	var ids := ["s", "t", "u", "v", "w"]
	for i in 10:
		var who := Models.spawn("res://assets/characters/character-%s.glb" % ids[i % ids.size()])
		add_child(who)
		Models.use_vertex_colors(who)
		Models.fit_height(who, Walker.HEIGHT * 0.94)
		var a := TAU * i / 10.0 + randf() * 0.3
		var r := 2.5 + randf() * 5.0
		who.position += Vector3(cos(a) * r, 0.1, 1.5 + sin(a) * r)
		who.rotation.y = randf() * TAU
		var ap := Models.anim_player(who)
		Models.loop_clips(ap)
		if ap:
			ap.play("idle")
			ap.seek(randf() * 2.0)
		dancers.append({"ap": ap, "node": who, "next": randf() * 3.0})

# ------------------------------------------------------------- the sound

func _audio() -> void:
	player = AudioStreamPlayer3D.new()
	player.position = Vector3(0, 3.0, -bld.hd + 4.0)
	player.unit_size = 14.0
	player.max_distance = 70.0
	player.volume_db = -2.0
	add_child(player)
	_render()

func step_secs() -> float:
	return 15.0 / bpm

## Mix the bar: every voice on every lit step, added in at its offset.
func _render() -> void:
	var per := int(step_secs() * Sound.RATE)
	var n := per * STEPS
	var mix := PackedFloat32Array()
	mix.resize(n)
	for ix in STEPS:
		var at := ix * per
		var hits := []
		if pat[0][ix]:
			hits.append(kit.kick)
		if pat[1][ix]:
			hits.append(kit.clap)
		if pat[2][ix]:
			hits.append(kit.hat)
		if pat[3][ix]:
			hits.append(kit["bass%d" % LINE[ix % LINE.size()]])
		for h in hits:
			var d: PackedFloat32Array = h
			for i in d.size():
				var j := (at + i) % n
				mix[j] += d[i]
	for i in n:
		mix[i] = clampf(mix[i] * 0.8, -1.0, 1.0)
	var pos := player.get_playback_position() if player.playing else 0.0
	var was := bar.get_length() if bar else 0.0
	bar = Sound._wav(mix, true)
	player.stream = bar
	# keep your place in the bar across a change, measured in steps
	var steps_in := fposmod(pos / maxf(0.001, was) * STEPS, STEPS) if was > 0.0 else 0.0
	player.play(steps_in * step_secs())

func toggle(track: int, s: int) -> void:
	pat[track][s] = 0 if pat[track][s] else 1
	_render()

func clear() -> void:
	for r in pat:
		for i in STEPS:
			r[i] = 0
	_render()

func reset() -> void:
	pat = OPENING.map(func(r): return (r as Array).duplicate())
	_render()

func set_bpm(v: float) -> void:
	bpm = clampf(v, 88.0, 160.0)
	_render()

func drop() -> void:
	drop_t = 2.0

## How much is going on: the share of the grid that is lit, weighted the way
## a floor feels it — the kick most, the hats least.
func density() -> float:
	var w := [0.42, 0.22, 0.12, 0.24]
	var d := 0.0
	for r in 4:
		var on := 0
		for i in STEPS:
			on += int(pat[r][i])
		d += w[r] * minf(1.0, on / 6.0)
	return d

func _process(delta: float) -> void:
	t += delta
	if player.playing:
		step = int(player.get_playback_position() / step_secs()) % STEPS
		if step != _last_step:
			_last_step = step
			if step % 4 == 0:
				beat_flash = 1.0
	energy += (density() - energy) * minf(1.0, delta * 1.5)
	beat_flash = maxf(0.0, beat_flash - delta * 3.0)
	drop_t = maxf(0.0, drop_t - delta)
	var punch := beat_flash + (0.8 if drop_t > 0.0 else 0.0)
	# the floor: each tile a colour, bright on the beat, brighter the busier
	var mm := tiles.multimesh
	for i in mm.instance_count:
		var c: Color = TRACKS[(i + step) % 4][1]
		var k := 0.28 + punch * 0.55 * (0.4 + energy) + (0.4 if (i * 7 + step) % 11 == 0 else 0.0) * (0.3 + energy)
		mm.set_instance_color(i, c * clampf(k, 0.05, 1.0))
	# the beams sweep, faster when the room is busy
	for i in beams.size():
		var s: SpotLight3D = beams[i]
		var a := t * (0.6 + energy) + i * 1.7
		s.rotation = Vector3(-PI / 2.0 + sin(a) * 0.45, 0.0, cos(a * 1.3) * 0.45)
		s.light_energy = 3.0 + punch * 6.0
	# the crowd: idle on an empty grid, dancing on a busy one
	for d in dancers:
		d.next -= delta
		if d.next > 0.0 or d.ap == null:
			continue
		d.next = 2.0 + randf() * 3.0
		var ap: AnimationPlayer = d.ap
		var want := "idle"
		if energy > 0.25:
			want = "dance"
		if energy > 0.5 and randf() < 0.4 and ap.has_animation("salsa"):
			want = "salsa"
		if drop_t > 0.0 and ap.has_animation("flip"):
			want = "flip"
		if ap.has_animation(want) and ap.current_animation != want:
			ap.play(want, 0.3)
