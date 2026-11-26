# with-godot

A small Godot 4 project with the Manalens **Godot SDK**.

- `Manalens.init()` with `publishable_key`. It sends `session_start`
  and `game_open` for you, and `session_end` at quit.
- Buttons send `level_start`, `level_complete`, `level_fail`, `resource` and a
  handled error with `track_error()`.
- **Open the website** uses `link_url()`, so the website's web SDK joins the
  browser to this player.
- On Godot 4.5 or newer, engine and script errors are sent for you. After a
  crash, the next launch sends `app_unclean_exit`.

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
to ship in a game build. Never put a Secret key or an API key in a build.

## Settings

`main.gd` reads the key and the endpoint from, in this order:

1. arguments after `--`: `--publishable-key=mana_pk_...` `--endpoint=URL`
2. environment variables: `MANALENS_PUBLISHABLE_KEY`, `MANALENS_ENDPOINT`
3. project settings: `manalens/publishable_key` and
   `manalens/endpoint` in `project.godot`

For a shipped game, put the values in the project settings (3).

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker. A game sends no `Origin` header, so any local project works.
2. Open the project in Godot 4.5 or newer and run it, with the key in the
   project settings. Or from a terminal:

   ```bash
   MANALENS_PUBLISHABLE_KEY=mana_pk_... MANALENS_ENDPOINT=http://127.0.0.1:3101 godot --path .
   ```

3. Headless demo (no window, no input). It sends a set of events, waits for
   the send, prints `MANALENS_DEMO {...}` and exits with code 0 when every request
   got a 2xx answer:

   ```bash
   godot --headless --path . -- --demo --endpoint=http://127.0.0.1:3101 --publishable-key=mana_pk_...
   ```

The SDK keeps unsent events in `user://manalens_queue.json` and sends
them at the next launch.

## Editor runs

The SDK sends events from the editor too. Dev and live data go to the same
project. To tell test builds apart, set `build` (for example `"dev"`) and
filter by it. This example sets `build` to `"dev"` when
`OS.has_feature("editor")` is true, and to `"1"` in an exported game.

## Run against a hosted endpoint

Set `manalens/endpoint` to your collector URL and
`manalens/publishable_key` to the key, then export the game. For a
web export, serve it from your project domain or from itch.io (`*.itch.zone`
is allowed by default).

## How the SDK is installed

`addons/manalens` is a copy of `sdks/godot/addons/manalens`
from the Manalens repository at commit `e0ad489e` (2026-11-26, SDK 0.1.3). The
plugin is enabled in `project.godot`, which adds the `Manalens`
autoload. To update, copy the folder again and note the commit here.
