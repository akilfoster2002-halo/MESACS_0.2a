## THE CAR — Scarlet, the one everybody starts with.
##
## A car is not a person, and one set of controls for both made it feel like
## a walking man wearing a car (public/planet.js, drive()):
##   W        throttle — speed builds; it does not appear
##   S        brake, then reverse once you have stopped
##   A D      STEER: they turn the nose, and do nothing at a standstill,
##            because a wheel that is not rolling cannot point you anywhere
##   mouse    look round WITHOUT steering — where you look and where the car
##            points are two different things, which is most of what makes
##            one feel like a car
## Let go and it coasts down rather than stopping dead.
class_name Car
extends Node3D

const TOP := 26.0
const REVERSE := -9.0
const ACCEL := 20.0
const BRAKE := 34.0
const DRAG := 5.5
const TURN := 1.7
const GRIP := 7.0
const LEN := 4.6
const WHEEL_R := 0.34

var world: Node3D
var dir := Vector3(0, 0, 1)
var fwd := Vector3(0, 1, 0)
var alt := 0.0
var spd := 0.0
var steer := 0.0
var driver: Walker = null
var look := 0.0             # the mouse, turning the camera and not the car
var pitch := -0.2
var model: Node3D
var wheels: Array[Node3D] = []
var front: Array[Node3D] = []
var spin := 0.0

func _ready() -> void:
	model = CarModel.make(Wallet.paint(), LEN)
	add_child(model)
	for w in CarModel.wheels(model):
		w.set_meta("rest", w.basis)
		wheels.append(w)
		if w.name.begins_with("wheelFront"):
			front.append(w)

func set_paint(c: Color) -> void:
	CarModel.repaint(model, c)

func park(at: Vector3, facing: Vector3) -> void:
	dir = at.normalized()
	fwd = (facing - dir * facing.dot(dir)).normalized()
	alt = world.floor_at(dir, Planet.height(dir) + 2.0)
	_place()

func _unhandled_input(ev: InputEvent) -> void:
	if driver and ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		look = wrapf(look - ev.relative.x * 0.0025, -PI, PI)
		pitch = clampf(pitch - ev.relative.y * 0.0022, -1.0, 0.4)

func _process(delta: float) -> void:
	if driver:
		_drive(delta)
		_camera(delta)
	_place()

func _drive(delta: float) -> void:
	var up := dir
	var throttle := Ctl.axis("back", "forward")
	var st := Ctl.axis("right", "left")
	if throttle > 0.0:
		spd += ACCEL * delta
	elif throttle < 0.0:
		spd -= (BRAKE if spd > 0.2 else ACCEL * 0.7) * delta
	else:
		spd -= signf(spd) * minf(absf(spd), DRAG * delta)
	spd = clampf(spd, REVERSE, TOP)
	steer = lerpf(steer, st, minf(1.0, delta * 8.0))
	# steering bites with speed and reverses when reversing, so you cannot
	# spin on the spot and backing round a corner goes the way your hands expect
	if absf(steer) > 0.01 and absf(spd) > 0.15:
		var bite := minf(1.0, absf(spd) / GRIP)
		fwd = fwd.rotated(up, steer * TURN * bite * signf(spd) * delta).normalized()
	if absf(spd) > 0.01:
		var to := Planet.walk(dir, fwd * signf(spd), absf(spd) * delta, Planet.R + alt)
		if world.blocked(to, alt, 1.1, 1.4):
			spd = 0.0                          # into a wall is a full stop
		else:
			dir = to
			fwd = (fwd - dir * fwd.dot(dir)).normalized()
	# up the apron, not through it; off an edge, down under its own weight
	var floor: float = world.floor_at(dir, alt)
	alt = floor if floor > alt - 0.8 else alt - 9.0 * delta
	alt = maxf(alt, floor)
	spin += spd * delta / WHEEL_R
	driver.dir = dir
	driver.alt = alt
	driver.fwd = fwd

func _place() -> void:
	global_transform = Transform3D(Planet.stand(dir, fwd), dir * (Planet.R + alt))
	for w in wheels:
		var rest: Basis = w.get_meta("rest")
		var b := rest * Basis(Vector3.RIGHT, spin)
		if w in front:
			b = Basis(Vector3.UP, steer * 0.45) * b
		w.basis = b

func _camera(delta: float) -> void:
	var cam := driver.cam
	var up := dir
	# the camera drifts back behind the car when you stop looking round
	if Input.get_last_mouse_velocity().length() < 1.0:
		look = lerpf(look, 0.0, minf(1.0, delta * 0.8))
	var heading := fwd.rotated(up, look)
	var right := heading.cross(up).normalized()
	var head := global_position + up * 1.4
	var back := 7.5 + absf(spd) * 0.06
	var off := (-heading * back + up * 2.4).rotated(right, pitch * 0.7 + 0.1)
	var want := head + off
	want = world.clear_view(head, want)
	cam.global_position = want
	cam.look_at(head + heading * 2.0, up)
	cam.fov = lerpf(cam.fov, 62.0 + absf(spd) / TOP * 10.0, minf(1.0, delta * 3.0))

func enter(w: Walker) -> void:
	driver = w
	w.hidden = true
	w.car = self
	look = 0.0

func leave() -> void:
	if driver == null:
		return
	var w := driver
	driver = null
	spd = 0.0
	var right := fwd.cross(dir).normalized()
	w.dir = Planet.walk(dir, -right, 2.6)
	w.fwd = (fwd - w.dir * fwd.dot(w.dir)).normalized()
	w.alt = world.floor_at(w.dir, alt + 1.0)
	w.hidden = false
	w.car = null
	w.cam.fov = 62.0
