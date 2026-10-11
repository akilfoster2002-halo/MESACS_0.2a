## TSH · THE OTHER ROBIN — the morning after (tsh.js startDay / morning / commuteStart / overlookScene, ported).
## The alarm has been going for a while: 8:42, and school started at 8:00. "Rats." School clothes, the backpack — and
## the boots by the window. "You're up." Out of the window into daylight, over the roofs the way she went last night,
## to the roof across Harbor Lane from the school, at 8:57. "Okay. Technically not that late."
## It is a school day, not a night out: no heat, no drones, no WFC, nobody filming the shoes.
class_name TshDay
extends Node

const DAY_KIT := {"jacket": false, "gloves": false, "shoes": false, "bracelet": false, "pack": false}

var g
var alarm_t := 0.0
var alarm_on := false
var blanket: MeshInstance3D

func _init(game) -> void: g = game

## from the end of the prologue: a fresh save, the day flag, the clock at 8:42
func start() -> void:
	var runs: int = g.S.get("runs", 0) + 1
	g.S = g._fresh(); g.S.runs = runs; g.S.day = true; g.S.step = "morning"; g.S.dm = 8*60 + 42
	g._save()
	g.black(false); g.mode = ""
	g._enter()

## where a save in day two picks up (tsh.js CHECKPOINT)
func enter() -> void:
	match g.S.step:
		"morning": morning()
		"commute": commute_start()
		"school":
			g.kit_all(false); g.kit_set(g.SCHOOL_KIT); g.show_inside(false)
			var d: Array = g.nav.spots.schoolDoor
			g.place(Vector3(d[0] + 1.5, 0, d[1] - 2.5), PI); g._beat_start()
		"sneak", "detention", "after": g.hs.enter_at(g.S.step)
		_: g.hs.enter_at(g.S.step)

func tick(dt: float) -> void:
	if alarm_on:
		alarm_t -= dt
		if alarm_t <= 0: alarm_t = 0.9; g.cue("ui"); g.get_tree().create_timer(0.16).timeout.connect(func(): if alarm_on: g.cue("ui"))
	# the commute: on the roof across the lane from school, the time, and down she goes
	if g.S.step == "commute" and g.mode == "" and g.boots.ground and _on_overlook(): overlook()

func alarm(v: bool) -> void: alarm_on = v; alarm_t = 0.0

func _blanket(on: bool) -> void:
	var bed: Dictionary = g.room.room.bed; var top: float = bed.get("top", 0.72)
	if blanket == null:
		blanket = MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1.55, 0.2, 1.1); blanket.mesh = bm
		var m := StandardMaterial3D.new(); m.albedo_color = Color(0.3, 0.37, 0.51); m.roughness = 0.95; blanket.material_override = m
		g.apt.add_child(blanket)
	blanket.global_position = Vector3(bed.x + 0.45, top + 0.15, bed.z); blanket.visible = on

## INT. ROBIN'S ROOM — MORNING
func morning() -> void:
	var R: Dictionary = g.room.room; var bed: Dictionary = R.bed; var top: float = bed.get("top", 0.72)
	g.show_inside(true)
	g.kit_all(false); g.kit_set(DAY_KIT); g.shades(false)
	g.apt_boots(true); g.apt_pack(true); g.apt_window(false); g.lamp.light_energy = 0.0
	if not "late" in g.S.seen: g.S.seen.append("late")
	_blanket(true)
	var lie := func(k: float):
		g.stage("idle", bed.x + 0.75, top + 0.12, bed.z, PI/2); g.model.rotation.x = -PI/2; g.model.rotation.z = k
	var sit_up := func(): g.stage("wake", bed.x - 0.15, bed.get("seat", 0.76), bed.z - 0.05, PI/2)
	var shoe: Vector3 = g._v(R.boots.at); var form: Vector3 = g._v(R.form.at); var win: Vector3 = g._v(R.window.at)
	var F := Vector2(form.x + 0.75, form.z + 0.6); var fry := atan2(-0.75, -0.6)
	var K := Vector2(shoe.x + 0.55, shoe.z); var kry := -PI/2
	var SILL: Vector3 = g.SILL
	var shots := [
		{"dur": 3.6, "fov": 40, "inside": true, "cam": [Vector3(bed.x + 2.1, 1.9, bed.z - 1.6), Vector3(bed.x + 1.6, 1.6, bed.z - 1.1)], "look": Vector3(bed.x - 0.1, 0.8, bed.z),
			"enter": func(): lie.call(0.0); alarm(true); g.set_caption("INT. ROBIN'S ROOM — MORNING"),
			"beats": [[1.6, func(): lie.call(0.2)], [2.6, func(): lie.call(-0.1)]]},
		{"dur": 2.6, "fov": 36, "cam": Vector3(bed.x + 1.2, 1.4, bed.z - 0.9), "look": Vector3(bed.x + 0.3, 0.9, bed.z),
			"enter": func(): alarm(false); g.cue("ui"); g.phone_show("late")},
		{"dur": g.lines_len("rats") + 1.0, "fov": 34, "cam": g.rel(bed.x - 0.15, bed.z - 0.05, PI/2, 1.1, 0.2, 1.3), "look": Vector3(bed.x - 0.15, 1.15, bed.z - 0.05),
			"enter": func(): g.phone_show(""); _blanket(false); sit_up.call(); g.cue("door"); g.talk("rats")},
		{"dur": 2.4, "fov": 46, "cam": [Vector3(F.x + 1.6, 1.6, F.y + 1.3), Vector3(F.x + 1.2, 1.5, F.y + 1.0)], "look": Vector3(F.x, 1.1, F.y),
			"enter": func(): g.stage("idle", F.x, 0, F.y, fry),
			"beats": [[0.2, func(): g.cue("zip")], [0.8, func(): g.cue("door")], [1.5, func(): g.apt_pack(false); g.kit("pack", true); g.cue("pick")]]},
		{"dur": 2.6, "fov": 30, "cam": [Vector3(shoe.x + 1.3, 0.45, shoe.z - 0.8), Vector3(shoe.x + 1.0, 0.36, shoe.z - 0.55)], "look": Vector3(shoe.x, 0.12, shoe.z),
			"enter": func(): g.stage("idle", K.x + 0.6, 0, K.y + 0.4, kry)},
		{"dur": g.lines_len("upBoots") + 1.4, "fov": 32, "cam": g.rel(K.x + 0.6, K.y + 0.4, kry, 1.0, -0.15, 1.55), "look": Vector3(K.x + 0.6, 1.5, K.y + 0.4),
			"enter": func(): g.stage("idle", K.x + 0.6, 0, K.y + 0.4, kry); g.talk("upBoots")},
		{"dur": 2.6, "fov": 38, "cam": [Vector3(shoe.x + 1.5, 0.6, shoe.z - 1.1), Vector3(shoe.x + 1.2, 0.5, shoe.z - 0.8)], "look": Vector3(shoe.x + 0.2, 0.3, shoe.z),
			"enter": func(): g.stage("kneel", shoe.x + 0.35, 0, shoe.z, kry),
			"beats": [[1.1, func(): g.apt_boots(false); g.kit("shoes", true); g.cue("launch"); g.get_tree().create_timer(0.7).timeout.connect(func(): g.score("wos-b", -8))]]},
		{"dur": 2.6, "fov": 44, "cam": Vector3(win.x + 2.4, 1.6, win.z - 1.2), "look": Vector3(win.x, 1.5, win.z),
			"tick": func(dt, t, k): g._to_window(win, k),
			"beats": [[1.4, func(): g.apt_window(true); g.cue("window")]]},
		{"dur": 2.4, "fov": 42, "inside": false, "cam": [Vector3(55.3, 13.4, 30.8), Vector3(55.5, 13.1, 31.5)], "look": Vector3(SILL.x - 0.2, SILL.y + 0.5, SILL.z),
			"enter": func(): g.stage("idle", SILL.x, SILL.y, SILL.z, -PI/2); g.set_caption("EXT. KILN STREET — 8:44 AM")},
		{"dur": 0.8, "fov": 56, "cam": Vector3(56.8, 6.6, 37.6), "look": func(k, t): return g.robin.position + Vector3(0, 1, 0),
			"enter": func(): g.cue("kick"),
			"tick": func(dt, t, k): g.stage("jump", SILL.x - k*1.6, SILL.y + sin(k*PI*0.6)*0.7, SILL.z, -PI/2)}]
	g.play_reel(shots, func(_s): _blanket(false); commute_start())

## out of the window: west, along the roofs, toward school
func commute_start() -> void:
	g.staged = null; alarm(false); g.phone_show(""); g.black(false); g.model.rotation = Vector3(0, g.model.rotation.y, 0)
	g.kit_all(false); g.kit_set(g.SCHOOL_KIT); g.shades(false)
	g.show_inside(false)
	if g.S.step == "morning": g.S.step = "commute"
	g.S.dm = maxf(g.S.get("dm", 0), 8*60 + 44)
	g.objective(g.QUEST.commute.goal)
	for t in Boots.EARLY + Boots.MID: g.boots.have[t] = true
	var SILL: Vector3 = g.SILL
	g.place(Vector3(SILL.x - 1.6, SILL.y + 0.55, SILL.z), -PI/2 + 0.2)
	g.cam_pitch = -0.15
	g.boots.vx = -2.5; g.boots.vy = 1.4; g.boots.vz = 0; g.boots.ground = false; g.boots.state = "air"; g.boots.air_t = 0.2
	var o: Array = g.nav.spots.schoolOverlook
	g.marker.position = Vector3(o[0], o[2] + 30, o[1]); g.marker.visible = true
	g._save()

func _on_overlook() -> bool:
	var o: Array = g.nav.spots.schoolOverlook; var p: Vector3 = g.robin.position
	for r in g.boots.roofs:
		if p.x > r.x1 and p.x < r.x2 and p.z > r.z1 and p.z < r.z2 and absf(p.y - r.top) < 0.7:
			return absf(r.top - o[2]) < 0.7 and Vector2(p.x - o[0], p.z - o[1]).length() < 9
	return false

## HARBOR LANE HIGH SCHOOL, across the lane: 8:57. "Okay. Technically not that late." And over the edge.
func overlook() -> void:
	var d: Array = g.nav.spots.schoolDoor; var at: Vector3 = g.robin.position
	var face := atan2(d[0] - at.x, d[1] - at.z)
	g.S.dm = 8*60 + 57; g.marker.visible = false
	var shots := [
		{"dur": 3.0, "fov": 46, "cam": func(k, t): return g.rel(at.x, at.z, face, -3.0 - k*0.8, 1.0, at.y + 3.0 + k*0.4), "look": Vector3(d[0], 3.4, d[1] + 2.2),
			"enter": func(): g.stage("idle", at.x, at.y, at.z, face); g.set_caption("HARBOR LANE HIGH SCHOOL")},
		{"dur": 2.2, "fov": 40, "cam": g.rel(at.x, at.z, face, 1.5, 0.5, at.y + 1.7), "look": at + Vector3(0, 1.25, 0),
			"enter": func(): g.stage("text", at.x, at.y, at.z, face); g.cue("ui"); g.phone_show("dtime")},
		{"dur": g.lines_len("overlook") + 1.0, "fov": 32, "cam": g.rel(at.x, at.z, face, 1.1, -0.2, at.y + 1.55), "look": at + Vector3(0, 1.5, 0),
			"enter": func(): g.phone_show(""); g.stage("idle", at.x, at.y, at.z, face); g.talk("overlook")},
		{"dur": 1.3, "fov": 52, "cam": Vector3(d[0] + 6, 2.2, d[1] - 6), "look": func(k, t): return g.robin.position + Vector3(0, 1, 0),
			"enter": func(): g.cue("kick"),
			"tick": func(dt, t, k): g.stage("jump", lerpf(at.x, d[0] + 1.5, k), at.y*(1 - k*k) + sin(k*PI)*1.2, lerpf(at.z, d[1] - 2.5, k), face)}]
	g.play_reel(shots, func(_s):
		g.staged = null; g.phone_show("")
		g.place(Vector3(d[0] + 1.5, 0, d[1] - 2.5), PI)
		g.outcome("there"))
