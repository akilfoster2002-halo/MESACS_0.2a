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
var book: PanelContainer
var book_find: LineEdit
var book_text: RichTextLabel
var ideas: Array = []
var ada_next := 0
var account: Account
var phone: Phone
var who: PanelContainer
var who_text: RichTextLabel
var me_label: Label
var feed: Label
var feed_lines: Array[String] = []
var feed_t := 0.0
var unread_t := 3.0
var unread := 0

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
	_book()
	_net_cards()

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
	var esc: bool = ev.is_action_pressed("mouse") or (ev is InputEventKey and ev.pressed and ev.physical_keycode == KEY_ESCAPE)
	if account.visible or phone.visible or who.visible:
		if esc or (who.visible and ev.is_action_pressed("who")):
			account.visible = false
			phone.visible = false
			who.visible = false
			_hold()
			get_viewport().set_input_as_handled()
		return
	if book.visible:
		if ev.is_action_pressed("mouse") or (ev is InputEventKey and ev.pressed and ev.physical_keycode == KEY_ESCAPE):
			library_close()
			get_viewport().set_input_as_handled()
	elif paused.visible:
		if ev.is_action_pressed("pause") or ev.is_action_pressed("mouse"):
			toggle_pause()
			get_viewport().set_input_as_handled()
	elif picker.visible:
		if ev is InputEventKey and ev.pressed and not ev.echo and picker_key(ev):
			get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	toast_t -= delta
	toast.modulate.a = clampf(toast_t / 0.6, 0.0, 1.0)
	feed_t -= delta
	feed.modulate.a = clampf(feed_t / 1.5, 0.0, 1.0)
	var net: Net = world.net
	var status := "Guest — P → Your account to sign in"
	if net.signed_in():
		var room_name: String = Net.ROOMS.filter(func(r): return r[0] == net.room)[0][1] if net.room != "" else "?"
		status = "%s · %s" % [net.me.get("display", "?"), room_name]
		status += (" · %d here" % (world.others.count() + 1)) if net.live else " · no live room"
		unread_t -= delta
		if unread_t <= 0.0:
			unread_t = 12.0
			_check_unread()
	if unread > 0:
		status += "   ·   %d new text%s — T" % [unread, "" if unread == 1 else "s"]
	me_label.text = status

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
	p.grow_horizontal = Control.GROW_DIRECTION_BOTH
	p.grow_vertical = Control.GROW_DIRECTION_BOTH
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
	_hold()

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
G dance · 1 2 3 emotes · B who you are · T phone · O who is here · P pause"""
	keys.add_theme_font_size_override("font_size", 15)
	keys.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(keys)
	for spec in [["Resume", func(): toggle_pause()], ["Who you are", func(): toggle_pause(); toggle_picker()],
			["Your account", func(): toggle_pause(); account_open()],
			["Quit", func(): get_tree().quit()]]:
		var b := Button.new()
		b.text = spec[0]
		b.custom_minimum_size = Vector2(260, 42)
		b.pressed.connect(spec[1])
		col.add_child(b)

func toggle_pause() -> void:
	paused.visible = not paused.visible
	_hold()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if paused.visible else Input.MOUSE_MODE_CAPTURED

func is_paused() -> bool:
	return paused.visible

## Any card up holds the world still and frees the mouse; none, and it is yours.
## The phone, the account and the roster do NOT hold the world still: you
## are in a room with other people, and it goes on without you.
func _hold() -> void:
	var still := picker.visible or paused.visible or book.visible
	var up: bool = still or account.visible or phone.visible or who.visible
	get_tree().paused = still
	world.ui_open = up
	Ctl.blocked = up
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if up else Input.MOUSE_MODE_CAPTURED

func any_open() -> bool:
	return picker.visible or paused.visible or book.visible or account.visible or phone.visible or who.visible

# ---------------------------------------------------------- the network

func _net_cards() -> void:
	var net: Net = world.net
	account = Account.new().build(net, self)
	_style(account)
	phone = Phone.new().build(net, self)
	_style(phone)
	who = _card()
	who.custom_minimum_size = Vector2(420, 360)
	var col := VBoxContainer.new()
	who.add_child(col)
	var title := Label.new()
	title.text = "WHO IS HERE"
	title.add_theme_font_size_override("font_size", 24)
	col.add_child(title)
	who_text = RichTextLabel.new()
	who_text.bbcode_enabled = true
	who_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	who_text.custom_minimum_size = Vector2(0, 280)
	col.add_child(who_text)
	me_label = _label(15, Color(0.85, 1.0, 0.92))
	me_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	me_label.offset_left = -560
	me_label.offset_right = -16
	me_label.offset_top = 10
	me_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	feed = _label(16, Color(1, 1, 1))
	feed.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	feed.offset_left = 16
	feed.offset_top = -210
	feed.offset_right = 800
	feed.offset_bottom = -60
	feed.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	net.said.connect(_feed)
	net.buzz.connect(func(m):
		unread += 1
		say("Text from %s: %s" % [m.get("display", "?"), m.get("text", "")], 4.0))

func _style(p: PanelContainer) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.07, 0.14, 0.94)
	sb.border_color = Color(0.56, 0.83, 1.0, 0.5)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	for side in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + side, 22)
	p.add_theme_stylebox_override("panel", sb)
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.grow_horizontal = Control.GROW_DIRECTION_BOTH
	p.grow_vertical = Control.GROW_DIRECTION_BOTH
	p.visible = false
	add_child(p)

## The room, in a line or two at the bottom of the screen, for a few seconds:
## you should not have to open the phone to find out somebody said hello.
func _feed(line: Dictionary) -> void:
	if line.get("old", false):
		return
	var s: String = str(line.sys) if line.has("sys") else "%s: %s" % [line.from, line.text]
	feed_lines.append(s)
	while feed_lines.size() > 5:
		feed_lines.pop_front()
	feed.text = "\n".join(feed_lines)
	feed_t = 10.0

func _check_unread() -> void:
	var j: Dictionary = await world.net.unread()
	if j.get("ok", false):
		unread = int(j.get("count", 0))

func account_open() -> void:
	account.visible = true
	_hold()

func account_close() -> void:
	account.visible = false
	_hold()

func phone_open() -> void:
	phone.visible = true
	phone.opened()
	unread = 0
	_hold()

func phone_close() -> void:
	phone.visible = false
	_hold()

func who_toggle() -> void:
	who.visible = not who.visible
	if who.visible:
		var net: Net = world.net
		var out := "[b]%s[/b]  (you)\n" % (net.me.get("display", "you") if net.signed_in() else "you")
		for p in net.roster:
			out += "%s%s\n" % [p.get("display", "?"), "" if str(p.get("at", "")) == "hub" else "  — elsewhere"]
		if not net.signed_in():
			out += "\n[color=#ffe9a8]Sign in (P → Your account) to see your class.[/color]"
		elif not net.live:
			out += "\n[color=#ffe9a8]No live room on this server right now.[/color]"
		who_text.text = out
	_hold()

# ---------------------------------------------------------------- the book

## THE LIBRARY: every idea in the language, one line of what it is and an
## example, and a box to look one up.
func _book() -> void:
	ideas = JSON.parse_string(FileAccess.get_file_as_string("res://assets/ideas.json"))
	book = _card()
	book.custom_minimum_size = Vector2(760, 560)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	book.add_child(col)
	var title := Label.new()
	title.text = "THE LIBRARY"
	title.add_theme_font_size_override("font_size", 26)
	col.add_child(title)
	book_find = LineEdit.new()
	book_find.placeholder_text = "look up a word — loop, condition, variable…"
	book_find.text_changed.connect(func(_t): _book_fill())
	col.add_child(book_find)
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(700, 400)
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(sc)
	book_text = RichTextLabel.new()
	book_text.bbcode_enabled = true
	book_text.fit_content = true
	book_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	book_text.add_theme_font_size_override("normal_font_size", 17)
	book_text.add_theme_font_size_override("bold_font_size", 20)
	sc.add_child(book_text)
	var close := Button.new()
	close.text = "Close  (Esc)"
	close.pressed.connect(library_close)
	col.add_child(close)

func _book_fill() -> void:
	var q := book_find.text.strip_edges().to_lower()
	var out := ""
	for i in ideas:
		var hay := (str(i.term) + " " + str(i.what)).to_lower()
		if q != "" and not q in hay:
			continue
		out += "[b][color=#ffe9a8]%s[/color][/b]\n%s\n[color=#8fd3ff][code]%s[/code][/color]\n\n" % [i.term, i.what, i.eg]
	book_text.text = out if out != "" else "Nothing on the shelves for that yet."

func library_open(term: String) -> void:
	book.visible = true
	book_find.text = term
	_book_fill()
	_hold()
	book_find.grab_focus.call_deferred()

func library_close() -> void:
	book.visible = false
	book_find.release_focus()
	_hold()

## ADA reads where you have got to and names the ONE idea your next mission
## is built on; ask again and she moves on to the next shelf.
const MISSION_IDEA := [["tut", "Command"], ["nav", "Sequence"], ["flight", "Coordinate"],
	["m1", "Loop"], ["m2", "Condition"], ["m3", "Function"]]
func library_ask() -> void:
	var term := ""
	for m in MISSION_IDEA:
		if not Progress.get_value(m[0], false):
			term = m[1]
			break
	if term == "" and ideas.size() > 0:
		term = ideas[ada_next % ideas.size()].term
		ada_next += 1
	var line := ""
	for i in ideas:
		if i.term == term:
			line = str(i.what).split(". ")[0] + "."
	say("ADA — \"Read up on %s.\"  %s" % [term, line], 5.0)
	library_open(term)
