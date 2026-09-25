## KIT — the Mechanic, at work in her own garage.
##
## She walks a round of jobs — the cars on their bays, the mechas on their
## plinths, the bench, the tool chests — and at each one stops, faces it and
## works, with sparks off her hand where there is metal to weld. Come close
## and she looks up at you; E opens a real conversation (server/npc.js) and
## she stays turned towards you until you walk away.
class_name Kit
extends Node3D

const SPEED := 1.25
const NEAR := 3.2

var bld: Building               # the garage; every position here is its local space
var talk_spot: Dictionary       # the building's usable for her, moved as she moves
var model: Node3D
var ap: AnimationPlayer
var skel: Skeleton3D
var hand := -1
var sparks: GPUParticles3D
var jobs: Array = []            # [position, facing, welds]
var job := 0
var work_t := 0.0
var heading := 0.0

func setup(b: Building, round: Array) -> Kit:
	bld = b
	jobs = round
	return self

func _ready() -> void:
	model = Models.spawn("res://assets/characters/character-kit.glb")
	add_child(model)
	Models.fit_height(model, 1.68)
	ap = Models.anim_player(model)
	Models.loop_clips(ap, ["jump", "flip"])
	var sk := model.find_children("*", "Skeleton3D", true, false)
	if sk.size() > 0:
		skel = sk[0]
		hand = skel.find_bone("mixamorig:RightHand")
	sparks = _sparks()
	add_child(sparks)
	position = jobs[0][0]
	heading = jobs[0][1]
	work_t = randf_range(3.0, 6.0)
	talk_spot = {"at": position, "r": 2.6, "label": "talk to Kit", "act": func(w):
		w.hud.talk_open("mechanic", "Kit", "Mind the oil. Cars down the bays, mechas at the back, the ship's in the hangar. What do you need?")}
	bld.usables.append(talk_spot)

func _process(delta: float) -> void:
	var w: Node3D = bld.world
	var me: Vector3 = bld.to_local(w.player.global_position)
	var to_me := me - position
	to_me.y = 0.0
	var talking: bool = w.hud.talk.visible and w.hud.talk.who == "mechanic"
	var clip := "idle"
	var welding := false
	if talking or (to_me.length() < NEAR and not w.player.hidden):
		# somebody is here: stop, turn to them
		heading = lerp_angle(heading, atan2(to_me.x, to_me.z), minf(1.0, delta * 5.0))
		clip = "talk" if talking else "idle"
	elif work_t > 0.0:
		work_t -= delta
		var j: Array = jobs[job]
		heading = lerp_angle(heading, j[1], minf(1.0, delta * 4.0))
		clip = "talk2"
		welding = j[2]
		if work_t <= 0.0:
			job = (job + 1) % jobs.size()
	else:
		var goal: Vector3 = jobs[job][0]
		var d := goal - position
		d.y = 0.0
		if d.length() < 0.15:
			var j: Array = jobs[job]
			if j.size() > 3 and not j[3]:
				job = (job + 1) % jobs.size()    # only on the way somewhere
			else:
				work_t = randf_range(7.0, 12.0)
		else:
			heading = lerp_angle(heading, atan2(d.x, d.z), minf(1.0, delta * 6.0))
			position += d.normalized() * minf(d.length(), SPEED * delta)
			clip = "walk"
	rotation.y = heading
	talk_spot.at = position
	if ap and ap.has_animation(clip) and ap.current_animation != clip:
		ap.play(clip, 0.3)
	# the sparks leave from her hand, in bursts, while she welds
	sparks.emitting = welding and fmod(Time.get_ticks_msec() / 1000.0, 1.6) < 0.9
	if skel and hand >= 0:
		sparks.global_position = skel.global_transform * skel.get_bone_global_pose(hand).origin

func _sparks() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 60
	p.lifetime = 0.55
	p.explosiveness = 0.0
	p.emitting = false
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 70.0
	pm.initial_velocity_min = 1.5
	pm.initial_velocity_max = 4.0
	pm.gravity = Vector3(0, -9.8, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.035, 0.035)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.albedo_color = Color(2.4, 1.6, 0.6)
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	q.material = m
	p.draw_pass_1 = q
	p.local_coords = false
	return p
