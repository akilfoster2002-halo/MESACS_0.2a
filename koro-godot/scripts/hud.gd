## THE HUD: what the keys do right now, what you are standing next to, a
## line when something happens, the character picker (B) and the pause card (P).
class_name Hud
extends CanvasLayer

var world: Node3D
var fps: Label
var prompt: Label
var help: Label
var status: Label
var toast: Label
var toast_t := 0.0
var cockpit: Control
var picker: PanelContainer
var pick_row: HBoxContainer
var pick_i := 0
var paused: PanelContainer
var font_bold: Font

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	cockpit = _cockpit()
	add_child(cockpit)
	fps = _label(14, Color(1, 1, 1, 0.55))
	fps.position = Vector2(14, 10)
	prompt = _label(22, Color.WHITE)
	prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	prompt.offset_left = -300
	prompt.offset_right = 300
	prompt.offset_top = -130
	prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status = _label(16, Color(0.8, 0.95, 1.0))
	status.set_anchors_preset(Control.PRESET_CENTER_TOP)
	status.offset_left = -320
	status.offset_right = 320
	status.offset_top = 14
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast = _label(20, Color(1, 0.95, 0.8))
	toast.set_anchors_preset(Control.PRESET_CENTER_TOP)
	toast.offset_left = -420
	toast.offset_right = 420
	toast.offset_top = 64
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help = _label(14, Color(1, 1, 1, 0.78))
	help.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	help.offset_left = 16
	help.offset_top = -52
	help.offset_right = 1200
	_picker()
	_pause()

func _label(size: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(l)
	return l

func say(text: String, secs := 3.5) -> void:
	toast.text = text
	toast_t = secs
	toast.modulate.a = 1.0

## The picker and the pause card hold the game still, so the keys come here
## first — this node keeps running while everything else is paused.
func _unhandled_input(ev: InputEvent) -> void:
	if paused.visible:
		if ev.is_action_pressed("pause") or ev.is_action_pressed("mouse"):
			toggle_pause()
			get_viewport().set_input_as_handled()
	elif picker.visible:
		if ev is InputEventKey and ev.pressed and not ev.echo and picker_key(ev):
			get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	toast_t -= delta
	toast.modulate.a = clampf(toast_t / 0.6, 0.0, 1.0)

## A simple cockpit frame round the view, for the mecha's first person.
func _cockpit() -> Control:
	var c := Control.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var dark := Color(0.05, 0.07, 0.11, 0.96)
	for spec in [[Control.PRESET_TOP_WIDE, Vector2(0, 70)], [Control.PRESET_BOTTOM_WIDE, Vector2(0, 170)],
			[Control.PRESET_LEFT_WIDE, Vector2(120, 0)], [Control.PRESET_RIGHT_WIDE, Vector2(120, 0)]]:
		var r := ColorRect.new()
		r.color = dark
		r.set_anchors_preset(spec[0])
		r.custom_minimum_size = spec[1]
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		c.add_child(r)
		if spec[0] == Control.PRESET_BOTTOM_WIDE:
			r.offset_top = -170
		if spec[0] == Control.PRESET_RIGHT_WIDE:
			r.offset_left = -120
	var edge := ColorRect.new()
	edge.color = Color(0.37, 0.88, 1.0, 0.8)
	edge.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	edge.offset_top = -172
	edge.offset_bottom = -169
	edge.offset_left = 120
	edge.offset_right = -120
	c.add_child(edge)
	c.visible = false
	return c

func _card() -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.07, 0.14, 0.92)
	sb.border_color = Color(0.56, 0.83, 1.0, 0.5)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	sb.content_margin_left = 26
	sb.content_margin_right = 26
	sb.content_margin_top = 20
	sb.content_margin_bottom = 20
	p.add_theme_stylebox_override("panel", sb)
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.visible = false
	add_child(p)
	return p

# ------------------------------------------------------------ who you are

func _picker() -> void:
	picker = _card()
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	picker.add_child(col)
	var title := Label.new()
	title.text = "WHO ARE YOU TODAY?"
	title.add_theme_font_size_override("font_size", 24)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(title)
	pick_row = HBoxContainer.new()
	pick_row.add_theme_constant_override("separation", 12)
	col.add_child(pick_row)
	for id in Walker.CHARACTERS:
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 230)
		b.toggle_mode = true
		b.focus_mode = Control.FOCUS_NONE
		var v := VBoxContainer.new()
		v.set_anchors_preset(Control.PRESET_FULL_RECT)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var img := TextureRect.new()
		img.texture = load("res://assets/characters/character-%s.png" % id)
		img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		img.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		img.custom_minimum_size = Vector2(140, 190)
		img.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(img)
		var n := Label.new()
		n.text = Walker.CHARACTERS[id]
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.add_theme_font_size_override("font_size", 18)
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(n)
		b.add_child(v)
		b.set_meta("id", id)
		b.pressed.connect(func(): _choose(id))
		pick_row.add_child(b)
	var hint := Label.new()
	hint.text = "A / D to look along the row · E to be them · B to close"
	hint.add_theme_font_size_override("font_size", 14)
	hint.modulate = Color(1, 1, 1, 0.7)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(hint)

func picker_open() -> bool:
	return picker.visible

func toggle_picker() -> void:
	picker.visible = not picker.visible
	if picker.visible:
		var ids := Walker.CHARACTERS.keys()
		pick_i = maxi(0, ids.find(world.player.character))
		_mark()
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	get_tree().paused = picker.visible or paused.visible
	world.ui_open = get_tree().paused

func _mark() -> void:
	for i in pick_row.get_child_count():
		(pick_row.get_child(i) as Button).button_pressed = i == pick_i

func _choose(id: String) -> void:
	world.player.set_character(id)
	say("You are %s now." % Walker.CHARACTERS[id], 2.5)
	toggle_picker()

func picker_key(ev: InputEventKey) -> bool:
	var ids := Walker.CHARACTERS.keys()
	match ev.physical_keycode:
		KEY_A, KEY_LEFT:
			pick_i = posmod(pick_i - 1, ids.size())
			_mark()
		KEY_D, KEY_RIGHT:
			pick_i = posmod(pick_i + 1, ids.size())
			_mark()
		KEY_E, KEY_ENTER, KEY_SPACE:
			_choose(ids[pick_i])
		KEY_B, KEY_ESCAPE:
			toggle_picker()
		_:
			return false
	return true

# ------------------------------------------------------------------ pause

func _pause() -> void:
	paused = _card()
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	paused.add_child(col)
	var title := Label.new()
	title.text = "PAUSED"
	title.add_theme_font_size_override("font_size", 28)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(title)
	var keys := Label.new()
	keys.text = """WASD walk · mouse look · SHIFT run · SPACE jump · scroll zoom
F fly · E ride, climb in, get in · R car / get out · V first person
G dance · 1 2 3 emotes · B who you are · P pause"""
	keys.add_theme_font_size_override("font_size", 15)
	keys.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(keys)
	for spec in [["Resume", func(): toggle_pause()], ["Who you are", func(): toggle_pause(); toggle_picker()],
			["Quit", func(): get_tree().quit()]]:
		var b := Button.new()
		b.text = spec[0]
		b.custom_minimum_size = Vector2(260, 42)
		b.pressed.connect(spec[1])
		col.add_child(b)

func toggle_pause() -> void:
	paused.visible = not paused.visible
	get_tree().paused = paused.visible
	world.ui_open = paused.visible
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if paused.visible else Input.MOUSE_MODE_CAPTURED

func is_paused() -> bool:
	return paused.visible
