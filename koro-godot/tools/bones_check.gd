extends SceneTree
func _init() -> void:
	for f in ["goose", "spider", "trexhead"]:
		var n: Node = (load("res://assets/tsh/monster/%s.glb" % f) as PackedScene).instantiate()
		var st: Array = [n]
		while st.size():
			var c: Node = st.pop_back(); st.append_array(c.get_children())
			if c is Skeleton3D:
				var names := []
				for i in c.get_bone_count(): names.append(c.get_bone_name(i))
				print(f, " ", c.name, " ", names)
			if c is AnimationPlayer: print(f, " anims ", c.get_animation_list())
	quit()
