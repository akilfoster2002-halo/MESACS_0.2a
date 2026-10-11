## TSH · THE CHASE — public/tshchase.js, ported. Out of Dragon Alley, under the billboard, and WFC arrives (game.gd
## films that; this is the part you play):
##   1 RUN      Neon Avenue, east. SHIFT sprints, SPACE vaults a barrier. The shoes are cold: on foot. A red ring is a missile.
##   2 VAN      a van brakes across the pavement — FIGHT 1.
##   3 WALL     a WFC barrier drops across the gap: G, and up the wall on the gecko cuffs.
##   4 ROOFS    the shoes are charged: HOLD SPACE, roof to roof, the drones firing at her in the air.
##   5 RAPPEL   the gunship drops a team on the roof in front of her — FIGHT 2.
##   6 HIDE     the searchlight sweeps the roof; E behind the AC unit, WASD keep the box between her and whatever looks.
##   7 CALL     her phone rings — Mom. E answers; an officer walks round the box towards the sound.
##   8 FOUND    he comes round the box — FIGHT 3.
##   9 HOME     everything at once: the gunship strafing, drones, officers; land on her own roof with nobody on her.
class_name Chase
extends Node

const STAGES := [
	{"id": "run", "title": "RUN", "how": "Get away from them. SHIFT sprints — east, down Neon Avenue. SPACE at a barrier vaults it.", "floor": 3},
	{"id": "van", "title": "CORNERED", "how": "A van across the pavement, and they get out of it.", "floor": 3, "fight": 1},
	{"id": "wall", "title": "RUN", "how": "North, into the gap between the buildings. If it closes: G, and up the wall.", "floor": 3},
	{"id": "roofs", "title": "HOLD SPACE", "how": "The shoes are charged. Hold SPACE: roof to roof, east.", "floor": 3},
	{"id": "rappel", "title": "DROPPED IN", "how": "The gunship puts a team on the roof in front of her.", "floor": 3, "fight": 2},
	{"id": "hide", "title": "E — HIDE", "how": "You cannot outrun a gunship. Through the gate, behind the AC unit — and stay on the far side of whatever is looking.", "floor": 2},
	{"id": "call", "title": "MOM", "how": "Keep the box between you and him.", "floor": 2},
	{"id": "found", "title": "FOUND", "how": "He came round the box.", "floor": 2, "fight": 3},
	{"id": "home", "title": "GET HOME", "how": "Lose them — and land on your own roof with nobody on you.", "floor": 0}]
const MISSILE := {"lock": 1.5, "airLock": 1.1, "fly": 0.45, "blast": 2.8, "live": 2, "gapGround": [3.4, 5.0], "gapAir": [2.2, 3.2], "lead": 0.6}
const HITS := 2
const HITS_FORGET := 20.0
const COOL := {"cover": 5.0, "unseen": 9.0}
const STRAFE := {"every": [8.0, 11.0], "rings": 5, "gap": 3.4, "step": 0.32}
const ROUTE := {
	"mouth": Vector2(-41.5, -8.5), "barriers": [[-35.5, -10.0, -3.6], [-30.5, -10.0, -3.6]], "runDone": -29.0, "van": Vector2(-19.5, -6.8),
	"gap": {"x1": -24.0, "x2": -21.0, "z1": -44.0, "z2": -10.0}, "barrier": -30.0,
	"roofEast": {"id": "B8", "x": [37.0, 56.0], "z": [-44.0, -10.0], "h": 13.0}, "gate": {"x": 47.0, "z1": -28.4, "z2": -25.6},
	"ac": {"x": 52.5, "z": -18.0, "w": 2.4, "d": 1.6, "h": 1.6},
	"covers": [[78.0, -14.0, 11.0, 2.2, 1.6, 1.5], [66.5, 14.0, 9.0, 2.0, 2.0, 2.2], [44.0, 20.0, 10.0, 2.2, 1.6, 1.5], [26.0, -37.0, 10.0, 2.2, 1.6, 1.5]],
	"home": {"x1": 62.0, "x2": 84.0, "z1": 24.0, "z2": 44.0, "h": 12.0, "at": Vector2(73, 34)}}
## the fights' grounds (tsh.js RAIDFIGHT)
const FIGHTS := {
	1: {"arena": {"x1": -33.0, "x2": -15.5, "z1": -9.6, "z2": -1.0}, "floor": 0.0},
	2: {"arena": {"x1": 37.6, "x2": 46.4, "z1": -43.4, "z2": -10.6}, "floor": 13.0},
	3: {"arena": {"x1": 47.6, "x2": 55.6, "z1": -43.4, "z2": -10.6}, "floor": 13.0}}

var g
var on := false
var built := false
var clock := 0.0
var st := {"i": 0, "t": 0.0, "flags": {}}
var heat := 0
var seen_t := 0.0             # unseen for this long
var last_known := Vector2.ZERO
var props: Array = []
var extra_solids: Array = []
var missiles: Array = []
var vaults: Array = []
var covers: Array = []
var vans: Array = []
var gun = null
var gate = null
var wfc_barrier = null
var cops: Array = []          # WFC on foot: {node, ap, x, y, z, yaw, state, t, sees}
var drones: Array = []
var fire_t := 4.0; var strafe_t := 9.0; var hits := 0; var last_hit_t := -99.0; var spotted_t := -99.0; var cold_note_t := 0.0
var cover = null              # {c, s}
var act = null                # {name, t, dur, f, clip, face}
var climb = null
var stars: Label

func _init(game) -> void: g = game

func _ready() -> void:
	stars = Label.new(); stars.set_anchors_preset(Control.PRESET_TOP_RIGHT); stars.position = Vector2(-220, 20); stars.add_theme_font_size_override("font_size", 28)
	stars.add_theme_color_override("font_outline_color", Color.BLACK); stars.add_theme_constant_override("outline_size", 6); stars.visible = false
	g.hud.add_child(stars)

func stage() -> Dictionary: return STAGES[st.i] if st.i < STAGES.size() else {}
func sid() -> String: return stage().get("id", "")
func fighting() -> bool: return stage().has("fight")
func stage_at(id: String) -> int:
	for i in STAGES.size():
		if STAGES[i].id == id: return i
	return -1
func P() -> Vector3: return g.robin.position
func vel() -> Vector3: return Vector3(g.boots.vx, g.boots.vy, g.boots.vz)

# ================================================================== the props
func _mat(c: Color, glow := false, metal := 0.0, rough := 0.6) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.metallic = metal; m.roughness = rough
	if glow: m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.emission_enabled = true; m.emission = c; m.emission_energy_multiplier = 3
	return m
func _box(size: Vector3, m: Material, pos: Vector3, parent: Node = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = size; mi.mesh = bm; mi.material_override = m; mi.position = pos
	(parent if parent else g).add_child(mi)
	if parent == null: props.append(mi)
	return mi
func solid(x1: float, x2: float, z1: float, z2: float, y1: float, y2: float) -> Array:
	var s := [x1, x2, z1, z2, y1, y2]; g.boots.solids.append(s); extra_solids.append(s); return s
func unsolid(s) -> void:
	if s == null: return
	g.boots.solids.erase(s); extra_solids.erase(s)

func _barrier(x: float, z1: float, z2: float) -> void:
	_box(Vector3(0.6, 1.0, z2 - z1), _mat(Color(0.55, 0.55, 0.52)), Vector3(x, 0.5, (z1 + z2)/2))
	_box(Vector3(0.62, 0.12, z2 - z1), _mat(Color(1, 0.65, 0.12), true), Vector3(x, 0.82, (z1 + z2)/2))
	vaults.append({"x1": x - 0.3, "x2": x + 0.3, "z1": z1, "z2": z2, "s": solid(x - 0.3, x + 0.3, z1, z2, -1, 1.0)})
func _van() -> Dictionary:
	var n := Node3D.new(); g.add_child(n); props.append(n)
	_box(Vector3(2.3, 2.3, 5.6), _mat(Color(0.08, 0.11, 0.16), false, 0.5, 0.35), Vector3(0, 1.35, 0), n)
	_box(Vector3(2.1, 0.7, 0.05), _mat(Color(0.1, 0.15, 0.2), false, 0.6, 0.1), Vector3(0, 1.85, 2.81), n)
	_box(Vector3(2.32, 0.2, 5.62), _mat(Color(0.3, 1, 1), true), Vector3(0, 1.1, 0), n)
	var red := _box(Vector3(0.7, 0.16, 0.3), _mat(Color(1, 0.1, 0.08), true), Vector3(-0.45, 2.58, 1.6), n)
	var blue := _box(Vector3(0.7, 0.16, 0.3), _mat(Color(0.1, 0.3, 1), true), Vector3(0.45, 2.58, 1.6), n)
	for w in [[-1.1, 1.8], [1.1, 1.8], [-1.1, -1.8], [1.1, -1.8]]:
		var t := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.42; cm.bottom_radius = 0.42; cm.height = 0.3; t.mesh = cm
		t.material_override = _mat(Color(0.04, 0.04, 0.04)); t.rotation.z = PI/2; t.position = Vector3(w[0], 0.42, w[1]); n.add_child(t)
	var light := OmniLight3D.new(); light.light_color = Color(1, 0.2, 0.2); light.light_energy = 2.5; light.omni_range = 12; light.position = Vector3(0, 3, 0); n.add_child(light)
	return {"n": n, "red": red, "blue": blue, "light": light, "s": null}
func van_place(v: Dictionary, x: float, z: float, ry: float) -> void:
	v.n.position = Vector3(x, 0, z); v.n.rotation.y = ry
	var along := absf(sin(ry)) > 0.7
	var hx := 2.8 if along else 1.15; var hz := 1.15 if along else 2.8
	unsolid(v.s); v.s = solid(x - hx, x + hx, z - hz, z + hz, -1, 2.5)
func _gap_barrier(z: float) -> Dictionary:
	var n := Node3D.new(); g.add_child(n); props.append(n)
	_box(Vector3(3.0, 3.4, 0.3), _mat(Color(0.09, 0.125, 0.17), false, 0.6, 0.4), Vector3(-22.5, 1.7, z), n)
	for y in [0.8, 2.2]: _box(Vector3(3.02, 0.14, 0.32), _mat(Color(0.3, 1, 1), true), Vector3(-22.5, y, z), n)
	n.position.y = 5
	return {"n": n, "s": null, "z": z}
func _roof_gate() -> Dictionary:
	var r: Dictionary = ROUTE.roofEast; var x: float = ROUTE.gate.x; var top: float = r.h
	var fence := _mat(Color(0.42, 0.45, 0.43), false, 0.7, 0.5); fence.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; fence.render_priority = 101; fence.albedo_color.a = 0.55
	for ab in [[r.z[0] + 0.4, ROUTE.gate.z1], [ROUTE.gate.z2, r.z[1] - 0.4]]:
		_box(Vector3(0.08, 3.2, ab[1] - ab[0]), fence, Vector3(x, top + 1.6, (ab[0] + ab[1])/2))
		solid(x - 0.15, x + 0.15, ab[0], ab[1], top - 0.5, top + 3.2)
	var panel := _box(Vector3(0.12, 2.6, ROUTE.gate.z2 - ROUTE.gate.z1), _mat(Color(0.23, 0.27, 0.26), false, 0.7, 0.4), Vector3(x, top + 3.7, (ROUTE.gate.z1 + ROUTE.gate.z2)/2))
	var lamp := _box(Vector3(0.3, 0.1, 0.3), _mat(Color(1, 0.7, 0.1), true), Vector3(x, top + 3.3, ROUTE.gate.z2 + 0.3))
	return {"panel": panel, "lamp": lamp, "open": 1.0, "closing": false, "s": null, "top": top}
func _ac_unit(x: float, z: float, top: float, w: float, d: float, h: float) -> void:
	var box := _box(Vector3(w, h, d), _mat(Color(0.55, 0.57, 0.56), false, 0.4, 0.5), Vector3(x, top + h/2, z))
	var fan := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = minf(w, d)*0.35; cm.bottom_radius = cm.top_radius; cm.height = 0.06; fan.mesh = cm
	fan.material_override = _mat(Color(0.12, 0.12, 0.12)); fan.position = Vector3(x, top + h + 0.03, z); g.add_child(fan); props.append(fan)
	var s := solid(x - w/2, x + w/2, z - d/2, z + d/2, top - 0.1, top + h)
	covers.append({"x1": x - w/2, "x2": x + w/2, "z1": z - d/2, "z2": z + d/2, "y": top, "top": top + h, "cx": x, "cz": z, "s": s})
func _gunship() -> Dictionary:
	var n := Node3D.new(); g.add_child(n); props.append(n)
	var navy := _mat(Color(0.06, 0.09, 0.14), false, 0.6, 0.35)
	_box(Vector3(3.2, 2.2, 7), navy, Vector3.ZERO, n)
	_box(Vector3(2.6, 1.4, 1.6), _mat(Color(0.1, 0.16, 0.2), false, 0.6, 0.1), Vector3(0, -0.2, 4.0), n)
	_box(Vector3(0.7, 0.7, 6), navy, Vector3(0, 0.4, -6.2), n)
	_box(Vector3(0.15, 1.8, 1.2), navy, Vector3(0, 1.1, -8.9), n)
	_box(Vector3(3.22, 0.18, 7.02), _mat(Color(0.3, 1, 1), true), Vector3(0, -0.4, 0), n)
	var rot := MeshInstance3D.new(); var cyl := CylinderMesh.new(); cyl.top_radius = 6.5; cyl.bottom_radius = 6.5; cyl.height = 0.02; rot.mesh = cyl
	var rm := _mat(Color(0.6, 0.7, 0.7)); rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; rm.render_priority = 101; rm.albedo_color.a = 0.18; rot.material_override = rm; rot.position.y = 1.5; n.add_child(rot)
	var red := _box(Vector3(0.3, 0.3, 0.3), _mat(Color(1, 0.1, 0.08), true), Vector3(-1.7, 0, 0), n)
	var blue := _box(Vector3(0.3, 0.3, 0.3), _mat(Color(0.1, 0.3, 1), true), Vector3(1.7, 0, 0), n)
	var spot := SpotLight3D.new(); spot.light_color = Color(0.95, 1, 0.95); spot.light_energy = 14; spot.spot_range = 80; spot.spot_angle = 9; spot.shadow_enabled = true; g.add_child(spot); props.append(spot)
	var cone := MeshInstance3D.new(); var cn := CylinderMesh.new(); cn.top_radius = 0.05; cn.bottom_radius = 1.0; cn.height = 1.0; cone.mesh = cn
	var cmat := _mat(Color(1, 1.0, 0.9)); cmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; cmat.render_priority = 101; cmat.albedo_color.a = 0.07; cmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; cmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	cone.material_override = cmat; g.add_child(cone); props.append(cone)
	return {"n": n, "rot": rot, "red": red, "blue": blue, "spot": spot, "cone": cone, "x": 110.0, "y": 40.0, "z": -20.0, "yaw": -PI/2,
		"light": {"x": 52.0, "z": -22.0, "y": 13.0, "r": 5.5}, "state": "arrive", "t": 0.0, "sweep": 0.0, "leave": false, "dwell": 0.0}

# ================================================================== the stages
func build() -> void:
	if built: return
	built = true; clock = 0
	ROUTE.barriers.map(func(b): _barrier(b[0], b[1], b[2]))
	var a: Dictionary = ROUTE.ac; _ac_unit(a.x, a.z, ROUTE.roofEast.h, a.w, a.d, a.h)
	for c in ROUTE.covers: _ac_unit(c[0], c[1], c[2], c[3], c[4], c[5])
	gate = _roof_gate()
	var v1 := _van(); var v2 := _van(); van_place(v1, -56, -2.8, PI/2); van_place(v2, -31, -2.8, -PI/2)
	vans = [v1, v2]
func start(from := 0, drone = null) -> void:
	build(); on = true
	fire_t = 3; strafe_t = 9; hits = 0; last_hit_t = -99; spotted_t = -99; cold_note_t = 0
	cover = null; act = null; climb = null
	drones = []
	for i in 2:
		var d = drone if (i == 0 and drone != null) else spawn_drone(Vector3(ROUTE.mouth.x + (10 if i else -10), 13, ROUTE.mouth.y + 6))
		d.hunter = true; d.state = "track"; d.side = 1.0 if i else -1.0; d.yT = 13.0
		drones.append(d)
	set_heat(maxi(heat, 3))
	stars.visible = true
	go(from, true)
func stop() -> void:
	on = false; built = false
	for m in missiles: _kill_missile(m)
	missiles.clear()
	for p in props: if is_instance_valid(p): p.queue_free()
	props.clear()
	for s in extra_solids.duplicate(): unsolid(s)
	for c in cops: c.node.queue_free()
	cops.clear()
	for d in drones: d.node.queue_free()
	drones.clear()
	vaults.clear(); covers.clear(); vans.clear(); gun = null; gate = null; wfc_barrier = null; st.erase("cop"); st.erase("van")
	stars.visible = false
	g.lesson_card("", "", "")
func go(i: int, first := false) -> void:
	st.i = i; st.t = 0.0
	var s := stage(); if s.is_empty(): return
	g.S.raid = {"stage": i}
	if not s.has("fight"): card(s.title, s.how, i + 1)
	g.objective(_goal(), _info())
	match s.id:
		"run":
			_shoes(true)
			if first: later(1.6, func(): if on and not fighting(): g.talk("raidRun"))
		"van":
			_shoes(true)
			var v := _van(); vans.append(v); st.van = v
			g.cue("kick")
			var tw: Tween = g.create_tween()
			tw.tween_method(func(k): van_place(v, lerpf(ROUTE.van.x + 30, ROUTE.van.x, 1 - (1 - k)*(1 - k)), ROUTE.van.y, -PI/2 + (1 - k)*0.4), 0.0, 1.0, 0.9)
			tw.tween_callback(func(): van_place(v, ROUTE.van.x, ROUTE.van.y, 0); g.cue("door"))
			later(1.0, func(): g.raid.fight(1, func(): g.talk("raidSorry"); next()))
		"wall": _shoes(true); wfc_barrier = _gap_barrier(ROUTE.barrier); st.flags.barrierDown = false
		"roofs": _shoes(false); g.talk("raidSpace")
		"rappel":
			_shoes(false); _ensure_gun(); gun.x = 60.0; gun.y = 34.0; gun.z = -24.0; gun.state = "hunt"; gun.leave = false
			g.raid.fight(2, func(): g.talk("raidTrains"); next())
		"hide":
			_shoes(false)
			for d in drones: d.state = "search"
			_ensure_gun(); g.talk("raidGun"); gun.state = "arrive"; gun.leave = false
			st.flags.copAt = 9.0; st.flags.hiddenT = 0.0
		"call":
			_shoes(false); _ensure_gun(); _ensure_cop()
			st.flags.ringT = 0.0; st.flags.answered = false; st.flags.found = false
			g.ringing(true); g.phone_show("call", "MOM"); g.talk("momRing")
		"found":
			_shoes(false); g.ringing(false); g.phone_show(""); _ensure_gun()
			g.raid.fight(3, func(): next())
		"home":
			_shoes(false); g.ringing(false)
			for d in drones: d.state = "track"
			_ensure_gun(); gun.state = "hunt"; gun.leave = false
			set_heat(maxi(heat, 4)); strafe_t = randf_range(STRAFE.every[0], STRAFE.every[1])
			for j in 2: _rappel(Vector3([69, 76][j], 11, [-24, -16][j]))
	later(0.5, func(): if on and st.i == i: g._save())
func next() -> void:
	if st.i < STAGES.size() - 1: go(st.i + 1)
func _goal() -> String:
	return {"run": "Run.", "van": "Fight your way out.", "wall": "Up the wall.", "roofs": "Over the roofs, east.", "rappel": "Fight your way out.", "hide": "Hide.",
		"call": "Answer it. Quietly.", "found": "Fight your way out.", "home": "Get home."}.get(sid(), "")
func _info() -> Array:
	var s := sid(); var out := []
	if st.i < stage_at("roofs"): out.append("The shoes are cold after the fight — on foot until they charge.")
	if s == "run": out.append("SPACE at a barrier vaults it. A red ring is a missile: get out of it.")
	if fighting(): out.append("CLICK strike · hold CLICK power · SPACE dodge · R parry · G pull · F pulse.")
	if s == "wall": out.append("G facing the wall. W climbs.")
	if s == "roofs": out.append("In the air, a lock follows you: SHIFT dives, or turn, and it misses.")
	if s == "hide" or s == "call": out.append("Behind cover, WASD move you round it. Keep it between you and them.")
	if s == "home": out.append_array(["Home is the roof over 214 Harbor Lane. Heat cools while nobody can see you — fastest behind cover.", "Nobody follows you onto your own roof: lose every star first."])
	return out
func card(title: String, how: String, i: int) -> void:
	g.lesson_card("THE CHASE · %d / %d" % [i, STAGES.size()], title, how); g.cue("ui")
	var my: int = st.i
	later(7.0, func(): if on and st.i == my: g.lesson_card("", "", ""))
func _shoes(cold: bool) -> void:
	g.boots.have = {}
	if not cold:
		for t in (g.S.boots if g.S.get("boots", []).size() else Boots.EARLY + Boots.MID): g.boots.have[t] = true
func _ensure_gun() -> void:
	if gun == null: gun = _gunship()
func _ensure_cop() -> void:
	if st.get("cop") != null and is_instance_valid(st.cop.node) and st.cop in cops: return
	var o := spawn_cop(Vector3(55, ROUTE.roofEast.h, -40), "patrol")
	o.route = [Vector2(55.4, -30), Vector2(55.4, -13.4), Vector2(50.6, -13.4), Vector2(50.6, -22.4), Vector2(55.4, -22.4), Vector2(55.4, -40)]; o.ri = 0
	o.eye = {"range": 15.0, "fov": 0.85}
	st.cop = o
func _rappel(at: Vector3) -> void:
	var n := spawn_cop(at + Vector3(0, 7, 0), "drop")
	var tw: Tween = g.create_tween()
	tw.tween_method(func(y): n.y = y, at.y + 7, at.y, 1.3)
	tw.tween_callback(func(): n.state = "pursue"; g.cue("step"))

# ================================================================== WFC on foot, and the drones
func spawn_cop(at: Vector3, state: String) -> Dictionary:
	var node: Node3D = (load("res://assets/tsh/people/%s.glb" % ["thug-a", "thug-b"].pick_random()) as PackedScene).instantiate()
	g.add_child(node); g.fight.dress_wfc(node)
	var ap: AnimationPlayer = g._find(node, func(x): return x is AnimationPlayer)
	for nm in ap.get_animation_list():
		if nm in ["idle", "walk", "sprint", "fight"]: ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
	var c := {"node": node, "ap": ap, "x": at.x, "y": at.y, "z": at.z, "yaw": 0.0, "state": state, "t": 0.0, "sees": false, "clip": "", "eye": {"range": 24.0, "fov": 1.0}, "stun": 0.0, "route": [], "ri": 0}
	cops.append(c); _cop_place(c)
	return c
func _cop_play(c: Dictionary, nm: String) -> void:
	if c.clip != nm and c.ap.has_animation(nm): c.clip = nm; c.ap.play(nm, 0.2)
func _cop_place(c: Dictionary) -> void:
	c.node.position = Vector3(c.x, c.y, c.z); c.node.rotation.y = c.yaw
func spawn_drone(at: Vector3) -> Dictionary:
	var n := Node3D.new(); g.add_child(n)
	_box(Vector3(0.7, 0.22, 0.7), _mat(Color(0.1, 0.12, 0.16), false, 0.6, 0.3), Vector3.ZERO, n)
	for ax in [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]:
		var r := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.28; cm.bottom_radius = 0.28; cm.height = 0.02; r.mesh = cm
		var rm := _mat(Color(0.6, 0.7, 0.7)); rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; rm.render_priority = 101; rm.albedo_color.a = 0.3; r.material_override = rm; r.position = Vector3(ax[0], 0.12, ax[1]); n.add_child(r)
	var eye := _box(Vector3(0.16, 0.16, 0.16), _mat(Color(1, 0.15, 0.1), true), Vector3(0, -0.14, 0.3), n)
	var spot := SpotLight3D.new(); spot.light_color = Color(1, 0.3, 0.25); spot.light_energy = 6; spot.spot_range = 30; spot.spot_angle = 14; spot.rotation.x = -PI/2.3; n.add_child(spot)
	n.position = at
	return {"node": n, "eye": eye, "x": at.x, "y": at.y, "z": at.z, "yaw": 0.0, "state": "patrol", "hunter": false, "side": 1.0, "yT": 13.0, "static": 0.0, "stun": 0.0, "sees": false}

func _sees(eye: Vector3, rng: float, p: Vector3) -> bool:
	if g.hidden_in_cover() and (eye - p).length() > 2.0: return false
	if (eye - p).length() > rng: return false
	# something in the way: walls between them (a few samples along the line)
	for i in range(1, 8):
		var q := eye.lerp(p + Vector3(0, 1.2 if cover == null else 0.6, 0), i/8.0)
		if g.boots.overlapping(q.x, q.z, q.y - 0.9) != null: return false
	return true

func _tick_cops(dt: float, p: Vector3) -> void:
	for c in cops:
		c.t += dt; c.stun = maxf(0, c.stun - dt)
		var d := Vector2(c.x - p.x, c.z - p.z).length()
		var face_ok: bool = absf(Fight.ang_diff(Fight.ang_to(c.x, c.z, p.x, p.z), c.yaw)) < c.eye.fov*1.4 or d < 3
		c.sees = c.stun <= 0 and face_ok and _sees(Vector3(c.x, c.y + 1.6, c.z), c.eye.range, p)
		match c.state:
			"drop": _cop_play(c, "idle")
			"pursue", "search":
				if c.sees: c.state = "pursue"; last_known = Vector2(p.x, p.z)
				var tgt := Vector2(p.x, p.z) if c.state == "pursue" and c.sees else last_known
				var dv := tgt - Vector2(c.x, c.z)
				if dv.length() > 1.0 and absf(c.y - p.y) < 3:
					var sp := 5.0 if c.sees else 2.6
					var step := dv.normalized()*minf(dv.length(), sp*dt)
					if g.boots.overlapping(c.x + step.x, c.z + step.y, c.y) == null: c.x += step.x; c.z += step.y
					c.yaw = atan2(dv.x, dv.y); _cop_play(c, "sprint" if c.sees else "walk")
				else: _cop_play(c, "fight" if c.sees else "idle")
				if c.sees and d < 1.3 and absf(c.y - p.y) < 1.2 and g.mode == "" and act == null: hit(c.x, c.z)
			"patrol":
				if c.route.size():
					var w: Vector2 = c.route[c.ri]; var dv2 := w - Vector2(c.x, c.z)
					if dv2.length() < 0.5: c.ri = (c.ri + 1) % c.route.size()
					else: var s2 := dv2.normalized()*minf(dv2.length(), 1.3*dt); c.x += s2.x; c.z += s2.y; c.yaw = atan2(dv2.x, dv2.y); _cop_play(c, "walk")
				if c.sees and sid() != "call": c.state = "pursue"
			"circle": _circle(c, dt)
			"cut": _cop_play(c, "fight")
		_cop_place(c)

func _hunter_goal(n: Dictionary) -> Vector3:
	var p := P()
	if n.state != "track":
		var lk := last_known; var a: float = clock*0.35 + n.side*PI
		return Vector3(lk.x + cos(a)*16, maxf(16, p.y + 10), lk.y + sin(a)*16)
	var v := vel(); var sp := Vector2(v.x, v.z).length()
	var hx: float = v.x/sp if sp > 1 else -sin(g.cam_yaw); var hz: float = v.z/sp if sp > 1 else -cos(g.cam_yaw)
	return Vector3(p.x - hx*7 + hz*n.side*9, maxf(13, p.y + 9), p.z - hz*7 - hx*n.side*9)
func _tick_drones(dt: float, p: Vector3) -> void:
	for n in drones:
		n.static = maxf(0, n.static - dt)
		var goal := _hunter_goal(n) if n.hunter else Vector3(n.x, n.yT, n.z)
		if n.has("pin"): goal = Vector3(n.pin.x, n.yT, n.pin.y)
		var dv := Vector2(goal.x - n.x, goal.z - n.z)
		if dv.length() > 0.2:
			var s := dv.normalized()*minf(dv.length(), 7.5*dt); n.x += s.x; n.z += s.y
			n.yaw = lerp_angle(n.yaw, atan2(dv.x, dv.y), minf(1, dt*2.5))
		n.y = lerpf(n.y, goal.y, minf(1, dt*1.5))
		n.node.position = Vector3(n.x, n.y + sin(clock*2 + n.side)*0.15, n.z); n.node.rotation.y = n.yaw
		n.sees = n.static <= 0 and _sees(Vector3(n.x, n.y, n.z), 22, p)
		if n.sees: n.state = "track"

# ================================================================== a frame
func tick(dt: float) -> void:
	if not on: return
	clock += dt; st.t += dt
	var p := P()
	_tick_vans()
	if fighting():
		for m in missiles: _kill_missile(m)
		missiles.clear()
		if gun != null: _tick_gun(dt, p, true)
		fire_t = 3; return
	if clock - last_hit_t > HITS_FORGET: hits = 0
	cold_note_t -= dt
	_tick_cops(dt, p)
	_tick_drones(dt, p)
	var seen_now := cops.any(func(c): return c.sees) or drones.any(func(d): return d.sees)
	if seen_now: spotted_t = clock; last_known = Vector2(p.x, p.z)
	st.flags.seenNow = clock - spotted_t < 0.5
	_tick_heat(dt)
	match sid():
		"run": _t_run(p)
		"wall": _t_wall(p)
		"roofs": _t_roofs(p)
		"hide": _t_hide(dt, p)
		"call": _t_call(dt, p)
		"home": _t_home(p)
	_tick_missiles(dt)
	_tick_gun(dt, p, false)
	_tick_gate(dt)
	if wfc_barrier != null and st.flags.get("barrierDown", false) and wfc_barrier.s == null:
		wfc_barrier.s = solid(-24, -21, ROUTE.barrier - 0.25, ROUTE.barrier + 0.25, -1, 3.4)
	fire_t -= dt
	if fire_t <= 0 and _can_fire():
		var air: bool = not g.boots.ground and g.mode == ""
		fire(air); fire_t = randf_range(MISSILE.gapAir[0], MISSILE.gapAir[1]) if air else randf_range(MISSILE.gapGround[0], MISSILE.gapGround[1])
	stars.text = "★".repeat(heat) + "☆".repeat(5 - heat)

func _tick_heat(dt: float) -> void:
	var floor_h: int = stage().get("floor", 0)
	if st.flags.get("seenNow", false): seen_t = 0.0; return
	seen_t += dt
	if heat <= floor_h: heat = maxi(heat, floor_h); return
	if seen_t >= (COOL.cover if cover != null else COOL.unseen): heat -= 1; seen_t = 0.0; g.cue("ui")
func set_heat(h: int) -> void: heat = clampi(h, 0, 5); seen_t = 0.0

func _t_run(p: Vector3) -> void:
	if not st.flags.get("firstShot", false) and p.x > -38.5:
		st.flags.firstShot = true; fire(false, true); card("INCOMING", "A red line, a tone, a ring: a missile. Get out of the ring.", 1)
	if p.x > ROUTE.runDone and p.z > -12 and p.y < 1: next()
func _in_gap(p: Vector3) -> bool:
	var gp: Dictionary = ROUTE.gap
	return p.x > gp.x1 - 0.2 and p.x < gp.x2 + 0.2 and p.z > gp.z1 and p.z < gp.z2 + 1
func on_roof(p: Vector3, ids: Array) -> bool:
	for r in g.boots.roofs:
		if r.id in ids and p.x > r.x1 and p.x < r.x2 and p.z > r.z1 and p.z < r.z2 and absf(p.y - r.top) < 2.5: return true
	return false
func _t_wall(p: Vector3) -> void:
	if not st.flags.get("barrierDown", false) and _in_gap(p) and p.z < -16:
		st.flags.barrierDown = true; g.cue("clang"); g.fight.shake(0.25, 0.4)
		var tw: Tween = g.create_tween(); tw.tween_property(wfc_barrier.n, "position:y", 0.0, 0.35)
		g.talk("raidWall")
		for i in 2:
			var c := spawn_cop(Vector3(-22.5 + (i - 0.5)*1.2, 0, -9 + i), "pursue"); c.sees = true
		last_known = Vector2(p.x, p.z)
	if climb != null and not st.flags.get("onWall", false): st.flags.onWall = true; later(1.4, func(): if on and not fighting(): g.talk("raidOnWall"))
	if p.y > 10 and on_roof(p, ["B5", "B4"]): g.talk("raidRoof"); next()
func _t_roofs(p: Vector3) -> void:
	var r: Dictionary = ROUTE.roofEast
	if not st.flags.get("landed", false) and p.y > 8 and g.boots.ground and not on_roof(p, ["B5", "B4"]): st.flags.landed = true; g.talk("raidLanded")
	if on_roof(p, ["B8"]) and g.boots.ground and p.x < ROUTE.gate.x - 0.5 and p.y > r.h - 1: next(); return
	if on_roof(p, ["B8"]) and p.x > ROUTE.gate.x + 1 and p.y > r.h - 1: st.i += 1; next()
func _t_hide(dt: float, p: Vector3) -> void:
	if gate != null and not gate.closing and on_roof(p, ["B8"]) and p.x > ROUTE.gate.x - 10 and p.x < ROUTE.gate.x: gate.closing = true; g.cue("alarm")
	if st.flags.has("copAt") and (cover != null or st.t > st.flags.copAt): st.flags.erase("copAt"); _ensure_cop()
	if not st.flags.get("hideTip", false) and cover != null: st.flags.hideTip = true; g.talk("raidShh")
	var unseen: bool = cover != null and not st.flags.seenNow
	st.flags.hiddenT = st.flags.hiddenT + dt if unseen else 0.0
	if st.flags.hiddenT > 6: next()
func _t_call(dt: float, p: Vector3) -> void:
	var f: Dictionary = st.flags; var cop = st.get("cop")
	if f.found: return
	if not f.answered:
		f.ringT += dt
		if f.ringT > 1.5: f.ringT = 0.0; g.cue("ui")
		if cop != null and cop.sees and Vector2(cop.x - p.x, cop.z - p.z).length() < 4: g.ringing(false); found()
		return
	if f.get("callOver", false) and (cop == null or cop.state != "circle"):
		f.lateT = f.get("lateT", 0.0) + dt
		if f.lateT > 1.5: found()
	if cop != null and not f.found:
		if not cop.has("circ"): cop.circ = {"a": atan2(cop.x - covers[0].cx, cop.z - covers[0].cz), "dir": 1.0}; cop.state = "circle"
		if cop.sees and Vector2(cop.x - p.x, cop.z - p.z).length() < 6: found()
func _circle(n: Dictionary, dt: float) -> void:
	var c: Dictionary = covers[0]; var f: Dictionary = st.flags
	var rr := maxf(c.x2 - c.x1, c.z2 - c.z1)/2 + 1.6
	n.circ.a += n.circ.dir*dt*0.32
	var tx: float = c.cx + sin(n.circ.a)*rr; var tz: float = c.cz + cos(n.circ.a)*rr
	var dv := Vector2(tx - n.x, tz - n.z)
	if dv.length() > 0.05: var s := dv.normalized()*minf(dv.length(), 1.1*dt); n.x += s.x; n.z += s.y; n.yaw = atan2(dv.x, dv.y)
	_cop_play(n, "walk")
	if f.get("callOver", false) and not f.found:
		var pa := atan2(P().x - c.cx, P().z - c.cz)
		n.circ.dir = 2.4 if Fight.ang_diff(pa, n.circ.a) > 0 else -2.4
		if absf(Fight.ang_diff(pa, n.circ.a)) < 0.35: found()
func answer() -> void:
	var f: Dictionary = st.flags
	if f.answered: return
	f.answered = true; g.ringing(false); g.phone_show("oncall", "MOM"); g.cue("ui")
	g.objective("Keep him on the other side of the box.", _info())
	card("MOM", "Keep talking. Keep the box between you and him — WASD round it.", 7)
	g.talk("momCall1", func():
		if not on or f.found: return
		_boom_at(Vector3(70, 11, -24), true); g.cue("alarm")
		g.talk("momCall2", func():
			if not on or f.found: return
			g.talk("momAfter", func(): f.callOver = true)))
func found() -> void:
	var f: Dictionary = st.flags
	if f.found: return
	f.found = true; g.talk_q.clear(); g.ringing(false); g.phone_show("")
	var cop = st.get("cop")
	if cop != null: cop.erase("circ"); cop.state = "cut"; cop.yaw = atan2(P().x - cop.x, P().z - cop.z)
	if cover != null: leave_cover(true)
	next()
func _t_home(p: Vector3) -> void:
	var h: Dictionary = ROUTE.home
	var on_home: bool = p.x > h.x1 and p.x < h.x2 and p.z > h.z1 and p.z < h.z2 and p.y > h.h - 1 and g.boots.ground
	if on_home and g.mode == "":
		if heat > 0:
			if cold_note_t <= 0: cold_note_t = 6; g.note("Not with them on you — they'd see which building. Lose every star first.")
		else:
			on = false
			for m in missiles: _kill_missile(m)
			missiles.clear(); g.raid.home()
func _tick_vans() -> void:
	var k := int(clock*4) % 2 == 0
	for v in vans:
		if not is_instance_valid(v.n): continue
		v.red.visible = k; v.blue.visible = not k; v.light.light_color = Color(1, 0.23, 0.23) if k else Color(0.23, 0.42, 1)

# ================================================================== her moves on foot
func _fwd() -> Vector2:
	var v := Vector2(g.boots.vx, g.boots.vz)
	return v.normalized() if v.length() > 1.2 else Vector2(-sin(g.cam_yaw), -cos(g.cam_yaw))
func parkour():
	if g.mode != "" or not g.boots.ground or act != null: return null
	var p := P(); var f := _fwd()
	for v in vaults:
		var cx := clampf(p.x, v.x1, v.x2); var cz := clampf(p.z, v.z1, v.z2)
		if Vector2(cx - p.x, cz - p.z).length() > 1.7 or p.y > 0.8: continue
		if (cx - p.x)*f.x + (cz - p.z)*f.y < -0.1: continue
		return {"kind": "vault", "v": v}
	if gate != null and gate.open > 0.25 and on_roof(p, ["B8"]):
		var d: float = ROUTE.gate.x - p.x
		if d > 0 and d < 3.2 and p.z > ROUTE.gate.z1 - 0.6 and p.z < ROUTE.gate.z2 + 0.6 and f.x > 0.3: return {"kind": "slide"}
	return null
func _vault(v: Dictionary) -> void:
	var p := P(); var f := _fwd()
	var thick: float = (v.x2 - v.x1) if absf(f.x) > absf(f.y) else (v.z2 - v.z1)
	var ln := thick + 2.2; var to := Vector2(p.x + f.x*ln, p.z + f.y*ln)
	_act("vault", 0.48, func(k): _set_pos(Vector3(lerpf(p.x, to.x, k), p.y + sin(k*PI)*1.25, lerpf(p.z, to.y, k))), "jump", atan2(f.x, f.y))
	g.cue("kick")
	if not st.flags.get("vaulted", false): st.flags.vaulted = true; g.note("✓ VAULT")
func _slide() -> void:
	var p := P(); var ln: float = ROUTE.gate.x - p.x + 3.4
	_act("slide", 0.62, func(k): _set_pos(Vector3(lerpf(p.x, p.x + ln, k), p.y, lerpf(p.z, clampf(p.z, ROUTE.gate.z1 + 0.5, ROUTE.gate.z2 - 0.5), minf(1, k*3)))), "roll", PI/2)
	g.cue("kick"); g.talk("raidGate")
func _set_pos(q: Vector3) -> void:
	g.boots.x = q.x; g.boots.y = q.y; g.boots.z = q.z; g.robin.position = q
func _act(nm: String, dur: float, f: Callable, clip: String, face: float) -> void:
	act = {"name": nm, "t": 0.0, "dur": dur, "f": f, "clip": clip, "face": face}
	g.play(clip, 0.08)
## the gecko cuffs: G facing a wall, and up it to the top
func try_climb() -> bool:
	if act != null or g.mode != "": return false
	var p := P(); var f := Vector2(-sin(g.cam_yaw), -cos(g.cam_yaw))
	var best = null
	for s in g.boots.solids:
		if s[5] < p.y + 2.5 or s[4] > p.y + 1: continue
		var cx := clampf(p.x, s[0], s[1]); var cz := clampf(p.z, s[2], s[3])
		var d := Vector2(cx - p.x, cz - p.z)
		if d.length() < 1.2 and (d.length() < 0.05 or d.normalized().dot(f) > 0.3): best = s; break
	if best == null: g.note("🦎 G — facing a wall."); return false
	var top: float = best[5]
	var cx2 := clampf(p.x + f.x*1.5, best[0] + 0.6, best[1] - 0.6); var cz2 := clampf(p.z + f.y*1.5, best[2] + 0.6, best[3] - 0.6)
	var dur := maxf(1.2, (top - p.y)/4.5)
	climb = true
	_act("climb", dur, func(k):
		if k < 0.88: _set_pos(Vector3(p.x, lerpf(p.y, top, k/0.88), p.z))
		else: _set_pos(Vector3(lerpf(p.x, cx2, (k - 0.88)/0.12), top, lerpf(p.z, cz2, (k - 0.88)/0.12))), "climb_up", atan2(f.x, f.y))
	g.cue("grab")
	return true
func tick_act(dt: float) -> bool:
	if act == null: return false
	act.t += dt
	var k := minf(1.0, act.t/act.dur)
	act.f.call(k)
	g.model.rotation.y = act.face; g.play(act.clip, 0.08)
	if k >= 1:
		act = null
		g.boots.vx = 0; g.boots.vy = 0; g.boots.vz = 0; g.boots.ground = true; g.boots.state = "ground"
	return true

# ------------------------------------------------------------------ knocked down
func hit(fx: float, fz: float) -> void:
	if clock - last_hit_t < 1.6: return
	if clock - last_hit_t > HITS_FORGET: hits = 0
	hits += 1; last_hit_t = clock
	g.cue("hurt"); g.fight.shake(0.45, 0.5)
	if cover != null: leave_cover(true)
	if hits >= HITS: g.note("WFC has you."); caught(); return
	g.note("Knocked flat. Once more and they have you.")
	var p := P(); var a := atan2(p.x - fx, p.z - fz)
	var to := Vector2(p.x + sin(a)*2.2, p.z + cos(a)*2.2)
	if g.boots.overlapping(to.x, to.y, p.y) != null: to = Vector2(p.x, p.z)
	_act("down", 1.1, func(k): _set_pos(Vector3(lerpf(p.x, to.x, minf(1, k*2)), p.y, lerpf(p.z, to.y, minf(1, k*2)))), "stagger", a + PI)
## WFC has her: not a game over — the stage again, from its top
func caught() -> void:
	var i: int = st.i
	g.black(true); g.cue("fail")
	later(1.3, func():
		g.black(false)
		var at := _stage_start(i)
		stop(); g.place(at, PI/2); start(i))
func _stage_start(i: int) -> Vector3:
	match STAGES[i].id:
		"run", "van": return Vector3(-41.3, 0, -7.8)
		"wall": return Vector3(-27, 0, -6)
		"roofs", "rappel": return Vector3(-17, 16, -25)
		"hide", "call", "found": return Vector3(44, 13, -27)
	return Vector3(52, 13, -24)

# ================================================================== cover
func near_cover():
	var p := P()
	for c in covers:
		if absf(p.y - c.y) < 1.2 and p.x > c.x1 - 1.6 and p.x < c.x2 + 1.6 and p.z > c.z1 - 1.6 and p.z < c.z2 + 1.6: return c
	return null
func enter_cover(c: Dictionary) -> void:
	cover = {"c": c, "s": _perim_s(c, P().x, P().z)}
	g.cue("step")
	if not st.flags.get("coverTip", false): st.flags.coverTip = true; g.note("🧱 WASD — move round it · E or SPACE — up and out")
func leave_cover(quiet := false) -> void:
	if cover == null: return
	cover = null
	if not quiet: g.cue("step")
func _perim(c: Dictionary) -> Dictionary:
	var o := 0.55
	var x1: float = c.x1 - o; var x2: float = c.x2 + o; var z1: float = c.z1 - o; var z2: float = c.z2 + o
	return {"x1": x1, "x2": x2, "z1": z1, "z2": z2, "w": x2 - x1, "d": z2 - z1, "L": 2*(x2 - x1 + z2 - z1)}
func _perim_at(c: Dictionary, s: float) -> Array:
	var P_ := _perim(c); s = fposmod(s, P_.L)
	if s < P_.w: return [P_.x1 + s, P_.z1, 0.0, -1.0]
	s -= P_.w
	if s < P_.d: return [P_.x2, P_.z1 + s, 1.0, 0.0]
	s -= P_.d
	if s < P_.w: return [P_.x2 - s, P_.z2, 0.0, 1.0]
	s -= P_.w
	return [P_.x1, P_.z2 - s, -1.0, 0.0]
func _perim_s(c: Dictionary, x: float, z: float) -> float:
	var best := 0.0; var bd := INF; var L: float = _perim(c).L; var s := 0.0
	while s < L:
		var q := _perim_at(c, s); var d := Vector2(q[0] - x, q[1] - z).length()
		if d < bd: bd = d; best = s
		s += 0.1
	return best
func tick_cover(dt: float) -> bool:
	if cover == null: return false
	var c: Dictionary = cover.c
	var kx := float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A))
	var kz := float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S))
	if kx != 0 or kz != 0:
		var sy := sin(g.cam_yaw); var cy := cos(g.cam_yaw)
		var wx := kx*cy - kz*sy; var wz := -kx*sy - kz*cy
		var a := _perim_at(c, cover.s); var b := _perim_at(c, cover.s + 0.05)
		var t := Vector2(b[0] - a[0], b[1] - a[1]).normalized(); var r := Vector2(a[0] - c.cx, a[1] - c.cz).normalized(); var w := Vector2(wx, wz).normalized()
		var along := w.dot(t)
		if absf(along) < 0.25: along = r.x*w.y - r.y*w.x
		if absf(along) > 0.2: cover.s += signf(along)*1.7*dt
	var q := _perim_at(c, cover.s)
	_set_pos(Vector3(q[0], c.y, q[1]))
	g.model.rotation.y = atan2(q[2], q[3]); g.play("kneel", 0.15)
	return true

# ================================================================== the missiles
func _can_fire() -> bool:
	if cover != null or act != null or g.mode != "": return false
	var s := sid()
	if s == "run" and not st.flags.get("firstShot", false): return false
	if (s == "hide" or s == "call") and clock - spotted_t > 3: return false
	return missiles.filter(func(m): return m.phase != "gone").size() < MISSILE.live
func _shooter(p: Vector3):
	var hs := drones.filter(func(d): return d.static <= 0 and d.sees)
	hs.sort_custom(func(a, b): return Vector2(a.x - p.x, a.z - p.z).length() < Vector2(b.x - p.x, b.z - p.z).length())
	if hs.size(): return hs[0]
	if gun != null and gun.state != "gone" and clock - spotted_t < 1.5: return gun
	return null
func fire(air: bool, lesson := false):
	var p := P(); var src = _shooter(p)
	if src == null and lesson and drones.size(): src = drones[0]
	if src == null: return null
	var at: Vector3
	if air or climb != null and act != null: at = p + Vector3(0, 0.9, 0)
	else:
		var v := vel(); var l := Vector2(p.x + v.x*MISSILE.lead, p.z + v.z*MISSILE.lead)
		at = Vector3(l.x, g.boots.floor_at(l.x, l.y, p.y + 1.2) + 0.9, l.y)
	var m := _make_missile(src, at, air, MISSILE.airLock if air else MISSILE.lock, 0.0, not air)
	if not st.flags.get("saidAre", false) and not lesson: st.flags.saidAre = true; later(1.9, func(): if on and not fighting(): g.talk("raidAre"))
	return m
func _make_missile(src, at: Vector3, air: bool, lock: float, delay: float, flat: bool) -> Dictionary:
	var r: float = MISSILE.blast
	var ring := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = r*0.92; tm.outer_radius = r; ring.mesh = tm
	var rm := _mat(Color(1, 0.12, 0.08), true); rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; rm.render_priority = 101; ring.material_override = rm
	var fill := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = r; cm.bottom_radius = r; cm.height = 0.02; fill.mesh = cm
	var fm := _mat(Color(1, 0.1, 0.06), true); fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; fm.render_priority = 101; fm.albedo_color.a = 0.22; fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; fill.material_override = fm
	var laser := MeshInstance3D.new(); var lm := CylinderMesh.new(); lm.top_radius = 0.035; lm.bottom_radius = 0.035; lm.height = 1; laser.mesh = lm
	var lmat := _mat(Color(1, 0.08, 0.05), true); lmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; lmat.render_priority = 101; lmat.albedo_color.a = 0.55; laser.material_override = lmat
	for o in [ring, fill, laser]: g.add_child(o); o.visible = false
	var y := at.y - 0.84 if flat else at.y
	ring.position = Vector3(at.x, y, at.z); fill.position = ring.position; ring.scale.y = 0.05
	if not flat: ring.rotation.x = PI/2; fill.rotation.x = PI/2
	var m := {"src": src, "at": at, "air": air, "flat": flat, "lock": lock, "t": -delay, "phase": "lock", "ring": ring, "fill": fill, "laser": laser, "beep": 0.0, "rocket": null, "from": Vector3.ZERO}
	missiles.append(m)
	return m
func _src_pos(s) -> Vector3: return Vector3(s.x, s.y - (1.6 if s == gun else 0.2), s.z)
func _tick_missiles(dt: float) -> void:
	var p := P(); var keep := []
	for m in missiles:
		m.t += dt
		if m.t < 0: keep.append(m); continue
		if m.phase == "lock":
			for o in [m.ring, m.fill, m.laser]: o.visible = true
			var k := minf(1.0, m.t/m.lock)
			if m.air: m.at = p + Vector3(0, 0.9, 0); m.ring.position = m.at; m.fill.position = m.at
			if not m.flat: m.ring.look_at(g.cam.global_position); m.ring.rotate_object_local(Vector3.RIGHT, PI/2); m.fill.global_transform.basis = m.ring.global_transform.basis
			m.fill.scale = Vector3(maxf(0.02, k), 1, maxf(0.02, k))
			(m.ring.material_override as StandardMaterial3D).albedo_color.a = 0.5 + 0.5*absf(sin(m.t*(8 + k*20)))
			_beam(m.laser, _src_pos(m.src), m.at, 0.25 + 0.5*k)
			m.beep -= dt
			if m.beep <= 0: m.beep = lerpf(0.38, 0.06, k); g.cue("ui")
			if k >= 1:
				m.phase = "fly"; m.t = 0.0; m.from = _src_pos(m.src)
				if m.air: var v := vel(); m.at = p + Vector3(v.x, v.y, v.z)*MISSILE.fly + Vector3(0, 0.9, 0); m.ring.position = m.at; m.fill.position = m.at
				var rk := MeshInstance3D.new(); var rc := CylinderMesh.new(); rc.top_radius = 0.09; rc.bottom_radius = 0.12; rc.height = 0.7; rk.mesh = rc; rk.material_override = _mat(Color(1, 0.6, 0.3), true)
				g.add_child(rk); rk.position = m.from; m.rocket = rk
				m.laser.visible = false; g.cue("launch")
			keep.append(m)
		elif m.phase == "fly":
			var k2 := minf(1.0, m.t/MISSILE.fly); var pos: Vector3 = m.from.lerp(m.at, k2)
			m.rocket.position = pos
			if (m.at - pos).length() > 0.01: m.rocket.look_at(m.at); m.rocket.rotate_object_local(Vector3.RIGHT, PI/2)
			if k2 >= 1: _boom(m); _kill_missile(m)
			else: keep.append(m)
	missiles = keep
func _beam(o: MeshInstance3D, a: Vector3, b: Vector3, op: float) -> void:
	var d := b - a
	if d.length() < 0.01: return
	o.global_transform = Transform3D(Basis(Quaternion(Vector3.UP, d.normalized())).scaled(Vector3(1, d.length(), 1)), (a + b)/2)
	(o.material_override as StandardMaterial3D).albedo_color.a = op
func _kill_missile(m: Dictionary) -> void:
	for o in [m.ring, m.fill, m.laser, m.rocket]:
		if o != null and is_instance_valid(o): o.queue_free()
	m.phase = "gone"
func _boom(m: Dictionary) -> void:
	_boom_at(m.at, false)
	var p := P()
	if (p + Vector3(0, 0.9, 0)).distance_to(m.at) < MISSILE.blast and g.mode != "grab": hit(m.at.x, m.at.z)
func _boom_at(at: Vector3, far: bool) -> void:
	var d := at.distance_to(P())
	g.cue("blast")
	if d < 30: g.fight._flash(maxf(0, 0.4 - d*0.012)); g.fight.shake(maxf(0.05, 0.6 - d*0.02), 0.45)
	var f := OmniLight3D.new(); f.light_color = Color(1, 0.55, 0.2); f.light_energy = 12; f.omni_range = 10; f.position = at; g.add_child(f)
	var s := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.6; sm.height = 1.2; s.mesh = sm; s.material_override = _mat(Color(1, 0.6, 0.2), true); s.position = at; g.add_child(s)
	(s.material_override as StandardMaterial3D).transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; (s.material_override as StandardMaterial3D).render_priority = 101
	var tw: Tween = g.create_tween(); tw.tween_property(s, "scale", Vector3.ONE*(3 if not far else 5), 0.35); tw.parallel().tween_property(s.material_override, "albedo_color:a", 0.0, 0.35)
	tw.parallel().tween_property(f, "light_energy", 0.0, 0.5); tw.tween_callback(func(): s.queue_free(); f.queue_free())

# ================================================================== the gunship
func _tick_gun(dt: float, p: Vector3, idle: bool) -> void:
	if gun == null or gun.state == "gone": return
	var G_: Dictionary = gun; G_.t += dt
	G_.rot.rotation.y += dt*30
	var blink := int(clock*2) % 2 == 0; G_.red.visible = blink; G_.blue.visible = not blink
	if sid() == "home" and heat == 0 and not G_.leave: G_.leave = true; g.note("The gunship banks away towards the river.")
	var tx: float; var tz: float; var ty: float
	if G_.leave:
		tx = G_.x + 40; tz = G_.z + 30; ty = G_.y + 6
		if G_.x > 160: G_.state = "gone"; G_.n.visible = false; G_.cone.visible = false; G_.spot.visible = false; return
	else:
		var lk := last_known if last_known != Vector2.ZERO else Vector2(p.x, p.z)
		var ofs := Vector2(12, 10) if sid() in ["hide", "call"] else Vector2(16, -12)
		tx = lk.x + ofs.x; tz = lk.y + ofs.y; ty = maxf(30, p.y + 22)
	var k := minf(1, dt*(0.5 if G_.state == "arrive" else 0.35))
	G_.x = lerpf(G_.x, tx, k); G_.z = lerpf(G_.z, tz, k); G_.y = lerpf(G_.y, ty, k)
	if Vector2(G_.x - tx, G_.z - tz).length() < 6: G_.state = "hunt"
	var want := atan2(p.x - G_.x, p.z - G_.z); G_.yaw += Fight.ang_diff(want, G_.yaw)*minf(1, dt*0.8)
	G_.n.position = Vector3(G_.x, G_.y + sin(clock*0.9)*0.4, G_.z); G_.n.rotation = Vector3(0.08, G_.yaw, sin(clock*0.6)*0.04)
	var L: Dictionary = G_.light; var seen_now := clock - spotted_t < 1.5
	var lk2 := last_known if last_known != Vector2.ZERO else Vector2(p.x, p.z)
	G_.sweep += dt*0.55
	var lx: float = p.x if seen_now else lk2.x + sin(G_.sweep)*9; var lz: float = p.z if seen_now else lk2.y + sin(G_.sweep*2)*5
	L.x = lerpf(L.x, lx, minf(1, dt*(4.0 if seen_now else 1.2))); L.z = lerpf(L.z, lz, minf(1, dt*(4.0 if seen_now else 1.2)))
	L.y = g.boots.floor_at(L.x, L.z, 60)
	var lit_on: bool = not G_.leave
	G_.cone.visible = lit_on; G_.spot.visible = lit_on
	if lit_on:
		var from := Vector3(G_.x, G_.y - 1.6, G_.z); var to := Vector3(L.x, L.y, L.z); var len := from.distance_to(to)
		G_.cone.global_transform = Transform3D(Basis(Quaternion(Vector3.UP, (from - to).normalized())).scaled(Vector3(L.r, len, L.r)), (from + to)/2)
		G_.spot.global_position = from; if (to - from).length() > 0.1: G_.spot.look_at(to)
		var in_pool: bool = Vector2(p.x - L.x, p.z - L.z).length() < L.r and absf(p.y - L.y) < 3
		var lit_her: bool = not idle and in_pool and cover == null
		G_.dwell = minf(1, G_.dwell + dt) if lit_her else maxf(0, G_.dwell - dt*2)
		if G_.dwell > (0.0 if seen_now else 0.6): _spotted("light")
	if not idle and sid() == "home" and not G_.leave and heat > 0:
		strafe_t -= dt
		if strafe_t <= 0 and cover == null and clock - spotted_t < 4: strafe_t = randf_range(STRAFE.every[0], STRAFE.every[1]); _strafe(p)
func _strafe(p: Vector3) -> void:
	var v := vel(); var sp := Vector2(v.x, v.z).length()
	var a := atan2(v.x, v.z) + PI/2 if sp > 1 else randf()*TAU
	var gap_at := randi() % STRAFE.rings
	for i in STRAFE.rings:
		if i == gap_at: continue
		var o: float = (i - (STRAFE.rings - 1)/2.0)*STRAFE.gap
		var x := p.x + sin(a)*o; var z := p.z + cos(a)*o
		_make_missile(gun, Vector3(x, g.boots.floor_at(x, z, p.y + 1.2) + 0.9, z), false, MISSILE.lock, i*STRAFE.step, true)
	g.cue("alarm")
	if not st.flags.get("strafeTip", false): st.flags.strafeTip = true; g.note("🚁 A strafing run — across the line, not along it.")
func _spotted(why: String) -> void:
	var was := spotted_t
	spotted_t = clock; last_known = Vector2(P().x, P().z); seen_t = 0.0
	if clock - was > 3:
		var s := sid()
		if s == "hide" or s == "call": set_heat(maxi(heat, 3))
		g.cue("alarm")
		if not st.flags.get("lightTip", false) and why == "light": st.flags.lightTip = true; g.note("🔦 The light has you — out of it, or something between you and it.")
		if s == "call" and st.flags.get("answered", false): found()
func _tick_gate(dt: float) -> void:
	if gate == null: return
	if gate.closing and gate.open > 0: gate.open = maxf(0, gate.open - dt/2.6)
	var y: float = gate.top + 1.3 + 2.4*gate.open
	gate.panel.position.y = y
	var bottom := y - 1.3
	unsolid(gate.s)
	gate.s = solid(ROUTE.gate.x - 0.12, ROUTE.gate.x + 0.12, ROUTE.gate.z1, ROUTE.gate.z2, bottom, bottom + 2.6) if bottom < gate.top + 1.5 else null

# ================================================================== keys
func key(ev: InputEventKey) -> bool:
	if not on or not ev.pressed or ev.echo: return false
	var c := ev.keycode
	if act != null: return c in [KEY_SPACE, KEY_E, KEY_G, KEY_F, KEY_J, KEY_Q]
	if cover != null:
		if c == KEY_E and sid() == "call" and not st.flags.answered: answer(); return true
		if c == KEY_E or c == KEY_SPACE: leave_cover(); return true
		return c in [KEY_Q, KEY_G, KEY_F]
	if g.mode != "": return false
	if c == KEY_E and sid() == "call" and not st.flags.get("answered", true): answer(); return true
	if c == KEY_E:
		var cv = near_cover()
		if cv != null: enter_cover(cv); return true
	if c == KEY_G: try_climb(); return true
	if c == KEY_SPACE:
		var pk = parkour()
		if pk != null:
			if pk.kind == "vault": _vault(pk.v)
			else: _slide()
			return true
		if st.i < stage_at("roofs"):
			if cold_note_t <= 0: cold_note_t = 4; g.note("👟 The shoes are still cold from the fight.")
			return true
	return false
func marker():
	match sid():
		"run": return Vector3(ROUTE.runDone + 1, 2.4, -8)
		"wall": return Vector3(-22.5, 2.4, -14) if not st.flags.get("barrierDown", false) else Vector3(-17, 12.5, -25)
		"roofs": return Vector3(42, 14, -27)
		"hide": return null if cover != null else Vector3(ROUTE.ac.x, 15, ROUTE.ac.z)
		"home": return Vector3(ROUTE.home.at.x, 13.5, ROUTE.home.at.y)
	return null

var _later: Array = []
func later(sec: float, fn: Callable) -> void:
	var t := get_tree().create_timer(sec); t.timeout.connect(fn)
