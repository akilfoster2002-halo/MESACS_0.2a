## the bench's boards against the browser's: godot --headless --path koro-godot -s res://tools/puzzle_check.gd
extends SceneTree
func _init() -> void:
	var p := Puzzle.new(null)
	var a := p._route_level(4, 101); var b := p._net_level(5, 264); var c := p._net_level(6, 317)
	print(JSON.stringify({"r": [a.sy, a.ey, a.g, a.sol], "n5": [b.sy, b.ey, b.g], "n6": [c.sy, c.ey, c.g]}))
	p.free(); quit()
