## HER MOVES ON SOMEBODY ELSE'S BONES (tsh.js retargetClips). Kai's skeleton (and Maya's, and Canon's) has her
## bones' names but not their resting turns, so her clips, which set each bone's turn outright, would twist him. So
## each clip is played on a copy of her, out of sight, and for every bone, every frame, how far it has turned from
## her idle (in the body's own frame) is how far his turns from his idle; his hips travel as hers do, scaled to his
## height. The result is baked into clips of his own, added to his AnimationPlayer.
class_name Retarget
extends RefCounted

const FPS := 30.0
static var _cache := {}

static func _plain(s: String) -> String: return s.replace("_", "").replace(":", "").replace(".", "")
static func _find(n: Node, cls: String) -> Node:
	if n.is_class(cls): return n
	for c in n.get_children():
		var r := _find(c, cls)
		if r: return r
	return null
static func _world_q(sk: Skeleton3D, i: int) -> Quaternion: return (sk.global_basis*sk.get_bone_global_pose(i).basis).get_rotation_quaternion()

## g: the game (its Robin has her fight clips); dst: a character's instance; clips: names of her clips to bake
static func apply(g, dst: Node3D, clips: Array, key: String) -> void:
	var dap: AnimationPlayer = _find(dst, "AnimationPlayer"); var dsk: Skeleton3D = _find(dst, "Skeleton3D")
	if dap == null or dsk == null: return
	var lib: AnimationLibrary
	if _cache.has(key): lib = _cache[key]
	else:
		lib = _bake(g, dst, dap, dsk, clips); _cache[key] = lib
	var own: AnimationLibrary = dap.get_animation_library("")
	for nm in lib.get_animation_list():
		if own.has_animation(nm): own.remove_animation(nm)
		own.add_animation(nm, lib.get_animation(nm))

static func _bake(g, dst: Node3D, dap: AnimationPlayer, dsk: Skeleton3D, clips: Array) -> AnimationLibrary:
	var out := AnimationLibrary.new()
	# her: a copy, out of sight, with her whole library (the alley's clips merged into it)
	var src: Node3D = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate()
	var holder := Node3D.new(); g.add_child(holder); holder.add_child(src); holder.visible = false
	var sap: AnimationPlayer = _find(src, "AnimationPlayer"); var ssk: Skeleton3D = _find(src, "Skeleton3D")
	sap.remove_animation_library(""); sap.add_animation_library("", g.anim.get_animation_library(""))
	# him: a copy too, at the origin
	var dcopy: Node3D = dst.duplicate(); holder.add_child(dcopy); dcopy.transform = Transform3D.IDENTITY
	var dap2: AnimationPlayer = _find(dcopy, "AnimationPlayer"); var dsk2: Skeleton3D = _find(dcopy, "Skeleton3D")
	src.transform = Transform3D.IDENTITY
	# the bones both have, parents first
	var smap := {}
	for i in ssk.get_bone_count(): smap[_plain(ssk.get_bone_name(i))] = i
	var names := []
	for i in dsk2.get_bone_count():
		if smap.has(_plain(dsk2.get_bone_name(i))): names.append(i)
	names.sort_custom(func(a, b): return _depth(dsk2, a) < _depth(dsk2, b))
	if names.is_empty(): holder.queue_free(); return out
	var hips: int = names[0]; var shi: int = smap[_plain(dsk2.get_bone_name(hips))]
	# the references: her idle, his idle, frame 0
	sap.play("idle"); sap.seek(0, true); dap2.play("idle" if dap2.has_animation("idle") else dap2.get_animation_list()[0]); dap2.seek(0, true)
	var sref := {}; var dref := {}
	for d in names: sref[d] = _world_q(ssk, smap[_plain(dsk2.get_bone_name(d))]); dref[d] = _world_q(dsk2, d)
	var s_hip := (ssk.global_transform*ssk.get_bone_global_pose(shi)).origin; var d_hip := (dsk2.global_transform*dsk2.get_bone_global_pose(hips)).origin
	var outer := {}
	for d in names:
		var p := dsk2.get_bone_parent(d)
		if not names.has(p): outer[d] = (dsk2.global_basis*dsk2.get_bone_global_pose(p).basis).get_rotation_quaternion() if p >= 0 else dsk2.global_basis.get_rotation_quaternion()
	var k := d_hip.y/s_hip.y if s_hip.y > 0.01 else 1.0
	var skel_path := String(dap.get_node(dap.root_node).get_path_to(dsk))
	var hip_parent_inv: Transform3D = (dsk2.global_transform*(dsk2.get_bone_global_pose(dsk2.get_bone_parent(hips)) if dsk2.get_bone_parent(hips) >= 0 else Transform3D.IDENTITY)).affine_inverse()
	for nm in clips:
		if not sap.has_animation(nm): continue
		var c: Animation = sap.get_animation(nm)
		var a := Animation.new(); a.length = c.length; a.loop_mode = c.loop_mode
		var tracks := {}
		for d in names:
			var ti := a.add_track(Animation.TYPE_ROTATION_3D); a.track_set_path(ti, NodePath(skel_path + ":" + dsk.get_bone_name(d))); tracks[d] = ti
		var pt := a.add_track(Animation.TYPE_POSITION_3D); a.track_set_path(pt, NodePath(skel_path + ":" + dsk.get_bone_name(hips)))
		sap.play(nm)
		var n := maxi(2, int(ceil(c.length*FPS)) + 1)
		for i in n:
			var t := minf(c.length, i/FPS)
			sap.seek(t, true)
			var W := {}
			for d in names:
				var si: int = smap[_plain(dsk2.get_bone_name(d))]
				W[d] = (_world_q(ssk, si)*(sref[d] as Quaternion).inverse())*dref[d]
			for d in names:
				var p := dsk2.get_bone_parent(d)
				var pq: Quaternion = W[p] if names.has(p) else outer[d]
				a.rotation_track_insert_key(tracks[d], t, (pq.inverse()*W[d]).normalized())
			var hp := ((ssk.global_transform*ssk.get_bone_global_pose(shi)).origin - s_hip)*k + d_hip
			a.position_track_insert_key(pt, t, hip_parent_inv*hp)
		out.add_animation(nm, a)
	holder.queue_free()
	return out
static func _depth(sk: Skeleton3D, i: int) -> int:
	var n := 0
	while sk.get_bone_parent(i) >= 0: i = sk.get_bone_parent(i); n += 1
	return n
