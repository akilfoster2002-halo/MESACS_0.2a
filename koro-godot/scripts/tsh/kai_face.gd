## KAI'S FACE (people/kai.glb, tools/kai-rig.py) — and MAYA'S: morph targets as Robin's are (jawOpen, mouthO, smile,
## frown, browUp, browDown, blink), and eyes that turn: Kai's eyeballs; Maya's painted eyes given moving irises as
## Robin's are (Eyes, from eyes/maya — tools/eyes_locate.gd and eyes_bake.gd run on her). He blinks on his own; his eyes — and a little of his head — go to
## whoever is talking, or to her in a fight; his jaw moves while his line is up (he is not heard: a syllable at a time);
## his brows come down and his mouth sets when he fights.
class_name KaiFace
extends Node

var g; var e: Dictionary
var body: MeshInstance3D; var idx := {}
var eyes: Array = []; var rest: Array = []
var sk: Skeleton3D; var head := -1
var decals: Eyes = null; var who := "kai"
var blink_in := 2.0; var blink_t := 0.0; var t := 0.0
var cur := {}
var jaw_k := 1.0             # how far the jaw may open (the Director's face has no inside to its mouth: a little)
var last_hp := 0.0; var wince := 0.0; var her_hp := 100.0; var smirk := 0.0

static func attach(game, ent: Dictionary, eyes_dir := "") -> KaiFace:
	var f := KaiFace.new(); f.g = game; f.e = ent; f.who = String(ent.get("tag", "kai"))
	var st: Array = [ent.node]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is MeshInstance3D and (x as MeshInstance3D).mesh and (x as MeshInstance3D).mesh.get_blend_shape_count() > 0: f.body = x
		if x is MeshInstance3D and String(x.name).begins_with("Eye"): f.eyes.append(x)
		if x is Skeleton3D: f.sk = x
	if f.body == null: return null
	for i in f.body.mesh.get_blend_shape_count(): f.idx[String(f.body.mesh.get_blend_shape_name(i))] = i
	for ey in f.eyes:
		f.rest.append(ey.transform)
		var m := StandardMaterial3D.new(); m.vertex_color_use_as_albedo = true; m.roughness = 0.12; m.specular = 0.8; ey.material_override = m
	if f.sk: f.head = f.sk.find_bone("mixamorig_Head")
	if eyes_dir != "": f.decals = Eyes.attach(ent.node, eyes_dir)
	ent.node.add_child(f)
	return f

func _shape(nm: String, v: float, dt: float, rate := 10.0) -> void:
	if not idx.has(nm): return
	if nm == "jawOpen" or nm == "mouthO": v *= jaw_k
	var c: float = cur.get(nm, 0.0); c = lerpf(c, v, minf(1, dt*rate)); cur[nm] = c
	body.set_blend_shape_value(idx[nm], c)

func _look_at_point() -> Vector3:
	if g.talk_who != "" and g.talk_who != who:
		var who = g.robin if g.talk_who == "robin" else null
		if who == null:
			var c = g.crew(g.talk_who)
			if c != null: return c.node.global_position + Vector3(0, 1.6, 0)
		if who != null: return who.global_position + Vector3(0, 1.5, 0)
	return g.robin.global_position + Vector3(0, 1.5, 0)

func _process(dt: float) -> void:
	if not is_instance_valid(e.node) or not e.node.visible: return
	t += dt
	# the blink
	blink_in -= dt
	if blink_in <= 0: blink_t = 0.16; blink_in = 2.0 + randf()*3.5 if randf() > 0.2 else 0.25
	blink_t = maxf(0, blink_t - dt)
	var b := sin(PI*clampf(1.0 - blink_t/0.16, 0, 1)) if blink_t > 0 else 0.0
	_shape("blink", b, dt, 40.0)
	for ey in eyes: ey.visible = b < 0.6
	if decals: decals.open(b < 0.5)
	# talking: a syllable at a time while his line is up
	var talking: bool = g.talk_who == who and g.sub_label.text != ""
	var flap := (0.35 + 0.65*absf(sin(t*11.0))*(0.6 + 0.4*sin(t*3.7))) if talking else 0.0
	_shape("jawOpen", flap*0.9, dt, 18.0); _shape("mouthO", flap*0.3, dt, 14.0)
	# fighting: brows down, mouth set
	var fighting: bool = g.fight.on and e.get("active", false)
	# a wince when he is hit; a snarl as he swings; a smirk when he has hurt her
	var hp: float = float(e.get("hp", 0.0))
	if hp < last_hp - 0.01: wince = 0.6
	last_hp = hp; wince = maxf(0, wince - dt)
	var rh: float = float(g.fight.R.get("hp", 100.0)) if g.fight.on and g.fight.R is Dictionary else 100.0
	if rh < her_hp - 0.5: smirk = 1.2
	her_hp = rh; smirk = maxf(0, smirk - dt)
	var swing: bool = fighting and e.get("state", "") == "windup"
	_shape("browDown", (1.0 if fighting else 0.3) * (0.3 if wince > 0 else 1.0), dt, 6.0)
	_shape("frown", 0.9 if wince > 0 else (0.75 if fighting and smirk <= 0 else 0.15), dt, 8.0)
	_shape("smile", 0.8 if smirk > 0 else 0.0, dt, 8.0)
	if wince > 0: _shape("blink", 0.7, dt, 30.0)
	if swing or wince > 0: _shape("jawOpen", 0.55 if swing else 0.35, dt, 14.0)
	_shape("browUp", 0.35*absf(sin(t*2.3)) if talking else 0.0, dt, 6.0)
	# the eyes: each turned toward what he looks at (an eyeball's front is its +Z), no further than an eye turns from
	# where his face points
	var to := _look_at_point()
	var face_fwd: Vector3 = e.node.global_basis.z.normalized()
	if decals and is_instance_valid(decals):          # her irises: toward it, as far as eyes go (x to her left, y up)
		var lt: Vector3 = decals.global_transform.affine_inverse()*to
		decals.look(clampf(atan2(lt.x, lt.z)/0.5, -1, 1), clampf(atan2(lt.y, maxf(0.05, Vector2(lt.x, lt.z).length()))/0.35, -1, 1))
	for ey in eyes:
		var p: Vector3 = ey.global_position
		var d := (to - p).normalized()
		var ang := face_fwd.angle_to(d)
		if ang > 0.6: d = face_fwd.slerp(d, 0.6/ang).normalized()
		var sc: Vector3 = ey.global_basis.get_scale()
		ey.global_basis = Basis.looking_at(-d, Vector3.UP)*Basis.from_scale(sc)
