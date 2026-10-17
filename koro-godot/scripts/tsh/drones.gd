## WFC DRONES over the Meridian Tower's roof: three of them, hovering and drifting in the rain, each a hard white
## searchlight hunting the two of them down there (shadows thrown long across the wet deck, shafts through the haze),
## their red and blue strobes going; and the gunship's own searchlight from off the edge.
##   Drones.build(g, centre, top)   Drones.tick(g, dt, targets: Array[Vector3])   Drones.clear()
class_name Drones
extends RefCounted

static var list: Array = []          # {node, spot, red, blue, home, phase, aim}
static var gun_spot: SpotLight3D
static var t := 0.0

static func _unshaded(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c; return m

static func build(g, c: Vector2, top: float) -> void:
	clear()
	var body_m := StandardMaterial3D.new(); body_m.albedo_color = Color(0.06, 0.065, 0.075); body_m.metallic = 0.6; body_m.roughness = 0.35
	var homes := [Vector3(c.x - 14, top + 15, c.y + 10), Vector3(c.x + 13, top + 18, c.y + 12), Vector3(c.x + 2, top + 21, c.y - 15)]
	for i in homes.size():
		var n := Node3D.new(); g.city.add_child(n); n.position = homes[i]
		var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.9, 0.25, 0.9); b.mesh = bm; b.material_override = body_m; n.add_child(b)
		for q in [Vector2(-0.7, -0.7), Vector2(0.7, -0.7), Vector2(-0.7, 0.7), Vector2(0.7, 0.7)]:
			var arm := MeshInstance3D.new(); var am := BoxMesh.new(); am.size = Vector3(0.08, 0.06, 0.08); arm.mesh = am; arm.material_override = body_m
			arm.position = Vector3(q.x*0.5, 0, q.y*0.5); n.add_child(arm)
			var rot := MeshInstance3D.new(); var rc := CylinderMesh.new(); rc.top_radius = 0.38; rc.bottom_radius = 0.38; rc.height = 0.01; rot.mesh = rc
			var rm := StandardMaterial3D.new(); rm.albedo_color = Color(0.2, 0.2, 0.22, 0.35); rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; rot.material_override = rm
			rot.position = Vector3(q.x, 0.12, q.y); n.add_child(rot)
		var lamp := MeshInstance3D.new(); var lm := SphereMesh.new(); lm.radius = 0.12; lm.height = 0.24; lamp.mesh = lm; lamp.material_override = _unshaded(Color(4, 4, 3.6)); lamp.position = Vector3(0, -0.18, 0); n.add_child(lamp)
		var red := OmniLight3D.new(); red.light_color = Color(1, 0.05, 0.05); red.omni_range = 9; red.light_energy = 0.0; red.position = Vector3(-0.5, 0, 0); red.light_volumetric_fog_energy = 0.6; n.add_child(red)
		var blue := OmniLight3D.new(); blue.light_color = Color(0.1, 0.25, 1); blue.omni_range = 9; blue.light_energy = 0.0; blue.position = Vector3(0.5, 0, 0); blue.light_volumetric_fog_energy = 0.6; n.add_child(blue)
		var sp := SpotLight3D.new(); sp.light_color = Color(0.92, 0.96, 1.0); sp.light_energy = 7.0; sp.spot_range = 70; sp.spot_angle = 11.0; sp.spot_attenuation = 0.6
		sp.shadow_enabled = true; sp.shadow_blur = 0.4; sp.shadow_bias = 0.12; sp.shadow_normal_bias = 2.5; sp.light_volumetric_fog_energy = 0.45
		g.city.add_child(sp)
		list.append({"node": n, "spot": sp, "red": red, "blue": blue, "home": homes[i], "phase": i*2.1, "aim": Vector3(c.x, top, c.y)})
	gun_spot = SpotLight3D.new(); gun_spot.light_color = Color(1.0, 0.97, 0.9); gun_spot.light_energy = 10.0; gun_spot.spot_range = 90; gun_spot.spot_angle = 16.0
	gun_spot.shadow_enabled = true; gun_spot.shadow_blur = 0.3; gun_spot.shadow_bias = 0.12; gun_spot.shadow_normal_bias = 2.5; gun_spot.light_volumetric_fog_energy = 0.4; g.city.add_child(gun_spot)
	t = 0.0

## each drone drifts round its spot and keeps its light on one of the targets (taking turns), lagging a little, wobbling
static func tick(g, dt: float, targets: Array, gun_at = null) -> void:
	if list.is_empty(): return
	t += dt
	for i in list.size():
		var d: Dictionary = list[i]
		var ph: float = d.phase + t
		d.node.position = d.home + Vector3(sin(ph*0.37)*3.0, sin(ph*0.9)*0.5, cos(ph*0.29)*3.0)
		d.node.rotation.y = ph*0.2
		var want: Vector3 = targets[(i + int(t/5.0)) % targets.size()] if targets.size() else d.aim
		want += Vector3(sin(ph*1.7)*0.6, 0, cos(ph*1.3)*0.6)
		d.aim = d.aim.lerp(want, minf(1, dt*1.6))
		var from: Vector3 = d.node.position + Vector3(0, -0.2, 0)
		if from.distance_to(d.aim) > 0.5: d.spot.look_at_from_position(from, d.aim)
		var s := fmod(t*2.2 + i*0.35, 1.0)
		d.red.light_energy = 3.0 if s < 0.12 else 0.0
		d.blue.light_energy = 3.0 if s > 0.5 and s < 0.62 else 0.0
	if gun_spot and gun_at != null and targets.size():
		var tgt: Vector3 = targets[0]
		if (gun_at as Vector3).distance_to(tgt) > 0.5: gun_spot.look_at_from_position(gun_at, tgt.lerp(targets[targets.size() - 1], 0.5))

static func clear() -> void:
	for d in list:
		if is_instance_valid(d.node): d.node.queue_free()
		if is_instance_valid(d.spot): d.spot.queue_free()
	list.clear()
	if gun_spot and is_instance_valid(gun_spot): gun_spot.queue_free()
	gun_spot = null
