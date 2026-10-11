extends SceneTree
func _init() -> void:
	var n: Node = (load("res://assets/tsh/robin.glb") as PackedScene).instantiate()
	var st: Array = [n]
	while st.size():
		var c: Node = st.pop_back(); st.append_array(c.get_children())
		if String(c.name).begins_with("worn"): print(c.name, " ", c.get_class())
	quit()
