## HER CAT: black, asleep, curled nose to tail (tools/bedroom_props.py cat_body + cat_head). It breathes; an ear
## flicks; it can lift its head and look at something with its eyes open (gold, slit), and settle again; and in the
## dark its eyes shine.
class_name BedroomCat
extends Node3D

var head: Node3D; var eyes: Array = []; var ears: Array = []
var body: Node3D
var spots := {}                                    # name → [position, heading]
var awake := 0.0; var _awake_to := 0.0             # 0 asleep … 1 head up, eyes open
var look_at_p = null                               # what it looks at when awake (world), or null: ahead
var shine := 0.0                                   # its eyes in the dark: 0 … 1
var _t := 0.0; var _flick := -1.0; var _next_flick := 3.0
const NECK := Vector3(0.105, 0.115, -0.065)
const HEAD_DOWN := Vector3(0.05, -0.25, 0.0)       # chin on its paws, a little turned in

func _ready() -> void:
	var fur := StandardMaterial3D.new(); fur.vertex_color_use_as_albedo = true; fur.roughness = 0.8
	fur.normal_enabled = true; fur.normal_texture = _fur_tex(); fur.normal_scale = 0.5; fur.uv1_triplanar = true; fur.uv1_scale = Vector3.ONE*40
	fur.rim_enabled = true; fur.rim = 0.12; fur.rim_tint = 0.5; fur.metallic_specular = 0.08
	fur.specular_mode = BaseMaterial3D.SPECULAR_SCHLICK_GGX
	body = (load(Bedroom.PROPS + "cat_body.glb") as PackedScene).instantiate(); add_child(body)
	head = Node3D.new(); add_child(head); head.position = NECK; head.rotation = HEAD_DOWN
	var hm: Node3D = (load(Bedroom.PROPS + "cat_head.glb") as PackedScene).instantiate(); head.add_child(hm)
	for n in [body, hm]:
		for c in n.find_children("*", "MeshInstance3D", true, false): (c as MeshInstance3D).material_override = fur
	# its eyes: gold almonds with a black slit, hidden while they are shut
	for s in [-1, 1]:
		var e := Node3D.new(); head.add_child(e); e.position = Vector3(s*0.023, 0.012, -0.079); e.rotation = Vector3(0.15, s*0.42, s*-0.25)
		var ball := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.0105; sm.height = 0.021; ball.mesh = sm; ball.scale = Vector3(1.25, 0.8, 0.45)
		var em := StandardMaterial3D.new(); em.albedo_color = Color("#d9b23a"); em.roughness = 0.1; em.emission_enabled = true; em.emission = Color("#e8c040"); em.emission_energy_multiplier = 0.4
		ball.material_override = em; e.add_child(ball)
		var slit := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.0028, 0.016, 0.004); slit.mesh = bm; slit.position = Vector3(0, 0, -0.003)
		slit.material_override = StandardMaterial3D.new(); (slit.material_override as StandardMaterial3D).albedo_color = Color(0.01, 0.01, 0.01); e.add_child(slit)
		e.scale = Vector3(1, 0.05, 1); e.visible = false
		eyes.append([e, em, slit])

static var _ft: Texture2D
static func _fur_tex() -> Texture2D:
	if _ft: return _ft
	var n := FastNoiseLite.new(); n.frequency = 0.25; n.fractal_octaves = 2
	var t := NoiseTexture2D.new(); t.width = 256; t.height = 256; t.seamless = true; t.as_normal_map = true; t.bump_strength = 10.0; t.noise = n
	_ft = t; return t

func place(spot: String) -> void:
	var s: Array = spots[spot]; position = s[0]; rotation.y = s[1]; awake = 0.0; _awake_to = 0.0; look_at_p = null

## lift its head and open its eyes (on what, if given); `to` 0 settles it back to sleep. `half`: one eye, barely
var one_eye := false
func wake(to := 1.0, at = null, half := false) -> void:
	_awake_to = to; look_at_p = at; one_eye = half
func flick() -> void: _flick = 0.0

func _process(dt: float) -> void:
	_t += dt
	awake = move_toward(awake, _awake_to, dt*(2.4 if _awake_to > awake else 0.9))
	# breathing: slow, the back rising
	var br := sin(_t*TAU/2.8)
	body.scale = Vector3(1.0 + 0.012*br, 1.0 + 0.03*br, 1.0 + 0.012*br)
	# the head: down on its paws, or up and turned to what it looks at
	var up := Vector3(-0.35, 0.0, 0.0)
	if look_at_p != null:
		var l: Vector3 = to_local(look_at_p) - NECK
		up.y = clampf(atan2(-l.x, -l.z), -1.1, 1.1); up.x = clampf(-atan2(l.y, Vector2(l.x, l.z).length()), -0.6, 0.2) - 0.1
	var e := awake*awake*(3.0 - 2.0*awake)
	head.rotation = HEAD_DOWN.lerp(up, e)
	head.position = NECK + Vector3(0, 0.035*e, -0.012*e) + Vector3(0, 0.002*br, 0)
	# its eyes: open with it, blinking now and then; half for a sleepy look
	var open := clampf((awake - 0.35)/0.5, 0.0, 1.0)*(0.35 if one_eye else 1.0)
	if fmod(_t, 4.3) < 0.12 and awake > 0.5: open = 0.08
	open = maxf(open, shine)
	for i in eyes.size():
		var ey: Node3D = eyes[i][0]; var o := open if not (one_eye and i == 0) else 0.0
		ey.visible = o > 0.04; ey.scale = Vector3(1, maxf(o, 0.05), 1)
		(eyes[i][1] as StandardMaterial3D).emission_energy_multiplier = 0.4 + shine*6.0
		(eyes[i][2] as MeshInstance3D).scale = Vector3(1.0 + shine*1.8, 1, 1)                # its pupils wide in the dark
	# an ear flick now and then (the whole head, a twitch), more when asked
	_next_flick -= dt
	if _next_flick <= 0.0: _flick = 0.0; _next_flick = randf_range(3.5, 8.0)
	if _flick >= 0.0:
		_flick += dt
		head.rotation.z += sin(_flick*40.0)*0.05*maxf(0, 1.0 - _flick*4.0)
		if _flick > 0.3: _flick = -1.0
