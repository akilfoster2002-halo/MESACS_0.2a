## YOU — walking on Wano.
##
## Position is a direction and an altitude, exactly as in the browser: the
## keys rotate the direction round the centre of the planet, so going
## straight on comes back round, and "down" is always towards the middle.
class_name Walker
extends Node3D

const WALK := 6.5
const RUN := 11.0
const JUMP := 8.0
const GRAV := 22.0
const HEIGHT := 1.7

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
var hidden_in_mecha := false

var model: Node3D
var model_base := Vector3.ZERO
var skel: Skeleton3D
var hips := -1
var ap: AnimationPlayer
var cam: Camera3D

func _ready() -> void:
	model = Models.spawn("res://assets/kyle.glb")
	add_child(model)
	Models.use_vertex_colors(model)
	# bones run from the ankles to the crown; the soles are a little lower
	Models.fit_height(model, HEIGHT * 0.94)
	model_base = model.position
	var sk := model.find_children("*", "Skeleton3D", true, false)
	if sk.size() > 0:
		skel = sk[0]
		for i in skel.get_bone_count():
			if skel.get_bone_name(i).ends_with("Hips"):
				hips = i
				break
	ap = Models.anim_player(model)
	Models.loop_clips(ap)
	cam = Camera3D.new()
	cam.far = 5000.0
	cam.fov = 62.0
	world.add_child.call_deferred(cam)
	cam.make_current.call_deferred()

func place(start: Vector3, facing: Vector3) -> void:
	dir = start.normalized()
	fwd = (facing - dir * facing.dot(dir)).normalized()
	alt = Planet.height(dir)

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		fwd = fwd.rotated(dir, -ev.relative.x * 0.0025).normalized()
		pitch = clampf(pitch - ev.relative.y * 0.0022, -1.1, 0.7)

func _process(delta: float) -> void:
	if hidden_in_mecha:
		visible = false
		return
	visible = true
	var up := dir
	var f := Input.get_axis("back", "forward")
	var sd := Input.get_axis("left", "right")
	var running := Input.is_action_pressed("run")
	if mount:
		# on a panda, A and D turn it: nothing with four legs side-steps
		if sd != 0.0:
			fwd = fwd.rotated(up, -sd * 2.1 * delta).normalized()
		sd = 0.0
	var spd := (12.0 if running else 7.0) if mount else (RUN if running else WALK)
	var right := fwd.cross(up).normalized()
	var heading := fwd * f + right * sd
	moving = false
	if heading.length_squared() > 0.01:
		var to := Planet.walk(dir, heading.normalized(), spd * delta, Planet.R + alt)
		if not world.blocked(to, alt):
			dir = to
			moving = true
			fwd = (fwd - dir * fwd.dot(dir)).normalized()
	speed_now = spd if moving else 0.0

	var ground := Planet.height(dir)
	if on_ground and Input.is_action_just_pressed("jump"):
		vy = JUMP
		on_ground = false
	if not on_ground:
		vy -= GRAV * delta
		alt += vy * delta
		if alt <= ground:
			alt = ground
			vy = 0.0
			on_ground = true
	else:
		if ground < alt - 0.6:
			on_ground = false
		else:
			alt = ground

	_animate(running)
	global_transform = Transform3D(Planet.stand(up, fwd), dir * (Planet.R + alt))
	_seat()
	_camera(up)

## HIPS ON THE SADDLE. Mixamo's sitting clip holds the hips well away from
## the character's origin, so wherever the clip put them this frame, the
## body is moved to bring them down onto the middle of the saddle — the
## same correction the browser version makes.
func _seat() -> void:
	if not mount:
		model.position = model_base
		return
	if skel == null or hips < 0:
		return
	var hw := skel.global_transform * skel.get_bone_global_pose(hips).origin
	var want := mount.global_transform * Vector3(0, mount.back + 0.12, -Panda.LEN * 0.17 - 0.1)
	model.position += global_transform.basis.inverse() * (want - hw)

func _animate(running: bool) -> void:
	if ap == null:
		return
	var want := "idle"
	if mount:
		want = "ride"
	elif not on_ground:
		want = "jump"
	elif moving:
		want = "sprint" if running else "walk"
	if ap.current_animation != want and ap.has_animation(want):
		ap.play(want, 0.2)

func _camera(up: Vector3) -> void:
	if cam == null or not cam.is_inside_tree():
		return
	var right := fwd.cross(up).normalized()
	model.visible = not first_person
	if first_person:
		var eye := global_position + up * 1.6
		cam.global_position = eye
		var look := fwd.rotated(right, pitch)
		cam.look_at(eye + look * 10.0, up)
		return
	var lift := 1.6 + (1.2 if mount else 0.0)
	var head := global_position + up * lift
	var back := 6.2 + (2.0 if mount else 0.0)
	var off := (-fwd * back + up * 2.6).rotated(right, pitch * 0.8 + 0.18)
	cam.global_position = head + off
	cam.look_at(head, up)
