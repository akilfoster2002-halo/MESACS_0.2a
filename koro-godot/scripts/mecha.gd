## THE GIANT — twenty metres of mecha.
##
## Two kinds, bought at the Mechanic (Wallet.MECHS). The ones parked outside
## are statues; the one you own exists only while you are it — X turns you
## into it anywhere outdoors (world.gd) and X or R turns you back. W/S walk it (heavy: it leans into a start
## and takes a moment to stop), A/D turn, SHIFT dashes across the island,
## SPACE is a mega jump and, held in the air, the thrusters. Q slams it down
## — or stomps on the ground — and a ring runs out across the grass that
## sends every panda near it running. V is the cockpit. R climbs out.
class_name Mecha
extends Node3D

const H := 20.0
const WALK := 9.0
const DASH := 34.0
const JUMP := 30.0
const GRAV := 24.0
const THRUST := 34.0
const FUEL := 3.2

var world: Node3D
var dir := Vector3(0, 0, 1)
var fwd := Vector3(0, 1, 0)
var alt := 0.0
var vy := 0.0
var on_ground := true
var spd := 0.0
var fuel := FUEL
var slamming := false
var cool := 0.0
var shake := 0.0
var stride := 0.0
var jump_ready := true
var piloting := false
var first_person := false
var hover := false
var dashing := false
var pilot: Walker = null
var pitch := -0.1

var model: Node3D
var ap: AnimationPlayer
var s := 1.0
var model_path := "res://assets/mecha.glb"
var mech_id := "vanguard"
var statue := false              # parked outside the Mechanic: to look at, not to drive
var air_t := 0.0
var jets: Array[Node3D] = []     # two on the back, one under each foot
var jet_light: OmniLight3D
var burn := 0.0                  # how hard the jets are firing, eased
var rings: Array = []

const PLUME := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, fog_disabled, shadows_disabled;
uniform vec3 hot : source_color = vec3(1.0, 0.96, 0.86);
uniform vec3 cool : source_color = vec3(0.30, 0.78, 1.0);
uniform float power = 1.0;
uniform float seed = 0.0;
uniform float len = 1.0;
varying float t;
// measured down the tube from the nozzle (0) to the tip (1), from the
// vertex itself: a CylinderMesh's UVs are packed round its caps
void vertex(){ t = clamp(0.5 - VERTEX.y / len, 0.0, 1.0); }
void fragment(){
	// the rim of the tube fades, so it reads as a column of light, not a cone
	float face = pow(abs(dot(normalize(NORMAL), normalize(VIEW))), 1.4);
	float flick = 0.8 + 0.2 * sin(TIME * 53.0 + seed * 7.0 + t * 18.0) * sin(TIME * 31.0 + seed);
	float fade = pow(1.0 - t, 1.8);
	ALBEDO = mix(hot, cool, smoothstep(0.0, 0.25, t)) * 1.7;
	ALPHA = clamp(face * fade * flick * power, 0.0, 1.0);
}
"""

func _ready() -> void:
	model = Models.spawn(model_path)
	add_child(model)
	s = Models.fit_height(model, H * 0.94)
	ap = Models.anim_player(model)
	# a jump plays ONCE: looped, it kicks off again and again for as long
	# as the mecha is in the air
	Models.loop_clips(ap, ["jump"])
	if ap:
		ap.play("idle")
	if statue:
		return
	var sh := Shader.new()
	sh.code = PLUME
	# the back pair lean out behind; the feet point straight down
	for spec in [[Vector3(-H * 0.10, H * 0.62, -H * 0.17), 0.85, 1.0], [Vector3(H * 0.10, H * 0.62, -H * 0.17), 0.85, 1.0],
			[Vector3(-H * 0.07, H * 0.03, 0.0), 0.0, 0.6], [Vector3(H * 0.07, H * 0.03, 0.0), 0.0, 0.6]]:
		var jet := Node3D.new()
		jet.position = spec[0]
		jet.rotation.x = spec[1]
		var k: float = spec[2]
		for layer in [[0.6 * k, 0.08 * k, 9.0 * k, Color(0.18, 0.55, 1.0), 0.75], [0.26 * k, 0.03 * k, 4.2 * k, Color(0.55, 0.9, 1.0), 1.0]]:
			var tube := CylinderMesh.new()
			tube.top_radius = layer[0]
			tube.bottom_radius = layer[1]
			tube.height = layer[2]
			tube.cap_top = false
			tube.cap_bottom = false
			tube.radial_segments = 20
			var m := ShaderMaterial.new()
			m.shader = sh
			m.set_shader_parameter("cool", layer[3])
			m.set_shader_parameter("seed", randf() * 10.0)
			m.set_shader_parameter("power", layer[4])
			m.set_shader_parameter("len", layer[2])
			var mi := MeshInstance3D.new()
			mi.mesh = tube
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.position = Vector3(0, -float(layer[2]) / 2.0, 0)
			jet.add_child(mi)
		# the nozzle itself, a disc of light that faces you: from behind a
		# plume is end-on, and this is what says the engines are lit
		var glow := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(3.2, 3.2) * k
		glow.mesh = q
		var gm := ShaderMaterial.new()
		gm.shader = Shader.new()
		gm.shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, fog_disabled, shadows_disabled;
void vertex(){ MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]); }
void fragment(){
	float r = length(UV - 0.5) * 2.0;
	float a = pow(max(0.0, 1.0 - r), 2.2);
	ALBEDO = mix(vec3(0.3, 0.75, 1.0), vec3(1.0, 0.97, 0.9), a * a) * 2.0;
	ALPHA = a;
}
"""
		glow.material_override = gm
		glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		jet.add_child(glow)
		jet.visible = false
		add_child(jet)
		jets.append(jet)
	jet_light = OmniLight3D.new()
	jet_light.light_color = Color(0.45, 0.85, 1.0)
	jet_light.omni_range = H * 0.9
	jet_light.light_energy = 0.0
	# behind and low: it lights the ground under the jets, not the armour
	jet_light.position = Vector3(0, H * 0.25, -H * 0.45)
	add_child(jet_light)

func park(at: Vector3, facing: Vector3) -> void:
	dir = at.normalized()
	fwd = (facing - dir * facing.dot(dir)).normalized()
	alt = world.floor_at(dir, Planet.height(dir) + 3.0, 2.5)

func _unhandled_input(ev: InputEvent) -> void:
	if piloting and ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		fwd = fwd.rotated(dir, -ev.relative.x * 0.002).normalized()
		pitch = clampf(pitch - ev.relative.y * 0.002, -0.9, 0.5)

func enter(w: Walker) -> void:
	piloting = true
	pilot = w
	w.hidden_in_mecha = true
	first_person = false

func leave() -> bool:
	if not on_ground:
		return false
	piloting = false
	var up := dir
	var right := fwd.cross(up).normalized()
	pilot.dir = Planet.walk(dir, right, 7.0)
	pilot.fwd = (fwd - pilot.dir * fwd.dot(pilot.dir)).normalized()
	pilot.alt = world.floor_at(pilot.dir, alt + 2.0)
	pilot.hidden_in_mecha = false
	pilot = null
	spd = 0.0
	visible = true
	model.visible = true
	_flames(false)
	if ap:
		ap.play("idle", 0.3)
	return true

func _process(delta: float) -> void:
	if piloting:
		_drive(delta)
	_rings(delta)
	shake = maxf(0.0, shake - delta * 2.2)
	global_transform = Transform3D(Planet.stand(dir, fwd), dir * (Planet.R + alt))
	if piloting:
		_camera()

func _drive(delta: float) -> void:
	var up := dir
	var turn := Ctl.axis("right", "left")
	if turn != 0.0:
		fwd = fwd.rotated(up, turn * 1.4 * delta).normalized()
	var f := Ctl.axis("back", "forward")
	dashing = Ctl.held("run") and f > 0.0
	var want := f * (DASH if dashing else WALK)
	var acc := 26.0 if dashing else 18.0
	spd += clampf(want - spd, -acc * delta, acc * delta)
	if absf(spd) < 0.05 and f == 0.0:
		spd = 0.0
	var moved := false
	if spd != 0.0:
		var to := Planet.walk(dir, fwd * signf(spd), absf(spd) * delta, Planet.R + alt)
		if world.blocked(to, alt, 2.6, H, 2.5):
			spd = 0.0
		else:
			dir = to
			fwd = (fwd - dir * fwd.dot(dir)).normalized()
			moved = true

	var space := Ctl.held("jump")
	var q := Ctl.just("slam")
	hover = false
	if on_ground:
		if space and jump_ready:
			vy = JUMP
			on_ground = false
			jump_ready = false
		if q and cool <= 0.0:
			shockwave(18.0, 1.2)
			cool = 1.4
	else:
		if space and not jump_ready and fuel > 0.0 and not slamming and vy < 10.0:
			vy += THRUST * delta
			fuel = maxf(0.0, fuel - delta)
			hover = true
		if q and not slamming:
			slamming = true
			vy = -60.0
	if not space:
		jump_ready = true
	cool = maxf(0.0, cool - delta)

	var ground: float = world.floor_at(dir, alt, 2.5)
	if not on_ground:
		vy -= GRAV * delta
		alt += vy * delta
		if alt <= ground:
			var hard := vy
			alt = ground
			vy = 0.0
			on_ground = true
			if slamming:
				shockwave(38.0, 2.4)
			elif hard < -16.0:
				shockwave(16.0, 0.9)
			else:
				shake = maxf(shake, 0.4)
			slamming = false
	else:
		if ground < alt - 1.2:
			on_ground = false
		else:
			alt = ground
	if on_ground:
		fuel = minf(FUEL, fuel + delta * 1.2)
	if on_ground and moved:
		stride += absf(spd) * delta
		var every := 26.0 if dashing else 13.0
		if stride > every:
			stride -= every
			shake = maxf(shake, 0.5 if dashing else 0.35)

	if ap:
		var clip := "idle"
		var sc := 1.0
		air_t = 0.0 if on_ground else air_t + delta
		if not on_ground:
			if hover or slamming:
				clip = "fly"
				sc = 0.8
			else:
				# up with the jump, then HOLD its airborne pose until the
				# ground comes back — not the take-off over and over
				clip = "jump"
				var a := ap.get_animation("jump")
				var hold := a.length * 0.42 if a else 0.0
				sc = 0.0 if ap.current_animation == "jump" and ap.current_animation_position >= hold else 0.8
		elif absf(spd) > 0.6:
			clip = "sprint" if dashing else "walk"
			sc = absf(spd) / ((5.2 if dashing else 1.45) * s * 1.0)
			sc = clampf(sc, 0.3, 2.5)
		if ap.current_animation != clip:
			ap.play(clip, 0.3)
		ap.speed_scale = sc
	_flames(dashing or hover or slamming)
	pilot.dir = dir
	pilot.alt = alt

## The jets ease up and down rather than blinking, and breathe while lit.
func _flames(on: bool) -> void:
	if jets.is_empty():
		return
	var want := 0.0
	if on:
		want = 1.25 if slamming else (1.0 if hover else 0.7)
	burn = move_toward(burn, want, get_process_delta_time() * 4.0)
	for i in jets.size():
		var jet: Node3D = jets[i]
		# the feet only fire to hold it up
		var k := burn if i < 2 else (burn if hover else 0.0)
		jet.visible = k > 0.02
		if jet.visible:
			var breathe := randf_range(0.92, 1.08)
			jet.scale = Vector3(0.6 + 0.4 * k, (0.5 + 0.6 * k) * breathe, 0.6 + 0.4 * k)
	jet_light.light_energy = burn * 1.1

func _camera() -> void:
	var cam := pilot.cam
	var up := dir
	var right := fwd.cross(up).normalized()
	var jig := func() -> float: return randf_range(-0.5, 0.5) * shake
	if first_person:
		model.visible = false
		var eye := global_position + up * H * 0.8 + fwd * H * 0.08
		eye += up * jig.call() * 0.6 + right * jig.call() * 0.6
		cam.global_position = eye
		cam.look_at(eye + fwd.rotated(right, pitch - 0.22) * 40.0, up)
	else:
		model.visible = true
		var head := global_position + up * H * 0.62
		var off := (-fwd * H * 1.7 + up * H * 0.55).rotated(right, pitch * 0.6)
		cam.global_position = head + off + up * jig.call() * 2.0 + right * jig.call() * 2.0
		cam.look_at(head + fwd * H * 0.4, up)

## The ring of light across the ground, and every panda near it bolts.
func shockwave(r: float, jolt: float) -> void:
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.9
	tm.outer_radius = 1.0
	tm.rings = 64
	ring.mesh = tm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.75, 0.96, 1.0, 0.9)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	ring.material_override = m
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(ring)
	ring.global_transform = Transform3D(Planet.frame_at(dir), dir * (Planet.R + Planet.height(dir) + 0.4))
	rings.append({"n": ring, "t": 0.0, "r": r, "m": m})
	shake = maxf(shake, jolt)
	for p in world.pandas:
		var pd: Panda = p
		if pd.rider:
			continue
		if pd.dir.angle_to(dir) * Planet.R < r * 1.3:
			var away := (pd.dir - dir)
			away = (away - pd.dir * away.dot(pd.dir)).normalized()
			if away.length_squared() > 0.5:
				pd.fwd = away
			pd.flee = randf_range(2.5, 4.5)
			pd.turn = 0.0

func _rings(delta: float) -> void:
	var keep := []
	for o in rings:
		o.t += delta
		var k: float = o.t / 0.9
		var n: MeshInstance3D = o.n
		var sc: float = 2.0 + k * o.r
		n.scale = Vector3(sc, 0.3, sc)
		(o.m as StandardMaterial3D).albedo_color.a = 0.9 * (1.0 - k) * (1.0 - k)
		if k >= 1.0:
			n.queue_free()
		else:
			keep.append(o)
	rings = keep
