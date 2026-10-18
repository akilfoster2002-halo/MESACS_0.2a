## TSH · MAYA AND KAI, ALPHA, AND HOME — tsh.js meetScene … aptEnding, ported (the tunnels before it: courtyard.gd).
## Out of the train's open door: two people who have no business down here either. The gizmo in Robin's pocket starts
## to sing as Maya gets close. Canon puts himself in front of Robin, and Kai puts him on the floor. So she fights: Kai,
## then Maya — with her arms out of her back. And the gizmo screams, and what is in Maya comes up out of her and does
## not stop; Canon goes into it; Robin fights it for him, and runs. Up the ladder into the afternoon — and it stays
## down there. WFC, all round her. The chase, east, up the Meridian Tower; on its roof, in the rain, the Director of
## WFC — her mother, who has no idea who she is fighting. Off the edge. Alone, she calls him. Home. Her mother in her room.
class_name Station
extends Node

const FCLIPS := ["jab", "cross", "hook", "kick", "knee", "elbow", "power", "dodge", "block", "hit", "stagger", "fall", "getup", "ko", "flykick", "sweep", "spin", "fight"]

var g; var cy: Courtyard
var sp := {}
var watch := ""
var oc: Tentacles            # Maya's arms
var stab := 2.0
var alpha_fx = null
var mon: Monster
var hay = null               # {k, t, sh, gT}
var wind = null
var flash_rect: ColorRect; var flash_col := Color.WHITE
var brawl_l: Label; var mash_box: VBoxContainer; var mash_l: Label; var mash_bar: ProgressBar; var mash_s: Label
var lose_box: Control; var lose_bar: ProgressBar
var alert_l: Label; var news_p: PanelContainer
var B = null                 # the brawl in progress
var esc = null
var hunt = null
var chaos = null
var storm_was = null
var wfc_crew: Array = []
var gun = null
var mom = null
var badge: Node3D
var sketch: Node3D
var auto := false              # the photographs: SPACE mashed for her

func _init(game) -> void: g = game

func _ready() -> void:
	flash_rect = ColorRect.new(); flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT); flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE; flash_rect.color = Color(1, 1, 1, 0)
	var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; flash_rect.material = cm; g.hud.add_child(flash_rect)
	brawl_l = _lab(30, Vector2(0, -120)); brawl_l.set_anchors_preset(Control.PRESET_CENTER); brawl_l.position = Vector2(-300, -160); brawl_l.size = Vector2(600, 80)
	mash_box = VBoxContainer.new(); mash_box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM); mash_box.position = Vector2(-280, -200); mash_box.custom_minimum_size = Vector2(560, 120); mash_box.visible = false
	mash_l = _lab(26, Vector2.ZERO); mash_l.get_parent().remove_child(mash_l); mash_box.add_child(mash_l)
	mash_bar = ProgressBar.new(); mash_bar.max_value = 1.0; mash_bar.show_percentage = false; mash_bar.custom_minimum_size = Vector2(560, 22)
	var fs := StyleBoxFlat.new(); fs.bg_color = Color("#ff4fd8"); fs.set_corner_radius_all(10); mash_bar.add_theme_stylebox_override("fill", fs)
	var bs := StyleBoxFlat.new(); bs.bg_color = Color(0, 0, 0, 0.45); bs.border_color = Color.WHITE; bs.set_border_width_all(2); bs.set_corner_radius_all(10); mash_bar.add_theme_stylebox_override("background", bs)
	mash_box.add_child(mash_bar); mash_s = _lab(15, Vector2.ZERO); mash_s.get_parent().remove_child(mash_s); mash_box.add_child(mash_s); g.hud.add_child(mash_box)
	lose_box = VBoxContainer.new(); lose_box.set_anchors_preset(Control.PRESET_CENTER_TOP); lose_box.position = Vector2(-150, 90); lose_box.custom_minimum_size = Vector2(300, 40); lose_box.visible = false
	var ll := _lab(13, Vector2.ZERO); ll.text = "LOSE IT"; ll.get_parent().remove_child(ll); lose_box.add_child(ll)
	lose_bar = ProgressBar.new(); lose_bar.max_value = 1.0; lose_bar.show_percentage = false; lose_bar.custom_minimum_size = Vector2(300, 10); lose_box.add_child(lose_bar); g.hud.add_child(lose_box)
	alert_l = _lab(14, Vector2.ZERO); alert_l.set_anchors_preset(Control.PRESET_TOP_WIDE); alert_l.position = Vector2(0, 0); alert_l.size = Vector2(1280, 30)
	alert_l.text = "⚠ EMERGENCY ALERT · HARBOR LANE · UNKNOWN ENTITY AT LARGE · SHELTER IN PLACE · WFC RESPONDING ⚠"; alert_l.visible = false
	var ab := StyleBoxFlat.new(); ab.bg_color = Color("#a0001a"); alert_l.add_theme_stylebox_override("normal", ab)
	news_p = PanelContainer.new(); news_p.set_anchors_preset(Control.PRESET_TOP_RIGHT); news_p.position = Vector2(-320, 130); news_p.custom_minimum_size = Vector2(300, 190); news_p.visible = false
	var nb := StyleBoxFlat.new(); nb.bg_color = Color("#141a26"); nb.border_color = Color("#222"); nb.set_border_width_all(2); nb.set_corner_radius_all(10); news_p.add_theme_stylebox_override("panel", nb)
	var nl := RichTextLabel.new(); nl.bbcode_enabled = true; nl.fit_content = true; nl.custom_minimum_size = Vector2(300, 190)
	nl.text = "[color=#ff3a3a]● LIVE[/color]                              CH 6\n\n\n\n\n[bgcolor=#d0021b][b] BREAKING · CREATURE ON HARBOR LANE [/b]\n WFC RESPONDING · STAY INDOORS [/bgcolor]"
	news_p.add_child(nl); g.hud.add_child(news_p)
func _lab(sz: int, pos: Vector2) -> Label:
	var l := Label.new(); l.add_theme_font_size_override("font_size", sz); l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_color_override("font_outline_color", Color(0.4, 0.2, 0.8)); l.add_theme_constant_override("outline_size", 8); l.position = pos; g.hud.add_child(l); return l

func _a(v) -> Vector2: return Vector2(v[0], v[1])
func TX(v: float) -> float: return 520.0 + v
func ang(a: Vector2, b: Vector2) -> float: return atan2(b.x - a.x, b.y - a.y)
func later(t: float, f: Callable) -> void: g.get_tree().create_timer(t, false).timeout.connect(f)
func flash(k: float, c := Color.WHITE) -> void: flash_rect.color = Color(c.r, c.g, c.b, maxf(flash_rect.color.a, k)); flash_col = c
func shake(a: float, l: float) -> void: g.fight.shake(a, l)
func crew(t: String): return g.crew(t)
func stand(clip: String, p: Vector2, ry: float, y := 0.0) -> void: g.stage(clip, p.x, y, p.y, ry)
func done(f: Callable) -> Callable: return func(_s): g.talk_q.clear(); g.phone_show(""); g.staged = null; f.call()

# ================================================================== every frame
func tick(dt: float) -> void:
	var real := dt/maxf(0.05, Engine.time_scale)
	if flash_rect.color.a > 0: flash_rect.color.a = maxf(0, flash_rect.color.a - real*2.5)
	_tick_arms(dt); _tick_hay(dt); _tick_wind(dt); _tick_chaos(dt)
	if alpha_fx != null: alpha_fx.tick(dt)
	if watch == "fight2" and g.mode == "fight":
		var m = crew("maya")
		if m != null and m.hp <= m.K.hp*0.5: watch = ""; drop_scene()
	if B != null: _tick_brawl(dt)
	if not Drones.list.is_empty():
		var tg: Array = [g.robin.position + Vector3(0, 1.0, 0)]
		var d = crew("director")
		if d and d.node.visible: tg.append(Vector3(d.x, d.y + 1.0, d.z))
		Drones.tick(g, dt, tg, gun.g.position + Vector3(0, -0.6, 0) if gun else null)
		if gun: gun.cone.visible = false; gun.pool.visible = false        # (the real light does it now)
		if gun and gun.g is GunshipRig and not gun.g.firing: gun.g.aim_at = g.robin.position + Vector3(0, 1.0, 0)      # its gun on her
func tick_watch(w: String, dt: float) -> void:
	match w:
		"escape": _tick_escape(dt)
		"wfcRun": _tick_wfc_run(dt)
		"home": _tick_home(dt)
func _tick_home(dt: float) -> void:
	var p: Vector3 = g.robin.position
	if g.boots.ground and p.x > 62 and p.x < 84 and p.z > 24 and p.z < 44 and p.y > 10.5: cy.watch = ""; home_roof()

# ================================================================== MAYA AND KAI
func meet() -> void:
	sp = cy.sp
	g.fight.setup({"arena": sp.arena, "blocks": [], "floor": 0.0, "meet": _a(sp.meetR)})
	g.fight.cast([{"kind": "kai", "x": sp.trainDoor[0], "z": sp.trainDoor[1] - 0.6, "tag": "kai", "state": "idle", "yaw": -PI/2, "hidden": true},
		{"kind": "maya", "x": sp.trainDoor[0], "z": sp.trainDoor[1] + 0.2, "tag": "maya", "state": "watch", "yaw": -PI/2, "bystander": true, "hidden": true}])
	for e in g.fight.E:
		if e.kind != "kai": Retarget.apply(g, e.node, FCLIPS, e.K.char)      # Kai has his own (the sword's, people/kai.glb)
		else: _free_clips(e)
		e.home = _a(sp.maya) if e.kind == "maya" else null
	if cy.canon: Retarget.apply(g, cy.canon.node, FCLIPS + ["fall"], "theo")
	if not "mayakai" in g.S.seen: g.S.seen.append("mayakai")
	later(0.3, meet_film)
## Kai, sword sheathed, standing and walking: her idle and her walk on his bones (retarget.gd), kept as idle_free and
## walk_free beside his sword's own idle and walk
func _free_clips(e) -> void:
	var ap: AnimationPlayer = e.ap; var lib: AnimationLibrary = ap.get_animation_library("")
	var keep := {}
	for nm in ["idle", "walk"]: if lib.has_animation(nm): keep[nm] = lib.get_animation(nm)
	Retarget.apply(g, e.node, ["idle", "walk"], "kai_free")
	for nm in ["idle", "walk"]:
		if lib.has_animation(nm):
			var baked: Animation = lib.get_animation(nm); lib.remove_animation(nm)
			baked.loop_mode = Animation.LOOP_LINEAR; lib.add_animation(nm + "_free", baked)
		if keep.has(nm): lib.add_animation(nm, keep[nm])
func meet_film() -> void:
	g.talk_q.clear()
	var kai = crew("kai"); var maya = crew("maya")
	var R := _a(sp.meetR); var C := _a(sp.canon); var M := _a(sp.maya); var K := _a(sp.kai); var TD := _a(sp.trainDoor)
	var ryR := ang(R, M); var f := Vector2(sin(ryR), cos(ryR))
	var RM: Dictionary = cy.pair_angles(R, M, f, -f, Vector2(f.y, -f.x), 1.62, 1.55)
	var CK: Dictionary = cy.pair_angles(C, K, Vector2(0, -1), Vector2(0, 1), Vector2(1, 0), 1.5, 1.55)
	var A: Dictionary = RM.duplicate()
	A.canon = {"cam": CK.her.cam, "look": CK.her.look, "fov": 28}; A.kai = {"cam": CK.him.cam, "look": CK.him.look, "fov": 28}
	A.overKai = {"cam": CK.overHim.cam, "look": CK.overHim.look, "fov": 32}; A.overCanon = {"cam": CK.overHer.cam, "look": CK.overHer.look, "fov": 32}
	A.room = {"cam": Vector3(TX(-7.4), 2.6, -95), "look": Vector3(TX(-0.5), 1.2, -104), "fov": 46}
	A.mayaWatch = {"cam": RM.him.cam, "look": RM.him.look, "fov": 22}
	A.gizmo = {"cam": Vector3(R.x + 0.5, 1.2, R.y - 0.35), "look": Vector3(R.x + 0.1, 0.95, R.y - 0.1), "fov": 30}
	var place := func():
		stand("idle", R, ryR); cy.canon_at(C, K)
		if kai: kai.node.visible = true; kai.x = K.x; kai.z = K.y; g.crew_face(kai, C.x, C.y, "idle")
		if maya: maya.node.visible = true; maya.x = M.x; maya.z = M.y; g.crew_face(maya, R.x, R.y, "idle")
	var sing := func():
		var gz: Node3D = cy.gizmo_prop(); gz.visible = true; gz.position = Vector3(R.x + 0.12, 0.98, R.y - 0.12); gz.rotation = Vector3(-0.3, ryR, 0)
		(gz.get_node("scr") as MeshInstance3D).material_override.albedo_color = Color(0.6 + randf()*0.6, 0.25, 1.6)
	var pools := {"robin": ["her", "herTight", "overHim", "low"], "maya": ["him", "himTight", "overHer", "mayaWatch"], "canon": ["canon", "overKai", "room"], "kai": ["kai", "overCanon", "room"]}
	var shots := [
		{"dur": 2.0, "fov": 40, "cam": Vector3(R.x - 1.2, 1.6, R.y + 2.2), "look": Vector3(TD.x, 1.3, TD.y), "enter": func(): stand("idle", R, ryR); cy.canon_at(C, TD); g.cue("step")},
		{"dur": 5.0, "fov": 38, "cam": Vector3(TD.x - 4.0, 1.5, TD.y + 1.8), "look": Vector3(TD.x - 1.5, 1.4, TD.y - 1.0),
			"tick": func(dt, t, k):
				g.crew_walk(maya, TD, M, minf(1, k*2.2))                          # she steps out first
				if k > 0.25: g.crew_walk(kai, TD, K, minf(1, (k - 0.25)*1.34))      # and he walks out after her, unhurried
				elif kai: kai.node.visible = false}]
	shots.append_array(cy.line_shots(["meetMaya", "meetKai", "meetWfc", "meetYu"], A, {"each": place, "pools": pools,
		"ins": [["Nobody\\. Same as you", "mayaWatch"], ["one girl in a pair of shoes", "mayaWatch"], ["People exaggerate", "herTight"], ["^Do they\\?$", "mayaWatch"], ["It's singing", "gizmo", sing], ["^Nothing\\.$", "her"], ["Hand it over", "kai"]]}))
	g.play_reel(shots, done(func(): place.call(); if cy.gizmo: cy.gizmo.visible = false; canon_ko()))
## Canon steps in front of her — he has no idea she can fight — and Kai puts him on the floor
func canon_ko() -> void:
	g.talk_q.clear()
	g.fm_aim(0.0, 0.0, [6.9, 6.9 + g.FIGHTM.bar*3])           # the song comes in as Canon steps up, and its low opening waits under both fights
	var kai = crew("kai"); var c = cy.canon
	var R := _a(sp.meetR); var K := _a(sp.kai); var ryR := ang(R, K); var f := Vector2(sin(ryR), cos(ryR))
	var C := R + f*0.9; var Kc := C + f*1.2; var ryC := ang(C, K); var fc := Vector2(sin(ryC), cos(ryC))
	var CK: Dictionary = cy.pair_angles(C, Kc, fc, -fc, Vector2(fc.y, -fc.x), 1.5, 1.55)
	var A: Dictionary = CK.duplicate(); A.past = {"cam": Vector3(R.x - sin(ryR)*0.6 + cos(ryR)*0.35, 1.7, R.y - cos(ryR)*0.6 - sin(ryR)*0.35), "look": Vector3(Kc.x, 1.45, Kc.y), "fov": 34}
	var guard := func():
		stand("idle", R, ryR)
		if c: c.follow = false; c.walking = false; c.x = C.x; c.z = C.y; c.face_to = null; c.yaw = ryC; c.pose = "fight"
		if kai: kai.x = Kc.x; kai.z = Kc.y; g.crew_face(kai, C.x, C.y, "idle")
	g.score("wos-b", -8)
	var shots := [{"dur": 1.4, "fov": 40, "cam": A.past.cam, "look": A.past.look, "tick": func(dt, t, k):
		if c: c.follow = false; c.x = lerpf(sp.canon[0], C.x, minf(1, k*1.6)); c.z = lerpf(sp.canon[1], C.y, minf(1, k*1.6)); c.yaw = ryC; c.pose = "fight"
		if kai: kai.x = lerpf(K.x, Kc.x, k); kai.z = lerpf(K.y, Kc.y, k); g.crew_face(kai, C.x, C.y, "walk")}]
	shots.append_array(cy.line_shots(["canonGuard"], A, {"each": guard, "pools": {"canon": ["her", "herTight"], "robin": ["past", "overHer"], "kai": ["him", "himTight", "overHer"]}}))
	shots.append_array([
		{"dur": 0.9, "fov": 34, "cam": A.profileL.cam, "look": A.two.look, "enter": func(): guard.call(); if kai: g.fight.play(kai, "hook"),
			"beats": [[0.45, func(): g.cue("punch"); shake(0.4, 0.4); flash(0.25)]]},
		{"dur": 1.6, "fov": 40, "cam": Vector3(C.x + 2.0, 0.6, C.y + 1.2), "look": Vector3(C.x, 0.5, C.y), "enter": func(): if c: c.face_to = null; c.pose = "ko"},
		{"mood": "shocked", "dur": g.lines_len("canonDown") + 0.6, "fov": 26, "cam": g.rel(R.x, R.y, ryR + 0.6, 0.85, 0.2, 1.62), "look": Vector3(R.x, 1.6, R.y), "enter": func(): stand("idle", R, ryR); g.talk("canonDown")},
		{"mood": "angry", "dur": 1.6, "fov": 22, "cam": g.rel(R.x, R.y, ryR, 0.7, 0.0, 1.62), "look": Vector3(R.x, 1.6, R.y), "enter": func(): stand("idle", R, ryR)},
		{"dur": 1.2, "fov": 46, "cam": Vector3(R.x - 3.4, 1.2, R.y + 2.8), "look": Vector3(Kc.x, 1.2, Kc.y), "enter": func(): if kai: g.crew_face(kai, R.x, R.y, "fight")}])
	g.play_reel(shots, done(func():
		if c: c.x = C.x; c.z = C.y; c.pose = "ko"; c.follow = false
		fight_one(R, ryR)))
func _fight_begin(R: Vector2, ry: float, cb: Callable) -> void:
	g.staged = null; g.talk_q.clear()
	g.robin.position = Vector3(R.x, 0, R.y); g.cam_yaw = ry + PI; g.cam_pitch = 0.0
	g.mode = "fight"; g.marker.visible = false
	g.fight.start(cb, "brawl")
func fight_one(R: Vector2, ry: float) -> void:
	var maya = crew("maya")
	if maya: maya.bystander = true; maya.state = "watch"; maya.home = Vector2(TX(1.6), -116)
	_fight_begin(R, ry, kai_down)
	StationTrains.depart()                          # the car they came in pulls out: the tracks are open, and the trains come
	g.note("Kai.")
func _fight_end() -> void:
	g.mode = ""; g.place(g.robin.position, g.cam_yaw)
## MAYA'S ARMS: four of them out of her back. In the fight she claws at Robin with them.
func maya_arms() -> Tentacles:
	var maya = crew("maya")
	if maya == null: return null
	if oc != null: return oc
	oc = Tentacles.new(); g.sub.add_child(oc)
	oc.lift = 0.95; oc.setup(0.0, Vector3(maya.x, 0, maya.z), maya.yaw)
	var sk: Skeleton3D = g._find(maya.node, func(x): return x is Skeleton3D)
	var bi := -1
	if sk: for i in sk.get_bone_count(): if sk.get_bone_name(i).ends_with("Spine2"): bi = i
	if bi >= 0: oc.socket = func(): return sk.global_transform*sk.get_bone_global_pose(bi)
	oc.visible = false
	return oc
func _tick_arms(dt: float) -> void:
	if oc == null or not is_instance_valid(oc): return
	var maya = crew("maya")
	if maya == null or not maya.node.visible: oc.visible = false; return
	if g.mode == "fight" and watch == "fight2": _junk_out()
	if g.mode == "fight" and watch == "fight2":
		# her arms carry her: where her fight wants her is where they walk; she is where they have got to
		oc.stride = true
		if lunge != null: _tick_lunge(maya, dt)
		else:
			oc.go_to(maya.x, maya.z, 3.2)
			maya.x = oc.body.x; maya.z = oc.body.z
			lunge_t -= dt
			var pr: Vector3 = g.robin.position; var dd := Vector2(pr.x - maya.x, pr.z - maya.z).length()
			if lunge_t <= 0 and dd > 3.5 and dd < 12.0 and g.fight.standing(maya) and maya.state != "windup": _lunge(maya)
		# and they hang from her body, steady — not from her spine bone, which jerks with every blow
		if not oc.has_meta("steady"):
			oc.set_meta("steady", true)
			oc.socket = func():
				var m = crew("maya")
				var y: float = float(m.yaw) if m else 0.0
				var at := Vector3(m.x, float(m.y) + 1.25, m.z) if m else oc.body
				return Transform3D(Basis(Vector3.UP, y).scaled(Vector3.ONE*0.95), at)
	else: oc.go_to(maya.x, maya.z, 9)
	if g.mode == "fight" and watch == "fight2":
		# she rides her arms: carried on them, her feet off the floor, swaying with their stride
		oc.visible = true
		var ride: float = maxf(0.0, oc.body.y - 0.15) + sin(Time.get_ticks_msec()*0.004)*0.04
		if lunge == null: maya.y = lerpf(float(maya.y), ride, minf(1.0, dt*6.0)); g.fight._place(maya)
		# and throws: an upper arm tears up rubble and hurls it at her
		throw_t -= dt
		if throw_t <= 0 and g.fight.standing(maya) and maya.state != "windup":
			throw_t = 2.5 + randf()*1.5; _throw(maya)
	_tick_rocks(dt)
	if g.mode == "fight" and watch == "fight2" and not maya.has("arm_strike"):
		stab -= dt
		if stab <= 0:
			stab = 1.3 + randf()*1.3
			var p: Vector3 = g.robin.position; var tgt := Vector3(p.x, 1.25, p.z)
			oc.visible = true; oc.burst(0 if randf() < 0.5 else 1, tgt, 0.45); g.cue("zip")
			later(0.23, func():
				var q: Vector3 = g.robin.position; var m = crew("maya")
				if m == null or g.mode != "fight" or Vector2(q.x - tgt.x, q.z - tgt.z).length() > 0.9: return
				shake(0.35, 0.4); g.cue("punch"); flash(0.3, Color(1, 0.25, 0.3))
				var a := atan2(q.x - m.x, q.z - m.z); g.robin.position += Vector3(sin(a), 0, cos(a))*0.9)
## MAYA'S THROWS: a chunk of the platform in a claw, hurled in an arc at where Robin is going; it hits if she is still
## near where it lands (dodging through it, she is safe)
var throw_t := 2.0
var lunge = null; var lunge_t := 4.0
var rocks: Array = []
## THE JUNK on the platform: crates, drums, a bench, a sign, an extinguisher — hers to throw
var junk: Array = []
func _junk_out() -> void:
	if not junk.is_empty(): return
	var A: Dictionary = sp.arena
	var rng := RandomNumberGenerator.new(); rng.seed = 2044
	var wood := StandardMaterial3D.new(); wood.albedo_color = Color(0.36, 0.25, 0.15); wood.roughness = 0.9
	var drum := StandardMaterial3D.new(); drum.albedo_color = Color(0.45, 0.12, 0.08); drum.metallic = 0.6; drum.roughness = 0.6
	var steel := StandardMaterial3D.new(); steel.albedo_color = Color(0.4, 0.42, 0.44); steel.metallic = 0.7; steel.roughness = 0.45
	var red := StandardMaterial3D.new(); red.albedo_color = Color(0.7, 0.05, 0.05); red.roughness = 0.4
	var signm := StandardMaterial3D.new(); signm.albedo_color = Color(0.9, 0.75, 0.1); signm.roughness = 0.6
	for i in 36:
		var n := MeshInstance3D.new(); var kind := i % 5
		match kind:
			0: var b := BoxMesh.new(); b.size = Vector3(0.6, 0.6, 0.6); n.mesh = b; n.material_override = wood
			1: var c := CylinderMesh.new(); c.top_radius = 0.3; c.bottom_radius = 0.3; c.height = 0.9; n.mesh = c; n.material_override = drum
			2: var b2 := BoxMesh.new(); b2.size = Vector3(1.4, 0.12, 0.4); n.mesh = b2; n.material_override = wood
			3: var b3 := BoxMesh.new(); b3.size = Vector3(0.7, 0.9, 0.05); n.mesh = b3; n.material_override = signm
			4: var c2 := CylinderMesh.new(); c2.top_radius = 0.09; c2.bottom_radius = 0.09; c2.height = 0.5; n.mesh = c2; n.material_override = red
		g.sub.add_child(n)
		var x := rng.randf_range(A.x1 + 0.8, A.x2 - 0.8); var z := rng.randf_range(A.z1 + 2.0, A.z2 - 2.0)
		var h: float = n.get_aabb().size.y
		n.global_position = Vector3(x, h*0.5, z); n.rotation.y = rng.randf()*TAU
		if kind == 3: n.rotation.z = PI/2*0.9; n.global_position.y = 0.06
		junk.append(n)
func _throw(maya) -> void:
	var k := 0 if randf() < 0.5 else 1
	var p: Vector3 = g.robin.position
	var lead: Vector3 = p + (p - g.fight.get_meta("last_p", p))*6.0; g.fight.set_meta("last_p", p)
	var from := Vector3(maya.x, float(maya.y) + 2.4, maya.z) + Vector3(randf_range(-0.8, 0.8), 0, 0)
	# the nearest piece of junk in reach: the arm goes down for it, lifts it, and throws it
	var pick: MeshInstance3D = null; var bd := 6.5
	for j in junk:
		var d := Vector2(j.global_position.x - maya.x, j.global_position.z - maya.z).length()
		if d < bd: bd = d; pick = j
	var grab: Vector3 = pick.global_position if pick else from
	if pick: junk.erase(pick)
	oc.strike(k, grab, 0.3, 0.5); g.cue("gear")
	if g.fight.fx: g.fight.fx.sense(from, Vector3(lead.x, 0.02, lead.z), 0.35 + (0.3 if pick else 0.0) + clampf(from.distance_to(Vector3(lead.x, 0.4, lead.z))/14.0, 0.45, 0.9))
	later(0.35, func():
		var r: MeshInstance3D = pick
		if r == null:
			r = MeshInstance3D.new(); var bm := BoxMesh.new(); var sz := randf_range(0.35, 0.6); bm.size = Vector3(sz, sz*0.7, sz*0.9); r.mesh = bm
			var m := StandardMaterial3D.new(); m.albedo_color = Color(0.32, 0.31, 0.29); m.roughness = 0.95; r.material_override = m
			g.sub.add_child(r); r.global_position = from
		else: g.cue("grab")
		var to := Vector3(lead.x, 0.4, lead.z)
		var start: Vector3 = r.global_position
		# up out of her claw to over her head, then thrown
		rocks.append({"junk": pick != null, "n": r, "from": start, "lift": from, "to": to, "t": 0.0, "up": 0.3 if pick else 0.0, "dur": clampf(from.distance_to(to)/14.0, 0.45, 0.9), "spin": Vector3(randf(), randf(), randf())*8.0})
		g.cue("zip"))
func _tick_rocks(dt: float) -> void:
	for rk in rocks.duplicate():
		rk.t += dt
		if rk.t < rk.up:                                       # lifted by the claw
			var e: float = rk.t/rk.up; rk.n.global_position = (rk.from as Vector3).lerp(rk.lift, e*e*(3 - 2*e)); continue
		var u: float = minf(1.0, (rk.t - rk.up)/rk.dur)
		var pos: Vector3 = (rk.lift as Vector3 if rk.up > 0 else rk.from as Vector3).lerp(rk.to, u); pos.y += sin(u*PI)*2.2
		rk.n.global_position = pos; rk.n.rotation += (rk.spin as Vector3)*dt
		if u >= 1.0:
			var q: Vector3 = g.robin.position
			g.cue("boom"); shake(0.3, 0.3)
			if g.fight.fx: g.fight.fx.sparks(rk.to, Vector3(0, 1, 0), 1.0)
			if g.fight.on and Vector2(q.x - rk.to.x, q.z - rk.to.z).length() < 1.1 and g.fight.R.iframe <= 0:
				var m = crew("maya")
				if m: g.fight.hurt(m, 20.0)
			if rk.junk:                                        # it lies where it fell, to be thrown again
				var h: float = rk.n.get_aabb().size.y
				var A: Dictionary = sp.arena
				rk.n.global_position = Vector3(clampf(rk.to.x, A.x1 + 0.6, A.x2 - 0.6), h*0.5, clampf(rk.to.z, A.z1 + 1.0, A.z2 - 1.0))
				rk.n.rotation = Vector3(0, randf()*TAU, 0); junk.append(rk.n)
			else: rk.n.queue_free()
			rocks.erase(rk)

## MAYA'S LUNGE: the two lower arms shoot out and plant just short of Robin, the claws bite the floor, and they haul
## her body through the air to them — she lands where they are; anyone she lands on is hit and thrown back
func _lunge(maya) -> void:
	var p: Vector3 = g.robin.position; var from := Vector2(maya.x, maya.z); var to2 := Vector2(p.x, p.z)
	var d := from.distance_to(to2); var dir := (to2 - from)/maxf(0.01, d)
	var land := from + dir*maxf(0.0, d - 1.2)
	var side := Vector2(dir.y, -dir.x)
	oc.burst(2, Vector3(land.x + side.x*0.9, 0.02, land.y + side.y*0.9), 0.75, true)
	oc.burst(3, Vector3(land.x - side.x*0.9, 0.02, land.y - side.y*0.9), 0.75, true)
	lunge = {"t": 0.0, "from": from, "to": land, "y0": float(maya.y)}
	if g.fight.fx: g.fight.fx.sense(Vector3(maya.x, 1.5, maya.z), Vector3(land.x, 0.02, land.y), 0.63)
	maya.yaw = atan2(dir.x, dir.y); g.cue("gear"); g.cue("zip")
	if g.fight.fx: g.fight.fx.lines(Vector3(maya.x, 1.6, maya.z), Vector3(dir.x, 0, dir.y), 1.1)
func _tick_lunge(maya, dt: float) -> void:
	var L: Dictionary = lunge
	L.t += dt
	var wind := 0.25; var fly := 0.38
	if L.t < wind:                                         # the claws going out; her body drawn back a little
		var b: Vector2 = (L.from as Vector2) - ((L.to as Vector2) - (L.from as Vector2)).normalized()*0.4*(L.t/wind)
		maya.x = b.x; maya.z = b.y
	else:
		var u := clampf((L.t - wind)/fly, 0, 1); var e := u*u*(3 - 2*u)
		var at: Vector2 = (L.from as Vector2).lerp(L.to, e)
		maya.x = at.x; maya.z = at.y; maya.y = float(L.y0) + sin(u*PI)*1.3
		if u >= 1.0:                                       # down
			shake(0.45, 0.4); g.cue("thud")
			var q: Vector3 = g.robin.position
			if Vector2(q.x - maya.x, q.z - maya.z).length() < 1.8 and g.fight.R.iframe <= 0:
				g.fight.hurt(maya, 22.0)
				var a := atan2(q.x - maya.x, q.z - maya.z); g.robin.position += Vector3(sin(a), 0, cos(a))*1.4
				if g.fight.fx: g.fight.fx.sparks(q + Vector3(0, 1.1, 0), Vector3(sin(a), 0, cos(a)), 1.2)
			oc.body = Vector3(maya.x, oc.body.y, maya.z); oc.go_to(maya.x, maya.z)
			lunge = null; lunge_t = 4.0 + randf()*3.0
	g.fight._place(maya)

## Kai down. Maya, walking in — and her arms come out
func kai_down() -> void:
	g.talk_q.clear(); _fight_end()
	var maya = crew("maya"); var p: Vector3 = g.robin.position; var R := Vector2(p.x, p.z)
	var M := Vector2(maya.x, maya.z) if maya else _a(sp.maya); var ry := ang(R, M); var f := Vector2(sin(ry), cos(ry))
	var to := R + f*2.4
	var F: Dictionary = cy.pair_angles(R, to, f, -f, Vector2(f.y, -f.x), 1.62, 1.62)
	F.arms = {"cam": Vector3(to.x - f.x*2.6 + f.y*1.6, 0.9, to.y - f.y*2.6 - f.x*1.6), "look": Vector3(to.x, 1.6, to.y), "fov": 44}
	var at := func(x: float, y: float, z: float) -> Vector3: return Vector3(to.x + x, y, to.y + z)
	var shots := [{"dur": 2.2, "fov": 36, "cam": F.overHer.cam, "look": func(k, t): return Vector3(maya.x, 1.5, maya.z) if maya else F.overHer.look,
		"enter": func(): stand("fight", R, ry), "tick": func(dt, t, k): g.crew_walk(maya, M, to, minf(1, k))}]
	shots.append_array(cy.line_shots(["mayaIn"], F, {"each": func():
			stand("fight", R, ry)
			if maya: maya.x = to.x; maya.z = to.y; g.crew_face(maya, R.x, R.y, "fight"),
		"pools": {"robin": ["herTight", "overHim", "low"], "maya": ["himTight", "overHer", "him"]}}))
	shots.append_array([
		{"dur": 2.8, "fov": 44, "cam": F.arms.cam, "look": F.arms.look,
			"enter": func():
				var o := maya_arms(); g.cue("clang")
				if o:
					o.visible = true
					o.burst(0, at.call(-1.4, 2.6, 0.3), 2.4)
					later(0.35, func(): o.burst(1, at.call(1.4, 2.7, 0.3), 2.4))
					later(0.7, func(): o.burst(2, at.call(-1.5, 0, 0.8), 2.0, true))
					later(0.9, func(): o.burst(3, at.call(1.5, 0, 0.8), 2.0, true)),
			"beats": [[0.4, func(): shake(0.2, 0.4); g.cue("zip")], [0.8, func(): g.cue("zip")], [1.2, func(): shake(0.3, 0.4); g.cue("clang")]]},
		{"mood": "shocked", "dur": 1.4, "fov": 24, "cam": F.herTight.cam, "look": F.herTight.look, "enter": func(): stand("fight", R, ry)}])
	g.play_reel(shots, done(func(): maya_arms(); fight_two(R, ry)))
func fight_two(R: Vector2, ry: float) -> void:
	var maya = crew("maya")
	if maya:
		maya.bystander = false; maya.hp = maya.K.hp; maya.state = "circle"; maya.active = true
		# her attacks end in an arm: the upper one on the side she is striking from drives out to Robin
		maya.arm_strike = func(at: Vector3, reach: float, coil: float):
			var o := maya_arms()
			if o == null: return
			o.visible = true
			var right := Vector2(cos(maya.yaw), -sin(maya.yaw)); var side: float = (at.x - maya.x)*right.x + (at.z - maya.z)*right.y
			o.strike(1 if side > 0 else 0, at, reach, coil); later(reach*coil, func(): g.cue("zip"))
	stab = 2.2
	_fight_begin(R, ry, func(): _fight_end(); alpha_scene())
	watch = "fight2"
	g.note("Maya — and her arms. Keep moving.")

# ================================================================== HAYWIRE, THE WIND, RAPID CUTS
var hay_amb = null                      # the station's ambient before haywire took it down
func haywire(k: float) -> void:
	if k > 0:
		if hay == null: hay = {"t": 0.0, "sh": 0.0, "gT": 0.0}
		hay.k = k; return
	hay = null
	for p in ["glitch", "ca", "hue", "vig", "contrast", "comic"]: g.verse_mat.set_shader_parameter(p, 0.0)
	if hay_amb != null and g.sub.visible: g.env.ambient_light_energy = hay_amb[0]; g.env.ambient_light_color = hay_amb[1]
	hay_amb = null
	g.lens_jitter = Vector3.ZERO
	if cy.lights_node:
		for l in cy.lights_node.get_children(): if l.has_meta("c0"): l.light_color = l.get_meta("c0")
func _tick_hay(dt: float) -> void:
	if hay == null: return
	hay.t += dt; var k: float = hay.k
	var vm: ShaderMaterial = g.verse_mat
	vm.set_shader_parameter("time", hay.t)
	vm.set_shader_parameter("contrast", minf(1, 0.45 + k*0.6)*0.45); vm.set_shader_parameter("vig", 0.15 + k*0.3)
	vm.set_shader_parameter("comic", minf(1, 0.4 + k*0.8))
	# HARD LIGHT: the station's warm fill goes out and a cold one takes it (the browser's frames here are blue and
	# readable: Godot's station starts far darker than the browser's, so taking its fill down too leaves nothing)
	if g.sub.visible:
		if hay_amb == null: hay_amb = [g.env.ambient_light_energy, g.env.ambient_light_color]
		g.env.ambient_light_color = (hay_amb[1] as Color).lerp(Color("#5a6cb8"), minf(1, k*1.5)); g.env.ambient_light_energy = lerpf(hay_amb[0], 1.25, minf(1, k*1.5))
	var tear := randf() < 0.025
	vm.set_shader_parameter("glitch", k*(0.04 + (0.45 if tear else 0.0)))
	hay.gT -= dt
	if tear and k > 0.3 and hay.gT <= 0: hay.gT = 1.5; g.cue("glitch")
	vm.set_shader_parameter("ca", k*0.03*(1.2 + sin(hay.t*13)))
	vm.set_shader_parameter("hue", k*sin(hay.t*0.6))
	if randf() < 0.06*k: flash(0.3*k, Color.from_hsv(randf(), 1, 1))
	if cy.lights_node and g.sub.visible:
		for l in cy.lights_node.get_children():
			if randf() < 0.04*k:
				if not l.has_meta("c0"): l.set_meta("c0", l.light_color)
				l.light_color = Color.from_hsv(randf(), 1, 1)
	var j := 0.05*k; var c = hay.t
	g.lens_jitter = Vector3((sin(c*1.7) + 0.6*sin(c*3.9 + 1.1))*j, (sin(c*2.3 + 0.7) + 0.6*sin(c*4.7 + 2.4))*j*0.6, (sin(c*1.9 + 3.1) + 0.6*sin(c*4.1 + 0.3))*j) if g.mode == "reel" else Vector3.ZERO
	hay.sh -= dt
	if hay.sh <= 0: hay.sh = 0.7 + randf()*0.9; shake(0.1 + 0.18*k*randf(), 0.9)
## THE WIND: everything loose in the station going one way — streaks and scraps pulled at Maya, then into it
func wind_on(k: float) -> void:
	if wind == null:
		var im := ImmediateMesh.new(); var lines := MeshInstance3D.new(); lines.mesh = im
		var lm := StandardMaterial3D.new(); lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lm.vertex_color_use_as_albedo = true; lm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		lm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; lm.render_priority = 101; lines.material_override = lm; lines.extra_cull_margin = 100
		var deb := MultiMeshInstance3D.new(); var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; var qm := QuadMesh.new(); qm.size = Vector2(0.11, 0.075); mm.mesh = qm; mm.instance_count = 160; deb.multimesh = mm
		var dm := StandardMaterial3D.new(); dm.albedo_color = Color("#d8d2c4"); dm.cull_mode = BaseMaterial3D.CULL_DISABLED; deb.material_override = dm; deb.extra_cull_margin = 100
		var S := []; var D := []
		for i in 380: S.append({"p": Vector3.ZERO, "v": Vector3.ZERO, "life": 0.0, "h": randf()})
		for i in 160: D.append({"p": Vector3.ZERO, "v": Vector3.ZERO, "life": 0.0, "r": Vector3(randf()*6, randf()*6, 0), "s": 2 + randf()*6})
		wind = {"k": 0.0, "im": im, "lines": lines, "deb": deb, "S": S, "D": D}
	var par: Node = g.sub if g.sub.visible else g.city
	for n in [wind.lines, wind.deb]:
		if n.get_parent() != par:
			if n.get_parent(): n.get_parent().remove_child(n)
			par.add_child(n)
	wind.k = k
func wind_off() -> void:
	if wind == null: return
	wind.lines.queue_free(); wind.deb.queue_free(); wind = null
func _tick_wind(dt: float) -> void:
	if wind == null: return
	var k: float = wind.k; var cam: Vector3 = g.cam.global_position
	var m = crew("maya")
	var to: Vector3
	if mon != null and mon.grow > 0.3: to = mon.mouth
	elif m != null: to = Vector3(m.x, 1.3, m.z)
	else: return
	var step := func(q: Dictionary, pull_k: float):
		q.life -= dt; var d: Vector3 = to - q.p; var dist := d.length()
		if q.life <= 0 or dist < 0.9 or dist > 22:
			var a := randf()*TAU; var r := 1.5 + randf()*9
			q.p = Vector3(cam.x + cos(a)*r, maxf(0.1, cam.y - 3 + randf()*5.5), cam.z + sin(a)*r); q.v = Vector3.ZERO; q.life = 1.5 + randf()*2.5; return
		d /= dist; var sw := d.cross(Vector3.UP)
		q.v += d*dt*k*pull_k*(10 + 60/(dist + 1)) + sw*dt*k*14 + Vector3(randf() - 0.5, (randf() - 0.5)*0.6, randf() - 0.5)*dt*k*14
		q.v *= 0.985
		if q.v.length() > 30: q.v = q.v.normalized()*30
		q.p += q.v*dt
	var im: ImmediateMesh = wind.im; im.clear_surfaces(); im.surface_begin(Mesh.PRIMITIVE_LINES)
	var t := Time.get_ticks_msec()/1000.0
	for q in wind.S:
		step.call(q, 1.0)
		var ln := 0.03 + minf(0.09, q.v.length()*0.006)
		var c := Color.from_hsv(fmod(q.h + t*0.05, 1.0), 0.9 if hay != null else 0.1, 0.55 + 0.35*randf())
		c.a = minf(1, k*1.4)
		im.surface_set_color(c); im.surface_add_vertex(g.sub.to_local(q.p) if wind.lines.get_parent() == g.sub else q.p)
		im.surface_set_color(Color(0, 0, 0, 0)); im.surface_add_vertex((g.sub.to_local(q.p - q.v*ln)) if wind.lines.get_parent() == g.sub else q.p - q.v*ln)
	im.surface_end()
	var mm: MultiMesh = wind.deb.multimesh; var par: Node3D = wind.deb.get_parent()
	for i in wind.D.size():
		var q: Dictionary = wind.D[i]; step.call(q, 0.7); q.r.x += dt*q.s; q.r.y += dt*q.s*0.7
		mm.set_instance_transform(i, Transform3D(Basis.from_euler(q.r), par.to_local(q.p)))
## a beat of dur seconds cut into pieces a third to four fifths of a second long, each from the next of cams: every one
## pushing in, drifting hand-held, tilted off the level — and kicking the lens as it lands
func cuts(dur: float, cams: Array, o := {}) -> Array:
	var out := []; var clk := {"t": 0.0}; var t := 0.0; var i := 0
	var at := func(v): return v.call() if v is Callable else v
	while t < dur - 0.05:
		var d := minf(dur - t, 0.34 + randf()*0.44); var c: Dictionary = cams[i % cams.size()]; var first := i == 0; i += 1
		var roll := (randf() - 0.5)*0.36; var drift := Vector3((randf() - 0.5)*1.3, (randf() - 0.5)*0.5, (randf() - 0.5)*1.3); var f0: float = c.get("fov", 40)
		out.append({"dur": d, "fov": f0, "fov2": f0*(0.76 + randf()*0.14), "ease": false, "mood": o.get("mood"),
			"cam": func(k, tt): var p: Vector3 = at.call(c.cam); return p + drift*k,
			"look": func(k, tt): return at.call(c.look),
			"enter": func():
				g.dutch = roll; shake(0.12 + randf()*0.16, 0.6)
				if first:
					clk.t = 0.0
					if o.has("start"): o.start.call()
				if mon != null: mon.key = c.get("key", 1.0)
				if c.has("enter"): c.enter.call(),
			"tick": func(dt, tt, k):
				clk.t += dt
				if o.has("tick"): o.tick.call(dt, clk.t, minf(1, clk.t/dur))})
		t += d
	return out

# ================================================================== THE GIZMO SCREAMS
## THE GIZMO FALLS. In the scuffle Canon's gizmo slips out of her jacket and hits the platform — and starts to beep.
## Nobody moves. The song goes under; the two of them, and Maya's arms, hold where they are; the beeps come faster
## and faster, its light red each time — and then what is in Maya answers it (alpha_scene).
func drop_scene() -> void:
	g.talk_q.clear()
	if g.fight.on: g.fight.stop()
	_fight_end()
	var maya = crew("maya"); var p: Vector3 = g.robin.position; var R := Vector2(p.x, p.z)
	var M := Vector2(maya.x, maya.z) if maya else _a(sp.maya); var ry := ang(R, M); var dir := Vector2(sin(ry), cos(ry)); var side := Vector2(cos(ry), -sin(ry))
	var F: Dictionary = cy.pair_angles(R, M, dir, -dir, side, 1.62, 1.62)
	var gp: Node3D = cy.gizmo_prop(); gp.visible = true; cy.gizmo_dropped = true
	var top := Vector3(R.x + dir.x*0.22 + side.x*0.15, 1.15, R.y + dir.y*0.22 + side.y*0.15)
	var rest := Vector3(R.x + dir.x*0.75 + side.x*0.35, 0.012, R.y + dir.y*0.75 + side.y*0.35)
	gp.position = top
	var led: MeshInstance3D = gp.get_node("led"); var scr: MeshInstance3D = gp.get_node("scr")
	var B := {"t": 0.0, "next": 1.4, "lit": 0.0}
	# the beeps: one, a long wait, then closer and closer; the light red while each sounds
	var beep := func(dt: float):
		B.t += dt; B.lit = maxf(0, B.lit - dt)
		B.next -= dt
		if B.next <= 0:
			g.cue("beep"); B.lit = 0.07
			B.next = maxf(0.09, 1.25*exp(-B.t*0.28))
		(led.material_override as StandardMaterial3D).albedo_color = Color(4, 0.15, 0.1) if B.lit > 0 else Color(0.15, 0.02, 0.02)
		(scr.material_override as StandardMaterial3D).albedo_color = Color(1.4, 0.1, 0.1) if B.lit > 0 else Color(0.08, 0.02, 0.03)
	# the fall: off her, down, one bounce, and still — screen up
	var fall := func(t: float):
		var y: float
		if t < 0.45: y = lerpf(top.y, 0.012, pow(t/0.45, 2))
		elif t < 0.7: y = 0.012 + 0.11*sin(PI*(t - 0.45)/0.25)
		else: y = 0.012
		var k := clampf(t/0.7, 0, 1)
		gp.position = Vector3(lerpf(top.x, rest.x, k), y, lerpf(top.z, rest.z, k))
		gp.rotation = Vector3(lerpf(-0.2, -PI/2, minf(1, t/0.6)) + sin(t*14)*0.3*(1 - k), ry + t*4.0*(1 - k), sin(t*11)*0.4*(1 - k))
	var hold := func():
		stand("fight", R, ry)
		if maya: g.crew_face(maya, R.x, R.y, "fight")
	var low := Vector3(rest.x - dir.x*0.5 + side.x*0.6, 0.12, rest.z - dir.y*0.5 + side.y*0.6)
	var shots := [
		{"dur": 0.9, "fov": 40, "cam": Vector3(R.x - side.x*1.4 + dir.x*0.4, 0.35, R.y - side.y*1.4 + dir.y*0.4), "look": func(_k = 0.0, _t = 0.0): return gp.position,
			"enter": func(): hold.call(); g.cue("grab"); g.fm_tension(true), "tick": func(dt, t, k): fall.call(t)},
		{"dur": 1.7, "fov": 34, "cam": low, "look": rest, "enter": func(): fall.call(9.0); g.cue("thud"), "tick": func(dt, t, k): beep.call(dt)},
		{"mood": "shocked", "dur": 1.8, "fov": 26, "cam": F.herTight.cam, "look": F.herTight.look, "enter": hold, "tick": func(dt, t, k): beep.call(dt)},
		{"dur": 1.6, "fov": 28, "cam": F.himTight.cam, "look": Vector3(M.x, 1.45, M.y), "tick": func(dt, t, k): beep.call(dt)},
		{"dur": 1.4, "fov": 20, "cam": rest + Vector3(side.x*0.3 - dir.x*0.15, 0.22, side.y*0.3 - dir.y*0.15), "look": rest, "tick": func(dt, t, k): beep.call(dt)},
		{"dur": 1.3, "fov": 46, "cam": Vector3(M.x - dir.x*1.6 + side.x*1.4, 0.5, M.y - dir.y*1.6 + side.y*1.4), "look": Vector3(M.x, 1.6, M.y), "tick": func(dt, t, k): beep.call(dt)},
		{"mood": "shocked", "dur": 1.1, "fov": 24, "cam": F.herTight.cam, "look": F.herTight.look, "tick": func(dt, t, k): beep.call(dt)},
		{"dur": 0.9, "fov": 34, "cam": F.overHer.cam, "look": rest, "tick": func(dt, t, k): beep.call(dt)},
		{"dur": 0.8, "fov": 16, "cam": rest + Vector3(side.x*0.18, 0.12, side.y*0.18), "look": rest, "tick": func(dt, t, k): beep.call(dt)}]
	g.play_reel(shots, done(func(): g.fm_tension(false); alpha_scene()))

func alpha_scene() -> void:
	g.talk_q.clear()
	if g.fight.on: g.fight.stop()
	_fight_end()
	if not "alpha" in g.S.seen: g.S.seen.append("alpha")
	g.cue("glitch"); g.fm_aim(g.FIGHTM.drop1, 4.0 + g.lines_len("mayaGlitch") + 0.3)
	var maya = crew("maya"); var p: Vector3 = g.robin.position; var R := Vector2(p.x, p.z)
	var M := Vector2(maya.x, maya.z) if maya else _a(sp.maya); var ry := ang(R, M); var dir := Vector2(sin(ry), cos(ry)); var side := Vector2(cos(ry), -sin(ry))
	var F: Dictionary = cy.pair_angles(R, M, dir, -dir, side, 1.62, 1.62)
	var mh := func(): return Vector3(maya.x, 1.45, maya.z) if maya else Vector3(M.x, 1.45, M.y)
	var tw := {"t": 0.0}
	var twitch := func(dt: float, amt: float):
		tw.t -= dt
		if tw.t <= 0 and maya:
			tw.t = 0.1 + randf()*0.35*(1.2 - amt); g.fight.play(maya, "hit" if randf() < 0.5 else "stagger"); maya.yaw += (randf() - 0.5)*0.7*amt
			if oc and randf() < amt*0.7:
				var a := randf()*7; oc.burst(randi() % 4, Vector3(maya.x + sin(a)*2.2, 0.4 + randf()*2.6, maya.z + cos(a)*2.2), 0.35)
	var grow := func(k: float, gl: float):
		if alpha_fx == null and maya: alpha_fx = Monster.AlphaFx.new(maya.node.get_child(0) as Node3D if maya.node.get_child_count() else maya.node)
		if alpha_fx: alpha_fx.cover = maxf(alpha_fx.cover, k); alpha_fx.glitch = gl
	var gz := func(_k = 0.0, _t = 0.0) -> Vector3: return cy.gizmo_prop().position
	var pocket := func():
		var gp: Node3D = cy.gizmo_prop(); gp.visible = true
		if cy.gizmo_dropped: return                     # on the platform, where it fell
		gp.position = Vector3(R.x + dir.x*0.25 + side.x*0.12, 1.0, R.y + dir.y*0.25 + side.y*0.12); gp.rotation = Vector3(-0.2, ry, 0)
	var C := {
		"gizmo": {"cam": func(_k = 0.0, _t = 0.0): var q: Vector3 = gz.call(); return q + Vector3(side.x*0.35 - dir.x*0.2, 0.12, side.y*0.35 - dir.y*0.2), "look": gz, "fov": 30},
		"gizmoX": {"cam": func(_k = 0.0, _t = 0.0): var q: Vector3 = gz.call(); return q + Vector3(-side.x*0.25 + dir.x*0.25, 0.05, -side.y*0.25 + dir.y*0.25), "look": gz, "fov": 22},
		"her": {"cam": F.herTight.cam, "look": F.herTight.look, "fov": 26},
		"herSide": {"cam": F.profileL.cam, "look": F.two.look, "fov": 34},
		"maya": {"cam": F.himTight.cam, "look": mh, "fov": 28},
		"mayaLow": {"cam": Vector3(M.x - dir.x*1.6 + side.x*1.2, 0.4, M.y - dir.y*1.6 + side.y*1.2), "look": mh, "fov": 46},
		"overHer": {"cam": F.overHer.cam, "look": mh, "fov": 34},
		"high": {"cam": Vector3(R.x - dir.x*1.5 - side.x*1.5, 3.9, R.y - dir.y*1.5 - side.y*1.5), "look": Vector3(M.x, 1.0, M.y), "fov": 50},
		"wide": {"cam": Vector3((R.x + M.x)/2 + side.x*5, 1.4, (R.y + M.y)/2 + side.y*5), "look": Vector3((R.x + M.x)/2, 1.2, (R.y + M.y)/2), "fov": 56}}
	var shots := cuts(1.8, [C.gizmo, C.her, C.gizmoX, C.maya], {"start": func(): stand("fight", R, ry); pocket.call(); flash(0.4); haywire(0.3); wind_on(0.25); g.cue("rise"),
		"tick": func(dt, t, k): (cy.gizmo_prop().get_node("scr") as MeshInstance3D).material_override.albedo_color = Color(0.4 + randf(), 0.2, 1 + randf()*1.5)})
	shots.append_array(cuts(2.2, [C.overHer, C.mayaLow, C.her, C.maya, C.high], {"tick": func(dt, t, k): twitch.call(dt, 0.5); grow.call(k*0.3, 0.3 + k*0.4); if wind: wind.k = 0.25 + k*0.3}))
	shots.append_array(cuts(g.lines_len("mayaGlitch") + 0.3, [C.maya, C.her, C.mayaLow, C.wide, C.maya, C.herSide, C.overHer, C.high], {"start": func(): g.talk("mayaGlitch"),
		"tick": func(dt, t, k):
			stand("fight", R, ry); twitch.call(dt, 0.8); grow.call(minf(0.8, 0.3 + k*0.5), 0.8)
			if hay: hay.k = 0.3 + k*0.3
			if wind: wind.k = 0.5 + k*0.3}))
	g.play_reel(shots, done(func(): if cy.gizmo: cy.gizmo.visible = false; monster_scene(R, ry)))

## a burst of black smoke, thrown out at once and hanging, then gone
func _smoke(at: Vector3) -> void:
	var p := CPUParticles3D.new(); p.one_shot = true; p.explosiveness = 0.85; p.amount = 900; p.lifetime = 4.0
	var q := QuadMesh.new(); q.size = Vector2(1, 1); p.mesh = q
	var m := StandardMaterial3D.new(); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES; m.vertex_color_use_as_albedo = true
	var gt := GradientTexture2D.new(); gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1, 0.5)
	var gr := Gradient.new(); gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(1, 1, 1, 0)); gt.gradient = gr; m.albedo_texture = gt
	p.material_override = m
	p.direction = Vector3(0, 1, 0); p.spread = 180; p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE; p.emission_sphere_radius = 1.4; p.initial_velocity_min = 3; p.initial_velocity_max = 15; p.damping_min = 4; p.damping_max = 7; p.gravity = Vector3(0, 0.6, 0)
	var sc := Curve.new(); sc.add_point(Vector2(0, 0.4)); sc.add_point(Vector2(1, 3.0)); p.scale_amount_curve = sc; p.scale_amount_min = 2.4; p.scale_amount_max = 5.0
	var cr := Gradient.new(); cr.set_color(0, Color(0.02, 0.0, 0.04, 0.95)); cr.set_color(1, Color(0, 0, 0, 0)); cr.add_point(0.6, Color(0.01, 0.0, 0.02, 0.7)); p.color_ramp = cr
	g.sub.add_child(p); p.global_position = at; p.emitting = true
	later(4.6, func(): if is_instance_valid(p): p.queue_free())

## IT DOES NOT STOP. The black comes up out of her and keeps coming, until it is the size of the platform.
func monster_scene(R0: Vector2, ry: float) -> void:
	g.talk_q.clear()
	var maya = crew("maya"); var kai = crew("kai"); var c = cy.canon
	var M0 := Vector2(maya.x, maya.z) if maya else _a(sp.maya); var dir := Vector2(sin(ry), cos(ry)); var side := Vector2(cos(ry), -sin(ry))
	var M := M0 + dir*2.6; var R := R0 - dir*1.6; var myaw := ang(M, R)
	var F: Dictionary = cy.pair_angles(R, R + dir, dir, -dir, side, 1.62, 1.62)
	if mon: mon.dispose()
	mon = Monster.new(); g.sub.add_child(mon); mon.setup(Vector3(M.x, 0, M.y), myaw); mon.grow = 0.02; mon.pull = 0.3
	mon.on_step = func(q): if q.distance_to(g.robin.position) < 28: g.cue("thud")
	mon.on_slam = func(_q): shake(0.55, 1.1); g.cue("clang")
	# the station's own lamps go down to nothing: its light is the only light now
	if cy.lights_node:
		for l in cy.lights_node.get_children(): l.set_meta("e0", l.light_energy); l.light_energy *= 0.08
	var C0 := Vector2(c.x, c.z) if c else _a(sp.canon)
	var eye := func(): return mon.eye_at
	var mouth := func(): return mon.mouth
	var mid := (R + M)/2
	var cp := func(): return Vector3(c.x, c.get("y", 0.0) + 0.4, c.z) if c else Vector3(C0.x, 0.4, C0.y)
	var kp := func(y: float): return Vector3(kai.x, y, kai.z) if kai else Vector3(M.x, y, M.y)
	var run := {"k": 0.0}
	var rrun := func() -> Vector2: return R - dir*run.k*3.2
	var V := func(p2: Vector2, y: float) -> Vector3: return Vector3(p2.x, y, p2.y)
	var CAM := {
		"lowUp": {"cam": V.call(R - dir*2.4 + side*2.6, 0.35), "look": func(): return Vector3(M.x, 1.0 + mon.grow*3.2, M.y), "fov": 64},
		"lowUp2": {"cam": V.call(R - dir*1.2 - side*2.4, 0.3), "look": func(): return Vector3(M.x, 0.8 + mon.grow*3.4, M.y), "fov": 70},
		"her": {"cam": F.herTight.cam, "look": F.herTight.look, "fov": 24, "key": 0.12},
		"herWide": {"cam": F.her.cam, "look": F.her.look, "fov": 32, "key": 0.2},
		"herSide": {"cam": F.profileL.cam, "look": F.two.look, "fov": 30, "key": 0.25},
		"high": {"cam": V.call(R - dir*3 + side*1.2, 4.7), "look": V.call(M, 1.6), "fov": 56},
		"side": {"cam": V.call(mid + side*6.4, 1.3), "look": V.call((R + M*2)/3, 2.3), "fov": 62},
		"sideB": {"cam": V.call(mid - side*5.8, 2.2), "look": V.call((R + M*2)/3, 2.0), "fov": 60},
		"behind": {"cam": V.call(R - dir*4.2 + side*0.8, 1.7), "look": V.call(M, 2.6), "fov": 62},
		"rising": {"cam": V.call(M0 - dir*2.2 + side*1.8, 1.1), "look": func(): return Vector3(maya.x, 1.4 + maya.y, maya.z) if maya and maya.node.visible else V.call(M, 2.4), "fov": 40},
		"eye": {"cam": V.call(R - dir*0.7 + side*0.45, 1.75), "look": eye, "fov": 18},
		"eyeX": {"cam": V.call(R - dir*0.4 - side*0.3, 1.6), "look": eye, "fov": 8},
		"mouth": {"cam": func(): var m: Vector3 = mouth.call(); return Vector3(m.x - dir.x*6 + side.x*1.5, 1.8, m.z - dir.y*6 + side.y*1.5), "look": mouth, "fov": 46},
		"mouthX": {"cam": func(): var m: Vector3 = mouth.call(); return Vector3(m.x - dir.x*3.2 - side.x*0.8, m.y - 0.3, m.z - dir.y*3.2 - side.y*0.8), "look": mouth, "fov": 34},
		"kai": {"cam": func(): var k: Vector3 = kp.call(1.55); return Vector3(k.x - dir.x*2.0 + side.x*0.9, 1.55, k.z - dir.y*2.0 + side.y*0.9), "look": func(): return kp.call(1.35), "fov": 32},
		"kaiWide": {"cam": func(): var k: Vector3 = kp.call(1.6); return Vector3(k.x + side.x*3.6, 1.3, k.z + side.y*3.6), "look": func(): return kp.call(1.2), "fov": 50},
		"overKai": {"cam": func(): var k: Vector3 = kp.call(1.6); return Vector3(k.x - dir.x*1.1 - side.x*0.5, 1.8, k.z - dir.y*1.1 - side.y*0.5), "look": V.call(M, 2.8), "fov": 52},
		"canon": {"cam": func(): var q: Vector3 = cp.call(); return Vector3(q.x + side.x*1.6, 0.5, q.z + side.y*1.6), "look": cp, "fov": 40},
		"canonTop": {"cam": func(): var q: Vector3 = cp.call(); return Vector3(q.x - dir.x*0.5, q.y + 2.4, q.z - dir.y*0.5), "look": cp, "fov": 44},
		"canonX": {"cam": func(): var q: Vector3 = cp.call(); return Vector3(q.x - dir.x*1.8 + side.x*0.6, q.y + 0.5, q.z - dir.y*1.8 + side.y*0.6), "look": cp, "fov": 30},
		"run": {"cam": func(): var r: Vector2 = rrun.call(); return V.call(r - dir*2.2 + side*0.5, 1.4), "look": func(): return V.call(rrun.call(), 1.1), "fov": 58},
		"runLow": {"cam": func(): var r: Vector2 = rrun.call(); return V.call(r - dir*1.2 - side*1.4, 0.3), "look": func(): var r: Vector2 = rrun.call(); return V.call(r + dir*3, 1.6), "fov": 72},
		"runFront": {"cam": func(): var r: Vector2 = rrun.call(); return V.call(r - dir*3.5, 1.2), "look": func(): return V.call(rrun.call(), 1.3), "fov": 44}}
	var stand_r := func(): stand("idle", R, ry)
	var canon_from := {"p": null, "in": false}
	var burst := {"done": false}
	var shots := cuts(3.8, [CAM.rising, CAM.her, CAM.lowUp, CAM.high, CAM.lowUp2, CAM.herWide, CAM.side, CAM.lowUp], {
		"start": func(): g.fm_aim(g.FIGHTM.drop1); mon.act("roar"); g.cue("roar"); haywire(0.6); g.cue("clang"); if maya: g.fight.play(maya, "stagger"); stand_r.call(); if wind: wind.k = 0.7,
		"tick": func(dt, t, k):
			# not grown: the black takes her as she is lifted; then it breaks out of her all at once, full size, and
			# rises up out of the black where she was
			stand_r.call()
			if alpha_fx: alpha_fx.cover = 1.0
			if k < 0.45:
				mon.grow = 0.001
				if maya and maya.node.visible: maya.x = lerpf(M0.x, M.x, k*1.2); maya.z = lerpf(M0.y, M.y, k*1.2); maya.y = k*2.2; g.fight._place(maya)
			else:
				if not burst.done:
					burst.done = true; mon.grow = 1.0
					if maya: maya.node.visible = false
					if oc: oc.queue_free(); oc = null
					flash(0.7); shake(1.0, 0.9); g.cue("boom"); g.cue("roar"); mon.act("roar"); _smoke(Vector3(M.x, 1.2, M.y)); later(0.25, func(): _smoke(Vector3(M.x, 0.4, M.y))); later(0.6, func(): _smoke(Vector3(M.x, 2.6, M.y)))
				var u := clampf((k - 0.45)/0.3, 0, 1); var e := 1.0 - pow(1.0 - u, 3)
				mon.position.y = lerpf(-7.0, 0.0, e)
			if hay: hay.k = 0.6 + k*0.3
			if randf() < dt*3: shake(0.5, 0.3)})
	shots.append_array(cuts(1.6, [CAM.eye, CAM.her, CAM.eyeX], {"start": func(): mon.grow = 1.0; flash(0.28); mon.act("roar"); g.cue("roar")}))
	shots.append_array(cuts(1.8, [CAM.side, CAM.behind, CAM.lowUp2, CAM.sideB], {"start": func():
		shake(0.6, 0.5)
		for i in 4: later(i*0.22, func(): if mon: mon.reach(Vector3(R.x + (randf() - 0.5)*6, 0.5 + randf()*3, R.y + (randf() - 0.5)*6)))}))
	shots.append_array(cuts(g.lines_len("monsterKai") + 0.6, [CAM.kai, CAM.overKai, CAM.kaiWide, CAM.kai, CAM.her], {
		"start": func():
			if kai: kai.hp = 1.0; kai.state = "cut"; kai.node.visible = true; g.fight.play(kai, "getup")
			g.talk("monsterKai"); later(0.8, func(): if kai: g.fight.play(kai, "walk_back")),
		"tick": func(dt, t, k):
			if kai and t > 0.8:
				var a := atan2(kai.x - M.x, kai.z - M.y); kai.x += sin(a)*dt*1.4; kai.z += cos(a)*dt*1.4; kai.yaw = a + PI; g.fight._place(kai)}))
	shots.append_array(cuts(1.2, [CAM.kaiWide, CAM.kai], {"start": func(): if kai: kai.yaw = 0.0; g.fight.play(kai, "sprint"),
		"tick": func(dt, t, k): if kai: kai.yaw = 0.0; kai.z += dt*6.5; g.fight._place(kai)}))
	shots.append_array([
		{"dur": 2.0, "fov": 52, "fov2": 46, "ease": false,
			"cam": func(k, t): return V.call(R - dir*(1.5 - k*0.4) - side*1.1, 0.6 + k*0.1),
			"look": func(k, t): return V.call(R*0.2 + M*0.8 + side*0.9, 3.6),
			"enter": func(): g.dutch = -0.06; mon.pull = 0.6; mon.act("roar"); g.cue("roar"); g.cue("glitch"); shake(0.45, 2.0); stand_r.call(),
			"tick": func(dt, t, k): mon.pull = 0.6 + k*0.5; stand_r.call(); if wind: wind.k = 0.8},
		{"dur": 3.2, "fov": 58, "ease": false,
			"cam": func(k, t):
				var a0 := atan2(dir.x, dir.y) + PI; var a = a0 + k*TAU; var rr := 7.8 - sin(k*PI)*0.9
				return Vector3(M.x + sin(a)*rr, 1.3 + k*2.2, M.y + cos(a)*rr),
			"look": V.call(M, 3.2), "enter": func(): g.dutch = 0.0; shake(0.2, 3.2),
			"tick": func(dt, t, k): mon.pull = 1.1 + k*0.8; stand_r.call(); if wind: wind.k = 0.9 + k*0.3},
		# her, looking at it: a dolly zoom — the camera falls back as the lens closes in, her face holding its size
		{"mood": "shocked", "dur": 2.4, "fov": 53, "ease": false,
			"cam": func(k, t):
				var d = 0.7 + k*2.5; g.cam.fov = 2*rad_to_deg(atan(0.27/d))
				return V.call(R + dir*d, 1.6),
			"look": V.call(R, 1.6), "enter": func(): g.dutch = 0.0; stand_r.call(),
			"tick": func(dt, t, k): mon.pull = 1.9; stand_r.call(); if wind: wind.k = 1.1}])
	shots.append_array(cuts(2.2, [CAM.canon, CAM.canonTop, CAM.mouthX, CAM.canonX], {"start": func(): if c: c.pose = "ko"; c.follow = false,
		"tick": func(dt, t, k): if c: var m: Vector3 = mon.mouth; var s = k*0.35; c.x = lerpf(C0.x, m.x, s*s); c.z = lerpf(C0.y, m.z, s*s)}))
	shots.append_array(cuts(g.lines_len("canonGone") + 0.5, [CAM.her, CAM.herSide, CAM.her], {"start": func(): stand("idle", R, ang(R, C0)); g.talk("canonGone")}))
	shots.append_array(cuts(2.6, [CAM.mouth, CAM.canonX, CAM.mouthX, CAM.her, CAM.mouth, CAM.canonX], {"start": func(): if c: c.pose = "fall"; canon_from.p = Vector2(c.x, c.z),
		"tick": func(dt, t, k):
			if c == null or canon_from.in: return
			var m: Vector3 = mon.mouth; var f: Vector2 = canon_from.p if canon_from.p != null else C0; var r = (1 - k)*1.2; var a = k*14
			c.x = lerpf(f.x, m.x, k*k) + cos(a)*r; c.z = lerpf(f.y, m.z, k*k) + sin(a)*r; c.y = lerpf(0, m.y - 0.6, k); c.yaw += dt*9
			c.node.scale = Vector3.ONE*maxf(0.02, 1 - k*k)
			if k > 0.97: canon_from.in = true; c.node.visible = false; flash(0.45); shake(0.9, 0.6); g.cue("clang")}))
	shots.append_array(cuts(2.0, [CAM.her, CAM.high, CAM.herSide, CAM.her], {"start": func():
		g.fm_aim(g.FIGHTM.drop2, 2.0 + 1.6 + 1.4 + 1.2 + g.lines_len("robinFight") + 0.4)
		if hay: hay.k = 1.0
		if wind: wind.k = 1.2}))
	shots.append_array([
		{"mood": "angry", "dur": 1.6, "fov": 30, "cam": F.herTight.cam, "look": F.herTight.look, "enter": func(): stand_r.call(); if hay: hay.k = 0.7},
		{"dur": 1.4, "fov": 42, "cam": V.call(R - dir*1.6 + side*1.2, 1.3), "look": V.call(R, 1.2), "enter": stand_r, "beats": [[0.5, func(): g.kit("jacket", true); g.cue("zip")]]},
		{"dur": 1.2, "fov": 26, "cam": V.call(R + dir*0.7 + side*0.5, 1.15), "look": V.call(R, 1.05), "enter": func(): stand("fight", R, ry), "beats": [[0.3, func(): g.kit("gloves", true); g.cue("gear")]]},
		{"mood": "angry", "dur": g.lines_len("robinFight") + 0.4, "fov": 26, "cam": F.her.cam, "look": F.her.look, "enter": func(): stand("fight", R, ry); g.talk("robinFight")}])
	var run_shots := [
		{"dur": 1.1, "fov": 56, "cam": V.call(R - dir*5 + side*3, 1.2), "look": V.call(R - dir*2, 1.0),
			"enter": func(): if mon: mon.act("tail"); mon.position = Vector3(M.x, 0, M.y); mon.rotation.y = myaw,
			"tick": func(dt, t, k): var r = R - dir*k*3; stand("hit" if k < 0.5 else "fall", r, ry, sin(k*PI)*0.8)},
		{"dur": 1.2, "fov": 40, "cam": V.call(R - dir*3 - side*1.5, 0.5), "look": V.call(R - dir*3, 0.6), "enter": func(): stand("getup", R - dir*3, ry); shake(0.4, 0.5)},
		{"mood": "nervous", "dur": g.lines_len("robinGo") + 0.2, "fov": 24, "cam": V.call(R - dir*3 + side*0.45 + dir*0.6, 1.1), "look": V.call(R - dir*3, 1.05), "enter": func(): stand("kneel", R - dir*3, ry); g.talk("robinGo")}]
	run_shots.append_array(cuts(1.8, [CAM.run, CAM.runLow, CAM.runFront, CAM.run], {"tick": func(dt, t, k): run.k = 1 + k*0.4; stand("sprint", rrun.call(), ry + PI)}))
	var to_escape := done(func():
		g.dutch = 0.0
		if kai: kai.node.visible = false
		if mon: mon.grow = 1.0; mon.pull = 1.2
		var L := _a(sp.ladder); var r := Vector2(TX(-4.2), -119)
		g.place(Vector3(r.x, 0, r.y), ang(L, r) + PI)
		esc = {"t": 0.0, "caught": 0, "reach": 1.0, "hitT": 0.0}; cy.watch = "escape"
		if hay: hay.k = 0.8
		g.note("RUN — the green EXIT, straight ahead."))
	g.play_reel(shots, done(func(): brawl(M, ry, dir, side, func(): duel(func(): g.fm_aim(g.FIGHTM.drop3, 2.3 + g.lines_len("robinGo") + 0.2, [g.FIGHTM.drop3, g.FIGHTM.end]); g.play_reel(run_shots, to_escape)))))

## SHE FIGHTS IT FOR HIM — on her own feet: you move her (WASD), it turns to keep its jaws on her. It rears back before
## it bites (DODGE!): be out of its reach when the jaws come down — move, or SPACE throws her aside. A bite that misses
## leaves it open (HIT IT!): get in close and click. Two that land, or her down, or long enough, and it swats her.
func brawl(M0: Vector2, ry: float, dir: Vector2, _side: Vector2, cb: Callable) -> void:
	if mon: mon.grow = 1.0; mon.position = Vector3(M0.x, 0, M0.y)
	var b0 := M0 - dir*4.2
	g.place(Vector3(b0.x, 0, b0.y), ry + PI)
	g.mode = ""
	B = {"st": "wait", "t": 0.0, "wait": 1.6, "hp": 100.0, "burnT": 0.0, "hits": 0, "all": 0.0, "punch": 0.0, "dash": null, "last_space": false, "done": cb}
	_brawl_hud("")
	g.talk("robinPunch")
	g.fm_aim(g.FIGHTM.drop2, 0.0, [g.FIGHTM.drop2, g.FIGHTM.drop2 + g.FIGHTM.bar*4])
func _brawl_hud(msg: String) -> void:
	if B == null: brawl_l.text = ""; return
	brawl_l.text = (msg + "\n" if msg != "" else "") + "✊".repeat(B.hits)
func brawl_click() -> void:
	if B == null or B.punch > 0: return
	B.punch = 0.45; g.play(["jab", "cross", "hook"][randi() % 3], 0.05); g.cue("kick")
	var p: Vector3 = g.robin.position; var d := Vector2(p.x - mon.position.x, p.z - mon.position.z).length()
	if B.st == "open" and d < 4.6:
		B.hits += 1; B.st = "landed"; B.t = 0.0; _brawl_hud("✊")
		later(0.16, func(): if mon: mon.flinch(); shake(0.55, 0.35); g.cue("punch"); flash(0.22, Color(0.7, 0.5, 1)))
	elif d < 4.6: shake(0.15, 0.15)
func _tick_brawl(dt: float) -> void:
	if B == null or mon == null: return
	B.t += dt; B.all += dt
	var p: Vector3 = g.robin.position; var r := mon
	var dx := p.x - r.position.x; var dz := p.z - r.position.z; var d := sqrt(dx*dx + dz*dz); var a := atan2(dx, dz)
	r.rotation.y += Fight.ang_diff(a, r.rotation.y)*minf(1, dt*(1.2 if B.st == "tele" else 3.0))
	var adv := 0.0
	match B.st:
		"wait": adv = 2.6 if d > 7 else (1.5 if d > 3.2 else 0.0)
		"tele": adv = 7.0 if B.t > 0.4 and B.t < 0.7 and d > 2.5 else 0.0
		"open": adv = 0.6 if d > 4 else 0.0
	if adv > 0: r.position += Vector3(sin(r.rotation.y), 0, cos(r.rotation.y))*dt*adv
	if d < 2.6 and B.dash == null and B.st != "hurt": _push(Vector2(dx, dz).normalized()*(2.6 - d)*dt*6)
	var space := Input.is_physical_key_pressed(KEY_SPACE); var edge: bool = space and not B.last_space; B.last_space = space
	if edge and B.dash == null:
		var mx := float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)); var mz := float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W))
		var yaw: float = g.cam_yaw; var rx := cos(yaw); var rz := -sin(yaw); var fx := sin(yaw); var fz := cos(yaw)
		var v := Vector2(rx*(mx if mx != 0 else 1.0) + fx*mz, rz*(mx if mx != 0 else 1.0) + fz*mz).normalized()
		B.dash = {"v": v, "t": 0.0}; g.cue("kick")
	if B.dash != null:
		B.dash.t += dt; _push(B.dash.v*dt*11*(1 - B.dash.t/0.25))
		if B.dash.t > 0.25: B.dash = null
	if B.punch > 0: B.punch -= dt
	match B.st:
		"wait":
			if B.t > B.wait:
				if randf() < 0.45 and d > 3.0: mon.act("roar"); g.cue("roar"); shake(0.4, 0.8); B.st = "roar"; B.t = 0.0; _brawl_hud("GET OUT OF ITS FIRE!")
				else: mon.act("bite"); g.cue("zip"); B.st = "tele"; B.t = 0.0; _brawl_hud("DODGE!")
		"roar":
			if B.t > 0.7: mon.breathe(Vector3(p.x, mon.global_position.y, p.z)); B.st = "fire"; B.t = 0.0
		"fire":
			mon.breathe(Vector3(p.x, mon.global_position.y, p.z))
			B.burnT = maxf(0, B.burnT - dt)
			if mon.burns(p + Vector3(0, 1.0, 0)) and B.dash == null:
				B.hp -= 26.0*dt
				if B.burnT <= 0: B.burnT = 0.35; flash(0.18, Color(0.35, 0.05, 0.6)); shake(0.25, 0.2); g.cue("punch"); g.play("hit", 0.05)
			if B.t > 2.2 or B.hp <= 0: mon.breathe(null); B.st = "open"; B.t = 0.0; _brawl_hud("HIT IT!")
		"tele":
			if B.t > 0.62:
				var fx2 := sin(r.rotation.y); var fz2 := cos(r.rotation.y); var ahead := dx*fx2 + dz*fz2; var across := absf(dx*fz2 - dz*fx2)
				if ahead > -0.5 and ahead < 6.2 and across < 2.4 and B.dash == null:
					B.hp -= 34.0; B.st = "hurt"; B.t = 0.0; _brawl_hud(""); var bd: Vector3 = Vector3(dx, 0, dz); g.fight.fx.sparks(p + Vector3(0, 1.2, 0), bd, 1.4); g.fight.fx.lines(p + Vector3(0, 1.2, 0), bd, 1.1); shake(0.75, 0.5); flash(0.3, Color(1, 0.2, 0.3)); g.cue("punch")
					_push(Vector2(dx, dz).normalized()*1.6); g.play("hit", 0.05)
				else: B.st = "open"; B.t = 0.0; _brawl_hud("HIT IT!")
		"open":
			if B.t > 1.6: B.st = "wait"; B.t = 0.0; B.wait = 1.0 + randf(); _brawl_hud("")
		"landed":
			if B.t > 0.9: B.st = "wait"; B.t = 0.0; B.wait = 0.8 + randf()*0.8; _brawl_hud("")
		"hurt":
			if B.t > 1.2: B.st = "wait"; B.t = 0.0; B.wait = 1.2 + randf()*0.8; _brawl_hud("")
	if (B.hits >= 2 or B.hp <= 0 or B.all > 35) and (B.st == "wait" or (B.st == "landed" and B.t > 0.6)):
		var cb: Callable = B.done; B = null; brawl_l.text = ""; cb.call()
func _push(v: Vector2) -> void:
	var to := Vector2(g.boots.x, g.boots.z) + v
	if g.boots.overlapping(to.x, to.y, g.boots.y) == null: g.boots.x = to.x; g.boots.z = to.y; g.robin.position.x = to.x; g.robin.position.z = to.y

## AND THEN SHE REALLY FIGHTS IT. Four passes, each ending with it on her: the picture holds, and it is SPACE, as fast as
## you can, to fill the bar before it wins. Fill it and she throws it off and hits it; don't, and it throws her.
func duel(cb: Callable) -> void:
	g.talk_q.clear(); mon.grow = 1.0
	var p: Vector3 = g.robin.position; var Mx := Vector2(mon.position.x, mon.position.z)
	var ry := ang(Vector2(p.x, p.z), Mx); var dir := Vector2(sin(ry), cos(ry)); var side := Vector2(cos(ry), -sin(ry))
	var d0 := 9.0; var R0 := Mx - dir*d0
	var at := func(f: float, s_ := 0.0) -> Vector2: return R0 + dir*f + side*s_
	var eye := func() -> Vector3: return mon.eye_at if mon else Vector3(Mx.x, 4, Mx.y)
	var mouth := func() -> Vector3: return mon.mouth if mon else Vector3(Mx.x, 3.5, Mx.y)
	var H := func() -> float: return maxf(2.6, eye.call().y)
	var to_her := ry + PI
	var mv := {"f": 0.0, "s": 0.0}
	var mpos := func() -> Vector2: return Mx - dir*mv.f + side*mv.s
	var mset := func(f: float, s_: float = 0.0, yaw = null):
		mv.f = f; mv.s = s_
		if mon: var q: Vector2 = mpos.call(); mon.position = Vector3(q.x, 0, q.y); mon.rotation.y = to_her if yaw == null else float(yaw)
	var mgo := func(f0: float, f1: float, s0 := 0.0, s1 = null, yaw = null) -> Callable:
		return func(k): mset.call(lerpf(f0, f1, k), lerpf(s0, s0 if s1 == null else float(s1), k), yaw.call(k) if yaw is Callable else yaw)
	var her := {"p": Vector3(R0.x, 0, R0.y)}
	var put := func(clip: String, x: float, y: float, z: float, yaw = null): her.p = Vector3(x, y, z); g.stage(clip, x, y, z, ry if yaw == null else float(yaw))
	var arc := func(a: Vector2, b: Vector2, k: float, h: float) -> Vector3: return Vector3(lerpf(a.x, b.x, k), sin(PI*k)*h, lerpf(a.y, b.y, k))
	var hb := func(y := 1.1) -> Vector3: return her.p + Vector3(0, y, 0)
	var mb := func(y: float) -> Vector3: var q: Vector2 = mpos.call(); return Vector3(q.x, y, q.y)
	var hit := func(big: bool):
		if mon:
			mon.flinch()
			var mp: Vector3 = mon.global_position + Vector3(0, 2.6, 0); var hd: Vector3 = mp - g.robin.position; hd.y = 0
			g.fight.fx.sparks(mp, hd, 1.4 if big else 0.9)
			if big: g.fight.fx.lines(mp, hd, 1.2)
		shake(0.9 if big else 0.5, 0.6 if big else 0.35); g.cue("punch"); flash(0.5 if big else 0.25, Color(0.75, 0.5, 1))
	var slam := func(): shake(0.8, 0.5); g.cue("punch"); flash(0.35, Color(1, 0.2, 0.3))
	var ts := func(v: float): Engine.time_scale = v; g.fm_slow(v)
	var ramp := func(lo: float, mid_: float, w := 0.16) -> Callable: return func(k): ts.call(1 - (1 - lo)*exp(-pow((k - mid_)/w, 2)))
	var S := func(o: Dictionary) -> Dictionary:
		var t0 = o.get("tick"); var e0 = o.get("enter")
		o.tick = func(dt, t, k):
			if o.has("ramp"): o.ramp.call(k)
			if o.has("mon"): o.mon.call(k)
			if t0 is Callable: t0.call(dt, t, k)
		o.enter = func():
			if e0 is Callable: e0.call()
			if o.has("mon"): o.mon.call(0.0)
			if not o.has("ramp"): ts.call(1.0)
			if o.has("clip"): g.clip = ""; g.play(o.clip, 0.05); g.anim.speed_scale = (g.anim.current_animation_length/(o.dur*0.95)) if g.anim.current_animation_length > 0 else 1.0
		for key in ["cam", "look"]:
			var v = o[key]
			if v is Callable and v.get_argument_count() == 0: o[key] = func(k, t): return v.call()
			elif v is Callable and v.get_argument_count() == 1: o[key] = func(k, t): return v.call(k)
		return o
	var res := {"won": 0, "lost": 0, "over": false, "combo": 0}
	var mash := func(label: String, secs: float, camf: Callable, lookf: Callable, fov: float, hold: Callable) -> Dictionary:
		var m := {"k": 0.0, "left": secs, "done": false, "T": 0.0, "endT": 0.0, "win": false, "space": false}
		return {"dur": 999.0, "fov": fov, "cam": func(k, t): return camf.call(), "look": func(k, t): return lookf.call(), "ease": false, "m": m,
			"enter": func(): ts.call(0.18); hold.call(0.0); g.cue("glitch"); mash_box.visible = true; mash_l.text = label + "\nPRESS SPACE AS FAST AS YOU CAN",
			"tick": func(dt, t, k):
				var real = dt/maxf(0.05, Engine.time_scale); m.T += real; hold.call(minf(1, m.T/secs))
				var sp_ := Input.is_physical_key_pressed(KEY_SPACE) or (auto and fmod(m.T, 0.12) < 0.06)
				if sp_ and not m.space and not m.done: m.k = minf(1, m.k + 0.13); shake(0.12, 0.08)
				m.space = sp_
				if m.done:
					m.endT -= real
					if m.endT <= 0: mash_box.visible = false; ts.call(1.0); if g.reel: g.reel.t = 1e6
					return
				m.left -= real; m.k = maxf(0, m.k - real*0.2); mash_bar.value = m.k; mash_s.text = "%.1fs" % maxf(0, m.left)
				if m.k >= 1 or m.left <= 0:
					m.done = true; m.win = m.k >= 1; m.endT = 0.9
					if m.win: res.won += 1; mash_l.text = "✔ SUCCESS"; g.cue("win"); flash(0.35, Color(0.5, 1, 0.8))
					else:
						res.lost += 1; mash_l.text = "✖ FAILED\nshe takes the hit"; g.cue("fail"); shake(0.4, 0.3)
						if res.lost >= 2: res.over = true}
	var branch := func(ms: Dictionary, win_s: Array, lose_s: Array) -> Array:
		return [ms, {"dur": 0.001, "cam": ms.cam, "look": ms.look, "fov": ms.fov, "enter": func():
			var list: Array = win_s if ms.m.win else lose_s
			if res.over: g.reel_replace_rest(list + [{"dur": 0.6, "cam": ms.cam, "look": ms.look, "fov": ms.fov, "enter": restart_night}])
			else: g.reel_insert(list)}]
	var thrown := func(from: float, to: float, camF: float) -> Array:
		return [S.call({"dur": 1.1, "fov": 52, "cam": func(): var q: Vector2 = at.call(camF, -3.4); return Vector3(q.x, 1.3, q.y), "look": func(): return hb.call(1.0), "ramp": ramp.call(0.35, 0.25, 0.12),
				"enter": slam, "tick": func(dt, t, k): var q: Vector3 = arc.call(at.call(from), at.call(to, -1.0), k, 1.4); put.call("hit" if k < 0.6 else "fall", q.x, q.y, q.z)}),
			S.call({"dur": 0.8, "fov": 40, "cam": func(): var q: Vector2 = at.call(to - 1.6, -2.4); return Vector3(q.x, 0.4, q.y), "look": func(): return hb.call(0.5),
				"enter": func(): var q: Vector2 = at.call(to, -1.0); put.call("getup", q.x, 0, q.y)})]
	var shots := []
	# ONE. They go at each other; she cartwheels under its jaws; the flying kick into the side of its jaw
	shots.append_array([
		S.call({"dur": 1.3, "fov": 72, "ease": false, "cam": func(k): var q: Vector2 = at.call(-1.2 + k*3.4, 0.6); return Vector3(q.x, 0.3, q.y), "look": func(): return hb.call(1.0),
			"mon": mgo.call(0, 2.6), "enter": func(): mon.act("roar"); g.cue("growl"), "tick": func(dt, t, k): var q: Vector2 = at.call(k*3.4); put.call("sprint", q.x, 0, q.y)}),
		S.call({"dur": 1.5, "fov": 46, "ease": false, "clip": "cartL", "cam": func(k): var q: Vector2 = at.call(3.6, -4.6 + k*1.0); return Vector3(q.x, 0.9, q.y), "look": func(): return hb.call(0.9),
			"ramp": ramp.call(0.12, 0.45, 0.18), "mon": mgo.call(2.6, 3.4, 0.0, -0.6, func(k): return to_her - 0.5*sin(PI*k)), "enter": func(): mon.act("bite"); g.cue("zip"),
			"tick": func(dt, t, k): var a: Vector2 = at.call(3.4); var b: Vector2 = at.call(3.9, 1.8); put.call("cartL", lerpf(a.x, b.x, k), 0, lerpf(a.y, b.y, k))}),
		S.call({"dur": 1.6, "fov": 58, "ease": false, "clip": "flykick", "ramp": ramp.call(0.08, 0.6, 0.1),
			"cam": func(k): var a = ry + PI*0.5 + k*1.7; var c: Vector3 = hb.call(0.0); return Vector3(c.x + sin(a)*3.4, 0.4 + k*1.4, c.z + cos(a)*3.4), "look": func(): return hb.call(1.0),
			"mon": mgo.call(3.4, 2.4, -0.6, 0.0, func(k): return to_her + (0.7*sin(PI*(k - 0.6)/0.4) if k > 0.6 else 0.0)), "enter": func(): g.cue("kick"),
			"tick": func(dt, t, k): var q: Vector3 = arc.call(at.call(3.9, 1.8), at.call(d0 - 4.0, 0.6), k, minf(3.2, H.call()*0.6)); put.call("flykick", q.x, q.y, q.z),
			"beats": [[0.96, func(): hit.call(false)]]})])
	shots.append_array(branch.call(
		mash.call("HOLD ITS JAWS OPEN", 4.2, func(): var q: Vector2 = at.call(d0 - 6.4, -1.8); return Vector3(q.x, 0.5, q.y), func(): return Vector3(her.p.x, 2.0, her.p.z), 46,
			func(k): mset.call(2.4 + k*0.6, 0.0); var q: Vector2 = at.call(d0 - 4.6 - k*0.6, 0.2); put.call("block", q.x, 0, q.y)),
		[S.call({"dur": 0.8, "fov": 30, "clip": "power", "cam": func(): var q: Vector2 = at.call(d0 - 6.2, 0.9); return Vector3(q.x, 0.7, q.y), "look": func(): return hb.call(1.4), "ramp": ramp.call(0.1, 0.45, 0.1),
			"mon": mgo.call(3.0, 1.6), "enter": func(): var q: Vector2 = at.call(d0 - 5.2, 0.2); put.call("power", q.x, 0, q.y); g.cue("kick"), "beats": [[0.36, func(): hit.call(true)]]}),
		 S.call({"dur": 1.2, "fov": 66, "cam": func(): var q: Vector2 = at.call(d0 - 9.5, 3.8); return Vector3(q.x, 0.5, q.y), "look": func(): return mb.call(H.call()*0.8),
			"mon": mgo.call(1.6, 0.0, 0.0, 0.0, func(k): return to_her + sin(k*9)*0.12), "enter": func(): mon.act("roar"); g.cue("roar"); shake(0.6, 1)})],
		thrown.call(d0 - 5.2, d0 - 9.5, d0 - 11) + [S.call({"dur": 0.6, "fov": 50, "cam": func(): var q: Vector2 = at.call(d0 - 11, 2); return Vector3(q.x, 1.0, q.y), "look": func(): return mb.call(H.call()*0.7), "mon": mgo.call(3.0, 0.0)})]))
	# TWO. It charges; she slides under it, out the far side, a backflip, and the spin kick into its eye on the way over
	shots.append_array([
		S.call({"dur": 1.1, "fov": 70, "ease": false, "cam": func(k): var q: Vector2 = at.call(d0 - 11 + k*2.6, -0.7); return Vector3(q.x, 0.35, q.y), "look": func(): return hb.call(1.0),
			"mon": mgo.call(0, 3.5), "enter": func(): g.cue("growl"); mon.act("bite"), "tick": func(dt, t, k): var q: Vector2 = at.call(lerpf(d0 - 9.5, d0 - 6.2, k)); put.call("sprint", q.x, 0, q.y)}),
		S.call({"dur": 2.2, "fov": 84, "ease": false, "clip": "evroll", "ramp": ramp.call(0.15, 0.5, 0.2),
			"cam": func(k): var q: Vector2 = at.call(lerpf(d0 - 6.8, d0 + 1.2, k), 0.35); return Vector3(q.x, 0.18, q.y),
			"look": func(k): var q: Vector2 = at.call(lerpf(d0 - 4.2, d0 + 3.5, k)); return Vector3(q.x, 0.9 + sin(PI*k)*0.6, q.y),
			"mon": mgo.call(3.5, 4.5), "enter": func(): g.cue("zip"); shake(0.4, 1.2), "tick": func(dt, t, k): var q: Vector2 = at.call(lerpf(d0 - 6.2, d0 + 1.0, k)); put.call("evroll", q.x, 0, q.y)}),
		S.call({"dur": 1.4, "fov": 50, "ease": false, "clip": "bflip", "ramp": ramp.call(0.25, 0.55, 0.15),
			"cam": func(k): var q: Vector2 = at.call(d0 + 4.5, 2.8 - k*1.4); return Vector3(q.x, 1.0 + k, q.y), "look": func(): return hb.call(1.0),
			"mon": mgo.call(4.5, 4.0, 0.0, 0.0, func(k): return to_her + PI*minf(1, k*1.3)), "enter": func(): g.cue("kick"),
			"tick": func(dt, t, k): var q: Vector3 = arc.call(at.call(d0 + 1.0), at.call(d0 + 2.4), k, 1.4); put.call("bflip", q.x, q.y, q.z, ry + PI)}),
		S.call({"dur": 0.9, "fov": 48, "cam": func(k): var q: Vector2 = at.call(d0 + 5.2, -2.6); return Vector3(q.x, 1.0, q.y), "look": func(): return hb.call(1.0),
			"mon": mgo.call(4.0, 4.0, 0.0, 0.0, func(k): return to_her + PI - PI*0.7*k), "enter": func(): g.cue("step"),
			"tick": func(dt, t, k): var a: Vector2 = at.call(d0 + 2.4); var b: Vector2 = at.call(d0 + 1.0); put.call("sprint", lerpf(a.x, b.x, k), 0, lerpf(a.y, b.y, k), ry + PI)}),
		S.call({"dur": 2.0, "fov": 62, "ease": false, "clip": "spin", "ramp": ramp.call(0.07, 0.5, 0.12),
			"cam": func(k): var q: Vector2 = mpos.call(); return Vector3(q.x + side.x*5.5 - dir.x*1.0, 1.4 + k*1.2, q.y + side.y*5.5 - dir.y*1.0), "look": func(): return hb.call(0.6),
			"mon": mgo.call(4.0, 3.2, 0.0, 0.0, func(k): return to_her + PI*0.3*(1 - k)), "enter": func(): g.cue("launch"),
			"tick": func(dt, t, k): var q: Vector3 = arc.call(at.call(d0 + 1.0), at.call(d0 - 6.5), k, H.call() + 0.8); put.call("spin", q.x, maxf(0, q.y), q.z, ry + PI*(1 - k)),
			"beats": [[1.0, func(): hit.call(true)]]})])
	shots.append_array(branch.call(
		mash.call("IT HAS YOU PINNED — BREAK FREE", 4.0, func(): var q: Vector2 = at.call(d0 - 6.5, 3.6); return Vector3(q.x, 0.7, q.y), func(): return Vector3(her.p.x, 0.9, her.p.z), 44,
			func(k): mset.call(3.2 + k*0.6, 0.0, to_her + sin(k*20)*0.08); var q: Vector2 = at.call(d0 - 6.5); put.call("ko", q.x, 0, q.y, ry + PI); if randf() < 0.1: shake(0.2, 0.15)),
		[S.call({"dur": 1.3, "fov": 50, "clip": "evflip", "ramp": ramp.call(0.3, 0.35, 0.12), "cam": func(): var q: Vector2 = at.call(d0 - 9.5, -3); return Vector3(q.x, 1.2, q.y), "look": func(): return hb.call(0.8),
			"mon": mgo.call(3.8, 1.0), "enter": func(): g.cue("kick"); hit.call(false), "tick": func(dt, t, k): var q: Vector3 = arc.call(at.call(d0 - 6.5), at.call(d0 - 8.0, 0.5), k, 1.3); put.call("evflip", q.x, q.y, q.z)})],
		thrown.call(d0 - 6.5, d0 - 8.0, d0 - 9.5) + [S.call({"dur": 0.5, "fov": 50, "cam": func(): var q: Vector2 = at.call(d0 - 10, 2); return Vector3(q.x, 1.0, q.y), "look": func(): return mb.call(H.call()*0.7), "mon": mgo.call(3.8, 1.0)})]))
	# THREE. It roars into her face from a metre off; she leans into it
	shots.append_array([
		S.call({"mood": "angry", "dur": 1.0, "fov": 24, "cam": func(): var q: Vector2 = at.call(d0 - 6.6); return Vector3(q.x, 1.6, q.y), "look": func(): var q: Vector2 = at.call(d0 - 7.5); return Vector3(q.x, 1.6, q.y),
			"mon": mgo.call(1.0, 2.2), "enter": func(): var q: Vector2 = at.call(d0 - 7.5); put.call("fight", q.x, 0, q.y)}),
		S.call({"dur": 1.0, "fov": 38, "cam": func(): var m: Vector3 = mouth.call(); return Vector3(m.x - dir.x*5.5, m.y - 0.5, m.z - dir.y*5.5), "look": mouth,
			"mon": mgo.call(2.2, 2.8), "enter": func(): mon.act("roar"); g.cue("roar"); shake(0.9, 2.5); if wind: wind.k = 1.4})])
	var combo_cams := [{"cam": func(): var q: Vector2 = at.call(d0 - 6, 1.4); return Vector3(q.x, 1.2, q.y), "look": func(): return hb.call(1.2), "fov": 30},
		{"cam": func(): var q: Vector2 = at.call(d0 - 2.6, -1.7); return Vector3(q.x, 0.5, q.y), "look": func(): return hb.call(1.6), "fov": 52},
		{"cam": func(): var q: Vector2 = at.call(d0 - 7, -0.4); return Vector3(q.x, 2.6, q.y), "look": func(): return hb.call(1.0), "fov": 44}]
	shots.append_array(branch.call(
		mash.call("STAND AGAINST THE ROAR", 4.0, func(): var q: Vector2 = at.call(d0 - 9.8, 0.5); return Vector3(q.x, 0.9, q.y), func(): var m2: Vector2 = mpos.call(); return Vector3((her.p.x + m2.x)/2, 1.8, (her.p.z + m2.y)/2), 34,
			func(k): mset.call(2.8 + k*0.8, 0.0); var q: Vector2 = at.call(d0 - 7.5 - k*0.8); put.call("block", q.x, 0, q.y); if randf() < 0.2: shake(0.25, 0.2)),
		cuts(1.9, combo_cams, {"start": func(): ts.call(1.0); if wind: wind.k = 0.9,
			"tick": func(dt, t, k):
				mset.call(lerpf(3.6, 0.8, k), 0.0, to_her + sin(k*12)*0.15); var q: Vector2 = at.call(lerpf(d0 - 8.3, d0 - 3.2, minf(1, k*2.5)))
				put.call("sprint" if k < 0.35 else ("knee" if k < 0.6 else ("elbow" if k < 0.8 else "hook")), q.x, 0, q.y)
				for j in 3:
					if k >= [0.5, 0.72, 0.92][j] and not (res.combo & (1 << j)): res.combo |= 1 << j; hit.call(j == 2)}),
		thrown.call(d0 - 8.3, d0 - 11.5, d0 - 13) + [S.call({"dur": 0.5, "fov": 50, "cam": func(): var q: Vector2 = at.call(d0 - 13, 2); return Vector3(q.x, 1.0, q.y), "look": func(): return mb.call(H.call()*0.7), "mon": mgo.call(3.6, 0.8)})]))
	# FOUR. Everything she has: up higher than she has ever gone, and down fist first; its jaws on her fists
	shots.append_array([
		S.call({"dur": 1.3, "fov": 74, "ease": false, "cam": func(k): var q: Vector2 = at.call(lerpf(d0 - 12, d0 - 8, k), -0.8); return Vector3(q.x, 0.3, q.y), "look": func(): return hb.call(1.2),
			"mon": mgo.call(0.8, 2.6), "enter": func(): g.cue("gear"); g.cue("growl"), "tick": func(dt, t, k): var q: Vector2 = at.call(lerpf(d0 - 11, d0 - 5.2, k)); put.call("sprint", q.x, 0, q.y)}),
		S.call({"dur": 2.4, "fov": 60, "ease": false, "clip": "bflip", "ramp": ramp.call(0.14, 0.5, 0.12),
			"cam": func(k): var c: Vector3 = hb.call(0.0); var a = ry + PI + k*PI*1.4; return Vector3(c.x + sin(a)*4.2, maxf(0.4, c.y + 0.4 - k*0.6), c.z + cos(a)*4.2), "look": func(): return hb.call(1.0),
			"mon": mgo.call(2.6, 2.6, 0.0, 0.0, func(k): return to_her + sin(k*3)*0.2), "enter": func(): g.cue("launch"),
			"tick": func(dt, t, k): var q: Vector3 = arc.call(at.call(d0 - 5.2), at.call(d0 - 4.6, 1.4), k, minf(6.4, H.call() + 0.6)); put.call("bflip", q.x, maxf(0, q.y), q.z),
			"beats": [[1.2, func(): hit.call(true)]]})])
	shots.append_array(branch.call(
		mash.call("PUNCH THROUGH", 4.2, func(): var q: Vector2 = at.call(d0 - 7.6, -2.2); return Vector3(q.x, 0.4, q.y), func(): return Vector3(her.p.x, 2.2, her.p.z), 44,
			func(k): mset.call(2.6 + k*0.5, 0.0); var q: Vector2 = at.call(d0 - 4.6, 1.4); put.call("block", q.x, 0, q.y)),
		[S.call({"dur": 1.0, "fov": 34, "clip": "power", "ramp": ramp.call(0.08, 0.45, 0.12), "cam": func(): var q: Vector2 = at.call(d0 - 7.0, -1.6); return Vector3(q.x, 0.5, q.y), "look": func(): return hb.call(1.6),
			"enter": func(): g.cue("kick"), "tick": func(dt, t, k): var a: Vector2 = at.call(d0 - 4.6, 1.4); var q: Vector3 = arc.call(a, a, k, 2.4); put.call("power", q.x, q.y, q.z),
			"beats": [[0.45, func(): hit.call(true); flash(0.9)]]}),
		 S.call({"dur": 2.3, "fov": 66, "clip": "fight", "ramp": ramp.call(0.3, 0.1, 0.25), "cam": func(k): var q: Vector2 = at.call(d0 - 11, 4.5 - k*1.5); return Vector3(q.x, 0.35, q.y), "look": func(): return mb.call(H.call()*0.7),
			"mon": mgo.call(3.1, -0.8, 0.0, 0.0, func(k): return to_her + sin(k*10)*0.25*(1 - k)), "enter": func(): mon.act("roar"); mon.flinch(); g.cue("roar"); shake(1.0, 2.0); g.cue("boom"),
			"tick": func(dt, t, k): var q: Vector2 = at.call(d0 - 4.6, 1.4); put.call("fight", q.x, 0, q.y)})],
		thrown.call(d0 - 4.6, d0 - 8.5, d0 - 10)))
	g.play_reel(shots, done(func():
		Engine.time_scale = 1.0; mash_box.visible = false; g.anim.speed_scale = 1.0; g.fm_slow(1.0)
		if wind: wind.k = 0.8
		cb.call()))
## too much for her: the night starts over, from the door to the old platform
func restart_night() -> void:
	mash_box.visible = false; Engine.time_scale = 1.0; g.fm_slow(1.0); g.fm_stop(0.3)
	g.black(true); g.end_text("[font_size=18]IT WAS TOO MUCH FOR HER[/font_size]\nTRY AGAIN")
	later(2.6, func():
		if g.reel: g.reel = null
		g.mode = ""; g.staged = null; B = null; brawl_l.text = ""
		tunnels_gone(); g.fight.clear()
		g.kit("jacket", false); g.kit("gloves", false)
		cy.tunnels_resume(6)
		g.black(false); g.note("Again — through the door, to the old platform."))
func _tick_escape(dt: float) -> void:
	var p: Vector3 = g.robin.position
	esc.t += dt
	if mon:
		var d := Vector2(p.x - mon.position.x, p.z - mon.position.z).length(); var a := atan2(p.x - mon.position.x, p.z - mon.position.z)
		mon.rotation.y = a
		if d > 4.5 and mon.position.z > -124: mon.position += Vector3(sin(a), 0, cos(a))*dt*2.4
		esc.reach -= dt
		if esc.reach <= 0: esc.reach = 0.9 + randf()*0.8; mon.reach(Vector3(p.x, 1.0, p.z)); g.cue("zip")
		esc.hitT = maxf(0, esc.hitT - dt)
		if d < 5.2 and esc.hitT <= 0:
			esc.caught += 1; esc.hitT = 1.2; shake(0.5, 0.4); g.cue("punch"); flash(0.5, Color.from_hsv(randf(), 1, 1))
			_push(Vector2(sin(a), cos(a))*(6.4 - d)); g.note("Keep going!")
	if Vector2(p.x - sp.ladder[0], p.z - sp.ladder[1]).length() < 1.6: cy.watch = ""; climb_out()
func climb_out() -> void:
	g.talk_q.clear()
	var L := _a(sp.ladder)
	g.play_reel([
		{"dur": 1.6, "fov": 40, "cam": Vector3(L.x + 1.6, 1.4, L.y + 2.6), "look": Vector3(L.x, 1.8, L.y - 0.6), "tick": func(dt, t, k): g.stage("climb_up", L.x, k*2.2, L.y - 0.3, PI),
			"beats": [[0.2, func(): g.cue("step")], [0.8, func(): g.cue("step")]]},
		{"dur": 1.3, "fov": 50, "cam": Vector3(L.x - 0.6, 2.6, L.y + 0.4), "look": func(k, t): return Vector3(mon.mouth.x, 2.2, mon.mouth.z) if mon else Vector3(L.x, 1.3, L.y + 4),
			"enter": func(): if mon: mon.reach(Vector3(L.x, 2.2, L.y)); g.cue("roar")}],
		done(func():
			g.black(true)
			later(0.5, func(): g.black(false); tunnels_gone(); cy.out_of_sub(); street_scene())))
func tunnels_gone() -> void:
	if alpha_fx: alpha_fx.remove(); alpha_fx = null
	if mon: mon.dispose(); mon = null
	if oc: oc.queue_free(); oc = null
	g.fm_stop(1.5)
	g.music.stop(); haywire(0); wind_off(); g.dutch = 0.0
	if cy.gizmo: cy.gizmo.visible = false
	if cy.lights_node:
		for l in cy.lights_node.get_children(): if l.has_meta("e0"): l.light_energy = l.get_meta("e0"); l.remove_meta("e0")
	g.fight.clear()

# ================================================================== THE CHASE
func chaos_on(at: Vector2) -> void:
	if chaos != null: return
	chaos = {"t": 0.0, "lights": [], "beams": [], "civs": [], "boltT": 2.0}
	var tex := GradientTexture2D.new(); tex.fill = GradientTexture2D.FILL_RADIAL; tex.fill_from = Vector2(0.5, 0.5); tex.fill_to = Vector2(1, 0.5)
	var gr := Gradient.new(); gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(1, 1, 1, 0)); gr.add_point(0.3, Color(1, 1, 1, 0.5)); tex.gradient = gr
	for i in 8:
		var r := 14 + randf()*24; var an := randf()*TAU
		var s := Sprite3D.new(); s.texture = tex; s.pixel_size = 9.0/64.0; s.billboard = BaseMaterial3D.BILLBOARD_ENABLED; s.render_priority = 101
		s.modulate = Color("#3a6aff") if i % 2 else Color("#ff2a2a"); s.position = Vector3(at.x + sin(an)*r, 2.2, at.y + cos(an)*r); g.city.add_child(s)
		chaos.lights.append({"s": s, "ph": randf()*6, "k": i % 2})
	for i in 3:
		var cone := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.05; cm.bottom_radius = 3.5; cm.height = 80; cone.mesh = cm
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = Color(0.81, 0.86, 1, 0.04); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; m.cull_mode = BaseMaterial3D.CULL_DISABLED; m.render_priority = 101; cone.material_override = m
		var piv := Node3D.new(); piv.position = Vector3(at.x + (i - 1)*30, 70, at.y - 20 + i*15); g.city.add_child(piv); piv.add_child(cone); cone.position.y = -40
		chaos.beams.append({"p": piv, "ph": i*2.1})
	for i in 10:
		var an2 := randf()*TAU; var r2 := 10 + randf()*26
		var node: Node3D = (load("res://assets/tsh/people/%s.glb" % ["a", "b", "c", "d", "e", "f", "g", "h", "s", "v"][i]) as PackedScene).instantiate(); g.city.add_child(node)
		node.position = Vector3(at.x + sin(an2)*r2, 0, at.y + cos(an2)*r2); node.rotation.y = atan2(node.position.x - at.x, node.position.z - at.y)
		var ap: AnimationPlayer = g._find(node, func(q): return q is AnimationPlayer)
		if ap and ap.has_animation("sprint"): ap.get_animation("sprint").loop_mode = Animation.LOOP_LINEAR; ap.play("sprint")
		chaos.civs.append(node)
	alert_l.visible = true
func _tick_chaos(dt: float) -> void:
	if chaos == null: return
	chaos.t += dt; var fd: float = chaos.get("fade", 1.0)
	for o in chaos.lights: o.s.modulate.a = (0.9 if sin(chaos.t*9 + o.ph + (PI if o.k else 0.0)) > 0.3 else 0.05)*minf(1, chaos.t/2)*fd
	for o in chaos.beams: var a: float = chaos.t*0.35 + o.ph; o.p.rotation = Vector3(sin(a)*0.45, 0, cos(a*1.3)*0.45)
	chaos.boltT -= dt
	if chaos.boltT <= 0 and not chaos.has("fade"): chaos.boltT = 3 + randf()*5; flash(0.3, Color(0.75, 0.6, 1)); later(0.3 + randf()*0.6, func(): g.cue("boom"))
	if randf() < dt*0.5: g.cue("alarm")
	for n in chaos.civs:
		if is_instance_valid(n): n.position += Vector3(sin(n.rotation.y), 0, cos(n.rotation.y))*dt*4.5
	if chaos.has("fade"):
		chaos.fade = maxf(0, chaos.fade - dt/3)
		if chaos.fade <= 0: chaos_gone()
func chaos_off() -> void:
	if chaos == null: return
	alert_l.visible = false; chaos.fade = 1.0
func chaos_gone() -> void:
	if chaos == null: return
	for o in chaos.lights: o.s.queue_free()
	for o in chaos.beams: o.p.queue_free()
	for n in chaos.civs: if is_instance_valid(n): n.queue_free()
	chaos = null; alert_l.visible = false
## the sky goes the colour of a bruise
func storm(k: float) -> void:
	var env: Environment = g.env
	if k > 0:
		if storm_was == null: storm_was = {"amb": env.ambient_light_energy, "sun": g.sun.light_energy if g.sun else 1.0, "fog": env.fog_light_color, "fd": env.fog_density, "exp": env.tonemap_exposure, "bgm": env.background_mode, "bg": env.background_color}
		var w: Dictionary = storm_was
		env.ambient_light_energy = w.amb*(1 - 0.45*k)
		if g.sun: g.sun.light_energy = w.sun*(1 - 0.85*k)
		env.fog_light_color = (w.fog as Color).lerp(Color("#1c1428"), k); env.fog_density = w.fd + 0.0015*k*0.7
		if k > 0.3: env.background_mode = Environment.BG_COLOR; env.background_color = env.fog_light_color
		env.tonemap_exposure = w.exp*(1 - 0.12*k)
		return
	if storm_was == null: return
	var s: Dictionary = storm_was
	env.ambient_light_energy = s.amb; if g.sun: g.sun.light_energy = s.sun
	env.fog_light_color = s.fog; env.fog_density = s.fd; env.tonemap_exposure = s.exp; env.background_mode = s.bgm; env.background_color = s.bg
	storm_was = null
func lose(v) -> void:
	lose_box.visible = v != null
	if v != null: lose_bar.value = v
## up the ladder, into the light — and it does NOT come up after her. It stays down there. She has one breath of it,
## and then WFC are all round her (wfc_standoff).
func street_scene() -> void:
	g.talk_q.clear()
	g.S.dm = maxf(g.S.get("dm", 0), 16*60 + 40)
	if cy.canon: cy.canon.node.queue_free(); cy.canon = null
	cy.station_props()
	g.S.tun = 7; g.S.shoesBack = true; g.S.chase = true; g._save()
	g.kit("jacket", true); g.kit("gloves", true)
	for t2 in Boots.EARLY + Boots.MID: g.boots.have[t2] = true
	if mon: mon.dispose(); mon = null
	Tower.build(g)
	var E := cy.ENTRY; var at := Vector2(cy.EXIT.x - 0.8, cy.EXIT.y + 0.6); var ry := ang(at, E)
	var F: Dictionary = cy.facing(at, ry, 1.0); var A: Dictionary = F.A
	var st := func(): stand("idle", at, ry)
	var shots := [
		{"dur": 2.6, "fov": 50, "cam": Vector3(at.x - sin(ry)*4, 9, at.y - cos(ry)*4), "look": Vector3(at.x, 0.8, at.y), "enter": func(): st.call(); g.set_caption("EXT. HARBOR LANE — 4:40 PM"); g.cue("door")},
		{"mood": "sad", "dur": 2.4, "fov": 30, "cam": A.herTight.cam, "look": A.herTight.look, "enter": func(): stand("kneel", at, ry)},
		{"mood": "shocked", "dur": 2.0, "fov": 34, "cam": A.profileL.cam, "look": Vector3(cy.EXIT.x, 0.2, cy.EXIT.y), "enter": func(): st.call(); shake(0.15, 0.6); g.cue("thud")},
		{"dur": g.lines_len("surfaceBreath") + 0.4, "fov": 28, "cam": A.herTight.cam, "look": A.herTight.look, "enter": func(): st.call(); g.talk("surfaceBreath")}]
	g.play_reel(shots, done(func():
		g.dutch = 0.0
		wfc_standoff(at, 0.0)))
## WFC. Where it went down into the street, they come up all round her. She tries to tell them.
func wfc_standoff(at: Vector2, y0: float) -> void:
	g.talk_q.clear()
	var ry := PI/2; var F: Dictionary = cy.facing(at, ry, 1.0, y0 + 1.62); var A: Dictionary = F.A
	_wfc_gone()
	for i in 3:
		var a := ry + (i - 1)*0.7; var x := at.x + sin(a)*6.5; var z := at.y + cos(a)*6.5
		var n: Dictionary = g.chase.spawn_cop(Vector3(x, y0, z), "cut"); n.yaw = atan2(at.x - x, at.y - z); g.chase._cop_place(n); g.chase._cop_play(n, "fight"); wfc_crew.append(n)
	# the gunship, over her, its light on her
	var gn := GunshipRig.make(g.city)                         # the gunship (wfc/gunship.glb, gunship.gd: it flies itself)
	var red := Node3D.new(); gn.add_child(red)
	var cone := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.05; cm.bottom_radius = 2.6; cm.height = 1.0; cone.mesh = cm
	var cmat := StandardMaterial3D.new(); cmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cmat.albedo_color = Color(0.91, 0.96, 1, 0.16); cmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; cmat.cull_mode = BaseMaterial3D.CULL_DISABLED; cmat.render_priority = 101; cone.material_override = cmat; g.city.add_child(cone)
	var pool := MeshInstance3D.new(); var pm := CylinderMesh.new(); pm.top_radius = 2.8; pm.bottom_radius = 2.8; pm.height = 0.01; pool.mesh = pm
	var pmat: StandardMaterial3D = cmat.duplicate(); pmat.albedo_color = Color(0.96, 0.97, 1, 0.35); pool.material_override = pmat; g.city.add_child(pool)
	gn.position = Vector3(at.x + 4, y0 + 16, at.y - 6)
	gun = {"g": gn, "cone": cone, "pool": pool, "red": red}
	var stand_ := func():
		g.stage("idle", at.x, y0, at.y, ry); _aim(at.x, y0, at.y)
	var wf := func() -> Vector3:
		var n = wfc_crew[1] if wfc_crew.size() > 1 else (wfc_crew[0] if wfc_crew.size() else null)
		return Vector3(n.x, n.y + 1.6, n.z) if n else Vector3(at.x, y0 + 1.6, at.y + 6)
	var C := {
		"her": {"cam": A.herTight.cam, "look": A.herTight.look, "fov": 26},
		"wide": {"cam": Vector3(at.x - 7, y0 + 3.2, at.y - 5), "look": Vector3(at.x, y0 + 1.2, at.y + 2), "fov": 52},
		"them": {"cam": Vector3(at.x + sin(ry + PI)*0.7 + 0.4, y0 + 1.5, at.y + cos(ry + PI)*0.7), "look": wf, "fov": 30},
		"top": {"cam": Vector3(at.x + 1, y0 + 12, at.y - 3), "look": Vector3(at.x, y0, at.y), "fov": 50},
		"low": {"cam": Vector3(at.x + 1.6, y0 + 0.3, at.y - 1.4), "look": wf, "fov": 56}}
	var AC: Dictionary = A.duplicate(); AC.merge(C, true)
	var shots := cuts(1.8, [C.top, C.wide, C.her], {"mood": "shocked", "start": func(): stand_.call(); flash(0.5); g.cue("alert"); shake(0.3, 1), "tick": func(dt, t, k): stand_.call()})
	shots.append_array(cy.line_shots(["wfcFreeze", "wfcCanon"], _calls(AC), {"each": stand_, "pools": {"robin": ["her"], "wfc": ["them", "low", "wide"]}}))
	shots.append_array(cuts(1.0, [C.low, C.top], {"start": func(): g.cue("launch"); flash(0.4, Color(0.4, 1, 0.9))}))
	g.play_reel(shots, done(func():
		g.dutch = 0.0
		g.place(Vector3(at.x, y0, at.y), ry)
		later(0.15, func(): g.boots.vx = sin(ry + PI)*10; g.boots.vz = cos(ry + PI)*10; g.boots.ignite(ry + PI); g.note("WFC — RUN. The Meridian Tower, east of everything: get to the top."))
		for n in wfc_crew: n.state = "pursue"
		Tower.build(g)
		g.objective("Get to the Meridian Tower.")
		g.marker.position = Vector3(Tower.C.x, 12, Tower.C.y + Tower.HALF + 2); g.marker.visible = true
		hunt = {"t": 0.0, "meter": 0.0, "hitT": 0.0}; cy.watch = "wfcRun"))
## the angle dictionaries line_shots wants: a Callable look/cam with no arguments, made into one of (k, t)
func _calls(A: Dictionary) -> Dictionary:
	var out := {}
	for k in A:
		var a: Dictionary = A[k].duplicate()
		for key in ["cam", "look"]:
			var v = a[key]
			if v is Callable and v.get_argument_count() == 0: a[key] = func(_k, _t): return v.call()
		out[k] = a
	return out
func _aim(x: float, y: float, z: float) -> void:
	if gun == null: return
	var from: Vector3 = gun.g.position; var to := Vector3(x, y, z); var d := to - from
	if d.length() < 0.1: return
	gun.cone.global_transform = Transform3D(Basis(Quaternion(Vector3.UP, -d.normalized())).scaled(Vector3(1, d.length(), 1)), (from + to)/2)
	gun.pool.global_position = Vector3(x, y + 0.05, z)
func _tick_wfc_run(dt: float) -> void:
	var c = hunt
	if c == null or gun == null: return
	c.t += dt; c.hitT -= dt
	var p: Vector3 = g.robin.position; var gp: Vector3 = gun.g.position
	var dx := p.x - gp.x; var dz := p.z - gp.z; var d := maxf(0.001, sqrt(dx*dx + dz*dz)); var spd := 4.0 if c.t < 3 else 9.5
	gp.x += dx/d*minf(d, spd*dt); gp.z += dz/d*minf(d, spd*dt); gp.y += ((p.y + 15) - gp.y)*minf(1, dt); gun.g.position = gp
	gun.g.rotation.y = atan2(dx, dz)
	_aim(gp.x + dx/d*minf(d, 6), maxf(0, p.y), gp.z + dz/d*minf(d, 6))
	gun.red.visible = sin(c.t*8) > 0
	if d < 9:
		c.meter = maxf(0, c.meter - dt/8)
		if c.hitT <= 0: c.hitT = 2.2; g.cue("alert"); g.note("In the light — break away!")
	elif d > 22: c.meter = minf(1, c.meter + dt/7)
	for n in wfc_crew:
		var v := Vector2(p.x - n.x, p.z - n.z)
		if v.length() > 1.2 and absf(p.y - n.y) < 2: var s := v.normalized()*minf(v.length(), 4.5*dt); n.x += s.x; n.z += s.y; n.yaw = atan2(v.x, v.y); g.chase._cop_play(n, "sprint")
		else: g.chase._cop_play(n, "idle")
		g.chase._cop_place(n)
	# at the tower's foot (or somehow already on it): up
	var tc: Vector2 = Tower.C; var ex := maxf(absf(p.x - tc.x) - Tower.HALF, 0.0); var ez := maxf(absf(p.z - tc.y) - Tower.HALF, 0.0)
	if Vector2(ex, ez).length() < 5.0: cy.watch = ""; hunt = null; g.marker.visible = false; tower_climb()
func _wfc_gone() -> void:
	for n in wfc_crew: n.node.queue_free(); g.chase.cops.erase(n)
	wfc_crew.clear()
	if gun: gun.g.queue_free(); gun.cone.queue_free(); gun.pool.queue_free(); gun = null
## UP THE MERIDIAN TOWER: 140 m of glass, straight up the face, the gunship's light climbing after her
func tower_climb() -> void:
	g.talk_q.clear()
	for n in wfc_crew: n.node.queue_free(); g.chase.cops.erase(n)
	wfc_crew.clear()
	Tower.night(g, true); Rain.start(g, 0.35)                      # the storm is in: dark, and the first of the rain
	var p: Vector3 = g.robin.position; var tc: Vector2 = Tower.C; var H: float = Tower.HALF; var T: float = Tower.TOP
	# the face she reached: its outward normal, a point on it in line with her
	var dx := p.x - tc.x; var dz := p.z - tc.y
	var nrm := Vector2(signf(dx), 0) if absf(dx) - H > absf(dz) - H else Vector2(0, signf(dz))
	var along := Vector2(-nrm.y, nrm.x)
	var off := clampf(Vector2(dx, dz).dot(along), -H + 4, H - 4)
	var foot := tc + nrm*(H + 0.35) + along*off
	var ry := atan2(-nrm.x, -nrm.y)                          # facing the glass
	var up := func(k: float): g.stage("climb_up", foot.x, k*T, foot.y, ry)
	var land := tc + nrm*(H - 4.0) + along*off
	var V := func(q: Vector2, y: float) -> Vector3: return Vector3(q.x, y, q.y)
	var her := func(dy := 1.0) -> Vector3: return Vector3(foot.x, g.robin.position.y + dy, foot.y)
	var shots := [
		{"dur": 2.2, "fov": 72, "cam": V.call(foot + nrm*7 + along*2, 0.4), "look": func(k, t): return her.call(1.2),
			"enter": func(): g.set_caption("THE MERIDIAN TOWER"); g.cue("launch"); flash(0.3, Color(0.4, 1, 0.9)),
			"tick": func(dt, t, k): up.call(k*0.08)},
		{"dur": 2.6, "fov": 40, "cam": func(k, t): return V.call(foot + nrm*6 + along*4, T*(0.08 + k*0.42) + 1.5), "look": func(k, t): return her.call(),
			"tick": func(dt, t, k):
				up.call(0.08 + k*0.42)
				if gun: gun.g.position = Vector3(foot.x + nrm.x*16, T*(0.08 + k*0.42) - 6, foot.y + nrm.y*16); _aim(foot.x, g.robin.position.y, foot.y),
			"beats": [[0.4, func(): g.cue("step")], [1.2, func(): g.cue("step")], [2.0, func(): g.cue("step")]]},
		{"dur": 2.0, "fov": 58, "cam": V.call(foot + nrm*1.2, T + 6), "look": func(k, t): return her.call(),
			"tick": func(dt, t, k): up.call(0.5 + k*0.42)},
		{"dur": 1.6, "fov": 50, "cam": V.call(land - nrm*6 + along*3, T + 2.2), "look": V.call(foot, T + 0.8),
			"enter": func(): g.cue("swish"),
			"tick": func(dt, t, k):
				var q := foot.lerp(land, smoothstep(0.0, 1.0, k))
				g.stage("climb_up" if k < 0.35 else "idle", q.x, T + (sin(k*PI)*1.6 if k < 1 else 0.0) - (1.0 - k)*0.9*(1 if k < 0.35 else 0), q.y, ry + PI if k > 0.35 else ry),
			"beats": [[1.4, func(): g.cue("thud"); shake(0.2, 0.3)]]}]
	g.play_reel(shots, done(func():
		g.dutch = 0.0
		boss_scene(land, atan2(tc.x - land.x, tc.y - land.y))))

## THE DIRECTOR. On the roof, the gunship comes down onto the pad and somebody steps out of its light: the head of WFC,
## alone — she sends the gunship off. Robin's mother, and Robin knows it; her mother has no idea who is under the
## mask — that the one she is hunting, YU, is her own daughter. The rain starts as they square up; she fights her (Fight "director").
func boss_scene(R0: Vector2, ry: float) -> void:
	g.talk_q.clear()
	var T: float = Tower.TOP; var tc: Vector2 = Tower.C
	if not "boss" in g.S.seen: g.S.seen.append("boss")
	Tower.skyline(g, false); Tower.night(g, true); Rain.start(g, 0.35)
	Drones.build(g, tc, T)
	Director.build_piles(g, tc, T)
	var pad := tc + Tower.PAD
	g.fight.setup({"arena": Tower.arena(), "blocks": Tower.blocks(), "floor": T, "meet": R0})
	g.fight.cast([{"kind": "director", "x": pad.x, "z": pad.y, "tag": "director", "state": "idle", "yaw": atan2(R0.x - pad.x, R0.y - pad.y), "hidden": true}])
	var D = crew("director")
	if D: D.y = T; g.fight._place(D)
	var meet_at := R0 + Vector2(sin(ry), cos(ry))*4.2
	var dy := atan2(R0.x - meet_at.x, R0.y - meet_at.y)
	var st := func(nm := "idle"): g.stage(nm, R0.x, T, R0.y, ry)
	if gun == null:                                              # (a save picked up here: a gunship of its own)
		wfc_standoff_gun(Vector3(pad.x, T + 22, pad.y))
	var hover := func(k: float):
		if gun == null: return
		gun.g.position = Vector3(pad.x, T + lerpf(22.0, 3.2, smoothstep(0.0, 1.0, k)), pad.y); gun.g.rotation.y = ry + PI
		_aim(pad.x, T, pad.y)
	var her_ots: Vector3 = g.rel(R0.x, R0.y, ry, -0.75, 0.38, T + 1.68)        # over Robin's shoulder, on her mother's face
	var mom_ots: Vector3 = her_ots
	var her_face := Vector3(R0.x, T + 1.55, R0.y); var mom_face := func(): return Vector3(D.x, T + 1.6, D.z) if D else her_face
	var shots := [
		{"dur": 3.2, "fov": 56, "cam": Vector3(tc.x - 26, T + 9, tc.y + 24), "look": Vector3(tc.x, T, tc.y),
			"enter": func(): st.call(); g.set_caption("THE ROOF — THE MERIDIAN TOWER"), "tick": func(dt, t, k): hover.call(k*0.4)},
		{"dur": 3.0, "fov": 44, "cam": Vector3(R0.x - sin(ry)*1.2 + cos(ry)*0.6, T + 1.6, R0.y - cos(ry)*1.2 - sin(ry)*0.6), "look": Vector3(pad.x, T + 2.5, pad.y),
			"tick": func(dt, t, k): st.call(); hover.call(0.4 + k*0.6); shake(0.04, 0.1)},
		{"dur": 3.4, "fov": 34, "cam": Vector3(pad.x + 3, T + 1.0, pad.y - 4), "look": func(k, t): return mom_face.call(),
						"tick": func(dt, t, k): g.crew_walk(D, pad, pad.lerp(meet_at, 0.55), minf(1, k*1.1))},
		{"dur": g.lines_len("bossIn1") + 0.5, "fov": 15, "cam": her_ots, "look": func(k, t): return mom_face.call(),
			"enter": func(): g.crew_walk(D, pad.lerp(meet_at, 0.55), meet_at, 1.0); g.crew_face(D, R0.x, R0.y, "idle"); g.talk("bossIn1")},
		{"mood": "shocked", "dur": 2.0, "fov": 24, "cam": g.rel(R0.x, R0.y, ry, 0.8, 0.1, T + 1.6), "look": her_face, "enter": func(): st.call()},
		{"dur": g.lines_len("bossIn2") + 0.6, "fov": 14, "cam": her_ots, "look": func(k, t): return mom_face.call(),
			"enter": func(): g.crew_face(D, R0.x, R0.y, "idle"); g.talk("bossIn2")},
		{"mood": "sad", "dur": g.lines_len("bossIn3") + 0.6, "fov": 22, "cam": g.rel(R0.x, R0.y, ry, 0.7, -0.15, T + 1.58), "look": her_face,
			"enter": func(): st.call(); g.talk("bossIn3")},
		{"dur": g.lines_len("bossIn4") + 0.6, "fov": 16, "cam": mom_ots.lerp(her_ots, 0.0), "look": func(k, t): return mom_face.call(),
			"enter": func(): g.crew_face(D, R0.x, R0.y, "idle"); g.talk("bossIn4"),
			"beats": [[1.0, func(): if gun: var g0 = gun; var tw = g.create_tween(); tw.tween_property(g0.g, "position", Vector3(tc.x + Tower.HALF + 14, T + 12, tc.y + 6), 5.0)]]},
		# the rain comes in as they square up
		{"dur": 3.0, "fov": 46, "cam": Vector3((R0.x + meet_at.x)/2 + cos(ry)*6, T + 2.2, (R0.y + meet_at.y)/2 - sin(ry)*6), "look": Vector3((R0.x + meet_at.x)/2, T + 1.2, (R0.y + meet_at.y)/2),
			"enter": func(): Rain.start(g, 1.0); g.crew_face(D, R0.x, R0.y, "fight"); st.call("fight"); g.cue("thunder"); flash(0.7, Color(0.85, 0.9, 1)),
			"beats": [[1.6, func(): g.cue("gear")]]}]
	g.play_reel(shots, done(func():
		g.dutch = 0.0
		g.robin.position = Vector3(R0.x, T, R0.y); g.cam_yaw = ry + PI; g.cam_pitch = 0.0
		g.mode = "fight"; g.marker.visible = false
		g.objective("The Director.")
		g.note("Your mother. She doesn't know it's you.")
		g.fight.start(boss_end, "brawl")))

## to watch it: -- boss (straight onto the roof, past the surface and the run)
func boss_test() -> void:
	g.talk_q.clear(); cy.watch = ""; hunt = null
	Tower.build(g)
	if OS.get_cmdline_user_args().has("climb"):            # -- boss climb: from the foot of the tower
		g.place(Vector3(Tower.C.x - 6, 0, Tower.C.y + Tower.HALF + 2), PI); tower_climb(); return
	var R0 := Tower.C + Vector2(-6, 18)
	boss_scene(R0, atan2(Tower.C.x + 4 - R0.x, Tower.C.y + 2 - R0.y))

## HALF HER HEALTH: the fight stops; she touches her ear — "Bring the bird around. Light her up." — and the gunship
## comes up over the edge of the roof, its light swinging onto Robin, and turns its guns on her. Then the runs begin.
func gunship_cut(D) -> void:
	var F = g.fight; var T: float = Tower.TOP; var tc: Vector2 = Tower.C
	F.on = false; F.hud.visible = false
	var rp: Vector3 = g.robin.position; var R0 := Vector2(rp.x, rp.z); var M := Vector2(D.x, D.z)
	var ry := ang(R0, M); var my := ang(M, R0)
	# the gunship below the roof's edge on the far side of her, ready to rise
	var away := (R0 - M).normalized() if (R0 - M).length() > 0.1 else Vector2(1, 0)
	var edge := tc + away*(Tower.HALF + 9.0)
	if gun == null: wfc_standoff_gun(Vector3(edge.x, T - 14, edge.y))
	gun.g.position = Vector3(edge.x, T - 14, edge.y)
	var rise := func(k: float): gun.g.position = Vector3(edge.x, lerpf(T - 14, T + 6, smoothstep(0.0, 1.0, k)), edge.y); gun.g.rotation.y = atan2(R0.x - edge.x, R0.y - edge.y)
	var st := func(): g.stage("fight", R0.x, T, R0.y, ry); F.play(D, "idle"); D.yaw = my; F._place(D)
	var mface := Vector3(M.x, T + 1.6, M.y); var rface := Vector3(R0.x, T + 1.5, R0.y)
	var shots := [
		{"dur": g.lines_len("bossCall") + 0.4, "fov": 22, "cam": g.rel(M.x, M.y, my, 1.3, -0.25, T + 1.65), "look": mface,
			"enter": func(): st.call(); g.talk("bossCall"); F.play(D, "talk2")},
		{"dur": 3.2, "fov": 55, "cam": Vector3(clampf(R0.x - away.x*3.0 + away.y*3.5, tc.x - Tower.HALF + 3, tc.x + Tower.HALF - 3), T + 1.7, clampf(R0.y - away.y*3.0 - away.x*3.5, tc.y - Tower.HALF + 3, tc.y + Tower.HALF - 3)), "look": func(k, t): return gun.g.position.lerp(Vector3(edge.x, T + 2, edge.y), 0.3),
			"enter": func(): st.call(); g.cue("alert"),
			"tick": func(dt, t, k): rise.call(k); shake(0.05 + 0.1*k, 0.1)},
		{"mood": "shocked", "dur": 1.8, "fov": 46, "cam": Vector3(R0.x - away.x*2.6 - away.y*0.9, T + 0.45, R0.y - away.y*2.6 + away.x*0.9), "look": func(k, t): return gun.g.position.lerp(rface, 0.35),
			"tick": func(dt, t, k): rise.call(1.0)},
		{"dur": 1.6, "fov": 30, "cam": func(k, t): return gun.g.position + Vector3(away.x*-3.5, -0.4, away.y*-3.5) + Vector3(-away.y, 0, away.x)*2.0, "look": rface,
			"enter": func(): g.cue("lock"), "beats": [[0.6, func(): flash(0.25, Color(1, 0.2, 0.15))]]}]
	g.play_reel(shots, func(_s):
		g.dutch = 0.0; g.staged = null
		F.on = true; F.hud.visible = true; g.mode = "fight"
		Director.strafe = {"next": 1.2, "on": null}
		g.note("The gunship — get out of the red!"))

## a gunship of its own, over a point (the roof, when a save starts there)
func wfc_standoff_gun(at: Vector3) -> void:
	var gn := GunshipRig.make(g.city)                         # the gunship (wfc/gunship.glb, gunship.gd: it flies itself)
	var red := Node3D.new(); gn.add_child(red)
	var cone := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.05; cm.bottom_radius = 2.6; cm.height = 1.0; cone.mesh = cm
	var cmat := StandardMaterial3D.new(); cmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cmat.albedo_color = Color(0.91, 0.96, 1, 0.16); cmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; cmat.cull_mode = BaseMaterial3D.CULL_DISABLED; cmat.render_priority = 101; cone.material_override = cmat; g.city.add_child(cone)
	var pool := MeshInstance3D.new(); var pm := CylinderMesh.new(); pm.top_radius = 2.8; pm.bottom_radius = 2.8; pm.height = 0.01; pool.mesh = pm
	var pmat: StandardMaterial3D = cmat.duplicate(); pmat.albedo_color = Color(0.96, 0.97, 1, 0.35); pool.material_override = pmat; g.city.add_child(pool)
	gn.position = at
	gun = {"g": gn, "cone": cone, "pool": pool, "red": red}

## she has her mother down in the rain. Her mother asks who she is. She cannot say. She goes off the edge.
func boss_end() -> void:
	g.talk_q.clear()
	var T: float = Tower.TOP; var tc: Vector2 = Tower.C
	var D = crew("director")
	var p: Vector3 = g.robin.position; var at := Vector2(p.x, p.z)
	var M := Vector2(D.x, D.z) if D else at + Vector2(0, 2)
	var ry := ang(at, M)
	# the nearest edge, and over it
	var dx := at.x - tc.x; var dz := at.y - tc.y
	var nrm := Vector2(signf(dx), 0) if absf(dx) > absf(dz) else Vector2(0, signf(dz))
	var edge := Vector2(at.x if nrm.x == 0 else tc.x + nrm.x*(Tower.HALF + 0.3), at.y if nrm.y == 0 else tc.y + nrm.y*(Tower.HALF + 0.3))
	var off := edge + nrm*8.0
	var away := atan2(nrm.x, nrm.y)
	var her := Vector3(at.x, T + 1.55, at.y); var mom_face := Vector3(M.x, T + 0.9, M.y)
	if D: g.fight.play(D, "ko", 0.2)
	var shots := [
		{"dur": 3.0, "fov": 50, "cam": Vector3(at.x + cos(ry)*5, T + 3.5, at.y - sin(ry)*5), "look": Vector3((at.x + M.x)/2, T + 0.6, (at.y + M.y)/2),
			"enter": func(): g.stage("idle", at.x, T, at.y, ry); g.cue("thud"); flash(0.5, Color(0.85, 0.9, 1))},
		{"dur": g.lines_len("bossOut1") + 0.6, "fov": 26, "cam": g.rel(at.x, at.y, ry, -0.9, 0.35, T + 1.6), "look": mom_face, "enter": func(): g.talk("bossOut1")},
		{"mood": "sad", "dur": g.lines_len("bossOut2") + 1.0, "fov": 22, "cam": g.rel(at.x, at.y, ry, 0.75, -0.1, T + 1.55), "look": her, "enter": func(): g.talk("bossOut2")},
		{"dur": 1.6, "fov": 44, "cam": Vector3(edge.x - nrm.x*6 + nrm.y*3, T + 1.4, edge.y - nrm.y*6 - nrm.x*3), "look": Vector3(edge.x, T + 1.0, edge.y),
			"enter": func(): g.cue("launch"),
			"tick": func(dt, t, k): var q := at.lerp(edge, k); g.stage("sprint", q.x, T, q.y, away)},
		{"dur": 2.6, "fov": 62, "cam": Vector3(edge.x + nrm.x*3, T + 6, edge.y + nrm.y*3), "look": func(k, t): return g.robin.position + Vector3(0, 1, 0),
			"enter": func(): g.cue("swish"),
			"tick": func(dt, t, k): var q := edge.lerp(off, k); g.stage("fly", q.x, T + 1.5 - k*k*40.0, q.y, away)},
		{"dur": 3.0, "fov": 40, "cam": Vector3(M.x - sin(ry)*3, T + 1.2, M.y - cos(ry)*3), "look": Vector3(edge.x, T + 0.8, edge.y),
			"enter": func(): g.stage("idle", off.x, T - 60, off.y, away); if D: g.fight.play(D, "getup", 0.2),
			"tick": func(dt, t, k): if D and k > 0.6: g.crew_face(D, edge.x, edge.y, "idle")}]
	g.play_reel(shots, done(func():
		Rain.stop(); g.storm_rain = 0.0
		Tower.skyline(g, true); Tower.night(g, false); Drones.clear(); Director.clear()
		g.fight.clear()
		var q := off + nrm*20.0
		g.place(Vector3(q.x, 0, q.y), away)
		hide_scene()))

## she has lost them. Somewhere dark, on her own, she stops — and it all comes down on her. She calls him.
func hide_scene() -> void:
	g.talk_q.clear()
	if not "hide" in g.S.seen: g.S.seen.append("hide")
	var p: Vector3 = g.robin.position; var at := Vector2(p.x, p.z); var y0 := maxf(0, p.y)
	var F: Dictionary = cy.facing(at, PI/2, 1.0, y0 + 1.1); var A: Dictionary = F.A
	chaos_off(); g.music.stop(); g.fm_stop(4.0)
	if gun:
		var g0 = gun; gun = null; g0.cone.visible = false; g0.pool.visible = false
		var tw = g.create_tween(); tw.tween_property(g0.g, "position", g0.g.position + Vector3(80, 10, -60), 6.0); tw.tween_callback(func(): g0.g.queue_free(); g0.cone.queue_free(); g0.pool.queue_free())
	for n in wfc_crew: n.node.queue_free(); g.chase.cops.erase(n)
	wfc_crew.clear()
	var sit := func(): g.stage("kneel", at.x, y0, at.y, F.ry)
	var fr := Vector2(sin(F.ry), cos(F.ry))
	var PH := {"cam": Vector3(at.x + fr.x*0.7 + fr.y*0.35, y0 + 1.0, at.y + fr.y*0.7 - fr.x*0.35), "look": Vector3(at.x, y0 + 0.95, at.y)}
	var her_t: Vector3 = A.herTight.cam; var her_l := Vector3(at.x, y0 + 1.05, at.y)
	var shots := [
		{"dur": 3.0, "fov": 48, "cam": Vector3(at.x - 5, y0 + 4, at.y + 4), "look": Vector3(at.x, y0 + 0.6, at.y), "enter": func(): sit.call(); g.set_caption("LATER")},
		{"mood": "sad", "dur": 2.2, "fov": 26, "cam": her_t, "look": her_l, "enter": sit},
		{"mood": "sad", "dur": g.lines_len("hideCry") + 1.6, "fov": 30, "cam": PH.cam, "look": PH.look, "enter": func(): g.stage("phone_talk", at.x, y0, at.y, F.ry); g.phone_show("calling", "CANON"); g.cue("ring"); g.talk("hideCry")},
		{"mood": "sad", "dur": 1.6, "fov": 22, "cam": her_t, "look": her_l, "enter": func(): g.phone_show("nocall", "CANON"); g.cue("fail")},
		{"mood": "sad", "dur": g.lines_len("hideCry2") + 1.0, "fov": 24, "cam": her_t, "look": her_l, "enter": func(): g.phone_show("calling", "CANON"); g.cue("ui"); later(0.9, func(): g.phone_show("")); g.talk("hideCry2")},
		{"mood": "sad", "dur": 3.4, "fov": 58, "cam": Vector3(at.x - 9, y0 + 7, at.y - 7), "look": Vector3(at.x, y0 + 0.5, at.y), "enter": func(): sit.call(); storm(0.5)}]
	g.play_reel(shots, done(func():
		storm(0); haywire(0); wind_off(); sit.call()
		g.S.tun = 0; g.S.canonTaken = true; g.outcome("fixed")
		g.staged = null; g.place(Vector3(at.x, y0, at.y), -PI/2)
		gethome_begin()))
## GET HOME: over the roofs, however she likes
func gethome_begin(resume := false) -> void:
	if resume: cy.station_props(); g.place(Vector3(cy.EXIT.x, 0, cy.EXIT.y + 1), -PI/2)
	for t2 in Boots.EARLY + Boots.MID: g.boots.have[t2] = true
	g.kit("jacket", true); g.kit("gloves", true)
	g.objective("Get home.")
	g.marker.position = Vector3(73, 42, 34); g.marker.visible = true
	cy.watch = "home"
	g.note("🏠 Home — over the roofs, however you like.")
## her own roof. Her window. One final jump.
func home_roof() -> void:
	g.marker.visible = false
	g.outcome("home")
	var w: Array = g.nav.spots.homeWindow; var edge := Vector2(63.2, 34); var land := Vector2(w[0], w[1])
	g.play_reel([
		{"dur": 1.8, "fov": 40, "cam": Vector3(edge.x + 2.6, 13.6, edge.y + 2.0), "look": Vector3(land.x, 8.5, land.y), "enter": func(): g.stage("idle", edge.x, 12, edge.y, -PI/2)},
		{"dur": 1.0, "fov": 46, "cam": Vector3(edge.x + 1.2, 12.8, edge.y + 4.6), "look": Vector3(edge.x - 1, 10, edge.y),
			"tick": func(dt, t, k): var x := lerpf(edge.x, land.x, k); var y = 12 + sin(k*PI)*1.6 - 4*k*k; g.stage("jump", x, maxf(8, y), lerpf(edge.y, land.y, k), -PI/2),
			"beats": [[0.85, func(): g.cue("step")]]},
		{"dur": 1.4, "fov": 40, "cam": Vector3(land.x + 2.4, 9.4, land.y + 1.6), "look": Vector3(land.x - 0.4, 9.0, land.y), "enter": func(): g.stage("idle", land.x, 8, land.y, -PI/2); g.cue("door")}],
		done(func(): g.black(true); later(0.5, func(): g.black(false); bedroom())))

# ================================================================== THE END
## Home. She takes it all off and goes to wash the night off. And while the water runs, somebody lets themselves in:
## boots across her floor, a badge set down on her bench, a voice on a phone, WFC. The lamp comes on. It is her mother
## — the Director of WFC — and she is going to find YU. Robin cannot say a word of what is true. So she says nothing.
func bedroom() -> void:
	if not "bedroom" in g.S.seen: g.S.seen.append("bedroom")
	g.S.day = false                       # it is night again: her room dark but for the lamp
	g.indoor = "apt"; g.show_place("apt"); g.lamp.light_energy = 1.6
	g.apt_boots(false); g.apt_pack(false)
	var R: Dictionary = g.room.room
	var aw: Array = g.nav.spots.aptWindow; var win := Vector2(aw[0] + 0.6, aw[1])
	var bn: Vector3 = g._v(R.bench.at); var dr: Vector3 = g._v(R.door.at) if R.has("door") else Vector3(g.room.apt.x2 - 0.5, 0, g.room.apt.z)
	if sketch == null:
		sketch = Node3D.new(); g.apt.add_child(sketch)
		var pm := MeshInstance3D.new(); var pq := PlaneMesh.new(); pq.size = Vector2(0.3, 0.4); pm.mesh = pq
		var sm := StandardMaterial3D.new(); sm.albedo_color = Color(0.93, 0.92, 0.88); pm.material_override = sm
		pm.position = Vector3(bn.x + 0.25, bn.y + 0.006, bn.z + 0.05); pm.rotation.y = 0.25; sketch.add_child(pm)
		var lb := Label3D.new(); lb.text = "👟"; lb.font_size = 96; lb.pixel_size = 0.002; lb.rotation.x = -PI/2; lb.position = pm.position + Vector3(0, 0.003, 0); lb.modulate = Color(0.2, 0.2, 0.25); sketch.add_child(lb)
		var gd := MeshInstance3D.new(); var gb := BoxMesh.new(); gb.size = Vector3(0.14, 0.06, 0.1); gd.mesh = gb; gd.material_override = _std(Color("#444a50"), 0.4, 0.6)
		gd.position = Vector3(bn.x - 0.12, bn.y + 0.03, bn.z + 0.08); sketch.add_child(gd)
	g.place(Vector3(win.x, 0, win.y), -PI/2)
	apt_ending(R, win, bn, dr, Vector2(bn.x, bn.z + 0.6))
func _std(c: Color, r := 0.6, m := 0.0) -> StandardMaterial3D:
	var s := StandardMaterial3D.new(); s.albedo_color = c; s.roughness = r; s.metallic = m; return s
func _badge() -> Node3D:
	var n := Node3D.new()
	var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.1, 0.008, 0.064); b.mesh = bm; b.material_override = _std(Color("#c9a24a"), 0.3, 0.9); n.add_child(b)
	var l := Label3D.new(); l.text = "WFC\nDIRECTOR\nNº 0001"; l.font_size = 40; l.pixel_size = 0.0006; l.modulate = Color("#e8c56a"); l.outline_size = 0; l.rotation.x = -PI/2; l.position.y = 0.0045; n.add_child(l)
	return n
func apt_ending(R: Dictionary, win: Vector2, bn: Vector3, dr: Vector3, BS: Vector2) -> void:
	if not "reveal" in g.S.seen: g.S.seen.append("reveal")
	var door := Vector2(dr.x, dr.z - 0.7)
	var MS := Vector2(win.x - 1.1, win.y + 0.3); var RS := Vector2(door.x, door.y - 0.6)
	var ryR := ang(RS, MS); var ryM := ang(MS, RS)
	var P2: Dictionary = cy.pair_angles(RS, MS, Vector2(sin(ryR), cos(ryR)), Vector2(sin(ryM), cos(ryM)), Vector2(cos(ryR), -sin(ryR)), 1.62, 1.66)
	if mom != null and is_instance_valid(mom.node): mom.node.queue_free()
	var mn: Node3D = (load("res://assets/tsh/people/sable.glb") as PackedScene).instantiate(); g.apt.add_child(mn); mn.visible = false
	var map: AnimationPlayer = g._find(mn, func(q): return q is AnimationPlayer)
	if map: for a in map.get_animation_list(): map.get_animation(a).loop_mode = Animation.LOOP_LINEAR
	# the Director's clothes: her own black, nothing shiny, and the badge on her chest
	var msk: Skeleton3D = g._find(mn, func(q): return q is Skeleton3D)
	if msk:
		var bi := -1
		for i in msk.get_bone_count(): if msk.get_bone_name(i).ends_with("Spine2"): bi = i
		if bi >= 0:
			var att := BoneAttachment3D.new(); att.bone_idx = bi; msk.add_child(att)
			var bd := _badge(); var k := 1.0/maxf(0.001, msk.global_basis.get_scale().x); bd.scale = Vector3.ONE*k*0.6; bd.rotation.x = PI/2; bd.position = Vector3(0.08, 0.08, 0.13)*k; att.add_child(bd)
	mom = {"node": mn, "ap": map, "clip": ""}
	var mom_at := func(x: float, z: float, yaw: float, clip := "idle"):
		mn.visible = true; mn.position = Vector3(x, 0, z); mn.rotation.y = yaw
		if map and mom.clip != clip and map.has_animation(clip): mom.clip = clip; map.play(clip, 0.2)
	var shots := [
		{"dur": 2.2, "fov": 46, "inside": true, "cam": Vector3(win.x + 2.2, 1.7, win.y + 1.4), "look": Vector3(win.x, 1.0, win.y), "enter": func(): g.set_caption("INT. ROBIN'S BEDROOM — NIGHT"); g.stage("idle", win.x, 0, win.y, PI/2)},
		{"dur": 2.0, "fov": 44, "cam": Vector3(BS.x + 1.6, 1.6, BS.y + 1.4), "look": bn + Vector3(0, 0.05, 0), "tick": func(dt, t, k): g.walk_stage(win, BS, k)},
		{"dur": 1.5, "fov": 32, "cam": Vector3(BS.x + 0.7, 0.45, BS.y + 0.6), "look": Vector3(BS.x, 0.15, BS.y), "enter": func(): g.stage("kneel", BS.x, 0, BS.y, PI), "beats": [[0.7, func(): g.kit("shoes", false); g.cue("gear")]]},
		{"dur": 1.4, "fov": 28, "cam": g.rel(BS.x, BS.y, PI, 0.8, 0.35, 1.2), "look": Vector3(BS.x, 1.05, BS.y), "enter": func(): g.stage("idle", BS.x, 0, BS.y, PI), "beats": [[0.5, func(): g.kit("gloves", false); g.cue("zip")]]},
		{"mood": "sad", "dur": 1.6, "fov": 34, "cam": g.rel(BS.x, BS.y, PI, 1.2, -0.4, 1.4), "look": Vector3(BS.x, 1.3, BS.y), "beats": [[0.6, func(): g.kit("jacket", false); g.cue("zip")]]},
		{"mood": "sad", "dur": 2.2, "fov": 26, "cam": g.rel(BS.x, BS.y, PI, 0.9, 0.3, 1.55), "look": Vector3(BS.x, 1.5, BS.y)},
		{"dur": 2.4, "fov": 40, "cam": Vector3(bn.x + 0.6, 1.4, bn.z + 1.4), "look": Vector3(bn.x, 0.95, bn.z), "tick": func(dt, t, k): g.walk_stage(BS, door, k), "beats": [[2.1, func(): g.cue("door")]]},
		{"dur": 2.6, "fov": 52, "cam": Vector3(win.x + 0.3, 1.5, win.y + 0.4), "look": Vector3(door.x, 1.0, door.y), "enter": func(): g.staged = null; g.robin.visible = false; g.lamp.light_energy = 0.0},
		{"dur": 1.6, "fov": 30, "cam": Vector3(door.x + 0.9, 0.25, door.y - 1.6), "look": Vector3(door.x, 0.3, door.y + 0.4), "enter": func(): g.cue("door"); mom_at.call(door.x, door.y + 0.6, PI, "walk"),
			"tick": func(dt, t, k): mom_at.call(door.x, lerpf(door.y + 0.6, door.y - 0.6, k), PI, "walk")},
		{"dur": 2.6, "fov": 36, "cam": func(k, t): return Vector3(lerpf(door.x - 0.6, BS.x - 0.4, k), 0.22, lerpf(door.y - 1.4, BS.y + 0.9, k)), "look": func(k, t): return mn.position + Vector3(0, 0.35, 0),
			"tick": func(dt, t, k): var a := Vector2(door.x, door.y - 0.6); mom_at.call(lerpf(a.x, BS.x, k), lerpf(a.y, BS.y + 0.2, k), ang(a, BS), "walk"),
			"beats": [[0.4, func(): g.cue("step")], [1.2, func(): g.cue("step")], [2.0, func(): g.cue("step")]]},
		{"dur": 2.6, "fov": 22, "cam": Vector3(bn.x + 0.05, bn.y + 0.42, bn.z + 0.4), "look": Vector3(bn.x - 0.05, bn.y, bn.z + 0.12),
			"enter": func():
				mom_at.call(BS.x, BS.y + 0.2, PI, "idle")
				if badge == null: badge = _badge(); badge.scale = Vector3.ONE*1.4; g.apt.add_child(badge)
				badge.position = Vector3(bn.x - 0.05, bn.y + 0.006, bn.z + 0.12); g.cue("lock")}]
	var ap_lines: Array = g.lines.get("aptPhone", [])
	for i in ap_lines.size():
		var ln: Array = ap_lines[i]
		var cams := [Vector3(BS.x + 0.4, 1.25, BS.y + 1.4), Vector3(BS.x - 0.2, 0.9, BS.y + 0.9), Vector3(door.x + 0.5, 1.1, door.y - 0.9)]
		shots.append({"dur": g.line_len(ln[0], ln[1]) + 0.4, "fov": [34, 26, 40][i % 3], "cam": cams[i % 3], "look": Vector3(BS.x, [1.3, 1.0, 1.1][i % 3], BS.y),
			"enter": func(): mom_at.call(BS.x, BS.y + 0.2, PI, "idle"); g.talk([ln])})
	shots.append_array([
		{"dur": 2.2, "fov": 44, "cam": Vector3(MS.x + 0.2, 1.5, MS.y + 0.5), "look": Vector3(door.x, 1.3, door.y), "enter": func(): mom_at.call(MS.x, MS.y, ryM, "idle")},
		{"mood": "soft", "dur": 2.4, "fov": 40, "cam": Vector3(RS.x - 0.3, 1.6, RS.y - 1.8), "look": Vector3(RS.x, 1.4, RS.y + 0.6), "enter": func(): g.cue("door"); g.robin.visible = true, "tick": func(dt, t, k): g.walk_stage(door, RS, k)},
		{"dur": 2.8, "fov": 34, "cam": Vector3(RS.x - sin(ryR)*0.6 + cos(ryR)*0.3, 1.7, RS.y - cos(ryR)*0.6 - sin(ryR)*0.3), "look": Vector3(MS.x, 1.3, MS.y),
			"enter": func(): g.stage("idle", RS.x, 0, RS.y, ryR); mom_at.call(MS.x, MS.y, ryM, "idle"); g.cue("glitch")},
		{"mood": "shocked", "dur": 1.4, "fov": 24, "cam": P2.herTight.cam, "look": P2.herTight.look},
		{"mood": "shocked", "dur": 3.2, "fov": 40, "fov2": 22, "ease": false, "cam": P2.overHer.cam, "look": P2.himTight.look,
			"enter": func(): g.cue("ui"); g.lamp.light_energy = 1.6; flash(0.2, Color(1, 0.9, 0.7)); later(0.25, func(): g.cue("boom"))}])
	var each := func(): g.stage("idle", RS.x, 0, RS.y, ryR); mom_at.call(MS.x, MS.y, ryM, "idle")
	var flicker := func():
		g.lamp.light_energy = 0.0; later(0.18, func(): g.lamp.light_energy = 1.6); later(0.3, func(): g.lamp.light_energy = 0.0); later(0.52, func(): g.lamp.light_energy = 1.6)
	shots.append_array(cy.line_shots(["reveal1", "reveal2"], P2, {"each": each, "pools": {"robin": ["herTight", "her", "profileL"], "other": ["himTight", "overHer", "him"]},
		"ins": [["Don't look at me", "himTight", func(): shake(0.15, 0.3); g.cue("thud")], ["tore its way", "him", flicker]]}))
	shots.append_array(cy.line_shots(["reveal3"], P2, {"each": func(): g.stage("idle", RS.x, 0, RS.y, ryR), "pools": {"robin": ["herTight"], "other": ["himTight"]}}))
	shots.append({"mood": "sad", "dur": 3.4, "fov": 20, "cam": P2.herTight.cam, "look": P2.herTight.look})
	shots.append_array(cy.line_shots(["reveal4"], P2, {"each": func(): g.stage("idle", RS.x, 0, RS.y, ryR), "pools": {"robin": ["herTight"], "other": ["him", "himTight"]},
		"ins": [["never see daylight", "himTight", func(): g.cue("boom"); shake(0.35, 0.6); flash(0.25, Color(1, 0.85, 0.7))]]}))
	shots.append_array([
		{"mood": "sad", "dur": 3.6, "fov": 40, "cam": P2.two.cam, "look": P2.two.look,
			"tick": func(dt, t, k): var tt := minf(1, k*1.4); mom_at.call(lerpf(MS.x, RS.x + sin(ryR)*0.45, tt), lerpf(MS.y, RS.y + cos(ryR)*0.45, tt), ryM, "walk" if tt < 1 else "idle")},
		{"mood": "sad", "dur": 3.0, "fov": 18, "fov2": 14, "cam": P2.herTight.cam, "look": P2.herTight.look}])
	g.play_reel(shots, done(func():
		g.black(true); g.end_text("[font_size=18]ROBIN RYU[/font_size]\nTHE END")
		g.S.dayDone = true; g.S.revealed = true; g.S.step = "evening"; g._save()
		g.mode = "end"))
