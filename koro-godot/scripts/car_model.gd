## One car, painted and sized by its length, with holder y=0 the contact
## patch: put it on the ground and the wheels are on the ground. The one you
## drive and the ones standing in the Mechanic's bays both come from here,
## because a showroom that sells a different shape from the one you get is a
## lie told in three dimensions.
class_name CarModel
extends RefCounted

const WHEELS := ["wheelFrontLeft", "wheelFrontRight", "wheelBackLeft", "wheelBackRight"]

static func make(paint: Color, length := 4.6) -> Node3D:
	var holder := Node3D.new()
	var model := Models.spawn("res://assets/car.glb")
	holder.add_child(model)
	# the Sketchfab rig came with its own labels ("front light") as meshes
	for n in model.find_children("Text*", "Node3D", true, false):
		(n as Node3D).visible = false
	repaint(holder, paint)
	var box := Models.bounds(model)
	var s := length / maxf(0.001, box.size.z)
	var c := box.get_center()
	model.scale = Vector3.ONE * s
	model.position = Vector3(-c.x, -box.position.y, -c.z) * s
	holder.set_meta("model", model)
	return holder

static func repaint(holder: Node3D, paint: Color) -> void:
	for mi in holder.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for i in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(i) as StandardMaterial3D
			if src and src.resource_name == "body":
				var mat := src.duplicate() as StandardMaterial3D
				mat.albedo_color = paint
				mat.metallic = 0.35
				mat.roughness = 0.35
				m.set_surface_override_material(i, mat)

static func wheels(holder: Node3D) -> Array[Node3D]:
	var out: Array[Node3D] = []
	for n in WHEELS:
		var w := holder.find_child(n, true, false) as Node3D
		if w:
			out.append(w)
	return out
