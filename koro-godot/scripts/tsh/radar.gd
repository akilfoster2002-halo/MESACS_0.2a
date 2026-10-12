## THE RADAR (tsh.js radar): a round map in the corner that turns with you, GTA's way — the district (the avenue,
## Market Street, the lanes, every roof, the high ones edged in violet, Dragon Alley in lantern orange, the metro),
## then who is near — WFC in blue (flashing red and blue when they are after you), the drones and their beams, the
## gunship's light — and where you are going: a yellow diamond, or a dot on the rim when it is off the map. Inside
## the flat it says where you are.
class_name Radar
extends Control

const R := 110.0
const Z := 1.35                                  # radar px per metre
const EDGE := Vector2(110, 85)
const LANES := [["z", -52, -44], ["z", 44, 52], ["x", -62, -56], ["x", 56, 62]]
var g
var map: Control
var top: Control

func _init(game) -> void:
	g = game
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW          # the round window: what is drawn here masks the map
	map = Control.new(); map.mouse_filter = Control.MOUSE_FILTER_IGNORE; map.size = Vector2(2*R, 2*R); add_child(map)
	map.draw.connect(_draw_map)
	top = Control.new(); top.mouse_filter = Control.MOUSE_FILTER_IGNORE; top.size = Vector2(2*R, 2*R); top.top_level = false
	top.draw.connect(_draw_top)

func _ready() -> void:
	get_parent().add_child.call_deferred(top)            # the ring and the arrow, over the mask, unclipped

func _process(_dt: float) -> void:
	top.position = position; top.visible = visible
	map.queue_redraw(); top.queue_redraw()

func _draw() -> void:
	draw_circle(Vector2(R, R), R - 2, Color("#050a09"))

func _chasing() -> bool: return g.chase.on and g.chase.heat > 0
func _flash() -> bool: return int(Time.get_ticks_msec()/250.0) % 2 == 0

func _draw_map() -> void:
	if g.inside: return
	var p: Vector3 = g.robin.position
	map.draw_set_transform(Vector2(R, R), g.cam_yaw, Vector2(Z, Z))
	var at := func(x: float, z: float) -> Vector2: return Vector2(x - p.x, z - p.z)
	var box := func(x1: float, x2: float, z1: float, z2: float, c: Color):
		map.draw_rect(Rect2(at.call(x1, z1), Vector2(x2 - x1, z2 - z1)), c)
	box.call(-EDGE.x - 10, EDGE.x + 10, -EDGE.y - 10, EDGE.y + 10, Color("#0a1614"))
	box.call(-EDGE.x, EDGE.x, -10, 10, Color("#2c4a45")); box.call(-10, 10, -EDGE.y, EDGE.y, Color("#2c4a45"))
	for l in LANES:
		if l[0] == "z": box.call(-EDGE.x, EDGE.x, l[1], l[2], Color("#20373a"))
		else: box.call(l[1], l[2], -EDGE.y, EDGE.y, Color("#20373a"))
	for r in g.boots.roofs:
		var high: bool = float(r.top) >= 16
		var rc := Rect2(at.call(r.x1 + 0.5, r.z1 + 0.5), Vector2(r.x2 - r.x1 - 1, r.z2 - r.z1 - 1))
		map.draw_rect(rc, Color("#1c2a3a") if high else Color("#132220"))
		map.draw_rect(rc, Color("#6a5aa8") if high else Color("#23403c"), false, (2.0 if high else 1.0)/Z)
	var a: Dictionary = g.nav.zones.alley
	box.call(a.x1, a.x2, a.z1, a.z2, Color("#ff6a2a"))
	for m in [Vector2(-70, 8), Vector2(46, 50.5)]: map.draw_circle(at.call(m.x, m.y), 2.5, Color(0.23, 0.67, 1.0, 0.5))
	var dot := func(x: float, z: float, c: Color, r := 3.0): map.draw_circle(at.call(x, z), r/Z*0.5, c)
	# the chase: WFC, the drones' beams, the gunship's light
	if g.chase.on:
		var hot := _chasing()
		for d in g.chase.drones:
			var n = d.get("node"); if n == null or not is_instance_valid(n): continue
			var q: Vector3 = (n as Node3D).global_position
			map.draw_circle(at.call(q.x, q.z), 6.0, Color(1, 0.31, 0.24, 0.35) if d.get("state", "") == "track" else Color(0.31, 0.94, 0.86, 0.18))
			dot.call(q.x, q.z, Color("#8ff0ff"), 4.0)
		for c in g.chase.cops:
			dot.call(c.x, c.z, (Color("#ff4a4a") if _flash() else Color("#4a8aff")) if hot else Color("#4a8aff"), 5.0)
		var gs = g.chase.gun
		if gs != null and gs.get("node") != null and is_instance_valid(gs.node):
			var q2: Vector3 = (gs.node as Node3D).global_position
			map.draw_arc(at.call(q2.x, q2.z), 8.0/Z*0.5, 0, TAU, 20, Color("#ff4a4a"), 1.5/Z)
	# where to go
	var mk = g.goal_at()
	if mk != null:
		var c: Vector2 = at.call(mk[0], mk[1]); var s := 1.0/Z
		map.draw_colored_polygon(PackedVector2Array([c + Vector2(0, -9)*s, c + Vector2(7, 0)*s, c + Vector2(0, 9)*s, c + Vector2(-7, 0)*s]), Color("#ffd23d"))

func _draw_top() -> void:
	var ctr := Vector2(R, R)
	if g.inside:
		var f := ThemeDB.fallback_font
		top.draw_string(f, Vector2(0, R + 5), "214 HARBOR LANE", HORIZONTAL_ALIGNMENT_CENTER, 2*R, 13, Color("#8ff0ff"))
	else:
		# the goal off the map: a dot on the rim, the way it lies
		var mk = g.goal_at()
		if mk != null:
			var p: Vector3 = g.robin.position
			var d := Vector2(mk[0] - p.x, mk[1] - p.z)
			if d.length()*Z > R - 10:
				top.draw_circle(ctr + d.normalized().rotated(g.cam_yaw)*(R - 10), 6, Color("#ffd23d"))
		# you: an arrow, always pointing up
		top.draw_colored_polygon(PackedVector2Array([ctr + Vector2(0, -8), ctr + Vector2(6, 6), ctr + Vector2(0, 3), ctr + Vector2(-6, 6)]), Color.WHITE)
	var ring := (Color("#ff4a4a") if _flash() else Color("#4a8aff")) if _chasing() else Color(0.56, 0.94, 0.86, 0.5)
	top.draw_arc(ctr, R - 3, 0, TAU, 64, ring, 4, true)
