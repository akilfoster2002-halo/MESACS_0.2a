## THE KEYS, AS THE GAME READS THEM. Godot's Input answers "is W down?"
## whether or not somebody is typing "w" into the phone, so everything that
## moves asks here instead, and a card with a text box in it shuts the gate.
## (The browser had the same trap: typing into the chat walked you about.)
class_name Ctl
extends RefCounted

static var blocked := false

static func axis(neg: StringName, pos: StringName) -> float:
	return 0.0 if blocked else Input.get_axis(neg, pos)

static func held(a: StringName) -> bool:
	return false if blocked else Input.is_action_pressed(a)

static func just(a: StringName) -> bool:
	return false if blocked else Input.is_action_just_pressed(a)
