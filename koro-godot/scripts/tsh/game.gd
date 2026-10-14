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
	"end": {"goal": "", "to": {}},
	# THE OTHER ROBIN: the morning after
	"morning": {"goal": "", "to": {"out": "commute"}},
	"commute": {"goal": "Get to school. You are late.", "to": {"there": "school"}},
	"school": {"goal": "Get into school.", "to": {"spotted": "sneak"}},
	"sneak": {"goal": "Get to class without your teacher seeing you.", "to": {"caught": "detention"}},
	"detention": {"goal": "", "to": {"fixed": "after"}},
	"after": {"goal": "", "to": {"out": "courtyard"}},
	"courtyard": {"goal": "Canon is waiting at the old station.", "to": {"fixed": "gethome"}},
	"gethome": {"goal": "Get home.", "to": {"home": "evening"}},
	"evening": {"goal": "", "to": {}}}
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
var sun: DirectionalLight3D
var city_lights: Array = []          # [light, night energy]
var night_look := {}
var indoor := "apt"                  # which interior "inside" means: the flat, the school, the station
var place_now := "city"
var sky_mat: ProceduralSkyMaterial
var lamp: OmniLight3D
var mode := ""                  # "" play · "reel" a scene
var reel = null
var dutch := 0.0; var lens_roll := 0.0; var lens_jitter := Vector3.ZERO
var staged = null               # {clip, pos, ry}
var talk_q: Array = []
var lesson := {"i": 0, "perfect": 0, "lands": 0}
var space_was := false
var shots_dir := ""
var shots_fight := false
var shots_raid := false
var shots_day := false
var shots_open := false; var shots_intro := false; var shots_climb := false; var shots_jump := false; var shots_after := false; var shots_alpha := false
var ring: MeshInstance3D
var marker: MeshInstance3D
var goal_mark: Control; var radar: Radar; var mute_btn: Button; var health: HealthBar
var fight: Fight
var chase: Chase
var today: TshDay
var hs: School
var puzzle: Puzzle
var cy: Courtyard
var station: Station
var raid: Raid
var ringing_on := false; var ring_t := 0.0
var grip: Grip
var phone_prop: PhoneProp
var shoe_glow: Array = []; var _shoes: Node3D = null
var face: Face; var reel_look = null; var cam_kick := 0.0
var intro: Intro
var bedroom: Bedroom
var bed := {}                       # the rain and the city under it: {rain, rain_in, hum, hum_day} players
var end_label: RichTextLabel
## the buyer and his crew, where they wait (tsh.js CREW), and where the four who step out end up (RINGED)
const CREW := [
	{"tag": "buyer", "kind": "buyer", "x": -41.6, "z": -28.6, "yaw": 0.0, "state": "idle"},
	{"tag": "t1", "kind": "lean", "x": -42.7, "z": -29.5, "yaw": 0.3, "state": "idle"},
	{"tag": "t2", "kind": "big", "x": -40.3, "z": -29.9, "yaw": -0.4, "state": "idle"},
	{"tag": "t3", "kind": "lean", "x": -47.0, "z": -19.6, "yaw": PI, "state": "idle", "hidden": true},
	{"tag": "t4", "kind": "big", "x": -33.2, "z": -12.6, "yaw": PI, "state": "idle", "hidden": true},
	{"tag": "t5", "kind": "lean", "x": -33.6, "z": -34.6, "yaw": 0.0, "state": "idle", "hidden": true},
	{"tag": "t6", "kind": "big", "x": -46.6, "z": -32.2, "yaw": 0.0, "state": "idle", "hidden": true, "weapon": true}]
const RINGED := {"t1": Vector2(-42.2, -26.6), "t3": Vector2(-44.4, -22.4), "t4": Vector2(-38.1, -21.8), "t5": Vector2(-37.9, -27.7), "t6": Vector2(-44.7, -27.5)}
const BUYER_CORNER := Vector2(-40.1, -33.0)

# HUD
var hud: CanvasLayer; var sub_label: RichTextLabel; var obj_label: RichTextLabel; var note_label: Label; var card: PanelContainer
var card_text: RichTextLabel; var caption: Label; var black_rect: ColorRect; var phone: PanelContainer; var phone_text: RichTextLabel
var note_t := 0.0; var caption_t := 0.0
var voice_player: AudioStreamPlayer; var sfx_players: Array = []; var music: AudioStreamPlayer

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() >= 2 and args[0] == "shots": shots_dir = args[1]
	if args.size() >= 2 and args[0] == "fightshots": shots_dir = args[1]; shots_fight = true
	if args.size() >= 2 and args[0] == "raidshots": shots_dir = args[1]; shots_raid = true
	if args.size() >= 2 and args[0] == "dayshots": shots_dir = args[1]; shots_day = true
	if args.size() >= 2 and args[0] == "openshots": shots_dir = args[1]; shots_open = true
	if args.size() >= 2 and args[0] == "introshots": shots_dir = args[1]; shots_intro = true
	if args.size() >= 2 and args[0] == "climbshots": shots_dir = args[1]; shots_climb = true
	if args.size() >= 2 and args[0] == "jumpshots": shots_dir = args[1]; shots_climb = true; shots_jump = true
	if args.size() >= 2 and args[0] == "aftershots": shots_dir = args[1]; shots_after = true
	_load_data()
	_world()
	_robin()
	grip = Grip.new(self)
	_camera()
	fight = Fight.new(self); add_child(fight)
	_hud()
	_audio()
	face = Face.new(self); add_child(face)
	var toes := ShoeToes.new(); toes.g = self
	var sk0: Skeleton3D = _find(model, func(x): return x is Skeleton3D)
	if sk0: sk0.add_child(toes)
	chase = Chase.new(self); add_child(chase)
	raid = Raid.new(self); add_child(raid)
	today = TshDay.new(self); add_child(today)
	hs = School.new(self); add_child(hs)
	cy = Courtyard.new(self); add_child(cy)
	station = Station.new(self); add_child(station); station.cy = cy
	puzzle = Puzzle.new(self); hud.add_child(puzzle)
	intro = Intro.new(self); add_child(intro)
	if args.has("new") or shots_dir != "": S = _fresh()
	if shots_dir != "" and not shots_intro: S.step = "wake"          # the photo passes start where they always have
	if shots_fight: S.step = "deal"; S.lesson = 9
	elif shots_raid: S.step = "raid"; S.lesson = 9
	elif shots_day: S.day = true; S.step = "morning"; S.dm = 522
	elif shots_after: S.day = true; S.step = "courtyard"; S.dm = 920
	if args.size() >= 3 and args[2] == "street": S.tun = 7
	if args.size() >= 3 and args[2] == "alpha": S.tun = 6; S.lesson = 99; shots_alpha = true
	if shots_dir == "" and args.has("alpha"): S = _fresh(); S.day = true; S.step = "courtyard"; S.dm = 920; S.tun = 6; S.lesson = 99   # to watch it: -- alpha
	elif shots_dir == "" and not args.has("new"): _load()
	_enter()
	if shots_fight: _shots_fight()
	elif shots_raid: _shots_raid()
	elif shots_day: _shots_day()
	elif shots_after: _shots_after()
	elif shots_climb: _shots_climb()
	elif shots_open: _shots_open()
	elif shots_intro: _shots_intro()
	elif shots_dir != "": _shots()
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		if args.has("alpha"): _watch_alpha()

# ================================================================== the save
func _fresh() -> Dictionary:
	return {"v": 1, "step": "intro", "lesson": 0, "seen": [], "boots": [], "cash": 0, "flash": 3}
func _save() -> void:
	if OS.get_cmdline_user_args().has("alpha"): return      # watching the alpha (-- alpha) leaves the real save alone
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
	nav.spots = _json("res://assets/tsh/city_spots.json").spots
	room = _json("res://assets/tsh/apt.json")
	var L = _json("res://assets/tsh/lines.json")
	lines = L.lines; voice = L.voice

func _world() -> void:
	var lj = _json("res://assets/tsh/lights.json")
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color("#" + str(lj.env.bg))
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.45, 0.62, 0.66); env.ambient_light_energy = 1.0
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = float(lj.env.exposure)*1.45
	env.fog_enabled = true; env.fog_light_color = Color("#" + str(lj.env.fog.c)); env.fog_density = float(lj.env.fog.density)*0.7
	env.glow_enabled = true; env.glow_intensity = 0.6; env.glow_bloom = 0.05; env.glow_hdr_threshold = 1.1
	env.ssao_enabled = true; env.ssr_enabled = true; env.ssr_max_steps = 48
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	for l in lj.lights:
		if not l.vis: continue
		var col := Color("#" + str(l.c)); var p := Vector3(l.p[0], l.p[1], l.p[2])
		match str(l.type):
			"DirectionalLight":
				var d := DirectionalLight3D.new(); d.light_color = col; d.light_energy = float(l.i)*1.1; d.shadow_enabled = bool(l.shadow); add_child(d); sun = d
				var tg := Vector3(l.t[0], l.t[1], l.t[2]) if l.t != null else Vector3.ZERO
				d.look_at_from_position(p, tg if tg != p else p + Vector3(0, -1, 0.01))
			"PointLight":
				var o := OmniLight3D.new(); o.light_color = col; o.light_energy = float(l.i)*0.16; o.omni_range = float(l.d) if float(l.d) > 0 else 20.0; o.position = p; add_child(o); city_lights.append([o, o.light_energy])
			"HemisphereLight":
				env.ambient_light_color = col.lerp(Color("#" + str(l.g)), 0.5); env.ambient_light_energy = maxf(1.0, float(l.i)*0.8)
	city = _scene("res://assets/tsh/city.glb")
	apt = _scene("res://assets/tsh/apt.glb")
	# what the browser had swapped out for a model (the bed's boxes and its old duvet, the table, the form...): hidden
	for h in _json("res://assets/tsh/apt_parts.json").hidden:
		var n := apt.find_child(h, true, false) as Node3D
		if n: n.visible = false
	# her corner of it, dressed: the wall behind the bed, the fairy lights, the bedding, the nightstand, her cat
	bedroom = Bedroom.new(); bedroom.build(apt, room.room)
	school = _scene("res://assets/tsh/school.glb")
	sub = _scene("res://assets/tsh/sub.glb")
	# the lamp by her bed (the browser's aptLights)
	var a: Dictionary = room.apt
	lamp = OmniLight3D.new(); lamp.light_color = Color(1.0, 0.82, 0.6); lamp.light_energy = 0.0; lamp.omni_range = 9
	lamp.position = Vector3(room.room.bed.x + 0.6, 2.2, room.room.bed.z - 1.0); add_child(lamp)
	var ceil := OmniLight3D.new(); ceil.name = "AptFill"; ceil.light_color = Color(0.7, 0.85, 0.9); ceil.light_energy = 0.0; ceil.omni_range = 12
	ceil.position = Vector3(a.x, 2.8, a.z); add_child(ceil)
	# the morning: the sun in at the window, on the floor and the bed (tsh.js aptSrc.sun); the ceiling off
	var w: Array = room.room.window.at
	var sunin := OmniLight3D.new(); sunin.name = "AptSun"; sunin.light_color = Color("#ffe2b8"); sunin.light_energy = 0.0; sunin.omni_range = 11
	sunin.position = Vector3(w[0] + 1.6, 2.4, w[2]); sunin.shadow_enabled = true; add_child(sunin)
	# a soft light that follows her, so she reads against the night (the browser's charLook rim)
	var key := OmniLight3D.new(); key.name = "Key"; key.light_color = Color(1.0, 0.86, 0.74); key.light_energy = 2.2; key.omni_range = 6.0; add_child(key)
	show_inside(false)
	# the shoes' world: every solid, floor and roof
	boots = Boots.new()
	var city_d = _json("res://assets/tsh/city.json")
	for s in city_d.solids: boots.solids.append([s[0], s[1], s[2], s[3], s[4], s[5], s[6] if s.size() > 6 else ""])     # the tag: bld:B1 is a wall she can climb
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
	var mm := StandardMaterial3D.new(); mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mm.albedo_color = Color(1, 0.82, 0.24, 0.45); mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mm.render_priority = 101; mm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; mm.cull_mode = BaseMaterial3D.CULL_DISABLED
	marker.material_override = mm; marker.visible = false; marker.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(marker)

## WHERE TO GO (tsh.js marker): [x, z, the label's height, its name], or null. The beacon stands there, the diamond
## over it on screen says how far, and the radar in the corner points the way
func goal_at():
	var s: Dictionary = nav.spots
	if cy.watch == "escape": var L: Array = cy.sp.ladder; return [L[0], L[1], 2.6, "EXIT"]
	match S.step:
		"lesson": return [s.kai[0], s.kai[1], 2.2, "Dragon Alley"] if lesson_id() == "alley" else null
		"deal": return [Fight.MEET.buyer.x, Fight.MEET.buyer.y, 2.4, "The buyer"]
		"raid": return chase.marker() if chase.on else null
		"commute": var o: Array = s.schoolOverlook; return [o[0], o[1], o[2] + 1.2, "School"]
		"school": var d: Array = s.schoolDoor; return [d[0], d[1], 2.6, "Harbor Lane High"]
		"sneak": var r: Array = hs.sp.room114 if hs.sp else []; return [r[0], r[1], 2.4, "Room 114"] if r.size() >= 2 else null
		"courtyard": return [Courtyard.ENTRY.x, Courtyard.ENTRY.y, 2.6, "Canon"] if cy.watch == "entry" else null
		"gethome": return [73, 34, 14, "Home"]
	return null
func _goal_tick() -> void:
	var hide_all := mode in ["reel", "fight", "end", "puzzle", "read", "wc"]
	var mk: Variant = null if hide_all else goal_at()
	var p := robin.position
	radar.visible = not hide_all and place_now != "school" and mode != "guitar"
	health.visible = (not hide_all or mode == "fight") and mode != "guitar" and reel == null
	# the beacon: a column of light at the place, out in the city
	marker.visible = mk != null and not inside
	if marker.visible: marker.position = Vector3(mk[0], 30, mk[1])
	# the diamond on screen, over the place (clamped to the edges when it is off them), its name and how far
	goal_mark.visible = mk != null and not inside
	if not goal_mark.visible: return
	var at := Vector3(mk[0], mk[2], mk[1]); var vp := get_viewport().get_visible_rect().size
	var sp: Vector2 = cam.unproject_position(at); var behind := cam.is_position_behind(at)
	if behind: sp = Vector2(vp.x - sp.x, vp.y - 40)
	sp = Vector2(clampf(sp.x, 40, vp.x - 40), clampf(sp.y, 60, vp.y - 60))
	goal_mark.position = sp - Vector2(goal_mark.size.x/2, goal_mark.size.y)
	goal_mark.modulate.a = 0.8 if behind else 1.0
	(goal_mark.get_node("t") as Label).text = "%s · %d m" % [mk[3], roundi(Vector2(mk[0] - p.x, mk[1] - p.z).length())]

func _scene(p: String) -> Node3D:
	var n: Node3D = (load(p) as PackedScene).instantiate(); add_child(n); return n

## a shot "inside": whichever interior the story is in (the flat, the school, the station); outside: the city
func show_inside(v: bool) -> void: show_place(indoor if v else "city")
func show_place(w: String) -> void:
	place_now = w; inside = w != "city"
	city.visible = w == "city"; apt.visible = w == "apt"; school.visible = w == "school"; sub.visible = w == "sub"
	for l in city_lights: l[0].visible = w == "city"
	if w != "city": indoor = w
	_look()
	($AptFill as OmniLight3D).light_energy = (0.35 if not day() else 0.0) if w == "apt" else 0.0
	($AptSun as OmniLight3D).light_energy = 3.5 if w == "apt" and day() else 0.0
	if has_node("SchoolLights"): ($SchoolLights as Node3D).visible = w == "school"
	if has_node("SubLights"): ($SubLights as Node3D).visible = w == "sub"
func day() -> bool: return S.get("day", false)

## THE LOOK: night (teal, wet, neon) or the morning after (tsh.js applyLook: a pale sky, the neon still on and
## nothing next to the daylight, the towers' windows glass with the sky in them)
func _look() -> void:
	if night_look.is_empty():
		night_look = {"amb": env.ambient_light_color, "ambE": env.ambient_light_energy, "fog": env.fog_light_color, "exp": env.tonemap_exposure, "sunC": sun.light_color if sun else Color.WHITE, "sunE": sun.light_energy if sun else 1.0, "glow": env.glow_intensity}
	var d := day(); var w := place_now
	env.sky = _dome(d); env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	if w == "city":
		if d:
			if sky_mat == null:
				sky_mat = ProceduralSkyMaterial.new(); sky_mat.sky_top_color = Color("#3f7fd0"); sky_mat.sky_horizon_color = Color("#d6e6ee")
				sky_mat.ground_horizon_color = Color("#c2ccca"); sky_mat.ground_bottom_color = Color("#8a9290"); sky_mat.sun_angle_max = 20
			var sky := Sky.new(); sky.sky_material = sky_mat
			env.background_mode = Environment.BG_SKY; env.sky = sky
			env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("#e4ecf2").lerp(Color("#cfe6ff"), 0.5); env.ambient_light_energy = 1.1
			env.fog_light_color = Color("#c9dde0"); env.fog_density = 0.0026*0.7; env.tonemap_exposure = 1.0
			env.glow_intensity = 0.25
			if sun: sun.light_color = Color("#ffe6c4"); sun.light_energy = 1.6; sun.rotation = Vector3(-0.9, -0.6, 0)
			for l in city_lights: l[0].light_energy = l[1]*0.25
		else:
			env.background_mode = Environment.BG_COLOR; env.background_color = Color("#0b2a26")
			env.ambient_light_color = night_look.amb; env.ambient_light_energy = night_look.ambE; env.fog_light_color = night_look.fog; env.fog_density = 0.011
			env.tonemap_exposure = night_look.exp; env.glow_intensity = night_look.glow
			if sun: sun.light_color = night_look.sunC; sun.light_energy = night_look.sunE
			for l in city_lights: l[0].light_energy = l[1]
		_city_windows(d)
	else:
		env.background_mode = Environment.BG_COLOR
		match w:
			"apt":
				env.background_color = Color(0.008, 0.016, 0.016) if not d else Color("#c9dde0"); env.fog_density = 0.002
				# by night the teal is turned down: her fairy lights and her lamp warm her corner of it
				env.ambient_light_color = night_look.amb if not d else Color("#e4ecf2"); env.ambient_light_energy = night_look.ambE*0.7 if not d else 0.32
				if d: env.ambient_light_color = Color("#bcd4d0"); env.tonemap_exposure = 0.8
			"school":
				env.background_color = Color("#e6ece8"); env.fog_density = 0.002; env.fog_light_color = Color("#e6ece8")
				env.ambient_light_color = Color("#e4ecf2"); env.ambient_light_energy = 0.55; env.tonemap_exposure = 0.85
			"sub":
				env.background_color = Color("#040606"); env.fog_density = 0.01; env.fog_light_color = Color("#0a0e0c")
				env.ambient_light_color = Color("#1c2622"); env.ambient_light_energy = 0.6; env.tonemap_exposure = night_look.exp
		if sun: sun.light_energy = 0.0 if w == "sub" else (night_look.sunE if not d else 0.6)
## WHAT IT ALL REFLECTS (tsh.js applyLook, scene.environment): a teal dome with orange lanterns low down, the tubes
## and the neon on it (by day a pale blue one, nothing on it), at 0.6 of its light by night and 0.8 by day. Never seen,
## only reflected: in the wet, in glass — and in the alpha's skin, which is black and glossy and nothing without it
var _domes := {}
func _dome(d: bool) -> Sky:
	if _domes.has(d): return _domes[d]
	var W := 256; var H := 128
	var im := Image.create(W, H, false, Image.FORMAT_RGBAF)
	var top := Color("#5a9ae0") if d else Color("#0e3a34"); var hor := Color("#e8eeee") if d else Color("#2a7a6c"); var bot := Color("#4a4642") if d else Color("#050807")
	var panels := [] if d else [[Color("#ff6a2a"), 3.0, Vector3(25, 3, 10), 8.0, 3.0], [Color("#ff5a1a"), 2.5, Vector3(-20, 2, 25), 6.0, 3.0], [Color("#c8ffe8"), 4.0, Vector3(0, 18, 0), 14.0, 2.0],
		[Color("#38ffd0"), 3.0, Vector3(-30, 6, -15), 10.0, 4.0], [Color("#ff3fd0"), 2.0, Vector3(30, 8, -25), 8.0, 4.0], [Color("#8fd8ff"), 2.5, Vector3(5, 10, 35), 12.0, 5.0]]
	for y in H:
		for x in W:
			var ph := (float(x)/W - 0.5)*TAU; var th := (0.5 - float(y)/H)*PI
			var dir := Vector3(sin(ph)*cos(th), sin(th), -cos(ph)*cos(th))
			var c := hor.lerp(top, pow(dir.y, 0.5)) if dir.y > 0 else hor.lerp(bot, pow(-dir.y, 0.4))
			for p in panels:
				var ctr: Vector3 = p[2]; var n := -ctr.normalized(); var dn := dir.dot(n)
				if dn >= -0.001: continue
				var hit := dir*(ctr.dot(n)/dn) - ctr
				var r := (Vector3.UP.cross(-n)).normalized() if absf(n.y) < 0.999 else Vector3.RIGHT; var u := (-n).cross(r)
				if absf(hit.dot(r)) < p[3]/2 and absf(hit.dot(u)) < p[4]/2: c = (p[0] as Color)*p[1]
			im.set_pixel(x, y, c)
	var m := PanoramaSkyMaterial.new(); m.panorama = ImageTexture.create_from_image(im); m.energy_multiplier = 0.8 if d else 0.6
	var s := Sky.new(); s.sky_material = m; _domes[d] = s; return s

var _win_day = null
func _city_windows(d: bool) -> void:
	if _win_day == d: return
	_win_day = d
	var stack: Array = [city]
	while stack.size():
		var n: Node = stack.pop_back(); stack.append_array(n.get_children())
		if not n is MeshInstance3D: continue
		var mi := n as MeshInstance3D
		for i in mi.get_surface_override_material_count():
			var m = mi.get_active_material(i)
			if m is StandardMaterial3D and m.emission_enabled and m.emission_texture != null:
				if not m.has_meta("e"): m.set_meta("e", m.emission_energy_multiplier)
				m.emission_energy_multiplier = float(m.get_meta("e"))*(0.3 if d else 1.0)

# ================================================================== Robin
func _robin() -> void:
	robin = Node3D.new(); add_child(robin)
	model = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate(); robin.add_child(model)
	anim = _find(model, func(n): return n is AnimationPlayer)
	for nm in anim.get_animation_list():
		if nm in ["jump", "flip", "roll", "climb_top", "wake", "kneel", "text"]: continue
		anim.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
	_fight_clips()
	phone_prop = PhoneProp.make(_find(model, func(x): return x is Skeleton3D))
	# THE SHOES' GLOW (boots.js bootGlow): a small soft light at each foot, added in, not painted on — the export had
	# lost its additive blending and left two white shells round her feet, on all the time
	var st: Array = [model]
	while st.size():
		var n: Node = st.pop_back(); st.append_array(n.get_children())
		if n is MeshInstance3D and String(n.get_parent().name).ends_with("Foot"):
			var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.no_depth_test = false; m.render_priority = 101; m.albedo_color = Color(0.4, 1.8, 2.2, 0.85)
			(n as MeshInstance3D).material_override = m; (n as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			shoe_glow.append([n, (n as Node3D).scale])

## HER PUNCHES, KICKS AND DODGES (characters/fight/robin.glb): a file of clips keyed to bones as plain nodes, put
## onto her skeleton by bone name (mixamorig_Hips there is mixamorigHips here)
func _fight_clips() -> void:
	_merge_clips("res://assets/tsh/robin_fight.glb", ["fight", "boxing"])
	# ON THE PHONE (animations/talk on phone → glb files/cast/build-robin-phone.sh): standing at her ear, pacing,
	# on a cell phone, and talking with her hands
	_merge_clips("res://assets/tsh/robin_phone.glb", ["phone_talk", "phone_pace", "phone_cell", "talk_hands"])
	# PLAYING THE GUITAR (animations/guitar → glb files/cast/build-robin-guitar.sh): two of Mixamo's
	_merge_clips("res://assets/tsh/robin_guitar.glb", ["guitar_a", "guitar_b"])
func _merge_clips(file: String, loops: Array) -> void:
	var src: Node = (load(file) as PackedScene).instantiate()
	var sap: AnimationPlayer = _find(src, func(n): return n is AnimationPlayer)
	var sk: Skeleton3D = _find(model, func(n): return n is Skeleton3D)
	var skel_path := String(anim.get_node(anim.root_node).get_path_to(sk))
	var names := {}
	for i in sk.get_bone_count(): names[sk.get_bone_name(i).replace("_", "").replace(":", "")] = sk.get_bone_name(i)
	var lib: AnimationLibrary = anim.get_animation_library("")
	for nm in sap.get_animation_list():
		if nm == "idle": continue
		var a: Animation = sap.get_animation(nm).duplicate(true)
		for t in range(a.get_track_count() - 1, -1, -1):
			var path := String(a.track_get_path(t))
			var bone := path.get_file().split(":")[0].replace("_", "").replace(":", "")
			if names.has(bone): a.track_set_path(t, NodePath(skel_path + ":" + names[bone]))
			else: a.remove_track(t)
		a.loop_mode = Animation.LOOP_LINEAR if nm in loops else Animation.LOOP_NONE
		if lib.has_animation(nm): lib.remove_animation(nm)
		lib.add_animation(nm, a)
	src.free()

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
const KIT_MESH := {"jacket": "worn_tech-jacket", "gloves": "worn_gecko-cuffs", "shoes": "worn_skyline-shoes", "bracelet": "worn_flash-bangle", "pack": "worn_roll-top"}
## at school she is just Robin: the shoes and the pack, nothing else (tsh.js SCHOOL_KIT); no shades by day
const SCHOOL_KIT := {"jacket": false, "gloves": false, "shoes": true, "bracelet": false, "pack": true}
func kit(piece: String, on: bool) -> void:
	var n := _find(model, func(x): return x is Node3D and x.name == KIT_MESH.get(piece, "?"))
	if n:
		if on and not n.visible and mode == "reel" and face: face.glance_self(piece)      # a look down at it as it goes on
		n.visible = on
	# what of her body the garment covers (the export keeps it apart): showing when the garment is off
	var under := {"jacket": "under_jacket", "gloves": "under_cuffs", "shoes": "under_shoes"}
	if under.has(piece):
		var u := _find(model, func(x): return x is Node3D and x.name == under[piece])
		if u: u.visible = not on
func kit_all(on: bool) -> void:
	for p in KIT_MESH: kit(p, on)
	shades(on and not day())
func kit_set(k: Dictionary) -> void:
	for p in k: kit(p, k[p])
func shades(on: bool) -> void:
	var n := _find(model, func(x): return x is Node3D and x.name == "worn_shades")
	if n: n.visible = on
## the flat's own things: her boots on the floor by the window, the pack, the window's sash (named in the export)
func apt_node(nm: String) -> Node3D: return _find(apt, func(x): return x.name == nm) as Node3D
func apt_boots(v: bool) -> void:
	for i in 8:
		var b := apt_node("boot%d" % i)
		if b: b.visible = v
func apt_pack(v: bool) -> void:
	var p := apt_node("pack")
	if p: p.visible = v
var sash_y = null
func apt_window(open: bool) -> void:
	var w := apt_node("win_sash")
	if w == null: return
	if sash_y == null: sash_y = w.position.y
	w.position.y = sash_y + (0.6 if open else 0.0)

## Robin where the shot needs her: a clip, a place, a heading
## the phone clips: the phone at her ear ("phone_talk" standing, "phone_pace" walking to and fro); "phone_read" is
## the texting pose with the phone in her hand, screen up
const PHONE_CLIPS := {"phone_talk": "ear", "phone_pace": "ear", "phone_cell": "ear", "phone_read": "read"}
func stage(nm: String, x: float, y: float, z: float, ry: float) -> void:
	var how: String = PHONE_CLIPS.get(nm, "")
	if nm == "phone_read": nm = "text"
	staged = {"clip": nm, "pos": Vector3(x, y, z), "ry": ry}
	robin.position = staged.pos; model.rotation = Vector3(0, ry, 0)
	var was := clip
	play(nm, 0.15)
	if nm in ["phone_talk", "phone_pace"] and was != nm: anim.seek(3.0 + randf()*4.0, true)      # already at her ear
	if phone_prop: phone_prop.hold(how)

func place(p: Vector3, yaw: float) -> void:
	boots.x = p.x; boots.y = p.y; boots.z = p.z; boots.vx = 0; boots.vy = 0; boots.vz = 0
	boots.ground = p.y <= boots.floor_at(p.x, p.z, p.y) + 0.05; boots.state = "ground" if boots.ground else "air"
	cam_yaw = yaw; robin.position = p; cam_p = Vector3.ZERO; model.rotation.x = 0

# ================================================================== the lens
func _camera() -> void:
	cam = Camera3D.new(); cam.fov = 70; cam.near = 0.08; cam.far = 900; add_child(cam); cam.current = true
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = Vector2(2, 2); q.mesh = qm
	q.extra_cull_margin = 16384; q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	verse_mat = ShaderMaterial.new(); verse_mat.shader = load("res://shaders/tsh_verse.gdshader"); verse_mat.render_priority = 100
	q.material_override = verse_mat; cam.add_child(q); q.position = Vector3(0, 0, -0.5)

## play (boots.js camera): back further and wider the faster she goes; up when she launches; above and looking down
## the line in a dive; a little kick on every jump and a bigger one on a perfect move. With the mouse left alone in
## the air it swings round behind her line, so where she is going is always on screen; and it looks ahead, to the
## roof she is bounding to. Never inside a building: pulled in front of any between it and her.
var punch := 0.0; var mouse_idle := 9.0; var cam_l := Vector3.ZERO; var fov_now := 70.0
func _play_camera(dt: float) -> void:
	var b := boots; var feet := robin.position
	if inside:
		var hd := feet + Vector3(0, 1.4, 0); var back := Vector3(sin(cam_yaw), 0, cos(cam_yaw))
		var w := hd + back*2.4 + Vector3(0, 0.4, 0)
		cam_p = w if cam_p == Vector3.ZERO else cam_p.lerp(w, minf(1, dt*6))
		cam.global_position = cam_p; cam.look_at(hd + Vector3(0, sin(cam_pitch)*2, 0) - back*2.0); cam.fov = 70; return
	var sp01 := clampf((b.speed() - 8)/42, 0, 1)
	mouse_idle += dt
	if not b.ground and b.hspeed() > 10 and b.wall == null and not grip.on() and mouse_idle > (0.3 if b.fly > 0 else (0.35 if b.bound != null else 0.6)):
		cam_yaw += angle_difference(cam_yaw, atan2(-b.vx, -b.vz))*minf(1, dt*2.6*(0.5 + sp01))
	var f := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var dist := lerpf(6.2, 9.5, sp01) + punch*1.5
	var lift := 2.3 + (1.0 if b.vy > 10 else 0.0) + (2.2 if b.state == "dive" else 0.0) - sin(cam_pitch)*3
	var head := feet + Vector3(0, 1.6, 0)
	var want := Vector3(feet.x - f.x*dist + cos(cam_yaw)*0.5, feet.y + 1.6 + lift, feet.z - f.z*dist - sin(cam_yaw)*0.5)
	want = _clear_of(head, want)
	var look := Vector3(feet.x + b.vx*0.16 + f.x*4, feet.y + 1.4 + b.vy*0.1 + (-2.5 if b.state == "dive" else 0.0) + sin(cam_pitch)*4, feet.z + b.vz*0.16 + f.z*4)
	if b.bound != null: look = look.lerp(Vector3(b.bound.x, b.bound.y + 1.2, b.bound.z), 0.28)
	if cam_p == Vector3.ZERO: cam_p = want; cam_l = look
	cam_p = cam_p.lerp(want, 1 - exp(-dt*(9.0 if b.ground else 7.0))); cam_l = cam_l.lerp(look, 1 - exp(-dt*10))
	cam.global_position = cam_p
	if (cam_l - cam_p).length() > 0.01: cam.look_at(cam_l)
	punch = maxf(0, punch - dt*2.2)
	fov_now = lerpf(fov_now, lerpf(70, 90, sp01) + punch*10, 1 - exp(-dt*5)); cam.fov = fov_now
func _clear_of(from: Vector3, to: Vector3) -> Vector3:
	var k := 1.0
	for s in boots.solids:
		if s[5] - maxf(s[4], 0) < 3: continue
		for i in range(1, 13):
			var t := i/12.0; var q := from.lerp(to, t)
			if q.x > s[0] - 0.3 and q.x < s[1] + 0.3 and q.z > s[2] - 0.3 and q.z < s[3] + 0.3 and q.y > maxf(s[4], 0) and q.y < s[5] + 0.4:
				k = minf(k, maxf(0.12, t - 0.1)); break
	return from.lerp(to, k)
## what each move feels like on the lens (boots.js react)
func _boot_punch(e: Dictionary) -> void:
	match e.name:
		"jump": punch = maxf(punch, 0.35)
		"jumpPerfect": punch = maxf(punch, 0.8)
		"bound": punch = maxf(punch, 0.3)
		"boundPerfect": punch = maxf(punch, 0.75)
		"ignite": punch = 1.4
		"pullPerfect": punch = 1.0
		"pull": punch = maxf(punch, 0.4)
		"rebound": punch = 0.5; boots.last.reboundT = 0.45
		"reboundPerfect": punch = 1.0; boots.last.reboundT = 0.45

# ================================================================== the HUD
func _hud() -> void:
	hud = CanvasLayer.new(); add_child(hud)
	black_rect = ColorRect.new(); black_rect.color = Color.BLACK; black_rect.set_anchors_preset(Control.PRESET_FULL_RECT); black_rect.visible = false; hud.add_child(black_rect)
	obj_label = _rich(Vector2(24, 20), Vector2(560, 120), 18)
	# the subtitles: every line, whoever says it, centred along the bottom (placed by offsets from that anchor; a
	# position set after the anchors had put them off the top-left of the screen, where nobody ever saw them)
	sub_label = _rich(Vector2(0, 0), Vector2(900, 120), 24); sub_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	sub_label.fit_content = false; sub_label.custom_minimum_size = Vector2.ZERO
	sub_label.offset_left = -450; sub_label.offset_right = 450; sub_label.offset_top = -180; sub_label.offset_bottom = -50
	sub_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; sub_label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM; sub_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	note_label = Label.new(); note_label.set_anchors_preset(Control.PRESET_CENTER_TOP); note_label.position = Vector2(-300, 90); note_label.size = Vector2(600, 40)
	note_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; note_label.add_theme_font_size_override("font_size", 20); hud.add_child(note_label)
	caption = Label.new(); caption.position = Vector2(24, 0); caption.set_anchors_preset(Control.PRESET_BOTTOM_LEFT); caption.position = Vector2(24, -60)
	caption.add_theme_font_size_override("font_size", 16); caption.modulate = Color(1, 1, 1, 0.8); hud.add_child(caption)
	card = PanelContainer.new(); card.set_anchors_preset(Control.PRESET_CENTER_TOP); card.position = Vector2(-260, 130); card.custom_minimum_size = Vector2(520, 0)
	card_text = _rich(Vector2.ZERO, Vector2(520, 110), 18, card); card.visible = false; hud.add_child(card)
	phone = PanelContainer.new(); phone.set_anchors_preset(Control.PRESET_CENTER_RIGHT); phone.position = Vector2(-330, -200); phone.custom_minimum_size = Vector2(260, 400)
	phone_text = _rich(Vector2.ZERO, Vector2(260, 400), 22, phone); phone.visible = false; hud.add_child(phone)
	# where to go: a yellow diamond over the place, its name and the distance (tsh.js .tsh-om)
	goal_mark = VBoxContainer.new(); goal_mark.alignment = BoxContainer.ALIGNMENT_CENTER; goal_mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var t := Label.new(); t.name = "t"; t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; t.add_theme_font_size_override("font_size", 13)
	t.add_theme_color_override("font_color", Color("#ffd23d")); t.add_theme_constant_override("outline_size", 5); t.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	var dia := Control.new(); dia.custom_minimum_size = Vector2(20, 20); dia.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	dia.draw.connect(func():
		dia.draw_circle(Vector2(10, 10), 10, Color(1, 0.82, 0.24, 0.25))
		dia.draw_colored_polygon(PackedVector2Array([Vector2(10, 0), Vector2(20, 10), Vector2(10, 20), Vector2(0, 10)]), Color("#ffd23d")))
	goal_mark.add_child(dia); goal_mark.add_child(t); goal_mark.visible = false; hud.add_child(goal_mark)
	# the radar, bottom left
	radar = Radar.new(self); radar.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	radar.offset_left = 18; radar.offset_top = -238; radar.offset_right = 238; radar.offset_bottom = -18; hud.add_child(radar)
	# her health, just above it
	health = HealthBar.new(self); health.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	health.offset_left = 18; health.offset_top = -284; health.offset_right = 278; health.offset_bottom = -244; hud.add_child(health)
	# the sound: on or off (M), remembered
	mute_btn = Button.new(); mute_btn.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	mute_btn.offset_left = -64; mute_btn.offset_top = 14; mute_btn.offset_right = -16; mute_btn.offset_bottom = 54
	mute_btn.focus_mode = Control.FOCUS_NONE; mute_btn.add_theme_font_size_override("font_size", 20); mute_btn.flat = true
	mute_btn.pressed.connect(func(): set_mute(not AudioServer.is_bus_mute(0))); hud.add_child(mute_btn)
	var cf := ConfigFile.new(); set_mute(cf.load("user://tsh_settings.cfg") == OK and bool(cf.get_value("sound", "mute", false)), false)

func _rich(p: Vector2, s: Vector2, fs: int, parent: Node = null) -> RichTextLabel:
	var r := RichTextLabel.new(); r.bbcode_enabled = true; r.fit_content = true; r.position = p; r.size = s; r.custom_minimum_size = s
	r.add_theme_font_size_override("normal_font_size", fs); r.add_theme_font_size_override("bold_font_size", fs)
	r.add_theme_constant_override("outline_size", 6); r.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	(parent if parent else hud).add_child(r); return r

## THE LETTERBOX: black bars to 2.39:1, sliding in and out (the films that want to look like films)
var bars: Array = []; var bars_tw: Tween
func letterbox(v: bool) -> void:
	if bars.is_empty():
		for top in [true, false]:
			var r := ColorRect.new(); r.color = Color.BLACK; r.mouse_filter = Control.MOUSE_FILTER_IGNORE
			r.set_anchors_preset(Control.PRESET_TOP_WIDE if top else Control.PRESET_BOTTOM_WIDE); hud.add_child(r); hud.move_child(r, 1); bars.append(r)
	var vp := get_viewport().get_visible_rect().size
	var h := maxf(0, (vp.y - vp.x/2.39)/2) if v else 0.0
	if bars_tw: bars_tw.kill()
	bars_tw = create_tween().set_parallel()
	bars_tw.tween_property(bars[0], "offset_bottom", h, 0.6); bars_tw.tween_property(bars[1], "offset_top", -h, 0.6)
func set_mute(v: bool, keep := true) -> void:
	AudioServer.set_bus_mute(0, v)
	mute_btn.text = "🔇" if v else "🔊"; mute_btn.tooltip_text = ("Sound off" if v else "Sound on") + " (M)"
	if keep:
		var cf := ConfigFile.new(); cf.load("user://tsh_settings.cfg"); cf.set_value("sound", "mute", v); cf.save("user://tsh_settings.cfg")
func lesson_card(head: String, title: String, how: String) -> void:
	card.visible = title != ""
	if title != "": card_text.text = "[center][color=#9fb4c0]%s[/color]\n[b][font_size=30]%s[/font_size][/b]\n%s[/center]" % [head, title, how]
func note(text: String) -> void:
	note_label.text = text; note_t = 4.0
func set_caption(text: String) -> void:
	caption.text = text; caption_t = 4.0
func objective(title: String, how: Array = []) -> void:
	obj_label.text = "" if title == "" else "[b]" + title + "[/b]" + ("\n[color=#9fb4c0]" + "\n".join(how) + "[/color]" if how.size() else "")
var phone_msg := ""
static func dclock(m: float) -> String:
	var h := int(floor(m/60)); var mm := int(floor(m)) % 60
	return "%d:%02d" % [(h + 11) % 12 + 1, mm]
func phone_show(kind: String, who := "") -> void:
	phone.visible = kind != ""
	match kind:
		"call": phone_text.text = "[center]\n\n[color=#9fb4c0]incoming call[/color]\n[b]%s[/b]\nmobile\n\n\n\n[color=#ff5a5a]✕[/color]      [color=#5aff8a]✆[/color][/center]" % who
		"time": phone_text.text = "[center]\n\n\n[font_size=64][b]%s[/b][/font_size]\n[color=#9fb4c0]Tuesday[/color]\n\n\n[color=#9fb4c0]school 8:00[/color][/center]" % who
		"late", "dtime":
			var c := dclock(S.get("dm", 522))
			phone_text.text = "[center]\n\n[color=#9fb4c0]%s AM[/color]\n[font_size=64][b]%s[/b][/font_size]\n%s\n[color=#9fb4c0]🏫 School · 8:00 AM[/color][/center]" % [c, c, "[color=#ffb0a0]⏰ 7:15 AM · snoozed[/color]" if kind == "late" else ""]
		"text", "msg": phone_text.text = "[center][color=#9fb4c0]MESSAGES · NOW[/color]\n[b]%s[/b][/center]\n%s" % [who, phone_msg]
		"calling": phone_text.text = "[center]\n\n[color=#9fb4c0]calling…[/color]\n[b]%s[/b]\nmobile\n\n\n\n[color=#ff5a5a]✕[/color][/center]" % who
		"nocall": phone_text.text = "[center]\n\n[color=#9fb4c0]call failed[/color]\n[b]%s[/b]\nno answer[/center]" % who
		"oncall": phone_text.text = "[center]\n\n[color=#9fb4c0]00:04[/color]\n[b]%s[/b]\non call\n\n\n\n[color=#ff5a5a]✕[/color][/center]" % who

# ================================================================== sound
func _audio() -> void:
	voice_player = AudioStreamPlayer.new(); add_child(voice_player)
	music = AudioStreamPlayer.new(); music.volume_db = -8; add_child(music)
	for i in 6: var p := AudioStreamPlayer.new(); add_child(p); sfx_players.append(p)
	var beds := Synth.bed_streams(); Synth.warm()
	for k in ["rain", "rain_in", "hum", "hum_day"]:
		var b := AudioStreamPlayer.new(); b.stream = beds[k]; b.volume_db = -80; add_child(b); b.play(); bed[k] = [b, 0.0]
## the browser's synth cues that have no recording of their own here, played as the nearest one that does
## a recording if there is one (tsh/sfx), else the browser's own tone for it (synth.gd)
const CUE_AS := {"hit": "punch"}
func cue(kind: String) -> void:
	kind = CUE_AS.get(kind, kind)
	if face: face.cue(kind)
	var files := []
	for i in 6:
		var f := "res://assets/tsh/sfx/%s-%d.mp3" % [kind, i]
		if ResourceLoader.exists(f): files.append(f)
	var st: AudioStream = load(files.pick_random()) if not files.is_empty() else Synth.stream(kind)
	if st == null: return
	for p in sfx_players:
		if not p.playing:
			p.stream = st; p.volume_db = linear_to_db(0.8) if not files.is_empty() else 0.0
			p.pitch_scale = randf_range(0.95, 1.05) if not files.is_empty() else 1.0; p.play(); return
func score(track: String, vol := -8.0) -> void:
	var f := "res://assets/tsh/music/%s.mp3" % track
	if not ResourceLoader.exists(f): return
	if intro and intro.game: intro.game.band.stop()            # one song at a time
	_score_bus(); if score_tw: score_tw.kill()
	_score_lp.cutoff_hz = 18000.0; score_holding = false
	music.stream = load(f); music.volume_db = vol; music.play()

## THE SCORE, as the browser lays it (tsh.js SONG): WEB OF SILENCE, cut to the film — wos-a is the song from 0:06.5,
## wos-b from 2:25; every time here is the SONG's. The full beat as she gets ready; down to almost nothing at her
## mother's note; 2:25 the breakdown from near silence as the window goes up — building through the sill, the look
## down, the jump; 2:33.5 the last beat before the drop, HELD while she falls, slow, until SPACE; 2:34.4 the drop, on
## the shoes; and the rest of the song is the first roofs
const SONG := {"a": 6.5, "b": 145.0, "hold": [153.50, 154.45], "drop": 154.40}
var score_holding := false; var score_tw: Tween; var _score_lp: AudioEffectLowPassFilter
func _score_bus() -> void:
	if AudioServer.get_bus_index("Score") >= 0:
		music.bus = "Score"; return
	AudioServer.add_bus(); var i := AudioServer.bus_count - 1
	AudioServer.set_bus_name(i, "Score"); AudioServer.set_bus_send(i, "Master")
	_score_lp = AudioEffectLowPassFilter.new(); _score_lp.cutoff_hz = 18000.0; AudioServer.add_bus_effect(i, _score_lp)
	music.bus = "Score"
## the song's file k from song time t
func song_at(k: String, t: float, vol := -6.0) -> void:
	score(("wos-" + k), vol)
	music.seek(maxf(0.0, t - float(SONG[k])))
## the level (dB) and the muffle, over secs
func score_level(db: float, secs: float, muffled := false) -> void:
	_score_bus(); if score_tw: score_tw.kill()
	score_tw = create_tween(); score_tw.tween_property(music, "volume_db", db, secs)
	score_tw.parallel().tween_property(_score_lp, "cutoff_hz", 650.0 if muffled else 18000.0, secs)
## the window: the first half of the song out, the breakdown in — timed so it reaches the held beat as she jumps
func score_break(left: float) -> void:
	song_at("b", maxf(float(SONG.b), float(SONG.hold[0]) - left), -3.0); score_holding = true
## falling: the held beat, round and round, the filter opening and the level rising while it waits for SPACE
func score_falling() -> void:
	if not (music.playing and music.stream and music.stream.resource_path.ends_with("wos-b.mp3")): song_at("b", float(SONG.hold[0]), -10.0)
	score_holding = true
	if score_tw: score_tw.kill()
	_score_lp.cutoff_hz = 900.0
	score_tw = create_tween(); score_tw.tween_property(_score_lp, "cutoff_hz", 9000.0, 5.0)
	score_tw.parallel().tween_property(music, "volume_db", -1.0, 5.0)
## BOOM: the drop, now — and the rest of the song for the first roofs
func score_drop() -> void:
	song_at("b", float(SONG.drop), -1.5)
	score_tw = create_tween(); score_tw.tween_interval(6.0); score_tw.tween_property(music, "volume_db", -5.0, 6.0)
func _score_tick() -> void:
	if score_holding and music.playing and music.get_playback_position() >= float(SONG.hold[1]) - float(SONG.b):
		music.seek(float(SONG.hold[0]) - float(SONG.b))

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
	var rec := voice.has(k) and ResourceLoader.exists("res://assets/tsh/voice/%s.mp3" % k)
	if rec: voice_player.stream = load("res://assets/tsh/voice/%s.mp3" % k); voice_player.play()
	face.say(who, text, float(voice[k]) if voice.has(k) else 0.0, rec)
	talk_who = who
var talk_who := ""
## WHERE SHE LOOKS (tsh.js gazeTick): the phone in her hands; whoever is talking; what a film shot shows, when that
## is not her own face; in a fight, whoever is coming at her
func _gaze_target():
	var eye := robin.position + Vector3(0, 1.5, 0); var ry := model.rotation.y
	var seen := func(p: Vector3, far: float, cosmin: float) -> bool:
		var d := Vector2(p.x - eye.x, p.z - eye.z)
		if d.length() >= far: return false
		var dn := d.normalized() if d.length() > 0.01 else Vector2(sin(ry), cos(ry))
		return sin(ry)*dn.x + cos(ry)*dn.y > cosmin
	if staged != null and staged.clip == "text":
		var h = _hands_at()
		if h != null: return h
	if talk_q.size() and talk_who != "" and talk_who != "robin":
		var hp = _head_of(talk_who)
		if hp != null and seen.call(hp, 14.0, -0.25): return hp
	if mode == "reel" and reel_look is Vector3 and (reel_look as Vector3).distance_to(eye) > 0.5 and seen.call(reel_look, 150.0, 0.0): return reel_look
	if mode == "fight":
		var best = null; var bd := 9.0
		for e in fight.E:
			if e.get("hp", 0) <= 0 or e.get("bystander", false): continue
			var d := Vector2(e.x - eye.x, e.z - eye.z).length()
			if d < bd: bd = d; best = Vector3(e.x, e.y + 1.55, e.z)
		return best
	return null
func _bone_pos(n: Node, suffix: String):
	var s: Skeleton3D = _find(n, func(x): return x is Skeleton3D)
	if s == null: return null
	for i in s.get_bone_count():
		if s.get_bone_name(i).ends_with(suffix): return s.global_transform*s.get_bone_global_pose(i).origin
	return null
func _head_of(who: String):
	if who == "canon" and cy.canon != null: return _bone_pos(cy.canon.node, "Head")
	var tags: Array = {"thug": ["t1", "t2"], "dealer": ["buyer"]}.get(who, [who])
	for e in fight.E:
		if (e.tag in tags or e.kind == who) and e.get("node") != null and is_instance_valid(e.node): return _bone_pos(e.node, "Head")
	return null
func _hands_at():
	var a = _bone_pos(model, "LeftHand"); var b = _bone_pos(model, "RightHand")
	return null if a == null or b == null else ((a as Vector3) + (b as Vector3))/2
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
	face.shot_mood(f.shot.get("mood"))
	# depth of field: a shot's "dof" is the distance in focus; behind it goes soft
	if f.shot.has("dof"):
		var at := CameraAttributesPractical.new(); at.dof_blur_far_enabled = true; at.dof_blur_far_distance = float(f.shot.dof) + 0.6
		at.dof_blur_far_transition = maxf(0.8, float(f.shot.dof)*0.8); at.dof_blur_amount = 0.12; cam.attributes = at
	else: cam.attributes = null
	if f.shot.has("enter"): f.shot.enter.call()
	cam.fov = f.shot.get("fov", 50)
	_reel_cam()
## more shots, straight after the one playing (a branch: which way a mash went)
func reel_insert(shots: Array) -> void:
	if reel == null: return
	for i in shots.size(): reel.shots.insert(reel.i + 1 + i, shots[i])
func reel_replace_rest(shots: Array) -> void:
	if reel == null: return
	reel.shots.resize(reel.i + 1); reel.shots.append_array(shots)
func _reel_end(skipped: bool) -> void:
	var d: Callable = reel.done
	dutch = 0.0; lens_roll = 0.0
	reel = null; mode = ""; staged = null; talk_q.clear(); sub_label.text = ""; voice_player.stop(); face.shot_mood(null); reel_look = null; cam.attributes = null
	d.call(skipped)
func _at(v, k: float, t: float) -> Vector3:
	if v is Callable: return v.call(k, t)
	if v is Array and v.size() == 2 and v[0] is Vector3: return (v[0] as Vector3).lerp(v[1], k)
	return v
func _reel_cam() -> void:
	var f = reel; var s = f.shot
	var k := minf(1.0, f.t/s.dur)
	var e := k if s.get("ease", true) == false else k*k*(3 - 2*k)
	var c := _at(s.cam, e, f.t); var l := _at(s.look, e, f.t); reel_look = l
	var br := 0.012 + 0.0006*cam.fov; var tt := Time.get_ticks_msec()/1000.0
	# handheld (a shot's "hand": how much), and a kick that dies away (a blast, a landing)
	var hand: float = s.get("hand", 0.0) + cam_kick
	var hj := Vector3(sin(tt*7.3) + 0.6*sin(tt*13.1 + 1.2), sin(tt*8.7 + 0.4) + 0.5*sin(tt*15.3), sin(tt*6.1 + 2.0))*hand*0.03
	cam.global_position = c + Vector3(sin(tt*0.9)*br + sin(tt*2.3)*br*0.35, sin(tt*1.3 + 1)*br*0.8, cos(tt*0.7)*br) + lens_jitter + hj
	_lens_guard(l)
	if (l - cam.global_position).length() > 0.001: cam.look_at(l)
	if s.has("fov2"): cam.fov = lerpf(s.get("fov", 50), s.fov2, e)
	# the lens, tilted (a cut's dutch angle, easing in) and, while the station falls apart, hand-held
	lens_roll += (dutch - lens_roll)*minf(1, get_process_delta_time()*10)
	if absf(lens_roll) > 0.0005: cam.rotate_object_local(Vector3.FORWARD, lens_roll)
## NEVER INSIDE A WALL. Indoors (the flat, the school, the station) a film's camera is kept on the near side of
## whatever stands between it and what it looks at: the rooms' meshes get collision of their own (once, on a layer
## nothing else uses), and a ray from the subject back to the lens finds the wall the lens would be in
const LENS_LAYER := 1 << 19
var _guarded := {}
func _lens_guard(look: Vector3) -> void:
	if not inside or OS.has_environment("TSH_NOGUARD"): return
	var root: Node3D = {"school": school, "sub": sub}.get(place_now)
	if root == null: return
	if not _guarded.has(place_now):
		_guarded[place_now] = true
		var st: Array = [root]
		while st.size():
			var n: Node = st.pop_back(); st.append_array(n.get_children())
			if not n is MeshInstance3D or String(n.name).begins_with("SH"): continue
			var mi := n as MeshInstance3D
			if mi.mesh == null or mi.skin != null or mi.get_aabb().size.length() < 0.25: continue
			if not mi.mesh is ArrayMesh or mi.mesh.get_surface_count() == 0 or (mi.mesh as ArrayMesh).surface_get_primitive_type(0) != Mesh.PRIMITIVE_TRIANGLES: continue
			if mi.mesh.get_faces().is_empty(): continue
			mi.create_trimesh_collision()
			for c in mi.get_children():
				if c is StaticBody3D: (c as StaticBody3D).collision_layer = LENS_LAYER; (c as StaticBody3D).collision_mask = 0
	var p := cam.global_position; var to := p - look
	if to.length() < 1.0: return
	# from a little way out from the subject (what a shot looks at often sits on a surface: a bench, the floor)
	var q := PhysicsRayQueryParameters3D.create(look + to.normalized()*0.6, p + to.normalized()*0.1, LENS_LAYER); q.hit_back_faces = true
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty() or not hit.collider.is_visible_in_tree(): return
	cam.global_position = (hit.position as Vector3) - to.normalized()*0.12
func _tick_reel(dt: float) -> void:
	var f = reel; var s = f.shot
	f.t += dt
	cam_kick = maxf(0, cam_kick - dt*3)
	var bs: Array = s.get("beats", [])
	for j in bs.size():
		if f.t >= bs[j][0] and not f.fired.has(j): f.fired[j] = true; bs[j][1].call()
	if reel != f: return
	if s.has("tick"): s.tick.call(dt, f.t, minf(1.0, f.t/s.dur))
	if staged != null: robin.position = staged.pos; model.rotation.y = staged.ry
	_reel_cam()
	if OS.has_environment("TSH_REELLOG") and Engine.get_process_frames() % 15 == 0: print("REEL ms=", Time.get_ticks_msec(), " fr=", Engine.get_frames_drawn(), " i=", f.i, " t=", snappedf(f.t, 0.01), " cam=", cam.global_position.snapped(Vector3.ONE*0.01), " fov=", snappedf(cam.fov, 0.1), " mode=", mode)
	if f.t >= s.dur: _reel_next()
func rel(x: float, z: float, ry: float, d: float, s_: float, y: float) -> Vector3:
	return Vector3(x + sin(ry)*d - cos(ry)*s_, y, z + cos(ry)*d + sin(ry)*s_)
func walk_stage(a: Vector2, b: Vector2, k: float) -> void:
	stage("walk", lerpf(a.x, b.x, k), 0, lerpf(a.y, b.y, k), atan2(b.x - a.x, b.y - a.y))
func black(v: bool) -> void:
	black_rect.visible = v
	if not v and end_label: end_label.text = ""
func end_text(t: String) -> void:
	if end_label == null:
		end_label = _rich(Vector2.ZERO, Vector2(900, 300), 34)
	var vp := get_viewport().get_visible_rect().size
	end_label.position = Vector2((vp.x - 900)/2, vp.y/2 - 90)
	end_label.text = "[center]" + t + "[/center]"
func ringing(v: bool) -> void:
	if v and not ringing_on: cue("ring"); ring_t = 1.5
	ringing_on = v
## tsh.js startBed / muffle: rain while it is raining (the night), muffled indoors; the city's hum, by day only
## its low rumble
func _bed(dt: float) -> void:
	if bed.is_empty(): return
	var d := day(); var rain := 0.0 if d else (0.025 if inside else 0.05)
	var want := {"rain": 0.0 if inside else rain, "rain_in": rain if inside else 0.0, "hum": 0.0 if d else 0.07, "hum_day": 0.09 if d else 0.0}
	var k := 1.0 - exp(-dt/0.4)
	for n in bed:
		var e: Array = bed[n]; e[1] = lerpf(e[1], want[n], k)
		(e[0] as AudioStreamPlayer).volume_db = linear_to_db(maxf(e[1], 0.00001))
## the glow: only on the shoes, only out in the city; brighter as her flow builds, gold when a press would be perfect
func _tick_glow() -> void:
	if _shoes == null: _shoes = _find(model, func(x): return x is Node3D and x.name == KIT_MESH.shoes)
	var shoes: Node3D = _shoes
	var on: bool = shoes != null and shoes.visible and not inside and model.visible and robin.visible
	var col := Color(2.6, 1.9, 0.5, 0.85) if boots.gold else Color(0.4 + boots.flow*1.2, 1.6 + boots.flow*0.6, 2.2, 0.85)
	for e in shoe_glow:
		var n: MeshInstance3D = e[0]; n.visible = on
		if on: (n.material_override as StandardMaterial3D).albedo_color = col; n.scale = (e[1] as Vector3)*(1 + boots.flow*0.8 + (0.8 if boots.gold else 0.0))
func hidden_in_cover() -> bool: return chase.cover != null
func _v(a) -> Vector3: return Vector3(a[0], a[1], a[2])

# ================================================================== the beats
func _enter() -> void:
	if S.step == "intro": intro.start(); return
	if day(): today.enter(); return
	match S.step:
		"wake": opening()
		"lesson":
			kit_all(true); show_inside(false); place(HOME_ROOF, PI/2); lesson_begin(true)
		"raid":
			kit_all(true); show_inside(false)
			var st: int = int(S.get("raid", {}).get("stage", 0)) if "raid" in S.seen else 0
			place(chase._stage_start(st) if "raid" in S.seen else Vector3(-41.4, 0, -12.2), PI/2); _beat_start()
		"night", "end":
			kit_all(true); show_inside(false); place(Vector3(73, 12, 34), -PI/2); _beat_start()
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
			fight.cast(CREW)
		"raid":
			if "raid" in S.seen: raid.go(int(S.get("raid", {}).get("stage", 0)))
			else: raid.intro()
		"night": raid.night()
		"school":
			var d: Array = nav.spots.schoolDoor
			marker.position = Vector3(d[0], 30, d[1]); marker.visible = true
		"sneak": hs.sneak_begin()
		"courtyard": pass
		"end":
			mode = "end"; black(true); end_text("END OF PROLOGUE\n\n[color=#9fb4c0]Somebody has noticed her.[/color]")

## INT. ROBIN'S ROOM — 22:15. The buyer calls; she gets up; the kit, piece by piece; the note from her mother; the
## window, the sill over Kiln Street, and the jump (tsh.js opening())
## after_call: the film picks up after the buyer's call (the new start has played it, with Canon on the other line)
func opening(after_call := false) -> void:
	var R: Dictionary = room.room; var a: Dictionary = room.apt; var bed: Dictionary = R.bed
	var cx: float = (a.x1 + a.x2)/2; var cz: float = (a.z1 + a.z2)/2
	show_inside(true); lamp.light_energy = 0; kit_all(false); apt_boots(true); apt_pack(true); apt_window(false); _form_jacket(true); _note_home()
	var sit_up := func(): stage("wake", bed.x - 0.15, bed.seat, bed.z - 0.05, PI/2)
	var shoe := _v(R.boots.at); var form := _v(R.form.at); var pack := _v(R.pack.at); var kitc := _v(R.kitchen.at); var notep := _v(R.note.at)
	var mom := _v(R.momDoor.at); var win := _v(R.window.at); var bench := _v(R.bench.at); var P := _v(R.packing.at)
	var stop := Vector2(cx + 2.4, cz + 0.9); var at_table := Vector2(kitc.x - 0.3, kitc.z + 0.95)
	var J := Vector2(form.x + 0.75, form.z + 0.6); var jry := atan2(0.75, 0.6)
	var GL := Vector2(bench.x + 0.85, bench.z + 1.3); var gry := atan2(1, 0.55)
	var BR := Vector2(shoe.x + 0.7, shoe.z - 0.4); var bry := PI/2
	var face_table := atan2(kitc.x - at_table.x, kitc.z - at_table.y); var face_mom := atan2(mom.x - at_table.x, mom.z - at_table.y)
	if not after_call: black(true)
	score("wos-a", -14)
	var shots := [
		{"mood": "sleepy", "dur": 9.0, "fov": 40, "inside": true, "cam": Vector3(bed.x + 1.5, 1.6, bed.z - 1), "look": Vector3(bed.x, 0.8, bed.z),
			"enter": func(): sit_up.call(); ringing(true); get_tree().create_timer(0.6).timeout.connect(func(): if reel: phone_show("call", "UNKNOWN")),
			"beats": [[3.2, func(): ringing(false); cue("ui"); phone_show("oncall", "UNKNOWN")], [3.7, func(): talk("call")], [8.1, func(): cue("hangup"); phone_show("")]]},
		{"mood": "sleepy", "dur": 5.2, "fov": 50, "cam": [Vector3(a.x2 - 0.5, 2.5, a.z2 - 0.7), Vector3(a.x2 - 1.5, 2.2, a.z2 - 1.3)], "look": [Vector3(bed.x, 0.9, bed.z), Vector3(bed.x - 0.6, 0.9, bed.z - 0.4)],
			"enter": func(): sit_up.call(); lamp.light_energy = 1.6; cue("ui"); get_tree().create_timer(0.25).timeout.connect(func(): black(false)); set_caption("INT. ROBIN'S ROOM — 22:15")},
		{"dur": 4.2, "fov": 42, "cam": [Vector3(bench.x + 0.9, 1.75, bench.z + 1.75), Vector3(bench.x - 0.9, 1.7, bench.z + 1.65)], "look": [Vector3(bench.x + 0.4, 0.98, bench.z - 0.05), Vector3(bench.x - 1.3, 0.98, bench.z - 0.05)]},
		{"dur": 3.6, "fov": 40, "cam": [Vector3(form.x + 2.0, 1.55, form.z + 1.4), Vector3(form.x + 1.5, 1.5, form.z + 1.0)], "look": [Vector3(form.x - 0.2, 1.4, form.z - 0.2), Vector3(form.x - 0.3, 1.45, form.z - 0.3)]},
		{"dur": 4.0, "fov": 44, "cam": [Vector3(P.x - 1.45, 1.95, P.z + 1.3), Vector3(P.x - 1.35, 1.8, P.z - 1.0)], "look": [Vector3(P.x, 0.85, P.z + 0.35), Vector3(P.x, 0.85, P.z - 0.6)]},
		{"dur": 3.0, "fov": 34, "cam": [Vector3(shoe.x + 1.1, 0.42, shoe.z - 0.7), Vector3(shoe.x + 0.85, 0.32, shoe.z - 0.45)], "look": Vector3(shoe.x, 0.12, shoe.z)},
		{"mood": "tired", "dur": 3.0, "fov": 44, "cam": [Vector3(bed.x + 1.7, 1.55, bed.z - 2.4), Vector3(bed.x + 1.4, 1.6, bed.z - 2.1)], "look": Vector3(bed.x + 0.6, 1.25, bed.z - 1.0),
			"enter": func(): stage("idle", bed.x + 0.6, 0, bed.z - 1.15, PI)},
	]
	shots.append_array(suit_shots())
	shots.append_array(window_shots())
	if after_call: shots.pop_front()
	play_reel(shots, func(_skipped): fall_start())

## HER KIT, PIECE BY PIECE, AND THE NOTE — as the browser films it (tsh.js opening(), the jacket to the note put
## down): the jacket off the form; the gloves at the bench; down on one knee by the window for the shoes; the
## bracelet; the backpack, and the door; she stops; dinner on the table, covered, and a note; her mother's door, dark;
## the note picked up, looked at, put back. on_pack: anything else that goes into the pack as she takes it
func suit_shots(on_pack := Callable()) -> Array:
	var R: Dictionary = room.room; var a: Dictionary = room.apt
	var cx: float = (a.x1 + a.x2)/2; var cz: float = (a.z1 + a.z2)/2
	var shoe := _v(R.boots.at); var form := _v(R.form.at); var pack := _v(R.pack.at); var kitc := _v(R.kitchen.at); var notep := _v(R.note.at)
	var mom := _v(R.momDoor.at); var bench := _v(R.bench.at)
	var stop := Vector2(cx + 2.4, cz + 0.9); var at_table := Vector2(kitc.x - 0.3, kitc.z + 0.95)
	var J := Vector2(form.x + 0.75, form.z + 0.6); var jry := atan2(0.75, 0.6)
	var GL := Vector2(bench.x + 0.85, bench.z + 1.3); var gry := atan2(1, 0.55)
	var BR := Vector2(shoe.x + 0.7, shoe.z - 0.4); var bry := PI/2
	var face_table := atan2(kitc.x - at_table.x, kitc.z - at_table.y); var face_mom := atan2(mom.x - at_table.x, mom.z - at_table.y)
	return [
		# the jacket, off the form
		{"mood": "focused", "dur": 3.2, "fov": 42, "cam": [Vector3(form.x + 1.9, 1.6, form.z + 1.6), Vector3(form.x + 1.6, 1.55, form.z + 1.3)], "look": Vector3(form.x + 0.3, 1.3, form.z + 0.3),
			"enter": func(): stage("idle", J.x, 0, J.y, jry + PI), "beats": [[1.3, func(): _form_jacket(false); kit("jacket", true); cue("zip")]]},
		{"mood": "focused", "dur": 2.2, "fov": 34, "cam": rel(J.x, J.y, jry, 0.95, 0.25, 1.4), "look": rel(J.x, J.y, jry, 0, 0, 1.2), "enter": func(): stage("idle", J.x, 0, J.y, jry), "beats": [[0.3, func(): cue("gear")]]},
		# the gloves, at the bench
		{"mood": "focused", "dur": 2.8, "fov": 34, "cam": rel(GL.x, GL.y, gry, 0.95, -0.2, 1.4), "look": rel(GL.x, GL.y, gry, 0.3, 0, 1.1),
			"enter": func(): stage("text", GL.x, 0, GL.y, gry), "beats": [[0.9, func(): kit("gloves", true); cue("gear")]]},
		# the shoes: down on one knee by the window
		{"mood": "focused", "dur": 3.2, "fov": 38, "cam": [Vector3(shoe.x + 1.5, 0.6, shoe.z - 1.1), Vector3(shoe.x + 1.2, 0.5, shoe.z - 0.8)], "look": Vector3(shoe.x + 0.2, 0.3, shoe.z),
			"enter": func(): stage("kneel", shoe.x + 0.35, 0, shoe.z, -PI/2), "beats": [[1.5, func(): kit("shoes", true); apt_boots(false); cue("gear")]]},
		# the bracelet
		{"mood": "soft", "dur": 2.6, "fov": 30, "cam": rel(BR.x, BR.y, bry, 0.75, 0.35, 1.3), "look": rel(BR.x, BR.y, bry, 0.3, 0.15, 1.1),
			"enter": func(): stage("text", BR.x, 0, BR.y, bry), "beats": [[0.8, func(): kit("bracelet", true); cue("gear"); get_tree().create_timer(0.26).timeout.connect(func(): cue("pick"))]]},
		# the backpack, and the door
		{"mood": "focused", "dur": 3.0, "fov": 46, "cam": [Vector3(pack.x + 1.2, 1.5, pack.z - 2.2), Vector3(stop.x - 0.6, 1.55, stop.y - 2.0)], "look": func(k, t): return robin.position + Vector3(0, 1.1, 0),
			"enter": func(): apt_pack(false); kit("pack", true); cue("pick"); if on_pack.is_valid(): on_pack.call(), "tick": func(dt, t, k): walk_stage(Vector2(pack.x - 0.2, pack.z - 0.5), stop, minf(1, k*1.05))},
		{"mood": "sad", "dur": 2.0, "fov": 40, "cam": Vector3(stop.x + 1.3, 1.5, stop.y + 1.4), "look": Vector3(stop.x, 1.4, stop.y),
			"enter": func(): stage("idle", stop.x, 0, stop.y, atan2(kitc.x - stop.x, kitc.z - stop.y)); score_level(-14.0, 2.0)},
		# the kitchen: dinner on the table, still covered, and a note
		{"mood": "sad", "dur": 3.4, "fov": 34, "cam": [Vector3(kitc.x + 0.9, 1.35, kitc.z + 1.2), Vector3(kitc.x + 0.55, 1.2, kitc.z + 0.8)], "look": Vector3(kitc.x, 0.8, kitc.z),
			"enter": func(): stage("idle", at_table.x, 0, at_table.y, face_table); score_level(-26.0, 2.5, true)},
		{"mood": "sad", "dur": 2.6, "fov": 34, "cam": Vector3(kitc.x + 0.25, 1.4, kitc.z - 0.35), "look": Vector3(at_table.x, 1.45, at_table.y)},
		{"mood": "sad", "dur": 3.0, "fov": 24, "cam": Vector3(notep.x - 0.05, notep.y + 0.55, notep.z + 0.28), "look": notep, "ease": false},
		{"mood": "sad", "dur": 2.8, "fov": 40, "cam": Vector3(at_table.x + 0.45, 1.65, at_table.y + 0.8), "look": Vector3(mom.x, 1.2, mom.z), "enter": func(): stage("idle", at_table.x, 0, at_table.y, face_mom)},
		# she picks the note up, looks at it; and puts it back down
		{"mood": "sad", "dur": 3.6, "fov": 40, "cam": rel(at_table.x, at_table.y, face_table, 0.85, 0.15, 1.5), "look": rel(at_table.x, at_table.y, face_table, 0.15, 0, 1.3),
			"enter": func(): stage("text", at_table.x, 0, at_table.y, face_table), "tick": func(dt, t, k): _note_hold()},
		{"mood": "resolve", "dur": 2.2, "fov": 32, "cam": Vector3(kitc.x + 0.6, 1.25, kitc.z + 0.55), "look": Vector3(notep.x, 0.8, notep.z), "enter": func(): _note_home(); stage("idle", at_table.x, 0, at_table.y, face_table)},
	]

## THE WINDOW, THE SILL, THE JUMP — as the browser films it (tsh.js opening(), its last five shots): the window
## up and the city in; up onto the sill; outside, on the sill over Kiln Street, a look down; a smile; she jumps. Then
## fall_start(): falling, slow, the beat held, until SPACE
func window_shots() -> Array:
	var win := _v(room.room.window.at)
	return [
		# THE WINDOW. The city comes in.
		{"mood": "determined", "dur": 3.2, "fov": 44, "cam": Vector3(win.x + 2.4, 1.6, win.z - 1.2), "look": Vector3(win.x, 1.5, win.z),
			"enter": func(): score_break(11.6),
			"tick": func(dt, t, k): _to_window(win, k),
			"beats": [[1.7, func(): apt_window(true); cue("window")], [2.5, func(): shades(true); cue("ui")]]},
		{"mood": "focused", "dur": 2.4, "fov": 40, "cam": Vector3(win.x + 2.2, 0.6, win.z + 0.6), "look": Vector3(win.x + 0.2, 1.6, win.z), "enter": func(): stage("kneel", win.x + 0.32, 1.0, win.z, -PI/2)},
		# OUTSIDE: on the sill, over Kiln Street
		{"mood": "focused", "dur": 3.0, "fov": 42, "inside": false, "cam": [Vector3(55.3, 13.4, 30.8), Vector3(55.5, 13.1, 31.5)], "look": Vector3(SILL.x - 0.2, SILL.y + 0.5, SILL.z),
			"enter": func(): stage("idle", SILL.x, SILL.y, SILL.z, -PI/2); set_caption("EXT. KILN STREET — 22:17")},
		{"mood": "grin", "dur": 2.2, "fov": 36, "cam": Vector3(SILL.x - 1.7, SILL.y + 1.65, SILL.z + 0.45), "look": Vector3(SILL.x, SILL.y + 1.5, SILL.z)},
		{"mood": "grin", "dur": 0.8, "fov": 56, "cam": Vector3(56.8, 6.6, 37.6), "look": func(k, t): return robin.position + Vector3(0, 1, 0),
			"enter": func(): cue("kick"), "tick": func(dt, t, k): stage("jump", SILL.x - k*1.6, SILL.y + sin(k*PI*0.6)*0.7, SILL.z, -PI/2)},
	]

## the jacket on the dress form: there until she takes it
func _form_jacket(v: bool) -> void:
	var j := apt_node("form_jacket")
	if j: j.visible = v
## MOM'S NOTE (tshroom.js room.note): on the kitchen table; in her hands while she reads it. Its paper is drawn unlit,
## and in Godot's grade that is past white — it is taken down to read as paper
var _note: MeshInstance3D = null; var _note_xf: Transform3D
func _note_node() -> MeshInstance3D:
	if _note: return _note
	var at := _v(room.room.note.at)
	var st: Array = [apt]
	while st.size():
		var n: Node = st.pop_back(); st.append_array(n.get_children())
		if not n is MeshInstance3D: continue
		var mi := n as MeshInstance3D; var bb := mi.global_transform*mi.get_aabb()
		if bb.size.length() < 0.3 and bb.get_center().distance_to(at) < 0.06:
			_note = mi; _note_xf = mi.global_transform
			var m = mi.get_active_material(0)
			if m is StandardMaterial3D:
				var m2 := (m as StandardMaterial3D).duplicate() as StandardMaterial3D; m2.albedo_color = m2.albedo_color*0.62; mi.material_override = m2
			return _note
	return null
func _note_home() -> void:
	var n := _note_node()
	if n: n.global_transform = _note_xf
func _note_hold() -> void:
	var n := _note_node(); var sk: Skeleton3D = _find(model, func(x): return x is Skeleton3D)
	if n == null or sk == null: return
	var hand := Vector3.ZERO; var c := 0; var head := Vector3.ZERO
	for i in sk.get_bone_count():
		var bn := sk.get_bone_name(i)
		if bn.ends_with("LeftHand") or bn.ends_with("RightHand"): hand += sk.global_transform*sk.get_bone_global_pose(i).origin; c += 1
		elif bn.ends_with("Head"): head = sk.global_transform*sk.get_bone_global_pose(i).origin
	if c == 0: return
	var p := hand/c + Vector3(0, 0.03, 0)
	n.global_position = p
	if head.distance_to(p) > 0.05: n.look_at(head, Vector3.UP, true)      # its face (+Z, as three.js lookAt turns it) to her
func _to_window(win: Vector3, k: float) -> void:
	if k < 0.45: walk_stage(Vector2(win.x + 2.0, win.z - 0.9), Vector2(win.x + 0.75, win.z), k/0.45)
	else: stage("idle", win.x + 0.75, 0, win.z, -PI/2)

## THE HANDOFF (draft 1.1, shot 31): the film ends with her already falling, the shoes already fired; the player
## takes her mid-air with her speed and her heading — no prompt, no card, no voice. The lesson's card waits a few seconds
func take_over(p: Vector3, v: Vector3, yaw: float) -> void:
	black(false); phone_show(""); kit_all(true); shades(true); show_inside(false); robin.visible = true; model.rotation.x = 0
	if S.step in ["intro", "wake"]: S.step = "wake"; outcome("out")
	S.lesson = 1
	place(p, yaw)
	boots.vx = v.x; boots.vy = v.y; boots.vz = v.z; boots.ground = false; boots.state = "air"; boots.air_t = 0.3; boots.cut = true
	cam_yaw = atan2(-v.x, -v.z)
	lesson_begin(false)
	card.visible = false; obj_label.visible = false
	get_tree().create_timer(5.0).timeout.connect(func(): if S.step == "lesson": card.visible = true; obj_label.visible = true)
	_save()
## off the sill, falling towards Kiln Street — slowly, until SPACE fires the shoes
func fall_start() -> void:
	black(false); phone_show(""); kit_all(true); show_inside(false)
	if S.step in ["intro", "wake"]: S.step = "wake"; outcome("out")
	S.lesson = 0
	place(Vector3(SILL.x - 1.6, SILL.y + 0.55, SILL.z), 0.35)
	boots.vx = -2; boots.vy = 1.2; boots.ground = false; boots.state = "air"; boots.air_t = 0.2
	letterbox(false); robin.visible = true; model.rotation.x = 0
	score_falling()
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
	boots.ignite(cam_yaw); score_drop(); station.flash(0.6, Color(1, 1, 1)); lesson_next()      # the song's drop is the boom

# ------------------------------------------------------------------ Dragon Alley
var bag: Node3D; var bag_on = null; var pack: Node3D
func crew(tag: String): return fight.pick(tag) if fight.pick(tag).has("node") else null
func crew_walk(e, a: Vector2, b: Vector2, k: float, nm := "walk") -> void:
	if e == null: return
	e.node.visible = true; e.x = lerpf(a.x, b.x, k); e.z = lerpf(a.y, b.y, k)
	if k < 1: e.yaw = atan2(b.x - a.x, b.y - a.y); fight.play(e, nm)
	fight._place(e)
func crew_face(e, x: float, z: float, nm := "") -> void:
	if e == null: return
	e.yaw = atan2(x - e.x, z - e.z)
	if nm != "": fight.play(e, nm)
	fight._place(e)
func _bag_mesh() -> Node3D:
	var b := Node3D.new()
	var m := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.24, 0.17, 0.09); m.mesh = bm
	var mat := StandardMaterial3D.new(); mat.albedo_color = Color(0.1, 0.11, 0.125); mat.roughness = 0.85; m.material_override = mat; b.add_child(m)
	var tag := MeshInstance3D.new(); var tm := QuadMesh.new(); tm.size = Vector2(0.06, 0.03); tag.mesh = tm
	var tmat := StandardMaterial3D.new(); tmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; tmat.albedo_color = Color(0.22, 1, 0.82); tag.material_override = tmat; tag.position = Vector3(0.05, 0.02, 0.0455); b.add_child(tag)
	add_child(b); return b
func _hand(n: Node3D) -> Vector3:
	var sk: Skeleton3D = _find(n, func(x): return x is Skeleton3D)
	if sk:
		for i in sk.get_bone_count():
			if sk.get_bone_name(i).ends_with("RightHand"): return sk.global_transform*sk.get_bone_global_pose(i).origin
	return n.global_position + Vector3(0, 1, 0)
func _crew_bag(_dt: float) -> void:
	if bag == null or bag_on == null: return
	if bag_on is String and bag_on == "robin": bag.global_position = _hand(model) + Vector3(0, -0.1, 0)
	elif bag_on is Dictionary and bag_on.has("node"): bag.global_position = _hand(bag_on.node) + Vector3(0, -0.1, 0)

## EXT. DRAGON ALLEY. She walks in; the buyer and two of his at the bend; "You got the stuff?" — "About that…" — the
## rest of them come out; "Oh." — "You're gonna be annoying." — the bag taken out of her hand; the shove; "Okay." —
## the backpack off; "I really hate when people make me do things twice." (tsh.js fightIntro)
func fight_intro() -> void:
	talk_q.clear()
	var R0: Vector2 = Fight.MEET.robin; var B0: Vector2 = Fight.MEET.buyer
	var ry := atan2(B0.x - R0.x, B0.y - R0.y); var by := atan2(R0.x - B0.x, R0.y - B0.y)
	var R1 := Vector2(R0.x + 0.05, R0.y + 0.6)
	var buyer = crew("buyer"); var t1 = crew("t1"); var t2 = crew("t2")
	var head := func(x: float, z: float, y := 1.55): return Vector3(x, y, z)
	if bag: bag.queue_free()
	bag = _bag_mesh(); bag_on = "robin"
	var ring_face := func(nm: String):
		for t in ["t1", "t2", "t3", "t4", "t5", "t6"]:
			var e = crew(t)
			if e: e.node.visible = true; crew_face(e, robin.position.x, robin.position.z, nm)
	var shots := [
		{"dur": 4.6, "fov": 46, "cam": [Vector3(-39.8, 1.0, -12.2), Vector3(-40.1, 1.3, -13.6)], "look": [Vector3(-41.4, 1.5, -24), Vector3(-41.4, 1.5, -26)],
			"enter": func(): set_caption("EXT. DRAGON ALLEY — 22:31"); cue("step"),
			"tick": func(dt, t, k): walk_stage(Vector2(-41.0, -12.8), Vector2(-41.3, -19.6), k)},
		{"dur": 3.0, "fov": 40, "cam": [Vector3(-40.9, 1.75, -31.8), Vector3(-40.9, 1.7, -31.3)], "look": Vector3(-41.4, 1.3, -22),
			"tick": func(dt, t, k): _walk_in(R0, ry, k)},
		{"dur": lines_len("fightIn1") + 0.3, "fov": 36, "cam": rel(B0.x, B0.y, by, -0.85, 0.42, 1.78), "look": head.call(R0.x, R0.y, 1.5),
			"enter": func(): stage("idle", R0.x, 0, R0.y, ry); talk("fightIn1"); fight.play(buyer, "talk")},
		{"dur": lines_len("fightIn2") + 0.6, "fov": 32, "cam": rel(R0.x, R0.y, ry, -0.8, 0.4, 1.7), "look": head.call(B0.x, B0.y, 1.62),
			"enter": func(): talk("fightIn2"); fight.play(buyer, "talk")},
		{"dur": 4.4, "fov": 66, "cam": [Vector3(-40.4, 3.6, -16.4), Vector3(-40.4, 3.75, -17.4)], "look": Vector3(-41.2, 0.8, -26.2),
			"enter": func(): cue("step"); fight.play(buyer, "idle"),
			"tick": func(dt, t, k): _come_out(k, t2, R0)},
		{"dur": lines_len("fightIn3") + 0.6, "fov": 30, "cam": rel(R0.x, R0.y, ry, 0.95, -0.12, 1.6), "look": head.call(R0.x, R0.y),
			"enter": func(): talk("fightIn3"); ring_face.call("fight")},
		{"dur": lines_len("fightIn4") + 0.4, "fov": 42, "cam": Vector3(-39.6, 1.5, -24.0), "look": Vector3(-41.4, 1.35, -24.8),
			"enter": func(): stage("talk", R0.x, 0, R0.y, ry); talk("fightIn4")},
		{"dur": 1.8, "fov": 44, "cam": Vector3(-39.5, 1.25, -25.3), "look": Vector3(-41.6, 1.2, -25.2),
			"enter": func(): stage("idle", R0.x, 0, R0.y, ry),
			"tick": func(dt, t, k): _take_bag(t1, R0, t),
			"beats": [[0.72, func(): fight.hit1(t1, "jab")], [0.95, func(): bag_on = t1; cue("kick")]]},
		{"dur": lines_len("fightIn5") + 0.4, "fov": 38, "cam": rel(R0.x, R0.y, ry, -0.8, -0.45, 1.7), "look": Vector3((B0.x + R0.x)/2, 1.3, B0.y + 1.2),
			"enter": func(): stage("talk", R0.x, 0, R0.y, ry); talk("fightIn5"),
			"tick": func(dt, t, k): _step_back(t1, R0, t),
			"beats": [[maxf(0.8, lines_len("fightIn5") - 1.5), func(): fight.hit1(t1, "jab"); bag_on = buyer]]},
		{"dur": 1.7, "fov": 50, "cam": Vector3(-39.5, 1.4, -24.0), "look": Vector3(-41.5, 1.2, -25.0),
			"enter": func(): stage("idle", R0.x, 0, R0.y, ry),
			"tick": func(dt, t, k): _shove(t1, R0, R1, ry, t),
			"beats": [[0.35, func(): fight.hit1(t1, "cross")], [0.55, func(): cue("hurt")]]},
		{"dur": lines_len("fightIn6") + 0.7, "fov": 28, "cam": rel(R1.x, R1.y, ry, 0.9, 0.1, 1.6), "look": head.call(R1.x, R1.y),
			"enter": func(): stage("idle", R1.x, 0, R1.y, ry); talk("fightIn6"); crew_walk(t1, Vector2(-41.6, -25.45), Vector2(-41.8, -26.2), 1); crew_face(t1, R1.x, R1.y, "fight")},
		{"dur": 1.6, "fov": 44, "cam": Vector3(-39.7, 0.42, -23.0), "look": Vector3(-41.2, 0.45, -23.8),
			"beats": [[0.3, func(): cue("door")]]},
		{"dur": lines_len("fightIn7") + 0.9, "fov": 38, "cam": rel(R1.x, R1.y, ry, 1.7, 0.7, 0.75), "look": head.call(R1.x, R1.y, 1.45),
			"enter": func(): stage("fight", R1.x, 0, R1.y, ry); talk("fightIn7"),
			"beats": [[maxf(0.4, lines_len("fightIn7") - 0.3), func(): cue("gear")]]}]
	play_reel(shots, func(_s): fight_begin(R1, ry))
func _walk_in(R0: Vector2, ry: float, k: float) -> void:
	if k < 0.92: walk_stage(Vector2(-41.3, -19.6), R0, k/0.92)
	else: stage("idle", R0.x, 0, R0.y, ry)
func _come_out(k: float, t2, R0: Vector2) -> void:
	var m := minf(1, k*1.1)
	for pair in [["t3", Vector2(-47.0, -19.6)], ["t4", Vector2(-33.2, -12.6)], ["t5", Vector2(-33.6, -34.6)], ["t6", Vector2(-46.6, -32.2)], ["t1", Vector2(-42.7, -29.5)]]:
		var to: Vector2 = RINGED[pair[0]]
		crew_walk(crew(pair[0]), pair[1], to, m, "sprint" if to.distance_to(pair[1]) > 7 else "walk")
	crew_face(t2, R0.x, R0.y, "fight" if k > 0.5 else "")
func _take_bag(t1, R0: Vector2, t: float) -> void:
	if t < 0.7: crew_walk(t1, RINGED.t1, Vector2(-41.75, -25.45), t/0.7)
	else: crew_face(t1, R0.x, R0.y)
func _step_back(t1, R0: Vector2, t: float) -> void:
	if t < 0.6: crew_walk(t1, Vector2(-41.75, -25.45), Vector2(-41.9, -26.3), t/0.6, "walk_back")
	crew_face(t1, R0.x, R0.y, "fight" if t >= 0.6 else "")
func _shove(t1, R0: Vector2, R1: Vector2, ry: float, t: float) -> void:
	if t < 0.4: crew_walk(t1, Vector2(-41.9, -26.3), Vector2(-41.6, -25.45), t/0.4)
	else: crew_face(t1, R0.x, R0.y)
	if t >= 0.55:
		var q := minf(1, (t - 0.55)/0.3)
		stage("stagger" if t < 1.2 else "idle", lerpf(R0.x, R1.x, q), 0, lerpf(R0.y, R1.y, q), ry)

## it is yours: the fight
func fight_begin(R1: Vector2, ry: float) -> void:
	staged = null; talk_q.clear()
	for t in RINGED:
		var e = crew(t)
		if e: e.node.visible = true; e.x = RINGED[t].x; e.z = RINGED[t].y; fight._place(e)
	var buyer = crew("buyer")
	if buyer: buyer.state = "watch"; buyer.home = BUYER_CORNER; bag_on = buyer
	robin.position = Vector3(R1.x, 0, R1.y); cam_yaw = ry + PI; cam_pitch = 0.0
	mode = "fight"; marker.visible = false; ring.visible = false
	objective("Fight your way out.")
	score("wos-b", -10)
	fight.start(func(): fight_outro())

## after: the ones still standing run; she walks to the buyer in his corner; the bag; "So…" — "My money?" — nothing —
## "Right. Worth a shot." — the buyer bolts; her phone: a number she does not know (tsh.js fightOutro)
func fight_outro() -> void:
	mode = ""
	var buyer = crew("buyer")
	var from := Vector2(robin.position.x, robin.position.z); var BP := BUYER_CORNER
	var SPOT := Vector2(BP.x - 0.25, BP.y + 1.65); var BAG := Vector2(BP.x - 0.15, BP.y + 0.95)
	var ry := atan2(BP.x - SPOT.x, BP.y - SPOT.y); var by := ry + PI
	var Q := Vector2(-41.0, -23.3)
	var runners := fight.E.filter(func(e): return e.kind != "buyer" and e.state in ["hesitate", "circle", "approach", "recover", "stagger", "windup", "getup", "idle", "watch"])
	for e in runners: e.flee = [e.x, e.z, e.x, -7.0 if e.z > from.y else -47.0]; e.state = "fled"
	if buyer: buyer.state = "cut"; buyer.x = BP.x; buyer.z = BP.y; buyer.yaw = by + PI; fight._place(buyer)
	var shots := [
		{"dur": 3.4, "fov": 55, "cam": Vector3(-39.5, 3.7, -20.5), "look": Vector3(-41.3, 0.5, -29),
			"enter": func(): _cornered(buyer, SPOT, BAG),
			"tick": func(dt, t, k): _flee(runners, t); walk_stage(from, SPOT, minf(1, k*1.08))},
		{"dur": 2.4, "fov": 42, "cam": Vector3(-39.4, 0.8, -30.2), "look": Vector3(BAG.x, 0.4, BAG.y),
			"enter": func(): _flee(runners, 9); stage("kneel", SPOT.x, 0, SPOT.y, ry), "beats": [[1.1, func(): bag_on = "robin"; cue("pick")]]},
		{"dur": lines_len("fightOut1") + 1.2, "fov": 38, "cam": rel(SPOT.x, SPOT.y, ry, 1.1, 0.35, 1.72), "look": Vector3(SPOT.x, 1.32, SPOT.y),
			"enter": func(): stage("text", SPOT.x, 0, SPOT.y, ry), "beats": [[0.6, func(): talk("fightOut1")]]},
		{"dur": lines_len("fightOut2") + 0.4, "fov": 34, "cam": rel(SPOT.x, SPOT.y, ry, -0.75, 0.4, 1.7), "look": Vector3(BP.x, 1.5, BP.y),
			"enter": func(): stage("talk", SPOT.x, 0, SPOT.y, ry); talk("fightOut2"); _crew_idle(buyer)},
		{"dur": 2.0, "fov": 30, "cam": rel(BP.x, BP.y, by, 1.0, -0.25, 1.72), "look": Vector3(BP.x, 1.66, BP.y), "enter": func(): stage("idle", SPOT.x, 0, SPOT.y, ry)},
		{"dur": lines_len("fightOut3") + 0.5, "fov": 40, "cam": rel(SPOT.x, SPOT.y, ry, 1.6, -0.9, 1.45), "look": Vector3(SPOT.x, 1.3, SPOT.y),
			"enter": func(): stage("talk", SPOT.x, 0, SPOT.y, ry); talk("fightOut3")},
		{"dur": 4.2, "fov": 50, "cam": Vector3(-42.7, 2.6, -34.6), "look": Vector3(-41.3, 0.9, -25.5),
			"tick": func(dt, t, k): walk_stage(SPOT, Q, minf(1, k*1.06)); _buyer_bolts(buyer, BP, t)},
		{"dur": lines_len("fightText") + 1.6, "fov": 36, "cam": Vector3(Q.x + 0.05, 1.3, Q.y + 1.35), "look": Vector3(Q.x + 0.32, 1.32, Q.y),
			"enter": func(): _hide(buyer); stage("phone_read", Q.x, 0, Q.y, 0),
			"beats": [[0.2, func(): cue("phone")], [0.6, func(): talk("fightText")]]},
		{"dur": lines_len("fightOut4") + lines_len("fightOut5") + 0.5, "fov": 36, "cam": rel(Q.x, Q.y, 0, -0.5, 0.35, 1.75), "look": Vector3(Q.x, 1.2, Q.y + 0.4),
			"enter": func(): stage("phone_talk", Q.x, 0, Q.y, 0); talk("fightOut4"); talk("fightOut5")},
		{"dur": 3.0, "fov": 46, "cam": Vector3(-41.0, 1.9, Q.y - 5.5), "look": Vector3(-41.2, 1.4, Q.y + 6),
			"enter": func(): cue("hangup"); phone_prop.hold(""), "tick": func(dt, t, k): walk_stage(Q, Vector2(Q.x - 0.1, Q.y + 4.2), k)}]
	play_reel(shots, func(_s): _after_fight(Q, runners, buyer))
func _cornered(buyer, SPOT: Vector2, BAG: Vector2) -> void:
	if buyer != null: crew_face(buyer, SPOT.x, SPOT.y); fight.hit1(buyer, "block")
	bag_on = null; bag.global_position = Vector3(BAG.x, 0.085, BAG.y)
func _crew_idle(e) -> void:
	if e != null: fight.play(e, "idle")
func _hide(e) -> void:
	if e != null: e.node.visible = false
func _flee(runners: Array, t: float) -> void:
	for e in runners:
		var f: Array = e.flee; var k := minf(1, t*4.6/absf(f[3] - f[1]))
		crew_walk(e, Vector2(f[0], f[1]), Vector2(f[2], f[3]), k, "sprint")
		if k >= 1: e.node.visible = false
func _buyer_bolts(buyer, BP: Vector2, t: float) -> void:
	if buyer == null: return
	var m := minf(1, maxf(0, t - 0.4)*4.2/14)
	crew_walk(buyer, BP, Vector2(BP.x + 0.1, BP.y - 14), m, "sprint")
	if m >= 1: buyer.node.visible = false
func _after_fight(Q: Vector2, runners: Array, buyer) -> void:
	staged = null
	for e in runners: e.node.visible = false
	if buyer: buyer.node.visible = false
	if bag: bag.queue_free(); bag = null
	place(Vector3(Q.x - 0.1, 0, Q.y + 4.2), PI)
	S.cash = 0; cue("win")
	outcome("fought")
	note("The bag, and the rings in it. No money.")

func _near_school_door() -> bool:
	var d: Array = nav.spots.schoolDoor
	return Vector2(boots.x - d[0], boots.z - d[1]).length() < 2.4 and boots.y < 1.0
## AFTER SCHOOL: Canon, and the closed station under Harbor Lane (courtyard.gd)
func courtyard_begin(resume := false) -> void:
	S.step = "courtyard"; _save()
	objective(QUEST.courtyard.goal)
	cy.begin(resume)
func _in_alley() -> bool:
	var a: Dictionary = nav.zones.alley
	return boots.x > a.x1 - 1 and boots.x < a.x2 + 1 and boots.z > a.z1 - 1 and boots.z < a.z2 + 1

# ================================================================== every frame
func _unhandled_input(ev: InputEvent) -> void:
	if mode == "fight":
		if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			cam_yaw -= ev.relative.x*0.0032; cam_pitch = clampf(cam_pitch - ev.relative.y*0.0028, -1.1, 0.6)
		elif ev is InputEventKey and ev.pressed and ev.keycode == KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif ev is InputEventMouseButton and ev.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED: Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		else: fight.key(ev)
		return
	if mode == "" and ev is InputEventKey and chase.key(ev): return
	if ev is InputEventKey and hs.key(ev): return
	if mode == "" and ev is InputEventKey and cy.key(ev): return
	if station.B != null and ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT: station.brawl_click()
	if mode == "puzzle": return
	if mode == "guitar":
		if ev is InputEventKey and intro.key(ev): return
		if ev is InputEventKey and ev.keycode == KEY_M and ev.pressed: set_mute(not AudioServer.is_bus_mute(0))
		return
	if mode == "end" and ev is InputEventKey and ev.pressed and (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER) and S.step == "end": today.start(); return
	if mode == "" and ev is InputEventKey and ev.pressed and not ev.echo and ev.keycode == KEY_E and S.step == "school" and _near_school_door():
		marker.visible = false; black(true); get_tree().create_timer(0.4).timeout.connect(func(): black(false); hs.lobby()); return
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and mode == "":
		mouse_idle = 0.0; cam_yaw -= ev.relative.x*0.0032; cam_pitch = clampf(cam_pitch - ev.relative.y*0.0028, -1.1, 0.6)
	elif ev is InputEventMouseButton and ev.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_M: set_mute(not AudioServer.is_bus_mute(0))
			KEY_G: if mode == "" and not grip.on(): grip.try_scale()
			KEY_V:
				var vv = verse_mat.get_shader_parameter("verse")
				verse_mat.set_shader_parameter("verse", 0.0 if (1.0 if vv == null else float(vv)) > 0.5 else 1.0)
			KEY_ENTER, KEY_KP_ENTER:
				if mode == "reel": _reel_end(true)
				elif S.step == "lesson": (fire_shoes() if lesson_id() == "fire" else lesson_next())
			KEY_SPACE:
				if mode == "reel": skip_line()

func _process(dt: float) -> void:
	_bed(dt)
	_score_tick()
	_tick_glow()
	if ringing_on:
		ring_t -= dt
		if ring_t <= 0: ring_t = 1.5; cue("ring")
	if note_t > 0:
		note_t -= dt
		if note_t <= 0: note_label.text = ""
	if caption_t > 0:
		caption_t -= dt
		if caption_t <= 0: caption.text = ""
	_tick_talk(dt)
	face.target = _gaze_target(); face.gmood = "down" if face.mood in ["sad", "tired", "sheepish", "sleepy"] else null
	face.tick(dt)
	($Key as OmniLight3D).global_position = robin.position + Vector3(0, 1.6, 0) + cam.global_basis.z*1.4
	# by day the sun lights her; indoors the room's own lamps do — the night street's key, in a lit room, had her glowing
	($Key as OmniLight3D).light_energy = (0.25 if inside else 0.5) if day() else (0.45 if inside else 2.2)
	fight.tick(dt)
	raid.tick(dt)
	today.tick(dt)
	hs.tick(dt)
	cy.tick(dt)
	station.tick(dt)
	_crew_bag(dt)
	_goal_tick()
	if mode == "" and chase.on: chase.tick(dt)
	intro.tick(dt)
	if mode in ["fight", "end", "puzzle", "read", "wc", "guitar"]: return
	if mode == "reel": _tick_reel(dt); return
	_play_tick(dt)

func _play_tick(dt: float) -> void:
	var k := func(c): return Input.is_physical_key_pressed(c)
	var space: bool = k.call(KEY_SPACE)
	var inp := {"x": float(k.call(KEY_D)) - float(k.call(KEY_A)), "z": float(k.call(KEY_W)) - float(k.call(KEY_S)), "yaw": cam_yaw,
		"jump": space, "jump_edge": space and not space_was, "shift": k.call(KEY_SHIFT) or k.call(KEY_SHIFT)}
	space_was = space
	# on a wall: the cuffs have her
	if grip.on():
		grip.tick(dt); _play_camera(dt); return
	# the chase: her own moves on foot (a vault, a slide, a climb, knocked flat), behind cover, and the shoes cold
	if chase.on:
		if chase.tick_act(dt) or chase.tick_cover(dt): _play_camera(dt); return
		if chase.st.i < chase.stage_at("roofs"): inp.jump = false; inp.jump_edge = false
	# the lesson's first step: she falls slowly until SPACE fires the shoes
	if S.step == "lesson" and lesson_id() == "fire" and not boots.ground:
		if inp.jump_edge: fire_shoes()
		else:
			boots.step({"yaw": cam_yaw}, dt*0.22); _follow(dt); return
	if k.call(KEY_LEFT): cam_yaw += 2*dt
	if k.call(KEY_RIGHT): cam_yaw -= 2*dt
	for e in boots.step(inp, dt):
		_boot_punch(e); face.react(e.name)
		_lesson_event(e)
		match e.name:
			"bound", "boundPerfect", "jump", "jumpPerfect": cue("step")          # her feet leaving: no boom
			"land", "boundLand": cue("step")
			"roll": cue("step")
			"rebound", "reboundPerfect", "dash": cue("kick")
	_follow(dt)
	if S.step == "lesson" and lesson_id() == "alley" and _in_alley() and boots.y < 1.0: lesson_next()
	if S.step == "school" and _near_school_door(): set_caption("E — Go in · Harbor Lane High")
	if S.step == "deal" and _in_alley() and boots.y < 1.0 and fight.ready_:
		var m: Vector2 = Fight.MEET.robin
		if Vector2(boots.x, boots.z).distance_to(m) < 5 or (boots.z < m.y + 3 and boots.z > -38): marker.visible = false; fight_intro()

## the body (boots.js animate): a flip high in the rhythm and on a perfect bound, soaring when she flies, a roll, a
## flip out of a pull-up or off a wall, flying in a dive; she faces where she is going (or the wall) and leans into it
func _follow(dt: float) -> void:
	var b := boots
	robin.position = Vector3(b.x, b.y, b.z)
	var L: Dictionary = b.last
	var nm := ""
	if L.get("flipT", 0.0) > 0: nm = "flip"
	elif L.get("leapT", 0.0) > 0: nm = "jump"
	elif b.fly > 0 and not b.ground and b.speed() > 12 and b.state != "dive": nm = "fly"
	elif b.bound != null: nm = "flip" if b.bound.get("perfect", false) and b.air_t < 0.55 else "jump"
	elif b.roll > 0 or L.get("rollT", 0.0) > 0: nm = "roll"
	elif b.swoop != null or L.get("reboundT", 0.0) > 0: nm = "flip"
	elif b.state == "dive" or b.dash_t > 0: nm = "fly"
	elif b.wall != null or b.slide_wall != null or not b.ground: nm = "jump"
	elif b.hspeed() > Boots.T.runSpeed + 1: nm = "sprint"
	elif b.hspeed() > 0.6: nm = "walk"
	else: nm = "idle"
	for t in ["reboundT", "leapT", "flipT", "hardT"]:
		if L.get(t, 0.0) > 0: L[t] = L[t] - dt
	# on the phone to Mom, hiding from the gunship (the chase's "call"): the phone at her ear, pacing as you move her
	var on_call: bool = chase.on and chase.sid() == "call" and chase.st.flags.get("answered", false) and not chase.st.flags.get("found", false)
	if on_call and b.ground and b.roll <= 0 and b.hspeed() < 6.0:
		var want := "phone_pace" if b.hspeed() > 0.6 else "phone_talk"
		if want != clip: play(want, 0.25); anim.seek(3.0 + randf()*6.0, true)
		phone_prop.hold("ear")
	else:
		if not on_call: phone_prop.hold("")
		play(nm)
	var w = b.wall
	var face: float = atan2(-w.n.x, -w.n.y) if w != null else (atan2(b.vx, b.vz) if b.hspeed() > 0.6 else model.rotation.y)
	var flying: bool = b.fly > 0 and not b.ground and b.state != "dive" and b.speed() > 12
	var pitch := 0.0
	if flying: pitch = clampf(atan2(-b.vy, b.hspeed() + 1)*0.85, -0.7, 1.0)
	elif b.state == "dive": pitch = clampf(atan2(-b.vy, b.hspeed() + 1)*0.9, 0, 1.3)
	elif b.dash_t > 0: pitch = 0.5
	elif b.bound != null and b.vy < 0: pitch = clampf(-b.vy*0.018, 0, 0.35)
	model.rotation.y = lerp_angle(model.rotation.y, face, minf(1, dt*14))
	model.rotation.x = lerpf(model.rotation.x, pitch, minf(1, dt*8))
	# the ring: where a bound would go now
	var t = null
	if not boots.ground and boots.bound != null: t = boots.bound
	elif boots.ground and boots.have.has("bound"): t = boots.find_target(boots.aim_dir({"yaw": cam_yaw}, null, false))
	ring.visible = t != null
	if t != null:
		ring.position = Vector3(t.x, t.y + 0.05, t.z)
		(ring.material_override as StandardMaterial3D).albedo_color = Color(1, 0.8, 0.3) if boots.gold else Color(0.4, 1, 0.95)
	_play_camera(dt)

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
## the fight, photographed: in at the mouth of the alley, the film, then each lesson's key pressed when it is asked for
func _shots_fight() -> void:
	await get_tree().create_timer(1.0).timeout
	place(Vector3(-41.0, 0, -20.5), 0.0)
	var t0 := Time.get_ticks_msec(); var n := 0
	while mode != "fight" and Time.get_ticks_msec() - t0 < 90000:
		await get_tree().create_timer(4.0).timeout; await _snap("intro_%02d" % n); n += 1
	n = 0
	t0 = Time.get_ticks_msec()
	while mode == "fight" and Time.get_ticks_msec() - t0 < 150000:
		await get_tree().create_timer(0.25).timeout
		var fz = fight.dir.freeze if fight.dir != null else null
		if fz != null:
			await _snap("fight_%02d_%s" % [n, fz.want]); n += 1
			match fz.want:
				"attack": fight._press(); fight._release()
				"dodge": var ev := InputEventKey.new(); ev.keycode = KEY_SPACE; ev.pressed = true; fight.key(ev)
				"parry": fight._do_parry()
				"pulse": var ev2 := InputEventKey.new(); ev2.keycode = KEY_F; ev2.pressed = true; fight.key(ev2)
				"pull": var ev3 := InputEventKey.new(); ev3.keycode = KEY_G; ev3.pressed = true; fight.key(ev3)
			await get_tree().create_timer(0.35).timeout; await _snap("fight_%02d_hit" % n); n += 1
		elif fight.dir != null and fight.dir.pending == null and randf() < 0.5:
			fight._press(); fight._release()
		if n > 40: break
	print("fight over: mode=", mode, " step=", S.step, " dir=", fight.dir.id if fight.dir else "")
	while mode == "reel":
		await get_tree().create_timer(5.0).timeout; await _snap("outro_%02d" % n); n += 1
	await _snap("after")
	get_tree().quit()
## the raid, photographed: the billboard film, then each stretch of the chase (put at its start), each fight fought by
## pressing CLICK until they are down, home with no stars, and 3 AM
func _shots_raid() -> void:
	var n := [0]
	var reel_snaps := func(tag: String):
		while mode == "reel":
			await get_tree().create_timer(3.0).timeout; await _snap("%s_%02d" % [tag, n[0]]); n[0] += 1
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("intro")
	for i in Chase.STAGES.size():
		var id: String = Chase.STAGES[i].id
		if chase.st.i != i:
			place(chase._stage_start(i), PI/2); chase.go(i)
		await get_tree().create_timer(2.5).timeout; await _snap("stage_%d_%s" % [i, id])
		if id == "run" or id == "home":
			for j in 3:
				await get_tree().create_timer(1.2).timeout; await _snap("stage_%d_%s_%d" % [i, id, j])
		if Chase.STAGES[i].has("fight"):
			await reel_snaps.call("fight%d" % Chase.STAGES[i].fight)
			var t0 := Time.get_ticks_msec(); var k := 0
			while mode == "fight" and Time.get_ticks_msec() - t0 < 40000:
				await get_tree().create_timer(0.3).timeout
				fight._press(); fight._release()
				k += 1
				if k % 12 == 0: await _snap("fight%d_%02d" % [Chase.STAGES[i].fight, k/12])
			if mode == "fight":
				for e in fight.E: e.hp = 0.0; e.state = "ko"
				while mode == "fight": await get_tree().create_timer(0.5).timeout
			await get_tree().create_timer(1.0).timeout; await _snap("stage_%d_after" % i)
		if id == "call":
			chase.answer(); await get_tree().create_timer(3.0).timeout; await _snap("stage_7_oncall")
	# home, with nobody on her
	while not chase.on: await get_tree().create_timer(0.5).timeout
	chase.last_hit_t = chase.clock + 9999
	for d in chase.drones: d.static = 9999.0
	if chase.gun != null: chase.gun.leave = true
	chase.set_heat(0); chase.st.flags.seenNow = false
	for c in chase.cops: c.node.visible = false
	chase.cops.clear()
	place(Vector3(73, 12.02, 34), PI/2)
	await get_tree().create_timer(1.5).timeout
	await reel_snaps.call("night")
	await get_tree().create_timer(3.0).timeout; await _snap("end")
	print("raid over: step=", S.step)
	get_tree().quit()
## the school day, photographed: the morning, over the roofs to the overlook, in at the door, the lobby, the sneak
## (then the PA), caught, the lab, each puzzle (photographed, then solved), the robot, the talk, out into the afternoon
func _shots_day() -> void:
	var n := [0]
	var reel_snaps := func(tag: String, every := 3.0):
		while mode == "reel":
			await get_tree().create_timer(every).timeout; await _snap("%s_%02d" % [tag, n[0]]); n[0] += 1
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("morning")
	await get_tree().create_timer(1.5).timeout; await _snap("commute_0")
	var o: Array = nav.spots.schoolOverlook
	place(Vector3(o[0] + 2, o[2] + 0.02, o[1] - 2), PI*0.75)
	await get_tree().create_timer(2.0).timeout; await _snap("commute_1")
	await reel_snaps.call("overlook", 2.0)
	await get_tree().create_timer(1.0).timeout; await _snap("door")
	var sd: Array = nav.spots.schoolDoor; place(Vector3(sd[0] + 0.8, 0, sd[1] - 1.2), PI)
	var ev := InputEventKey.new(); ev.keycode = KEY_E; ev.pressed = true; _unhandled_input(ev)
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("lobby")
	await get_tree().create_timer(2.0).timeout; await _snap("sneak_0")
	var r114: Array = hs.sp.room114
	place(Vector3(r114[0] - 6, 0, r114[1] + 3), PI/2); await get_tree().create_timer(2.5).timeout; await _snap("sneak_1")
	hs.pa()
	await reel_snaps.call("pa")
	await get_tree().create_timer(1.5).timeout
	await reel_snaps.call("caught")
	await get_tree().create_timer(1.5).timeout
	await reel_snaps.call("lab")
	for i in 3:
		await get_tree().create_timer(1.5).timeout; await _snap("puzzle_%d_a" % i)
		var kind := puzzle.kind
		for j in 3:
			if not puzzle.visible or puzzle.kind != kind: break
			puzzle.solve(); await get_tree().create_timer(1.6).timeout
			if j == 0: await _snap("puzzle_%d_b" % i)
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("robot")
	await reel_snaps.call("talk", 4.0)
	await get_tree().create_timer(1.5).timeout
	await reel_snaps.call("outside")
	await get_tree().create_timer(1.5).timeout; await _snap("after")
	print("day over: step=", S.step)
	get_tree().quit()
## after school, photographed: Canon at the stair, each gate in the station (E, the puzzle solved), the platform, the
## fights (swung for her), the alpha, its fight (SPACE mashed for her), the escape, the street, the chase (lost for her),
## WFC (lost), alone, home over the roofs, and the end
## -- alpha: through the station's last door to Maya, and straight to what comes up out of her; then it is the player's
func _watch_alpha() -> void:
	await get_tree().create_timer(2.0).timeout
	for at in [Vector3(521.2, 0, -86.2), Vector3(520, 0, -95)]:
		place(at, 0.0); await get_tree().create_timer(1.0).timeout
		var ev := InputEventKey.new(); ev.keycode = KEY_E; ev.pressed = true; _unhandled_input(ev)
		await get_tree().create_timer(0.5).timeout
	var t0 := Time.get_ticks_msec()
	while mode != "fight" and Time.get_ticks_msec() - t0 < 60000: await get_tree().create_timer(0.3).timeout
	station.alpha_scene()
func _shots_after() -> void:
	var n := [0]; station.auto = true
	var reel_snaps := func(tag: String, every := 3.0):
		while mode == "reel":
			await get_tree().create_timer(every).timeout; await _snap("%s_%02d" % [tag, n[0]]); n[0] += 1
	var press_e := func():
		var ev := InputEventKey.new(); ev.keycode = KEY_E; ev.pressed = true; _unhandled_input(ev)
	var solve_all := func(tag: String):
		await get_tree().create_timer(1.2).timeout; await _snap(tag)
		for j in 6:
			if not puzzle.visible: break
			puzzle.solve(); await get_tree().create_timer(1.8).timeout
	await get_tree().create_timer(2.0).timeout
	if S.get("tun", 0) == 7: await _shots_street(n, reel_snaps); return
	if not shots_alpha:
		await _snap("street"); await get_tree().create_timer(4.0).timeout; await _snap("phone")
		place(Vector3(Courtyard.ENTRY.x - 1, 0, Courtyard.ENTRY.y + 2.5), PI)
		await get_tree().create_timer(1.0).timeout
		await reel_snaps.call("entry")
		await get_tree().create_timer(2.0).timeout; await _snap("tunnel_in")
	var stops := [["panel", Vector3(518.2, 0, 4.2)], ["switch", Vector3(514.6, 0, -27)], ["gizmo", Vector3(520, 0, -44)], ["hatch", Vector3(520.6, 0, -70.0)], ["quiet", Vector3(520, 0, -81)], ["door", Vector3(521.2, 0, -86.2)], ["meet", Vector3(520, 0, -95)]]
	if shots_alpha: stops = stops.slice(5)
	for st in stops:
		place(st[1], 0.0); await get_tree().create_timer(1.0).timeout
		if st[0] in ["panel", "switch", "hatch", "door"]: press_e.call()
		await get_tree().create_timer(0.5).timeout
		if puzzle.visible: await solve_all.call("puzzle_" + st[0])
		await reel_snaps.call(st[0])
		if puzzle.visible:
			await solve_all.call("puzzle_" + st[0] + "_b"); await reel_snaps.call(st[0] + "_b")
		await get_tree().create_timer(0.8).timeout
	# straight to the alpha (the fights skipped): photographs of it, close, in the station's light
	if shots_alpha:
		var t9 := Time.get_ticks_msec()
		while mode != "fight" and Time.get_ticks_msec() - t9 < 60000: await get_tree().create_timer(0.3).timeout
		station.alpha_scene(); await reel_snaps.call("alpha", 1.5); await reel_snaps.call("monster", 1.5)
		var t8 := Time.get_ticks_msec()
		while station.B != null and Time.get_ticks_msec() - t8 < 16000:
			await get_tree().create_timer(0.5).timeout; station.brawl_click()
			if (Time.get_ticks_msec() - t8) % 2000 < 500: await _snap("brawl_%d" % ((Time.get_ticks_msec() - t8)/2000))
			if Time.get_ticks_msec() - t8 > 9000 and station.B != null: station.B.hits = 2
		await reel_snaps.call("duel", 1.5)
		get_tree().quit(); return
	# the fights: swung for her until the next film starts
	for fi in 2:
		var t0 := Time.get_ticks_msec(); var k := 0
		while mode != "reel" and Time.get_ticks_msec() - t0 < 60000:
			await get_tree().create_timer(0.3).timeout
			if mode == "fight": fight._press(); fight._release()
			k += 1
			if k % 15 == 0: await _snap("fight%d_%02d" % [fi, k/15])
		await reel_snaps.call("after_fight%d" % fi)
	# the alpha's fight on her feet: hit it till it has had enough
	var t1 := Time.get_ticks_msec()
	while station.B != null and Time.get_ticks_msec() - t1 < 40000:
		await get_tree().create_timer(0.5).timeout; station.brawl_click()
		if (Time.get_ticks_msec() - t1) % 5000 < 500: await _snap("brawl_%d" % ((Time.get_ticks_msec() - t1)/5000))
		if Time.get_ticks_msec() - t1 > 12000 and station.B != null: station.B.hits = 2
	await reel_snaps.call("duel", 2.0)
	await get_tree().create_timer(1.5).timeout; await _snap("escape")
	var L: Array = cy.sp.ladder; place(Vector3(L[0], 0, L[1] + 1.0), 0.0)
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("street")
	await get_tree().create_timer(3.0).timeout; await _snap("chase_0")
	await get_tree().create_timer(3.0).timeout; await _snap("chase_1")
	if station.hunt: station.hunt.t = 999.0
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("lost")
	await get_tree().create_timer(2.0).timeout; await _snap("wfc_run")
	if station.hunt: station.hunt.t = 999.0
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("hide")
	await get_tree().create_timer(1.0).timeout; await _snap("gethome")
	place(Vector3(73, 12.02, 34), PI/2)
	await get_tree().create_timer(2.0).timeout
	await reel_snaps.call("home")
	await get_tree().create_timer(2.0).timeout; await reel_snaps.call("end")
	await _snap("the_end")
	print("after over: step=", S.step)
	get_tree().quit()
func _shots_street(n: Array, reel_snaps: Callable) -> void:
	await reel_snaps.call("street")
	await get_tree().create_timer(3.0).timeout; await _snap("chase_0")
	print("chase: watch=", cy.watch, " mode=", mode, " hunt=", station.hunt != null, " mon=", station.mon != null)
	if station.hunt: station.hunt.t = 999.0
	await get_tree().create_timer(1.0).timeout
	print("after meter: watch=", cy.watch, " mode=", mode)
	await reel_snaps.call("lost")
	await get_tree().create_timer(2.0).timeout; await _snap("wfc_run")
	print("wfc: watch=", cy.watch, " mode=", mode)
	if station.hunt: station.hunt.t = 999.0
	await get_tree().create_timer(1.0).timeout
	await reel_snaps.call("hide")
	await get_tree().create_timer(1.0).timeout; await _snap("gethome")
	print("gethome: watch=", cy.watch, " step=", S.step)
	place(Vector3(73, 12.02, 34), PI/2)
	await get_tree().create_timer(2.0).timeout
	await reel_snaps.call("home")
	await get_tree().create_timer(2.0).timeout; await reel_snaps.call("end")
	await _snap("the_end")
	print("after over: step=", S.step)
	get_tree().quit()
## the new start, photographed: the city and the montage every half-second, the song played by itself, the calls
func _shots_intro() -> void:
	intro.auto = true
	var n := 0
	if OS.get_cmdline_user_args().has("guitar"): reel = null; intro._city_done([])
	if OS.get_cmdline_user_args().has("calls"):
		reel = null; mode = ""; talk_q.clear(); intro._title(false); chase.stop(); robin.visible = true; show_inside(true); lamp.light_energy = 1.6; letterbox(true); black(false); intro.calls()
	while S.step == "intro" and n < 400:
		await get_tree().create_timer(2.0 if mode == "guitar" else 0.5).timeout
		await _snap("i%03d_%s%02d" % [n, mode, reel.i if reel else 0]); n += 1
		if mode == "guitar" and n % 4 == 0:
			intro.game.visible = false; intro.playing = false
			cam.global_position = intro.spot + Vector3(0.3, 1.3, 2.0); cam.look_at(intro.spot + Vector3(0, 1.1, 0))
			await _snap("i%03d_bare" % n); intro.game.visible = true; intro.playing = true; n += 1
		if OS.has_environment("TSH_SUBLOG"): print("SUB rect=", sub_label.get_global_rect(), " vis=", sub_label.is_visible_in_tree(), " text=", sub_label.text.substr(0, 60))
	for i in 6:
		await get_tree().create_timer(0.5).timeout; await _snap("i%03d_open" % n); n += 1
	print("intro over: step=", S.step)
	get_tree().quit()
## the opening, frame by frame: every quarter-second of the film, named by its shot, then the fall
func _shots_open() -> void:
	var n := 0
	while reel != null or n == 0:
		await get_tree().create_timer(0.25).timeout
		if reel == null: break
		await _snap("o%03d_s%02d" % [n, reel.i]); n += 1
	for i in 4:
		await get_tree().create_timer(0.5).timeout; await _snap("o%03d_fall" % n); n += 1
	get_tree().quit()
## the gecko cuffs, photographed: at B1's west wall, G, W held to the roof; then off the edge, G and S down
func _shots_climb() -> void:
	await get_tree().create_timer(1.0).timeout
	if reel: _reel_end(true)
	S.step = "lesson"; S.lesson = 99; lesson.i = 99; card.visible = false; mode = ""; show_inside(false)
	var key := func(k: Key, down: bool):
		var ev := InputEventKey.new(); ev.keycode = k; ev.physical_keycode = k; ev.pressed = down; Input.parse_input_event(ev)
	# the shoes: SPACE and W held, bound after bound across the roofs, photographed in the air
	if shots_jump:
		for t in Boots.EARLY + Boots.MID: boots.have[t] = true
		place(HOME_ROOF, PI/2); await get_tree().create_timer(1.0).timeout
		key.call(KEY_W, true); key.call(KEY_SPACE, true)
		for i in 16:
			await get_tree().create_timer(0.35).timeout; await _snap("j%02d" % i); print("j", i, " pos=", robin.position.snapped(Vector3.ONE*0.1), " clip=", clip, " state=", boots.state, " fov=", snappedf(cam.fov, 0.1))
		key.call(KEY_SPACE, false); key.call(KEY_W, false)
		get_tree().quit(); return
	place(Vector3(-57.2, 0, -35), -PI/2); await get_tree().create_timer(0.8).timeout; await _snap("c0_at_wall")
	key.call(KEY_G, true); await get_tree().process_frame; key.call(KEY_G, false)
	print("grip on: ", grip.on())
	key.call(KEY_W, true)
	for i in 6:
		await get_tree().create_timer(1.0).timeout; await _snap("c%d_up" % (i + 1)); print("y=", boots.y, " on=", grip.on())
		if not grip.on(): break
	key.call(KEY_W, false)
	await get_tree().create_timer(1.5).timeout; await _snap("c9_roof"); print("roof: y=", boots.y, " ground=", boots.ground)
	get_tree().quit()
func _snap(nm: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(shots_dir.path_join(nm + ".png"))
	print("shot ", nm, " step=", S.step, " lesson=", lesson.i, " pos=", robin.position)

## HER TOES IN HER SHOES: the clips bend her toes (kneeling most — Mixamo's kneel curls them right under), and the
## shoes are skinned to those bones, so the shoe folded across the toe. A shoe does not bend there: with the shoes
## on, the toe bones are held all but straight (a fifth of the clip's bend left in, so the sole still meets the floor)
class ShoeToes extends SkeletonModifier3D:
	var g; var bones := []; var shoe: Node3D
	func _process_modification() -> void:
		var s := get_skeleton()
		if s == null or g == null: return
		if bones.is_empty():
			for nm in ["mixamorigLeftToeBase", "mixamorigRightToeBase", "mixamorigLeftToe_End", "mixamorigRightToe_End"]:
				var i := s.find_bone(nm)
				if i >= 0: bones.append(i)
		if shoe == null: shoe = g._find(g.model, func(x): return x is Node3D and x.name == "worn_skyline-shoes")
		if shoe == null or not shoe.visible: return
		for i in bones:
			var rest := s.get_bone_rest(i).basis.get_rotation_quaternion()
			s.set_bone_pose_rotation(i, rest.slerp(s.get_bone_pose_rotation(i), 0.2))
