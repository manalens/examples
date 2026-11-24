# with-unity

A small Unity project with the Manalens **Unity SDK**.

- `Manalens.Init()` with the `PublishableKey`. It sends `session_start` and
  `game_open` for you, and `session_end` at quit.
- Buttons send `level_start`, `level_complete`, `level_fail`, `resource`, a
  handled error with `TrackError()` and `Identify()`.
- **Open the website** uses `LinkUrl()`, so the website's web SDK joins the
  browser to this player.
- Unhandled exceptions and `Debug.LogError` are sent for you. After a crash,
  the next launch sends `app_unclean_exit`.

The game is one script, [Assets/Scripts/ExampleGame.cs](./Assets/Scripts/ExampleGame.cs).
It starts by itself in any scene and draws its buttons with IMGUI, so the
project has no scene or prefab to set up.

The SDK also has a small sample that you can import in **Package Manager >
Manalens > Samples**. This project is the full, clone-and-run example.

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
to ship in a game build. Never put a Secret key or an API key in a build.

## Settings

`ExampleGame.cs` reads the key and the endpoint from, in this order:

1. command-line arguments: `--publishable-key=mana_pk_...` `--endpoint=URL`
2. environment variables: `MANALENS_PUBLISHABLE_KEY`, `MANALENS_ENDPOINT`
3. the constants `PublishableKey` and `Endpoint` at the top of the script

For a shipped game, put the values in the constants (3).

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local worker. A
   game sends no `Origin` header, so any local project works.
2. Open the folder in Unity Hub (**Add > Add project from disk**) with Unity
   2021.3 or newer. The first import takes a few minutes.
3. Put the key in `PublishableKey` in `ExampleGame.cs`, then press **Play**.
   The example sends events from Play mode too. In your own game, use
   `Enabled = !Application.isEditor` or a test project key in the editor.
4. Headless demo (no window, no input). Build a player, then run it in batch
   mode. It sends a set of events, waits for the send, logs
   `MANALENS_DEMO {...}` and exits with code 0 when every request got a 2xx
   answer:

   ```bash
   UNITY=/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity
   "$UNITY" -batchmode -nographics -quit -projectPath . -executeMethod BuildDemo.Build -logFile -
   Build/with-unity.app/Contents/MacOS/with-unity -batchmode -nographics -logFile - \
     --demo --endpoint=http://127.0.0.1:3101 --publishable-key=mana_pk_...
   ```

   On Windows the player is `Build/with-unity.exe`. On Linux it is
   `Build/with-unity.x86_64`. You can also build from the menu
   **Manalens > Build demo player**.

The SDK keeps unsent events in `Application.persistentDataPath` and sends them
at the next launch.

## Run against a hosted endpoint

Set `Endpoint` to your collector URL and `PublishableKey` to the key, then
build the game. For a WebGL build, serve it from your project domain or from
itch.io (`*.itch.zone` is allowed by default).

## How the SDK is installed

[Packages/manifest.json](./Packages/manifest.json) installs the package
`dev.manalens.sdk` from the tarball in [vendor/](../vendor):

```json
"dev.manalens.sdk": "file:../../vendor/dev.manalens.sdk-0.1.0.tgz"
```

The path is relative to the `Packages` folder. The tarball is
`sdks/unity` of the Manalens repository; the commit is in
[vendor/README.md](../vendor/README.md). In your own project, use **Package
Manager > + > Add package from tarball**. The manifest also lists the Unity
modules that the SDK and this example use: UnityWebRequest, IMGUI and JSON
serialize.

TODO: when the Unity SDK has a public repository, change the
dependency to its git URL.
