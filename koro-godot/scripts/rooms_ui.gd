## CHAT ROOMS, THE SCREENS — C anywhere for the rooms you can go to, TAB in a
## room for what you can do there.
##
## THE BROWSER is four lists and a form: MY ROOMS, the ones you have been
## INVITED to, the ones you were in RECENTLY, a SEARCH of every room that
## is open, and CREATE — a name, who may come in, and a room to start from.
## Every card is drawn in its own room's colours (RoomThumb), with who owns
## it, how many are in it now and whether you may go in.
##
## THE ROOM MENU is the room's own: INVITE and EDIT for its owner, INFO (and
## for the owner renaming it, opening or closing it, deleting it) and LEAVE
## for everybody.
##
## Nothing here decides anything. Every list, every door and every change is
## a request to the server (net.gd → server/index.js), which checks it
## against the database from your session and answers; a refusal is shown
## as the server worded it.
class_name RoomsUI
extends PanelContainer

const BG := Color(0.05, 0.07, 0.14, 0.95)
const EDGE := Color(0.56, 0.83, 1.0, 0.5)
const GOLD := Color("ffd766")
const CYAN := Color("8ff0ff")
const PINK := Color("ff6ad5")
const MINT := Color("a8e6cf")
const LAV := Color("cdb4f6")
const CREAM := Color("ffe9a8")
const ACCESS := {
	"private": ["PRIVATE", LAV, "Only you."],
	"invited": ["INVITED", GOLD, "You and the people you invite."],
	"public": ["PUBLIC", MINT, "Anybody in KORO can find it and come in."],
}

var net: Net
var hud: Hud
var page := ""
var head: Label
var sub: Label
var tabs: HBoxContainer
var tab_btns := {}
var content: VBoxContainer
var scroll: ScrollContainer
var status: Label
var lists := {}                # the last answer to GET /rooms
var making := {"name": "", "access": "private", "template": "bedroom"}
var busy := false

func build(n: Net, h: Hud) -> RoomsUI:
	net = n
	hud = h
	custom_minimum_size = Vector2(1020, 640)
	var sb := StyleBoxFlat.new()
	sb.bg_color = BG
	sb.border_color = EDGE
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	for side in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + side, 24)
	add_theme_stylebox_override("panel", sb)
	set_anchors_preset(Control.PRESET_CENTER)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH
	visible = false
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	add_child(col)
	var top := HBoxContainer.new()
	col.add_child(top)
	var names := VBoxContainer.new()
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	names.add_theme_constant_override("separation", 0)
	top.add_child(names)
	head = _text("CHAT ROOMS", 30, CREAM)
	names.add_child(head)
	sub = _text("", 14, Color(1, 1, 1, 0.6))
	names.add_child(sub)
	var close := pill("CLOSE  ·  Esc", Color(1, 1, 1, 0.7))
	close.pressed.connect(func(): hud.rooms_close())
	top.add_child(close)
	tabs = HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 8)
	col.add_child(tabs)
	for spec in [["mine", "MY ROOMS"], ["invited", "INVITED"], ["recent", "RECENT"], ["search", "SEARCH"], ["create", "+  CREATE ROOM"]]:
		var b := pill(spec[1], GOLD if spec[0] == "create" else CYAN)
		b.toggle_mode = true
		var key: String = spec[0]
		b.pressed.connect(func(): show_page(key))
		tabs.add_child(b)
		tab_btns[key] = b
	var line := ColorRect.new()
	line.color = Color(EDGE, 0.25)
	line.custom_minimum_size = Vector2(0, 1)
	col.add_child(line)
	scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 14)
	scroll.add_child(content)
	status = _text("", 15, CREAM)
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(status)
	return self

# ------------------------------------------------------------ the kit

static func _text(s: String, size: int, c: Color) -> Label:
	var l := Label.new()
	l.text = s
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", c)
	return l

## A Koro button: a coloured outline that fills in when it is the one chosen.
static func pill(text: String, c: Color, size := 16) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", size)
	var looks := {"normal": [0.14, c], "hover": [0.3, c], "pressed": [1.0, BG], "hover_pressed": [1.0, BG], "disabled": [0.06, Color(c, 0.35)]}
	for k in looks:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(c, looks[k][0])
		sb.border_color = Color(c, 0.9 if k != "disabled" else 0.3)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(20)
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 7
		sb.content_margin_bottom = 7
		b.add_theme_stylebox_override(k, sb)
	b.add_theme_color_override("font_color", c)
	b.add_theme_color_override("font_hover_color", c.lightened(0.2))
	b.add_theme_color_override("font_pressed_color", BG)
	b.add_theme_color_override("font_hover_pressed_color", BG)
	b.add_theme_color_override("font_disabled_color", Color(c, 0.4))
	return b

static func field(hint: String, max_len := 32) -> LineEdit:
	var e := LineEdit.new()
	e.placeholder_text = hint
	e.max_length = max_len
	e.add_theme_font_size_override("font_size", 18)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.13, 0.24)
	sb.border_color = Color(CYAN, 0.5)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	e.add_theme_stylebox_override("normal", sb)
	var f: StyleBoxFlat = sb.duplicate()
	f.border_color = CYAN
	e.add_theme_stylebox_override("focus", f)
	return e

static func tile(c: Color, fill := 0.1) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.11, 0.21).lerp(c, fill)
	sb.border_color = Color(c, 0.55)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	for side in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + side, 12)
	p.add_theme_stylebox_override("panel", sb)
	return p

func _clear() -> void:
	for c in content.get_children():
		c.queue_free()
	status.text = ""

func _say(s: String) -> void:
	status.text = s

func _mark(key: String) -> void:
	for k in tab_btns:
		(tab_btns[k] as Button).button_pressed = k == key

# ------------------------------------------------------------ opening

func open_browser() -> void:
	visible = true
	tabs.visible = true
	head.text = "CHAT ROOMS"
	sub.text = "Rooms players make — yours to build, theirs to visit"
	if not net.signed_in():
		_clear()
		_mark("")
		content.add_child(_text("Sign in to make a room or go into one.", 20, CREAM))
		var b := pill("YOUR ACCOUNT", GOLD, 18)
		b.pressed.connect(func(): hud.rooms_close(); hud.account_open())
		content.add_child(b)
		return
	show_page("mine")

func show_page(key: String) -> void:
	page = key
	_mark(key)
	match key:
		"search":
			_search_page()
		"create":
			_create_page()
		_:
			_list_page(key)

# ------------------------------------------------------------ the lists

func _list_page(key: String) -> void:
	_clear()
	_say("Asking the server…")
	var j := await net.rooms_lists()
	if not visible or page != key:
		return
	if not j.ok:
		_say(str(j.error))
		return
	lists = j
	_say("")
	var rooms: Array = j.get(key, [])
	var blurb := {"mine": "Rooms you own — %d of %d." % [rooms.size(), int(j.get("max", 6))],
		"invited": "Rooms whose owners put you on their list.",
		"recent": "Rooms you have been in lately."}
	content.add_child(_text(blurb.get(key, ""), 15, Color(1, 1, 1, 0.7)))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	content.add_child(grid)
	for r in rooms:
		grid.add_child(_card(r))
	if key == "mine" and rooms.size() < int(j.get("max", 6)):
		grid.add_child(_new_card())
	if rooms.is_empty() and key != "mine":
		content.add_child(_text({"invited": "Nobody has invited you anywhere yet.",
			"recent": "You have not been in any rooms yet — try SEARCH."}.get(key, ""), 17, CREAM))

## A room, as a card: its picture, its name, its owner, who is in it, the door.
func _card(r: Dictionary) -> Control:
	var acc: Array = ACCESS.get(str(r.get("access", "private")), ACCESS.private)
	var p := tile(acc[1], 0.06)
	p.custom_minimum_size = Vector2(228, 0)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	p.add_child(v)
	var th := RoomThumb.new()
	th.env = r.get("env", {}) if r.get("env") is Dictionary else {}
	th.custom_minimum_size = Vector2(204, 112)
	v.add_child(th)
	var name := _text(str(r.get("name", "?")), 19, Color.WHITE)
	name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name.custom_minimum_size = Vector2(204, 0)
	v.add_child(name)
	var mine := int(r.get("owner_id", -1)) == int(net.me.get("id", -2))
	v.add_child(_text("yours" if mine else "by " + str(r.get("owner_display", "?")), 14, Color(1, 1, 1, 0.65)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	v.add_child(row)
	var n := int(r.get("players", 0))
	row.add_child(_text("● %d here" % n if n > 0 else "○ empty", 14, MINT if n > 0 else Color(1, 1, 1, 0.45)))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	row.add_child(_text(acc[0], 13, acc[1]))
	var go := pill("ENTER", CYAN, 16)
	go.pressed.connect(func(): enter(int(r.id)))
	v.add_child(go)
	return p

func _new_card() -> Control:
	var p := tile(GOLD, 0.03)
	p.custom_minimum_size = Vector2(228, 250)
	var b := Button.new()
	b.flat = true
	b.text = "+\nNEW ROOM"
	b.add_theme_font_size_override("font_size", 22)
	b.add_theme_color_override("font_color", GOLD)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func(): show_page("create"))
	p.add_child(b)
	return p

# ------------------------------------------------------------ search

func _search_page() -> void:
	_clear()
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	content.add_child(row)
	var q := field("a room's name…")
	q.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(q)
	var go := pill("SEARCH", CYAN, 17)
	row.add_child(go)
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	content.add_child(grid)
	var run := func(_t: String):
		var text := q.text.strip_edges()
		if text == "":
			return
		_say("Looking…")
		var j := await net.rooms_search(text)
		if not visible or page != "search":
			return
		for c in grid.get_children():
			c.queue_free()
		if not j.ok:
			_say(str(j.error))
			return
		var found: Array = j.get("rooms", [])
		_say("Nothing open by that name." if found.is_empty() else "")
		for r in found:
			grid.add_child(_card(r))
	go.pressed.connect(func(): run.call(""))
	q.text_submitted.connect(run)
	content.add_child(_text("Public rooms, and rooms you have been invited to. Private rooms never show up.", 14, Color(1, 1, 1, 0.55)))
	q.grab_focus.call_deferred()

# ------------------------------------------------------------ create

func _create_page() -> void:
	_clear()
	var cat := ChatRoom.catalog()
	content.add_child(_text("NAME IT", 15, GOLD))
	var name := field("My Room", int(cat.get("limits", {}).get("name", 32)))
	name.text = making.name
	name.text_changed.connect(func(t): making.name = t)
	content.add_child(name)
	content.add_child(_text("WHO MAY COME IN", 15, GOLD))
	var acc_row := HBoxContainer.new()
	acc_row.add_theme_constant_override("separation", 12)
	content.add_child(acc_row)
	var acc_btns := {}
	for k in ["private", "invited", "public"]:
		var a: Array = ACCESS[k]
		var b := pill("%s\n%s" % [a[0], a[2]], a[1], 15)
		b.toggle_mode = true
		b.button_pressed = making.access == k
		b.custom_minimum_size = Vector2(300, 64)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.pressed.connect(func():
			making.access = k
			for x in acc_btns:
				(acc_btns[x] as Button).button_pressed = x == k)
		acc_row.add_child(b)
		acc_btns[k] = b
	content.add_child(_text("START FROM", 15, GOLD))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	content.add_child(grid)
	var t_btns := {}
	var temps: Dictionary = cat.get("templates", {})
	for key in temps:
		var tpl: Dictionary = temps[key]
		var b := Button.new()
		b.toggle_mode = true
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(300, 190)
		b.button_pressed = making.template == key
		_template_look(b)
		var v := VBoxContainer.new()
		v.set_anchors_preset(Control.PRESET_FULL_RECT)
		v.offset_left = 12
		v.offset_right = -12
		v.offset_top = 10
		v.offset_bottom = -10
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(v)
		var th := RoomThumb.new()
		th.env = tpl.get("env", {})
		th.objects = tpl.get("objects", [])
		th.custom_minimum_size = Vector2(0, 110)
		th.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(th)
		var nm := _text(str(tpl.get("name", key)), 18, Color.WHITE)
		nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(nm)
		var bl := _text(str(tpl.get("blurb", "")), 13, Color(1, 1, 1, 0.6))
		bl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(bl)
		var k: String = key
		b.pressed.connect(func():
			making.template = k
			for x in t_btns:
				(t_btns[x] as Button).button_pressed = x == k)
		grid.add_child(b)
		t_btns[key] = b
	var make := pill("CREATE AND GO IN", GOLD, 20)
	make.custom_minimum_size = Vector2(0, 52)
	make.pressed.connect(func(): _create())
	content.add_child(make)
	name.grab_focus.call_deferred()

func _template_look(b: Button) -> void:
	var looks := {"normal": [0.0, 0.35], "hover": [0.06, 0.7], "pressed": [0.14, 1.0], "hover_pressed": [0.16, 1.0]}
	for k in looks:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.09, 0.11, 0.21).lerp(GOLD, looks[k][0])
		sb.border_color = Color(GOLD, looks[k][1])
		sb.set_border_width_all(3 if k.begins_with("hover_p") or k == "pressed" else 2)
		sb.set_corner_radius_all(14)
		b.add_theme_stylebox_override(k, sb)

func _create() -> void:
	if busy:
		return
	var n := str(making.name).strip_edges()
	if n == "":
		_say("Give the room a name first.")
		return
	busy = true
	_say("Building %s…" % n)
	var j := await net.room_create(n, making.access, making.template)
	busy = false
	if not j.ok:
		_say(str(j.error))
		return
	making.name = ""
	enter(int(j.room.id))

# ------------------------------------------------------------ the door

func enter(id: int) -> void:
	if busy:
		return
	busy = true
	_say("Opening the door…")
	var j := await net.room_enter(id)
	busy = false
	if not j.ok:
		_say(str(j.error))
		return
	hud.rooms_close()
	hud.world.enter_room(j.room, str(j.server))

# ============================================================ in a room

func open_menu() -> void:
	visible = true
	tabs.visible = false
	page = "menu"
	_menu()

func _room() -> Dictionary:
	return Worlds.room

func _menu() -> void:
	_clear()
	var r := _room()
	var mine := bool(r.get("mine", false))
	var acc: Array = ACCESS.get(str(r.get("access", "private")), ACCESS.private)
	head.text = str(r.get("name", "A ROOM")).to_upper()
	sub.text = ("Your room" if mine else "%s's room" % (r.get("owner", {}) as Dictionary).get("display", "Somebody")) \
		+ "  ·  " + str(acc[0]) + "  ·  %d here" % (hud.world.others.count() + 1)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	content.add_child(row)
	var th := RoomThumb.new()
	th.env = hud.world.room.env
	th.objects = hud.world.room.objects
	th.custom_minimum_size = Vector2(420, 250)
	row.add_child(th)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(col)
	var acts := []
	if mine:
		acts.append(["EDIT ROOM", GOLD, func(): hud.rooms_close(); hud.world.edit_room()])
		acts.append(["INVITE", CYAN, func(): _invite_page()])
	acts.append(["ROOM INFO", LAV, func(): _info_page()])
	acts.append(["CHAT ROOMS", MINT, func(): open_browser()])
	acts.append(["LEAVE ROOM", PINK, func(): hud.rooms_close(); hud.world.leave_room()])
	for a in acts:
		var b := pill(a[0], a[1], 19)
		b.custom_minimum_size = Vector2(0, 46)
		b.pressed.connect(a[2])
		col.add_child(b)

func _back_row(title: String) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	content.add_child(row)
	var back := pill("‹ BACK", Color(1, 1, 1, 0.7), 15)
	back.pressed.connect(func(): _menu())
	row.add_child(back)
	row.add_child(_text(title, 22, CREAM))

func _invite_page() -> void:
	_clear()
	_back_row("INVITE")
	var r := _room()
	var id := int(r.get("id", 0))
	if str(r.get("access", "")) == "private":
		content.add_child(_text("This room is PRIVATE — only you can come in. The people you invite can come in once it is INVITED (ROOM INFO).", 14, LAV))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	content.add_child(row)
	var who := field("their username", 24)
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(who)
	var go := pill("INVITE", CYAN, 17)
	row.add_child(go)
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 6)
	content.add_child(list)
	var show := func(members: Array):
		for c in list.get_children():
			c.queue_free()
		list.add_child(_text("ON THE LIST" if not members.is_empty() else "Nobody on the list yet.", 14, GOLD))
		for m in members:
			var line := HBoxContainer.new()
			line.add_theme_constant_override("separation", 10)
			var who_l := _text("%s  @%s" % [m.get("display", "?"), m.get("username", "?")], 17, Color.WHITE)
			who_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			line.add_child(who_l)
			var out := pill("REMOVE", PINK, 14)
			var uid := int(m.get("id", 0))
			out.pressed.connect(func():
				var j := await net.room_remove(id, uid)
				if j.ok:
					_invite_refresh(j.get("members", []))
				else:
					_say(str(j.error)))
			line.add_child(out)
			list.add_child(line)
	set_meta("show_members", show)
	var send := func(_t: String):
		var u := who.text.strip_edges().trim_prefix("@")
		if u == "":
			return
		var j := await net.room_invite(id, u)
		if not j.ok:
			_say(str(j.error))
			return
		who.text = ""
		_say(str(j.get("note", "")) if str(j.get("note", "")) != "" else "@%s is invited — they have been told." % u)
		show.call(j.get("members", []))
	go.pressed.connect(func(): send.call(""))
	who.text_submitted.connect(send)
	who.grab_focus.call_deferred()
	var j := await net.room_get(id)
	if j.ok and page == "menu" and visible:
		show.call(j.room.get("members", []))

func _invite_refresh(members: Array) -> void:
	if has_meta("show_members"):
		(get_meta("show_members") as Callable).call(members)

func _info_page() -> void:
	_clear()
	_back_row("ROOM INFO")
	var r := _room()
	var id := int(r.get("id", 0))
	var mine := bool(r.get("mine", false))
	var tpl: Dictionary = ChatRoom.catalog().get("templates", {}).get(str(r.get("template", "")), {})
	var facts := [
		["Owner", str((r.get("owner", {}) as Dictionary).get("display", "?"))],
		["Who may come in", str(ACCESS.get(str(r.get("access", "private")), ACCESS.private)[2])],
		["Here now", str(hud.world.others.count() + 1)],
		["Started as", str(tpl.get("name", "—"))],
		["Things in it", "%d of %d" % [hud.world.room.objects.size(), int(ChatRoom.catalog().get("limits", {}).get("objects", 150))]],
		["Room number", "%d — a portal set to this goes here" % id],
	]
	for f in facts:
		var line := HBoxContainer.new()
		var k := _text(f[0], 16, Color(1, 1, 1, 0.6))
		k.custom_minimum_size = Vector2(190, 0)
		line.add_child(k)
		line.add_child(_text(f[1], 17, Color.WHITE))
		content.add_child(line)
	if not mine:
		return
	content.add_child(_text("RENAME", 15, GOLD))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	content.add_child(row)
	var nm := field("a new name", int(ChatRoom.catalog().get("limits", {}).get("name", 32)))
	nm.text = str(r.get("name", ""))
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(nm)
	var ren := pill("RENAME", CYAN, 16)
	ren.pressed.connect(func():
		var j := await net.room_rename(id, nm.text)
		if j.ok:
			Worlds.room.name = j.name
			head.text = str(j.name).to_upper()
			_say("Renamed.")
		else:
			_say(str(j.error)))
	row.add_child(ren)
	content.add_child(_text("WHO MAY COME IN", 15, GOLD))
	var acc_row := HBoxContainer.new()
	acc_row.add_theme_constant_override("separation", 10)
	content.add_child(acc_row)
	var btns := {}
	for k in ["private", "invited", "public"]:
		var a: Array = ACCESS[k]
		var b := pill(a[0], a[1], 16)
		b.toggle_mode = true
		b.button_pressed = str(r.get("access", "")) == k
		b.tooltip_text = a[2]
		b.pressed.connect(func():
			var j := await net.room_access(id, k)
			if j.ok:
				Worlds.room.access = k
				_say("%s — %s" % [a[0], a[2]])
			else:
				_say(str(j.error))
			for x in btns:
				(btns[x] as Button).button_pressed = str(Worlds.room.get("access", "")) == x)
		acc_row.add_child(b)
		btns[k] = b
	content.add_child(_text("DELETE", 15, PINK))
	var del := pill("DELETE THIS ROOM", PINK, 16)
	del.pressed.connect(func():
		if del.get_meta("sure", false):
			var j := await net.room_delete(id)
			if not j.ok:
				_say(str(j.error))
			# the server sends everybody inside — you too — back out
			return
		del.set_meta("sure", true)
		del.text = "SURE? PRESS AGAIN — IT CANNOT BE UNDONE")
	content.add_child(del)

# ============================================================ a picture

## A ROOM DRAWN SMALL: its floor, its walls, its light — and, when the things
## in it are known, where they stand — from the same numbers the room is
## built from, so a card looks like the room it opens.
class RoomThumb extends Control:
	var env: Dictionary = {}
	var objects: Array = []

	func _col(k: String, d: String) -> Color:
		return Color(str(env.get(k, d)))

	func _draw() -> void:
		var w := size.x
		var h := size.y
		if w < 20.0 or h < 20.0:
			return
		var sky := {"stars": Color("0b0d18"), "nebula": Color("1c0f2e"), "sunset": Color("c4546a"), "day": Color("7fb2e6"),
			"void": Color("030305"), "wano": Color("0a0e22")}
		draw_rect(Rect2(Vector2.ZERO, size), sky.get(str(env.get("sky", "stars")), Color("0b0d18")))
		var cx := w / 2.0
		var cy := h * 0.62
		var b := minf(w * 0.42, h * 0.72)
		var a := b * 0.5
		var hgt := h * 0.36
		var top := Vector2(cx, cy - a)
		var left := Vector2(cx - b, cy)
		var right := Vector2(cx + b, cy)
		var bot := Vector2(cx, cy + a)
		var up := Vector2(0, -hgt)
		var walls := str(env.get("walls", "plain"))
		var wc := _col("wallColor", "#e8e4f0")
		if walls != "none":
			var alpha := 0.35 if walls == "glass" else 1.0
			draw_colored_polygon(PackedVector2Array([left, top, top + up, left + up]), Color(wc.darkened(0.12), alpha))
			draw_colored_polygon(PackedVector2Array([top, right, right + up, top + up]), Color(wc.darkened(0.3), alpha))
			if walls == "brick" or walls == "panel":
				for i in range(1, 6):
					var k := i / 6.0
					draw_line(left + up * k, top + up * k, Color(0, 0, 0, 0.18), 1.0)
					draw_line(top + up * k, right + up * k, Color(0, 0, 0, 0.18), 1.0)
		var fc := _col("floorColor", "#9aa3b5")
		draw_colored_polygon(PackedVector2Array([top, right, bot, left]), fc)
		if str(env.get("floor", "")) in ["tile", "grid", "wood"]:
			var lc := _col("lightColor", "#8ff0ff") if str(env.get("floor", "")) == "grid" else Color(0, 0, 0, 0.15)
			for i in range(1, 8):
				var k := i / 8.0
				draw_line(left.lerp(top, k), bot.lerp(right, k), lc, 1.0)
				if str(env.get("floor", "")) != "wood":
					draw_line(left.lerp(bot, k), top.lerp(right, k), lc, 1.0)
		# the things in it, as dots where they stand
		var S: Dictionary = ChatRoom.catalog().get("size", {"w": 26, "d": 26})
		for o in objects:
			var p: Array = o.get("p", [0, 0, 0])
			var u := (float(p[0]) / float(S.w)) + 0.5
			var v := (float(p[2]) / float(S.d)) + 0.5
			var at := top + (right - top) * u + (left - top) * v - Vector2(0, float(p[1]) / 9.0 * hgt)
			var cat := str(ChatRoom.spec(str(o.get("type", ""))).get("cat", ""))
			var c: Color = {"furniture": Color("ffe9a8"), "decor": Color("a8e6cf"), "interactive": Color("ff6ad5")}.get(cat, Color.WHITE)
			draw_circle(at, 3.2, c)
		var lc2 := _col("lightColor", "#ffffff")
		draw_circle(Vector2(cx, cy - hgt * 0.2), b * 0.35, Color(lc2, 0.08))
