## ROBIN'S SHOES — public/boots.js, the physics half, ported line for line. Not flight: a jump strong enough to
## clear a street, and everything she does in the air is about keeping that speed.
##
##   HOLD SPACE → BOUND → LAND → BOUND → …   (and DIVE, PULL UP, REBOUND, DASH)
##
## SPACE held picks the roof she is pointed at, solves the arc and flies her there; every landing with it still
## held springs into the next; tap it as her feet touch for a perfect one. On the ground with no roof in reach it is
## the super jump; in a dive, the pull-up; against a wall, the kick-off; in the open air, the dash. SHIFT is a sprint
## on the ground and a dive in the air. Momentum is kept, never reset. FLOW is how long she has kept it going.
##
## The world is plain data, as in the browser: solid boxes (walls), platforms (floors: the highest under her that
## is no more than a step above her feet) and roofs (where a bound can land). `y` is the soles of her feet.
class_name Boots
extends RefCounted

const T := {
	"chargeTime": 0.75, "jumpMin": 10.0, "jumpMax": 22.0, "chargeCrouch": 0.75, "combo": [1.0, 1.22, 1.45, 1.72], "comboWindow": 0.3,
	"leapMin": 1.5, "leapMax": 4.0, "leapTier": 0.15, "leapUp": 1.0, "chargeCarry": 0.75,
	"jAirAccel": 9.0, "jAirMax": 11.0, "jAirTurn": 2.2, "jAirSettle": 1.1, "soarFrom": 0.35, "soarTime": 1.0, "hangTime": 0.42, "hangGravity": 0.45,
	"flyTime": 1.8, "flyGravity": 0.4, "flyLift": 0.35, "flyLiftSpeed": 30.0,
	"runSpeed": 9.0, "sprintSpeed": 15.0, "groundAccel": 48.0, "groundTurn": 12.0, "groundKeep": 1.6, "stopDecel": 34.0,
	"jumpUp": 21.0, "jumpCarry": 1.0, "jumpFwd": 5.0, "jumpHoldGravity": 0.58, "jumpCut": 0.55, "jumpBuffer": 0.12, "coyote": 0.1,
	"boundGravity": 27.0, "boundLift": 2.6, "boundArc": 0.15, "boundMin": 7.0, "boundReach": 34.0, "boundReachFlow": 16.0, "boundIdeal": 15.0,
	"boundIdealSpeed": 0.6, "boundCone": 0.8, "boundUp": 15.0, "boundDown": 40.0, "boundInset": 1.8, "boundHoming": 10.0, "boundPlant": 0.12,
	"boundPerfect": 0.2, "boundLate": 0.08, "boundPerfectBonus": 1.15, "boundFlowGravity": 0.35, "boundRetarget": 0.35, "ignite": 30.0,
	"gravity": 30.0, "maxFall": 40.0, "airAccel": 15.0, "airTurn": 2.4, "airBrake": 9.0, "airDrag": 0.03, "maxAirSpeed": 24.0, "maxSpeed": 64.0,
	"diveGravity": 2.3, "diveFwd": 13.0, "maxDive": 58.0, "diveTurn": 1.2,
	"pullMinDive": 0.22, "pullBase": 8.0, "pullEfficiency": 0.66, "pullForward": 0.3, "swoopTime": 0.18, "perfectSlack": 0.32, "perfectPull": 1.25,
	"earlyFloor": 0.55, "maxRise": 46.0,
	"reboundMin": 7.0, "reboundGrace": 0.34, "reboundPush": 10.0, "reboundKeepN": 0.45, "reboundKeepT": 0.9, "reboundUp": 15.0, "reboundUpFromSpeed": 0.3,
	"perfectRebound": 0.12, "perfectReboundBonus": 1.3, "wallSlideGravity": 0.35,
	"dashSpeed": 22.0, "dashCharges": 2, "dashCooldown": 0.45, "dashTime": 0.2, "dashUp": 3.0, "dashKeep": 0.2,
	"rollImpact": 24.0, "somersaultImpact": 15.0, "somersaultTime": 1.0, "somersaultPush": 7.0, "rollTime": 0.34, "landKeep": 0.94,
	"perfectLanding": 0.15, "perfectLandingBonus": 1.12, "slideKeep": 0.5,
	"flowGround": 0.6, "flowRoof": 0.12, "flowAir": 0.03, "flowPower": 0.25, "flowSpeed": 0.3, "flowControl": 0.35, "chainBonus": 0.08,
}
const GAINS := {"bound": 0.05, "boundPerfect": 0.16, "jump": 0.04, "pull": 0.1, "pullPerfect": 0.2, "rebound": 0.1, "reboundPerfect": 0.18, "dash": 0.03, "landPerfect": 0.12, "roll": 0.02}
const EARLY := ["bound", "jump", "steer", "dive"]
const MID := ["pullup", "rebound", "dash"]
const LATE := ["chain", "slide"]
const R := 0.42
const TALL := 1.8

# ---------------------------------------------------------------- the body
var x := 0.0; var y := 0.0; var z := 0.0
var vx := 0.0; var vy := 0.0; var vz := 0.0
var ground := true
var heading := 0.0
var state := "ground"
var coyote := 0.0; var jump_buf := 9.0; var jump_held := false; var cut := true
var air_t := 0.0; var dive_t := 0.0
var swoop = null; var wall = null; var slide_wall = null
var dash_t := 0.0; var dash_cd := 0.0; var charges := 2
var roll := 0.0; var sliding := false; var flow := 0.0; var chain := 0
var bound = null; var plant := 0.0; var land_t := 9.0; var hops := 0; var aim_t := 0.0
var charge = null; var combo := 0; var from_charge := false; var from_bound := false; var hang := 0.0; var fly := 0.0; var fly_max := 0.0
var shift_latch := false
var have := {}
var events: Array = []
var last := {}
var gold := false

# ---------------------------------------------------------------- the world
var solids: Array = []        # [x1, x2, z1, z2, y1, y2]
var plats: Array = []         # [x1, x2, z1, z2, top]
var roofs: Array = []         # {id, x1, x2, z1, z2, top}
var bounds := Rect2(-1400, -1400, 2800, 2800)
var enabled := true

func _init(skills: Array = EARLY + MID) -> void:
	for s in skills: have[s] = true

func hspeed() -> float: return Vector2(vx, vz).length()
func speed() -> float: return Vector3(vx, vy, vz).length()
func flow_k(k: String) -> float: return 1.0 + T[k]*flow

func floor_at(px: float, pz: float, feet: float) -> float:
	var best := 0.0
	var lim := feet + 0.7
	for p in plats:
		if px >= p[0] and px <= p[1] and pz >= p[2] and pz <= p[3] and p[4] <= lim and p[4] > best: best = p[4]
	return best

func _blocks(s: Array, feet: float) -> bool:
	return not (feet + TALL < s[4] or feet > s[5] - 0.5)

func overlapping(px: float, pz: float, feet: float):
	for s in solids:
		if _blocks(s, feet) and px + R > s[0] and px - R < s[1] and pz + R > s[2] and pz - R < s[3]: return s
	return null

func wall_ahead(dx: float, dz: float, mx: float) -> float:
	var d := Vector2(dx, dz).length()
	if d < 1e-6: return INF
	var ux := dx/d; var uz := dz/d
	var best := INF
	for s in solids:
		if not _blocks(s, y): continue
		var r := _slab(x, ux, s[0], s[1], 0.0, mx)
		if r.x > r.y: continue
		r = _slab(z, uz, s[2], s[3], r.x, r.y)
		if r.x <= r.y and r.x < best: best = r.x
	return best

func _slab(o: float, u: float, a1: float, a2: float, t0: float, t1: float) -> Vector2:
	a1 -= R; a2 += R
	if absf(u) < 1e-9: return Vector2(t0, t1) if (o > a1 and o < a2) else Vector2(1, 0)
	var ta := (a1 - o)/u; var tb := (a2 - o)/u
	if ta > tb: var t := ta; ta = tb; tb = t
	return Vector2(maxf(t0, ta), minf(t1, tb))

func time_to_ground(g: float) -> float:
	if vy >= 0 and g == 0.0: return INF
	var alt := y - floor_at(x, z, y)
	if alt <= 0: return 0.0
	var v := -vy
	var gg := g if g != 0.0 else float(T.gravity)
	return (-v + sqrt(v*v + 2*gg*alt))/gg

# ---------------------------------------------------------------- one frame
## inp: {x (right), z (forward), yaw (the camera's), jump (held), jump_edge (pressed now), shift}
func step(inp: Dictionary, dt: float) -> Array:
	events = []
	if inp.get("jump_edge", false): jump_buf = 0.0
	else: jump_buf += dt
	if not inp.get("jump", false) and jump_held and not cut and vy > 0 and state == "air": vy *= T.jumpCut; cut = true
	jump_held = inp.get("jump", false)
	var wish = _wish(inp)
	if ground:
		land_t += dt
		if land_t > 0.4: hops = 0
	_decide(inp, wish)
	if charge != null:
		if inp.get("jump", false) and (ground or coyote > 0): charge.t += dt
		elif ground or coyote > 0: _charge_jump(wish)
		else: charge = null
	_steer_bound(inp, wish, dt)
	var n := clampi(ceili(speed()*dt/0.4), 1, 10)
	for i in n: _sub(inp, wish, dt/n)
	_flow_tick(dt)
	if dash_cd > 0: dash_cd -= dt
	gold = (state == "dive" and dive_t >= T.pullMinDive and _pull_quality().kind == "perfect") or (bound != null and _bound_left() <= T.boundPerfect)
	return events

func _wish(inp: Dictionary):
	var f := clampf(inp.get("z", 0.0), -1, 1); var r := clampf(inp.get("x", 0.0), -1, 1)
	if f == 0 and r == 0: return null
	var s := sin(inp.get("yaw", 0.0)); var c := cos(inp.get("yaw", 0.0))
	var wx := -s*f + c*r; var wz := -c*f - s*r; var d := Vector2(wx, wz).length()
	return {"x": wx/d, "z": wz/d, "back": f < 0 and r == 0}

func _emit(name: String, data := {}) -> void:
	var e := data.duplicate(); e.name = name; events.append(e)
func _add_flow(k: String) -> void: flow = clampf(flow + GAINS.get(k, 0.0), 0, 1)

func _decide(inp: Dictionary, wish) -> void:
	var fresh := jump_buf == 0.0
	var buffered := jump_buf <= T.jumpBuffer
	if swoop != null: return
	if have.has("charge") and (ground or coyote > 0) and charge == null and buffered:
		var in_time := ground and from_charge and land_t <= T.comboWindow
		if roll > T.rollTime - 0.08 and not in_time: return
		if in_time: roll = 0; last.rollT = 0.0
		charge = {"t": 0.0, "combo": mini(combo + 1, T.combo.size() - 1) if in_time else 0}
		jump_buf = 9; _emit("charge", {"combo": charge.combo})
		return
	if charge != null: return
	if wall != null:
		if buffered: _rebound(wish, wall.t <= T.perfectRebound); jump_buf = 9
		return
	if slide_wall != null and fresh and have.has("rebound"):
		wall = slide_wall.duplicate(); wall.t = T.reboundGrace; wall.weak = true; _rebound(wish, false); jump_buf = 9; return
	if (ground or coyote > 0) and have.has("bound") and plant <= 0 and (buffered or inp.get("jump", false)) and not (roll > T.rollTime - 0.08):
		var late := ground and fresh and land_t <= T.boundLate and from_bound
		if _try_bound(inp, wish, late): jump_buf = 9; return
	if (ground or coyote > 0) and buffered and have.has("jump"):
		if roll > 0 and roll > T.rollTime - 0.08: return
		_super_jump(wish, 1.0, "jump"); jump_buf = 9; return
	if ground or not fresh: return
	if bound != null: return
	if state == "dive" and dive_t >= T.pullMinDive and vy < -6 and have.has("pullup"): _pull_up(); jump_buf = 9; return
	var g: float = T.gravity*(T.diveGravity if state == "dive" else 1.0)
	if vy < 0 and time_to_ground(g) <= T.perfectLanding: return
	var hs := hspeed()
	if hs > T.reboundMin and wall_ahead(vx, vz, hs*T.perfectRebound + 0.3) < INF: return
	if have.has("dash") and charges > 0 and dash_cd <= 0 and air_t > 0.15: _dash(wish)

func _charge_jump(wish) -> void:
	var c = charge; charge = null
	var q := clampf(c.t/T.chargeTime, 0, 1)
	vy = lerpf(T.jumpMin, T.jumpMax, q)*T.combo[c.combo]*flow_k("flowPower")
	vx *= T.chargeCarry; vz *= T.chargeCarry
	if wish != null:
		var f: float = lerpf(T.leapMin, T.leapMax, q)*(1 + T.leapTier*c.combo); vx += wish.x*f; vz += wish.z*f
	var leap: bool = wish != null and (q >= T.soarFrom or c.combo > 0)
	if leap:
		vy *= T.leapUp; fly_max = T.soarTime*(0.5 + 0.5*q + 0.2*c.combo); fly = fly_max; hang = T.hangTime; charges = T.dashCharges
	ground = false; coyote = 0; cut = true; roll = 0; sliding = false; state = "air"; air_t = 0; dive_t = 0
	slide_wall = null; shift_latch = true; combo = c.combo; from_charge = true
	_add_flow("landPerfect" if c.combo else "jump")
	_emit("jumpPerfect" if c.combo else "jump", {"vy": vy, "leap": leap})

func _super_jump(wish, k: float, why: String) -> void:
	var p := flow_k("flowPower")*k
	vy = T.jumpUp*p
	vx *= T.jumpCarry; vz *= T.jumpCarry
	if wish != null: vx += wish.x*T.jumpFwd; vz += wish.z*T.jumpFwd
	ground = false; coyote = 0; cut = false; roll = 0; sliding = false; state = "air"; air_t = 0; dive_t = 0
	slide_wall = null; shift_latch = true
	_add_flow("jump")
	_emit(why, {"vy": vy})

# ---------------------------------------------------------------- the bound
func _bound_g(perfect: bool) -> float:
	return T.boundGravity*(1 + T.boundFlowGravity*flow)*(T.boundPerfectBonus if perfect else 1.0)

func _roof_under():
	for r in roofs:
		if x > r.x1 - 0.5 and x < r.x2 + 0.5 and z > r.z1 - 0.5 and z < r.z2 + 0.5 and absf(y - r.top) < 1: return r
	return null

func _land_in(y1: float, g: float):
	var disc := vy*vy + 2*g*(y - y1)
	return null if disc < 0 else (vy + sqrt(disc))/g

func _bound_left() -> float:
	if bound == null: return INF
	var t = _land_in(bound.y, bound.g)
	return INF if t == null else t

func _arc_to(c: Dictionary, g: float, extra: float) -> Dictionary:
	var h := Vector2(c.x - x, c.z - z).length()
	var top := maxf(y, c.y) + T.boundLift + h*T.boundArc + extra
	var avy := sqrt(2*g*(top - y))
	var tt := avy/g + sqrt(2*maxf(0.01, top - c.y)/g)
	return {"vy": avy, "vx": (c.x - x)/tt, "vz": (c.z - z)/tt, "T": tt}

func _arc_clear(a: Dictionary, g: float) -> bool:
	for i in range(1, 19):
		var t: float = a.T*i/19.0
		if overlapping(x + a.vx*t, z + a.vz*t, y + a.vy*t - 0.5*g*t*t) != null: return false
	return true

func find_target(dir, o := {}):
	if roofs.is_empty() or dir == null: return null
	var perfect: bool = o.get("perfect", false)
	var hs := hspeed(); var g := _bound_g(perfect)
	var reach: float = T.boundReach + T.boundReachFlow*flow + (6.0 if perfect else 0.0)
	var ideal: float = clampf(T.boundIdeal + hs*T.boundIdealSpeed + flow*8 + (4.0 if perfect else 0.0), T.boundMin + 2, reach - 2)
	var here = _roof_under() if ground else null
	var cands := []
	for r in roofs:
		if r == here: continue
		var dy: float = r.top - y
		if dy > T.boundUp or dy < -T.boundDown: continue
		var mx: float = minf(T.boundInset, (r.x2 - r.x1)/2 - 0.2); var mz: float = minf(T.boundInset, (r.z2 - r.z1)/2 - 0.2)
		var pick = null; var pd := INF
		var s_: float = T.boundMin
		while s_ <= reach:
			var qx: float = x + dir.x*s_; var qz: float = z + dir.z*s_
			var cx := clampf(qx, r.x1 + mx, r.x2 - mx); var cz := clampf(qz, r.z1 + mz, r.z2 - mz)
			var dev := Vector2(cx - qx, cz - qz).length() + absf(s_ - ideal)*0.06
			if dev < pd: pd = dev; pick = Vector2(cx, cz)
			s_ += 1.0
		if pick == null: continue
		var d: float = Vector2(pick.x - x, pick.y - z).length()
		if d < T.boundMin or d > reach: continue
		var ang := acos(clampf((dir.x*(pick.x - x) + dir.z*(pick.y - z))/d, -1, 1))
		if ang > T.boundCone: continue
		var score := ang*1.6 + absf(d - ideal)/ideal*0.7 + ((-dy/30.0) if dy < 0 else dy/15.0)*0.5
		cands.append({"r": r, "x": pick.x, "y": r.top, "z": pick.y, "d": d, "score": score})
	cands.sort_custom(func(a, b): return a.score < b.score)
	for ci in mini(6, cands.size()):
		var c = cands[ci]
		var spot = null
		for k in [0.0, 1.6, -1.6, 3.0]:
			var sx: float = c.x + dir.x*k; var sz: float = c.z + dir.z*k
			if sx > c.r.x1 + 0.4 and sx < c.r.x2 - 0.4 and sz > c.r.z1 + 0.4 and sz < c.r.z2 - 0.4 and overlapping(sx, sz, c.y + 0.05) == null and floor_at(sx, sz, c.y + 0.1) >= c.y - 0.05:
				spot = Vector2(sx, sz); break
		if spot == null: continue
		var t := {"roof": c.r, "x": spot.x, "y": c.y, "z": spot.y, "d": Vector2(spot.x - x, spot.y - z).length()}
		if o.get("air", false):
			var tl = _land_in(t.y, g)
			if tl == null or tl < 0.3: continue
			var vh: float = t.d/tl
			if vh > maxf(hs*1.5 + 6, 16) or vh > T.maxSpeed: continue
			var a := {"vy": vy, "vx": (t.x - x)/tl, "vz": (t.z - z)/tl, "T": tl}
			if not _arc_clear(a, g): continue
			t.arc = a; t.g = g; return t
		for extra in [0.0, 5.0]:
			var a2 := _arc_to(t, g, extra)
			if _arc_clear(a2, g): t.arc = a2; t.g = g; return t
	return null

func aim_dir(inp: Dictionary, wish, air: bool):
	if wish != null and not wish.back: return wish
	var hs := hspeed()
	if air and hs > 4: return {"x": vx/hs, "z": vz/hs}
	return {"x": -sin(inp.get("yaw", 0.0)), "z": -cos(inp.get("yaw", 0.0))}

func _try_bound(inp: Dictionary, wish, perfect: bool) -> bool:
	var t = find_target(aim_dir(inp, wish, false), {"perfect": perfect})
	if t == null: return false
	_launch_bound(t, perfect)
	return true

func _launch_bound(t: Dictionary, perfect: bool) -> void:
	var a: Dictionary = t.arc
	vx = a.vx; vz = a.vz; vy = a.vy
	ground = false; coyote = 0; cut = true; roll = 0; sliding = false; state = "bound"; air_t = 0; dive_t = 0
	slide_wall = null; shift_latch = true; plant = 0
	bound = {"x": t.x, "y": t.y, "z": t.z, "roof": t.roof, "g": t.g, "perfect": perfect}
	hops += 1
	_add_flow("boundPerfect" if perfect else "bound")
	_emit("boundPerfect" if perfect else "bound", {"d": t.d, "x": t.x, "y": t.y, "z": t.z, "T": a.T})

func _steer_bound(inp: Dictionary, wish, dt: float) -> void:
	if ground or swoop != null or wall != null or not have.has("bound"): return
	aim_t -= dt
	if aim_t > 0: return
	aim_t = 0.1
	var hs := hspeed()
	var line = {"x": vx/hs, "z": vz/hs} if hs > 2 else null
	if bound != null:
		if wish == null or wish.back or line == null or not have.has("steer"): return
		var off := acos(clampf(wish.x*line.x + wish.z*line.z, -1, 1))
		if off < T.boundRetarget: return
		var t = find_target(wish, {"air": true})
		if t == null or t.roof == bound.roof: return
		bound = {"x": t.x, "y": t.y, "z": t.z, "roof": t.roof, "g": t.g, "perfect": bound.perfect}
		_emit("boundTurn")
		return
	if not inp.get("jump", false) or state == "dive" or dash_t > 0 or air_t < 0.3 or vy > 4: return
	var t2 = find_target(aim_dir(inp, wish, true), {"air": true})
	if t2 == null: return
	state = "bound"; dive_t = 0
	bound = {"x": t2.x, "y": t2.y, "z": t2.z, "roof": t2.roof, "g": t2.g, "perfect": false}
	_emit("boundCatch")

## the first burn: the shoes, fired for the first time, in the air — straight up, hard
func ignite(yaw: float) -> void:
	vy = T.ignite; vx = vx*0.5 - sin(yaw)*6; vz = vz*0.5 - cos(yaw)*6
	ground = false; state = "air"; bound = null; swoop = null; wall = null; slide_wall = null
	cut = true; air_t = 0; dive_t = 0; shift_latch = true; aim_t = 0.35
	_add_flow("boundPerfect")
	_emit("ignite", {"vy": vy})

func _pull_quality() -> Dictionary:
	var E := maxf(0.0, -vy)
	var alt := y - floor_at(x, z, y)
	var need: float = E*T.swoopTime*0.5 + 0.4
	var spare := (alt - need)/maxf(E, 1)
	var ahead := wall_ahead(vx, vz, 60); var hs := hspeed()
	var wall_spare: float = (ahead - hs*T.swoopTime*0.5)/hs if hs > 4 else INF
	var s := minf(spare, wall_spare)
	if s < 0: return {"kind": "late", "q": 0.8, "E": E}
	if s <= T.perfectSlack: return {"kind": "perfect", "q": T.perfectPull, "E": E}
	return {"kind": "early", "q": maxf(T.earlyFloor, 1 - (s - T.perfectSlack)*0.35), "E": E}

func _pull_up() -> void:
	var pq := _pull_quality(); var E: float = pq.E
	var ch: float = 1 + T.chainBonus*chain if have.has("chain") else 1.0
	var up := clampf(T.pullBase + E*T.pullEfficiency*pq.q*flow_k("flowPower")*ch, 0, T.maxRise)
	var hs := hspeed(); var fwd: float = hs + E*T.pullForward*pq.q
	var hx := vx/hs if hs > 0.5 else -sin(heading); var hz := vz/hs if hs > 0.5 else -cos(heading)
	swoop = {"t": 0.0, "vy0": vy, "up": up, "h0": hs, "h1": minf(fwd, T.maxSpeed), "hx": hx, "hz": hz}
	state = "swoop"
	if pq.kind == "perfect": _add_flow("pullPerfect"); charges = mini(T.dashCharges, charges + 1)
	else: _add_flow("pull")
	chain += 1
	_emit("pullPerfect" if pq.kind == "perfect" else "pull")

func _rebound(wish, perfect: bool) -> void:
	var n: Vector2 = wall.n; var vin: Vector2 = wall.vin
	var into := maxf(0.0, -(vin.x*n.x + vin.y*n.y))
	var tx := vin.x + n.x*into; var tz := vin.y + n.y*into
	var ch: float = 1 + T.chainBonus*chain if have.has("chain") else 1.0
	var k: float = (T.perfectReboundBonus if perfect else 1.0)*(0.6 if wall.get("weak", false) else 1.0)*flow_k("flowPower")*ch
	var out: float = (T.reboundPush + into*T.reboundKeepN)*k
	var nvx: float = n.x*out + tx*T.reboundKeepT; var nvz: float = n.y*out + tz*T.reboundKeepT
	if wish != null: nvx += wish.x*3; nvz += wish.z*3
	vx = nvx; vz = nvz
	vy = clampf((T.reboundUp + vin.length()*T.reboundUpFromSpeed)*k, 0, T.maxRise)
	wall = null; slide_wall = null; state = "air"; air_t = 0.2; dive_t = 0; cut = true
	charges = T.dashCharges; chain += 1
	_add_flow("reboundPerfect" if perfect else "rebound")
	_emit("reboundPerfect" if perfect else "rebound")

func _dash(wish) -> void:
	var hs := hspeed()
	var dx: float = wish.x if wish != null else (vx/hs if hs > 0.5 else -sin(heading))
	var dz: float = wish.z if wish != null else (vz/hs if hs > 0.5 else -cos(heading))
	if hs > 0.5: dx = dx*(1 - T.dashKeep) + vx/hs*T.dashKeep; dz = dz*(1 - T.dashKeep) + vz/hs*T.dashKeep
	var d := Vector2(dx, dz).length(); if d == 0: d = 1
	var sp := minf(T.maxSpeed, maxf(T.dashSpeed*flow_k("flowSpeed"), hs*1.04))
	vx = dx/d*sp; vz = dz/d*sp
	vy = maxf(vy*0.25, T.dashUp)
	dash_t = T.dashTime; dash_cd = T.dashCooldown; charges -= 1
	state = "air"; dive_t = 0
	_add_flow("dash"); _emit("dash")

# ---------------------------------------------------------------- one substep
func _sub(inp: Dictionary, wish, h: float) -> void:
	if ground: _ground_move(inp, wish, h)
	else: _air_move(inp, wish, h)
	var hit_x = _move_axis(0, vx*h)
	var hit_z = _move_axis(1, vz*h)
	if hit_x != null: _touch_wall(hit_x)
	if hit_z != null: _touch_wall(hit_z)
	var feet0 := y
	if not ground:
		y += vy*h
		if vy > 0:
			for s in solids:
				if s[4] < feet0 + TALL - 0.05 or s[4] > y + TALL: continue
				if x + R > s[0] and x - R < s[1] and z + R > s[2] and z - R < s[3]: y = s[4] - TALL; vy = 0; break
		var fl := floor_at(x, z, feet0)
		if y <= fl: _land(fl, inp, wish)
	else:
		var fl2 := floor_at(x, z, y)
		if fl2 < y - 0.6:
			ground = false; state = "air"; coyote = T.coyote; vy = 0; air_t = 0; cut = true; shift_latch = inp.get("shift", false); from_charge = false
		else:
			y = lerpf(y, fl2, minf(1, h*16)) if fl2 > y else fl2
	if x < bounds.position.x: x = bounds.position.x; vx = absf(vx)*0.3
	if x > bounds.end.x: x = bounds.end.x; vx = -absf(vx)*0.3
	if z < bounds.position.y: z = bounds.position.y; vz = absf(vz)*0.3
	if z > bounds.end.y: z = bounds.end.y; vz = -absf(vz)*0.3

func _ground_move(inp: Dictionary, wish, h: float) -> void:
	if roll > 0: roll -= h
	if plant > 0: plant -= h
	if coyote > 0: coyote -= h
	var target: float = (T.sprintSpeed if inp.get("shift", false) else T.runSpeed)*flow_k("flowSpeed")*(T.chargeCrouch if charge != null else 1.0)*inp.get("speed_k", 1.0)
	var hs := hspeed()
	sliding = sliding and inp.get("shift", false) and hs > T.runSpeed and have.has("slide")
	if wish != null:
		var hx: float = vx/hs if hs > 0.3 else wish.x; var hz: float = vz/hs if hs > 0.3 else wish.z
		var a := atan2(hx, hz); var w := atan2(wish.x, wish.z)
		var d := atan2(sin(w - a), cos(w - a))
		var turn: float = T.groundTurn*h*(0.25 if sliding else 1.0)
		var na := a + clampf(d, -turn, turn)
		var sp := hs
		if sp < target: sp = minf(target, sp + T.groundAccel*h)
		else: sp = target + (sp - target)*exp(-(T.slideKeep if sliding else T.groundKeep)*h)
		if absf(d) > 2.4 and hs < target*1.2: sp = maxf(0, sp - T.groundAccel*h*2)
		vx = sin(na)*sp; vz = cos(na)*sp
	else:
		var brake: float = 4.0 if last.get("rollT", 0.0) > 0 else (T.stopDecel*0.5 if hs > T.sprintSpeed else T.stopDecel)
		var sp2 := maxf(0, hs - brake*h)
		if hs > 1e-4: vx *= sp2/hs; vz *= sp2/hs
	vy = 0

func _air_move(inp: Dictionary, wish, h: float) -> void:
	air_t += h
	if coyote > 0: coyote -= h
	if swoop != null:
		swoop.t += h
		var k := clampf(swoop.t/T.swoopTime, 0, 1); var e := k*k*(3 - 2*k)
		vy = lerpf(swoop.vy0, swoop.up, e)
		var hs0 := lerpf(swoop.h0, swoop.h1, e); vx = swoop.hx*hs0; vz = swoop.hz*hs0
		_cap()
		if k >= 1: swoop = null; state = "air"; dive_t = 0; cut = true; air_t = 0.2
		return
	if bound != null:
		if not inp.get("shift", false): shift_latch = false
		if inp.get("shift", false) and not shift_latch and have.has("dive") and air_t > 0.12: bound = null; state = "air"
		else:
			vy -= bound.g*h
			var tl = _land_in(bound.y, bound.g)
			if tl == null: bound = null; state = "air"; return
			var t := maxf(tl, h*2); var k2 := 1 - exp(-T.boundHoming*h)
			vx = lerpf(vx, (bound.x - x)/t, k2); vz = lerpf(vz, (bound.z - z)/t, k2)
			var hs1 := hspeed(); if hs1 > T.maxSpeed: vx *= T.maxSpeed/hs1; vz *= T.maxSpeed/hs1
			return
	if wall != null:
		wall.t += h
		vy = maxf(vy - T.gravity*T.wallSlideGravity*h, -4)
		if wall.t >= T.reboundGrace: slide_wall = wall; wall = null; state = "slide"
		return
	if slide_wall != null:
		var n: Vector2 = slide_wall.n
		if overlapping(x - n.x*0.08, z - n.y*0.08, y) == null: slide_wall = null
	if not inp.get("shift", false): shift_latch = false
	var diving: bool = inp.get("shift", false) and not shift_latch and have.has("dive") and air_t > 0.12
	if diving and state != "dive": state = "dive"; dive_t = 0; _emit("dive")
	if not diving and state == "dive": state = "air"
	if state == "dive": dive_t += h
	var g: float = T.gravity
	if state == "dive": g *= T.diveGravity
	elif hang > 0:
		hang -= h
		if absf(vy) < 6: g *= T.hangGravity
	if fly > 0 and state != "dive":
		fly -= h
		var k3 := clampf(fly/(fly_max if fly_max > 0 else T.flyTime), 0, 1)
		var gk := lerpf(1, T.flyGravity, k3)
		if vy < 0: gk *= 1 - T.flyLift*clampf(hspeed()/T.flyLiftSpeed, 0, 1)*k3
		g *= gk
	elif vy > 0 and jump_held and not cut: g *= T.jumpHoldGravity
	if dash_t > 0: dash_t -= h; g *= 0.2
	if slide_wall != null: g *= T.wallSlideGravity
	vy -= g*h
	vy = maxf(vy, -(T.maxDive if state == "dive" else T.maxFall))
	if slide_wall != null: vy = maxf(vy, -9)
	var hs := hspeed()
	var hx := vx/hs if hs > 0.3 else -sin(heading); var hz := vz/hs if hs > 0.3 else -cos(heading)
	if state == "dive": hs = minf(T.maxDive, hs + T.diveFwd*h)
	var gentle: bool = have.has("charge") and state != "dive"
	if wish != null and have.has("steer"):
		var ctl := flow_k("flowControl")
		if wish.back: hs = maxf(0, hs - T.airBrake*h)
		else:
			var a := atan2(hx, hz); var w := atan2(wish.x, wish.z)
			var d := atan2(sin(w - a), cos(w - a))
			var turn: float = (T.diveTurn if state == "dive" else (T.jAirTurn if gentle else T.airTurn))*ctl*h*(3.0 if hs < 6 else 1.0)
			var na := a + clampf(d, -turn, turn); hx = sin(na); hz = cos(na)
			var cap: float = (T.jAirMax if gentle else T.maxAirSpeed)*flow_k("flowSpeed")
			if hs < cap: hs = minf(cap, hs + (T.jAirAccel if gentle else T.airAccel)*ctl*h*maxf(0, cos(d)))
	hs *= exp(-T.airDrag*h)
	if gentle and wish == null and wall == null and swoop == null: hs *= exp(-T.jAirSettle*h)
	hs = minf(hs, T.maxSpeed)
	vx = hx*hs; vz = hz*hs
	_cap()

func _cap() -> void:
	var s := speed()
	if s <= T.maxSpeed: return
	var k: float = T.maxSpeed/s; vx *= k; vy *= k; vz *= k

func _move_axis(axis: int, d: float):
	if d == 0: return null
	var nx := x + d if axis == 0 else x
	var nz := z + d if axis == 1 else z
	var s = overlapping(nx, nz, y)
	if s == null:
		if axis == 0: x += d
		else: z += d
		return null
	var a: Array = s
	if axis == 0: x = minf(x, a[0] - R - 1e-3) if d > 0 else maxf(x, a[1] + R + 1e-3)
	else: z = minf(z, a[2] - R - 1e-3) if d > 0 else maxf(z, a[3] + R + 1e-3)
	return {"s": a, "n": Vector2(-1 if d > 0 else 1, 0) if axis == 0 else Vector2(0, -1 if d > 0 else 1)}

func _touch_wall(hit: Dictionary) -> void:
	var n: Vector2 = hit.n
	var into := -(vx*n.x + vz*n.y)
	if bound != null and hit.s[5] - y > 0.3: bound = null; state = "air"
	var tall: bool = hit.s[5] - y > 1.2
	if not ground and wall == null and swoop == null and tall and into >= T.reboundMin and have.has("rebound"):
		wall = {"n": n, "vin": Vector2(vx, vz), "vy": vy, "t": 0.0}
		var pressed: bool = jump_buf <= T.perfectRebound
		state = "wall"; dive_t = 0
		var vn := vx*n.x + vz*n.y; vx -= n.x*vn; vz -= n.y*vn
		vx *= 0.15; vz *= 0.15
		vy = maxf(vy*0.3, -2)
		_emit("wallHit", {"into": into})
		if pressed: _rebound(null, true); jump_buf = 9
		return
	if not ground and wall == null and tall and have.has("rebound") and swoop == null: slide_wall = {"n": n, "vin": Vector2(vx, vz), "vy": vy, "t": 0.0}
	var vn2 := vx*n.x + vz*n.y
	if vn2 < 0: vx -= n.x*vn2; vz -= n.y*vn2

func _land(fl: float, inp: Dictionary, wish) -> void:
	var impact := -vy; var hs := hspeed(); var bounded := bound != null
	fly = 0
	y = fl; vy = 0; ground = true; state = "ground"; bound = null; land_t = 0
	charges = T.dashCharges; wall = null; slide_wall = null; dive_t = 0
	if swoop != null: swoop = null; flow *= 0.6; chain = 0; _emit("swoopCrash", {"impact": impact})
	vx *= T.landKeep; vz *= T.landKeep
	from_bound = bounded
	if bounded and have.has("bound"):
		if jump_buf <= T.boundPerfect:
			jump_buf = 9
			_emit("boundLand", {"perfect": true, "hops": hops, "impact": impact})
			if _try_bound(inp, wish, true): return
			_super_jump(wish, T.perfectLandingBonus, "jumpPerfect"); return
		if inp.get("jump", false): plant = T.boundPlant; _emit("boundLand", {"perfect": false, "hops": hops, "impact": impact}); return
		var k := minf(1.0, T.runSpeed*1.3/maxf(hs, 0.01)); vx *= k; vz *= k
	if have.has("charge"):
		if jump_buf <= T.perfectLanding:
			jump_buf = 9
			var tier: int = mini(combo + 1, T.combo.size() - 1) if from_charge else 0
			_emit("landPerfect", {"impact": impact})
			charge = {"t": 0.0, "combo": tier}
			if not inp.get("jump", false): _charge_jump(wish)
			return
		if impact > T.somersaultImpact:
			roll = T.rollTime; last.rollT = T.somersaultTime; _add_flow("roll"); _emit("roll", {"impact": impact, "somersault": true}); return
		_emit("land", {"impact": impact}); return
	if jump_buf <= T.perfectLanding and have.has("jump"):
		_add_flow("landPerfect"); _emit("landPerfect", {"impact": impact}); jump_buf = 9
		if have.has("bound") and _try_bound(inp, wish, true): return
		_super_jump(wish, T.perfectLandingBonus, "jumpPerfect"); return
	chain = 0
	if inp.get("shift", false) and hs > T.runSpeed and have.has("slide"): sliding = true; _emit("slide"); return
	if impact > T.rollImpact or (impact > 14 and hs > 16): roll = T.rollTime; _add_flow("roll"); _emit("roll", {"impact": impact})
	else: _emit("land", {"impact": impact})

func _flow_tick(dt: float) -> void:
	if ground:
		var street := y < 0.6; var moving := hspeed() > 6
		flow = maxf(0, flow - (T.flowGround if street else (T.flowRoof*0.3 if moving else T.flowRoof))*dt)
	elif speed() > 14: flow = minf(1, flow + T.flowAir*dt)
	if hspeed() > 0.5: heading = atan2(-vx, -vz)
	if last.has("rollT") and last.rollT > 0: last.rollT -= dt
