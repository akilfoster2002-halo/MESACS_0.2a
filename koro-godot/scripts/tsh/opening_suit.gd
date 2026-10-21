## SEQUENCE 3: BECOMING THE OTHER ROBIN (docs/script/the_other_robin_cold_open_1.1.md, shots 22–31). The jacket off
## the form, waking from her wrists to her shoulders; the gloves; the shoes; the bangle and the pack, the ring box in it;
## dinner under its cover and Mom's note; the door; the sunglasses at night; the ledge; five storeys above Kiln Street;
## and the jump — the shoes catching her — into the game, with her momentum: no prompt, no card, no voice.
class_name OpeningSuit
extends Node

var g
var made: Array = []
func _init(game) -> void: g = game
func _keep(n: Node) -> Node: made.append(n); return n
func _light(c: Color, at: Vector3, e: float, r: float) -> OmniLight3D:
	var l := OmniLight3D.new(); l.light_color = c; l.light_energy = e; l.omni_range = r; l.position = at; g.add_child(l); _keep(l); return l
func _bone(side: String) -> Vector3:
	var sk: Skeleton3D = g._find(g.model, func(x): return x is Skeleton3D)
	var i := sk.find_bone("mixamorig" + side)
	return sk.global_transform*sk.get_bone_global_pose(i).origin if i >= 0 else g.robin.position + Vector3(0, 1, 0)
func clear() -> void:
	for n in made:
		if is_instance_valid(n): n.queue_free()
	made = []

func play(ring_box: Node3D) -> void:
	# SHOTS 22–27 as the browser films them, in her lamp's light (tsh.js opening(): the kit, piece by piece, and the
	# note) — the ring box into the pack as she takes it
	g.lamp.light_energy = 1.6
	g.get_tree().create_timer(0.25).timeout.connect(func(): g.black(false))      # up out of the black the call ended on
	var shots: Array = g.suit_shots(func(): _pocket(ring_box))
	# SHOTS 28–31 as the browser has them: the window, the sill, the look down, the smile, the jump — then the fall,
	# slow, the beat held, until SPACE fires the shoes (game.gd window_shots / fall_start)
	shots.append_array(g.window_shots())
	# THE SCORE (data/tsh_score.json, wake.*): the full beat as she gets ready; down at dinner; almost nothing at the note
	g.music_cue("wake.suit")
	g.play_reel(shots, func(_s): clear(); g.dutch = 0.0; g.fall_start())

func _pocket(rb) -> void:
	if is_instance_valid(rb): rb.visible = false
	g.cue("pick")
func _to_table(k: float, a: Vector2, b: Vector2, face: float) -> void:
	if k < 0.7: g.walk_stage(a, b, k/0.7)
	else: g.stage("idle", b.x, 0, b.y, face)
func _reading(t: float, D: Vector3) -> void:
	g._note_hold()
	if t > 2.6: g.face.target = D + Vector3(0, 1.2, 0)
## her body through the air: from the sill, along the arc (the shoes' redirection starts a new one)
func _fly(j: Dictionary, t: float, clip: String) -> void:
	var t0: float = j.get("t0", 0.0); var dt := t - t0
	var p: Vector3 = j.p0 + (j.v as Vector3)*dt + Vector3(0, -9.8*0.5*dt*dt, 0)
	g.stage(clip, p.x, p.y, p.z, atan2(j.v.x, j.v.z))
func _vel(j: Dictionary, t: float) -> Vector3:
	var dt := t - float(j.get("t0", 0.0))
	return (j.v as Vector3) + Vector3(0, -9.8*dt, 0)
