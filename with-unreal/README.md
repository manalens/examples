# with-unreal

An Unreal Engine 5 C++ project that sends game events to Manalens over HTTP.

Manalens has **no Unreal SDK or plugin**. This project has a game instance
subsystem, `UAnalyticsSubsystem`, that does what an SDK would do. Copy
`Source/ManalensExample/AnalyticsSubsystem.h` and `.cpp` into your own game
module. The website guide
[How to add analytics to an Unreal Engine game](https://manalens.dev/blog/unreal-engine-analytics)
explains each part.

## What it shows

| Event | Properties | When |
| --- | --- | --- |
| `game_open` | `is_first_open`, `first_open_at` | Each launch |
| `session_start` | none | Launch, or the first event after 30 minutes idle |
| `session_end` | `duration_s` | 30 minutes idle, a session 24 hours old, or quit |
| `level_start` | `level`, `attempt` | `LevelStart()` |
| `level_complete`, `level_fail` | `level`, `attempt`, `score` | `LevelEnd()` |
| `error` | `severity`, `message`, `error_type`, `handled`, `fingerprint` | `TrackError()` |
| `identify` | `user_id`, `traits` | `Identify()`, after the player signs in |

The subsystem:

- keeps one `anonymous_id` for each install, in `Saved/Manalens/`;
- makes a new `session_id` for each session, never the anonymous ID;
- sends app events (`channel: app`) with `context.app` and `engine: unreal`;
- sends up to 50 events in a request, every 10 seconds and at 20 queued events;
- keeps a batch after a network error or a 5xx, 408 or 429 answer and sends it
  again with the same `message_id` values, so it counts once;
- sends nothing from Play in Editor (`bSendInEditor=false`).

Every function is a `UFUNCTION(BlueprintCallable)`, so Blueprint-only gameplay
code can call it too:

```cpp
if (UAnalyticsSubsystem* Analytics = GetGameInstance()->GetSubsystem<UAnalyticsSubsystem>())
{
    Analytics->LevelStart(3, 1);
    Analytics->LevelEnd(3, 1, 1200, /*bCompleted*/ true);
}
```

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
to ship in a build. The subsystem refuses any other key at start.

> **Never put a Secret key (`mana_sk_`) or an API key in a game build.**
> Anyone who has the game can read `DefaultGame.ini`. For events from a
> dedicated server, use the Secret key on the server only: see
> [with-express-server](../with-express-server).

## Settings

`Config/DefaultGame.ini`, section `[/Script/ManalensExample.AnalyticsSubsystem]`:

| Setting | Required | Value |
| --- | --- | --- |
| `Endpoint` | Yes | The collector URL without `/v0/events` |
| `PublishableKey` | Yes | The Publishable key, `mana_pk_...` |
| `AppVersion` | No | Up to 32 characters, default `1.0.0` |
| `Build` | No | Up to 64 characters, default `1` |
| `Storefront` | No | `steam` (default), `itch`, `epic`, `gog`, `app_store`, `play` or `other` |
| `bSendInEditor` | No | `false` (default). `true` sends from Play in Editor too |

The command line wins over the file: `-ManalensEndpoint=...` and
`-ManalensKey=...`. Without an endpoint and a key, the game runs and sends
nothing.

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker from the main repository.
2. Check the request format first, without Unreal. From the repository root:

   ```bash
   MANALENS_SMOKE_ONLY=unreal-http pnpm smoke
   ```

   It sends `request.example.json` (the body that the subsystem sends) with new
   IDs and times.
3. Open `ManalensExample.uproject` with Unreal Engine 5. Unreal asks to build
   the module: click **Yes**. (Or right-click the `.uproject` file and choose
   **Generate Visual Studio project files**, then build in your IDE.)
4. Package a development build (**Platforms > your platform > Package
   Project**). Play in Editor sends nothing by default.
5. Run the packaged game with the demo flag. It sends level events, an error
   and an `identify`, then quits:

   ```bash
   ./ManalensExample -ManalensDemo -ManalensEndpoint=http://localhost:3101 -ManalensKey=mana_pk_... -log
   ```

   Each request prints `MANALENS_SEND status=202 events=N` in the log. The
   events appear in **Activity** after a short delay. Filter by engine
   `unreal`.

The smoke test runs step 5 when `UNREAL_GAME` is the path of the packaged
binary:

```bash
UNREAL_GAME=/path/to/ManalensExample MANALENS_SMOKE_ONLY=unreal pnpm smoke
```

## What you still need to add

The subsystem is a starting point. Before you ship, add:

- **A queue on disk.** Unsent events are lost when the game quits or
  crashes. Save the queue at quit, load it at the next launch, and drop events
  older than 7 days: one old event makes the collector refuse the whole batch.
- **A wait at quit.** The last request (with `session_end`) can be lost when
  the process exits.
- **Retry-After** after a 429, and a longer wait between retries.
- **Consent.** If your players must opt in, do not start the subsystem (or
  drop events) until they do.
- **A check on each platform you ship.** Log one `message_id` and one
  `original_timestamp` from each platform and check that the collector
  accepts them.

## CI

The examples CI does not build this project: building needs the Unreal Engine.
The `unreal-http` smoke check tests the request format without it.

## Files

- `Source/ManalensExample/AnalyticsSubsystem.h`, `.cpp`: the subsystem. Copy
  both into your game module.
- `Source/ManalensExample/ManalensExample.Build.cs`: adds the `HTTP` and
  `Json` modules. Add them to your own module's `Build.cs`.
- `Config/DefaultGame.ini`: the settings.
- `request.example.json`: one request body, as the subsystem sends it.
