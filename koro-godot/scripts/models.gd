## Small helpers for the imported GLB models.
class_name Models
extends RefCounted

static func spawn(path: String) -> Node3D:
	var scene: PackedScene = load(path)
	return scene.instantiate()

static func anim_player(root: Node) -> AnimationPlayer:
	var found := root.find_children("*", "AnimationPlayer", true, false)
	return found[0] if found.size() > 0 else null

## Loop the clips that should loop (everything but a jump).
static func loop_clips(ap: AnimationPlayer, except := ["jump"]) -> void:
	if ap == null:
		return
	for n in ap.get_animation_list():
		if n in except:
			continue
		var a := ap.get_animation(n)
		if a:
			a.loop_mode = Animation.LOOP_LINEAR

## The model's bounding box in its own root's space, whatever the nodes inside do.
static func bounds(root: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in root.find_children("*", "VisualInstance3D", true, false):
		var vi := mi as VisualInstance3D
		var xf := root.global_transform.affine_inverse() * vi.global_transform if root.is_inside_tree() else _rel(root, vi)
		var b := xf * vi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box

static func _rel(root: Node3D, n: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = n
	while cur != null and cur != root:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf

## The first mesh in a model, with the transform it sits at inside the model.
static func first_mesh(path: String) -> Dictionary:
	var root := spawn(path)
	var out := {}
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		out = {"mesh": (mi as MeshInstance3D).mesh, "xf": _rel(root, mi)}
		break
	root.free()
	return out

## The characters are painted in their VERTICES (paint-skinned.js), and an
## imported material ignores vertex colour unless told to use it.
static func use_vertex_colors(root: Node) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for i in m.mesh.get_surface_count():
			var src := m.get_active_material(i)
			var mat: StandardMaterial3D = (src.duplicate() if src is StandardMaterial3D else StandardMaterial3D.new())
			mat.vertex_color_use_as_albedo = true
			m.set_surface_override_material(i, mat)

## THE SIZE OF A RIGGED MODEL, FROM ITS BONES. A skinned mesh is drawn where
## its skeleton puts it, and the skeleton can carry a scale the mesh node
## does not (the retargeted mecha's does) — measured off the mesh box it came
## out tiny and was scaled up to hundreds of metres. Bones do not lie: feet to
## the top of the head, in the model root's own space.
static func bone_bounds(root: Node3D) -> AABB:
	var box := AABB()
	var first := true
	var inv := root.global_transform.affine_inverse()
	for sk in root.find_children("*", "Skeleton3D", true, false):
		var skel := sk as Skeleton3D
		for i in skel.get_bone_count():
			var p := inv * (skel.global_transform * skel.get_bone_global_pose(i)).origin
			if first:
				box = AABB(p, Vector3.ZERO)
				first = false
			else:
				box = box.expand(p)
	return box

## Scale a model so it stands `height` tall, feet on y=0, centred over x/z=0.
## Rigged models are measured by their bones (see above); the rest by mesh.
## Measured STANDING, in the idle clip's first frame, not the rest pose: a
## clip can carry the hips higher than the rest pose does, and a body fitted
## at rest then floats a metre off the grass once idle plays.
static func fit_height(model: Node3D, height: float) -> float:
	var ap := anim_player(model)
	if ap and ap.has_animation("idle"):
		ap.play("idle", 0.0)
		ap.seek(0.0, true)
	var box := bone_bounds(model)
	if box.size.y < 1e-4:
		box = bounds(model)
	var s := height / maxf(1e-4, box.size.y)
	var c := box.get_center()
	model.scale = Vector3.ONE * s
	model.position = Vector3(-c.x, -box.position.y, -c.z) * s
	return s
