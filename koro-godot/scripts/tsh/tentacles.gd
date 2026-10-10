## MAYA'S ARMS — four of Doctor Octopus's mechanical arms out of her back, and they do the walking (the browser's
## public/tentacles.js, the same rules). Each arm is the Doc Ock arm from the Maya rig (assets/tsh/mecharm.glb:
## nineteen links and a three-fingered claw); every frame its joints are solved from the socket on her back to where
## its claw wants to be (FABRIK), a ripple runs down it, and the links follow that curve without twisting.
##
## The two lower arms are legs: a claw stays planted until her body has moved a stride away, then lifts, swings over
## and plants again ahead of her, one leg at a time. The two upper arms drift about her and reach. burst() throws an
## arm out at a point, past its length and ringing back, where it holds, twitching, then goes back to its job.
##
##   var oc := Tentacles.new(); add_child(oc); oc.setup(floor_y, start, yaw)
##   oc.socket = func(): return <her Spine2 bone's global Transform3D>    # optional
##   oc.go_to(x, z)                                                        # where to carry her; read oc.body back
class_name Tentacles
extends Node3D

const SEG := 19
const MODEL := "res://assets/tsh/mecharm.glb"
## each finger opens about a hinge across its root, in its own frame (found from where its metal is, in the browser)
const FINGER_AXIS := {"Claw1": Vector3(0.01, 0, -1), "Claw7": Vector3(0.86, 0, 0.51), "Claw4": Vector3(-0.87, 0, 0.49)}
## sockets on her back, in her back's frame: two high, two low
const SOCK := [Vector3(-0.09, 0.12, -0.13), Vector3(0.09, 0.12, -0.13), Vector3(-0.08, -0.12, -0.12), Vector3(0.08, -0.12, -0.12)]

var floor_y := 0.0
var body := Vector3.ZERO
var goal := Vector3.ZERO
var yaw := 0.0
var speed := 1.3
var lift := 1.15
var moving := false
var socket: Callable
var t := 0.0
var arms: Array = []
var legs: Array = []
var free: Array = []

class Arm:
	var len := 2.9
	var L := 0.15
	var pts: Array[Vector3] = []
	var open := 0.6
	var ext := 1.0
	var out = null          # a Dictionary while bursting
	var root: Node3D
	var skel: Skeleton3D
	var chain: PackedInt32Array = PackedInt32Array()
	var claw := -1
	var fingers: Array = []      # [bone, rest Quaternion, axis]
	var rest_len := 1.0
	var rest_dir := Vector3.UP
	var rest_basis := Basis()

func setup(f: float, at: Vector3, y := 0.0) -> void:
	floor_y = f; yaw = y
	body = Vector3(at.x, f + lift, at.z); goal = Vector3(at.x, 0, at.z)
	var scene: PackedScene = load(MODEL)
	for k in 4:
		var A := Arm.new()
		A.len = 2.9 if k < 2 else 2.6
		A.L = A.len/SEG
		for i in SEG + 1: A.pts.append(Vector3.ZERO)
		A.root = scene.instantiate(); add_child(A.root)
		A.skel = _find_skel(A.root)
		_rig(A)
		arms.append(A)
	for k in [2, 3]:
		legs.append({"k": k, "at": _stance(k), "from": Vector3.ZERO, "to": null, "t": 0.0})
	for k in [0, 1]:
		free.append({"k": k, "at": Vector3.ZERO, "want": Vector3.ZERO, "next": 0.0})

func _find_skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D: return n
	for c in n.get_children():
		var s := _find_skel(c)
		if s: return s
	return null

func _rig(A: Arm) -> void:
	var s := A.skel
	for i in SEG:
		A.chain.append(s.find_bone("MechArm" + ("" if i == 0 else str(i))))
	A.claw = s.find_bone("ClawBase")
	var H: Array[Vector3] = []
	for b in A.chain: H.append(s.get_bone_global_rest(b).origin)
	H.append(s.get_bone_global_rest(A.claw).origin)
	A.rest_len = 0.0
	for i in SEG: A.rest_len += H[i + 1].distance_to(H[i])
	A.rest_dir = (H[1] - H[0]).normalized()
	A.rest_basis = s.get_bone_global_rest(A.chain[0]).basis.orthonormalized()
	for nm in FINGER_AXIS:
		var b := s.find_bone(nm)
		if b >= 0: A.fingers.append([b, s.get_bone_rest(b).basis.get_rotation_quaternion(), FINGER_AXIS[nm].normalized()])

func _stance(k: int) -> Vector3:
	var side := -1.0 if k == 2 else 1.0
	var a := yaw + side*1.9
	return Vector3(body.x + sin(a)*1.25, floor_y, body.z + cos(a)*1.25)

func go_to(x: float, z: float, spd := 0.0) -> void:
	goal = Vector3(x, 0, z)
	if spd > 0: speed = spd

func burst(k: int, at: Vector3, hold := 1.2, on_floor := false) -> void:
	arms[k].out = {"t": 0.0, "from": arms[k].ext, "at": at, "hold": hold, "floor": on_floor, "jit": Vector3.ZERO, "jt": 0.0}

func _sockets() -> Array:
	var out := []
	if socket.is_valid():
		var m: Transform3D = socket.call()
		for s in SOCK: out.append(m*s)
		return out
	var b := Basis(Vector3.UP, yaw)
	for s in SOCK: out.append(body + Vector3(0, 0.35, 0) + b*s)
	return out

func _process(dt: float) -> void:
	t += dt
	var to := Vector3(goal.x - body.x, 0, goal.z - body.z)
	var dist := to.length()
	moving = dist > 0.08
	if moving:
		body += to.normalized()*minf(dist, speed*dt)
		var want := atan2(to.x, to.z)
		yaw += atan2(sin(want - yaw), cos(want - yaw))*minf(1.0, dt*3.0)
	var swinging := false
	for l in legs: if l.to != null: swinging = true
	body.y += ((floor_y + lift + (0.06 if swinging else 0.0) + sin(t*1.3)*0.025) - body.y)*minf(1.0, dt*4.0)
	# the legs: planted until her body is a stride from where it would stand, then one step, one leg at a time
	for l in legs:
		var home := _stance(l.k)
		if l.to != null:
			l.t += dt/0.42
			var k := minf(1.0, l.t)
			l.at = (l.from as Vector3).lerp(l.to, k); l.at.y = floor_y + sin(k*PI)*0.55
			if k >= 1.0: l.at = l.to; l.to = null
		else:
			var busy := false
			for m in legs: if m != l and m.to != null: busy = true
			if home.distance_to(l.at) > (0.55 if moving else 0.9) and not busy:
				l.from = l.at; l.to = home + (to.normalized()*0.35 if dist > 0.001 else Vector3.ZERO); l.t = 0.0
	# the upper arms: drift, reach
	for i in free.size():
		var f = free[i]
		f.next -= dt
		if f.next <= 0:
			var side := -1.0 if i == 0 else 1.0
			var a := yaw + side*(1.1 + randf()*0.9)
			var r := 1.1 + randf()*0.7
			f.want = Vector3(body.x + sin(a)*r, body.y + 0.6 + randf()*1.1, body.z + cos(a)*r)
			f.next = 1.6 + randf()*2.2
		if f.at == Vector3.ZERO: f.at = f.want
		f.at = (f.at as Vector3).lerp(f.want, minf(1.0, dt*1.6))
		arms[f.k].open = 0.35 + 0.35*sin(t*1.7 + i*2)
	var S := _sockets()
	for k in 4:
		var A: Arm = arms[k]
		var target: Vector3 = (legs[k - 2].at + Vector3(0, 0.04, 0)) if k >= 2 else free[k].at
		var wave := 0.05 if k >= 2 else 0.11
		var B = A.out
		if B != null:
			B.t += dt
			var u: float = B.t
			A.ext = (B.from + (1.14 - B.from)*(1.0 - pow(1.0 - u/0.16, 3))) if u < 0.16 else 1.0 + 0.14*exp(-(u - 0.16)*7.0)*cos((u - 0.16)*24.0)
			var at: Vector3 = B.at
			if not B.floor:
				B.jt -= dt
				if B.jt <= 0: B.jt = 0.05 + randf()*0.09; B.jit = Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5)*0.16
				at += B.jit
			target = at; wave += 0.32*exp(-u*2.4)
			A.open = 1.0 if u < B.hold - 0.12 else 0.05
			if u >= B.hold:
				A.out = null; A.ext = 1.0
				if k >= 2: legs[k - 2].at = Vector3(at.x, floor_y, at.z); legs[k - 2].to = null
				else: free[k].at = at
		elif k >= 2:
			A.open = 0.9 if legs[k - 2].to != null else 0.15
		A.root.visible = A.ext > 0.02
		if not A.root.visible: continue
		# the chain bows outward from her back before it turns down to the claw: a bent first guess, then the solve
		var outd: Vector3 = (S[k] as Vector3) - body; outd.y = 0; outd = outd.normalized()
		for i in SEG + 1:
			var kk := float(i)/SEG
			A.pts[i] = (S[k] as Vector3).lerp(target, kk) + outd*sin(kk*PI)*0.9 + Vector3(0, sin(kk*PI)*0.5, 0)
		_solve(A.pts, S[k], target, A.L*A.ext)
		_pose(A, wave*minf(1.0, A.ext), k*1.7)

func _solve(p: Array[Vector3], base: Vector3, target: Vector3, L: float) -> void:
	var n := p.size() - 1
	if base.distance_to(target) >= L*n*0.995:
		var dir := (target - base).normalized()
		for i in n + 1: p[i] = base + dir*L*i
		return
	for it in 6:
		p[n] = target
		for i in range(n - 1, -1, -1): p[i] = p[i + 1] + (p[i] - p[i + 1]).normalized()*L
		p[0] = base
		for i in range(1, n + 1): p[i] = p[i - 1] + (p[i] - p[i - 1]).normalized()*L

func _pose(A: Arm, wave: float, phase: float) -> void:
	var p := A.pts
	var n := p.size() - 1
	var along := (p[n] - p[0]); var l0 := along.length(); along = along/maxf(l0, 1e-5)
	var side := along.cross(Vector3.UP)
	if side.length_squared() < 1e-4: side = Vector3.RIGHT
	side = side.normalized()
	var up2 := side.cross(along).normalized()
	var q: Array[Vector3] = []
	for i in n + 1:
		var k := float(i)/n
		var env := sin(k*PI)
		var w := sin(k*PI*2.2 - t*3.1 + phase)*wave*env
		var w2 := cos(k*PI*1.6 - t*2.3 + phase)*wave*0.6*env
		q.append(p[i] + side*w + up2*w2)
	# the joints onto the points, in the skeleton's space: each link turned from the one before (no twist)
	var to_skel := A.skel.global_transform.affine_inverse()
	var Q: Array[Vector3] = []
	for v in q: Q.append(to_skel*v)
	var length := 0.0
	for i in SEG: length += Q[i + 1].distance_to(Q[i])
	var s := length/A.rest_len
	var basis := A.rest_basis
	var prev := Vector3.ZERO
	for i in SEG + 1:
		var b: int = A.chain[i] if i < SEG else A.claw
		if i < SEG:
			var d := (Q[i + 1] - Q[i]).normalized()
			if i == 0: basis = Basis(Quaternion(A.rest_dir, d))*A.rest_basis
			else: basis = Basis(Quaternion(prev, d))*basis
			prev = d
		A.skel.set_bone_global_pose(b, Transform3D(basis.orthonormalized().scaled(Vector3(s, s, s)), Q[i]))
	for f in A.fingers:
		A.skel.set_bone_pose_rotation(f[0], f[1]*Quaternion(f[2], A.open*0.8))
