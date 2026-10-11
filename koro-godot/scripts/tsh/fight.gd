## TSH · THE FIGHT — public/tshfight.js, ported. Dragon Alley, after the buyer decides not to pay and his crew comes
## out of the alley (game.gd films the walk-up and the walk-off around this; this is the part you play).
##
## IT TEACHES ITSELF, one move at a time, in the order the script has the crew come at her: the first charges
## (ATTACK), another swings (DODGE), two rush her (COMBO), one gets hold of her (BREAK), one has a pipe (PARRY) — then
## more come, and the gauntlets: a POWER punch and a PULL. Every move is taught in a speed ramp: the world drops to a
## crawl at the instant that matters and waits for the key. Every hit lands with a jolt (hit-stop) and a shake.
##
##   CLICK / K       punch — again for the chain: jab, cross, hook, kick      hold CLICK: the POWER punch on letting go
##   G               PULL the nearest one in front to her                     SPACE: dodge (toward a man: over him)
##   RIGHT-CLICK / R parry the instant before a hit; hold it to block         F: the bangle's PULSE
class_name Fight
extends Node

const ALLEY := {"x1": -48.5, "x2": -31.5, "z1": -37.5, "z2": -13.5}
const MEET := {"robin": Vector2(-41.4, -24.6), "buyer": Vector2(-41.6, -28.6)}
const BLOCKS := [{"x1": -48.42, "x2": -47.38, "z1": -21.95, "z2": -20.05}, {"x1": -32.1, "x2": -31.0, "z1": -37.0, "z2": -36.0}]
const CAR := {"x1": -48.91, "x2": -47.05, "z1": -36.05, "z2": -32.35, "x": -47.98, "z": -34.2}
const MOVE := {
	"jab": {"clip": "jab", "speed": 1.7, "hit": 0.40, "free": 0.62, "dmg": 1.0, "reach": 1.75, "push": 0.45, "shake": 0.05},
	"cross": {"clip": "cross", "speed": 2.8, "hit": 0.30, "free": 0.48, "dmg": 1.0, "reach": 1.85, "push": 0.55, "shake": 0.06},
	"hook": {"clip": "hook", "speed": 2.6, "hit": 0.31, "free": 0.50, "dmg": 1.5, "reach": 1.85, "push": 0.8, "shake": 0.09},
	"kick": {"clip": "kick", "speed": 2.3, "hit": 0.36, "free": 0.58, "dmg": 2.0, "reach": 2.1, "push": 1.6, "shake": 0.17, "down": true},
	"power": {"clip": "power", "speed": 2.3, "hit": 0.32, "free": 0.60, "dmg": 4.0, "reach": 2.1, "fly": 12.0, "shake": 0.45, "down": true},
	"flykick": {"clip": "flykick", "speed": 1.5, "hit": 0.46, "free": 0.80, "dmg": 3.0, "reach": 2.4, "fly": 8.0, "shake": 0.32, "down": true},
	"knee": {"clip": "knee", "speed": 2.6, "hit": 0.27, "free": 0.46, "dmg": 1.5, "reach": 1.6, "push": 0.7, "shake": 0.1},
	"elbow": {"clip": "elbow", "speed": 2.2, "hit": 0.30, "free": 0.50, "dmg": 1.5, "reach": 1.6, "push": 0.9, "shake": 0.1},
	"zip": {"clip": "flykick", "speed": 1.5, "hit": 0.46, "free": 0.74, "dmg": 2.0, "reach": 2.3, "push": 1.8, "shake": 0.22, "down": true},
	"spin": {"clip": "spin", "speed": 1.3, "hit": 0.42, "free": 0.74, "dmg": 2.0, "reach": 2.3, "push": 1.6, "shake": 0.26, "down": true, "area": true},
	"sweep": {"clip": "sweep", "speed": 2.0, "hit": 0.36, "free": 0.60, "dmg": 1.0, "reach": 2.1, "push": 0.6, "shake": 0.18, "down": true, "area": true}}
const CHAIN := ["jab", "cross", "hook", "kick"]
const STRINGS := [CHAIN, ["jab", "elbow", "cross", "kick"], ["cross", "hook", "knee", "elbow"], ["jab", "jab", "hook", "knee"], ["elbow", "cross", "hook", "kick"]]
const FAR := 4.6
const AIM_RANGE := 8.0
const EVADE := {
	"cartL": {"clip": "cartL", "speed": 2.6, "go": 3.8, "iframe": 0.5, "travel": 0.85},
	"cartR": {"clip": "cartR", "speed": 2.6, "go": 3.8, "iframe": 0.5, "travel": 0.85},
	"flip": {"clip": "bflip", "speed": 2.5, "go": 3.4, "iframe": 0.5, "travel": 0.8, "back": true},
	"roll": {"clip": "evroll", "speed": 2.2, "go": 3.6, "iframe": 0.45, "travel": 0.8},
	"wall": {"clip": "wallkick", "speed": 2.6}, "vault": {"clip": "evflip", "speed": 1.7}}
const KIND := {
	"buyer": {"char": "thug-buyer", "hp": 6.0, "dmg": 0.0, "windup": 0.7, "walk": 1.4, "run": 4.0},
	"big": {"char": "thug-a", "hp": 5.0, "dmg": 16.0, "windup": 0.80, "walk": 1.2, "run": 3.6},
	"lean": {"char": "thug-b", "hp": 3.0, "dmg": 11.0, "windup": 0.58, "walk": 1.6, "run": 4.5}}
const ONCE := ["jab", "cross", "hook", "kick", "knee", "elbow", "power", "dodge", "block", "hit", "stagger", "fall", "getup", "ko", "flykick", "sweep", "spin", "cartL", "cartR", "bflip", "wallkick", "evroll", "evflip", "roar"]

var g          # the game (game.gd)
var on := false
var ready_ := false
var E: Array = []
var R := {}
var dir = null
var stop_t := 0.0; var stop_scale := 0.03
var ramp := {"to": 1.0, "rate": 6.0}
var slow_timer := 0.0; var slow_back := 1.0
var time_scale := 1.0
var input := {"held": false, "held_t": 0.0, "charging": false}
var done_cb: Callable
var cam := {"pull": 0.0, "look": Vector3.ZERO, "punch": 0.0, "on": false}
var mark: MeshInstance3D
var hud: CanvasLayer; var hp_bar: ColorRect; var hp_back: ColorRect; var combo_label: Label; var prompt_label: RichTextLabel; var keys_label: Label; var red: ColorRect
var shake_amp := 0.0; var shake_len := 0.0; var shake_t := 0.0
var later_q: Array = []
var steps: Array = []

func _init(game) -> void:
	g = game

func _ready() -> void:
	mark = MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.42; tm.outer_radius = 0.52; tm.rings = 32; mark.mesh = tm
	var mm := StandardMaterial3D.new(); mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mm.albedo_color = Color.WHITE; mark.material_override = mm
	mark.scale = Vector3(1, 0.05, 1); mark.visible = false; g.add_child(mark)
	hud = CanvasLayer.new(); hud.visible = false; add_child(hud)
	red = ColorRect.new(); red.color = Color(0.8, 0, 0, 0); red.set_anchors_preset(Control.PRESET_FULL_RECT); red.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(red)
	hp_back = ColorRect.new(); hp_back.color = Color(0, 0, 0, 0.5); hp_back.position = Vector2(24, 140); hp_back.size = Vector2(260, 12); hud.add_child(hp_back)
	hp_bar = ColorRect.new(); hp_bar.color = Color(0.4, 1, 0.9); hp_bar.position = Vector2(24, 140); hp_bar.size = Vector2(260, 12); hud.add_child(hp_bar)
	combo_label = Label.new(); combo_label.set_anchors_preset(Control.PRESET_CENTER_RIGHT); combo_label.position = Vector2(-260, -40); combo_label.add_theme_font_size_override("font_size", 40); hud.add_child(combo_label)
	prompt_label = RichTextLabel.new(); prompt_label.bbcode_enabled = true; prompt_label.fit_content = true; prompt_label.set_anchors_preset(Control.PRESET_CENTER)
	prompt_label.position = Vector2(-300, 40); prompt_label.size = Vector2(600, 140); prompt_label.add_theme_font_size_override("normal_font_size", 22)
	prompt_label.add_theme_font_size_override("bold_font_size", 46); prompt_label.add_theme_constant_override("outline_size", 8); prompt_label.add_theme_color_override("font_outline_color", Color.BLACK); hud.add_child(prompt_label)
	keys_label = Label.new(); keys_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM); keys_label.position = Vector2(-430, -60); keys_label.size = Vector2(860, 30)
	keys_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; keys_label.add_theme_font_size_override("font_size", 15); keys_label.modulate = Color(1, 1, 1, 0.75)
	keys_label.text = "MOUSE aim · CLICK strike · HOLD power · G pull · SPACE dodge · RIGHT-CLICK parry · F pulse"; keys_label.visible = false; hud.add_child(keys_label)
	steps = _steps()

# ================================================================== the cast
func spawn(kind: String, x: float, z: float, o := {}) -> Dictionary:
	var K: Dictionary = KIND[kind].duplicate()
	var e := {"kind": kind, "K": K, "hp": float(o.get("hp", K.hp)), "x": x, "z": z, "y": 0.0, "vx": 0.0, "vy": 0.0, "vz": 0.0, "yaw": float(o.get("yaw", 0.0)),
		"state": o.get("state", "idle"), "t": 0.0, "weapon": o.get("weapon", false), "grabber": false, "cool": randf_range(1.2, 2.6), "clip": "",
		"active": false, "tag": o.get("tag", ""), "home": null, "want_ring": randf_range(2.5, 3.4), "side": -1.0 if randf() < 0.5 else 1.0,
		"guard": null, "parried": false, "talking": false}
	var n: Node3D = (load("res://assets/tsh/people/%s.glb" % K.char) as PackedScene).instantiate()
	g.add_child(n); e.node = n; e.ap = g._find(n, func(x): return x is AnimationPlayer)
	for nm in e.ap.get_animation_list():
		if not nm in ONCE: e.ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
	if o.get("hidden", false): n.visible = false
	if e.weapon:
		var hand = _bone_node(n, "RightHand")
		if hand != null:
			var att := BoneAttachment3D.new(); att.bone_name = hand[1]; hand[0].add_child(att)
			var p := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.022; cm.bottom_radius = 0.022; cm.height = 0.85; p.mesh = cm
			var pm := StandardMaterial3D.new(); pm.albedo_color = Color(0.29, 0.3, 0.31); pm.metallic = 0.75; pm.roughness = 0.45; p.material_override = pm
			p.rotation.x = PI/2.4; p.position = Vector3(0, 0.05, 0.25); att.add_child(p); e.pipe = p
	play(e, "talk" if e.state == "talk" else "idle", 0)
	E.append(e)
	_place(e)
	return e

func _bone_node(n: Node, suffix: String):
	var sk: Skeleton3D = g._find(n, func(x): return x is Skeleton3D)
	if sk == null: return null
	for i in sk.get_bone_count():
		if sk.get_bone_name(i).ends_with(suffix): return [sk, sk.get_bone_name(i)]
	return null

func play(e: Dictionary, nm: String, fade := 0.15) -> void:
	e.clip_want = nm
	if e.clip != nm and e.ap.has_animation(nm): e.clip = nm; e.ap.play(nm, fade)
func hit1(e: Dictionary, nm: String) -> float:
	e.clip_want = nm
	if not e.ap.has_animation(nm): return 0.6
	e.clip = nm; e.ap.stop(); e.ap.play(nm, 0.06)
	return e.ap.get_animation(nm).length
func standing(e) -> bool:
	return e != null and not e.state in ["down", "ko", "flying", "getup", "gone"] and e.kind != "buyer"
func alive() -> Array: return E.filter(func(e): return standing(e))
func pick(tag: String) -> Dictionary:
	for e in E:
		if e.tag == tag: return e
	return {"hp": 0.0, "state": "gone", "tag": tag, "kind": "none"}
func _place(e: Dictionary) -> void:
	e.node.position = Vector3(e.x, e.y, e.z); e.node.rotation.y = e.yaw

func clear() -> void:
	for e in E: e.node.queue_free()
	E.clear(); ready_ = false

func cast(crew: Array) -> void:
	clear(); ready_ = true
	for m in crew: spawn(m.kind, m.x, m.z, m)

# ================================================================== Robin
func _reset_robin() -> void:
	R = {"act": null, "t": 0.0, "len": 0.0, "move": "", "target": null, "chain": 0, "chain_t": 0.0, "buffer": null, "hp": 100.0, "hurt_t": 9.0, "iframe": 0.0,
		"parry_t": 0.0, "blocking": false, "grabbed_by": null, "since_dodge": 9.0, "pulse_cd": 0.0, "pull_cd": 0.0, "combo": 0, "combo_t": 0.0,
		"face": g.cam_yaw - PI, "dash": null, "hits": 0, "only_key": null, "aim": null, "force_target": null, "counter_ready": false, "string": CHAIN,
		"out_of_evade": false, "evade_end": -1.0, "last_evade": "", "landed": false, "wall_to": null, "evade": null, "last_move": ""}
func P() -> Vector2: return Vector2(g.robin.position.x, g.robin.position.z)
func robin_clip(nm: String, once := false) -> float:
	var ap: AnimationPlayer = g.anim
	if not ap.has_animation(nm): return 0.0
	var sp := 1.0
	for k in MOVE:
		if MOVE[k].clip == nm: sp = MOVE[k].speed
	for k in EVADE:
		if EVADE[k].clip == nm: sp = EVADE[k].speed
	if once:
		g.clip = nm; ap.stop(); ap.play(nm, 0.06, sp)
	elif g.clip != nm:
		g.clip = nm; ap.play(nm, 0.12, sp)
	return ap.get_animation(nm).length/sp

static func ang_to(ax: float, az: float, bx: float, bz: float) -> float: return atan2(bx - ax, bz - az)
static func ang_diff(a: float, b: float) -> float: return atan2(sin(a - b), cos(a - b))
func turn_to(a: float, b: float, k: float) -> float: return a + ang_diff(b, a)*minf(1, k)
func dist(e) -> float: return Vector2(e.x, e.z).distance_to(P())

func pick_target(rng: float, cone := 0.0):
	var p := P(); var look: float = g.cam_yaw + PI
	var best = null; var bs := INF
	for e in alive():
		var d: float = Vector2(e.x, e.z).distance_to(p)
		if d > rng: continue
		var a: float = absf(ang_diff(ang_to(p.x, p.y, e.x, e.z), look))
		if cone > 0 and a > cone: continue
		var s := d + a*1.6
		if s < bs: bs = s; best = e
	return best
func _keys() -> Vector2:
	var k := func(c): return Input.is_physical_key_pressed(c)
	return Vector2(float(k.call(KEY_D)) - float(k.call(KEY_A)), float(k.call(KEY_W)) - float(k.call(KEY_S)))
func aim_dir() -> float:
	var kk := _keys(); var look: float = g.cam_yaw + PI
	if kk == Vector2.ZERO: return look
	return look + atan2(-kk.x, kk.y)
func aim_score(e: Dictionary, a: float) -> float:
	if dir != null and not dir.free and not e.active: return INF
	var p := P(); var d: float = Vector2(e.x, e.z).distance_to(p)
	if d > AIM_RANGE: return INF
	var off: float = absf(ang_diff(ang_to(p.x, p.y, e.x, e.z), a))
	if off > (PI if d < 2.2 else 1.05): return INF
	return off*2.4 + d*0.16
func aim_target():
	var a := aim_dir(); var best = null; var bs := INF
	for e in alive():
		var s := aim_score(e, a)
		if s < bs: bs = s; best = e
	var cur = R.aim if standing(R.aim) else null
	var cs := aim_score(cur, a) if cur != null else INF
	R.aim = cur if (cur != null and cs < INF and cs <= bs + 0.35) else best
	return R.aim
func choose(t) -> String:
	if dir == null or not dir.free:
		if R.chain_t > 0 and R.chain > 0 and R.chain < CHAIN.size(): R.chain += 1; return CHAIN[R.chain - 1]
		R.chain = 1; return "jab"
	var p := P(); var d: float = Vector2(t.x, t.z).distance_to(p) if t != null else 0.0
	if R.out_of_evade:
		R.out_of_evade = false
		if t == null or d < 3: R.chain = 0; return "sweep"
	if t != null and d > FAR: R.chain = 0; return "zip"
	if not (R.chain_t > 0 and R.chain > 0): R.string = STRINGS.pick_random(); R.chain = 0
	var near := alive().filter(func(e): return Vector2(e.x, e.z).distance_to(p) < 2.3).size()
	if R.combo > 0 and (R.combo + 1) % 5 == 0: R.chain = 0; return ("spin" if randf() < 0.6 else "sweep") if near >= 2 else "kick"
	if t != null and t.state == "stagger" and t.parried and d < 2.2: R.chain += 1; return "elbow" if R.last_move == "knee" else "knee"
	var s: Array = R.string
	var n: String = s[R.chain % s.size()]; R.chain += 1
	return n

func clamp_arena(x: float, z: float, r := 0.35) -> Vector2:
	x = clampf(x, ALLEY.x1, ALLEY.x2); z = clampf(z, ALLEY.z1, ALLEY.z2)
	for s in BLOCKS + [CAR]:
		if x > s.x1 - r and x < s.x2 + r and z > s.z1 - r and z < s.z2 + r:
			var dx1: float = x - (s.x1 - r); var dx2: float = (s.x2 + r) - x; var dz1: float = z - (s.z1 - r); var dz2: float = (s.z2 + r) - z
			var m: float = minf(minf(dx1, dx2), minf(dz1, dz2))
			if m == dx1: x = s.x1 - r
			elif m == dx2: x = s.x2 + r
			elif m == dz1: z = s.z1 - r
			else: z = s.z2 + r
	return Vector2(x, z)
func move_to(x: float, z: float) -> void:
	var p := clamp_arena(x, z); g.robin.position.x = p.x; g.robin.position.z = p.y

func walk_robin(dt: float) -> bool:
	var kk := _keys()
	if kk == Vector2.ZERO: return false
	var yaw: float = g.cam_yaw
	var fwd := Vector2(-sin(yaw), -cos(yaw)); var right := Vector2(cos(yaw), -sin(yaw))
	var d := (fwd*kk.y + right*kk.x).normalized()
	var run := Input.is_physical_key_pressed(KEY_SHIFT); var sp := 4.8 if run else 2.7
	var p := P(); move_to(p.x + d.x*sp*dt, p.y + d.y*sp*dt)
	R.face = turn_to(R.face, atan2(d.x, d.y), dt*12)
	robin_clip("sprint" if run else "walk")
	return true

# ------------------------------------------------------------------ her actions
func attack(kind: String) -> bool:
	if R.act == "dodge" and R.evade != null and kind == "punch": R.buffer = kind; return false
	if R.grabbed_by != null or R.act in ["hurt", "dodge", "vault", "wall"]: return false
	if R.act != null and R.act != "idle" and MOVE.has(R.move) and R.t < R.len*MOVE[R.move].free: R.buffer = kind; return false
	var t = R.force_target if standing(R.force_target) else aim_target()
	if t == null: t = pick_target(5.5 if kind == "power" else 4.6, 1.6)
	var nm := kind
	if kind == "punch":
		if R.evade_end >= 0 and not R.out_of_evade: R.out_of_evade = true; R.evade_end = -1.0
		nm = choose(t); R.chain_t = 1.1
	var m: Dictionary = MOVE[nm]
	R.act = "attack"; R.move = nm; R.last_move = nm; R.t = 0.0; R.target = t; R.landed = false
	R.len = robin_clip(m.clip, true); if R.len <= 0: R.len = 0.6
	if t != null:
		var p := P(); var d: float = Vector2(t.x, t.z).distance_to(p); var a: float = ang_to(p.x, p.y, t.x, t.z)
		R.face = a
		if nm == "zip":
			var go := maxf(0, d - 1.3)
			R.dash = {"x0": p.x, "z0": p.y, "x1": p.x + sin(a)*go, "z1": p.y + cos(a)*go, "t": 0.0, "len": R.len*m.hit, "arc": 0.9}
			R.iframe = maxf(R.iframe, R.len*m.hit); slow_for(0.4, 0.35)
		elif d > m.reach - 0.3:
			var go2 := minf(d - (m.reach - 0.55), 3.8)
			R.dash = {"x0": p.x, "z0": p.y, "x1": p.x + sin(a)*go2, "z1": p.y + cos(a)*go2, "t": 0.0, "len": clampf(go2*0.06, 0.08, 0.22), "arc": 0.0}
	g.cue("boom" if nm == "power" else "kick")
	return true

func threat():
	var best = null; var bd := INF; var p := P()
	for e in E:
		if e.state != "windup": continue
		var d: float = Vector2(e.x, e.z).distance_to(p)
		if d < bd: bd = d; best = e
	return best if best != null else pick_target(4, 3.2)

func dodge() -> bool:
	if R.grabbed_by != null or R.act in ["dodge", "vault", "wall"]: return false
	var kk := _keys(); var p := P(); var a: float
	var held := kk != Vector2.ZERO
	if held:
		var yaw: float = g.cam_yaw
		var d := Vector2(-sin(yaw), -cos(yaw))*kk.y + Vector2(cos(yaw), -sin(yaw))*kk.x
		a = atan2(d.x, d.y)
	else:
		var th = threat(); a = ang_to(th.x, th.z, p.x, p.y) if th != null else R.face + PI
	# toward a man, close: over him
	for over in alive():
		var dd: float = Vector2(over.x, over.z).distance_to(p)
		if dd < 2.1 and absf(ang_diff(ang_to(p.x, p.y, over.x, over.z), a)) < 0.6:
			var b: float = ang_to(p.x, p.y, over.x, over.z)
			var land := clamp_arena(over.x + sin(b)*1.3, over.z + cos(b)*1.3)
			var vl := robin_clip(EVADE.vault.clip, true); if vl <= 0: vl = 0.62
			R.act = "vault"; R.t = 0.0; R.len = vl; R.iframe = vl + 0.1; R.dash = {"x0": p.x, "z0": p.y, "x1": land.x, "z1": land.y, "t": 0.0, "len": vl*0.95, "arc": 1.9}
			R.face = b; R.since_dodge = 0.0; g.cue("kick"); slow_for(0.35, 0.5)
			if over.state != "stagger": over.state = "stagger"; over.t = 0.0; hit1(over, "stagger")
			event("vault", {}); return true
	# toward a wall: off it, and onto whoever is nearest
	var wx := p.x + sin(a)*1.2; var wz := p.y + cos(a)*1.2
	var t = pick_target(9, 3.2)
	if t != null and (wx < ALLEY.x1 + 0.05 or wx > ALLEY.x2 - 0.05):
		var w := clamp_arena(wx, wz); R.dash = {"x0": p.x, "z0": p.y, "x1": w.x, "z1": w.y, "t": 0.0, "len": 0.22, "arc": 0.0}
		var wl := robin_clip(EVADE.wall.clip, true); R.act = "wall"; R.t = 0.0; R.len = minf(0.55, (wl if wl > 0 else 0.5)*0.8); R.iframe = 0.9; R.wall_to = t
		R.face = a; R.since_dodge = 0.0; g.cue("kick"); event("wall", {}); return true
	var pk = evade_for(p, a if held else null)
	if pk != null:
		var v: Dictionary = EVADE[pk.kind]; a = pk.a
		var to := clamp_arena(p.x + sin(a)*v.go, p.y + cos(a)*v.go)
		var ln := robin_clip(v.clip, true); if ln <= 0: ln = 1.0
		R.act = "dodge"; R.evade = pk.kind; R.t = 0.0; R.len = ln; R.iframe = v.iframe; R.buffer = null
		R.dash = {"x0": p.x, "z0": p.y, "x1": to.x, "z1": to.y, "t": 0.0, "len": ln*v.travel, "arc": 0.0}
		R.face = a + PI if v.get("back", false) else a
		R.since_dodge = 0.0; g.cue("kick"); slow_for(0.55, 0.25); event("dodge", {}); return true
	var to2 := clamp_arena(p.x + sin(a)*2.6, p.y + cos(a)*2.6)
	R.act = "dodge"; R.evade = null; R.t = 0.0; R.len = 0.42; R.iframe = 0.42; R.dash = {"x0": p.x, "z0": p.y, "x1": to2.x, "z1": to2.y, "t": 0.0, "len": 0.3, "arc": 0.0}
	R.since_dodge = 0.0; robin_clip("dodge", true); event("dodge", {})
	return true

func evade_for(p: Vector2, held):
	var th = threat()
	var from: float = ang_to(th.x, th.z, p.x, p.y) if th != null else R.face + PI
	var room_to := func(a: float, go: float) -> float:
		var d := 0.0; var k := 0.5
		while k <= go + 0.01:
			var x := p.x + sin(a)*k; var z := p.y + cos(a)*k
			if x < ALLEY.x1 or x > ALLEY.x2 or z < ALLEY.z1 or z > ALLEY.z2: break
			var hit := false
			for b in BLOCKS + [CAR]:
				if x > b.x1 - 0.3 and x < b.x2 + 0.3 and z > b.z1 - 0.3 and z < b.z2 + 0.3: hit = true
			if hit: break
			d = k; k += 0.5
		return d
	var crowd := func(a: float, go: float) -> int:
		var x := p.x + sin(a)*go; var z := p.y + cos(a)*go
		return alive().filter(func(e): return e != th and Vector2(e.x, e.z).distance_to(Vector2(x, z)) < 1.4).size()
	var cart := func(a: float) -> String:
		if th == null: return "cartL" if randf() < 0.5 else "cartR"
		return "cartL" if ang_diff(ang_to(p.x, p.y, th.x, th.z), a) < 0 else "cartR"
	var ways := []
	var offer := func(kind: String, a: float, bonus: float):
		var v: Dictionary = EVADE[kind]; var room: float = room_to.call(a, v.go)
		if room < v.go*0.55: return
		var fam := "cart" if kind.begins_with("cart") else kind
		ways.append({"kind": kind, "a": a, "score": room/v.go*3 - crowd.call(a, v.go)*2.5 + bonus - (0.9 if R.last_evade == fam else 0.0) + randf()*0.8})
	if held != null:
		var off: float = absf(ang_diff(held, from))
		offer.call("flip" if off < 0.7 else (cart.call(held) if off < 2.3 else "roll"), held, 1.0)
	else:
		offer.call("flip", from, 0.2)
		offer.call(cart.call(from + PI/2), from + PI/2, 0.4)
		offer.call(cart.call(from - PI/2), from - PI/2, 0.4)
		offer.call("roll", from + PI/2 + 0.5, -0.3)
		offer.call("roll", from - PI/2 - 0.5, -0.3)
	if ways.is_empty(): return null
	ways.sort_custom(func(x, y): return x.score > y.score)
	R.last_evade = "cart" if ways[0].kind.begins_with("cart") else ways[0].kind
	return ways[0]

func parry() -> bool:
	if R.grabbed_by != null: return false
	R.parry_t = 0.32; R.blocking = true
	if R.act == null or R.act == "idle": R.act = "block"; R.t = 0.0; R.len = 0.5; robin_clip("block", true)
	return true

func pulse() -> bool:
	if R.pulse_cd > 0: g.note("✋ The bangle is still charging."); return false
	R.pulse_cd = 5.0
	var p := P()
	g.cue("flash"); shake(0.5, 0.45); hitstop(0.09); slow_for(0.2, 0.9); _flash(0.7)
	for e in alive():
		var d: float = Vector2(e.x, e.z).distance_to(p)
		if d < 3.8: throw_off(e, ang_to(p.x, p.y, e.x, e.z), 11.0 if d < 1.6 else 6.0, 1.0)
	if R.grabbed_by != null:
		var gb = R.grabbed_by; R.grabbed_by = null; R.act = null; throw_off(gb, ang_to(p.x, p.y, gb.x, gb.z), 12, 1)
	robin_clip("fight")
	event("pulse", {})
	return true

func pull() -> bool:
	if R.grabbed_by != null or (R.act != null and R.act != "idle"): return false
	if R.pull_cd > 0: g.note("🦎 The gauntlet needs a second."); return false
	var t = R.force_target if standing(R.force_target) else aim_target()
	if t == null: t = pick_target(15, 0.6)
	if t == null: t = pick_target(15, 3.2)
	if t == null: g.note("🦎 Nobody in reach of the line."); return false
	var p := P()
	R.pull_cd = 1.6; R.act = "pull"; R.t = 0.0; R.len = 0.55; R.face = ang_to(p.x, p.y, t.x, t.z)
	robin_clip("jab", true)
	t.state = "pulled"; t.t = 0.0; t.from = Vector2(t.x, t.z); t.to = clamp_arena(p.x + sin(R.face)*1.05, p.y + cos(R.face)*1.05, 0.2)
	hit1(t, "stagger"); _tether(t)
	g.cue("grab"); slow_for(0.3, 0.55); shake(0.12, 0.2)
	event("pull", {})
	return true

# ------------------------------------------------------------------ blows
func land() -> void:
	var m: Dictionary = MOVE[R.move]; R.landed = true
	var p := P()
	if m.get("area", false):
		var all := alive().filter(func(e): return Vector2(e.x, e.z).distance_to(p) <= m.reach + 0.3)
		if all.is_empty(): return
		for e in all: land_on(e, m, p)
		return
	var t = R.target
	if not standing(t): return
	if Vector2(t.x, t.z).distance_to(p) > m.reach + 0.45: return
	land_on(t, m, p)

func land_on(t: Dictionary, m: Dictionary, p: Vector2) -> void:
	if t.guard != null and t.guard.call():
		g.cue("clang"); shake(0.05, 0.1)
		if t.state != "windup": t.state = "stagger"; t.t = 0.3; t.vx = 0.0; t.vz = 0.0; hit1(t, "block")
		return
	var dmg: float = m.dmg*(2.0 if R.counter_ready else 1.0)
	R.counter_ready = false
	t.hp -= dmg; R.hits += 1; R.combo += 1; R.combo_t = 2.2
	var a := ang_to(p.x, p.y, t.x, t.z)
	g.cue("boom" if m.has("fly") else "punch")
	var big: bool = m.has("fly") or m.get("down", false) or t.hp <= 0
	hitstop(0.11 if big else 0.055); shake(m.shake*(1.4 if t.hp <= 0 else 1.0), 0.32 if big else 0.16); cam.punch = maxf(cam.punch, 1.0 if big else 0.45)
	_spark(Vector3(lerpf(p.x, t.x, 0.7), 1.35, lerpf(p.y, t.z, 0.7)), Color(0.6, 1, 1) if R.move == "power" else Color.WHITE)
	if m.has("fly"):
		var ta := a
		var ca := ang_to(t.x, t.z, CAR.x, CAR.z)
		if absf(ang_diff(ca, a)) < 1.1 and Vector2(CAR.x - t.x, CAR.z - t.z).length() < 11: ta = ca
		throw_off(t, ta, m.fly, 1.2); slow_for(0.12 if R.move == "power" else 0.25, 0.9); _flash(0.35)
	elif m.get("down", false) or t.hp <= 0:
		knock(t, a, m.get("push", 1.0))
		if t.hp <= 0: slow_for(0.35, 0.5)
	else:
		t.state = "stagger"; t.t = 0.0; t.vx = sin(a)*m.push*3; t.vz = cos(a)*m.push*3; hit1(t, "hit")
	event("hit", {"move": R.move, "target": t, "chain": R.chain})

func knock(e: Dictionary, a: float, push: float) -> void:
	e.state = "down"; e.t = 0.0; e.vx = sin(a)*push*3.2; e.vz = cos(a)*push*3.2
	hit1(e, "fall")
	if e.hp <= 0: event("ko", {"target": e})
func throw_off(e: Dictionary, a: float, sp: float, up: float) -> void:
	e.state = "flying"; e.t = 0.0; e.vx = sin(a)*sp; e.vz = cos(a)*sp; e.vy = 3.2*up; e.yaw = a + PI
	if e.hp > 0: e.hp = maxf(0, e.hp - 1.5)
	hit1(e, "fall")
	if e.has("pipe") and e.pipe != null: e.pipe.visible = false; e.pipe = null; e.weapon = false

func hurt(e: Dictionary, dmg: float) -> void:
	if R.blocking and R.act == "block": dmg *= 0.2; g.cue("clang"); shake(0.08, 0.12); R.hp -= dmg; return
	R.hp -= dmg; R.hurt_t = 0.0; R.chain = 0; R.chain_t = 0.0; R.combo = 0; R.buffer = null
	if R.grabbed_by != null: return
	R.act = "hurt"; R.t = 0.0; R.len = 0.42; robin_clip("hit", true)
	var p := P(); var a := ang_to(e.x, e.z, p.x, p.y)
	R.dash = {"x0": p.x, "z0": p.y, "x1": p.x + sin(a)*0.7, "z1": p.y + cos(a)*0.7, "t": 0.0, "len": 0.2, "arc": 0.0}
	g.cue("hurt"); shake(0.28, 0.3); hitstop(0.07); red.color.a = 0.45
	if R.hp <= 0: beaten()
func beaten() -> void:
	R.act = "down"; R.t = 0.0; robin_clip("fall", true); slow_to(0.25, 6)
	later(1.1, func():
		R.hp = 100.0; R.act = null; robin_clip("fight")
		move_to(MEET.robin.x, MEET.robin.y)
		var i := 0
		for e in alive(): e.state = "circle"; e.t = 0.0; e.cool = 2 + i*0.6; i += 1
		slow_to(1, 4); g.note("Back on your feet. They are still here."))

# ================================================================== the crew, thinking
func _tick_crew(dt: float) -> void:
	var p := P()
	var swingers := E.filter(func(e): return e.state == "windup" or e.state == "approach").size()
	var max_swing := 2 if (dir != null and dir.free) else 1
	for e in E:
		var held: bool = dir != null and dir.freeze != null and dir.freeze.target == e and (e.state == "windup" or e.state == "grab")
		if not held: e.t += dt
		var d: float = Vector2(e.x, e.z).distance_to(p); var to_her := ang_to(e.x, e.z, p.x, p.y)
		match e.state:
			"idle", "talk", "watch":
				var far := 0.0
				if e.home != null: far = Vector2(e.home.x - e.x, e.home.y - e.z).length()
				if e.state == "watch" and e.home != null and far > 0.3: _step(e, ang_to(e.x, e.z, e.home.x, e.home.y), e.K.walk*1.4, dt); play(e, "walk")
				else:
					e.yaw = turn_to(e.yaw, to_her, dt*4)
					if e.state == "watch" and d < 2.2: _step(e, to_her + PI, e.K.walk, dt, true)
					play(e, "talk" if e.state == "talk" else ("idle" if (e.state == "idle" or e.kind == "buyer") else "fight"))
			"circle":
				e.yaw = turn_to(e.yaw, to_her, dt*6)
				var off: float = d - e.want_ring
				var mv := Vector2.ZERO
				if absf(off) > 0.35: mv += Vector2(sin(to_her), cos(to_her))*signf(off)
				var sa: float = to_her + PI/2*e.side; mv += Vector2(sin(sa), cos(sa))*0.45
				if e.t > randf_range(2, 4): e.side *= -1; e.t = 0.0
				var moving := mv.length() > 0.3
				if moving: _step(e, atan2(mv.x, mv.y), e.K.walk*0.8, dt, true)
				play(e, (("walk" if off > 0 else "walk_back") if absf(off) > 0.35 else ("walk_left" if e.side > 0 else "walk_right")) if moving else "fight")
				e.cool -= dt
				if e.active and e.cool <= 0 and swingers < max_swing and not (dir != null and dir.hold) and R.grabbed_by == null: e.state = "approach"; e.t = 0.0
			"approach":
				e.yaw = turn_to(e.yaw, to_her, dt*8)
				var reach := 0.9 if e.grabber else 1.55
				if d > reach: _step(e, to_her, e.K.run if d > 3 else e.K.walk*1.6, dt); play(e, "sprint" if d > 3 else "walk")
				if d <= reach + 0.05:
					if e.grabber: grab(e)
					else:
						e.state = "windup"; e.t = 0.0; e.win = 0.95 if e.weapon else e.K.windup
						var ln := hit1(e, "hook" if (e.weapon or randf() < 0.5) else "cross")
						e.strike_at = minf(e.win, ln*0.42)
						event("windup", {"e": e})
				if e.t > 6: e.state = "circle"; e.t = 0.0; e.cool = randf_range(1, 2)
			"windup":
				e.yaw = turn_to(e.yaw, to_her, dt*(6.0 if e.t < e.strike_at*0.6 else 1.0))
				if e.t >= e.strike_at: strike(e)
			"recover":
				if e.t > 0.6: e.state = "circle"; e.t = 0.0; e.cool = randf_range(1.4, 2.8)*(0.8 if (dir != null and dir.free) else 1.4)
			"stagger":
				e.x += e.vx*dt; e.z += e.vz*dt; e.vx *= exp(-dt*8); e.vz *= exp(-dt*8)
				if e.t > (1.7 if e.parried else 0.6): e.parried = false; e.state = "circle"; e.t = 0.0; e.cool = randf_range(0.8, 1.8)
			"pulled":
				var k := clampf(e.t/0.34, 0, 1); var q := k*k
				e.x = lerpf(e.from.x, e.to.x, q); e.z = lerpf(e.from.y, e.to.y, q); e.yaw = to_her; e.y = sin(k*PI)*0.35
				if k >= 1: e.y = 0.0; e.state = "stagger"; e.t = 0.0; e.vx = 0.0; e.vz = 0.0; e.parried = true; shake(0.2, 0.2); hitstop(0.06); g.cue("punch")
			"flying":
				e.x += e.vx*dt; e.z += e.vz*dt; e.y += e.vy*dt; e.vy -= 18*dt
				var c := _crash(e)
				if c != "" or e.y <= 0:
					e.y = maxf(0, e.y)
					if c != "": shake(0.5 if c == "car" else 0.3, 0.35); hitstop(0.07); g.cue("boom")
					e.state = "down"; e.t = 0.0; e.vx *= 0.2; e.vz *= 0.2
			"down":
				e.x += e.vx*dt; e.z += e.vz*dt; e.vx *= exp(-dt*5); e.vz *= exp(-dt*5); e.y = maxf(0, e.y - dt*4)
				if e.hp <= 0:
					if e.t > 0.9 and e.clip != "ko": e.state = "ko"; e.ko_at = Time.get_ticks_msec(); hit1(e, "ko")
				elif e.t > 2.4 and not (dir != null and dir.hold): e.state = "getup"; e.t = 0.0; hit1(e, "getup")
			"getup":
				if e.t > 1.5: e.state = "circle"; e.t = 0.0; e.cool = randf_range(1.5, 3)
			"grab":
				var a: float = R.face + PI; e.x = p.x + sin(a)*0.55; e.z = p.y + cos(a)*0.55; e.yaw = R.face
				if e.t > 3.2 and not (dir != null and dir.hold): R.grabbed_by = null; R.act = null; hurt(e, 14); e.state = "recover"; e.t = 0.0
			"hesitate":
				e.yaw = turn_to(e.yaw, to_her, dt*5)
				if d < 4.6: _step(e, to_her + PI, 0.7, dt, true); play(e, "walk_back")
				else: play(e, "fight")
		if not e.state in ["flying", "pulled", "grab"]:
			for o in E:
				if o == e or o.state == "ko" or e.state == "ko": continue
				var dv := Vector2(e.x - o.x, e.z - o.z); var dd := dv.length()
				if dd > 0 and dd < 0.8: e.x += dv.x/dd*(0.8 - dd)*0.5; e.z += dv.y/dd*(0.8 - dd)*0.5
		if e.state != "flying": var c2 := clamp_arena(e.x, e.z, 0.3); e.x = c2.x; e.z = c2.y
		e.ap.speed_scale = 0.0 if held else 1.0
		_place(e)

func _step(e: Dictionary, a: float, sp: float, dt: float, keep := false) -> void:
	e.x += sin(a)*sp*dt; e.z += cos(a)*sp*dt
	if not keep: e.yaw = turn_to(e.yaw, a, dt*8)
func strike(e: Dictionary) -> void:
	var p := P(); var d: float = Vector2(e.x, e.z).distance_to(p); var a: float = absf(ang_diff(ang_to(e.x, e.z, p.x, p.y), e.yaw))
	e.state = "recover"; e.t = 0.0
	if d > 2.1 or a > 1.0: event("whiff", {"e": e, "dodged": R.since_dodge < 0.9}); return
	if R.parry_t > 0: parried(e); return
	if R.iframe > 0: event("whiff", {"e": e, "dodged": true}); return
	hurt(e, 22.0 if e.weapon else e.K.dmg)
	event("hurt", {"e": e})
func parried(e: Dictionary) -> void:
	e.state = "stagger"; e.t = 0.0; e.parried = true; hit1(e, "stagger")
	var p := P(); var a := ang_to(p.x, p.y, e.x, e.z); e.vx = sin(a)*1.8; e.vz = cos(a)*1.8
	g.cue("clang"); hitstop(0.12); shake(0.3, 0.3); slow_for(0.2, 0.8); _flash(0.25)
	R.counter_ready = true
	if e.has("pipe") and e.pipe != null: e.pipe.visible = false; e.pipe = null; e.weapon = false
	event("parry", {"e": e})
func grab(e: Dictionary) -> void:
	e.state = "grab"; e.t = 0.0; R.grabbed_by = e; R.act = "grabbed"; R.t = 0.0; R.chain = 0
	robin_clip("block", true); hit1(e, "block"); g.cue("grab"); shake(0.15, 0.2)
	event("grabbed", {"e": e})
func _crash(e: Dictionary) -> String:
	if e.x > CAR.x1 - 0.2 and e.x < CAR.x2 + 0.2 and e.z > CAR.z1 - 0.2 and e.z < CAR.z2 + 0.2 and e.y < 1.5: e.x -= e.vx*0.03; e.z -= e.vz*0.03; return "car"
	if e.x < ALLEY.x1 - 0.1 or e.x > ALLEY.x2 + 0.1: e.x = clampf(e.x, ALLEY.x1, ALLEY.x2); return "wall"
	return ""

# ================================================================== the look of it
func _spark(at: Vector3, col: Color) -> void:
	var s := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.12; sm.height = 0.24; s.mesh = sm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = col; m.emission_enabled = true; m.emission = col; m.emission_energy_multiplier = 6
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; s.material_override = m; s.position = at; g.add_child(s)
	var tw: Tween = g.create_tween(); tw.set_ignore_time_scale(true); tw.tween_property(s, "scale", Vector3.ONE*2.5, 0.18); tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.18); tw.tween_callback(s.queue_free)
func _tether(e: Dictionary) -> void:
	var l := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.02; cm.bottom_radius = 0.02; cm.height = 1.0; l.mesh = cm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(0.44, 1, 0.94); m.emission_enabled = true; m.emission = Color(0.44, 1, 0.94); m.emission_energy_multiplier = 4
	l.material_override = m; g.add_child(l)
	var t0 := Time.get_ticks_msec()
	var upd := func():
		var a: Vector3 = g.robin.position + Vector3(0, 1.2, 0); var b := Vector3(e.x, e.y + 1.25, e.z)
		var mid := (a + b)/2; var dv := b - a
		if dv.length() > 0.01: l.global_transform = Transform3D(Basis(Quaternion(Vector3.UP, dv.normalized())).scaled(Vector3(1, dv.length(), 1)), mid)
	later_q.append({"every": true, "fn": upd, "until": t0 + 620, "end": func(): l.queue_free()})
func _flash(k: float) -> void:
	var env: Environment = g.env
	env.adjustment_enabled = true; env.adjustment_brightness = 1.0 + k
	var tw: Tween = g.create_tween(); tw.set_ignore_time_scale(true); tw.tween_property(env, "adjustment_brightness", 1.0, 0.35)
func _tick_mark(real: float) -> void:
	var t = R.target if (R.act == "attack" and standing(R.target)) else R.aim
	if not standing(t) or (dir != null and dir.freeze != null): mark.visible = false; return
	mark.visible = true; mark.position = Vector3(t.x, 0.04, t.z)
	(mark.material_override as StandardMaterial3D).albedo_color = Color(1, 0.63, 0.25) if t.state == "windup" else Color.WHITE

# ================================================================== time and the camera
func hitstop(sec: float, scale := 0.03) -> void: stop_t = maxf(stop_t, sec); stop_scale = scale
func slow_to(to: float, rate := 8.0) -> void: ramp.to = to; ramp.rate = rate
func slow_for(to: float, sec: float) -> void:
	if dir != null and dir.freeze != null: return
	slow_to(to, 14); slow_timer = sec; slow_back = 1.0
func _tick_time(real: float) -> void:
	if stop_t > 0: stop_t -= real; time_scale = stop_scale; return
	if slow_timer > 0:
		slow_timer -= real
		if slow_timer <= 0 and not (dir != null and dir.freeze != null): slow_to(slow_back, 3.2)
	var nxt: float = time_scale + (ramp.to - time_scale)*(1 - exp(-real*ramp.rate))
	if absf(nxt - ramp.to) < 0.004: nxt = ramp.to
	time_scale = nxt
func shake(amp: float, ln: float) -> void:
	var now := shake_amp*maxf(0, 1 - shake_t/shake_len) if shake_len > 0 else 0.0
	if amp >= now: shake_amp = amp; shake_len = ln; shake_t = 0.0
## THE FIGHT'S CAMERA: closer than the walking one, and high, looking down on her; it keeps her and the one she is on
## in the picture together, and a hit pushes it in for an instant
func _fight_cam(real: float) -> void:
	var c: Camera3D = g.cam
	var yaw: float = g.cam_yaw; var pitch: float = g.cam_pitch
	var f := Vector2(-sin(yaw), -cos(yaw)); var r := Vector2(cos(yaw), -sin(yaw)); var p := P()
	var t = R.target if (R.act == "attack" and standing(R.target)) else (R.aim if standing(R.aim) else null)
	var td: float = Vector2(t.x, t.z).distance_to(p) if t != null else 0.0
	cam.pull = lerpf(cam.pull, clampf((td - 2)*0.35, 0, 1.6) if t != null else 0.0, 1 - exp(-real*3))
	var back: float = 3.7 + cam.pull; var up: float = clampf(3.1 - sin(pitch)*1.2, 2.4, 3.8) + cam.pull*0.35
	var want := Vector3(p.x - f.x*back + r.x*0.4, up, p.y - f.y*back + r.y*0.4)
	want.x = clampf(want.x, ALLEY.x1 + 0.6, ALLEY.x2 - 0.6)
	if not cam.on: c.global_position = want; cam.on = true; cam.look = Vector3.ZERO
	else: c.global_position = c.global_position.lerp(want, 1 - exp(-real*10))
	var ahead := Vector3(p.x + f.x*2.2 + r.x*0.2, 0.95 + sin(pitch)*2.2, p.y + f.y*2.2 + r.y*0.2)
	var look := ahead
	if t != null: look = Vector3(lerpf(p.x, t.x, 0.42), 1.05 + sin(pitch)*1.4, lerpf(p.y, t.z, 0.42)).lerp(ahead, 0.3)
	cam.look = look if cam.look == Vector3.ZERO else cam.look.lerp(look, 1 - exp(-real*8))
	if shake_len > 0 and shake_t < shake_len:
		shake_t += real; var k := shake_amp*(1 - shake_t/shake_len)
		c.global_position += Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1))*k*0.25
	c.look_at(cam.look)
	cam.punch = maxf(0, cam.punch - real*5)
	c.fov = 70 - 7*sin(minf(1, cam.punch)*PI/2)

# ================================================================== the lesson
func _steps() -> Array:
	return [
		{"id": "attack", "title": "ATTACK", "how": "The first one charges. CLICK (or K) to hit him.",
			"enter": func(): var e := pick("t1"); e.active = true; e.state = "approach"; e.t = 0.0; e.hp = 1.0,
			"on": {"windup": func(x): if x.e.tag == "t1": freeze("CLICK", "ATTACK", "hit him first", "attack", x.e)},
			"done": func(): return pick("t1").hp <= 0, "after": "fightAttack"},
		{"id": "dodge", "title": "DODGE", "how": "Another one swings. SPACE as the fist comes — you are not there when it lands.",
			"enter": func(): var e := pick("t2"); e.active = true; e.state = "approach"; e.t = 0.0; e.guard = func(): return not dir.get("dodged", false),
			"on": {"windup": func(x): if x.e.tag == "t2" and not dir.get("dodged", false): freeze("SPACE", "DODGE", "under it", "dodge", x.e, 0.78),
				"whiff": func(x): _dodge_lesson(x)},
			"done": func(): return pick("t2").hp <= 0},
		{"id": "combo", "title": "COMBO", "how": "Two rush her. CLICK, CLICK, CLICK, CLICK: jab, cross, hook — the fourth is a kick. Keep the chain going.",
			"enter": func(): _combo_enter(),
			"on": {"windup": func(x): if not dir.get("combo_shown", false) and x.e.tag in ["t3", "t4"]: dir.combo_shown = true; freeze("CLICK ×4", "COMBO", "jab · cross · hook · kick — keep it going", "attack", x.e, 0.5),
				"hit": func(x): if x.chain >= 2 and not dir.get("said", false): dir.said = true; g.talk("fightCombo")},
			"done": func(): return pick("t3").hp <= 0 and pick("t4").hp <= 0},
		{"id": "break", "title": "BREAK", "how": "One gets hold of her. F — the bangle on her wrist: a pulse.",
			"enter": func(): var e := pick("t5"); e.active = true; e.grabber = true; e.state = "approach"; e.t = 0.0; e.guard = func(): return not dir.get("broke", false),
			"on": {"grabbed": func(x): freeze("F", "BREAK FREE", "the bangle", "pulse", x.e), "pulse": func(x): dir.broke = true; later(0.6, func(): g.talk("fightBreak"))},
			"done": func(): return R.grabbed_by == null and not pick("t5").state in ["grab", "approach"] and dir.t > 2},
		{"id": "parry", "title": "PARRY", "how": "One has a pipe. RIGHT-CLICK (or R) the instant before it lands: the gauntlet takes it.",
			"enter": func(): var e := pick("t6"); e.active = true; e.state = "approach"; e.t = 0.0; e.guard = func(): return not dir.get("parried", false),
			"on": {"windup": func(x): if x.e.tag == "t6" and not dir.get("parried", false): freeze("RIGHT-CLICK", "PARRY", "the gauntlet takes it", "parry", x.e, 0.82),
				"parry": func(x): _parry_lesson(x)},
			"done": func(): return pick("t6").hp <= 0},
		{"id": "more", "title": "THE GAUNTLETS · POWER", "how": "More of them. HOLD CLICK, then let go: the gauntlet's power punch. Put one through the car.",
			"enter": func(): g.talk("fightMore"); _wave2(); dir.free = true; keys_label.visible = true,
			"on": {"hit": func(x): if x.move == "power": dir.powered = true,
				"charge": func(x): if not dir.get("charge_seen", false): dir.charge_seen = true; slow_to(0.45, 6); prompt("LET GO", "POWER PUNCH", "when you are ready")},
			"done": func(): return dir.get("powered", false) or dir.t > 14},
		{"id": "pull", "title": "THE GAUNTLETS · PULL", "how": "G — the gauntlet casts a line at the one you are facing and drags him to you. Then hit him.",
			"enter": func(): _pull_enter(),
			"on": {"pull": func(x): dir.pulled = true},
			"done": func(): return (dir.get("pulled", false) and dir.t > 1.5) or (alive().is_empty() and dir.t > 2)},
		{"id": "free", "title": "EVERYTHING", "how": "Use all of it. SPACE gets her out of the way — a backflip, a cartwheel, a roll; click as she lands for a sweep. Every one of them down, and it is over.",
			"enter": func(): pass, "done": func(): return false},
		{"id": "regret", "title": "ONE MORE", "how": "He is getting back up.", "enter": func(): _regret_enter(), "done": func(): return dir.get("reg") == null or dir.reg.hp <= 0},
		{"id": "last", "title": "", "how": "", "enter": func(): _last_enter(), "done": func(): return false}]

func _dodge_lesson(x: Dictionary) -> void:
	if x.e.tag == "t2" and x.dodged and not dir.get("dodged", false):
		dir.dodged = true; R.counter_ready = true; R.force_target = x.e; x.e.state = "stagger"; x.e.t = 0.0; x.e.parried = true
		g.talk("fightDodge")
		later(0.9, func(): if on and dir.id == "dodge": freeze("CLICK", "COUNTER", "he is wide open", "attack", x.e))
func _parry_lesson(x: Dictionary) -> void:
	if not dir.get("parried", false):
		dir.parried = true; R.force_target = x.e; x.e.hp = minf(x.e.hp, 2.0)
		later(0.5, func():
			g.talk("fightParry")
			later(0.9, func(): if on and dir.id == "parry": freeze("CLICK", "PUT HIM DOWN", "", "attack", x.e)))
func _combo_enter() -> void:
	var i := 0
	for t in ["t3", "t4"]:
		var e := pick(t); e.active = true; e.state = "approach"; e.t = 0.0; e.cool = 3 + i*2; e.K.windup = 1.1; i += 1
func _pull_enter() -> void:
	var a := alive(); a.sort_custom(func(x, y): return dist(x) > dist(y))
	if a.size(): var far = a[0]; later(1.6, func(): if on and dir.id == "pull" and not dir.get("pulled", false): freeze("G", "PULL", "drag him in", "pull", far))
func _regret_enter() -> void:
	var ks := E.filter(func(e): return e.state in ["ko", "down"] and e.hp <= 0 and e.kind != "buyer")
	ks.sort_custom(func(a, b): return (INF if a.state == "down" else float(a.get("ko_at", 0))) > (INF if b.state == "down" else float(b.get("ko_at", 0))))
	dir.reg = null
	if ks.size():
		var k = ks[0]; k.hp = 1.0; k.state = "getup"; k.t = 0.0; k.active = true; hit1(k, "getup"); dir.reg = k; k.tag = "reg"
	for e in alive():
		if e != dir.reg: e.active = false; e.state = "hesitate"
	later(0.7, func():
		g.talk("fightRegret")
		later(2.2, func(): if on and dir.reg != null and dir.reg.hp > 0: freeze("CLICK", "FINISH IT", "", "attack", dir.reg)))
func _last_enter() -> void:
	dir.hold = true
	for e in alive(): e.active = false; e.state = "hesitate"; e.t = 0.0
	var fin := func(): if on and not dir.get("finished", false): dir.finished = true; finish()
	later(0.3, func():
		g.talk("fightLast")
		later(1.6, func(): g.talk("fightGreat", fin); later(1.3 + g.lines_len("fightGreat"), fin)))
func _wave2() -> void:
	var i := 0
	for w in [[-34.4, -13.8, "big"], [-46.6, -14.2, "lean"], [-40.4, -13.6, "lean"], [-35.8, -37.0, "big"]]:
		var e := spawn(w[2], w[0], w[1], {"state": "approach", "tag": "w%d" % i, "yaw": PI})
		e.active = true; e.cool = 1 + i*0.8; i += 1

func freeze(key: String, what: String, sub: String, want: String, target, at_frac := 0.0) -> void:
	if at_frac > 0 and target != null and target.state == "windup" and target.t < target.strike_at*at_frac:
		dir.pending = {"key": key, "what": what, "sub": sub, "want": want, "target": target, "at": target.strike_at*at_frac}; return
	dir.pending = null
	dir.freeze = {"key": key, "want": want, "target": target}
	if target != null and target.state == "windup" and want == "attack": target.t = minf(target.t, target.strike_at*0.3)
	slow_to(0.035, 9)
	prompt(key, what, sub)
	R.only_key = want
	if target != null and want != "pulse": R.force_target = target
	g.cue("ui")
func clear_for(want: String) -> void:
	if dir == null or dir.freeze == null or dir.freeze.want != want: return
	if want == "pulse": R.pulse_cd = 0.0
	if want == "pull": R.pull_cd = 0.0
	if R.act != "grabbed" and R.act != "down": R.act = null; R.buffer = null; R.dash = null
func unfreeze() -> void:
	if dir == null or dir.freeze == null: return
	dir.freeze = null; R.only_key = null; prompt("")
	slow_to(0.25, 30); slow_timer = 0.45; slow_back = 1.0
func prompt(key: String, what := "", sub := "") -> void:
	prompt_label.text = "" if key == "" else "[center][color=#ffd070][b]%s[/b][/color]\n[b]%s[/b]\n%s[/center]" % [key, what, sub]
func event(nm: String, x: Dictionary) -> void:
	if dir == null: return
	var s: Dictionary = dir.steps[dir.i]
	if s.has("on") and s.on.has(nm): s.on[nm].call(x)
func step_to(i: int) -> void:
	dir.i = i; dir.t = 0.0; dir.id = dir.steps[i].id
	var s: Dictionary = dir.steps[i]
	if s.title != "": g.lesson_card("THE GAUNTLETS · %d / %d" % [i + 1, dir.steps.size() - 1], s.title, s.how); g.objective("Fight your way out.", [s.how])
	else: g.lesson_card("", "", "")
	s.enter.call()
func _tick_director(dt: float) -> void:
	dir.t += dt
	var pd = dir.get("pending")
	if pd != null and pd.target.state == "windup" and pd.target.t >= pd.at: freeze(pd.key, pd.what, pd.sub, pd.want, pd.target)
	elif pd != null and pd.target.state != "windup": dir.pending = null
	var s: Dictionary = dir.steps[dir.i]
	if dir.free and not dir.get("ending", false) and s.id != "regret" and s.id != "last" and not E.any(func(e): return e.kind != "buyer" and e.hp > 0):
		dir.ending = true; dir.pending = null
		if dir.freeze != null: unfreeze()
		R.force_target = null; g.cue("win"); step_to(_index("regret")); return
	if s.done.call() and dir.freeze == null:
		if s.has("after"): g.talk(s.after)
		g.cue("win")
		if dir.i + 1 < dir.steps.size(): step_to(dir.i + 1)
func _index(id: String) -> int:
	for i in steps.size():
		if steps[i].id == id: return i
	return steps.size() - 1

# ================================================================== start, tick, keys
func start(done: Callable) -> void:
	done_cb = done
	on = true; cam.on = false; cam.punch = 0.0; cam.pull = 0.0
	_reset_robin()
	dir = {"i": 0, "t": 0.0, "free": false, "steps": steps, "freeze": null, "pending": null, "hold": false, "id": ""}
	hud.visible = true; keys_label.visible = false
	for e in E:
		e.node.visible = true
		if e.kind != "buyer" and e.hp > 0: e.state = "circle"; e.t = 0.0; e.active = false
	time_scale = 1.0; ramp.to = 1.0
	step_to(0)
func stop() -> void:
	on = false; hud.visible = false; prompt(""); mark.visible = false
	Engine.time_scale = 1.0; time_scale = 1.0; ramp.to = 1.0; stop_t = 0.0; slow_timer = 0.0
	input.held = false; input.charging = false
	g.lesson_card("", "", "")
func finish() -> void:
	var cb := done_cb
	stop()
	if cb.is_valid(): cb.call()
func later(sec: float, fn: Callable) -> void:
	later_q.append({"at": Time.get_ticks_msec() + int(sec*1000), "fn": fn})

## one frame; `real` is wall-clock seconds, the fight runs on its own clock (time_scale)
func tick(real: float) -> void:
	var now := Time.get_ticks_msec()
	var keep := []
	for l in later_q:
		if l.get("every", false):
			l.fn.call()
			if now >= l.until: l.end.call()
			else: keep.append(l)
		elif now >= l.at: l.fn.call()
		else: keep.append(l)
	later_q = keep
	if not on: return
	_tick_time(real)
	var dt := real*time_scale
	g.anim.speed_scale = time_scale
	R.iframe = maxf(0, R.iframe - dt); R.parry_t = maxf(0, R.parry_t - dt); R.chain_t = maxf(0, R.chain_t - dt)
	R.since_dodge += dt; R.pulse_cd = maxf(0, R.pulse_cd - dt); R.pull_cd = maxf(0, R.pull_cd - dt); R.combo_t = maxf(0, R.combo_t - dt); R.hurt_t += dt
	if R.combo_t <= 0: R.combo = 0
	if R.evade_end >= 0:
		R.evade_end += dt
		if R.evade_end > 0.35: R.evade_end = -1.0; R.out_of_evade = false
	if R.hurt_t > 3 and R.hp < 100: R.hp = minf(100, R.hp + dt*6)
	if input.held:
		input.held_t += real
		if input.held_t > 0.38 and not input.charging and (R.act == null or R.act == "idle"): input.charging = true; robin_clip("fight"); event("charge", {})
	if R.dash != null:
		var d: Dictionary = R.dash; d.t += dt
		var k := clampf(d.t/d.len, 0, 1); var e := 1 - (1 - k)*(1 - k)
		move_to(lerpf(d.x0, d.x1, e), lerpf(d.z0, d.z1, e))
		g.robin.position.y = sin(k*PI)*d.arc if d.arc > 0 else 0.0
		if k >= 1: R.dash = null
	else: g.robin.position.y = 0.0
	if R.act != null:
		R.t += dt
		if R.act == "attack":
			var m: Dictionary = MOVE[R.move]
			if standing(R.target): R.face = turn_to(R.face, ang_to(P().x, P().y, R.target.x, R.target.z), dt*14)
			if not R.landed and R.t >= R.len*m.hit: land()
			if R.t >= R.len*m.free and R.buffer != null: var b: String = R.buffer; R.buffer = null; R.act = null; attack(b)
			elif R.t >= R.len*0.9: R.act = null; R.force_target = null
		elif R.act == "wall" and R.t >= R.len:
			var t = R.wall_to; R.act = null
			if standing(t):
				R.target = t; var p := P(); var a := ang_to(p.x, p.y, t.x, t.z); var go := maxf(0, Vector2(t.x, t.z).distance_to(p) - 1.1)
				R.act = "attack"; R.move = "flykick"; R.t = 0.0; R.landed = false; R.face = a; R.len = robin_clip("flykick", true); if R.len <= 0: R.len = 0.9
				R.dash = {"x0": p.x, "z0": p.y, "x1": p.x + sin(a)*go, "z1": p.y + cos(a)*go, "t": 0.0, "len": R.len*MOVE.flykick.hit, "arc": 1.1}; slow_for(0.3, 0.6)
		elif R.act == "dodge" and R.evade != null and R.t >= R.len*0.82:
			var b2 = R.buffer; R.act = null; R.evade = null; R.buffer = null; R.evade_end = 0.0
			if b2 != null: R.out_of_evade = true; attack(b2)
		elif R.act != "grabbed" and R.act != "down" and R.t >= R.len: R.act = null; R.blocking = false
	if R.act == null or R.act == "idle":
		if not walk_robin(dt):
			var t2 = R.aim if (standing(R.aim) and dist(R.aim) < 5) else pick_target(5)
			if t2 != null: R.face = turn_to(R.face, ang_to(P().x, P().y, t2.x, t2.z), dt*6)
			robin_clip("fight")
	g.model.rotation.y = R.face
	aim_target(); _tick_mark(real)
	_fight_cam(real)
	_tick_crew(dt)
	for e in E: e.ap.speed_scale = time_scale if e.ap.speed_scale > 0 else 0.0
	_tick_director(dt)
	hp_bar.size.x = 260*clampf(R.hp, 0, 100)/100.0; hp_bar.color = Color(1, 0.4, 0.3) if R.hp < 35 else Color(0.4, 1, 0.9)
	combo_label.text = ("%d HITS" % R.combo) if (R.combo >= 2 and R.combo_t > 0) else ""
	red.color.a = maxf(0, red.color.a - real*1.2)

func _allow(w: String) -> bool: return R.only_key == null or R.only_key == w
func key(ev: InputEvent) -> bool:
	if not on: return false
	if ev is InputEventMouseButton:
		if ev.button_index == MOUSE_BUTTON_LEFT: (_press() if ev.pressed else _release()); return true
		if ev.button_index == MOUSE_BUTTON_RIGHT:
			if ev.pressed: _do_parry()
			else: R.blocking = false
			return true
	if ev is InputEventKey:
		if ev.echo: return true
		match ev.keycode:
			KEY_K: (_press() if ev.pressed else _release()); return true
			KEY_R:
				if ev.pressed: _do_parry()
				else: R.blocking = false
				return true
			KEY_SPACE:
				if ev.pressed and _allow("dodge"):
					clear_for("dodge")
					if dodge() and dir.freeze != null and dir.freeze.want == "dodge": R.iframe = maxf(R.iframe, 0.6); unfreeze()
				return true
			KEY_F:
				if ev.pressed and _allow("pulse") and (R.grabbed_by != null or R.only_key == null):
					clear_for("pulse")
					if pulse() and dir.freeze != null and dir.freeze.want == "pulse": unfreeze()
				return true
			KEY_G:
				if ev.pressed and _allow("pull"):
					clear_for("pull")
					if pull() and dir.freeze != null and dir.freeze.want == "pull": unfreeze()
				return true
	return false
func _do_parry() -> void:
	if R.only_key == null or R.only_key == "parry":
		clear_for("parry")
		if parry() and dir.freeze != null and dir.freeze.want == "parry": R.parry_t = 0.5; unfreeze()
func _press() -> void: input.held = true; input.held_t = 0.0; input.charging = false
func _release() -> void:
	if not input.held: return
	var charged: bool = input.charging; input.held = false; input.charging = false
	if R.only_key != null and R.only_key != "attack": return
	if charged:
		prompt(""); clear_for("attack")
		if attack("power") and dir.freeze != null: unfreeze()
		slow_for(0.15, 0.7); return
	clear_for("attack")
	if attack("punch") and dir.freeze != null and dir.freeze.want == "attack": unfreeze()
