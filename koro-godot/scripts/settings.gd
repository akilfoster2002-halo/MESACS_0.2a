## What this machine remembers between launches: who you are, and later the
## account you signed in with. A file in the app's own data folder.
class_name Settings
extends RefCounted

const PATH := "user://koro.cfg"
static var cfg: ConfigFile = null

static func _cfg() -> ConfigFile:
	if cfg == null:
		cfg = ConfigFile.new()
		cfg.load(PATH)
	return cfg

static func get_value(key: String, fallback: Variant = null) -> Variant:
	return _cfg().get_value("koro", key, fallback)

static func set_value(key: String, v: Variant) -> void:
	_cfg().set_value("koro", key, v)
	_cfg().save(PATH)
