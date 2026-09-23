## THE GIANT — twenty metres of mecha, parked by the Mechanic.
##
## E next to it and you are in it. W/S walk it (heavy: it leans into a start
## and takes a moment to stop), A/D turn, SHIFT dashes across the island,
## SPACE is a mega jump and, held in the air, the thrusters. Q slams it down
## — or stomps on the ground — and a ring runs out across the grass that
## sends every panda near it running. V is the cockpit. R climbs out.
class_name Mecha
extends Node3D

const H := 20.0
const WALK := 9.0
const DASH := 34.0
const JUMP := 30.0
const GRAV := 24.0
const THRUST := 34.0
const FUEL := 3.2

var world: Node3D
var dir := Vector3(0, 0, 1)
var fwd := Vector3(0, 1, 0)
var alt := 0.0
var vy := 0.0
var on_ground := true
var spd := 0.0
var fuel := FUEL
var slamming := false
var cool := 0.0
var shake := 0.0
var stride := 0.0
var jump_ready := true
var piloting := false
var first_person := false
var hover := false
var dashing := false
var pilot: Walker = null
var pitch := -0.1

var model: Node3D
var ap: AnimationPlayer
var s := 1.0
var flames: Array[MeshInstance3D] = []
var rings: Array = []

func _ready() -> void:
	model = Models.spawn("res://assets/mecha.glb")
	add_child(model)
	s = Models.fit_height(model, H * 0.94)
	ap = Models.anim_player(model)
	Models.loop_clips(ap)
	if ap:
		ap.play("idle")
	for sx in [-1.0, 1.0]:
		var fl := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.9
		cone.bottom_radius = 0.05
		cone.height = 5.0
		fl.mesh = cone
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(0.55, 0.9, 1.0, 0.85)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		fl.material_override = m
		fl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		fl.position = Vector3(sx * H * 0.11, H * 0.6, -H * 0.13)
		fl.visible = false
		add_child(fl)
		flames.append(fl)

func park(at: Vector3, facing: Vector3) -> void:
	dir = at.normalized()
	fwd = (facing - dir * facing.dot(dir)).normalized()
	alt = Planet.height(dir)

func _unhandled_input(ev: InputEvent) -> void:
	if piloting and ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		fwd = fwd.rotated(dir, -ev.relative.x * 0.002).normalized()
		pitch = clampf(pitch - ev.relative.y * 0.002, -0.9, 0.5)

func enter(w: Walker) -> void:
	piloting = true
	pilot = w
	w.hidden_in_mecha = true
	first_person = false

func leave() -> bool:
	if not on_ground:
		return false
	piloting = false
	var up := dir
	var right := fwd.cross(up).normalized()
	pilot.dir = Planet.walk(dir, right, 7.0)
	pilot.fwd = (fwd - pilot.dir * fwd.dot(pilot.dir)).normalized()
	pilot.alt = Planet.height(pilot.dir)
	pilot.hidden_in_mecha = false
	pilot = null
	spd = 0.0
	visible = true
	model.visible = true
	_flames(false)
	if ap:
		ap.play("idle", 0.3)
	return true

func _process(delta: float) -> void:
	if piloting:
		_drive(delta)
	_rings(delta)
	shake = maxf(0.0, shake - delta * 2.2)
	global_transform = Transform3D(Planet.stand(dir, fwd), dir * (Planet.R + alt))
	if piloting:
		_camera()

func _drive(delta: float) -> void:
	var up := dir
	var turn := Input.get_axis("right", "left")
	if turn != 0.0:
		fwd = fwd.rotated(up, turn * 1.4 * delta).normalized()
	var f := Input.get_axis("back", "forward")
	dashing = Input.is_action_pressed("run") and f > 0.0
	var want := f * (DASH if dashing else WALK)
	var acc := 26.0 if dashing else 18.0
	spd += clampf(want - spd, -acc * delta, acc * delta)
	if absf(spd) < 0.05 and f == 0.0:
		spd = 0.0
	var moved := false
	if spd != 0.0:
		var to := Planet.walk(dir, fwd * signf(spd), absf(spd) * delta, Planet.R + alt)
		if world.blocked(to, alt):
			spd = 0.0
		else:
			dir = to
			fwd = (fwd - dir * fwd.dot(dir)).normalized()
			moved = true

	var space := Input.is_action_pressed("jump")
	var q := Input.is_action_just_pressed("slam")
	hover = false
	if on_ground:
		if space and jump_ready:
			vy = JUMP
			on_ground = false
			jump_ready = false
		if q and cool <= 0.0:
			shockwave(18.0, 1.2)
			cool = 1.4
	else:
		if space and not jump_ready and fuel > 0.0 and not slamming and vy < 10.0:
			vy += THRUST * delta
			fuel = maxf(0.0, fuel - delta)
			hover = true
		if q and not slamming:
			slamming = true
			vy = -60.0
	if not space:
		jump_ready = true
	cool = maxf(0.0, cool - delta)

	var ground := Planet.height(dir)
	if not on_ground:
		vy -= GRAV * delta
		alt += vy * delta
		if alt <= ground:
			var hard := vy
			alt = ground
			vy = 0.0
			on_ground = true
			if slamming:
				shockwave(38.0, 2.4)
			elif hard < -16.0:
				shockwave(16.0, 0.9)
			else:
				shake = maxf(shake, 0.4)
			slamming = false
	else:
		if ground < alt - 1.2:
			on_ground = false
		else:
			alt = ground
	if on_ground:
		fuel = minf(FUEL, fuel + delta * 1.2)
	if on_ground and moved:
		stride += absf(spd) * delta
		var every := 26.0 if dashing else 13.0
		if stride > every:
			stride -= every
			shake = maxf(shake, 0.5 if dashing else 0.35)

	if ap:
		var clip := "idle"
		var sc := 1.0
		if not on_ground:
			clip = "fly" if (hover or slamming) else "jump"
			sc = 0.8
		elif absf(spd) > 0.6:
			clip = "sprint" if dashing else "walk"
			sc = absf(spd) / ((5.2 if dashing else 1.45) * s * 1.0)
			sc = clampf(sc, 0.3, 2.5)
		if ap.current_animation != clip:
			ap.play(clip, 0.3)
		ap.speed_scale = sc
	_flames(dashing or hover or slamming)
	pilot.dir = dir
	pilot.alt = alt

func _flames(on: bool) -> void:
	for fl in flames:
		fl.visible = on
		if on:
			var k := randf_range(0.8, 1.15)
			fl.scale = Vector3(k, randf_range(0.8, 1.4), k)

func _camera() -> void:
	var cam := pilot.cam
	var up := dir
	var right := fwd.cross(up).normalized()
	var jig := func() -> float: return randf_range(-0.5, 0.5) * shake
	if first_person:
		model.visible = false
		var eye := global_position + up * H * 0.8 + fwd * H * 0.08
		eye += up * jig.call() * 0.6 + right * jig.call() * 0.6
		cam.global_position = eye
		cam.look_at(eye + fwd.rotated(right, pitch - 0.22) * 40.0, up)
	else:
		model.visible = true
		var head := global_position + up * H * 0.62
		var off := (-fwd * H * 1.7 + up * H * 0.55).rotated(right, pitch * 0.6)
		cam.global_position = head + off + up * jig.call() * 2.0 + right * jig.call() * 2.0
		cam.look_at(head + fwd * H * 0.4, up)

## The ring of light across the ground, and every panda near it bolts.
func shockwave(r: float, jolt: float) -> void:
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.9
	tm.outer_radius = 1.0
	tm.rings = 64
	ring.mesh = tm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.75, 0.96, 1.0, 0.9)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	ring.material_override = m
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(ring)
	ring.global_transform = Transform3D(Planet.frame_at(dir), dir * (Planet.R + Planet.height(dir) + 0.4))
	rings.append({"n": ring, "t": 0.0, "r": r, "m": m})
	shake = maxf(shake, jolt)
	for p in world.pandas:
		var pd: Panda = p
		if pd.rider:
			continue
		if pd.dir.angle_to(dir) * Planet.R < r * 1.3:
			var away := (pd.dir - dir)
			away = (away - pd.dir * away.dot(pd.dir)).normalized()
			if away.length_squared() > 0.5:
				pd.fwd = away
			pd.flee = randf_range(2.5, 4.5)
			pd.turn = 0.0

func _rings(delta: float) -> void:
	var keep := []
	for o in rings:
		o.t += delta
		var k: float = o.t / 0.9
		var n: MeshInstance3D = o.n
		var sc: float = 2.0 + k * o.r
		n.scale = Vector3(sc, 0.3, sc)
		(o.m as StandardMaterial3D).albedo_color.a = 0.9 * (1.0 - k) * (1.0 - k)
		if k >= 1.0:
			n.queue_free()
		else:
			keep.append(o)
	rings = keep
