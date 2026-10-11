## TSH — ROBIN RYU, in Godot. The browser game (public/tsh*.js) is the source of truth; this is it ported, beat by
## beat (koro-godot/TSH_PORT.md). The city, the flat, the school and the station are the browser's own, exported
## from the running game (tools/tsh_export); Robin moves on the shoes (boots.gd = boots.js); a scene is a list of
## shots (the browser's playReel), its words are the browser's LINES with their recorded voices.
##
##   godot --path koro-godot res://scenes/tsh.tscn                 the story, from where the save is
##   godot --path koro-godot res://scenes/tsh.tscn -- new           from the start
##   godot --path koro-godot res://scenes/tsh.tscn -- shots <dir>   photographs the opening and the lesson, and quits
##
## Keys as in the browser: WASD (relative to the camera) · SPACE the shoes (hold: roof to roof) · SHIFT sprint/dive ·
## mouse looks · ENTER skips a scene / a lesson step · SPACE moves a line on · V the Spider-Verse look · Esc frees the mouse
extends Node3D

const EYE := 1.7
const SILL := Vector3(59.95, 9.0, 34)
const HOME_ROOF := Vector3(66, 12, 34)
const WHO := {"robin": ["ROBIN", "#ffd9a8"], "kai": ["KAI", "#ff8a6a"], "dealer": ["THE BUYER", "#ffb347"], "thug": ["THUG", "#c9c2b8"],
	"unknown": ["UNKNOWN NUMBER", "#9fb4c0"], "maya": ["MAYA", "#d0b4ff"], "mom": ["THE DIRECTOR", "#9fd8ff"], "counselor": ["COUNSELOR — VOICEMAIL", "#b8c4c0"],
	"wfc": ["WFC", "#8ff0ff"], "vendor": ["VENDOR", "#ffd070"], "buyer": ["UNKNOWN NUMBER", "#ff8a6a"], "momcall": ["MOM", "#9fd8ff"], "momhome": ["MOM", "#9fd8ff"],
	"momroom": ["THE DIRECTOR", "#c8d4e8"], "reporter": ["CH 6 · LIVE", "#ff8a8a"], "canon": ["CANON", "#a8f0b8"], "drone": ["WFC DRONE", "#ff6a5a"],
	"teacher": ["TEACHER", "#ffe08a"], "guard": ["SECURITY GUARD", "#a8c8ff"], "pa": ["PA SYSTEM", "#c8d4dc"]}
## the story's beats (public/tshai.js QUEST): what each is for, and where each outcome leads
const QUEST := {
	"intro": {"goal": "Sell the rings to the buyer. Get paid.", "to": {"start": "wake"}},
	"wake": {"goal": "", "to": {"out": "lesson"}},
	"lesson": {"goal": "Get to Dragon Alley — over the roofs.", "to": {"done": "deal"}},
	"deal": {"goal": "Meet the buyer in Dragon Alley. Get paid.", "to": {"fought": "raid", "confiscated": "raid"}},
	"raid": {"goal": "Get out of Dragon Alley.", "to": {"home": "night"}},
	"night": {"goal": "", "to": {"slept": "end"}},
	"end": {"goal": "", "to": {}}}
const LESSON := [
	{"id": "fire", "title": "THE SHOES", "how": "SPACE — fire them."},
	{"id": "bound", "title": "HOLD SPACE", "how": "Hold SPACE. The shoes pick the roof you are facing — the ring — and take you there.", "teach": ["bound", "jump", "steer"]},
	{"id": "chain", "title": "KEEP HOLDING", "how": "Keep it held: every landing springs into the next. Three roofs in a row."},
	{"id": "steer", "title": "POINT", "how": "Look where you want to go — the mouse, or A and D, even in the air. North, over Neon Avenue."},
	{"id": "rhythm", "title": "THE RHYTHM", "how": "Tap SPACE as her feet touch, when the ring goes gold. Perfect bounds go quicker and further. Two in a row."},
	{"id": "alley", "title": "DRAGON ALLEY", "how": "The buyer is in Dragon Alley. Get there."}]

var S := {}
var city: Node3D; var apt: Node3D; var school: Node3D; var sub: Node3D
var nav := {}; var room := {}; var lines := {}; var voice := {}
var inside := false
var boots: Boots
var robin: Node3D; var model: Node3D; var anim: AnimationPlayer; var clip := ""
var cam: Camera3D; var cam_yaw := 0.0; var cam_pitch := -0.2; var cam_p := Vector3.ZERO
var verse_mat: ShaderMaterial
var env: Environment
var lamp: OmniLight3D
var mode := ""                  # "" play · "reel" a scene
var reel = null
var staged = null               # {clip, pos, ry}
var talk_q: Array = []
var lesson := {"i": 0, "perfect": 0, "lands": 0}
var space_was := false
var shots_dir := ""
var ring: MeshInstance3D
var marker: MeshInstance3D

# HUD
var hud: CanvasLayer; var sub_label: RichTextLabel; var obj_label: RichTextLabel; var note_label: Label; var card: PanelContainer
var card_text: RichTextLabel; var caption: Label; var black_rect: ColorRect; var phone: PanelContainer; var phone_text: RichTextLabel
var note_t := 0.0; var caption_t := 0.0
var voice_player: AudioStreamPlayer; var sfx_players: Array = []; var music: AudioStreamPlayer

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() >= 2 and args[0] == "shots": shots_dir = args[1]
	_load_data()
	_world()
	_robin()
	_camera()
	_hud()
	_audio()
	if args.has("new") or shots_dir != "": S = _fresh()
	else: _load()
	_enter()
	if shots_dir != "": _shots()
	else: Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

# ================================================================== the save
func _fresh() -> Dictionary:
	return {"v": 1, "step": "intro", "lesson": 0, "seen": [], "boots": [], "cash": 0, "flash": 3}
func _save() -> void:
	var f := FileAccess.open("user://tsh.json", FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(S))
func _load() -> void:
	S = _fresh()
	if FileAccess.file_exists("user://tsh.json"):
		var d = JSON.parse_string(FileAccess.get_file_as_string("user://tsh.json"))
		if d is Dictionary: S.merge(d, true)
func outcome(what: String) -> void:
	var q: Dictionary = QUEST.get(S.step, {})
	var nxt = q.get("to", {}).get(what)
	if nxt == null: return
	S.step = nxt; _save(); _beat_start()

# ================================================================== the world
func _json(p: String):
	return JSON.parse_string(FileAccess.get_file_as_string(p))
func _load_data() -> void:
	nav = _json("res://assets/tsh/city_nav.json")
	room = _json("res://assets/tsh/apt.json")
	var L = _json("res://assets/tsh/lines.json")
	lines = L.lines; voice = L.voice

func _world() -> void:
	var lj = _json("res://assets/tsh/lights.json")
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color("#" + str(lj.env.bg))
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.32, 0.5, 0.52); env.ambient_light_energy = 0.2
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = float(lj.env.exposure)
	env.fog_enabled = true; env.fog_light_color = Color("#" + str(lj.env.fog.c)); env.fog_density = float(lj.env.fog.density)*1.6
	env.glow_enabled = true; env.glow_intensity = 0.6; env.glow_bloom = 0.05; env.glow_hdr_threshold = 1.1
	env.ssao_enabled = true; env.ssr_enabled = true; env.ssr_max_steps = 48
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	for l in lj.lights:
		if not l.vis: continue
		var col := Color("#" + str(l.c)); var p := Vector3(l.p[0], l.p[1], l.p[2])
		match str(l.type):
			"DirectionalLight":
				var d := DirectionalLight3D.new(); d.light_color = col; d.light_energy = float(l.i)*0.45; d.shadow_enabled = bool(l.shadow); add_child(d)
				var tg := Vector3(l.t[0], l.t[1], l.t[2]) if l.t != null else Vector3.ZERO
				d.look_at_from_position(p, tg if tg != p else p + Vector3(0, -1, 0.01))
			"PointLight":
				var o := OmniLight3D.new(); o.light_color = col; o.light_energy = float(l.i)*0.07; o.omni_range = float(l.d) if float(l.d) > 0 else 20.0; o.position = p; add_child(o)
			"HemisphereLight":
				env.ambient_light_color = col.lerp(Color("#" + str(l.g)), 0.5); env.ambient_light_energy = float(l.i)*0.18
	city = _scene("res://assets/tsh/city.glb")
	apt = _scene("res://assets/tsh/apt.glb")
	school = _scene("res://assets/tsh/school.glb")
	sub = _scene("res://assets/tsh/sub.glb")
	# the lamp by her bed (the browser's aptLights)
	var a: Dictionary = room.apt
	lamp = OmniLight3D.new(); lamp.light_color = Color(1.0, 0.82, 0.6); lamp.light_energy = 0.0; lamp.omni_range = 9
	lamp.position = Vector3(room.room.bed.x + 0.6, 2.2, room.room.bed.z - 1.0); add_child(lamp)
	var ceil := OmniLight3D.new(); ceil.name = "AptFill"; ceil.light_color = Color(0.7, 0.85, 0.9); ceil.light_energy = 0.0; ceil.omni_range = 12
	ceil.position = Vector3(a.x, 2.8, a.z); add_child(ceil)
	# a soft light that follows her, so she reads against the night (the browser's charLook rim)
	var key := OmniLight3D.new(); key.name = "Key"; key.light_color = Color(1.0, 0.86, 0.74); key.light_energy = 1.3; key.omni_range = 5.0; add_child(key)
	show_inside(false)
	# the shoes' world: every solid, floor and roof
	boots = Boots.new()
	var city_d = _json("res://assets/tsh/city.json")
	for s in city_d.solids: boots.solids.append([s[0], s[1], s[2], s[3], s[4], s[5]])
	for f in ["res://assets/tsh/school.json", "res://assets/tsh/sub.json"]:
		var d2 = _json(f)
		for s in d2.get("solids", []):
			if s.get("off", false): continue
			boots.solids.append([s.x1, s.x2, s.z1, s.z2, s.get("y1", -1.0), s.get("y2", 60.0)])
	boots.plats = nav.plats
	for r in nav.roofs: boots.roofs.append({"id": r[0], "x1": r[1], "x2": r[2], "z1": r[3], "z2": r[4], "top": r[5]})
	# the bound's ring, and the objective's marker
	ring = MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.9; tm.outer_radius = 1.05; ring.mesh = tm
	var rm := StandardMaterial3D.new(); rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; rm.albedo_color = Color(0.4, 1.0, 0.95); rm.emission_enabled = true; rm.emission = Color(0.4, 1, 0.95); rm.emission_energy_multiplier = 3
	ring.material_override = rm; ring.visible = false; add_child(ring)
	marker = MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.25; cm.bottom_radius = 0.25; cm.height = 60; marker.mesh = cm
	var mm := StandardMaterial3D.new(); mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mm.albedo_color = Color(1, 0.75, 0.3, 0.35); mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	marker.material_override = mm; marker.visible = false; add_child(marker)

func _scene(p: String) -> Node3D:
	var n: Node3D = (load(p) as PackedScene).instantiate(); add_child(n); return n

func show_inside(v: bool) -> void:
	inside = v
	city.visible = not v
	apt.visible = v
	school.visible = false; sub.visible = false
	env.fog_density = 0.004 if v else 0.0248
	env.background_color = Color(0.008, 0.016, 0.016) if v else Color("#0b2a26")
	($AptFill as OmniLight3D).light_energy = 0.35 if v else 0.0

# ================================================================== Robin
func _robin() -> void:
	robin = Node3D.new(); add_child(robin)
	model = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); robin.add_child(model)
	anim = _find(model, func(n): return n is AnimationPlayer)
	for nm in anim.get_animation_list():
		if nm in ["jump", "flip", "roll", "climb_top", "wake", "kneel", "text"]: continue
		anim.get_animation(nm).loop_mode = Animation.LOOP_LINEAR

func _find(n: Node, f: Callable) -> Node:
	if f.call(n): return n
	for c in n.get_children():
		var r := _find(c, f)
		if r: return r
	return null

func play(nm: String, blend := 0.2) -> void:
	if nm == clip or not anim.has_animation(nm): return
	clip = nm; anim.play(nm, blend)

## her kit, piece by piece: the jacket, the gloves, the shoes (the meshes the browser's wardrobe put on her)
const KIT_MESH := {"jacket": "worn:tech-jacket", "gloves": "worn:gecko-cuffs", "shoes": "worn:skyline-shoes"}
func kit(piece: String, on: bool) -> void:
	var n := _find(model, func(x): return x is MeshInstance3D and x.name == KIT_MESH.get(piece, "?"))
	if n: n.visible = on
func kit_all(on: bool) -> void:
	for p in KIT_MESH: kit(p, on)

## Robin where the shot needs her: a clip, a place, a heading
func stage(nm: String, x: float, y: float, z: float, ry: float) -> void:
	staged = {"clip": nm, "pos": Vector3(x, y, z), "ry": ry}
	robin.position = staged.pos; model.rotation.y = ry; play(nm, 0.15)

func place(p: Vector3, yaw: float) -> void:
	boots.x = p.x; boots.y = p.y; boots.z = p.z; boots.vx = 0; boots.vy = 0; boots.vz = 0
	boots.ground = p.y <= boots.floor_at(p.x, p.z, p.y) + 0.05; boots.state = "ground" if boots.ground else "air"
	cam_yaw = yaw; robin.position = p; cam_p = Vector3.ZERO

# ================================================================== the lens
func _camera() -> void:
	cam = Camera3D.new(); cam.fov = 70; cam.near = 0.08; cam.far = 900; add_child(cam); cam.current = true
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(2, 2); q.mesh = qm
	q.extra_cull_margin = 16384; q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	verse_mat = ShaderMaterial.new(); verse_mat.shader = load("res://shaders/tsh_verse.gdshader"); verse_mat.render_priority = 100
	q.material_override = verse_mat; cam.add_child(q); q.position = Vector3(0, 0, -0.5)

## play: behind her and above, further back and wider the faster she goes (boots.js camera)
func _play_camera(dt: float) -> void:
	var sp := minf(1.0, boots.speed()/30.0)
	var dist := lerpf(6.2, 9.5, sp); cam.fov = lerpf(cam.fov, lerpf(70, 90, sp), minf(1, dt*3))
	var head := robin.position + Vector3(0, 1.4, 0)
	var back := Vector3(sin(cam_yaw), 0, cos(cam_yaw))
	var want := head + back*dist*cos(cam_pitch) + Vector3(0, 2.3 - 1.4 - sin(cam_pitch)*dist*0.6, 0)
	if inside: want = head + back*2.4 + Vector3(0, 0.4, 0)
	cam_p = want if cam_p == Vector3.ZERO else cam_p.lerp(want, minf(1, dt*6))
	cam.global_position = cam_p
	cam.look_at(head + Vector3(0, sin(cam_pitch)*2, 0) - back*2.0)

# ================================================================== the HUD
func _hud() -> void:
	hud = CanvasLayer.new(); add_child(hud)
	black_rect = ColorRect.new(); black_rect.color = Color.BLACK; black_rect.set_anchors_preset(Control.PRESET_FULL_RECT); black_rect.visible = false; hud.add_child(black_rect)
	obj_label = _rich(Vector2(24, 20), Vector2(560, 120), 18)
	sub_label = _rich(Vector2(0, 0), Vector2(900, 120), 24); sub_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	sub_label.position = Vector2(-450, -150); sub_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note_label = Label.new(); note_label.set_anchors_preset(Control.PRESET_CENTER_TOP); note_label.position = Vector2(-300, 90); note_label.size = Vector2(600, 40)
	note_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; note_label.add_theme_font_size_override("font_size", 20); hud.add_child(note_label)
	caption = Label.new(); caption.position = Vector2(24, 0); caption.set_anchors_preset(Control.PRESET_BOTTOM_LEFT); caption.position = Vector2(24, -60)
	caption.add_theme_font_size_override("font_size", 16); caption.modulate = Color(1, 1, 1, 0.8); hud.add_child(caption)
	card = PanelContainer.new(); card.set_anchors_preset(Control.PRESET_CENTER_TOP); card.position = Vector2(-260, 130); card.custom_minimum_size = Vector2(520, 0)
	card_text = _rich(Vector2.ZERO, Vector2(520, 110), 18, card); card.visible = false; hud.add_child(card)
	phone = PanelContainer.new(); phone.set_anchors_preset(Control.PRESET_CENTER_RIGHT); phone.position = Vector2(-330, -200); phone.custom_minimum_size = Vector2(260, 400)
	phone_text = _rich(Vector2.ZERO, Vector2(260, 400), 22, phone); phone.visible = false; hud.add_child(phone)

func _rich(p: Vector2, s: Vector2, fs: int, parent: Node = null) -> RichTextLabel:
	var r := RichTextLabel.new(); r.bbcode_enabled = true; r.fit_content = true; r.position = p; r.size = s; r.custom_minimum_size = s
	r.add_theme_font_size_override("normal_font_size", fs); r.add_theme_font_size_override("bold_font_size", fs)
	r.add_theme_constant_override("outline_size", 6); r.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	(parent if parent else hud).add_child(r); return r

func note(text: String) -> void:
	note_label.text = text; note_t = 4.0
func set_caption(text: String) -> void:
	caption.text = text; caption_t = 4.0
func objective(title: String, how: Array = []) -> void:
	obj_label.text = "" if title == "" else "[b]" + title + "[/b]" + ("\n[color=#9fb4c0]" + "\n".join(how) + "[/color]" if how.size() else "")
func phone_show(kind: String, who := "") -> void:
	phone.visible = kind != ""
	match kind:
		"call": phone_text.text = "[center]\n\n[color=#9fb4c0]incoming call[/color]\n[b]%s[/b]\nmobile\n\n\n\n[color=#ff5a5a]✕[/color]      [color=#5aff8a]✆[/color][/center]" % who
		"oncall": phone_text.text = "[center]\n\n[color=#9fb4c0]00:04[/color]\n[b]%s[/b]\non call\n\n\n\n[color=#ff5a5a]✕[/color][/center]" % who

# ================================================================== sound
func _audio() -> void:
	voice_player = AudioStreamPlayer.new(); add_child(voice_player)
	music = AudioStreamPlayer.new(); music.volume_db = -8; add_child(music)
	for i in 6: var p := AudioStreamPlayer.new(); add_child(p); sfx_players.append(p)
func cue(kind: String) -> void:
	var files := []
	for i in 6:
		var f := "res://assets/tsh/sfx/%s-%d.mp3" % [kind, i]
		if ResourceLoader.exists(f): files.append(f)
	if files.is_empty(): return
	for p in sfx_players:
		if not p.playing: p.stream = load(files.pick_random()); p.play(); return
func score(track: String, vol := -8.0) -> void:
	var f := "res://assets/tsh/music/%s.mp3" % track
	if not ResourceLoader.exists(f): return
	music.stream = load(f); music.volume_db = vol; music.play()

# ================================================================== the words
static func vkey(who: String, text: String) -> String:
	var h := 0x811c9dc5
	var s := (who + "|" + text).to_utf16_buffer()
	for i in range(0, s.size(), 2):
		h = h ^ (s[i] | (s[i + 1] << 8))
		h = (h*0x01000193) & 0xffffffff
	return "%08x" % h
func line_len(who: String, text: String) -> float:
	var k := vkey(who, text)
	return float(voice[k]) if voice.has(k) else 1.0 + text.length()*0.052
func lines_len(key: String) -> float:
	var t := 0.0
	for l in lines.get(key, []): t += maxf(1.4, line_len(l[0], l[1]) + 0.45)
	return t
## a key of LINES (or a list of [who, text]) said in turn, each line as long as its recording
func talk(key, done: Callable = Callable()) -> void:
	var ls: Array = key if key is Array else lines.get(key, [])
	talk_q.append({"lines": ls, "i": -1, "t": 0.0, "done": done})
func _tick_talk(dt: float) -> void:
	if talk_q.is_empty(): sub_label.text = ""; return
	var q = talk_q[0]
	q.t -= dt
	if q.t > 0: return
	q.i += 1
	if q.i >= q.lines.size():
		talk_q.pop_front(); sub_label.text = ""
		if q.done.is_valid(): q.done.call()
		return
	var who: String = q.lines[q.i][0]; var text: String = q.lines[q.i][1]
	var k := vkey(who, text)
	q.t = maxf(1.4, float(voice[k]) + 0.45) if voice.has(k) else maxf(1.8, 1.0 + text.length()*0.052)
	var w: Array = WHO.get(who, [who.to_upper(), "#ffffff"])
	sub_label.text = "[center][b][color=%s]%s[/color][/b]\n%s[/center]" % [w[1], w[0], text]
	if voice.has(k):
		var f := "res://assets/tsh/voice/%s.mp3" % k
		if ResourceLoader.exists(f): voice_player.stream = load(f); voice_player.play()
func skip_line() -> void:
	if talk_q.size(): talk_q[0].t = 0; voice_player.stop()

# ================================================================== scenes: a list of shots
## A shot: {dur, fov, cam, look, enter, tick(dt, t, k), beats: [[t, fn]], inside, ease}. cam and look are a point,
## a [from, to] pair it moves between, or a Callable of the shot's progress (the browser's playReel).
func play_reel(shots: Array, done: Callable) -> void:
	mode = "reel"; reel = {"shots": shots, "i": -1, "t": 0.0, "shot": null, "done": done, "fired": {}}
	_reel_next()
func _reel_next() -> void:
	var f = reel
	var over := 0.0
	if f.shot != null: over = maxf(0.0, f.t - f.shot.dur)
	f.i += 1
	if f.i >= f.shots.size(): _reel_end(false); return
	f.shot = f.shots[f.i]; f.t = over; f.fired = {}
	if f.shot.has("inside"): show_inside(f.shot.inside)
	if f.shot.has("enter"): f.shot.enter.call()
	cam.fov = f.shot.get("fov", 50)
	_reel_cam()
func _reel_end(skipped: bool) -> void:
	var d: Callable = reel.done
	reel = null; mode = ""; staged = null; talk_q.clear(); sub_label.text = ""; voice_player.stop()
	d.call(skipped)
func _at(v, k: float, t: float) -> Vector3:
	if v is Callable: return v.call(k, t)
	if v is Array and v.size() == 2 and v[0] is Vector3: return (v[0] as Vector3).lerp(v[1], k)
	return v
func _reel_cam() -> void:
	var f = reel; var s = f.shot
	var k := minf(1.0, f.t/s.dur)
	var e := k if s.get("ease", true) == false else k*k*(3 - 2*k)
	var c := _at(s.cam, e, f.t); var l := _at(s.look, e, f.t)
	var br := 0.012 + 0.0006*cam.fov; var tt := Time.get_ticks_msec()/1000.0
	cam.global_position = c + Vector3(sin(tt*0.9)*br + sin(tt*2.3)*br*0.35, sin(tt*1.3 + 1)*br*0.8, cos(tt*0.7)*br)
	if (l - cam.global_position).length() > 0.001: cam.look_at(l)
func _tick_reel(dt: float) -> void:
	var f = reel; var s = f.shot
	f.t += dt
	var bs: Array = s.get("beats", [])
	for j in bs.size():
		if f.t >= bs[j][0] and not f.fired.has(j): f.fired[j] = true; bs[j][1].call()
	if reel != f: return
	if s.has("tick"): s.tick.call(dt, f.t, minf(1.0, f.t/s.dur))
	if staged != null: robin.position = staged.pos; model.rotation.y = staged.ry
	_reel_cam()
	if f.t >= s.dur: _reel_next()
func rel(x: float, z: float, ry: float, d: float, s_: float, y: float) -> Vector3:
	return Vector3(x + sin(ry)*d - cos(ry)*s_, y, z + cos(ry)*d + sin(ry)*s_)
func walk_stage(a: Vector2, b: Vector2, k: float) -> void:
	stage("walk", lerpf(a.x, b.x, k), 0, lerpf(a.y, b.y, k), atan2(b.x - a.x, b.y - a.y))
func black(v: bool) -> void: black_rect.visible = v
func _v(a) -> Vector3: return Vector3(a[0], a[1], a[2])

# ================================================================== the beats
func _enter() -> void:
	if S.step == "intro": S.step = "wake"
	match S.step:
		"wake": opening()
		"lesson":
			kit_all(true); show_inside(false); place(HOME_ROOF, PI/2); lesson_begin(true)
		_:
			kit_all(true); show_inside(false); place(Vector3(-86, 0, 8), -PI/2); _beat_start()

func _beat_start() -> void:
	var q: Dictionary = QUEST.get(S.step, {})
	objective(q.get("goal", ""))
	marker.visible = false
	match S.step:
		"deal":
			var a: Dictionary = nav.zones.alley
			marker.position = Vector3((a.x1 + a.x2)/2, 30, (a.z1 + a.z2)/2); marker.visible = true
		"raid":
			note("(The fight with the buyer and the WFC raid are the next part of the port.)")

## INT. ROBIN'S ROOM — 22:15. The buyer calls; she gets up; the kit, piece by piece; the note from her mother; the
## window, the sill over Kiln Street, and the jump (tsh.js opening())
func opening() -> void:
	var R: Dictionary = room.room; var a: Dictionary = room.apt; var bed: Dictionary = R.bed
	var cx: float = (a.x1 + a.x2)/2; var cz: float = (a.z1 + a.z2)/2
	show_inside(true); lamp.light_energy = 0; kit_all(false)
	var sit_up := func(): stage("wake", bed.x - 0.15, bed.seat, bed.z - 0.05, PI/2)
	var shoe := _v(R.boots.at); var form := _v(R.form.at); var pack := _v(R.pack.at); var kitc := _v(R.kitchen.at); var notep := _v(R.note.at)
	var mom := _v(R.momDoor.at); var win := _v(R.window.at); var bench := _v(R.bench.at); var P := _v(R.packing.at)
	var stop := Vector2(cx + 2.4, cz + 0.9); var at_table := Vector2(kitc.x - 0.3, kitc.z + 0.95)
	var J := Vector2(form.x + 0.75, form.z + 0.6); var jry := atan2(0.75, 0.6)
	var GL := Vector2(bench.x + 0.85, bench.z + 1.3); var gry := atan2(1, 0.55)
	var BR := Vector2(shoe.x + 0.7, shoe.z - 0.4); var bry := PI/2
	var face_table := atan2(kitc.x - at_table.x, kitc.z - at_table.y); var face_mom := atan2(mom.x - at_table.x, mom.z - at_table.y)
	black(true); score("wos-a", -14)
	var shots := [
		{"dur": 9.0, "fov": 40, "inside": true, "cam": Vector3(bed.x + 1.5, 1.6, bed.z - 1), "look": Vector3(bed.x, 0.8, bed.z),
			"enter": func(): sit_up.call(); get_tree().create_timer(0.6).timeout.connect(func(): if reel: phone_show("call", "UNKNOWN")),
			"beats": [[3.2, func(): cue("ui"); phone_show("oncall", "UNKNOWN")], [3.7, func(): talk("call")], [8.1, func(): cue("hangup"); phone_show("")]]},
		{"dur": 5.2, "fov": 50, "cam": [Vector3(a.x2 - 0.5, 2.5, a.z2 - 0.7), Vector3(a.x2 - 1.5, 2.2, a.z2 - 1.3)], "look": [Vector3(bed.x, 0.9, bed.z), Vector3(bed.x - 0.6, 0.9, bed.z - 0.4)],
			"enter": func(): sit_up.call(); lamp.light_energy = 1.6; cue("ui"); get_tree().create_timer(0.25).timeout.connect(func(): black(false)); set_caption("INT. ROBIN'S ROOM — 22:15")},
		{"dur": 4.2, "fov": 42, "cam": [Vector3(bench.x + 0.9, 1.75, bench.z + 1.75), Vector3(bench.x - 0.9, 1.7, bench.z + 1.65)], "look": [Vector3(bench.x + 0.4, 0.98, bench.z - 0.05), Vector3(bench.x - 1.3, 0.98, bench.z - 0.05)]},
		{"dur": 3.6, "fov": 40, "cam": [Vector3(form.x + 2.0, 1.55, form.z + 1.4), Vector3(form.x + 1.5, 1.5, form.z + 1.0)], "look": [Vector3(form.x - 0.2, 1.4, form.z - 0.2), Vector3(form.x - 0.3, 1.45, form.z - 0.3)]},
		{"dur": 4.0, "fov": 44, "cam": [Vector3(P.x - 1.45, 1.95, P.z + 1.3), Vector3(P.x - 1.35, 1.8, P.z - 1.0)], "look": [Vector3(P.x, 0.85, P.z + 0.35), Vector3(P.x, 0.85, P.z - 0.6)]},
		{"dur": 3.0, "fov": 34, "cam": [Vector3(shoe.x + 1.1, 0.42, shoe.z - 0.7), Vector3(shoe.x + 0.85, 0.32, shoe.z - 0.45)], "look": Vector3(shoe.x, 0.12, shoe.z)},
		{"dur": 3.0, "fov": 44, "cam": [Vector3(bed.x + 1.7, 1.55, bed.z - 2.4), Vector3(bed.x + 1.4, 1.6, bed.z - 2.1)], "look": Vector3(bed.x + 0.6, 1.25, bed.z - 1.0),
			"enter": func(): stage("idle", bed.x + 0.6, 0, bed.z - 1.15, PI)},
		# the jacket, off the form
		{"dur": 3.2, "fov": 42, "cam": [Vector3(form.x + 1.9, 1.6, form.z + 1.6), Vector3(form.x + 1.6, 1.55, form.z + 1.3)], "look": Vector3(form.x + 0.3, 1.3, form.z + 0.3),
			"enter": func(): stage("idle", J.x, 0, J.y, jry + PI), "beats": [[1.3, func(): kit("jacket", true); cue("gear")]]},
		{"dur": 2.2, "fov": 34, "cam": rel(J.x, J.y, jry, 0.95, 0.25, 1.4), "look": rel(J.x, J.y, jry, 0, 0, 1.2), "enter": func(): stage("idle", J.x, 0, J.y, jry), "beats": [[0.3, func(): cue("gear")]]},
		# the gloves, at the bench
		{"dur": 2.8, "fov": 34, "cam": rel(GL.x, GL.y, gry, 0.95, -0.2, 1.4), "look": rel(GL.x, GL.y, gry, 0.3, 0, 1.1),
			"enter": func(): stage("text", GL.x, 0, GL.y, gry), "beats": [[0.9, func(): kit("gloves", true); cue("gear")]]},
		# the shoes: down on one knee by the window
		{"dur": 3.2, "fov": 38, "cam": [Vector3(shoe.x + 1.5, 0.6, shoe.z - 1.1), Vector3(shoe.x + 1.2, 0.5, shoe.z - 0.8)], "look": Vector3(shoe.x + 0.2, 0.3, shoe.z),
			"enter": func(): stage("kneel", shoe.x + 0.35, 0, shoe.z, -PI/2), "beats": [[1.5, func(): kit("shoes", true); cue("launch")]]},
		# the bracelet
		{"dur": 2.6, "fov": 30, "cam": rel(BR.x, BR.y, bry, 0.75, 0.35, 1.3), "look": rel(BR.x, BR.y, bry, 0.3, 0.15, 1.1),
			"enter": func(): stage("text", BR.x, 0, BR.y, bry), "beats": [[0.8, func(): cue("gear")]]},
		# the backpack, and the door
		{"dur": 3.0, "fov": 46, "cam": [Vector3(pack.x + 1.2, 1.5, pack.z - 2.2), Vector3(stop.x - 0.6, 1.55, stop.y - 2.0)], "look": func(k, t): return robin.position + Vector3(0, 1.1, 0),
			"enter": func(): cue("pick"), "tick": func(dt, t, k): walk_stage(Vector2(pack.x - 0.2, pack.z - 0.5), stop, minf(1, k*1.05))},
		{"dur": 2.0, "fov": 40, "cam": Vector3(stop.x + 1.3, 1.5, stop.y + 1.4), "look": Vector3(stop.x, 1.4, stop.y),
			"enter": func(): stage("idle", stop.x, 0, stop.y, atan2(kitc.x - stop.x, kitc.z - stop.y))},
		# the kitchen: dinner on the table, still covered, and a note
		{"dur": 3.4, "fov": 34, "cam": [Vector3(kitc.x + 0.9, 1.35, kitc.z + 1.2), Vector3(kitc.x + 0.55, 1.2, kitc.z + 0.8)], "look": Vector3(kitc.x, 0.8, kitc.z),
			"enter": func(): stage("idle", at_table.x, 0, at_table.y, face_table)},
		{"dur": 2.6, "fov": 34, "cam": Vector3(kitc.x + 0.25, 1.4, kitc.z - 0.35), "look": Vector3(at_table.x, 1.45, at_table.y)},
		{"dur": 3.0, "fov": 24, "cam": Vector3(notep.x - 0.05, notep.y + 0.55, notep.z + 0.28), "look": notep, "ease": false},
		{"dur": 2.8, "fov": 40, "cam": Vector3(at_table.x + 0.45, 1.65, at_table.y + 0.8), "look": Vector3(mom.x, 1.2, mom.z), "enter": func(): stage("idle", at_table.x, 0, at_table.y, face_mom)},
		{"dur": 3.6, "fov": 40, "cam": rel(at_table.x, at_table.y, face_table, 0.85, 0.15, 1.5), "look": rel(at_table.x, at_table.y, face_table, 0.15, 0, 1.3),
			"enter": func(): stage("text", at_table.x, 0, at_table.y, face_table)},
		{"dur": 2.2, "fov": 32, "cam": Vector3(kitc.x + 0.6, 1.25, kitc.z + 0.55), "look": Vector3(notep.x, 0.8, notep.z), "enter": func(): stage("idle", at_table.x, 0, at_table.y, face_table)},
		# THE WINDOW. The city comes in.
		{"dur": 3.2, "fov": 44, "cam": Vector3(win.x + 2.4, 1.6, win.z - 1.2), "look": Vector3(win.x, 1.5, win.z),
			"enter": func(): score("wos-b", -8),
			"tick": func(dt, t, k): _to_window(win, k),
			"beats": [[1.7, func(): cue("door")]]},
		{"dur": 2.4, "fov": 40, "cam": Vector3(win.x + 2.2, 0.6, win.z + 0.6), "look": Vector3(win.x + 0.2, 1.6, win.z), "enter": func(): stage("kneel", win.x + 0.32, 1.0, win.z, -PI/2)},
		# OUTSIDE: on the sill, over Kiln Street
		{"dur": 3.0, "fov": 42, "inside": false, "cam": [Vector3(55.3, 13.4, 30.8), Vector3(55.5, 13.1, 31.5)], "look": Vector3(SILL.x - 0.2, SILL.y + 0.5, SILL.z),
			"enter": func(): stage("idle", SILL.x, SILL.y, SILL.z, -PI/2); set_caption("EXT. KILN STREET — 22:17")},
		{"dur": 2.2, "fov": 36, "cam": Vector3(SILL.x - 1.7, SILL.y + 1.65, SILL.z + 0.45), "look": Vector3(SILL.x, SILL.y + 1.5, SILL.z)},
		{"dur": 0.8, "fov": 56, "cam": Vector3(56.8, 6.6, 37.6), "look": func(k, t): return robin.position + Vector3(0, 1, 0),
			"enter": func(): cue("kick"), "tick": func(dt, t, k): stage("jump", SILL.x - k*1.6, SILL.y + sin(k*PI*0.6)*0.7, SILL.z, -PI/2)},
	]
	play_reel(shots, func(_skipped): fall_start())

func _to_window(win: Vector3, k: float) -> void:
	if k < 0.45: walk_stage(Vector2(win.x + 2.0, win.z - 0.9), Vector2(win.x + 0.75, win.z), k/0.45)
	else: stage("idle", win.x + 0.75, 0, win.z, -PI/2)

## off the sill, falling towards Kiln Street — slowly, until SPACE fires the shoes
func fall_start() -> void:
	black(false); phone_show(""); kit_all(true); show_inside(false)
	if S.step == "wake": outcome("out")
	S.lesson = 0
	place(Vector3(SILL.x - 1.6, SILL.y + 0.55, SILL.z), 0.35)
	boots.vx = -2; boots.vy = 1.2; boots.ground = false; boots.state = "air"; boots.air_t = 0.2
	lesson_begin(true)

# ------------------------------------------------------------------ the lesson
func lesson_id() -> String: return LESSON[lesson.i].id if lesson.i < LESSON.size() else ""
func lesson_begin(first: bool) -> void:
	lesson.i = int(S.get("lesson", 0)); lesson.perfect = 0; lesson.lands = 0
	if lesson_id() == "fire" and boots.ground: lesson.i = 1
	var have := {}
	for i in lesson.i + 1:
		for t in LESSON[i].get("teach", []): have[t] = true
	for t in S.get("boots", []): have[t] = true
	boots.have = have
	_lesson_show(first)
func _lesson_show(big: bool) -> void:
	if lesson.i >= LESSON.size(): return
	var L: Dictionary = LESSON[lesson.i]
	objective(L.title, [L.how, "ENTER — skip this step"])
	card_text.text = "[center][color=#9fb4c0]THE SHOES · %d / %d[/color]\n[b][font_size=30]%s[/font_size][/b]\n%s[/center]" % [lesson.i + 1, LESSON.size(), L.title, L.how]
	card.visible = true
	if big: cue("win")
	if L.id == "alley":
		var a: Dictionary = nav.zones.alley
		marker.position = Vector3((a.x1 + a.x2)/2, 30, (a.z1 + a.z2)/2); marker.visible = true
func lesson_next() -> void:
	if lesson.i >= LESSON.size(): return
	var L: Dictionary = LESSON[lesson.i]
	if L.id != "fire": cue("win"); note("✓ " + L.title)
	lesson.i += 1; S.lesson = lesson.i; lesson.perfect = 0; lesson.lands = 0
	if lesson.i >= LESSON.size(): _lesson_done(); return
	for t in LESSON[lesson.i].get("teach", []): boots.have[t] = true
	S.boots = boots.have.keys(); _save()
	_lesson_show(L.id != "fire")
func _lesson_done() -> void:
	card.visible = false
	for t in Boots.EARLY + Boots.MID: boots.have[t] = true
	S.boots = boots.have.keys()
	outcome("done")
	note("The shoes do more: SHIFT in the air dives · SPACE out of a dive pulls up · SPACE at a wall kicks off it.")
func _lesson_event(e: Dictionary) -> void:
	if S.step != "lesson": return
	var id := lesson_id()
	var landed: bool = e.name == "boundLand" or ((e.name == "land" or e.name == "roll") and boots.from_bound)
	if id == "bound" and landed and boots.y > 3: lesson_next()
	elif id == "chain" and e.name == "boundLand" and e.get("hops", 0) >= 3: lesson_next()
	elif id == "steer" and (landed or e.name == "land" or e.name == "roll") and boots.y > 3 and boots.z < -9: lesson_next()
	elif id == "rhythm":
		if e.name == "boundPerfect":
			lesson.perfect += 1
			if lesson.perfect >= 2: lesson_next()
		elif e.name == "boundLand" and not e.get("perfect", false):
			lesson.lands += 1
			if lesson.lands % 4 == 0: note("Watch the ring — the moment it goes gold, tap SPACE.")
func fire_shoes() -> void:
	boots.ignite(cam_yaw); cue("blast"); lesson_next()

func _in_alley() -> bool:
	var a: Dictionary = nav.zones.alley
	return boots.x > a.x1 - 1 and boots.x < a.x2 + 1 and boots.z > a.z1 - 1 and boots.z < a.z2 + 1

# ================================================================== every frame
func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and mode == "":
		cam_yaw -= ev.relative.x*0.0032; cam_pitch = clampf(cam_pitch - ev.relative.y*0.0028, -1.1, 0.6)
	elif ev is InputEventMouseButton and ev.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_V: verse_mat.set_shader_parameter("verse", 0.0 if float(verse_mat.get_shader_parameter("verse")) > 0.5 else 1.0)
			KEY_ENTER, KEY_KP_ENTER:
				if mode == "reel": _reel_end(true)
				elif S.step == "lesson": (fire_shoes() if lesson_id() == "fire" else lesson_next())
			KEY_SPACE:
				if mode == "reel": skip_line()

func _process(dt: float) -> void:
	if note_t > 0:
		note_t -= dt
		if note_t <= 0: note_label.text = ""
	if caption_t > 0:
		caption_t -= dt
		if caption_t <= 0: caption.text = ""
	_tick_talk(dt)
	if mode == "reel": _tick_reel(dt); return
	_play_tick(dt)

func _play_tick(dt: float) -> void:
	var k := func(c): return Input.is_physical_key_pressed(c)
	var space: bool = k.call(KEY_SPACE)
	var inp := {"x": float(k.call(KEY_D)) - float(k.call(KEY_A)), "z": float(k.call(KEY_W)) - float(k.call(KEY_S)), "yaw": cam_yaw,
		"jump": space, "jump_edge": space and not space_was, "shift": k.call(KEY_SHIFT) or k.call(KEY_SHIFT)}
	space_was = space
	# the lesson's first step: she falls slowly until SPACE fires the shoes
	if S.step == "lesson" and lesson_id() == "fire" and not boots.ground:
		if inp.jump_edge: fire_shoes()
		else:
			boots.step({"yaw": cam_yaw}, dt*0.22); _follow(dt); return
	for e in boots.step(inp, dt):
		_lesson_event(e)
		match e.name:
			"bound", "boundPerfect", "jump", "jumpPerfect": cue("launch")
			"land", "boundLand": cue("step")
			"roll": cue("thud")
			"rebound", "reboundPerfect", "dash": cue("kick")
	_follow(dt)
	if S.step == "lesson" and lesson_id() == "alley" and _in_alley() and boots.y < 1.0: lesson_next()
	if S.step == "deal" and _in_alley() and boots.y < 1.0 and not S.get("dealReached", false):
		S.dealReached = true; marker.visible = false
		note("Dragon Alley. (The buyer and the fight are the next part of the port.)")

func _follow(dt: float) -> void:
	robin.position = Vector3(boots.x, boots.y, boots.z)
	if boots.hspeed() > 0.5: model.rotation.y = lerp_angle(model.rotation.y, atan2(boots.vx, boots.vz), minf(1, dt*14))
	var nm := "idle"
	if boots.roll > 0: nm = "roll"
	elif not boots.ground: nm = "fly" if boots.state == "dive" else "jump"
	elif boots.hspeed() > 10.5: nm = "sprint"
	elif boots.hspeed() > 0.6: nm = "walk"
	play(nm)
	# the ring: where a bound would go now
	var t = null
	if not boots.ground and boots.bound != null: t = boots.bound
	elif boots.ground and boots.have.has("bound"): t = boots.find_target(boots.aim_dir({"yaw": cam_yaw}, null, false))
	ring.visible = t != null
	if t != null:
		ring.position = Vector3(t.x, t.y + 0.05, t.z)
		(ring.material_override as StandardMaterial3D).albedo_color = Color(1, 0.8, 0.3) if boots.gold else Color(0.4, 1, 0.95)
	_play_camera(dt)
	($Key as OmniLight3D).global_position = robin.position + Vector3(0, 1.6, 0) + cam.global_basis.z*1.4

# ================================================================== photographs (-- shots <dir>)
func _shots() -> void:
	await get_tree().create_timer(1.0).timeout
	for t in [2.0, 6.0, 4.0, 4.0, 4.0, 4.0, 6.0, 6.0]:
		await get_tree().create_timer(t).timeout
		await _snap("reel_%02d" % (reel.i if reel else 99))
	if reel: _reel_end(true)
	await get_tree().create_timer(1.0).timeout; await _snap("fall")
	fire_shoes(); await get_tree().create_timer(1.2).timeout; await _snap("fired")
	for i in 3:
		await get_tree().create_timer(2.5).timeout; await _snap("lesson_%d" % i)
	get_tree().quit()
func _snap(nm: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(shots_dir.path_join(nm + ".png"))
	print("shot ", nm, " step=", S.step, " lesson=", lesson.i, " pos=", robin.position)
