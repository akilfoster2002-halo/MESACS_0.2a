## A PANDA. It wanders: walks a while, stops and looks about, picks a new way.
## Press E next to one and you are on its back; R and it is a panda again.
class_name Panda
extends Node3D

const LEN := 2.3

var world: Node3D
var dir := Vector3(0, 0, 1)
var fwd := Vector3(0, 1, 0)
var rest := 0.0
var turn := 0.0
var flee := 0.0
var k := 1.0
var back := 1.3
var rider: Walker = null
var model: Node3D
var ap: AnimationPlayer
var saddle: MeshInstance3D

func _ready() -> void:
	model = Models.spawn("res://assets/panda.glb")
	add_child(model)
	var box := Models.bounds(model)
	var len := maxf(box.size.x, box.size.z)
	k = (LEN * randf_range(0.85, 1.15)) / maxf(0.01, len)
	model.scale = Vector3.ONE * k
	# centred over its feet by its BONES: a rigged mesh's box is in the mesh's
	# space, not where the skeleton draws it, and centring on that left the
	# body two metres ahead of the panda (and the rider off its back)
	var bb := Models.bone_bounds(model)
	var c := bb.get_center() if bb.size.length() > 0.01 else box.get_center()
	model.position = Vector3(-c.x * k, -box.position.y * k, -c.z * k)
	back = box.size.y * k * 0.93
	ap = Models.anim_player(model)
	Models.loop_clips(ap)
	if ap:
		ap.play("Idle")
		ap.seek(randf() * 3.0)
	# the red saddle cloth, only while somebody is on it
	saddle = MeshInstance3D.new()
	var cloth := BoxMesh.new()
	cloth.size = Vector3(box.size.x * k * 0.9, 0.08, LEN * 0.3)
	saddle.mesh = cloth
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.78, 0.19, 0.16)
	saddle.material_override = m
	saddle.position = Vector3(0, back + 0.02, -LEN * 0.17)
	saddle.visible = false
	add_child(saddle)
	rest = randf() * 4.0

func _process(delta: float) -> void:
	var up := dir
	var walking := false
	var v := 0.9
	if rider:
		dir = rider.dir
		fwd = rider.fwd
		walking = rider.moving
		v = rider.speed_now
	else:
		rest -= delta
		if rest <= 0.0:
			rest = randf_range(3.0, 10.0)
			turn = randf_range(-1.2, 1.2)
		walking = rest > 1.6
		if flee > 0.0:
			flee -= delta
			walking = true
			v = 5.0
		if turn != 0.0:
			var d := minf(absf(turn), 1.3 * delta) * signf(turn)
			fwd = fwd.rotated(up, d)
			turn -= d
		if walking:
			var to := Planet.walk(dir, fwd, v * delta)
			if world.blocked(to, 0.0):
				turn = 1.6
			else:
				dir = to
				fwd = (fwd - dir * fwd.dot(dir)).normalized()
	global_transform = Transform3D(Planet.stand(dir, fwd), dir * (Planet.R + Planet.height(dir)))
	if ap:
		var want := "Walk" if walking else "Idle"
		if ap.current_animation != want:
			ap.play(want, 0.35)
		ap.speed_scale = minf(maxf(0.3, v) / (0.94 * k), 1.2 + v * 0.15) if walking else 1.0

func mount(w: Walker) -> void:
	rider = w
	saddle.visible = true

func dismount() -> void:
	rider = null
	saddle.visible = false
	rest = randf_range(2.0, 4.0)
	turn = randf_range(-1.2, 1.2)
