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
const RANGE := Vector2(0.0032, 0.0018) # how far an iris can travel from the middle, metres
var eyes: Array = []                   # [{at, x, z, n, white, iris, glint}]
var scale_k := 1.0
var look_x := 0.0; var look_y := 0.0

static func attach(model: Node3D) -> Eyes:
	var sk: Skeleton3D = null; var body: MeshInstance3D = null; var st: Array = [model]
	while st.size():
		var x: Node = st.pop_back(); st.append_array(x.get_children())
		if x is Skeleton3D: sk = x
		if x.name == "char1": body = x
	if sk == null or body == null: return null
	body.layers |= LAYER
	var ba := BoneAttachment3D.new(); ba.bone_name = "mixamorigHead"; sk.add_child(ba)
	var e := Eyes.new(); ba.add_child(e)
	e.scale_k = 1.0/sk.global_transform.basis.get_scale().x if sk.is_inside_tree() else 1.0/0.011212
	e._build()
	return e

func _decal(tex: String, size: Vector2, depth: float) -> Decal:
	var d := Decal.new(); d.texture_albedo = load(tex); d.cull_mask = LAYER
	d.size = Vector3(size.x*scale_k, depth*scale_k, size.y*scale_k); d.normal_fade = 0.25; d.upper_fade = 0.2; d.lower_fade = 0.2
	add_child(d); return d

func _build() -> void:
	var J = JSON.parse_string(FileAccess.get_file_as_string("res://assets/tsh/eyes/eyes.json"))
	for k in ["R", "L"]:
		var at := Vector3(J[k].local[0], J[k].local[1], J[k].local[2]); var n := Vector3(J[k].normal[0], J[k].normal[1], J[k].normal[2]).normalized()
		var x := Vector3.UP.cross(n).normalized(); var z := x.cross(n).normalized()
		var b := Basis(x, n, z)
		var w := _decal("res://assets/tsh/eyes/white.png", WHITE, 0.012); w.transform = Transform3D(b, at)
		var i := _decal("res://assets/tsh/eyes/iris.png", Vector2(IRIS, IRIS), 0.012); i.transform = Transform3D(b, at)
		var gl := _decal("res://assets/tsh/eyes/glint.png", Vector2(IRIS, IRIS), 0.012); gl.transform = Transform3D(b, at + z*0.0006*scale_k - x*0.0004*scale_k)
		w.sorting_offset = -50.0; i.sorting_offset = 0.0; gl.sorting_offset = 50.0      # always white, then iris, then glint, from any angle
		eyes.append({"at": at, "x": x, "z": z, "n": n, "white": w, "iris": i, "glint": gl, "b": b})

## where the irises look: x to her left, y up (each -1…1)
func look(x: float, y: float) -> void:
	look_x = clampf(x, -1, 1); look_y = clampf(y, -1, 1)
	for e in eyes:
		var off: Vector3 = e.x*look_x*RANGE.x*scale_k - e.z*look_y*RANGE.y*scale_k
		(e.iris as Decal).transform = Transform3D(e.b, e.at + off)
## her lids: shut, the eyes are not drawn
func open(v: bool) -> void:
	for e in eyes:
		for k in ["white", "iris", "glint"]: (e[k] as Decal).visible = v
