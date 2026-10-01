## HEALTH ON WANO — the browser's public/health.js, with the same rules.
##
## A hundred points and a bar to show them, and a breath bar under it in the
## sea. What hurts: a hard landing (by how fast you hit the ground: a jump is
## free, a roof is a bruise, a sky island is the end; a mecha's legs and a
## panda's take their own), running out of air under the sea (twenty seconds,
## then 8 a second until you come up), and a reef shark that swims too close
## (it bites, then has to come round again).
##
## NOTHING HEALS ON ITS OWN: green orbs hung round Wano, two of them down on
## the reef, give 35 back and are gone for a minute.
##
## AT ZERO every coin you carry is gone and you wake in front of Mission
## Control with a full bar. Level, what you own, what you have finished and
## what you have found are kept.
class_name Health
extends Node3D

const MAX := 100.0
const BREATH := 20.0
const ORB_HEAL := 35.0
const ORB_BACK := 60.0
const SAFE_LAND := 13.0     # m/s you can land at for free

var world: Node3D
var hp := MAX
var breath := BREATH
var immortal := false
var dead := false
var orbs: Array = []        # {node, up, base, back}
var bite_cool := 0.0
var drown_t := 0.0
var t := 0.0

var ui: CanvasLayer
var bar: ProgressBar
var num: Label
var air: ProgressBar
var air_box: Control
var flash: ColorRect

const ORB_SPOTS := [[3, 9], [-8, 2], [12, -4], [-22, -2], [24, 6], [-14, 14], [8, 20], [-30, 10],
	[30, -8], [0, -26], [18, 16], [-36, -8]]

func _ready() -> void:
	_ui()
	_orbs()
	_draw()

# ------------------------------------------------------------------ the bars
func _bar(fill: Color, h: float) -> ProgressBar:
	var b := ProgressBar.new()
	b.show_percentage = false
	b.custom_minimum_size = Vector2(320, h)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(1, 1, 1, 0.12)
	bg.set_corner_radius_all(6)
	var fg := StyleBoxFlat.new()
	fg.bg_color = fill
	fg.set_corner_radius_all(6)
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fg)
	return b

func _ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	box.offset_left = -170
	box.offset_right = 170
	box.offset_top = -92
	box.offset_bottom = -16
	ui.add_child(box)
	var top := HBoxContainer.new()
	var lbl := Label.new()
	lbl.text = "HEALTH"
	lbl.add_theme_color_override("font_color", Color(0.8, 0.82, 0.9))
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	num = Label.new()
	num.add_theme_color_override("font_color", Color(0.8, 0.82, 0.9))
	top.add_child(lbl)
	top.add_child(num)
	box.add_child(top)
	bar = _bar(Color(0.55, 0.85, 0.75), 12)
	bar.max_value = MAX
	box.add_child(bar)
	air_box = VBoxContainer.new()
	var al := Label.new()
	al.text = "BREATH"
	al.add_theme_color_override("font_color", Color(0.75, 0.9, 1.0))
	air_box.add_child(al)
	air = _bar(Color(0.35, 0.82, 1.0), 8)
	air.max_value = BREATH
	air_box.add_child(air)
	box.add_child(air_box)
	flash = ColorRect.new()
	flash.color = Color(1, 0.15, 0.1, 0.0)
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(flash)

func _draw() -> void:
	bar.value = hp
	(bar.get_theme_stylebox("fill") as StyleBoxFlat).bg_color = Color(1.0, 0.42, 0.36) if hp <= 35.0 else Color(0.55, 0.85, 0.75)
	num.text = str(roundi(hp))
	air.value = breath
	air_box.visible = breath < BREATH - 0.01

# ------------------------------------------------------------------ the damage
func hurt(n: float, why := "") -> void:
	if dead or immortal:
		return
	hp = maxf(0.0, hp - maxf(1.0, roundf(n)))
	_draw()
	flash.color.a = 0.35
	if hp <= 0.0:
		_die(why)

func heal(n: float) -> void:
	hp = minf(MAX, hp + n)
	_draw()

func landed(speed: float) -> void:
	if speed > SAFE_LAND:
		hurt(pow(speed - SAFE_LAND, 1.5) * 1.6, "That was a long way down" if speed > 30.0 else "")

func _die(why: String) -> void:
	dead = true
	var lost := Wallet.coins()
	if lost > 0:
		Progress.set_value("w_coins", 0)
	var black := ColorRect.new()
	black.color = Color(0, 0, 0, 0)
	black.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.add_child(black)
	var tw := create_tween()
	tw.tween_property(black, "color:a", 1.0, 0.6)
	tw.tween_callback(func():
		world.wake_at_door()
		hp = MAX
		breath = BREATH
		dead = false
		_draw())
	tw.tween_property(black, "color:a", 0.0, 0.6)
	tw.tween_callback(black.queue_free)
	var msg := ("%s · " % why if why != "" else "") + ("You lost all %d coins." % lost if lost > 0 else "You woke up at Mission Control.")
	if world.hud:
		world.hud.say(msg, 4.0)

# ------------------------------------------------------------------ the orbs
func _orbs() -> void:
	var core := StandardMaterial3D.new()
	core.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	core.albedo_color = Color("7dffb0")
	var halo := StandardMaterial3D.new()
	halo.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	halo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	halo.albedo_color = Color(0.24, 1.0, 0.54, 0.28)
	var spots: Array = []
	for s in ORB_SPOTS:
		var d := Planet.dir_of(s[0], s[1])
		spots.append({"dir": d, "alt": Planet.height(d) + 1.3})
	if Ocean.on:
		for s in [[0.56, 0.1], [0.45, -0.2]]:
			var tn := Ocean.town
			var x: float = tn.x * Ocean.R * s[0] - tn.y * Ocean.R * s[1]
			var z: float = tn.y * Ocean.R * s[0] + tn.x * Ocean.R * s[1]
			spots.append({"dir": Ocean.to_dir(x, z), "alt": Ocean.bed(x, z) + 1.6})
	for sp in spots:
		var n := Node3D.new()
		var c := MeshInstance3D.new()
		var m := SphereMesh.new()
		m.radius = 0.45
		m.height = 0.9
		c.mesh = m
		c.material_override = core
		n.add_child(c)
		var h := MeshInstance3D.new()
		h.mesh = m
		h.material_override = halo
		h.scale = Vector3.ONE * 1.9
		n.add_child(h)
		var light := OmniLight3D.new()
		light.light_color = Color("7dffb0")
		light.light_energy = 0.8
		light.omni_range = 4.0
		n.add_child(light)
		add_child(n)
		var up: Vector3 = sp.dir.normalized()
		n.global_transform = Transform3D(Planet.frame_at(up), up * (Planet.R + sp.alt))
		orbs.append({"node": n, "up": up, "base": sp.alt, "back": 0.0})

# ------------------------------------------------------------------ the frame
func _process(dt: float) -> void:
	t += dt
	flash.color.a = maxf(0.0, flash.color.a - dt * 1.6)
	var p: Walker = world.player
	if p == null:
		return
	var pos: Vector3 = p.dir * (Planet.R + p.alt + 0.9)
	var surf := Ocean.water_at(p.dir)
	var in_sea := not is_nan(surf) and p.swimming
	var under := in_sea and p.diving and p.alt < surf - 1.0
	if under:
		breath = maxf(0.0, breath - dt)
		if breath <= 0.0:
			drown_t += dt
			if drown_t >= 1.0:
				drown_t = 0.0
				hurt(8, "You ran out of air")
	else:
		breath = minf(BREATH, breath + dt * 6.0)
		drown_t = 0.0
	bite_cool = maxf(0.0, bite_cool - dt)
	if in_sea and bite_cool <= 0.0:
		for mmi in world.find_children("reefshark", "MultiMeshInstance3D", true, false):
			var mm: MultiMesh = (mmi as MultiMeshInstance3D).multimesh
			for i in mm.instance_count:
				if mm.get_instance_transform(i).origin.distance_to(pos) < 2.4:
					hurt(15, "A reef shark bit you")
					bite_cool = 1.6
					break
	for o in orbs:
		var n: Node3D = o.node
		if o.back > 0.0:
			o.back -= dt
			n.visible = o.back <= 0.0
			continue
		n.global_position = o.up * (Planet.R + o.base + sin(t * 2.0 + o.base) * 0.15)
		n.rotate(o.up, dt * 1.2)
		if hp < MAX and n.global_position.distance_to(pos) < 2.1:
			heal(ORB_HEAL)
			o.back = ORB_BACK
			n.visible = false
	if int(t * 4.0) != int((t - dt) * 4.0):
		_draw()
