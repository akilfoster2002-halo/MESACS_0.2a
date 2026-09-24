## SIGNING IN — the same account as the website, on the same server.
##
## Where the server is has to be said once, because a game on your own
## machine does not know which school's KORO it belongs to; after that it
## remembers, and so does your session.
class_name Account
extends PanelContainer

var net: Net
var hud: Node
var server: LineEdit
var room: OptionButton
var user: LineEdit
var password: LineEdit
var display: LineEdit
var err: Label
var who: Label
var signed_box: VBoxContainer
var form_box: VBoxContainer
var busy := false

func build(n: Net, h: Node) -> Account:
	net = n
	hud = h
	custom_minimum_size = Vector2(520, 0)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	add_child(col)
	var title := Label.new()
	title.text = "YOUR ACCOUNT"
	title.add_theme_font_size_override("font_size", 24)
	col.add_child(title)
	col.add_child(_small("The server — the address of your class's KORO"))
	server = LineEdit.new()
	server.placeholder_text = "https://… or http://127.0.0.1:8799"
	server.text = net.base
	col.add_child(server)
	col.add_child(_small("The room you play in"))
	room = OptionButton.new()
	for r in Net.ROOMS:
		room.add_item(r[1])
	room.selected = maxi(0, Net.ROOMS.map(func(r): return r[0]).find(net.room))
	room.item_selected.connect(func(i): net.set_room(Net.ROOMS[i][0]))
	col.add_child(room)
	form_box = VBoxContainer.new()
	form_box.add_theme_constant_override("separation", 8)
	col.add_child(form_box)
	user = _field(form_box, "Username")
	password = _field(form_box, "Password")
	password.secret = true
	display = _field(form_box, "Display name (only for a new account)")
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	form_box.add_child(row)
	var sign := _button("Sign in", row)
	sign.pressed.connect(_sign_in)
	var make := _button("Make an account", row)
	make.pressed.connect(_register)
	password.text_submitted.connect(func(_t): _sign_in())
	signed_box = VBoxContainer.new()
	col.add_child(signed_box)
	who = Label.new()
	who.add_theme_font_size_override("font_size", 18)
	signed_box.add_child(who)
	var out := _button("Sign out", signed_box)
	out.pressed.connect(func():
		await net.logout()
		_show())
	err = Label.new()
	err.add_theme_color_override("font_color", Color("ffb4a2"))
	err.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(err)
	var close := _button("Close  (Esc)", col)
	close.pressed.connect(func(): hud.account_close())
	net.changed.connect(_show)
	_show()
	return self

func _small(t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", 13)
	l.modulate = Color(1, 1, 1, 0.7)
	return l

func _field(parent: Control, hint: String) -> LineEdit:
	var e := LineEdit.new()
	e.placeholder_text = hint
	parent.add_child(e)
	return e

func _button(t: String, parent: Control) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(0, 38)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(b)
	return b

func _show() -> void:
	var inn := net.signed_in()
	form_box.visible = not inn
	signed_box.visible = inn
	if inn:
		who.text = "Signed in as %s  (@%s)%s" % [net.me.get("display", "?"), net.me.get("username", "?"),
			"" if net.live else "\nNo live room on this server — saving and texts still work."]

func _sign_in() -> void:
	await _go(false)

func _register() -> void:
	await _go(true)

func _go(make: bool) -> void:
	if busy:
		return
	busy = true
	err.text = "…"
	net.set_server(server.text)
	var e: String
	if make:
		e = await net.register(user.text.strip_edges(), password.text, display.text.strip_edges())
	else:
		e = await net.login(user.text.strip_edges(), password.text)
	busy = false
	err.text = e
	if e == "":
		password.text = ""
		hud.say("Signed in as %s." % net.me.get("display", "?"), 3.0)
		hud.account_close()
