## YOU — walking, swimming and flying on Wano.
##
## Position is a direction and an altitude, exactly as in the browser: the
## keys rotate the direction round the centre of the planet, so going
## straight on comes back round, and "down" is always towards the middle.
##
## Three ways of getting about answer three questions (public/planet.js):
## walking asks which way; driving (car.gd) which way and how fast; flying
## which way, how fast and HOW HIGH — so flying is its own function rather
## than a flag inside walking, where the third question would be ignored on
## every line. Swimming is not chosen: where the water is deeper than you are
## tall, the surface becomes what you rest on.
class_name Walker
extends Node3D

const WALK := 6.5
const RUN := 11.0
const SWIM := 3.4
const JUMP := 8.0
const GRAV := 22.0
const HEIGHT := 1.7
const CEILING := 120.0
## Flight, the browser's AIR: airspeed and climb are CHASED, not set, so
## letting go of W leaves you gliding and a turn at speed carries you wide.
const AIR := {"top": 34.0, "accel": 22.0, "drag": 6.0, "back": -6.0, "turn": 1.7,
	"climb": 16.0, "rise": 26.0, "bank": 0.62, "roll": 3.2, "floor": 1.4}
const CHARACTERS := {"s": "Kyle", "t": "Mia", "u": "Savannah", "v": "Carlos", "w": "Robin"}

var world: Node3D
var dir := Vector3(0, 0, 1)
var fwd := Vector3(0, 1, 0)
var alt := 0.0
var vy := 0.0
var on_ground := true
var pitch := -0.18
var first_person := false
var moving := false
var speed_now := 0.0
var mount: Panda = null
var car: Car = null
var hidden := false
var hidden_in_mecha := false:
	set(v):
		hidden = v
	get:
		return hidden

var flying := false
var swimming := false
var air := 0.0
var climb := 0.0
var roll := 0.0
var lean := 0.0
var bank := 0.0
var turned := 0.0              # what the mouse turned you by this frame
var zoom := 6.2
var emote := ""
var emote_t := 0.0
var character := "s"
var gait_f := 0.0
var gait_s := 0.0

var streaks: MultiMeshInstance3D
var model: Node3D
var model_base := Vector3.ZERO
var skel: Skeleton3D
var hips := -1
var ap: AnimationPlayer
var cam: Camera3D

func _ready() -> void:
	# who you are rides in the progress bag, so it follows your account
	character = str(Progress.get_value("char", Settings.get_value("character", "s")))
	if not CHARACTERS.has(character):
		character = "s"
	_load_body()
	cam = Camera3D.new()
	cam.far = 5000.0
	cam.fov = 62.0
	world.add_child.call_deferred(cam)
	cam.make_current.call_deferred()
	streaks = _streaks()
	cam.add_child(streaks)

## WHAT SPEED LOOKS LIKE WHEN THERE IS NOTHING TO MEASURE IT AGAINST. A
## hundred metres up, the planet slides past far below and thirty-four metres
## a second looks like standing still — so the air itself is drawn: lines
## streaming past the lens from a point ahead, as in every flying shot ever
## animated. They live in the camera's own space and cost one draw call.
func _streaks() -> MultiMeshInstance3D:
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, fog_disabled;
uniform float k = 0.0;
uniform float spd = 0.0;
varying float vA;
void vertex(){
	vec4 c = INSTANCE_CUSTOM;              // angle, radius, phase, length
	float a = c.x * 6.2832;
	float r = 2.5 + c.y * 9.0;
	float u = fract(TIME * (0.35 + spd / 60.0) + c.z);
	float z = -70.0 + u * 78.0;
	vec3 rad = vec3(cos(a), sin(a), 0.0);
	vec3 tan = vec3(-sin(a), cos(a), 0.0);
	VERTEX = rad * r + vec3(0.0, 0.0, z) + tan * VERTEX.x * 0.05 + vec3(0.0, 0.0, 1.0) * VERTEX.y * (2.0 + c.w * 5.0) * (0.4 + k);
	vA = k * sin(3.1416 * u) * (0.35 + 0.65 * c.w);
}
void fragment(){
	float edge = 1.0 - abs(UV.x - 0.5) * 2.0;
	ALBEDO = vec3(0.8, 0.9, 1.0) * vA * edge * 0.5;
}
"""
	var q := QuadMesh.new()
	q.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = q
	mm.instance_count = 110
	for i in mm.instance_count:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(randf(), randf(), randf(), randf()))
	mm.custom_aabb = AABB(Vector3(-15, -15, -80), Vector3(30, 30, 100))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visible = false
	return mi

## LOAD FIRST, SWAP AFTER: the one you are wearing stays until the new one
## is standing in the same spot, playing idle at full weight.
func _load_body() -> void:
	var m := Models.spawn("res://assets/characters/character-%s.glb" % character)
	if model:
		model.queue_free()
	model = m
	add_child(model)
	Models.use_vertex_colors(model)
	# bones run from the ankles to the crown; the soles are a little lower
	Models.fit_height(model, HEIGHT * 0.94)
	model_base = model.position
	skel = null
	hips = -1
	var sk := model.find_children("*", "Skeleton3D", true, false)
	if sk.size() > 0:
		skel = sk[0]
		for i in skel.get_bone_count():
			if skel.get_bone_name(i).ends_with("Hips"):
				hips = i
				break
	ap = Models.anim_player(model)
	Models.loop_clips(ap, ["jump", "flip"])
	if ap and ap.has_animation("idle"):
		ap.play("idle", 0.0)
	emote = ""

func set_character(id: String) -> void:
	if id == character or not CHARACTERS.has(id):
		return
	character = id
	Progress.set_value("char", id)
	_load_body()

func can(clip: String) -> bool:
	return ap != null and ap.has_animation(clip)

func place(start: Vector3, facing: Vector3) -> void:
	dir = start.normalized()
	fwd = (facing - dir * facing.dot(dir)).normalized()
	alt = Planet.height(dir)

func _unhandled_input(ev: InputEvent) -> void:
	if hidden:
		return
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var dy: float = -ev.relative.x * 0.0025
		fwd = fwd.rotated(dir, dy).normalized()
		turned += dy
		pitch = clampf(pitch - ev.relative.y * 0.0022, -1.2, 0.8)
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom = maxf(2.4, zoom * 0.9)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom = minf(18.0, zoom * 1.1)

## AN EMOTE IS A CLIP THAT IS NOT A STATE: somebody pressed a button, so it
## lasts as long as the clip, and walking cancels it.
func play_emote(clip: String) -> bool:
	if not can(clip) or flying or swimming or mount or not on_ground:
		return false
	emote = clip
	emote_t = ap.get_animation(clip).length
	return true

func _process(delta: float) -> void:
	if hidden:
		visible = false
		streaks.visible = false
		turned = 0.0
		return
	visible = true
	var up := dir
	if flying:
		_fly(delta, up)
	else:
		_walk(delta, up)
	_animate()
	var b := Planet.stand(dir, fwd)
	if flying and absf(bank) > 0.001:
		b = Basis(b.z, -bank) * b
	global_transform = Transform3D(b, dir * (Planet.R + alt))
	_seat()
	_camera(delta)
	var fast := clampf((absf(air) - 8.0) / 26.0, 0.0, 1.0) if flying else 0.0
	streaks.visible = fast > 0.01
	if streaks.visible:
		var m := (streaks.multimesh.mesh as QuadMesh).material as ShaderMaterial
		m.set_shader_parameter("k", fast)
		m.set_shader_parameter("spd", absf(air))
	turned = 0.0

# ------------------------------------------------------------------ walking

func _walk(delta: float, up: Vector3) -> void:
	var f := Ctl.axis("back", "forward")
	var sd := Ctl.axis("left", "right")
	gait_f = f
	gait_s = sd
	if mount and sd != 0.0:
		# on a panda, A and D turn it: nothing with four legs side-steps
		fwd = fwd.rotated(up, -sd * 2.1 * delta).normalized()
		sd = 0.0
	var running := Ctl.held("run") and not swimming
	var spd: float
	if mount:
		spd = 3.8 if swimming else (12.0 if running else 7.0)
	else:
		spd = SWIM if swimming else (RUN if running else WALK)
	moving = false
	if f != 0.0 or sd != 0.0:
		var right := fwd.cross(up).normalized()
		var full := fwd * f + right * sd
		# Try the whole move, then each part on its own, then turned a little
		# either way — without that, a wall met at a slant stops you dead
		# instead of letting you slide along it.
		var tries := [full]
		if f != 0.0:
			tries.append(fwd * f)
		if sd != 0.0:
			tries.append(right * sd)
		for a in [0.6, -0.6, 1.1, -1.1]:
			tries.append(full.rotated(up, a))
		for v in tries:
			if _try_move(v, spd * delta):
				moving = true
				break
	speed_now = spd if moving else 0.0
	if moving:
		emote = ""
	_shove(delta, false)
	var floor: float = world.floor_at(dir, alt)
	var surf: float = world.water_at(dir)
	var swim_here := not is_nan(surf) and surf - floor > 1.6 and alt < surf + 0.35
	if swim_here:
		if not swimming:
			swimming = true
			emote = ""
		# IN the water, not on it: sunk so the back and head are what is
		# above the surface, riding the swell a little
		var bob := -0.42 + 0.07 * sin(Time.get_ticks_msec() * 0.0021)
		alt += (surf + bob - alt) * minf(1.0, delta * 3.2)
		vy = 0.0
		on_ground = false
		if Ctl.just("jump"):
			vy = JUMP * 0.75                 # a kick out of the water
			alt = surf + 0.1
			swimming = false
	else:
		swimming = false
		if on_ground and Ctl.just("jump"):
			vy = JUMP * (1.12 if mount else 1.0)
			on_ground = false
		elif on_ground and floor < alt - 0.6:
			on_ground = false                # walked off an edge
			vy = 0.0
		if on_ground:
			alt = floor
		else:
			vy -= GRAV * delta
			var was := alt
			alt += vy * delta
			if vy > 0.0 and world.blocked(dir, alt, 0.3, HEIGHT):
				alt = was                    # a ceiling
				vy = 0.0
			if alt <= floor:
				alt = floor
				vy = 0.0
				on_ground = true

func _try_move(v: Vector3, dist: float) -> bool:
	if v.length_squared() < 1e-9:
		return false
	var to := Planet.walk(dir, v.normalized(), dist, Planet.R + alt)
	var r := 0.9 if mount else 0.35
	if world.blocked(to, alt, r, HEIGHT + (1.3 if mount else 0.0)):
		return false
	dir = to
	fwd = (fwd - dir * fwd.dot(dir)).normalized()
	return true

## SIXTY METRES OF FALLING WATER HAS WEIGHT: fly into the falls, stand in it
## or swim up under it and it pushes you down and out.
func _shove(delta: float, in_air: bool) -> void:
	var P: Dictionary = world.fall_push(dir * (Planet.R + alt + 1.0))
	if P.is_empty():
		return
	if in_air:
		alt -= 12.0 * P.s * delta
		climb = minf(climb, 0.0)
	elif not on_ground:
		vy -= 28.0 * P.s * delta
	var out: Vector3 = P.out - dir * (P.out as Vector3).dot(dir)
	if out.length_squared() < 1e-6:
		return
	var to := Planet.walk(dir, out.normalized(), 5.0 * P.s * delta, Planet.R + alt)
	if not world.blocked(to, alt, 0.35, HEIGHT):
		dir = to

# ------------------------------------------------------------------- flying

## F IS FLY, and F again lands — by FALLING from wherever you are, so it is a
## landing and not a teleport.
func toggle_fly() -> void:
	if flying:
		land()
	else:
		take_off()

func take_off() -> void:
	if mount:
		mount.dismount()
		mount = null
	swimming = false
	flying = true
	Sound.whoosh()
	emote = ""
	air = 0.0
	climb = AIR.rise * 0.5
	roll = 0.0
	lean = 0.0
	bank = 0.0
	on_ground = false
	vy = 0.0
	alt = maxf(alt, world.floor_at(dir, alt) + AIR.floor)

func land() -> void:
	flying = false
	Sound.wind(0.0)
	var sink := minf(0.0, climb)
	air = 0.0
	climb = 0.0
	bank = 0.0
	roll = 0.0
	lean = 0.0
	var floor: float = world.floor_at(dir, alt)
	on_ground = alt <= floor + 0.05
	vy = 0.0 if on_ground else sink
	if on_ground:
		alt = floor

## A AND D ARE A CONTROL COLUMN, NOT A TILLER. The stick asks for a roll, the
## roll takes time to come in and out, and the rate you turn at is what that
## roll is worth. And it needs air over the wings: no pivoting on the spot.
func _fly(delta: float, up: Vector3) -> void:
	var stick := Ctl.axis("right", "left")
	var fast := minf(1.0, absf(air) / 12.0)
	roll += (stick * AIR.bank * fast - roll) * minf(1.0, delta * AIR.roll)
	var turn_rate: float = sin(roll) / sin(AIR.bank) * AIR.turn
	if turn_rate != 0.0:
		fwd = fwd.rotated(up, turn_rate * delta)
	fwd = (fwd - up * fwd.dot(up)).normalized()
	var want: float = (AIR.top if Ctl.held("forward") else 0.0) + (AIR.back if Ctl.held("back") else 0.0)
	var rate: float = AIR.accel if want > air else AIR.drag
	air += clampf(want - air, -rate * delta, rate * delta)
	if absf(air) < 0.02:
		air = 0.0
	var lift := (1.0 if Ctl.held("jump") else 0.0) - (1.0 if Ctl.held("run") else 0.0)
	climb += clampf(lift * AIR.rise - climb, -AIR.climb * delta, AIR.climb * delta)
	moving = false
	if absf(air) > 0.01:
		# the arc is longer up here: the radius the speed is divided by
		# includes the height, or you fly slower the higher you climb
		var to := Planet.walk(dir, fwd * signf(air), absf(air) * delta, Planet.R + alt)
		if world.blocked(to, alt, 0.5, HEIGHT):
			air = 0.0                        # walls still exist at altitude
		else:
			dir = to
			fwd = (fwd - dir * fwd.dot(dir)).normalized()
			moving = true
	_shove(delta, true)
	var floor: float = world.floor_at(dir, alt)
	var roof := floor + CEILING
	var was := alt
	alt += climb * delta
	if climb > 0.0 and world.blocked(dir, alt, 0.5, HEIGHT):
		alt = was
		climb = 0.0
	if alt >= roof:
		alt = roof
		climb = minf(0.0, climb)
	if alt <= floor + AIR.floor:
		alt = floor + AIR.floor
		climb = maxf(0.0, climb)
		# asking to go down while already as low as flight goes is the only
		# thing "land" could possibly mean
		if lift < 0.0:
			land()
			return
	# the mouse leans you without flying you: a reaction, decaying fast
	var swing := clampf((turned / delta) / AIR.turn, -1.0, 1.0) if delta > 0.0 else 0.0
	lean += (swing * AIR.bank * fast - lean) * minf(1.0, delta * 8.0)
	bank = roll + lean
	speed_now = absf(air)
	Sound.wind(absf(air) / AIR.top)

# --------------------------------------------------------------- the body

## HIPS ON THE SADDLE. Mixamo's sitting clip holds the hips well away from the
## character's origin, so the body is moved to bring them down onto the saddle.
func _seat() -> void:
	if not mount:
		model.position = model_base
		return
	if skel == null or hips < 0:
		return
	var hw := skel.global_transform * skel.get_bone_global_pose(hips).origin
	var want := mount.global_transform * Vector3(0, mount.back + 0.12, -Panda.LEN * 0.17 - 0.1)
	model.position += global_transform.basis.inverse() * (want - hw)

func _animate() -> void:
	if ap == null:
		return
	var running := Ctl.held("run")
	var want := "idle"
	var sc := 1.0
	if emote != "":
		emote_t -= get_process_delta_time()
		if emote_t <= 0.0:
			emote = ""
	if emote != "":
		want = emote
	elif mount:
		want = "ride"
	elif flying:
		want = "fly"
	elif swimming:
		want = "swim"
		sc = 0.6 if moving else 0.35
	elif not on_ground:
		want = "jump"
	elif moving:
		# a side-step looks like one, and so does walking backwards
		var base := "sprint" if running else "walk"
		var suffix := ""
		if gait_f < 0.0:
			suffix = "_back"
		elif gait_f == 0.0 and gait_s > 0.0:
			suffix = "_right"
		elif gait_f == 0.0 and gait_s < 0.0:
			suffix = "_left"
		want = base + suffix if can(base + suffix) else base
	if not can(want):
		want = "idle"
	if ap.current_animation != want:
		ap.play(want, 0.2)
	ap.speed_scale = sc

func _camera(delta: float) -> void:
	if cam == null or not cam.is_inside_tree():
		return
	var up := dir
	var right := fwd.cross(up).normalized()
	model.visible = not first_person
	if first_person:
		var eye := global_position + up * 1.6
		cam.global_position = eye
		cam.look_at(eye + fwd.rotated(right, pitch) * 10.0, up)
		return
	var lift := 1.6 + (1.2 if mount else 0.0)
	var back := zoom + (2.0 if mount else 0.0)
	if flying:
		# further back and higher: a flyer lies flat, so the camera wants to
		# see along the body rather than at the back of the head
		lift = 1.2
		back = zoom + 3.5
	elif swimming:
		lift = 0.6
	var head := global_position + up * lift
	var tilt := pitch * 0.8 + 0.18 - (0.32 if flying else 0.0)
	var off := (-fwd * back + up * back * 0.42).rotated(right, tilt)
	var want: Vector3 = world.clear_view(head, head + off)
	# never under the grass, whatever the pitch
	var cd := want.normalized()
	var ground := Planet.height(cd) + 0.35
	if want.length() < Planet.R + ground:
		want = cd * (Planet.R + ground)
	cam.global_position = want
	cam.look_at(head, up)
	var fov := 62.0 + (absf(air) / AIR.top * 12.0 if flying else 0.0)
	cam.fov = lerpf(cam.fov, fov, minf(1.0, delta * 3.0))
