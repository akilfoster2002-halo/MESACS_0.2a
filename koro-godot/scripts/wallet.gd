## WALLET — coins, XP and levels, and the cars (public/wallet.js, shop.js).
##
## XP only goes up and is the record of what you have done; a level is what
## it adds up to. Coins you spend, on things you can see. Nothing bought
## changes how hard anything is: a paid car is a paint job.
class_name Wallet
extends RefCounted

const CARS := [
	{"id": "car_red", "name": "Scarlet", "price": 0, "paint": Color("d42a35")},
	{"id": "car_white", "name": "Chalk", "price": 150, "paint": Color("e9edf5")},
	{"id": "car_orange", "name": "Ember", "price": 260, "paint": Color("f0761c")},
	{"id": "car_green", "name": "Clover", "price": 340, "paint": Color("2f9d55")},
]

static func coins() -> int:
	return int(Progress.get_value("w_coins", 0))

static func xp() -> int:
	return int(Progress.get_value("w_xp", 0))

## What each level costs, cumulatively; the steps grow, so level 2 comes fast
## enough to explain what levels are and level 10 means something.
static func need_for(level: int) -> int:
	var n := 0
	for i in range(1, level):
		n += 100 + (i - 1) * 60
	return n

static func level() -> int:
	var l := 1
	var x := xp()
	while l < 60 and x >= need_for(l + 1):
		l += 1
	return l

static func owned() -> Array:
	return Progress._list(Progress.get_value("w_owned", "[]"))

static func owns_car(id: String) -> bool:
	var c := car(id)
	return not c.is_empty() and (int(c.price) == 0 or id in owned())

static func car(id: String) -> Dictionary:
	for c in CARS:
		if c.id == id:
			return c
	return {}

## The car you drive: the one you chose, or the one everybody starts with.
static func car_id() -> String:
	var id = Progress.get_value("w_car", null)
	return id if id != null and owns_car(str(id)) else "car_red"

static func paint() -> Color:
	return car(car_id()).paint

## At a bay: take it if it is yours, buy it if you can, and say how short
## you are if you cannot.
static func choose_car(world: Node3D, id: String) -> void:
	var c := car(id)
	if c.is_empty():
		return
	if not owns_car(id):
		if coins() < int(c.price):
			world.hud.say("%s costs %d coins. You have %d." % [c.name, c.price, coins()], 3.5)
			return
		Progress.set_value("w_coins", coins() - int(c.price))
		var o := owned()
		o.append(id)
		Progress.set_value("w_owned", JSON.stringify(o))
		world.hud.say("Bought %s." % c.name, 3.0)
	else:
		world.hud.say("%s it is." % c.name, 2.5)
	Progress.set_value("w_car", id)
	world.car.set_paint(c.paint)
	for bld in world.buildings:
		bld.refresh()
