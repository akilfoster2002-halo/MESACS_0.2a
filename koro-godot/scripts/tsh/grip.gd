## THE GECKO CUFFS (tsh.js wallAt / tryScale / tickScale / offWall). G, facing a building's wall and close to it — or
## sprinting at one, from a few steps out — palms on the wall, and up. W and S climb, A and D move along it, SHIFT
## does it all faster, SPACE lets go. No time limit: she holds as long as you do. At the top she pulls herself onto
## the roof, onto a clear spot of it.
class_name Grip
extends RefCounted

const GRIP := {"up": 1.5, "down": 1.9, "side": 1.2, "fast": 2.4, "clip": 0.67, "leap": 1.4}
var g
var sc = null                 # on the wall: {s, nx, nz, along, a, lo, hi, y, top, mantle, leap, land}
var space_was := false

func _init(game) -> void:
	g = game
	# IN PLACE: the climbing clips were baked with the climb in them (the hips rise a metre a loop, then drop back);
	# the steady travel is taken out of the hips, and the code that moves her does all the moving
	for nm in ["climb_up", "climb_down", "climb_top", "climb_start"]:
		if not g.anim.has_animation(nm): continue
		var a: Animation = g.anim.get_animation(nm)
		for ti in a.get_track_count():
			if a.track_get_type(ti) != Animation.TYPE_POSITION_3D or not String(a.track_get_path(ti)).ends_with("Hips"): continue
			var n := a.track_get_key_count(ti)
			if n < 2: continue
			var t0 := a.track_get_key_time(ti, 0); var T := a.track_get_key_time(ti, n - 1) - t0
			var dv: Vector3 = a.track_get_key_value(ti, n - 1) - a.track_get_key_value(ti, 0)
			if T <= 0: continue
			for i in n: a.track_set_key_value(ti, i, a.track_get_key_value(ti, i) - dv*(a.track_get_key_time(ti, i) - t0)/T)

func on() -> bool: return sc != null

## a building's wall she is facing, within reach
func wall_at(reach := 1.6):
	var b = g.boots; var fy: float = b.y; var yaw: float = g.cam_yaw
	var fx := -sin(yaw); var fz := -cos(yaw); var x: float = b.x; var z: float = b.z
	var best = null; var bd := reach
	for s in b.solids:
		if s.size() < 7 or not String(s[6]).begins_with("bld:"): continue
		if fy > s[5] - 1.0 or fy < s[4] - 1: continue                       # on its roof already, or under it
		var along_z: bool = z > s[2] + 0.3 and z < s[3] - 0.3; var along_x: bool = x > s[0] + 0.3 and x < s[1] - 0.3
		for c in [[-1, 0, s[0] - x, along_z], [1, 0, x - s[1], along_z], [0, -1, s[2] - z, along_x], [0, 1, z - s[3], along_x]]:
			if not c[3] or c[2] < -0.2 or c[2] > bd: continue
			if -(fx*c[0] + fz*c[1]) < 0.5: continue                            # she has to be facing it
			bd = c[2]; best = {"s": s, "nx": c[0], "nz": c[1]}
	return best

func try_scale() -> bool:
	if sc != null or g.mode != "": return false
	if g.inside: g.note("🦎 Not in here. Outside, on a building's wall."); return false
	var run: bool = g.boots.hspeed() > 10.5
	var w = wall_at()
	if w == null and run: w = wall_at(4.5)
	if w == null: g.note("🦎 Face a building's wall, close up — or sprint at one — and G grips it."); return false
	var s: Array = w.s; var along := "z" if w.nx != 0 else "x"
	var lo: float = (s[2] if along == "z" else s[0]) + 0.4; var hi: float = (s[3] if along == "z" else s[1]) - 0.4
	sc = {"s": s, "nx": w.nx, "nz": w.nz, "along": along, "a": clampf(g.boots.z if along == "z" else g.boots.x, lo, hi), "lo": lo, "hi": hi,
		"y": g.boots.y, "top": s[5], "mantle": null, "leap": null, "land": null}
	if run:
		var leap := minf(GRIP.leap, s[5] - 1.4 - g.boots.y)
		if leap > 0.3: sc.leap = {"t": 0.0, "x": g.boots.x, "z": g.boots.z, "y": g.boots.y, "up": leap}
	g.boots.vx = 0; g.boots.vy = 0; g.boots.vz = 0
	g.cam_yaw = atan2(w.nx, w.nz)
	g.cue("pick")
	if not g.S.has("flags"): g.S.flags = {}
	g.S.flags.scaled = int(g.S.flags.get("scaled", 0)) + 1
	if not g.S.flags.get("scaleTip", false): g.S.flags.scaleTip = true; g.note("🦎 W climb · S down · A/D along the wall · SPACE let go")
	if g.chase.on: g.chase.climb = true
	return true

## where she is on the wall: `off` metres out from it (negative is onto the roof)
func _pos(off: float) -> Vector2:
	var s: Array = sc.s
	return Vector2(sc.a if sc.along == "x" else (s[0] - off if sc.nx < 0 else s[1] + off),
		sc.a if sc.along == "z" else (s[2] - off if sc.nz < 0 else s[3] + off))
## WHERE SHE COMES UP: straight in if it is clear, else a little further in or along
func _landing():
	var top: float = sc.top
	var rx: float = sc.nz; var rz: float = -sc.nx
	for off in [-1.3, -2.1, -3.0, -4.0]:
		for side in [0.0, 0.9, -0.9, 1.8, -1.8, 2.8, -2.8]:
			var p := _pos(off); var px: float = p.x + rx*side; var pz: float = p.y + rz*side
			if px < sc.s[0] or px > sc.s[1] or pz < sc.s[2] or pz > sc.s[3]: continue
			var clear := true
			for o in g.boots.solids:
				if o != sc.s and o[5] > top + 0.2 and o[4] < top + 1.6 and px > o[0] - 0.45 and px < o[1] + 0.45 and pz > o[2] - 0.45 and pz < o[3] + 0.45: clear = false; break
			if clear: return Vector2(px, pz)
	return null

func _put(x: float, y: float, z: float) -> void:
	var b = g.boots; b.x = x; b.y = y; b.z = z; b.vx = 0; b.vy = 0; b.vz = 0
	g.robin.position = Vector3(x, y, z)
	g.model.rotation.y = atan2(-float(sc.nx), -float(sc.nz)) if sc != null else g.model.rotation.y
func _clip(nm: String, speed: float) -> void:
	g.play(nm, 0.15); g.anim.speed_scale = speed

func tick(dt: float) -> void:
	var k := func(c): return Input.is_physical_key_pressed(c)
	var space: bool = k.call(KEY_SPACE); var space_edge := space and not space_was; space_was = space
	if sc.leap != null:                                       # the run-up: across the ground and up onto the wall
		var l: Dictionary = sc.leap; l.t += dt
		var q := minf(1.0, l.t); var w := _pos(0.5); var h := clampf((q - 0.45)/0.55, 0, 1)
		_put(lerpf(l.x, w.x, minf(1, q/0.6)), l.y + l.up*h*(2 - h), lerpf(l.z, w.y, minf(1, q/0.6)))
		_clip("climb_start", 1.0)
		if q >= 1: sc.y = l.y + l.up; sc.leap = null
		return
	if sc.mantle != null:                                     # the braced hang, pulled up into a crouch on the roof
		var m: Dictionary = sc.mantle; m.t += dt/1.13
		var q := minf(1.0, m.t); var i: Vector2 = sc.land if sc.land != null else _pos(-0.9)
		var up := minf(1.0, q/0.7); var fwd := clampf((q - 0.45)/0.55, 0, 1)
		_put(lerpf(m.x, i.x, fwd), lerpf(m.y, sc.top, up*(2 - up)), lerpf(m.z, i.y, fwd))
		_clip("climb_top", 1.0)
		if q >= 1: off_wall(null)
		return
	if space_edge: off_wall(sc.y, true); return
	var up_k: bool = k.call(KEY_W) or k.call(KEY_UP); var dn: bool = k.call(KEY_S) or k.call(KEY_DOWN)
	var lf: bool = k.call(KEY_A) or k.call(KEY_LEFT); var rt: bool = k.call(KEY_D) or k.call(KEY_RIGHT)
	var fast: float = GRIP.fast if k.call(KEY_SHIFT) else 1.0
	var vy: float = ((GRIP.up if up_k else 0.0) - (GRIP.down if dn else 0.0))*fast
	var rx: float = sc.nz; var rz: float = -sc.nx
	var side: float = (float(rt) - float(lf))*GRIP.side*fast*dt
	sc.a = clampf(sc.a + side*(rx if sc.along == "x" else rz), sc.lo, sc.hi)
	sc.y += vy*dt
	var bp := _pos(1.0); var base: float = g.boots.floor_at(bp.x, bp.y, sc.y + 0.6)
	if sc.y <= base:
		sc.y = base
		if dn: off_wall(base); return
	if sc.y >= sc.top - 1.3 and up_k:
		var p := _pos(0.5); sc.land = _landing(); sc.mantle = {"t": 0.0, "x": p.x, "y": sc.y, "z": p.y}; g.cue("step"); return
	var p := _pos(0.5)
	_put(p.x, sc.y, p.y)
	g.cam_yaw = lerp_angle(g.cam_yaw, atan2(sc.nx, sc.nz), minf(1, dt*4))
	if vy > 0: _clip("climb_up", GRIP.up/GRIP.clip*fast)
	elif vy < 0: _clip("climb_down", GRIP.down/GRIP.clip*fast)
	else: _clip("climb_up", 1.6 if side != 0 else 0.0)          # along the wall; still, a held pose

## off the wall: onto the roof (y null), onto the ground (y), or let go (drop)
func off_wall(y, drop := false) -> void:
	var s = sc; if s == null: return
	g.anim.speed_scale = 1.0
	var b = g.boots
	if y == null:
		var l: Vector2 = s.land if s.land != null else _pos(-1.3)
		sc = null; _put(l.x, s.top, l.y)
		b.ground = true; b.state = "ground"
		if not g.S.flags.get("firstRoof", false): g.S.flags.firstRoof = true; g.note("🦎 Any wall, any roof. Up here nobody looks.")
		return
	var p := _pos(0.95); sc = null
	_put(p.x, y, p.y)
	if drop: b.vx = s.nx*1.5; b.vy = 2.0; b.vz = s.nz*1.5; b.ground = false; b.state = "air"
	else: b.ground = true; b.state = "ground"
