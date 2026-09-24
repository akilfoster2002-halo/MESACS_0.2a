## THE BAG — the same one the browser keeps (public/game.js, PROGRESS): one
## flat dictionary of finished missions, coins (w_coins), XP (w_xp), what you
## own (w_owned, a JSON list), the car you drive (w_car) and who you are
## (char). It is kept on this machine, and when you are signed in it is the
## bag on your account — so coins earned in the browser are coins here, and a
## car bought here is a car there.
class_name Progress
extends RefCounted

static var bag := {}
static var loaded := false
static var owed := false          # changed since the server last had it
static var listeners: Array[Callable] = []

static func _load() -> void:
	if loaded:
		return
	loaded = true
	if FileAccess.file_exists(Settings.dir() + "progress.json"):
		var d = JSON.parse_string(FileAccess.get_file_as_string(Settings.dir() + "progress.json"))
		if d is Dictionary:
			bag = d

static func get_value(k: String, fallback: Variant = null) -> Variant:
	_load()
	return bag.get(k, fallback)

static func set_value(k: String, v: Variant) -> void:
	_load()
	bag[k] = v
	owed = true
	_save()
	_tell()

## The account's bag arrives: it is the truth, but a thing done on this
## machine before signing in is not thrown away — the two are merged, the
## larger number of coins and XP winning and ownership being added together.
static func adopt(server: Dictionary) -> void:
	_load()
	var mine := bag.duplicate()
	bag = server.duplicate()
	for k in mine:
		if not bag.has(k):
			bag[k] = mine[k]
			owed = true
	for k in ["w_coins", "w_xp"]:
		if int(mine.get(k, 0)) > int(bag.get(k, 0)):
			bag[k] = mine[k]
			owed = true
	var owned := _list(bag.get("w_owned", "[]"))
	for id in _list(mine.get("w_owned", "[]")):
		if not id in owned:
			owned.append(id)
			owed = true
	bag["w_owned"] = JSON.stringify(owned)
	_save()
	_tell()

static func _list(v: Variant) -> Array:
	if v is Array:
		return v
	var p = JSON.parse_string(str(v))
	return p if p is Array else []

static func _save() -> void:
	var f := FileAccess.open(Settings.dir() + "progress.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(bag))

static func _tell() -> void:
	for cb in listeners:
		if cb.is_valid():
			cb.call()
