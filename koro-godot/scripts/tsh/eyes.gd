## EYES THAT MOVE. Hers are painted into her face's texture, so they are given a pair that can: on each eye, projected
## onto her face (Decal, following it as it moves), a white that covers the painted iris, an iris that slides in it,
## and a catchlight that stays where the light is. look(x, y) — +x to her left, +y up, each -1…1 — moves the irises;
## while her lids are down (a blink) they are not drawn. Where the eyes are on her: assets/tsh/eyes/eyes.json,
## found by tools/eyes_locate.gd.
class_name Eyes
extends Node3D

const LAYER := 1 << 18                 # her skin alone takes them (not her hair, not her collar)
const IRIS := 0.0134                   # metres across
const WHITE := Vector2(0.022, 0.0153)
const RANGE := Vector2(0.0037, 0.0018)      # sideways to the corners; up and down only as far as the lids allow # how far an iris can travel from the middle, metres
var eyes: Array = []                   # [{at, x, z, n, white, iris, glint}]
var scale_k := 1.0
var look_x := 0.0; var look_y := 0.0
var head := -1; var sk: Skeleton3D
var body: MeshInstance3D; var skin_open: Material; var skin_shut: Material; var is_open := true

static func attach(model: Node3D) -> Eyes:
	var sk: Skeleton3D = null; var body: MeshInstance3D = null; var st: Array = [model]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x.name == "char1": body = x
	if sk == null or body == null: return null
	body.layers |= LAYER
	var m: StandardMaterial3D = (body.get_active_material(0) as StandardMaterial3D).duplicate()
	m.albedo_texture = load("res://assets/tsh/eyes/skin.png"); body.set_surface_override_material(0, m)
	# on her head as it is DRAWN: after every modifier (the turn of her head toward what she looks at) — a
	# BoneAttachment read it before that, and the irises missed her eyes for a frame whenever she turned
	var e := Eyes.new(); sk.add_child(e); e.head = sk.find_bone("mixamorigHead"); e.sk = sk
	e.top_level = true                                   # in the world at true size: under her model's 1/90 scale the decals were mis-culled
	var fl := Follow.new(); fl.eyes = e; sk.add_child(fl)
	e.body = body; e.skin_open = m; e.skin_shut = body.mesh.surface_get_material(0)
	e.scale_k = 1.0
	e._build()
	return e

## ONE LAYER PER EYE. Stacked decals (a white over the painted iris, the iris over that) swapped their order frame
## to frame and the eyes flickered; so the white is painted into her face's texture (tools/eyes_bake.gd →
## eyes/skin.png) and each eye is one decal, its iris (the catchlight drawn into it)
func _build() -> void:
	var J = JSON.parse_string(FileAccess.get_file_as_string("res://assets/tsh/eyes/eyes.json"))
	var it: Texture2D = load("res://assets/tsh/eyes/iris_pad.png")
	for k in ["R", "L"]:
		var at := Vector3(J[k].local[0], J[k].local[1], J[k].local[2]); var n := Vector3(J[k].normal[0], J[k].normal[1], J[k].normal[2]).normalized()
		var x := Vector3.UP.cross(n).normalized(); var z := x.cross(n).normalized()
		var d := Decal.new(); d.texture_albedo = it; d.cull_mask = LAYER
		d.size = Vector3(IRIS*3, 0.03, IRIS*3); d.normal_fade = 0.0; d.upper_fade = 0.05; d.lower_fade = 0.05      # deep enough to reach the eye where it curves toward her nose
		d.transform = Transform3D(Basis(x, n, z), at); add_child(d)
		eyes.append({"decal": d, "at": at, "x": x, "z": z, "b": Basis(x, n, z)})

## her head bone as drawn, in the world, its scale taken out (the eyes' points are in its frame, in its units)
var unit := 1.0
func place() -> void:
	var t := sk.global_transform*sk.get_bone_global_pose(head)
	unit = t.basis.get_scale().x
	global_transform = Transform3D(t.basis.orthonormalized(), t.origin)
	for e in eyes: _put(e)
func _put(e: Dictionary) -> void:
	var off: Vector3 = e.x*look_x*RANGE.x - e.z*look_y*RANGE.y
	(e.decal as Decal).transform = Transform3D(e.b, e.at*unit + off)
## where the irises look: x to her left, y up (each -1…1)
func look(x: float, y: float) -> void:
	look_x = clampf(x, -1, 1); look_y = clampf(y, -1, 1)
	for e in eyes: _put(e)
## her lids: open, the moving irises over the whites painted into her skin; shut (a blink, past halfway), her own
## painted eyes — the lids close over those as they were made to. A clean swap at the middle of a blink, unseen
func open(v) -> void:
	var o: bool = v if v is bool else float(v) >= 0.5
	if o == is_open: return
	is_open = o
	for e in eyes: (e.decal as Decal).visible = o
	if body: body.set_surface_override_material(0, skin_open if o else skin_shut)

## keeps the eyes on her head bone as the skeleton finally has it (the last modifier on the skeleton)
class Follow extends SkeletonModifier3D:
	var eyes
	func _process_modification() -> void:
		var s := get_skeleton()
		if eyes: eyes.sk = s
		if s and eyes and eyes.head >= 0:
			eyes.place()
