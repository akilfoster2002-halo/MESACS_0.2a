## TSH · ALPHA — public/tshalpha.js (TSHMONSTER and TSHALPHA), ported.
## What came up out of Maya keeps coming: a mass of the black stuff as big as the platform, heaving, pale lights
## opening and shutting all over it.
## THE BODY IT COMES UP IN is the alien (assets/tsh/monster/alien.glb), rigged by tools/alien-rig.py on the
## tyrannosaur's own skeleton and moving by its clips: idle standing, run going, bite, roar, attack_tail.
##
##   var m := Monster.new(); parent.add_child(m); m.setup(at, yaw)   m.grow = 0..1   m.mouth / m.eye_at (world)
##   m.act("roar" | "bite" | "tail")   m.reach(at)   m.flinch()   m.breathe(at) / m.breathe(null)   m.burns(p)
class_name Monster
extends Node3D

## the old goose names → the alien's (the tyrannosaur's) bones
const BONES := {"Head": "bn_Head", "Neck": "bn_Neck1", "Chest": "bn_Spine2", "Spine": "bn_Spine1", "Hips": "bn_Spine",
	"Forearm.L": "bn_LeftForeArm", "Forearm.R": "bn_RightForeArm", "UpperArm.L": "bn_LeftArm", "UpperArm.R": "bn_RightArm",
	"Shin.L": "bn_LeftLeg", "Shin.R": "bn_RightLeg", "Foot.L": "bn_LeftFoot", "Foot.R": "bn_RightFoot"}
const SIZE := 2.0

var grow := 0.0
var pull := 1.0
var t := 0.0
var key = null                     # (a close-up's light level; it carries no lights now)
var mouth := Vector3.ZERO
var eye_at := Vector3.ZERO
var on_slam: Callable
var on_step: Callable
var push := 0.0

var body: Node3D
var gsk: Skeleton3D
var tap: AnimationPlayer
var ready_ := false
var act_name = null; var act_t := 0.0; var bit := false
var clip_now := ""; var step_t := 0.0
var head: Node3D; var eye: Node3D
var flame: CPUParticles3D; var flame_to = null; var flame_dir := Vector3.FORWARD
var pillar: CPUParticles3D; var hit_at := Vector3.ZERO; var flame_t := 0.0
var last_pos := Vector3.ZERO; var speed := 0.0
var last_w := Vector3.ZERO
var dip := 0.0; var flinch_k := 0.0
var bone_ix := {}

## the importer's names carry the tyrannosaur's numbers (bn_Head.10 → bn_Head10): the name without them
static func _plain(s: String) -> String:
	var i := s.rfind(".")
	if i < 0: i = s.rfind("_")
	return s.substr(0, i) if i > 0 and s.substr(i + 1).is_valid_int() else s

func setup(at: Vector3, yaw: float) -> void:
	position = Vector3(at.x, 0, at.z); rotation.y = yaw
	last_pos = position; last_w = position
	body = Node3D.new(); add_child(body)
	var alien: Node3D = (load("res://assets/tsh/monster/alien.glb") as PackedScene).instantiate(); body.add_child(alien)
	gsk = _find_t(alien, "Skeleton3D"); tap = _find_t(alien, "AnimationPlayer")
	for i in gsk.get_bone_count(): bone_ix[_plain(gsk.get_bone_name(i))] = i
	for a in tap.get_animation_list(): tap.get_animation(a).loop_mode = Animation.LOOP_LINEAR if a in ["idle", "run"] else Animation.LOOP_NONE
	tap.animation_finished.connect(func(_n): act_name = null; clip_now = ""; _play("idle", 0.35))
	_play("idle", 0.0)
	_face(); _flame()
	ready_ = true
func _each(n: Node, f: Callable) -> void:
	f.call(n)
	for c in n.get_children(): _each(c, f)
func _find_t(n: Node, cls: String) -> Node:
	if n.is_class(cls): return n
	for c in n.get_children():
		var r := _find_t(c, cls)
		if r: return r
	return null
func _play(nm: String, fade := 0.25) -> void:
	if clip_now == nm or not tap.has_animation(nm): return
	clip_now = nm; tap.play(nm, fade)
func _bone_world(sk: Skeleton3D, i: int) -> Transform3D: return sk.global_transform*sk.get_bone_global_pose(i)
func _bone_of(nm: String) -> int: return bone_ix.get(BONES.get(nm, nm), -1) if gsk else -1
func anchor(nm: String) -> Vector3:
	var b := _bone_of(nm)
	return body.to_local(_bone_world(gsk, b).origin) if b >= 0 else Vector3(0, 2.5, 0)

# ================================================================== its face: where its eye is (the cameras look there), the hole
func _face() -> void:
	head = Node3D.new(); head.position = Vector3(0, 4.7, 0.25); body.add_child(head)
	eye = Node3D.new(); eye.position = Vector3(0, 0.12, 0.3); head.add_child(eye)

# ================================================================== its breath: black fire out of its mouth, down onto the floor, and up again there as a pillar
const FLAME_HALF := 0.12; const PILLAR_R := 1.5; const PILLAR_H := 7.0
func _flame() -> void:
	flame = CPUParticles3D.new(); flame.emitting = false; flame.amount = 420; flame.lifetime = 0.9; flame.local_coords = false
	var q := QuadMesh.new(); q.size = Vector2(1, 1); flame.mesh = q
	var m := StandardMaterial3D.new(); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES; m.vertex_color_use_as_albedo = true; m.albedo_texture = _puff(); flame.material_override = m
	flame.direction = Vector3(0, 0, 1); flame.spread = rad_to_deg(FLAME_HALF)*0.8
	flame.initial_velocity_min = 13.0; flame.initial_velocity_max = 17.0; flame.gravity = Vector3(0, 1.5, 0); flame.damping_min = 2.0; flame.damping_max = 4.0
	flame.angle_min = -180; flame.angle_max = 180; flame.angular_velocity_min = -200; flame.angular_velocity_max = 200
	var sc := Curve.new(); sc.add_point(Vector2(0, 0.25)); sc.add_point(Vector2(0.5, 1.0)); sc.add_point(Vector2(1, 1.5)); flame.scale_amount_curve = sc
	flame.scale_amount_min = 1.2; flame.scale_amount_max = 2.2
	var gr := Gradient.new()                                  # a violet-hot core, then black, then smoke gone
	gr.set_color(0, Color(0.4, 0.06, 0.7, 0.85)); gr.set_color(1, Color(0, 0, 0, 0))
	gr.add_point(0.07, Color(0.04, 0.0, 0.07, 0.97)); gr.add_point(0.3, Color(0.0, 0.0, 0.0, 0.97)); gr.add_point(0.75, Color(0.01, 0.0, 0.015, 0.7))
	flame.color_ramp = gr
	add_child(flame)
	pillar = flame.duplicate(); pillar.emitting = false; pillar.amount = 900; pillar.lifetime = 1.1
	pillar.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE; pillar.emission_sphere_radius = PILLAR_R*0.7
	pillar.direction = Vector3(0, 1, 0); pillar.spread = 6.0; pillar.initial_velocity_min = 7.0; pillar.initial_velocity_max = 11.0
	pillar.gravity = Vector3(0, 3.0, 0); pillar.damping_min = 0.0; pillar.damping_max = 0.5; pillar.scale_amount_min = 2.0; pillar.scale_amount_max = 3.4
	add_child(pillar)
func _puff() -> Texture2D:
	var gt := GradientTexture2D.new(); gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1, 0.5); gt.width = 64; gt.height = 64
	var gr := Gradient.new(); gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(1, 1, 1, 0)); gr.add_point(0.45, Color(1, 1, 1, 0.7)); gt.gradient = gr
	return gt
## breathe at a point on the floor (null: stop): the stream comes down there, and a pillar of it goes up
func breathe(at) -> void:
	if at != null and flame_to == null: flame_dir = ((at as Vector3) - mouth).normalized() if mouth != Vector3.ZERO else global_basis.z.normalized(); flame_t = 0.0
	flame_to = at
	if flame: flame.emitting = at != null
	if pillar and at == null: pillar.emitting = false
## is a point in the fire — in the pillar where the stream comes down, or in the stream itself?
func burns(p: Vector3) -> bool:
	if flame_to == null or not pillar.emitting: return false
	if Vector2(p.x - hit_at.x, p.z - hit_at.z).length() < PILLAR_R and p.y < hit_at.y + PILLAR_H: return true
	var v := p - flame.global_position
	return v.length() < flame.global_position.distance_to(hit_at) and v.normalized().dot(flame_dir) > cos(FLAME_HALF)

# ================================================================== what it does
func act(nm: String) -> void:
	if not ready_: return
	var clip: String = {"roar": "roar", "bite": "bite", "tail": "attack_tail"}.get(nm, "")
	if clip == "": return
	act_name = nm; act_t = 0.0; bit = false
	clip_now = clip; tap.play(clip, 0.15)
func reach(at: Vector3, _k := 1.0) -> void:
	act("tail" if to_local(at).z < -1 else "bite")
func flinch() -> void: flinch_k = 1.0

# ================================================================== its weight: the bob, the flinch, its footfalls
func _steps(dt: float) -> void:
	push = maxf(0, push - dt*2.2); dip = maxf(0, dip - dt*0.5); flinch_k = maxf(0, flinch_k - dt*2.8)
	body.position.y = -dip + sin(t*1.1)*0.03; body.position.z = -sin(minf(1, flinch_k)*PI)*0.7; body.rotation.z = flinch_k*0.18*sin(t*40)
	if clip_now != "run": step_t = 0.0; return
	step_t += dt*tap.speed_scale
	if step_t > 0.42:
		step_t -= 0.42; push = minf(1.4, push + 0.55); dip = minf(0.12, dip + 0.07)
		if on_step.is_valid(): on_step.call(global_position)

# ================================================================== every frame
func _process(dt: float) -> void:
	if not ready_: return
	t += dt
	var e := grow*grow*(3 - 2*grow)
	body.scale = Vector3.ONE*maxf(0.001, e)*SIZE
	speed += ((global_position.distance_to(last_pos)/maxf(dt, 1e-3)) - speed)*minf(1, dt*6); last_pos = global_position
	if act_name == null: _play("run" if speed > 0.6 else "idle", 0.3)
	tap.speed_scale = 1.2 if act_name != null else (clampf(speed/5.0, 0.6, 1.8) if clip_now == "run" else 0.8 + pull*0.3)
	# it jerks: a bone snaps somewhere else for a frame
	if randf() < 0.07:
		var ks := ["Hips", "Spine", "Chest", "Neck"]; var b := _bone_of(ks[randi() % ks.size()])
		if b >= 0: gsk.set_bone_pose_rotation(b, gsk.get_bone_pose_rotation(b)*Quaternion.from_euler(Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5)*0.5))
	_steps(dt)
	if act_name == "bite" or act_name == "tail":
		act_t += dt
		if not bit and act_t > (0.55 if act_name == "bite" else 0.7):
			bit = true
			if on_slam.is_valid(): on_slam.call(to_global(Vector3(0, 0, 2)))
	# the face and the hole ride its head: between its skull and its jaw, out at its teeth
	var hb := _bone_of("Head"); var jb := _bone_of("bn_Jaw")
	if hb >= 0 and jb >= 0:
		var a := body.to_local(_bone_world(gsk, hb).origin); var b2 := body.to_local(_bone_world(gsk, jb).origin)
		head.position = a.lerp(b2, 0.5) + Vector3(0, 0, 0.55)
	mouth = head.to_global(Vector3(0, -0.2, 0.42)); eye_at = eye.global_position
	if flame:
		flame.global_position = mouth
		if flame_to != null:
			flame_dir = flame_dir.slerp(((flame_to as Vector3) - mouth).normalized(), minf(1, dt*5)).normalized()
			flame.global_basis = Basis.looking_at(-flame_dir, Vector3.UP if absf(flame_dir.y) < 0.98 else Vector3.RIGHT)
			# where the stream meets the floor; the stream takes a moment to get there
			var fy: float = (flame_to as Vector3).y
			var k := (mouth.y - fy)/maxf(0.05, -flame_dir.y)
			hit_at = mouth + flame_dir*k; hit_at.y = fy
			var reach := mouth.distance_to(hit_at)
			flame_t += dt
			var sp := reach/maxf(0.2, flame.lifetime*0.8)
			flame.initial_velocity_min = sp; flame.initial_velocity_max = sp*1.15
			pillar.global_position = hit_at
			if flame_t > 0.25 and not pillar.emitting: pillar.emitting = true
func dispose() -> void:
	queue_free()

# ================================================================== ALPHA, IN MAYA
## the black comes up out of her: her own materials swapped for her colours with the stuff under them
class AlphaFx:
	var model: Node3D; var mats: Array = []; var was: Array = []; var eye: MeshInstance3D
	var cover := 0.0; var glitch := 0.0; var t := 0.0; var jump := 0.0
	static func armness(n: String) -> float:
		for pair in [["Hand", 1.0], ["Thumb", 1.0], ["Index", 1.0], ["Middle", 1.0], ["Ring", 1.0], ["Pinky", 1.0], ["ForeArm", 0.86], ["Arm", 0.72], ["Shoulder", 0.58], ["Spine2", 0.46], ["Spine1", 0.4], ["Spine", 0.34], ["Hips", 0.3], ["UpLeg", 0.26], ["Leg", 0.2], ["Foot", 0.16], ["Toe", 0.16], ["Neck", 0.12]]:
			if n.contains(pair[0]): return pair[1]
		return 0.03
	func _init(m: Node3D) -> void:
		model = m
		var sh = load("res://shaders/tsh_alpha_maya.gdshader")
		var st: Array = [m]
		while st.size():
			var n: Node = st.pop_back(); st.append_array(n.get_children())
			if not n is MeshInstance3D: continue
			var mi := n as MeshInstance3D
			var sk := mi.get_node_or_null(mi.skeleton) as Skeleton3D
			var arm := PackedFloat32Array(); arm.resize(128)
			if sk and mi.skin:
				for bi in mi.skin.get_bind_count():
					if bi >= 128: break
					var bn := mi.skin.get_bind_name(bi); var idx := mi.skin.get_bind_bone(bi)
					arm[bi] = armness(bn if bn != "" else (sk.get_bone_name(idx) if idx >= 0 else ""))
			var aabb := mi.mesh.get_aabb()
			for s in mi.mesh.get_surface_count():
				var src = mi.get_active_material(s)
				var m2 := ShaderMaterial.new(); m2.shader = sh
				if src is StandardMaterial3D:
					m2.set_shader_parameter("albedo_tex", src.albedo_texture); m2.set_shader_parameter("albedo_color", src.albedo_color); m2.set_shader_parameter("roughness", src.roughness)
				m2.set_shader_parameter("uMin", aabb.position); m2.set_shader_parameter("uMax", aabb.position + aabb.size); m2.set_shader_parameter("uArm", arm)
				was.append([mi, s, mi.get_surface_override_material(s)]); mi.set_surface_override_material(s, m2); mats.append(m2)
		# the eye: a white light where her left eye is
		var skel: Skeleton3D = null
		st = [m]
		while st.size():
			var n2: Node = st.pop_back(); st.append_array(n2.get_children())
			if n2 is Skeleton3D: skel = n2; break
		if skel:
			var hb := -1
			for i in skel.get_bone_count(): if skel.get_bone_name(i).ends_with("Head"): hb = i
			if hb >= 0:
				var att := BoneAttachment3D.new(); att.bone_idx = hb; skel.add_child(att)
				eye = MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.018; sm.height = 0.036; eye.mesh = sm
				var em := StandardMaterial3D.new(); em.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; em.albedo_color = Color(3, 3, 3.2); eye.material_override = em
				var k := 1.0/maxf(0.001, skel.global_basis.get_scale().x)
				eye.scale = Vector3.ONE*k; eye.position = Vector3(0.032, 0.075, 0.085)*k; att.add_child(eye); eye.visible = false
	func tick(dt: float) -> void:
		t += dt
		for m in mats: m.set_shader_parameter("uT", t); m.set_shader_parameter("uCover", cover); m.set_shader_parameter("uGlitch", glitch)
		if eye: eye.visible = cover > 0.55
		if glitch > 0 and randf() < glitch*0.25: jump = 0.06; model.position = Vector3((randf() - 0.5)*0.12*glitch, 0, (randf() - 0.5)*0.12*glitch)
		elif jump > 0:
			jump -= dt
			if jump <= 0: model.position = Vector3.ZERO
	func remove() -> void:
		for w in was: if is_instance_valid(w[0]): w[0].set_surface_override_material(w[1], w[2])
		if eye and is_instance_valid(eye): eye.get_parent().queue_free()
		if is_instance_valid(model): model.position = Vector3.ZERO
