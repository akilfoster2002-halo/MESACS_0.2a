## TSH · ALPHA — public/tshalpha.js (TSHMONSTER and TSHALPHA), ported.
## What came up out of Maya keeps coming: a mass of the black stuff as big as the platform, heaving, pale lights
## opening and shutting all over it, one white eye high on it, strands of it whipping out, a swarm of black flakes.
## THE BODY IT COMES UP IN is the goose (assets/tsh/monster/goose.glb) — and nothing of its movement is its own. A
## spider (spider.glb) crawls, unseen, and its feet are where the goose's blade tips and knees go; a tyrannosaur
## (trexhead.glb: idle, bite, roar, attack_tail) works its spine, neck and head, and its head is drawn on the goose's
## neck. Every frame each goose bone turns (in the monster's own frame) by as much as its source has turned since the
## first frame of its idle.
##
##   var m := Monster.new(); parent.add_child(m); m.setup(at, yaw)   m.grow = 0..1   m.mouth / m.eye_at (world)
##   m.act("roar" | "bite" | "tail")   m.reach(at)   m.flinch()
class_name Monster
extends Node3D

## goose bone ← [rig, its bone (dots stripped), how much of its turn]; parents before children
const MAP := [["Hips", "sp", "Bone004", 0.5], ["Spine", "tx", "bn_Spine15", 1.0], ["Chest", "tx", "bn_Spine26", 1.1], ["Neck", "tx", "bn_Neck18", 1.2], ["Head", "tx", "bn_Head10", 1.3]]
## where the spider's feet go are where its blade tips and its knees go: [goose chain, the point it reaches with (body-local), spider foot]
const LIMBS := [
	{"chain": ["Shoulder.L", "UpperArm.L", "Forearm.L"], "tip": Vector3(1.41, 0.0, 1.01), "foot": "Bone002_L006"},
	{"chain": ["Shoulder.R", "UpperArm.R", "Forearm.R"], "tip": Vector3(-1.41, 0.0, 1.01), "foot": "Bone002_R006"},
	{"chain": ["Thigh.L", "Shin.L", "Foot.L"], "tip": Vector3(1.19, 0.0, -2.93), "foot": "Bone_L006"},
	{"chain": ["Thigh.R", "Shin.R", "Foot.R"], "tip": Vector3(-1.19, 0.0, -2.93), "foot": "Bone_R006"}]
const SIZE := 1.35
const ANCH := ["Head", "Neck", "Chest", "Hips", "Forearm.L", "Forearm.R", "UpperArm.L", "UpperArm.R", "Shin.L", "Shin.R", "Foot.L", "Foot.R", "Spine"]
const FANCH := ["Forearm.L", "Forearm.R", "UpperArm.L", "UpperArm.R", "Shin.L", "Shin.R", "Foot.L", "Foot.R", "Head", "Neck", "Hips", "Chest"]
const NL := 110; const NPT := 14; const NF := 1100; const NB := 40

var grow := 0.0
var pull := 1.0
var t := 0.0
var key = null                     # a close-up can take the hard front light down
var mouth := Vector3.ZERO
var eye_at := Vector3.ZERO
var on_slam: Callable
var on_step: Callable
var push := 0.0

var body: Node3D
var skin: ShaderMaterial
var gsk: Skeleton3D; var ssk: Skeleton3D; var tsk: Skeleton3D
var sap: AnimationPlayer; var tap: AnimationPlayer
var tx: Node3D
var ready_ := false
var refs: Array = []
var limbs: Array = []
var act_name = null; var act_t := 0.0; var bit := false
var sp_now := ""
var head: Node3D; var eye: MeshInstance3D; var halo: Sprite3D
var rims: Array = []; var fill: OmniLight3D; var spot: SpotLight3D; var strobe: OmniLight3D
var strands: Array = []; var ink: MultiMeshInstance3D
var flakes_d: Array = []; var flakes: MultiMeshInstance3D
var blights: Array = []; var bi := 0
var last_pos := Vector3.ZERO; var speed := 0.0
var last_w := Vector3.ZERO
var dip := 0.0; var flinch_k := 0.0
var spider_names := {}; var trex_names := {}

static func _plain(s: String) -> String: return s.replace(".", "")

func setup(at: Vector3, yaw: float) -> void:
	position = Vector3(at.x, 0, at.z); rotation.y = yaw
	last_pos = position; last_w = position
	body = Node3D.new(); add_child(body)
	skin = ShaderMaterial.new(); skin.shader = load("res://shaders/tsh_alpha_skin.gdshader")
	var goose: Node3D = (load("res://assets/tsh/monster/goose.glb") as PackedScene).instantiate(); body.add_child(goose)
	var sp: Node3D = (load("res://assets/tsh/monster/spider.glb") as PackedScene).instantiate(); body.add_child(sp)
	tx = (load("res://assets/tsh/monster/trexhead.glb") as PackedScene).instantiate(); tx.scale = Vector3.ONE*0.6; body.add_child(tx)
	_each(goose, func(n): if n is MeshInstance3D: n.material_override = skin)
	_each(tx, func(n): if n is MeshInstance3D: n.material_override = skin)
	_each(sp, func(n): if n is MeshInstance3D: n.visible = false)
	gsk = _find_t(goose, "Skeleton3D"); ssk = _find_t(sp, "Skeleton3D"); tsk = _find_t(tx, "Skeleton3D")
	sap = _find_t(sp, "AnimationPlayer"); tap = _find_t(tx, "AnimationPlayer")
	for i in ssk.get_bone_count(): spider_names[_plain(ssk.get_bone_name(i))] = i
	for i in tsk.get_bone_count(): trex_names[_plain(tsk.get_bone_name(i))] = i
	for a in sap.get_animation_list(): sap.get_animation(a).loop_mode = Animation.LOOP_LINEAR
	for a in tap.get_animation_list(): tap.get_animation(a).loop_mode = Animation.LOOP_LINEAR if a in ["idle", "run"] else Animation.LOOP_NONE
	tap.animation_finished.connect(func(_n): act_name = null; tap.play("idle", 0.35))
	# the reference: each animal at the first frame of its idle, the goose at rest
	_sp_play("walk", 0.0); tap.play("idle"); sap.seek(0, true); tap.seek(0, true)
	for m in MAP:
		var src_sk: Skeleton3D = ssk if m[1] == "sp" else tsk
		var si: int = (spider_names if m[1] == "sp" else trex_names).get(m[2], -1); var di: int = gsk.find_bone(m[0])
		if si < 0 or di < 0: continue
		refs.append({"g": m[0], "src_sk": src_sk, "si": si, "di": di, "k": m[3], "s": _rel(src_sk, si), "d": _rel(gsk, di)})
	for L in LIMBS:
		var chain := []
		for nm in L.chain: chain.append(gsk.find_bone(nm))
		var fi: int = spider_names.get(L.foot, -1)
		if chain.has(-1) or fi < 0: continue
		var last: int = chain[chain.size() - 1]
		var tipw := body.to_global(L.tip)
		var eff_local := _bone_world(gsk, last).affine_inverse()*tipw
		var rest := body.to_local(tipw); rest.y = 0
		var f0 := body.to_local(_bone_world(ssk, fi).origin)
		limbs.append({"chain": chain, "eff": eff_local, "foot": fi, "rest": rest, "f0": f0, "rq": chain.map(func(b): return gsk.get_bone_pose_rotation(b)),
			"planted": true, "lock": null, "from": Vector3.ZERO, "swT": 0.0, "swDur": 0.35, "lift": 0.02})
	_sp_play("walk tight", 0.25)
	_face(); _static(); _swarm(); _blights()
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
func _sp_play(nm: String, fade := 0.25) -> void:
	var full := "Armature|Armature|" + nm
	if sp_now == nm or not sap.has_animation(full): return
	sp_now = nm; sap.play(full, fade)
func _bone_world(sk: Skeleton3D, i: int) -> Transform3D: return sk.global_transform*sk.get_bone_global_pose(i)
## a bone's turn in the monster's own frame
func _rel(sk: Skeleton3D, i: int) -> Quaternion:
	return global_basis.get_rotation_quaternion().inverse()*_bone_world(sk, i).basis.get_rotation_quaternion()
func _bone_of(nm: String) -> int: return gsk.find_bone(nm) if gsk else -1
func anchor(nm: String) -> Vector3:
	var b := _bone_of(nm)
	return body.to_local(_bone_world(gsk, b).origin) if b >= 0 else Vector3(0, 2.5, 0)

# ================================================================== its face: the eye, its lights, the hole
func _face() -> void:
	head = Node3D.new(); head.position = Vector3(0, 4.7, 0.25); body.add_child(head)
	eye = MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.09; sm.height = 0.18; eye.mesh = sm
	var em := StandardMaterial3D.new(); em.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; em.albedo_color = Color(4, 4, 4.4); eye.material_override = em
	eye.position = Vector3(0, 0.12, 0.3); head.add_child(eye); eye.visible = false
	halo = Sprite3D.new(); halo.texture = _radial(); halo.pixel_size = 0.9/64.0; halo.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	halo.modulate = Color(1, 1, 1, 0.5); halo.render_priority = 101; eye.add_child(halo)
	for r in [[Color("#ff2aa8"), -4.5, 3.6, 3.4], [Color("#22e8ff"), 4.5, 3.0, 2.8], [Color("#b06aff"), 0, 7, -2.5]]:
		var l := OmniLight3D.new(); l.light_color = r[0]; l.omni_range = 18; l.position = Vector3(r[1], r[2], r[3]); body.add_child(l); rims.append(l)
	fill = OmniLight3D.new(); fill.light_color = Color("#a9a2ff"); fill.omni_range = 16; fill.position = Vector3(0, 3.2, 4.5); body.add_child(fill)
	spot = SpotLight3D.new(); spot.light_color = Color("#ffe8ff"); spot.spot_range = 40; spot.spot_angle = 46; spot.shadow_enabled = true; spot.position = Vector3(0, 0, 0.45); head.add_child(spot)
	spot.rotation.x = -atan2(4.2, 11.0)
	strobe = OmniLight3D.new(); strobe.omni_range = 30; strobe.position = Vector3(0, 0, 0.4); head.add_child(strobe)
func _radial() -> Texture2D:
	var gt := GradientTexture2D.new(); gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1, 0.5); gt.width = 64; gt.height = 64
	var gr := Gradient.new(); gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(0.78, 0.86, 1, 0)); gr.add_point(0.25, Color(0.86, 0.92, 1, 0.6)); gt.gradient = gr
	return gt

# ================================================================== the static: strands of black thrown off it
func _static() -> void:
	ink = MultiMeshInstance3D.new(); var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
	var cm := CylinderMesh.new(); cm.top_radius = 1; cm.bottom_radius = 1; cm.height = 1; cm.radial_segments = 5; cm.rings = 1; cm.cap_top = false; cm.cap_bottom = false
	mm.mesh = cm; mm.instance_count = NL*NPT; mm.visible_instance_count = 0; ink.multimesh = mm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(0.004, 0.004, 0.008); ink.material_override = m
	ink.extra_cull_margin = 30; body.add_child(ink)
	for i in NL:
		var th := randf()*TAU; var ph := (randf() - 0.3)*PI*0.9
		var d := Vector3(cos(th)*cos(ph), sin(ph) + 0.25, sin(th)*cos(ph))
		if d.z > 0.3: d.z *= -0.6
		strands.append({"th": 0.012 + randf()*0.03, "bone": ANCH[i % ANCH.size()], "dir": d.normalized(), "len": 2 + randf()*6, "curl": 2 + randf()*6,
			"w": 0.15 + randf()*0.6, "sp": 0.6 + randf()*2.2, "ph": randf()*20, "gap": 0.2 + randf()*0.5, "jump": Vector3.ZERO})
func _swarm() -> void:
	flakes = MultiMeshInstance3D.new(); var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
	var tm := SphereMesh.new(); tm.radius = 1; tm.height = 2; tm.radial_segments = 4; tm.rings = 2
	mm.mesh = tm; mm.instance_count = NF; flakes.multimesh = mm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color.BLACK; flakes.material_override = m
	flakes.extra_cull_margin = 30; body.add_child(flakes)
	for i in NF:
		var bn: String = FANCH[i % FANCH.size()]; var torso := bn == "Chest" or bn == "Hips"
		flakes_d.append({"bone": bn, "r": (0.5 if torso else 0.12) + pow(randf(), 2.2)*(0.9 if torso else 1.1), "a": randf()*7, "b": randf()*7,
			"sp": (0.4 + randf()*1.6)*(-1 if randf() < 0.5 else 1), "s": 0.015 + randf()*0.05, "y": (randf() - 0.5)*1.2, "back": torso})
func _blights() -> void:
	var sh = load("res://shaders/tsh_alpha_blight.gdshader")
	for i in NB:
		var q := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(1, 1); q.mesh = pm
		var m := ShaderMaterial.new(); m.shader = sh; m.render_priority = 100; q.material_override = m; q.visible = false
		blights.append({"m": q, "age": 99.0})
func _blight(at: Vector3) -> void:
	var b: Dictionary = blights[bi % NB]; bi += 1
	var par := get_parent()
	if b.m.get_parent() != par:
		if b.m.get_parent(): b.m.get_parent().remove_child(b.m)
		par.add_child(b.m)
	var sz := 3.2 + randf()*2.6
	b.m.global_position = Vector3(at.x, at.y + 0.02, at.z); b.m.scale = Vector3(sz, 1, sz); b.m.rotation.y = randf()*TAU; b.m.visible = true
	b.m.material_override.set_shader_parameter("uSeed", randf()*50); b.age = 0.0

# ================================================================== what it does
func act(nm: String) -> void:
	if not ready_: return
	var clip: String = {"roar": "roar", "bite": "bite", "tail": "attack_tail"}.get(nm, "")
	if clip == "": return
	act_name = nm; act_t = 0.0; bit = false
	tap.play(clip, 0.15)
	if nm != "roar" and sap.has_animation("Armature|Armature|attack"):
		var was := sp_now; sp_now = ""; _sp_play("attack", 0.12)
		get_tree().create_timer(1.1).timeout.connect(func(): if sp_now == "attack": sp_now = ""; _sp_play(was if was != "attack" else "walk tight", 0.3))
func reach(at: Vector3, _k := 1.0) -> void:
	act("tail" if to_local(at).z < -1 else "bite")
func flinch() -> void: flinch_k = 1.0

# ================================================================== the retarget, the gait
func _drive() -> void:
	var rootq := global_basis.get_rotation_quaternion(); var skq := gsk.global_basis.get_rotation_quaternion()
	for r in refs:
		var q: Quaternion = _rel(r.src_sk, r.si)*r.s.inverse()
		var k: float = r.k
		if k != 1.0:
			var q2 := Quaternion.IDENTITY.slerp(q, minf(1, k))
			if k > 1: q2 = q2*Quaternion.IDENTITY.slerp(q, k - 1)
			q = q2
		var want: Quaternion = rootq*(q*r.d)                     # in the world
		var ds: Quaternion = skq.inverse()*want                    # in the goose skeleton's space
		var par := gsk.get_bone_parent(r.di)
		var ps := gsk.get_bone_global_pose(par).basis.get_rotation_quaternion() if par >= 0 else Quaternion.IDENTITY
		gsk.set_bone_pose_rotation(r.di, (ps.inverse()*ds).normalized())
func _solve(L: Dictionary, target: Vector3) -> void:
	var ch: Array = L.chain
	for i in ch.size(): gsk.set_bone_pose_rotation(ch[i], L.rq[i])
	var skq := gsk.global_basis.get_rotation_quaternion()
	for it in 10:
		for i in range(ch.size() - 1, -1, -1):
			var b: int = ch[i]
			var J := _bone_world(gsk, b).origin; var E = _bone_world(gsk, ch[ch.size() - 1])*L.eff
			var A = E - J; var B := target - J
			if A.length_squared() < 1e-6 or B.length_squared() < 1e-6: continue
			var pq := Quaternion(A.normalized(), B.normalized())
			var bw := skq*gsk.get_bone_global_pose(b).basis.get_rotation_quaternion()
			var nw := pq*bw
			var par := gsk.get_bone_parent(b)
			var pw := skq*(gsk.get_bone_global_pose(par).basis.get_rotation_quaternion() if par >= 0 else Quaternion.IDENTITY)
			gsk.set_bone_pose_rotation(b, (pw.inverse()*nw).normalized())
func _steps(dt: float) -> void:
	var floor_y := global_position.y
	var vel := (global_position - last_w)/maxf(dt, 1e-3); last_w = global_position
	var moving := vel.length() > 0.15
	push = maxf(0, push - dt*2.2); dip = maxf(0, dip - dt*0.5); flinch_k = maxf(0, flinch_k - dt*2.8)
	body.position.y = -dip + sin(t*1.1)*0.03; body.position.z = -sin(minf(1, flinch_k)*PI)*0.7; body.rotation.z = flinch_k*0.18*sin(t*40)
	for L in limbs:
		var up: float = body.to_local(_bone_world(ssk, L.foot).origin).y - L.f0.y
		L.lift = maxf(L.lift*0.999, up)
		var home := body.to_global(L.rest); home.y = floor_y
		var stretch: float = Vector2(L.lock.x - home.x, L.lock.z - home.z).length() if L.lock != null else 99.0
		var wants_up: bool = up > L.lift*0.25 if moving else stretch > 0.45
		var T: Vector3
		if L.planted:
			if L.lock == null: L.lock = home
			if wants_up or stretch > 1.8: L.planted = false; L.swT = 0.0; L.from = L.lock
			T = L.lock
		else:
			L.swT += dt; var k: float = minf(1, L.swT/L.swDur)
			var land = home + vel*L.swDur*0.9; land.y = floor_y
			T = (L.from as Vector3).lerp(land, k*k*(3 - 2*k)); T.y = floor_y + sin(k*PI)*(0.35 + minf(0.5, vel.length()*0.08))
			if k >= 1 and (not wants_up or L.swT > L.swDur*1.6):
				L.planted = true; L.lock = land; push = minf(1.4, push + 0.55); dip = minf(0.12, dip + 0.07); _blight(land)
				if on_step.is_valid(): on_step.call(land)
		_solve(L, T)

# ================================================================== every frame
func _process(dt: float) -> void:
	if not ready_: return
	t += dt; skin.set_shader_parameter("uT", t)
	var e := grow*grow*(3 - 2*grow)
	body.scale = Vector3.ONE*maxf(0.001, e)*SIZE
	speed += ((global_position.distance_to(last_pos)/maxf(dt, 1e-3)) - speed)*minf(1, dt*6); last_pos = global_position
	var want := "run" if speed > 4.5 else ("large walk" if speed > 0.6 else "walk tight")
	if sp_now != "attack": _sp_play(want, 0.3)
	if sp_now != "attack": sap.speed_scale = minf(2.2, 0.6 + speed*0.25) if speed > 0.6 else 0.5 + pull*0.4
	tap.speed_scale = 1.2 if act_name != null else 1.0
	_drive()
	# it jerks: a bone snaps somewhere else for a frame (never a limb: a planted foot stays planted)
	if randf() < 0.07:
		var ks := ["Hips", "Spine", "Chest", "Neck"]; var b := gsk.find_bone(ks[randi() % ks.size()])
		if b >= 0: gsk.set_bone_pose_rotation(b, gsk.get_bone_pose_rotation(b)*Quaternion.from_euler(Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5)*0.5))
	_steps(dt)
	# the tyrannosaur's neck set on the goose's: the head goes where the goose's head was
	var gh := gsk.find_bone("Head"); var tn: int = trex_names.get("bn_Neck29", -1)
	if gh >= 0 and tn >= 0:
		var v1 := body.to_local(_bone_world(gsk, gh).origin); var v2 := body.to_local(_bone_world(tsk, tn).origin)
		tx.position += v1 - v2
		gsk.set_bone_pose_scale(gh, Vector3.ONE*0.001)
	if act_name == "bite" or act_name == "tail":
		act_t += dt
		if not bit and act_t > (0.55 if act_name == "bite" else 0.7):
			bit = true
			if on_slam.is_valid(): on_slam.call(to_global(Vector3(0, 0, 2)))
	# the face and the hole ride the dinosaur's head: between its skull and its jaw, out at its teeth
	var th: int = trex_names.get("bn_Head10", -1); var tj: int = trex_names.get("bn_Jaw11", -1)
	if th >= 0 and tj >= 0:
		var a := body.to_local(_bone_world(tsk, th).origin); var b2 := body.to_local(_bone_world(tsk, tj).origin)
		head.position = a.lerp(b2, 0.5) + Vector3(0, 0, 0.55)
	eye.visible = grow > 0.9
	_tick_static(dt); _tick_swarm(dt)
	for b in blights:
		if not b.m.visible: continue
		b.age += dt; b.m.material_override.set_shader_parameter("uAge", b.age); b.m.material_override.set_shader_parameter("uT", t)
		if b.age > 30: b.m.visible = false
	skin.set_shader_parameter("uAmp", 0.045 + 0.025*sin(t*0.7) + pull*0.02)
	halo.modulate.a = 0.35 + 0.15*sin(t*7)
	fill.light_energy = 9.0*e
	for i in rims.size():
		rims[i].light_energy = (8.0 + 4.0*sin(t*(2.1 + i) + i*2))*e; rims[i].light_color = Color.from_hsv(fmod(t*0.11 + i*0.33, 1.0), 1, 1)
	spot.light_energy = (30 + 20*randf()*pull*0.5)*e*(1.0 if key == null else float(key))
	spot.light_color = Color.from_hsv(fmod(0.85 + sin(t*3)*0.1 + 1, 1.0), 0.4, 1)
	strobe.light_energy = 11*e if randf() < 0.02*pull else strobe.light_energy*0.8
	mouth = head.to_global(Vector3(0, -0.2, 0.42)); eye_at = eye.global_position
func _tick_static(dt: float) -> void:
	var mm := ink.multimesh; var si := 0
	for st in strands:
		var av := anchor(st.bone)
		if randf() < 0.02: st.jump = Vector3(randf() - 0.5, (randf() - 0.5)*0.66, randf() - 0.5)*1.2
		else: st.jump *= 0.85
		var tt: float = t*st.sp + st.ph; var L: float = st.len*(0.75 + 0.25*sin(tt*0.7))*(1 + pull*0.3)
		var d: Vector3 = st.dir; var sa := Vector3(-d.z, 0, d.x).normalized(); var sb := d.cross(sa)
		var p0 := Vector3.ZERO
		for j in NPT:
			var u: float = st.gap + (1 - st.gap)*j/float(NPT - 1); var r: float = st.w*u*(1 + sin(tt*1.3 + u*4)); var c: float = u*st.curl*TAU + tt*2.0
			var pv: Vector3 = av + st.jump + d*u*L + sa*cos(c)*r + sb*sin(c)*r*0.8
			pv.y -= u*u*0.6; pv += Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5)*0.06
			if j > 0 and randf() > 0.3 and si < mm.instance_count:
				var seg := pv - p0; var ln := seg.length()
				if ln > 1e-4:
					var w: float = st.th*(1 - u*0.6)
					var bas := Basis(Quaternion(Vector3.UP, seg/ln)).scaled(Vector3(w, ln, w))
					mm.set_instance_transform(si, Transform3D(bas, (pv + p0)/2)); si += 1
			p0 = pv
	mm.visible_instance_count = si
func _tick_swarm(dt: float) -> void:
	var mm := flakes.multimesh; var anchors := {}
	for nm in FANCH: anchors[nm] = anchor(nm)
	for i in flakes_d.size():
		var f: Dictionary = flakes_d[i]; var av: Vector3 = anchors[f.bone]
		f.a += dt*f.sp*(1 + pull); f.b += dt*f.sp*0.7
		var r: float = f.r*(1 + 0.25*sin(t*2 + i))
		var v := Vector3(av.x + cos(f.a)*cos(f.b)*r, av.y + f.y*0.5 + sin(f.b)*r*0.6, av.z + sin(f.a)*cos(f.b)*r)
		if f.back and v.z > av.z: v.z = av.z - (v.z - av.z)
		var sc: float = f.s*(2.5 if randf() < 0.04 else 1.0)
		mm.set_instance_transform(i, Transform3D(Basis.from_euler(Vector3(f.a*3, f.b*2, 0)).scaled(Vector3(sc, sc*1.6, sc)), v))

func dispose() -> void:
	for b in blights: if is_instance_valid(b.m): b.m.queue_free()
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
