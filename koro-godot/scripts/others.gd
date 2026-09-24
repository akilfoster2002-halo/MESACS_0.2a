## EVERYBODY ELSE IN THE ROOM — out on Wano with you, whether they are
## playing here or in a browser.
##
## Each one is the character they chose, with their name over their head,
## eased towards where they last said they were (public/planet.js does the
## same: a position twelve times a second, drawn at sixty). Their heading is
## an angle in the frame under THEIR feet, so it is turned back into a
## direction there and the whole basis built round it — rotating the nose
## while keeping the old right-hand vector leans a body over the further
## round the ball it walks.
##
## Which clip they play is read two ways: how fast they cross the ground is
## the honest account of walking, and the clip they send is the only way to
## see a jump, a dance or a flight.
class_name Others
extends Node3D

const GROUND := {"idle": true, "walk": true, "sprint": true}

var world: Node3D
var folk := {}               # id -> {node, model, ap, char, ride, car, dir, tdir, head, thead, up, tup, speed, act}

func show_list(list: Array) -> void:
	var seen := {}
	for p in list:
		if str(p.get("at", "")) != "hub":
			continue                         # somewhere else — a room, a mission
		var id := int(p.id)
		seen[id] = true
		var d := Planet.dir_of(float(p.get("x", 0)), float(p.get("z", 0)))
		var o: Dictionary = folk.get(id, {})
		if o.is_empty():
			var n := Node3D.new()
			add_child(n)
			var tag := Label3D.new()
			tag.text = str(p.get("display", "?")).substr(0, 16)
			tag.font_size = 40
			tag.pixel_size = 0.01
			tag.outline_size = 10
			tag.modulate = Color("a8e6cf")
			tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			tag.no_depth_test = false
			tag.position = Vector3(0, 2.4, 0)
			n.add_child(tag)
			o = {"node": n, "tag": tag, "model": null, "ap": null, "char": "", "ride": "", "car": null,
				"dir": d, "tdir": d, "head": float(p.get("yaw", 0)), "thead": float(p.get("yaw", 0)),
				"up": float(p.get("y", 0)), "tup": float(p.get("y", 0)), "speed": 0.0, "act": ""}
			folk[id] = o
		var ch := str(p.get("char", "s"))
		if not Walker.CHARACTERS.has(ch):
			ch = "s"
		if o.char != ch:
			o.char = ch
			if o.model:
				o.model.queue_free()
			var m := Models.spawn("res://assets/characters/character-%s.glb" % ch)
			o.node.add_child(m)
			Models.use_vertex_colors(m)
			Models.fit_height(m, Walker.HEIGHT * 0.94)
			o.model = m
			o.ap = Models.anim_player(m)
			Models.loop_clips(o.ap, ["jump", "flip"])
		var ride := str(p.get("ride", "")) if p.get("ride") != null else ""
		if o.ride != ride:
			o.ride = ride
			if o.car:
				o.car.queue_free()
				o.car = null
			var c := Wallet.car(ride)
			if not c.is_empty():
				o.car = CarModel.make(c.paint)
				o.node.add_child(o.car)
			(o.tag as Label3D).position.y = 2.4 if ride == "" else 2.2
		if o.model:
			o.model.visible = ride == ""
		o.tdir = d
		o.thead = float(p.get("yaw", 0))
		o.tup = float(p.get("y", 0))
		o.act = str(p.get("act", "")) if p.get("act") != null else ""
	for id in folk.keys():
		if not seen.has(id):
			(folk[id].node as Node3D).queue_free()
			folk.erase(id)

func count() -> int:
	return folk.size()

func _process(delta: float) -> void:
	var k := 1.0 - pow(0.0008, minf(delta, 0.1))
	for id in folk:
		var o: Dictionary = folk[id]
		var n: Node3D = o.node
		var was := n.global_position
		o.dir = (o.dir as Vector3).lerp(o.tdir, k).normalized()
		o.head += wrapf(o.thead - o.head, -PI, PI) * k
		o.up += (o.tup - o.up) * k
		var d: Vector3 = o.dir
		n.global_transform = Transform3D(Planet.frame_at(d, o.head), d * (Planet.R + world.base_floor(d) + o.up))
		var v := was.distance_to(n.global_position) / maxf(delta, 0.001)
		o.speed += (v - o.speed) * minf(1.0, delta * 8.0)
		var ap: AnimationPlayer = o.ap
		if ap and o.ride == "":
			var clip: String = o.act
			if clip == "" or GROUND.has(clip):
				clip = "sprint" if o.speed > 9.0 else ("walk" if o.speed > 0.4 else "idle")
			if not ap.has_animation(clip):
				clip = "idle"
			if ap.current_animation != clip:
				ap.play(clip, 0.2)
