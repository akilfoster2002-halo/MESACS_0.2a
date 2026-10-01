## THE LIFE IN WANO'S OCEAN — the browser's showpieces (public/sealife.js
## and the Higgsfield models in public/sea/), brought to Godot.
##
## ONE DRAW CALL PER SPECIES: a species is one MultiMesh, however many of it
## there are, and the swimming is done on the graphics card. The shader bends
## each body side to side (or a whale's and a dolphin's up and down, a manta's
## wings) by how far along it a vertex is, nothing at the nose and all of it
## at the tail, with every animal on its own phase. The CPU only moves each
## one round its loop.
##
## WHERE THINGS LIVE follows the browser's sea: the whale shark and the
## humpbacks over the deep, orcas and dolphins nearer the surface, sharks
## round the wall, turtles and the manta over the sand, clownfish on the reef,
## the octopus on the bottom.
class_name SeaLife
extends Node3D

## id, model, length in metres, how many, how it moves, where, how deep
## under the surface (a share of the depth there), speed in m/s, loop radius
## as a share of the zone
const KINDS := [
	{"id": "whaleshark", "len": 10.0, "n": 1, "mode": "swim", "zone": "deep", "y": 0.35, "spd": 1.4, "loop": [0.3, 0.6]},
	{"id": "humpback", "len": 14.0, "n": 2, "mode": "swimV", "zone": "deep", "y": 0.25, "spd": 1.8, "loop": [0.5, 0.8]},
	{"id": "orca", "len": 7.0, "n": 2, "mode": "swimV", "zone": "deep", "y": 0.12, "spd": 3.2, "loop": [0.7, 1.1]},
	{"id": "dolphin", "len": 2.5, "n": 7, "mode": "swimV", "zone": "shelf", "y": 0.2, "spd": 6.0, "loop": [0.5, 0.7]},
	{"id": "reefshark", "len": 2.2, "n": 6, "mode": "swim", "zone": "shelf", "y": 0.55, "spd": 2.6, "loop": [0.35, 0.55]},
	{"id": "manta", "len": 4.0, "n": 3, "mode": "flap", "zone": "shelf", "y": 0.5, "spd": 2.2, "loop": [0.5, 0.65]},
	{"id": "turtle", "len": 1.3, "n": 6, "mode": "flap", "zone": "reef", "y": 0.5, "spd": 0.9, "loop": [0.3, 0.9]},
	{"id": "clownfish", "len": 0.14, "n": 40, "mode": "swim", "zone": "reef", "y": 0.8, "spd": 0.4, "loop": [0.05, 0.6]},
	{"id": "octopus", "len": 1.1, "n": 3, "mode": "still", "zone": "reef", "y": 0.98, "spd": 0.12, "loop": [0.2, 0.7]},
]

const SHADER := """
shader_type spatial;
uniform sampler2D tex : source_color, filter_linear_mipmap;
uniform float amp = 0.1;
uniform float freq = 4.0;
uniform float k = 2.0;
uniform int mode = 0;          // 0 swim (side to side), 1 swimV (up and down), 2 flap (wing tips), 3 still
uniform bool wing_z = false;   // a manta's wings run along its model's z
varying float bend;
void vertex() {
	// Tripo's models lie along z with the nose at -0.5 and the tail at +0.5
	float along = clamp(0.5 + VERTEX.z, 0.0, 1.0);
	float ph = TIME * freq + INSTANCE_CUSTOM.x * 50.0;
	if (mode == 0) { bend = pow(along, 1.6); VERTEX.x += sin(ph - VERTEX.z * k) * amp * bend; }
	else if (mode == 1) { bend = pow(along, 1.6); VERTEX.y += sin(ph - VERTEX.z * k) * amp * bend; }
	else if (mode == 2) { bend = pow(clamp(abs(wing_z ? VERTEX.z : VERTEX.x) * 2.0, 0.0, 1.0), 1.5); VERTEX.y += sin(ph) * amp * bend; }
	else { bend = 0.0; VERTEX.xz *= 1.0 + 0.04 * sin(ph); }
}
void fragment() {
	ALBEDO = texture(tex, UV).rgb;
	ROUGHNESS = 0.6;
}
"""
const MODES := {"swim": [0, 0.10, 6.0, 4.0], "swimV": [1, 0.07, 2.0, 2.5], "flap": [2, 0.25, 2.0, 1.0], "still": [3, 0.0, 1.0, 1.0]}

var herds: Array = []          # {k, mm, items: [{c, r, a, w, y, ph}]}
var t := 0.0

func _ready() -> void:
	if not Ocean.on:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261001
	for k in KINDS:
		var src := _model(k.id)
		if src.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.mesh = src.mesh
		mm.instance_count = k.n
		var sh := Shader.new()
		sh.code = SHADER
		var mat := ShaderMaterial.new()
		mat.shader = sh
		if src.tex:
			mat.set_shader_parameter("tex", src.tex)
		var md: Array = MODES[k.mode]
		mat.set_shader_parameter("mode", md[0])
		mat.set_shader_parameter("wing_z", k.id == "manta")
		mat.set_shader_parameter("amp", md[1])
		mat.set_shader_parameter("k", md[2])
		mat.set_shader_parameter("freq", md[3] * (1.6 if k.len < 1.0 else 1.0))
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.material_override = mat
		mi.name = k.id
		add_child(mi)
		var zc := _zone(k.zone)
		var items: Array = []
		for i in k.n:
			var c: Vector2 = zc.c + Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * zc.r * 0.25
			items.append({"c": c, "r": zc.r * rng.randf_range(k.loop[0], k.loop[1]), "a": rng.randf() * TAU,
				"dirn": 1.0 if rng.randf() < 0.5 else -1.0, "y": k.y * rng.randf_range(0.8, 1.2), "ph": rng.randf()})
			mm.set_instance_custom_data(i, Color(rng.randf(), 0, 0, 0))
		herds.append({"k": k, "mm": mm, "items": items, "scale": src.scale})
	_move(0.0)

func _zone(name: String) -> Dictionary:
	if name == "shelf":
		return {"c": Ocean.town * Ocean.R * 0.35, "r": Ocean.R * 0.45}
	var z: Dictionary = Ocean.zones.get(name, Ocean.zones.deep)
	return {"c": Vector2(z.x, z.z), "r": z.r}

## The Higgsfield model: its mesh, its texture, and the scale that makes it
## one unit long along z with the nose at +z (Tripo puts heads at -z).
func _model(id: String) -> Dictionary:
	var path := "res://assets/sea/%s.glb" % id
	if not ResourceLoader.exists(path):
		return {}
	var scene: Node = (load(path) as PackedScene).instantiate()
	var mi: MeshInstance3D = scene.find_children("*", "MeshInstance3D", true, false)[0] if scene.find_children("*", "MeshInstance3D", true, false).size() > 0 else null
	if mi == null:
		scene.free()
		return {}
	var mesh: Mesh = mi.mesh
	var tex: Texture2D = null
	var m := mi.get_active_material(0)
	if m is BaseMaterial3D:
		tex = (m as BaseMaterial3D).albedo_texture
	var aabb := mesh.get_aabb()
	scene.free()
	# a manta is longer across than nose to tail: its wingspan is its "length"
	return {"mesh": mesh, "tex": tex, "scale": 1.0 / maxf(aabb.size.z, 1e-4), "wide": aabb.size.x > aabb.size.z}

func _process(dt: float) -> void:
	t += dt
	_move(dt)

func _move(dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	var near := cam != null and cam.global_position.normalized().dot(Ocean.C) > cos(Ocean.R * 1.3 / Planet.R)
	if dt > 0.0 and not near:
		return                      # nobody is looking: the sea keeps still and costs nothing
	for h in herds:
		var k: Dictionary = h.k
		var s: float = k.len * h.scale
		for i in h.items.size():
			var it: Dictionary = h.items[i]
			it.a += it.dirn * k.spd / maxf(it.r, 1.0) * dt
			var x: float = it.c.x + cos(it.a) * it.r
			var z: float = it.c.y + sin(it.a) * it.r
			var D: float = maxf(Ocean.depth(x, z), 0.6)
			var y: float = Ocean.SEA - clampf(D * it.y, 0.3, D - s * 0.3)
			if k.mode == "still":
				y = Ocean.bed(x, z) + s * 0.25
			var p := Ocean.to_world(x, y, z)
			# heading along the loop
			var a2: float = it.a + it.dirn * 0.05
			var q := Ocean.to_world(it.c.x + cos(a2) * it.r, y, it.c.y + sin(a2) * it.r)
			var up := p.normalized()
			var fwd := q - p
			if fwd.length_squared() < 1e-8:
				fwd = Planet.frame_at(up).z
			var b := Planet.stand(up, fwd)
			# turn the model to face along +z, the way it swims: Tripo's noses are at -z;
			# a manta's wingspan is its model's z, so it turns a quarter; an octopus has no front
			var turn: float = PI / 2.0 if k.id == "manta" else (0.0 if k.id == "octopus" else PI)
			b = b * Basis(Vector3.UP, turn) * Basis.from_scale(Vector3.ONE * s)
			h.mm.set_instance_transform(i, Transform3D(b, p))
