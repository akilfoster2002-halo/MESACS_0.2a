## HER PHONE: the iPhone (animations/props → assets/tsh/props/iphone.glb) in her right hand, held as a phone is —
## screen to her palm, its top past her fingers — whenever a scene puts it there
class_name Phone
extends BoneAttachment3D

## where it sits in her hand, in the hand bone's frame (its units: the model is scaled 1/90): the bone's +Y runs from
## her wrist to her fingers, her palm faces -X. The phone's length along her fingers, its screen to her palm, its
## bottom at the heel of her hand
const AT := Vector3(-1.8, -3.0, 0.0)
const AXES := [Vector3(0, 0, 1), Vector3(0, 1, 0), Vector3(-1, 0, 0)]

static func make(sk: Skeleton3D) -> Phone:
	var p := Phone.new(); p.bone_name = "mixamorigRightHand"; sk.add_child(p)
	var m: Node3D = (load("res://assets/tsh/props/iphone.glb") as PackedScene).instantiate()
	var k := 1.0/sk.global_transform.basis.get_scale().x if sk.is_inside_tree() else 1.0/0.011212
	m.transform = Transform3D(Basis(AXES[0], AXES[1], AXES[2]).scaled(Vector3.ONE*k), AT); p.add_child(m)
	p.model = m; p.k = k
	p.visible = false
	return p
var model: Node3D; var k := 1.0
## "ear": screen to her palm (at her ear); "read": its back in her palm, the screen up to her eyes
func hold(how: String) -> void:
	visible = how != ""
	if how == "read": model.transform = Transform3D(Basis(-AXES[0], AXES[1], -AXES[2]).scaled(Vector3.ONE*k), AT + Vector3(-0.6, 0, 0))
	elif how == "ear": model.transform = Transform3D(Basis(AXES[0], AXES[1], AXES[2]).scaled(Vector3.ONE*k), AT)
