## What this machine remembers between launches: who you are, and later the
## account you signed in with. A file in the app's own data folder.
class_name Settings
extends RefCounted

static var cfg: ConfigFile = null

## KORO_PROFILE=name keeps a whole separate self in user://name/ — how two
## copies run side by side on one machine, and how a test signs in without
## touching the settings of whoever actually plays here.
static func dir() -> String:
	var p := OS.get_environment("KORO_PROFILE")
	if p == "":
		return "user://"
	DirAccess.make_dir_recursive_absolute("user://" + p)
	return "user://" + p + "/"

static func _cfg() -> ConfigFile:
	if cfg == null:
		cfg = ConfigFile.new()
		cfg.load(dir() + "koro.cfg")
	return cfg

static func get_value(key: String, fallback: Variant = null) -> Variant:
	return _cfg().get_value("koro", key, fallback)

static func set_value(key: String, v: Variant) -> void:
	_cfg().set_value("koro", key, v)
	_cfg().save(dir() + "koro.cfg")
