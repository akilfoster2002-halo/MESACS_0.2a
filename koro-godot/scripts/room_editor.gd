## THE ROOM EDITOR — the owner's, while they have it open (TAB → EDIT ROOM).
##
## THE ROOM OPENS LIKE A DOLL'S HOUSE: a camera over it, the roof and the
## walls in the way lifted off (ChatRoom.cutaway), and the room's owner
## moves things about with the mouse — click a thing to pick it up, drag it
## across the floor, R to turn it, [ and ] to size it, Delete to throw it
## out. On the left the catalogue, by kind; on the right the thing in hand —
## its colour, its words, its picture, and for a robot its PROGRAM, made of
## Koro's own blocks. THE LOOK tab changes the room itself: floor, walls,
## ceiling, lights, sky.
##
## NOTHING IS SAVED UNTIL SAVE. The room here changes as you work, and on
## everybody else's screen it stays as it was; Save sends the lot to the
## server, which washes it (server/chatrooms.js — only real object types,
## inside the walls, colours that are colours, programs of real blocks) and
## tells everybody in the room to fetch it again.
class_name RoomEditor
extends Node

const GOLD := RoomsUI.GOLD
const CYAN := RoomsUI.CYAN
const PINK := RoomsUI.PINK
const MINT := RoomsUI.MINT
const LAV := RoomsUI.LAV
const CREAM := RoomsUI.CREAM
const BG := RoomsUI.BG
## Things that hang on a wall go onto the nearest one, at this height.
const ON_WALL := {"poster": 3.0, "neon_sign": 5.2, "light_switch": 1.4}

## Koro's blocks as the robot knows them: public/blocks.js's words and colours.
const BLOCKS := {
	"event.flag": ["events", "when ▶ the game starts", []],
	"motion.move": ["motion", "move %n steps", [10]],
	"motion.turn": ["motion", "turn %a by %n degrees", ["z", 15]],
	"motion.face": ["motion", "point in direction %n", [90]],
	"ctrl.wait": ["control", "wait %n seconds", [1]],
	"ctrl.repeat": ["control", "repeat %n", [10]],
	"ctrl.forever": ["control", "forever", []],
	"ctrl.end": ["control", "end", []],
	"looks.sayFor": ["looks", "say %s for %n secs", ["Hello!", 2]],
}
const CAT := {"events": Color("ffd8a8"), "control": Color("ffb4a2"), "motion": Color("8fd3ff"), "looks": Color("cdb4f6")}

var world: Node3D
var room: ChatRoom

var cam: Camera3D
var focus := Vector3(0, 0, 1)  # the point on the floor the camera turns about (room space)
var yaw := 0.0
var elev := 0.95
var dist := 19.0
var sel := ""
var dragging := false
var drag_off := Vector3.ZERO
var orbiting := false
var dirty := false
var saving := false
var hi: MeshInstance3D

var ui: CanvasLayer
var top_title: Label
var mode_btns := {}
var mode := "things"
var left: PanelContainer
var left_list: VBoxContainer
var count_l: Label
var cat_btns := {}
var cat_now := "furniture"
var right: PanelContainer
var right_col: VBoxContainer
var bar_help: Label
var save_b: Button
var note: Label
var note_t := 0.0
var confirm: PanelContainer
var prog: PanelContainer
var prog_rows: VBoxContainer
var program: Array = []

func _ready() -> void:
	room.editing = true
	for id in room.nodes:
		if str((room.nodes[id] as Node3D).get_meta("type")) == "robot":
			room._robot_home(id)
	cam = Camera3D.new()
	cam.fov = 55.0
	cam.far = 800.0
	world.add_child(cam)
	cam.make_current()
	hi = MeshInstance3D.new()
	var hm := StandardMaterial3D.new()
	hm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hm.albedo_color = CYAN
	hm.no_depth_test = true
	hi.material_override = hm
	room.add_child(hi)
	_build_ui()
	_select("")
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	world.hud._hold()
	_say("Editing. Nothing changes for anybody else until you SAVE.", 4.0)

func _finish() -> void:
	room.editing = false
	room.cutaway(false)
	room.trial = {}
	for id in room.nodes:
		if str((room.nodes[id] as Node3D).get_meta("type")) == "robot":
			room._robot_home(id)
	hi.queue_free()
	world.player.cam.make_current()
	cam.queue_free()
	world.editor = null
	world.hud._hold()
	queue_free()

# ============================================================ the camera

func _process(delta: float) -> void:
	var typing := ui.get_viewport().gui_get_focus_owner() is LineEdit
	if not typing and prog == null and confirm == null:
		var mv := Vector2.ZERO
		if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
			mv.y -= 1.0
		if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
			mv.y += 1.0
		if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
			mv.x -= 1.0
		if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
			mv.x += 1.0
		if Input.is_physical_key_pressed(KEY_Q):
			yaw += delta * 1.6
		if Input.is_physical_key_pressed(KEY_E):
			yaw -= delta * 1.6
		if mv != Vector2.ZERO:
			var fwd := Vector3(sin(yaw), 0, cos(yaw))
			var rt := Vector3(cos(yaw), 0, -sin(yaw))
			focus += (rt * mv.x + fwd * mv.y) * delta * (6.0 + dist * 0.5)
	focus.x = clampf(focus.x, -room.W / 2.0, room.W / 2.0)
	focus.z = clampf(focus.z, -room.D / 2.0, room.D / 2.0)
	var eye := focus + Vector3(sin(yaw) * cos(elev), sin(elev), cos(yaw) * cos(elev)) * dist
	cam.global_position = room.to_global(eye)
	cam.look_at(room.to_global(focus), Vector3.UP)
	room.cutaway(true, eye)
	_highlight()
	note_t -= delta
	if note:
		note.modulate.a = clampf(note_t / 0.5, 0.0, 1.0)

func _ray(at: Vector2) -> Array:
	return [cam.project_ray_origin(at), cam.project_ray_normal(at)]

## Where the mouse is over the level `y` of the room (room space).
func _on_level(at: Vector2, y: float) -> Variant:
	var r := _ray(at)
	var from: Vector3 = room.to_local(r[0])
	var dir: Vector3 = room.global_transform.basis.inverse() * (r[1] as Vector3)
	return Plane(Vector3.UP, y).intersects_ray(from, dir)

func _unhandled_input(ev: InputEvent) -> void:
	if prog != null or confirm != null:
		return
	if ev is InputEventMouseButton:
		var mb := ev as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			dist = maxf(6.0, dist * 0.9)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			dist = minf(42.0, dist * 1.1)
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			orbiting = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_press(mb.position)
			else:
				dragging = false
		get_viewport().set_input_as_handled()
	elif ev is InputEventMouseMotion:
		var mm := ev as InputEventMouseMotion
		if orbiting:
			yaw -= mm.relative.x * 0.006
			elev = clampf(elev + mm.relative.y * 0.005, 0.3, 1.45)
		elif dragging and sel != "":
			_drag(mm.position)
		get_viewport().set_input_as_handled()
	elif ev is InputEventKey and ev.pressed:
		var k := ev as InputEventKey
		var cmd := k.ctrl_pressed or k.meta_pressed
		match k.physical_keycode:
			KEY_ESCAPE:
				if sel != "":
					_select("")
				else:
					_done()
			KEY_R:
				_turn(-15.0 if k.shift_pressed else 15.0)
			KEY_BRACKETLEFT:
				_resize(-0.1)
			KEY_BRACKETRIGHT:
				_resize(0.1)
			KEY_PAGEUP:
				_lift(0.1)
			KEY_PAGEDOWN:
				_lift(-0.1)
			KEY_DELETE, KEY_BACKSPACE:
				_delete()
			KEY_D:
				if cmd:
					_duplicate()
			KEY_S:
				if cmd:
					_save()
			_:
				return
		get_viewport().set_input_as_handled()

func _press(at: Vector2) -> void:
	var r := _ray(at)
	var id := room.pick(r[0], r[1])
	_select(id)
	if id == "":
		return
	var o := room.record(id)
	var p: Array = o.p
	var hit: Variant = _on_level(at, float(p[1]))
	if hit != null:
		drag_off = Vector3(float(p[0]), 0, float(p[2])) - Vector3((hit as Vector3).x, 0, (hit as Vector3).z)
		dragging = true

func _drag(at: Vector2) -> void:
	var o := room.record(sel)
	if o.is_empty():
		return
	var p: Array = o.p
	var hit: Variant = _on_level(at, float(p[1]))
	if hit == null:
		return
	var to: Vector3 = (hit as Vector3) + drag_off
	if not Input.is_physical_key_pressed(KEY_SHIFT):
		to.x = snappedf(to.x, 0.25)
		to.z = snappedf(to.z, 0.25)
	room.move_object(sel, Vector3(to.x, float(p[1]), to.z), float(o.r), float(o.s))
	_changed()

# ============================================================ the verbs

func _changed() -> void:
	dirty = true
	if save_b:
		save_b.disabled = false
		save_b.text = "SAVE  ·  ⌘S"
	if count_l:
		count_l.text = "%d of %d things" % [room.objects.size(), _limit()]

func _limit() -> int:
	return int(ChatRoom.catalog().get("limits", {}).get("objects", 150))

func _add(type: String) -> void:
	if room.objects.size() >= _limit():
		_say("That is as full as a room gets — %d things." % _limit())
		return
	var at := focus
	var r := 0.0
	if ON_WALL.has(type):
		# onto the nearest wall, facing into the room
		var hx := room.W / 2.0
		var hz := room.D / 2.0
		var gaps := [[hz + focus.z, Vector3(focus.x, 0, -hz + 0.12), 0.0], [hz - focus.z, Vector3(focus.x, 0, hz - 0.12), 180.0],
			[hx + focus.x, Vector3(-hx + 0.12, 0, focus.z), 90.0], [hx - focus.x, Vector3(hx - 0.12, 0, focus.z), -90.0]]
		gaps.sort_custom(func(a, b): return a[0] < b[0])
		at = gaps[0][1]
		at.y = ON_WALL[type]
		r = gaps[0][2]
	else:
		# facing whoever is looking, which is usually what is wanted
		r = snappedf(rad_to_deg(yaw), 15.0)
	var id := room.add_object(type, at, r)
	_select(id)
	_changed()

func _turn(by: float) -> void:
	var o := room.record(sel)
	if o.is_empty():
		return
	room.move_object(sel, _pos(o), float(o.r) + by, float(o.s))
	_changed()
	_inspect()

func _resize(by: float) -> void:
	var o := room.record(sel)
	if o.is_empty():
		return
	room.move_object(sel, _pos(o), float(o.r), snappedf(float(o.s) + by, 0.1))
	_changed()
	_inspect()

func _lift(by: float) -> void:
	var o := room.record(sel)
	if o.is_empty():
		return
	var p := _pos(o)
	p.y = snappedf(p.y + by, 0.05)
	room.move_object(sel, p, float(o.r), float(o.s))
	_changed()
	_inspect()

func _delete() -> void:
	if sel == "":
		return
	room.remove_object(sel)
	_select("")
	_changed()

func _duplicate() -> void:
	if sel == "":
		return
	if room.objects.size() >= _limit():
		_say("That is as full as a room gets — %d things." % _limit())
		return
	var id := room.duplicate_object(sel)
	_select(id)
	_changed()

## Words typed into a sign or a TV, kept when you are done typing.
func _words_left(t: String) -> void:
	var props: Dictionary = room.record(sel).get("props", {})
	if str(props.get("text", "")) != t:
		_prop("text", t)

func _prop(key: String, value: Variant) -> void:
	room.set_prop(sel, key, value)
	_changed()

static func _pos(o: Dictionary) -> Vector3:
	var p: Array = o.get("p", [0, 0, 0])
	return Vector3(float(p[0]), float(p[1]), float(p[2]))

func _select(id: String) -> void:
	sel = id
	_inspect()

## The box round the thing in hand, drawn through everything.
func _highlight() -> void:
	if sel == "" or not room.nodes.has(sel):
		hi.visible = false
		return
	var h: Node3D = room.nodes[sel]
	var b: AABB = h.get_meta("box")
	var im: ImmediateMesh = hi.mesh if hi.mesh is ImmediateMesh else ImmediateMesh.new()
	hi.mesh = im
	im.clear_surfaces()
	im.surface_begin(Mesh.PRIMITIVE_LINES)
	var lo := b.position - Vector3.ONE * 0.04
	var up := b.end + Vector3.ONE * 0.04
	var c := [Vector3(lo.x, lo.y, lo.z), Vector3(up.x, lo.y, lo.z), Vector3(up.x, lo.y, up.z), Vector3(lo.x, lo.y, up.z),
		Vector3(lo.x, up.y, lo.z), Vector3(up.x, up.y, lo.z), Vector3(up.x, up.y, up.z), Vector3(lo.x, up.y, up.z)]
	for e in [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]:
		im.surface_add_vertex(c[e[0]])
		im.surface_add_vertex(c[e[1]])
	# and a line to the floor for anything hung up high
	im.surface_add_vertex(Vector3(0, lo.y, 0))
	im.surface_add_vertex(Vector3(0, -h.position.y, 0))
	im.surface_end()
	hi.transform = h.transform
	hi.visible = true

# ============================================================ saving

func _save() -> void:
	if saving or not dirty:
		return
	saving = true
	save_b.disabled = true
	save_b.text = "SAVING…"
	var snap := room.snapshot()
	var j: Dictionary = await world.net.room_save(int(room.room.get("id", 0)), snap.env, snap.objects)
	saving = false
	if not is_instance_valid(room):
		return
	if not j.ok:
		save_b.disabled = false
		save_b.text = "SAVE  ·  ⌘S"
		_say(str(j.error), 5.0)
		return
	# the room as the server kept it — which is what everybody else now sees
	var keep := sel
	Worlds.room = j.room
	room.reload(j.room)
	dirty = false
	save_b.text = "SAVED"
	_select(keep if room.nodes.has(keep) else "")
	_say("Saved — everybody in the room has it now.", 3.0)

func _revert() -> void:
	room.reload(room.room)
	dirty = false
	save_b.disabled = true
	save_b.text = "SAVED"
	_select("")
	_rebuild_look()
	_say("Back to how it was saved.", 2.5)

func _done() -> void:
	if not dirty:
		_finish()
		return
	confirm = RoomsUI.tile(GOLD, 0.05)
	confirm.set_anchors_preset(Control.PRESET_CENTER)
	confirm.grow_horizontal = Control.GROW_DIRECTION_BOTH
	confirm.grow_vertical = Control.GROW_DIRECTION_BOTH
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	confirm.add_child(col)
	col.add_child(RoomsUI._text("SAVE YOUR CHANGES?", 24, CREAM))
	col.add_child(RoomsUI._text("Nobody else sees them until you do.", 15, Color(1, 1, 1, 0.7)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	col.add_child(row)
	var yes := RoomsUI.pill("SAVE AND FINISH", GOLD, 17)
	yes.pressed.connect(func():
		_close_confirm()
		await _save()
		if not dirty:
			_finish())
	row.add_child(yes)
	var no := RoomsUI.pill("THROW THEM AWAY", PINK, 17)
	no.pressed.connect(func():
		_close_confirm()
		room.reload(room.room)
		_finish())
	row.add_child(no)
	var stay := RoomsUI.pill("KEEP EDITING", CYAN, 17)
	stay.pressed.connect(func(): _close_confirm())
	row.add_child(stay)
	ui.add_child(confirm)

func _close_confirm() -> void:
	if confirm:
		confirm.queue_free()
		confirm = null

func _say(s: String, secs := 3.0) -> void:
	if note:
		note.text = s
		note_t = secs

# ============================================================ the panels

func _panel(c: Color) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = BG
	sb.border_color = Color(c, 0.5)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	for side in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + side, 14)
	p.add_theme_stylebox_override("panel", sb)
	return p

func _build_ui() -> void:
	ui = CanvasLayer.new()
	ui.layer = 6
	add_child(ui)
	# along the top: what you are editing, and THINGS or THE LOOK
	var top := _panel(GOLD)
	top.set_anchors_preset(Control.PRESET_CENTER_TOP)
	top.grow_horizontal = Control.GROW_DIRECTION_BOTH
	top.offset_top = 10
	ui.add_child(top)
	var tr := HBoxContainer.new()
	tr.add_theme_constant_override("separation", 12)
	top.add_child(tr)
	top_title = RoomsUI._text("EDITING  %s" % str(room.room.get("name", "")).to_upper(), 20, CREAM)
	tr.add_child(top_title)
	for m in [["things", "THINGS"], ["look", "THE LOOK"]]:
		var b := RoomsUI.pill(m[1], CYAN, 15)
		b.toggle_mode = true
		var key: String = m[0]
		b.pressed.connect(func(): _mode(key))
		tr.add_child(b)
		mode_btns[key] = b
	# the catalogue, down the left
	left = _panel(CYAN)
	left.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	left.offset_left = 12
	left.offset_right = 262
	left.offset_top = 76
	left.offset_bottom = -96
	ui.add_child(left)
	var lc := VBoxContainer.new()
	lc.add_theme_constant_override("separation", 8)
	left.add_child(lc)
	lc.add_child(RoomsUI._text("ADD", 16, GOLD))
	var cats := HBoxContainer.new()
	cats.add_theme_constant_override("separation", 4)
	lc.add_child(cats)
	for c in [["furniture", "SIT"], ["decor", "DECOR"], ["interactive", "DO"]]:
		var b := RoomsUI.pill(c[1], {"furniture": CREAM, "decor": MINT, "interactive": PINK}[c[0]], 13)
		b.toggle_mode = true
		var key: String = c[0]
		b.pressed.connect(func(): _cat(key))
		cats.add_child(b)
		cat_btns[key] = b
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	lc.add_child(sc)
	left_list = VBoxContainer.new()
	left_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_list.add_theme_constant_override("separation", 6)
	sc.add_child(left_list)
	count_l = RoomsUI._text("", 13, Color(1, 1, 1, 0.6))
	lc.add_child(count_l)
	# the thing in hand, or the room's look, down the right
	right = _panel(GOLD)
	right.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	right.offset_left = -352
	right.offset_right = -12
	right.offset_top = 76
	right.offset_bottom = -96
	ui.add_child(right)
	var rs := ScrollContainer.new()
	rs.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(rs)
	right_col = VBoxContainer.new()
	right_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right_col.add_theme_constant_override("separation", 10)
	rs.add_child(right_col)
	# along the bottom: how, and SAVE
	var bar := _panel(GOLD)
	bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bar.offset_left = 12
	bar.offset_right = -12
	bar.offset_top = -84
	bar.offset_bottom = -12
	ui.add_child(bar)
	var br := HBoxContainer.new()
	br.add_theme_constant_override("separation", 10)
	bar.add_child(br)
	var hv := VBoxContainer.new()
	hv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hv.add_theme_constant_override("separation", 2)
	br.add_child(hv)
	bar_help = RoomsUI._text("Click a thing to pick it up · drag to move (SHIFT: no grid) · R turn · [ ] size · PgUp PgDn height · DEL throw out · ⌘D copy\nWASD move the view · Q E turn it · right-drag to swing round · wheel to zoom", 13, Color(1, 1, 1, 0.75))
	hv.add_child(bar_help)
	note = RoomsUI._text("", 15, CREAM)
	hv.add_child(note)
	var undo := RoomsUI.pill("UNDO ALL", LAV, 15)
	undo.pressed.connect(func(): _revert())
	br.add_child(undo)
	save_b = RoomsUI.pill("SAVED", GOLD, 18)
	save_b.disabled = true
	save_b.custom_minimum_size = Vector2(170, 0)
	save_b.pressed.connect(func(): _save())
	br.add_child(save_b)
	var done := RoomsUI.pill("DONE", CYAN, 18)
	done.pressed.connect(func(): _done())
	br.add_child(done)
	_mode("things")
	_cat("furniture")
	count_l.text = "%d of %d things" % [room.objects.size(), _limit()]

func _mode(m: String) -> void:
	mode = m
	for k in mode_btns:
		(mode_btns[k] as Button).button_pressed = k == m
	left.visible = m == "things"
	if m == "look":
		_select("")
		_rebuild_look()
	else:
		_inspect()

func _cat(c: String) -> void:
	cat_now = c
	for k in cat_btns:
		(cat_btns[k] as Button).button_pressed = k == c
	for x in left_list.get_children():
		x.queue_free()
	var objs: Dictionary = ChatRoom.catalog().get("objects", {})
	for type in objs:
		var sp: Dictionary = objs[type]
		if str(sp.get("cat", "")) != c:
			continue
		var b := RoomsUI.pill("+  " + str(sp.get("name", type)), {"furniture": CREAM, "decor": MINT, "interactive": PINK}[c], 15)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var t: String = type
		b.pressed.connect(func(): _add(t))
		left_list.add_child(b)

func _clear_right() -> void:
	for x in right_col.get_children():
		x.queue_free()

func _head(s: String, c := GOLD) -> void:
	right_col.add_child(RoomsUI._text(s, 14, c))

## The colours a thing (or a floor, a wall) can be: the catalogue's palette.
func _swatches(now: String, pick: Callable) -> void:
	var grid := GridContainer.new()
	grid.columns = 10
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	for hex in ChatRoom.catalog().get("env", {}).get("palette", []):
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(26, 26)
		var c := Color(str(hex))
		for st in ["normal", "hover", "pressed"]:
			var sb := StyleBoxFlat.new()
			sb.bg_color = c
			sb.set_corner_radius_all(13)
			var on := str(hex).to_lower() == now.to_lower()
			sb.border_color = Color.WHITE if on or st == "hover" else Color(1, 1, 1, 0.15)
			sb.set_border_width_all(3 if on else 1)
			b.add_theme_stylebox_override(st, sb)
		var h: String = hex
		b.pressed.connect(func(): pick.call(h))
		grid.add_child(b)
	right_col.add_child(grid)

func _choice(options: Array, now: String, c: Color, pick: Callable, labels := {}) -> void:
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 6)
	flow.add_theme_constant_override("v_separation", 6)
	for o in options:
		var b := RoomsUI.pill(str(labels.get(o, str(o).to_upper())), c, 13)
		b.toggle_mode = true
		b.button_pressed = str(o) == now
		var v: Variant = o
		b.pressed.connect(func(): pick.call(v))
		flow.add_child(b)
	right_col.add_child(flow)

# ------------------------------------------------------------ the thing in hand

func _inspect() -> void:
	if right_col == null or mode != "things":
		return
	_clear_right()
	var o := room.record(sel)
	if o.is_empty():
		right_col.add_child(RoomsUI._text("NOTHING IN HAND", 18, CREAM))
		var t := RoomsUI._text("Click something in the room to pick it up, or add something from the left — it appears where the view is pointing.\n\nTHE LOOK (at the top) changes the floor, the walls, the light and the sky.", 14, Color(1, 1, 1, 0.7))
		t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		t.custom_minimum_size = Vector2(300, 0)
		right_col.add_child(t)
		return
	var type := str(o.type)
	var sp := ChatRoom.spec(type)
	right_col.add_child(RoomsUI._text(str(sp.get("name", type)).to_upper(), 22, CREAM))
	var kind := {"furniture": "FURNITURE", "decor": "DECOR", "interactive": "DOES SOMETHING — E to use it"}
	right_col.add_child(RoomsUI._text(str(kind.get(str(sp.get("cat", "")), "")), 12, Color(1, 1, 1, 0.55)))
	_head("PLACE")
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	right_col.add_child(row)
	for spec in [["⟲ TURN", func(): _turn(15.0)], ["⟳", func(): _turn(-15.0)], ["SMALLER", func(): _resize(-0.1)], ["BIGGER", func(): _resize(0.1)]]:
		var b := RoomsUI.pill(spec[0], CYAN, 13)
		b.pressed.connect(spec[1])
		row.add_child(b)
	var row2 := HBoxContainer.new()
	row2.add_theme_constant_override("separation", 6)
	right_col.add_child(row2)
	for spec in [["LOWER", func(): _lift(-0.25)], ["HIGHER", func(): _lift(0.25)]]:
		var b := RoomsUI.pill(spec[0], CYAN, 13)
		b.pressed.connect(spec[1])
		row2.add_child(b)
	right_col.add_child(RoomsUI._text("turned %d°  ·  size %.1f  ·  %.2f m up" % [int(o.r), float(o.s), _pos(o).y], 13, Color(1, 1, 1, 0.6)))
	var props: Dictionary = o.get("props", {}) if o.get("props") is Dictionary else {}
	if props.has("color"):
		_head("COLOUR")
		_swatches(str(props.color), func(h): _prop("color", h); _inspect())
	if props.has("text"):
		_head("WORDS")
		var e := RoomsUI.field("what it says", int(ChatRoom.catalog().get("limits", {}).get("text", 60)))
		e.text = str(props.text)
		e.text_submitted.connect(func(_t): e.release_focus())
		e.focus_exited.connect(func(): _words_left(e.text))
		right_col.add_child(e)
	if props.has("art"):
		_head("PICTURE")
		var arts := HBoxContainer.new()
		arts.add_theme_constant_override("separation", 6)
		right_col.add_child(arts)
		for i in [1, 2, 3]:
			var b := Button.new()
			b.focus_mode = Control.FOCUS_NONE
			b.custom_minimum_size = Vector2(90, 130)
			b.toggle_mode = true
			b.button_pressed = int(props.art) == i
			var path := "res://assets/shop/poster%d.jpg" % i
			if ResourceLoader.exists(path):
				b.icon = load(path)
				b.expand_icon = true
			var n: int = i
			b.pressed.connect(func(): _prop("art", n); _inspect())
			arts.add_child(b)
	if props.has("who"):
		_head("WHO")
		_choice(Walker.CHARACTERS.keys(), str(props.who), MINT, func(v): _prop("who", v); _inspect(), Walker.CHARACTERS)
	if props.has("to"):
		_head("GOES TO")
		var e := RoomsUI.field("a room number — empty is back to KORO", 10)
		e.text = str(props.to)
		var keep := func(t): _prop("to", str(t).strip_edges().left(10) if str(t).strip_edges().is_valid_int() else "")
		e.text_submitted.connect(func(t): keep.call(t); e.release_focus())
		e.focus_exited.connect(func(): keep.call(e.text))
		right_col.add_child(e)
		var hint := RoomsUI._text("Every room's number is in its ROOM INFO. Empty: this portal is the way out.", 12, Color(1, 1, 1, 0.55))
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hint.custom_minimum_size = Vector2(300, 0)
		right_col.add_child(hint)
	if props.has("program"):
		_head("PROGRAM")
		var steps: Array = props.program
		right_col.add_child(RoomsUI._text("%d blocks — it runs when somebody presses E by it." % steps.size(), 13, Color(1, 1, 1, 0.65)))
		var b := RoomsUI.pill("EDIT THE PROGRAM", GOLD, 16)
		b.pressed.connect(func(): _program_open())
		right_col.add_child(b)
	_head("")
	var row3 := HBoxContainer.new()
	row3.add_theme_constant_override("separation", 6)
	right_col.add_child(row3)
	var dup := RoomsUI.pill("COPY", LAV, 14)
	dup.pressed.connect(func(): _duplicate())
	row3.add_child(dup)
	var del := RoomsUI.pill("THROW OUT", PINK, 14)
	del.pressed.connect(func(): _delete())
	row3.add_child(del)

# ------------------------------------------------------------ the look

func _set_env(k: String, v: Variant) -> void:
	var e := room.env.duplicate(true)
	e[k] = v
	room.set_env(e)
	_changed()
	_rebuild_look()

func _rebuild_look() -> void:
	if right_col == null or mode != "look":
		return
	_clear_right()
	var E: Dictionary = ChatRoom.catalog().get("env", {})
	var env := room.env
	right_col.add_child(RoomsUI._text("THE LOOK", 22, CREAM))
	_head("FLOOR")
	_choice(E.get("floor", []), str(env.get("floor", "")), CREAM, func(v): _set_env("floor", v))
	_swatches(str(env.get("floorColor", "")), func(h): _set_env("floorColor", h))
	_head("WALLS")
	_choice(E.get("walls", []), str(env.get("walls", "")), CREAM, func(v): _set_env("walls", v))
	_swatches(str(env.get("wallColor", "")), func(h): _set_env("wallColor", h))
	_head("CEILING")
	_choice([true, false], str(bool(env.get("ceiling", true))), CREAM, func(v): _set_env("ceiling", v), {true: "ON", false: "OPEN TO THE SKY"})
	if bool(env.get("ceiling", true)):
		_swatches(str(env.get("ceilingColor", "")), func(h): _set_env("ceilingColor", h))
	_head("LIGHTS")
	_choice(E.get("light", []), str(env.get("light", "")), GOLD, func(v): _set_env("light", v))
	_swatches(str(env.get("lightColor", "")), func(h): _set_env("lightColor", h))
	var sl := HSlider.new()
	sl.min_value = 0.2
	sl.max_value = 2.0
	sl.step = 0.1
	sl.value = float(env.get("brightness", 1.0))
	sl.custom_minimum_size = Vector2(300, 24)
	sl.drag_ended.connect(func(_c): _set_env("brightness", sl.value))
	right_col.add_child(RoomsUI._text("brightness", 12, Color(1, 1, 1, 0.6)))
	right_col.add_child(sl)
	_head("SKY")
	_choice(E.get("sky", []), str(env.get("sky", "")), LAV, func(v): _set_env("sky", v),
		{"wano": "WANO'S NIGHT", "void": "NOTHING"})
	var t := RoomsUI._text("The sky shows through glass walls, no walls, or with the ceiling open.", 12, Color(1, 1, 1, 0.55))
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.custom_minimum_size = Vector2(300, 0)
	right_col.add_child(t)

# ============================================================ the program

## THE ROBOT'S PROGRAM, in Koro's blocks: a script down the left, one block
## to a line, each the colour of its kind and indented inside a repeat; the
## blocks to add down the right. TEST RUN plays it here, on your screen
## only; it is the robot's once you SAVE.
func _program_open() -> void:
	var o := room.record(sel)
	if o.is_empty():
		return
	program = ((o.get("props", {}) as Dictionary).get("program", []) as Array).duplicate(true)
	prog = _panel(GOLD)
	prog.set_anchors_preset(Control.PRESET_CENTER)
	prog.grow_horizontal = Control.GROW_DIRECTION_BOTH
	prog.grow_vertical = Control.GROW_DIRECTION_BOTH
	prog.custom_minimum_size = Vector2(940, 600)
	ui.add_child(prog)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	prog.add_child(col)
	col.add_child(RoomsUI._text("THE ROBOT'S PROGRAM", 24, CREAM))
	col.add_child(RoomsUI._text("Koro's blocks. It starts at  when ▶ the game starts  and runs down. 10 steps is a metre; turn z by 90 is a quarter turn to its right.", 14, Color(1, 1, 1, 0.7)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(row)
	var sc := ScrollContainer.new()
	sc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	row.add_child(sc)
	prog_rows = VBoxContainer.new()
	prog_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	prog_rows.add_theme_constant_override("separation", 4)
	sc.add_child(prog_rows)
	var pal := VBoxContainer.new()
	pal.add_theme_constant_override("separation", 6)
	pal.custom_minimum_size = Vector2(290, 0)
	row.add_child(pal)
	pal.add_child(RoomsUI._text("ADD A BLOCK", 14, GOLD))
	for op in BLOCKS:
		var def: Array = BLOCKS[op]
		var b := RoomsUI.pill(_words(op, def[2]), CAT[def[0]], 14)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var k: String = op
		b.pressed.connect(func():
			if program.size() >= 40:
				return
			var step := [k]
			step.append_array((BLOCKS[k][2] as Array).duplicate())
			program.append(step)
			_program_changed(true))
		pal.add_child(b)
	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 10)
	col.add_child(bottom)
	var test := RoomsUI.pill("▶  TEST RUN", MINT, 17)
	test.pressed.connect(func(): room.try_program(sel, program))
	bottom.add_child(test)
	var clear := RoomsUI.pill("CLEAR", PINK, 15)
	clear.pressed.connect(func():
		program = [["event.flag"]]
		_program_changed(true))
	bottom.add_child(clear)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom.add_child(sp)
	var done := RoomsUI.pill("DONE", GOLD, 17)
	done.pressed.connect(func():
		prog.queue_free()
		prog = null
		_inspect())
	bottom.add_child(done)
	_program_rows()

static func _words(op: String, args: Array) -> String:
	var def: Array = BLOCKS[op]
	var s: String = def[1]
	var i := 0
	var out := ""
	var k := 0
	while k < s.length():
		if s[k] == "%" and k + 1 < s.length():
			out += "(%s)" % str(args[i]) if i < args.size() else "( )"
			i += 1
			k += 2
		else:
			out += s[k]
			k += 1
	return out

func _program_changed(rows: bool) -> void:
	_prop("program", program.duplicate(true))
	if rows:
		_program_rows()

func _program_rows() -> void:
	for x in prog_rows.get_children():
		x.queue_free()
	var depth := 0
	for i in program.size():
		var step: Array = program[i]
		var op := str(step[0])
		if not BLOCKS.has(op):
			continue
		if op == "ctrl.end":
			depth = maxi(0, depth - 1)
		prog_rows.add_child(_block_row(i, step, depth))
		if op == "ctrl.repeat" or op == "ctrl.forever":
			depth += 1
	if program.is_empty():
		prog_rows.add_child(RoomsUI._text("Empty — add  when ▶ the game starts  first.", 15, CREAM))

## One block, as a line: its words, with boxes for its numbers and words
## in their places, then up, down and out.
func _block_row(i: int, step: Array, depth: int) -> Control:
	var op := str(step[0])
	var def: Array = BLOCKS[op]
	var c: Color = CAT[def[0]]
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(28 * depth, 0)
	row.add_child(pad)
	var blk := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = c
	sb.set_corner_radius_all(9)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 5
	sb.content_margin_bottom = 5
	blk.add_theme_stylebox_override("panel", sb)
	blk.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(blk)
	var words := HBoxContainer.new()
	words.add_theme_constant_override("separation", 6)
	blk.add_child(words)
	var parts := str(def[1]).split(" ")
	var arg := 0
	for part in parts:
		if part.begins_with("%"):
			var slot := arg + 1
			arg += 1
			while step.size() <= slot:
				step.append((def[2] as Array)[slot - 1] if slot - 1 < (def[2] as Array).size() else 0)
			if part == "%a":
				var ob := OptionButton.new()
				for ax in ["x", "y", "z"]:
					ob.add_item(ax)
				ob.selected = maxi(0, ["x", "y", "z"].find(str(step[slot])))
				ob.focus_mode = Control.FOCUS_NONE
				ob.item_selected.connect(func(idx): step[slot] = ["x", "y", "z"][idx]; _program_changed(false))
				words.add_child(ob)
			else:
				var e := LineEdit.new()
				e.text = str(step[slot]) if part == "%s" else _num(step[slot])
				e.custom_minimum_size = Vector2(110 if part == "%s" else 62, 0)
				e.max_length = 40 if part == "%s" else 7
				e.alignment = HORIZONTAL_ALIGNMENT_CENTER
				var num := part == "%n"
				e.text_changed.connect(func(t):
					if num:
						if t.is_valid_float():
							step[slot] = clampf(t.to_float(), -1000.0, 1000.0)
							_program_changed(false)
					else:
						step[slot] = t
						_program_changed(false))
				words.add_child(e)
		else:
			var l := RoomsUI._text(part, 16, Color("16161d"))
			words.add_child(l)
	for spec in [["↑", -1], ["↓", 1]]:
		var b := RoomsUI.pill(spec[0], Color(1, 1, 1, 0.7), 13)
		var by: int = spec[1]
		b.pressed.connect(func():
			var j := i + by
			if j < 0 or j >= program.size():
				return
			var tmp: Variant = program[i]
			program[i] = program[j]
			program[j] = tmp
			_program_changed(true))
		row.add_child(b)
	var x := RoomsUI.pill("✕", PINK, 13)
	x.pressed.connect(func():
		program.remove_at(i)
		_program_changed(true))
	row.add_child(x)
	return row

static func _num(v: Variant) -> String:
	var f := float(v)
	return str(int(f)) if is_equal_approx(f, roundf(f)) else str(snappedf(f, 0.01))
