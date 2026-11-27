# with-unreal

A small Unreal Engine 5 C++ project with the Manalens **Unreal plugin**.

- The plugin starts with the game instance. It sends `session_start`, and
  `game_open` after consent. It sends `session_end` at quit.
- `UExampleGameSubsystem` is the game code. It calls `SetConsent`,
  `Identify`, `Track` (`level_start` and `level_complete`), and `TrackError`.
- The plugin keeps unsent events on disk, in `Saved/Manalens/`, and sends
  them at the next launch.
- With `-ManalensDemo`, the game calls each function once, waits for the send,
  and quits.

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
to ship in a game build.

> **Never put a Secret key (`mana_sk_`) or an API key in a game build.**
> Anyone who has the game can read `DefaultGame.ini`. For events from a
> dedicated server, use the Secret key on the server only: see
> [with-express-server](../with-express-server).

## Settings

The plugin reads **Project Settings > Plugins > Manalens**. The editor saves
them in `Config/DefaultGame.ini`, section
`[/Script/Manalens.ManalensSettings]`:

| Setting | Required | Value in this example |
| --- | --- | --- |
| `PublishableKey` | Yes | Empty. Set your `mana_pk_...` key. |
| `Endpoint` | Yes | `http://localhost:3101`, the collector URL without `/v0/events` |
| `Build` | No | `1`. Set `dev` for test runs. |
| `bEnabledInEditor` | No | `True`: Play in Editor sends events |
| `Storefront` | No | `Steam` |
| `bConsentRequired` | No | `True`: no events and no stored ID until `SetConsent(true)` |

Without a key and an endpoint, the game runs and sends nothing. The full list
of settings is in the [Unreal SDK docs](https://docs.manalens.dev/sdks/unreal).

For a test run, set the values on the command line. The command line wins
over the file:

```bash
-ini:Game:[/Script/Manalens.ManalensSettings]:PublishableKey=mana_pk_...,[/Script/Manalens.ManalensSettings]:Endpoint=http://127.0.0.1:3101
```

## Call the plugin from C++

Add `"Manalens"` to the dependencies in your module's `Build.cs`, then get the
subsystem from the game instance.
[ExampleGameSubsystem.cpp](./Source/ManalensExample/ExampleGameSubsystem.cpp)
has each call:

```cpp
#include "ManalensSubsystem.h"

UManalensSubsystem* Manalens = GetGameInstance()->GetSubsystem<UManalensSubsystem>();

// The player accepted analytics.
Manalens->SetConsent(true);

// The player signed in.
Manalens->Identify(TEXT("player-123"), { { TEXT("difficulty"), TEXT("normal") } }, {}, {});

// A game event: text, number, and true or false properties.
Manalens->Track(TEXT("level_complete"), {}, { { TEXT("level"), 3 }, { TEXT("score"), 1200 } }, { { TEXT("perfect"), true } });

// An error.
FManalensErrorOptions Options;
Options.Severity = EManalensSeverity::Critical;
Options.ErrorType = TEXT("SaveFailed");
Manalens->TrackError(TEXT("Save failed for slot 2"), Options);
```

## Call the plugin from Blueprint

Each function is a Blueprint node in the **Manalens** category. For example,
to send `level_complete` from a Level Blueprint or an Actor:

1. Right-click the graph and add **Get ManalensSubsystem** (under
   **Subsystems > Game Instance**).
2. Drag from its output and add **Track**.
3. Set **Event Name** to `level_complete`.
4. On **Numbers**, add a **Make Map** node with the keys `level` and `score`.
5. Connect the execution pin from your level end event.

**Set Consent**, **Identify**, and **Track Error** work the same way.

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker from the main repository. A game sends no `Origin` header, so any
   local project works.
2. Get the plugin (see [How the plugin is installed](#how-the-plugin-is-installed)):

   ```bash
   ./get-plugin.sh
   ```

3. Build the editor target. On macOS with Unreal Engine 5.8:

   ```bash
   "/Users/Shared/Epic Games/UE_5.8/Engine/Build/BatchFiles/Mac/Build.sh" \
     ManalensExampleEditor Mac Development -Project="$PWD/ManalensExample.uproject"
   ```

   Or open `ManalensExample.uproject` and click **Yes** when Unreal asks to
   build the modules.
4. Run the headless demo. It prints `MANALENS_SEND ok=true events=N` after
   each request and `MANALENS_DEMO done` before it quits:

   ```bash
   "/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd" \
     "$PWD/ManalensExample.uproject" -game -nullrhi -nosound -unattended -stdout \
     -ManalensDemo \
     -ini:Game:[/Script/Manalens.ManalensSettings]:PublishableKey=mana_pk_...,[/Script/Manalens.ManalensSettings]:Endpoint=http://127.0.0.1:3101
   ```

   The events appear in **Activity** after a short delay. Filter by engine
   `unreal`.

The smoke test runs step 4 when `UNREAL_EDITOR` is the path of
`UnrealEditor-Cmd`, or when `UNREAL_GAME` is the path of a packaged game:

```bash
UNREAL_EDITOR="/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd" MANALENS_SMOKE_ONLY=unreal pnpm smoke
```

Play in Editor sends events, because this example sets **Enabled In Editor**
(`bEnabledInEditor=True`). Dev and live data go to the same project. To
tell test builds apart, set **Build** (for example `dev`) and filter by it.
The plugin has one **Build** setting, so change it by hand
for a test run, or set it on the command line:
`-ini:Game:[/Script/Manalens.ManalensSettings]:Build=dev`.

## Run against a hosted endpoint

Set **Endpoint** to your collector URL and **Publishable Key** to the key,
then package the game.

## How the plugin is installed

The plugin is not in this repository. [get-plugin.sh](./get-plugin.sh)
downloads release `v0.3.0` of
[manalens-unreal](https://github.com/manalens/manalens-unreal) (MIT) and puts
its `Manalens` folder in `Plugins/Manalens`. `Plugins/` is in `.gitignore`.
`ManalensExample.uproject` turns the plugin on.

In your own project, use one of these:

- **Download:** get the `v0.3.0` source archive from the
  [releases page](https://github.com/manalens/manalens-unreal/releases) and
  copy its `Manalens` folder into `Plugins/`.
- **Git:** clone the repository and copy or link its `Manalens` folder into
  `Plugins/`:

  ```bash
  git clone --branch v0.3.0 https://github.com/manalens/manalens-unreal.git
  cp -R manalens-unreal/Manalens Plugins/Manalens
  ```

A Blueprint-only project needs one C++ class before Unreal builds the plugin
(**Tools > New C++ Class**).

## CI

The examples CI does not build this project: building needs the Unreal
Engine. Run the `unreal` smoke check on a machine with Unreal Engine 5.

## Files

- `Source/ManalensExample/ExampleGameSubsystem.h`, `.cpp`: the game code that
  calls the plugin.
- `Source/ManalensExample/ManalensExample.Build.cs`: adds the `Manalens`
  module.
- `Config/DefaultGame.ini`: the plugin settings.
- `get-plugin.sh`: downloads the plugin into `Plugins/Manalens`.
