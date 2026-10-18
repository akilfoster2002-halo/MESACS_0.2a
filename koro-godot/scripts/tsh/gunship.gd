## THE WFC GUNSHIP (wfc/gunship.glb: the user's model, cut in Blender into Body, Gun, PodL, PodR, each on its own pivot).
## Moved about by whoever flies it (its position, its yaw); this makes it fly: it bobs on its hover, banks into its
## turns and dips its nose as it speeds up, its outer engine pods tilt from hover to forward flight, its lights blink,
## and its chin gun turns onto aim_at — firing, the barrels shake, the muzzle flashes and tracers go down the line.
class_name GunshipRig
extends Node3D

const SCALE := 3.4
var holder: Node3D; var model: Node3D
var gun: Node3D; var pod_l: Node3D; var pod_r: Node3D
var muzzle: OmniLight3D; var nav: Array = []
var aim_at = null                         # a Vector3 in the world, or null (the gun forward)
var firing := false
var last := Vector3.ZERO; var vel := Vector3.ZERO; var t := 0.0
var bank := 0.0; var pitch := 0.0; var tilt := 0.0
var tracers: Array = []

static func make(parent: Node) -> GunshipRig:
	var r := GunshipRig.new(); parent.add_child(r); r._build(); return r

func _build() -> void:
	holder = Node3D.new(); add_child(holder)
	model = (load("res://assets/tsh/wfc/gunship.glb") as PackedScene).instantiate(); holder.add_child(model)
	model.rotation.y = PI/2; model.scale = Vector3.ONE*SCALE          # its nose (-X in the file) to +Z, the way it is flown
	gun = model.find_child("Gun", true, false); pod_l = model.find_child("PodL", true, false); pod_r = model.find_child("PodR", true, false)
	for q in [[Vector3(0, -1.6, 0.5), Color(0.75, 0.85, 1.0), 3.0, 9.0], [Vector3(0, 2.2, -0.5), Color(1.0, 0.8, 0.6), 1.6, 8.0]]:      # light on its own hull: under it, along its spine
		var l := OmniLight3D.new(); l.position = q[0]; l.light_color = q[1]; l.light_energy = q[2]; l.omni_range = q[3]; holder.add_child(l)
	muzzle = OmniLight3D.new(); muzzle.light_color = Color(1.0, 0.75, 0.35); muzzle.omni_range = 9.0; muzzle.light_energy = 0.0; add_child(muzzle)
	for q in [[Vector3(0, 0.9, -1.0), Color(3, 0.1, 0.1)], [Vector3(-3.0, 0.4, 0.3), Color(3, 0.1, 0.1)], [Vector3(3.0, 0.4, 0.3), Color(0.1, 3, 0.2)]]:
		var b := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.09; sm.height = 0.18; b.mesh = sm
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = q[1]; b.material_override = m
		b.position = q[0]; holder.add_child(b); nav.append(b)
	last = global_position

func _process(dt: float) -> void:
	if dt <= 0: return
	t += dt
	var p := global_position
	vel = vel.lerp((p - last)/dt, minf(1, dt*4)); last = p
	# in its own frame: how fast forward, how fast sideways
	var fwd := global_basis.z.normalized(); var right := global_basis.x.normalized()
	var vf := vel.dot(fwd); var vs := vel.dot(right)
	bank = lerpf(bank, clampf(-vs*0.05, -0.5, 0.5), minf(1, dt*2.5))
	pitch = lerpf(pitch, clampf(vf*0.025, -0.25, 0.3), minf(1, dt*2.5))
	holder.rotation = Vector3(pitch, 0, bank)
	holder.position.y = sin(t*1.6)*0.18 + sin(t*0.7)*0.08              # the hover never quite still
	# the pods: up for hovering, forward for flight
	tilt = lerpf(tilt, clampf(vel.length()/14.0, 0, 1), minf(1, dt*1.8))
	if pod_l: pod_l.rotation.z = tilt*1.1 + sin(t*2.3)*0.03
	if pod_r: pod_r.rotation.z = tilt*1.1 + sin(t*2.1 + 1.0)*0.03
	for i in nav.size(): nav[i].visible = fmod(t*1.2 + i*0.33, 1.0) < 0.25
	_aim(dt)
	_fire(dt)

## the chin gun onto its mark (its barrels are -X in the file)
func _aim(dt: float) -> void:
	if gun == null: return
	var to: Vector3 = aim_at if aim_at != null else gun.global_position + global_basis.z*10.0 - Vector3(0, 3, 0)
	var dir := (to - gun.global_position)
	if dir.length() < 0.1: return
	var want := Basis.looking_at(dir.normalized(), Vector3.UP)*Basis(Vector3.UP, -PI/2)
	var sc := gun.global_basis.get_scale()
	var cur := gun.global_basis.orthonormalized()
	var q := cur.get_rotation_quaternion().slerp(want.get_rotation_quaternion(), minf(1, dt*6))
	if firing: q = q*Quaternion(Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized(), 0.02)     # the kick of it
	gun.global_basis = Basis(q).scaled(sc)

func _fire(dt: float) -> void:
	var mz := gun.global_position + (-gun.global_basis.x.normalized())*1.1 if gun else global_position
	muzzle.global_position = mz
	muzzle.light_energy = (randf_range(4.0, 9.0) if randf() < 0.6 else 0.0) if firing else 0.0
	if firing and aim_at != null and randf() < dt*30.0:                  # tracers down the line
		var tr := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.04, 0.04, 2.2); tr.mesh = bm
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(3.0, 2.2, 0.8); tr.material_override = m
		get_tree().current_scene.add_child(tr)
		var target: Vector3 = (aim_at as Vector3) + Vector3(randf_range(-0.4, 0.4), 0, randf_range(-0.4, 0.4))
		tr.global_position = mz; tr.look_at(target, Vector3.UP)
		tracers.append({"n": tr, "a": mz, "b": target, "t": 0.0})
	var keep := []
	for q in tracers:
		q.t += dt*9.0
		if q.t >= 1.0 or not is_instance_valid(q.n): if is_instance_valid(q.n): q.n.queue_free()
		else: q.n.global_position = (q.a as Vector3).lerp(q.b, q.t); keep.append(q)
	tracers = keep
