## THE PHONE (T) — everybody has one, and it is where talking happens.
##
## NEARBY is the room: whoever is on this server with you, nothing kept, gone
## when the room empties. TEXTS go to anybody by username and are kept on the
## server, so a text sent to somebody who is not here is waiting for them when
## they are (public/phone.js).
class_name Phone
extends PanelContainer

var net: Net
var hud: Node
var tab := "nearby"
var nearby_box: VBoxContainer
var texts_box: HBoxContainer
var room_log: RichTextLabel
var say_line: LineEdit
var list: VBoxContainer
var talk: RichTextLabel
var to_line: LineEdit
var msg_line: LineEdit
var with := ""
## THE ROOM'S LOG, kept with the id the server gave each line: a teacher can
## take one line back out of a room, or clear the lot, and a line nobody was
## meant to read is no less read on this screen than in a browser.
var lines: Array[Dictionary] = []
var poll_t := 0.0
var t_nearby: Button
var t_texts: Button

func build(n: Net, h: Node) -> Phone:
	net = n
	hud = h
	custom_minimum_size = Vector2(760, 520)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	add_child(col)
	var tabs := HBoxContainer.new()
	col.add_child(tabs)
	t_nearby = _tab("Nearby", tabs, "nearby")
	t_texts = _tab("Texts", tabs, "texts")
	# NEARBY
	nearby_box = VBoxContainer.new()
	nearby_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(nearby_box)
	room_log = RichTextLabel.new()
	room_log.bbcode_enabled = true
	room_log.scroll_following = true
	room_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	room_log.custom_minimum_size = Vector2(0, 360)
	nearby_box.add_child(room_log)
	say_line = LineEdit.new()
	say_line.placeholder_text = "Say something to the room — Enter to send"
	say_line.max_length = 160
	say_line.text_submitted.connect(_say)
	nearby_box.add_child(say_line)
	# TEXTS
	texts_box = HBoxContainer.new()
	texts_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	texts_box.add_theme_constant_override("separation", 12)
	col.add_child(texts_box)
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(240, 0)
	texts_box.add_child(left)
	to_line = LineEdit.new()
	to_line.placeholder_text = "@username — Enter to open"
	to_line.text_submitted.connect(func(t): _open(t.strip_edges().trim_prefix("@").to_lower()))
	left.add_child(to_line)
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(sc)
	list = VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(list)
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts_box.add_child(right)
	talk = RichTextLabel.new()
	talk.bbcode_enabled = true
	talk.scroll_following = true
	talk.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(talk)
	msg_line = LineEdit.new()
	msg_line.placeholder_text = "Text — Enter to send"
	msg_line.text_submitted.connect(_text)
	right.add_child(msg_line)
	var close := Button.new()
	close.text = "Close  (Esc)"
	close.pressed.connect(func(): hud.phone_close())
	col.add_child(close)
	net.said.connect(_heard)
	_tab_to("nearby")
	return self

func _tab(t: String, parent: Control, id: String) -> Button:
	var b := Button.new()
	b.text = t
	b.toggle_mode = true
	b.custom_minimum_size = Vector2(140, 36)
	b.pressed.connect(func(): _tab_to(id))
	parent.add_child(b)
	return b

func _tab_to(id: String) -> void:
	tab = id
	t_nearby.button_pressed = id == "nearby"
	t_texts.button_pressed = id == "texts"
	nearby_box.visible = id == "nearby"
	texts_box.visible = id == "texts"
	if id == "texts":
		refresh()
		to_line.grab_focus.call_deferred()
	else:
		say_line.grab_focus.call_deferred()

func opened() -> void:
	_tab_to(tab)
	_draw_log()

func _heard(line: Dictionary) -> void:
	# the teacher cleared the room, or took one line back out of it
	if line.get("clear", false):
		lines.clear()
		if visible:
			_draw_log()
		return
	if line.has("unsay"):
		var gone := int(line.unsay)
		lines = lines.filter(func(l): return int(l.get("id", 0)) != gone)
		if visible:
			_draw_log()
		return
	var s: String
	if line.has("sys"):
		s = "[color=#8fd3ff][i]%s[/i][/color]" % _esc(line.get("sys", ""))
	else:
		s = "[b][color=#a8e6cf]%s[/color][/b]  %s" % [_esc(line.get("from", "?")), _esc(line.get("text", ""))]
	lines.append({"id": int(line.get("id", 0)), "text": s})
	if lines.size() > 80:
		lines.pop_front()
	if visible:
		_draw_log()

func _draw_log() -> void:
	var head := ""
	if not net.signed_in():
		head = "[color=#ffe9a8]Sign in (P → Your account) to talk to the room.[/color]\n"
	elif not net.live:
		head = "[color=#ffe9a8]No live room on this server right now.[/color]\n"
	room_log.text = head + "\n".join(lines.map(func(l): return str(l.get("text", ""))))

static func _esc(t: Variant) -> String:
	return str(t).replace("[", "[lb]")

func _say(t: String) -> void:
	t = t.strip_edges()
	if t == "":
		return
	if not net.live:
		hud.say("There is nobody to hear it — no live room.", 2.5)
		return
	net.say(t)
	say_line.text = ""

func refresh() -> void:
	for c in list.get_children():
		c.queue_free()
	if not net.signed_in():
		talk.text = "[color=#ffe9a8]Sign in to text anybody by their username.[/color]"
		return
	var j: Dictionary = await net.threads()
	if not j.ok:
		talk.text = str(j.error)
		return
	for th in j.threads:
		var b := Button.new()
		var unread := int(th.get("unread", 0))
		b.text = "%s%s\n%s" % [th.display, "  ●%d" % unread if unread > 0 else "", str(th.get("last", "")).substr(0, 28)]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 52)
		var u: String = th.username
		b.pressed.connect(func(): _open(u))
		list.add_child(b)
	if with != "":
		_open(with)

func _open(username: String) -> void:
	if username == "" or not net.signed_in():
		return
	with = username
	var j: Dictionary = await net.thread(username)
	if not j.ok:
		talk.text = "[color=#ffb4a2]%s[/color]" % _esc(j.error)
		return
	var out := "[b]%s[/b]  [color=#8fd3ff]@%s[/color]\n\n" % [_esc(j.with.display), _esc(j.with.username)]
	for m in j.messages:
		if m.mine:
			out += "[right][color=#a8e6cf]%s[/color][/right]\n" % _esc(m.text)
		else:
			out += "%s\n" % _esc(m.text)
	talk.text = out
	msg_line.grab_focus.call_deferred()

func _text(t: String) -> void:
	t = t.strip_edges()
	if t == "" or with == "":
		return
	var j: Dictionary = await net.text(with, t)
	if not j.ok:
		hud.say(str(j.error), 3.0)
		return
	msg_line.text = ""
	_open(with)

func _process(delta: float) -> void:
	if not visible or tab != "texts" or not net.signed_in():
		return
	poll_t -= delta
	if poll_t <= 0.0:
		poll_t = 8.0
		if with != "":
			_open(with)
