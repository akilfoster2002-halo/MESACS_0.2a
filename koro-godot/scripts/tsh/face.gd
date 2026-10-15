## HER FACE (avatar.js faceTick / headGaze / faceHead, tsh.js FEELS / lipsTick / gazeTick). Robin's skin carries
## morph targets made from a facial rig — jawOpen, smile, mouthO, frown, browUp, browDown, blink — and the face is
## driven the way the browser drives it:
##   · she blinks on her own, every few seconds and now and then twice;
##   · a feeling (feel) eases in, holds for its time and eases out: a film shot's mood, held under the shot; the
##     feeling of the line she is saying (FEEL, by its words); a wince when she is hit, a small smile when it goes
##     her way; set (brows down, mouth firm) while she fights;
##   · her mouth opens as loud as her voice is (or, a line with no recording, a syllable at a time);
##   · what she looks at, she turns her head to — most of the way (her eyes are painted on): the phone in her
##     hands, whoever is talking, what a film shot shows, whoever is coming at her; a piece of her kit as it goes on.
class_name Face
extends Node

const DROP_PER_BROW := 0.006           # metres the whites of her eyes move down per unit of her browUp shape (measured)
const GAIN := 1.45                    # how much further every feeling goes than it was written
const CHANNELS := ["smile", "frown", "browUp", "browDown", "mouthO", "jawOpen", "blink"]
const SELF := {"jacket": ["Spine2", 0.16, -0.05], "shoes": ["LeftFoot", 0.12, 0.0], "gloves": ["LeftHand", 0.03, 0.0], "bracelet": ["LeftForeArm", 0.05, -0.1], "pack": ["RightShoulder", 0.02, 0.0]}
var g
var feels := {}; var feel_of := {}
var shapes: Array = []                 # [mesh instance, {shape name: index}]
var sk: Skeleton3D; var head := -1
var expr := {}; var cur := {}
var blink_in := 2.5; var blink_t := 0.0
var mouth := 0.0
var hx := 0.0; var hy := 0.0           # the head's turn: + to her left, + chin up
var target = null                      # a Vector3, or a Callable giving one
var gmood = null
var glance = null                      # {bone, ahead, up, t}: a look down at a piece of her kit
# the lips: a line's feeling, the shot's mood, the flap of a line with no recording
var mood = null; var feel_t := 0.0; var mood_on := false
var flap := 0.0; var ph := 0.0; var amp := 0.5; var robin_voice := false
var lid_open := 1.0; var eyes: Eyes = null; var eye_t := Vector2.ZERO; var eye_now := Vector2.ZERO; var eye_m := Vector2.ZERO; var eye_rest := 0.5; var eye_micro := 0.2; var blink_shown := 0.0
var fight_set := 0.0; var _lt := 0.0
var bus := -1; var analyzer: AudioEffectSpectrumAnalyzerInstance

func _init(game) -> void:
	g = game
	var d = g._json("res://assets/tsh/feels.json"); feels = d.feels; feel_of = d.feel

func _ready() -> void:
	sk = g._find(g.model, func(x): return x is Skeleton3D)
	var st: Array = [g.model]
	while st.size():
		var n: Node = st.pop_back(); st.append_array(n.get_children())
		if n is MeshInstance3D and (n as MeshInstance3D).mesh and (n as MeshInstance3D).mesh.get_blend_shape_count() > 0:
			var m: Mesh = (n as MeshInstance3D).mesh; var idx := {}
			for i in m.get_blend_shape_count(): idx[String(m.get_blend_shape_name(i))] = i
			shapes.append([n, idx])
	if sk:
		head = sk.find_bone("mixamorigHead")
		var hl := HeadLook.new(); hl.face = self; sk.add_child(hl)
		eyes = Eyes.attach(g.model)                      # after the head's turn, so they ride it
	# her voice on a bus of its own, so its loudness can open her mouth
	bus = AudioServer.bus_count; AudioServer.add_bus(bus); AudioServer.set_bus_name(bus, "TSHVoice"); AudioServer.set_bus_send(bus, "Master")
	AudioServer.add_bus_effect(bus, AudioEffectSpectrumAnalyzer.new())
	analyzer = AudioServer.get_bus_effect_instance(bus, 0)
	g.voice_player.bus = "TSHVoice"

func _shape(n: String, v: float) -> void:
	for s in shapes:
		var i = s[1].get(n)
		if i != null: (s[0] as MeshInstance3D).set_blend_shape_value(i, v)


# ------------------------------------------------------------------ what the story asks for
## one channel, for a while
func expr_(n: String, v := 1.0, secs := 1.5) -> void: expr[n] = {"v": v, "t": secs}
## a whole feeling at once (FEELS[name]) for `secs`; the channels it does not name let go
func feel(name, secs: float) -> void:
	var f: Dictionary = feels.get(name, {}) if name != null else {}
	for n in CHANNELS:
		if not f.has(n): expr.erase(n)
	for n in f:
		if n in CHANNELS and float(f[n]) > 0: expr_(n, minf(1.0, float(f[n])*GAIN), secs)
## a film shot's mood: held for the shot, under her lines
func shot_mood(m) -> void:
	mood = m
	if mood_on: feel_t = 0.0; mood_on = false
## she says a line: its feeling, and her mouth (a recording's loudness, or a syllable at a time)
func say(who: String, text: String, secs: float, recorded: bool) -> void:
	robin_voice = who == "robin" and recorded
	if who != "robin": return
	var words := text
	flap = 0.0 if recorded else 0.9 + words.length()*0.05
	var f = feel_of.get(text)
	if f == null:
		if text.contains("?!") or text.contains("!?"): f = "shocked"
		elif text.strip_edges().ends_with("?"): f = "skeptical"
		elif text.strip_edges().ends_with("!"): f = "surprised"
		elif text.begins_with("..."): f = "tired"
	if f != null: feel_t = (secs if secs > 0 else (flap if flap > 0 else 1.5)) + 0.9; feel(f, feel_t)
## between lines: a wince when she is hit, a small smile when it goes her way, a start at a sting
func cue(kind: String) -> void:
	var f = {"hurt": ["pain", 0.55], "win": ["smug", 1.2], "sting": ["surprised", 1.4]}.get(kind)
	if f != null: feel_t = f[1]; feel(f[0], f[1])
func glance_self(piece: String, secs := 2.2) -> void:
	if SELF.has(piece): glance = {"s": SELF[piece], "t": secs}

# ------------------------------------------------------------------ each frame
func tick(dt: float) -> void:
	if shapes.is_empty() or dt <= 0: return
	_lips(dt)
	# the blink: about a sixth of a second, closed in the middle of it
	blink_in -= dt
	if blink_in <= 0: blink_t = 0.17; blink_in = 0.25 if randf() < 0.15 else 2 + randf()*4
	var blink := 0.0
	if blink_t > 0: blink_t = maxf(0, blink_t - dt); blink = minf(1, 1.4*(1 - absf(blink_t/0.17*2 - 1)))
	_alive(dt)
	var k := 1 - exp(-dt*22); var ke := 1 - exp(-dt*10); var held := {}
	for n in CHANNELS:
		var want := 0.0
		if expr.has(n):
			expr[n].t -= dt
			if expr[n].t > 0: want = expr[n].v
			else: expr.erase(n)
		var c: float = cur.get("_" + n, 0.0); held[n] = c + (want - c)*ke; cur["_" + n] = held[n]
	for n in ["smile", "frown", "browUp", "browDown"]: cur[n] = held[n]
	# no further than about half: past that the lips stretch over a mouth with no inside to it
	cur.jawOpen = cur.get("jawOpen", 0.0) + (minf(0.5, mouth*0.5 + held.jawOpen) - cur.get("jawOpen", 0.0))*k
	cur.mouthO = cur.get("mouthO", 0.0) + (minf(1, mouth*0.2 + held.mouthO) - cur.get("mouthO", 0.0))*k
	blink_shown = maxf(blink, minf(held.blink, 0.3)); _shape("blink", blink_shown)                     # heavy lids (sleepy) under the blinks
	for n in cur:
		if not String(n).begins_with("_"): _shape(n, cur[n])
	_gaze(dt)
	if OS.has_environment("TSH_FACELOG"):
		_lt += dt
		if _lt > 1.0: _lt = 0.0; print("FACE mood=", mood, " ", {"smile": snappedf(cur.get("smile", 0), 0.01), "frown": snappedf(cur.get("frown", 0), 0.01), "browUp": snappedf(cur.get("browUp", 0), 0.01), "browDown": snappedf(cur.get("browDown", 0), 0.01), "jaw": snappedf(cur.get("jawOpen", 0), 0.01)}, " head=", snappedf(hx, 0.01), ",", snappedf(hy, 0.01), " tgt=", target != null)

## ALIVE: between feelings her face is never quite still — a brow flickers, the corner of her mouth goes, she squints
## at something; in play she reacts to what she does. And when she talks, her brows ride the stressed syllables.
var tic_t := 1.5; var stress := 0.0; var last_mouth := 0.0
func _alive(dt: float) -> void:
	tic_t -= dt
	if tic_t <= 0:
		tic_t = 1.2 + randf()*2.8
		if feel_t <= 0.2:
			var r := randf(); var d := 0.5 + randf()*0.9
			if r < 0.3: expr_("browUp", 0.35 + randf()*0.35, d)
			elif r < 0.5: expr_("smile", 0.25 + randf()*0.35, d + 0.6)
			elif r < 0.68: expr_("browDown", 0.3 + randf()*0.3, d)
			elif r < 0.82: expr_("frown", 0.2 + randf()*0.25, d)
			else: expr_("mouthO", 0.25, 0.4); expr_("browUp", 0.5, 0.5)
	if mouth > 0.5 and last_mouth < 0.35 and randf() < 0.55: stress = 0.3
	last_mouth = mouth
	if stress > 0:
		stress = maxf(0, stress - dt)
		expr_("browUp", maxf(expr.get("browUp", {"v": 0.0}).v, sin(stress/0.3*PI)*0.7), 0.1)
## what she does, on her face (the shoes, a landing, a fall)
func react(kind: String) -> void:
	var f = {"ignite": ["shocked", 1.2], "jumpPerfect": ["grin", 1.0], "boundPerfect": ["grin", 0.9], "pullPerfect": ["grin", 1.0], "reboundPerfect": ["smug", 1.0],
		"jump": ["determined", 0.6], "bound": ["focused", 0.5], "dive": ["determined", 0.8], "roll": ["annoyed", 0.7], "dash": ["determined", 0.5], "land": ["relieved", 0.6]}.get(kind)
	if f != null and feel_t < 0.3: feel_t = f[1]; feel(f[0], f[1])
func _lips(dt: float) -> void:
	var v := 0.0
	if robin_voice and g.voice_player.playing and analyzer:
		var m: Vector2 = analyzer.get_magnitude_for_frequency_range(80, 4000)
		v = clampf((m.length() - 0.004)*14, 0, 1)
	elif flap > 0:
		flap -= dt; var was := ph; ph += dt*5.2
		if floorf(ph) != floorf(was): amp = 0.35 + randf()*0.6          # a new syllable, its own size
		v = maxf(0, sin(ph*PI))*amp*minf(1, flap*4)
	if not g.voice_player.playing: robin_voice = false
	mouth = clampf(v, 0, 1)
	feel_t = maxf(0, feel_t - dt)
	if g.mode == "reel" and mood != null and feel_t <= 0: feel(mood, 0.5); feel_t = 0.35; mood_on = true
	if g.mode == "fight" and feel_t <= 0:
		fight_set -= dt
		if fight_set <= 0: fight_set = 0.25; expr_("browDown", 0.7, 0.4); expr_("frown", 0.25, 0.4)

## where she looks: the turn of her head toward it (her eyes are painted on)
func _gaze(dt: float) -> void:
	var tp = _point(dt)
	var ax := 0.0; var ay := -0.25 if gmood == "down" else 0.0
	var home := Vector2.ZERO; var aim := false
	if tp != null and head >= 0:
		var hp: Vector3 = sk.global_transform*sk.get_bone_global_pose(head).origin
		var q: Quaternion = g.model.global_basis.get_rotation_quaternion()
		var d: Vector3 = q.inverse()*((tp as Vector3) - hp)
		var yaw := atan2(d.x, d.z); var pitch := atan2(d.y, Vector2(d.x, d.z).length())
		if absf(yaw) < 1.75:
			var hy_ := clampf(yaw*0.6, -0.8, 0.8); var hp_ := clampf(pitch*0.55, -0.6, 0.35)
			ax = hy_; ay = hp_; aim = true
			home = Vector2(clampf((yaw - hy_)/0.55, -1, 1), clampf((pitch - hp_)/0.45, -0.85, 0.85))
	if gmood == "down": home = Vector2(home.x*0.5, minf(home.y, 0) - 0.45)
	# the eyes (avatar.js faceTickFull): they rest, jump, and rest again — on what she looks at, when there is something
	eye_rest -= dt
	if aim and eye_rest > 0.15 and home.distance_to(eye_t) > 0.3: eye_rest = 0.12
	if eye_rest <= 0:
		var held := (0.4 if gmood == "dart" else 0.65) if aim else 0.3; var spread := 0.45 if aim else 0.95
		var to := home if randf() < held else home + Vector2(randf_range(-1, 1)*spread, randf_range(-1, 1)*spread*0.7)
		eye_rest = 0.18 + randf()*0.4 if gmood == "dart" else (0.35 + randf()*1.0 if aim else 0.3 + randf()*0.9)
		if to.distance_to(eye_t) > 0.35 and randf() < 0.4 and blink_t <= 0: blink_in = 0.02      # a big jump takes a blink with it
		eye_t = to
	elif aim and eye_rest > 0.3 and home.distance_to(eye_t) < 0.25: eye_t = home
	if not aim: ax = eye_t.x*0.3; ay = eye_t.y*0.2 + (-0.18 if gmood == "down" else 0.0)
	eye_micro -= dt
	if eye_micro <= 0: eye_micro = 0.15 + randf()*0.35; eye_m = Vector2(randf_range(-0.035, 0.035), randf_range(-0.025, 0.025))
	var target_e: Vector2 = eye_t + eye_m
	eye_now = eye_now.lerp(target_e, 1 - exp(-dt*(38.0 if target_e.distance_to(eye_now) > 0.12 else 12.0)))
	if eyes:
		eyes.drop = DROP_PER_BROW*maxf(0.0, float(cur.get("browUp", 0.0)))      # her raised brows carry her eyes' whites down with them
		eyes.look(eye_now.x, eye_now.y)
		# with a little give, so a lid at the edge cannot make them chatter
		if eyes.is_open and blink_shown > 0.5: eyes.open(false)
		elif not eyes.is_open and blink_shown < 0.4: eyes.open(true)
	var kh := 1 - exp(-dt*4)
	hx += (ax - hx)*kh; hy += (ay - hy)*kh

func _point(dt: float):
	if glance != null:
		glance.t -= dt
		if glance.t > 0 and sk:
			var b := -1
			for i in sk.get_bone_count():
				if sk.get_bone_name(i).ends_with(glance.s[0]): b = i; break
			if b >= 0:
				var q: Quaternion = g.model.global_basis.get_rotation_quaternion()
				return sk.global_transform*sk.get_bone_global_pose(b).origin + q*Vector3(0, glance.s[2], glance.s[1])
		else: glance = null
	if target == null: return null
	var t = target.call() if target is Callable else target
	return t if t is Vector3 else null

## AFTER THE CLIP: the head turned a little towards where she is looking (avatar.js faceHead)
class HeadLook extends SkeletonModifier3D:
	var face
	func _process_modification() -> void:
		var s := get_skeleton()
		if s == null or face == null or face.head < 0: return
		var r := s.get_bone_pose_rotation(face.head)
		s.set_bone_pose_rotation(face.head, r*Quaternion.from_euler(Vector3(-face.hy, face.hx, 0)))
