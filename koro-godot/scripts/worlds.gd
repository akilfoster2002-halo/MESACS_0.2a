## THE WORLDS — every ball you can stand on, as data (public/planet.js).
##
## WANO is where everybody lands: the school, with a wood round it. VOLTA is
## the small loud one, a quarter of the size so you can see all of it, where
## nothing grows but glass lit from inside: the Gym, THE LOOP and the Arcade.
## YOUR HOME PLANET is generated from your own seed — its soil, its hills, its
## name on the sign — and it is yours alone. RYU is Mission 8's, and missions
## stay in the browser.
##
## You go between them the way the browser does: fetch nothing, walk to THE
## PAD, get in the ship and fly there yourself (cruise.gd).
class_name Worlds
extends RefCounted

const HUB := {
	"id": "hub", "name": "Wano", "sub": "everybody lands here", "radius": 320.0, "relief": 9.5, "seed": 1,
	"sky": Color(0.025, 0.03, 0.085), "soil": [Color(0.20, 0.42, 0.14), Color(0.36, 0.44, 0.17), Color(0.42, 0.40, 0.32)],
	"ambient": Color(0.55, 0.60, 0.80), "flora": "sakura", "ceiling": 120.0, "flies": Color(1.0, 0.94, 0.63),
	"globe": Color("4f9457"),
	"buildings": [
		{"id": "missions", "name": "MISSION CONTROL", "lon": 0.0, "lat": 7.0, "w": 64.0, "d": 46.0, "h": 18.0, "door": 10.0},
		{"id": "workshop", "name": "THE WORKSHOP", "lon": -19.0, "lat": -6.0, "w": 24.0, "d": 20.0, "h": 11.0,
			"wall": Color("4a3f7a"), "roof": Color("cdb4f6")},
		{"id": "mall", "name": "THE MALL", "lon": 19.0, "lat": -6.0, "w": 72.0, "d": 48.0, "h": 15.0, "door": 10.0,
			"wall": Color("6b4a5e"), "roof": Color("ffb4a2")},
		{"id": "library", "name": "THE LIBRARY", "lon": 0.0, "lat": -21.0, "w": 26.0, "d": 20.0, "h": 11.0,
			"wall": Color("4d6b4a"), "roof": Color("a8e6cf")},
		{"id": "mechanic", "name": "THE MECHANIC", "lon": -34.0, "lat": 6.0, "w": 40.0, "d": 28.0, "h": 14.0, "door": 9.0,
			"wall": Color("5c4636"), "roof": Color("ffd8a8")},
	],
	"pad": {"lon": -34.0, "lat": -9.0},
}

## Deep indigo up through violet, never toward green or brown.
const ARENA := {
	"id": "arena", "name": "VOLTA", "sub": "the small loud one", "radius": 118.0, "relief": 2.4, "seed": 7,
	"sky": Color(0.03, 0.015, 0.06), "soil": [Color(0.13, 0.08, 0.25), Color(0.18, 0.11, 0.33), Color(0.25, 0.14, 0.41)],
	"ambient": Color(0.62, 0.45, 0.85), "flora": "crystal", "ceiling": 48.0, "flies": Color(0.86, 0.77, 1.0),
	"globe": Color("7a4fd0"),
	"buildings": [
		{"id": "gym", "name": "THE GYM", "lon": -27.0, "lat": 3.0, "w": 36.0, "d": 28.0, "h": 14.0, "door": 9.0,
			"wall": Color("2b2340"), "roof": Color("ff9aa2")},
		{"id": "club", "name": "THE LOOP", "lon": 27.0, "lat": 3.0, "w": 44.0, "d": 36.0, "h": 16.0, "door": 10.0,
			"wall": Color("241a3d"), "roof": Color("ff6ad5")},
		{"id": "arcade", "name": "THE ARCADE", "lon": 0.0, "lat": 26.0, "w": 40.0, "d": 30.0, "h": 15.0, "door": 9.0,
			"wall": Color("1d2a4a"), "roof": Color("8ff0ff")},
	],
	"pad": {"lon": 0.0, "lat": -17.0},
}

## Grass, ochre, violet and ice: a home planet picks one from its seed, so two
## students standing on each other's worlds can tell them apart from orbit.
const BIOMES := [
	{"key": "green", "sky": Color("070a1a"), "soil": [Color(0.20, 0.38, 0.18), Color(0.29, 0.44, 0.19), Color(0.31, 0.30, 0.32)], "globe": Color("4f9457")},
	{"key": "ochre", "sky": Color("140a06"), "soil": [Color(0.47, 0.32, 0.15), Color(0.56, 0.40, 0.19), Color(0.38, 0.34, 0.30)], "globe": Color("c28a3e")},
	{"key": "violet", "sky": Color("0a0716"), "soil": [Color(0.31, 0.21, 0.42), Color(0.40, 0.29, 0.50), Color(0.34, 0.32, 0.38)], "globe": Color("8a62b8")},
	{"key": "ice", "sky": Color("050d16"), "soil": [Color(0.42, 0.53, 0.58), Color(0.55, 0.65, 0.70), Color(0.44, 0.46, 0.50)], "globe": Color("a8d8e8")},
]
const SYL_A := ["Ve", "Ta", "Ori", "Sol", "Ky", "Nu", "Bra", "Mel", "Zan", "Hal", "Pyr", "Cel",
	"Dro", "Ish", "Fen", "Ora", "Lum", "Ras", "Ther", "Vex"]
const SYL_B := ["ska", "dun", "mir", "vex", "tara", "lys", "morn", "doria", "beth", "var",
	"quel", "ondo", "rax", "stel", "nova", "heim", "ara", "tide", "fell", "ion"]

## Where you are, and whether you came by ship (so you arrive on the pad).
static var current := "hub"
static var by_ship := false
static var from := "hub"

## Your own number, kept in the progress bag so it follows your account: a
## home planet that changed shape when you logged in from the other side of
## the classroom would not be a home.
static func home_seed() -> int:
	var n := int(Progress.get_value("home_seed", 0))
	if n == 0:
		n = randi() % 0x7fffffff + 1
		Progress.set_value("home_seed", n)
	return n

static func planet_name(seed: int) -> String:
	return (SYL_A[seed % SYL_A.size()] + SYL_B[(seed >> 5) % SYL_B.size()]).to_upper()

static func home() -> Dictionary:
	var seed := home_seed()
	var bio: Dictionary = BIOMES[seed % BIOMES.size()]
	var name := planet_name(seed)
	return {
		"id": "home", "name": name, "sub": "your home planet", "radius": 200.0,
		"relief": 6.5 + (seed >> 7) % 6, "seed": seed % 100000 + 11,
		"sky": bio.sky, "soil": bio.soil, "ambient": Color(0.6, 0.62, 0.78), "flora": "wood",
		"ceiling": 95.0, "flies": Color(1.0, 0.94, 0.63), "globe": bio.globe, "biome": bio.key,
		"buildings": [
			{"id": "house", "name": name + " HOUSE", "lon": 0.0, "lat": 2.0, "w": 26.0, "d": 22.0, "h": 12.0, "door": 8.0,
				"wall": Color("4a3f7a"), "roof": Color("cdb4f6")},
		],
		"pad": {"lon": 0.0, "lat": -13.0},
	}

static func get_world(id: String) -> Dictionary:
	match id:
		"arena":
			return ARENA
		"home":
			return home()
	return HUB

static func here() -> Dictionary:
	return get_world(current)

## The places the ship can take you from here.
static func destinations() -> Array:
	return ["hub", "arena", "home"].filter(func(id): return id != current)
