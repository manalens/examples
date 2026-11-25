extends Control
## Manalens Godot example.
##
## The key and the endpoint come from, in this order:
##   1. command-line arguments after `--`: --publishable-key=mana_pk_... --endpoint=URL
##   2. environment variables: MANALENS_PUBLISHABLE_KEY, MANALENS_ENDPOINT
##   3. project settings: manalens/publishable_key and manalens/endpoint
##
## `-- --demo` sends a set of events without input, waits for the send, prints
## one line `MANALENS_DEMO {json}` and quits with code 0 (all sent) or 1. The smoke
## test runs it headless.

const WEBSITE_URL := "https://example.com/wiki"

var _level := 1
var _attempt := 1
var _score := 0
var _status: Label


func _ready() -> void:
	var args := _user_args()
	var publishable_key := _setting(args, "publishable-key", "MANALENS_PUBLISHABLE_KEY", "manalens/publishable_key")
	var endpoint := _setting(args, "endpoint", "MANALENS_ENDPOINT", "manalens/endpoint")
	if publishable_key == "" or endpoint == "":
		push_error("Set the Publishable key and the endpoint. See README.md.")
		if args.has("demo"):
			get_tree().quit(1)
		return

	# init() sends session_start and game_open (is_first_open, first_open_at).
	# The platform (OS.get_name()) and engine ("godot") are set for you.
	Manalens.init({
		"publishable_key": publishable_key,
		"endpoint": endpoint,
		"app_version": ProjectSettings.get_setting("application/config/version", "1.0.0"),
		# Editor runs send events too. Tag them "dev" so you can filter them out.
		"build": "dev" if OS.has_feature("editor") else "1",
		"storefront": "itch",
		"debug": args.has("debug"),
		# The demo waits longer for the last send than a player would.
		"quit_timeout_s": 5.0 if args.has("demo") else 2.0,
	})

	if args.has("demo"):
		await _demo()
		return
	_build_ui()
	_level_start()


# Game events, with the names of the event conventions ----------------------

func _level_start() -> void:
	Manalens.track("level_start", {"level": _level, "attempt": _attempt})
	_show("Level %d, attempt %d" % [_level, _attempt])


func _level_complete() -> void:
	_score += 100 * _level
	Manalens.track("level_complete", {"level": _level, "attempt": _attempt, "score": _score})
	_level += 1
	_attempt = 1
	_level_start()


func _level_fail() -> void:
	Manalens.track("level_fail", {"level": _level, "attempt": _attempt, "score": _score})
	_attempt += 1
	_level_start()


func _buy_coins() -> void:
	# An in-game resource: "source" when the player gains it, "sink" when spent.
	Manalens.track("resource", {"flow": "source", "currency": "coins", "amount": 50, "item": "daily_bonus"})
	_show("Sent resource")


func _report_error() -> void:
	# A handled error. On Godot 4.5+, engine and script errors are sent for you.
	Manalens.track_error("Save failed", {"error_type": "SaveFailed", "severity": "error", "handled": true})
	_show("Sent error")


func _open_website() -> void:
	# link_url() adds mana_hid, so the website's web SDK joins this player.
	OS.shell_open(Manalens.link_url(WEBSITE_URL))


func _demo() -> void:
	# flushed(count, ok) tells the result of each send.
	var sends := {"ok": 0, "events": 0, "failed": 0}
	Manalens.flushed.connect(func(count: int, ok: bool) -> void:
		if ok:
			sends.ok += 1
			sends.events += count
		else:
			sends.failed += 1)
	var player := "godot_demo_%d" % int(Time.get_unix_time_from_system())
	_level_start()
	_level_complete()
	_level_fail()
	_buy_coins()
	_report_error()
	Manalens.identify(player, {"plan": "free"})
	var link := Manalens.link_url(WEBSITE_URL)
	# shutdown() sends session_end and flushes for at most quit_timeout_s.
	await Manalens.shutdown()
	var left: int = Manalens.get_queue_size()
	print("MANALENS_DEMO ", JSON.stringify({
		"anonymous_id": Manalens.get_anonymous_id(),
		"user_id": player,
		"queue_left": left,
		"sends_ok": sends.ok,
		"events_sent": sends.events,
		"sends_failed": sends.failed,
		"link_has_handoff": link.contains("mana_hid="),
	}))
	get_tree().quit(0 if left == 0 and sends.failed == 0 and sends.ok > 0 else 1)


# UI ---------------------------------------------------------------------------

func _build_ui() -> void:
	var box := VBoxContainer.new()
	box.position = Vector2(24, 24)
	add_child(box)
	_status = Label.new()
	box.add_child(_status)
	for item in [
		["Complete level", _level_complete],
		["Fail level", _level_fail],
		["Get coins (resource)", _buy_coins],
		["Report an error", _report_error],
		["Open the website (link_url)", _open_website],
	]:
		var button := Button.new()
		button.text = item[0]
		button.pressed.connect(item[1])
		box.add_child(button)


func _show(text: String) -> void:
	if _status != null:
		_status.text = text


# Settings -------------------------------------------------------------------

func _user_args() -> Dictionary:
	var args := {}
	for arg in OS.get_cmdline_user_args():
		var parts := String(arg).trim_prefix("--").split("=", true, 1)
		args[parts[0]] = parts[1] if parts.size() > 1 else "true"
	return args


func _setting(args: Dictionary, arg: String, env: String, project_setting: String) -> String:
	if args.has(arg):
		return String(args[arg])
	if OS.get_environment(env) != "":
		return OS.get_environment(env)
	return String(ProjectSettings.get_setting(project_setting, ""))
