# with-threejs

**Cube Catch**: a tiny three.js browser game that sends game events with the
Manalens **web SDK**, the `app` option and game mode.

Move the paddle with the arrow keys or the mouse. Catch 5 gold cubes to
complete a level. Three red cubes fail it. Press **E** to report a handled
error.

## What it shows

The `app` option makes every event a web event (with `context.page`) that
also carries `context.app`. The App filters and breakdowns (platform,
storefront, version, build, engine) and errors by build then work for the
game. `game: true` turns on game mode: the SDK sends the session and error
events for you, the same events as the Godot, Unity and Unreal SDKs.

```ts
createAnalytics({
  publishableKey,
  endpoint,
  app: { platform: 'web', engine: 'other', storefront: 'itch', app_version: '1.0.0', build: '1' },
  game: true,
});
```

`app_version` comes from `package.json`.

| Event | Properties | Sent by | When |
| --- | --- | --- | --- |
| `game_open` | `is_first_open`, `first_open_at` | The SDK | Each launch |
| `session_start` | none | The SDK | Launch, and the first event after 30 minutes without events |
| `session_end` | `duration_s` | The SDK | The page hides, or with the next event after 30 minutes without events |
| `level_start` | `level`, `attempt` | `track()` | A level starts |
| `level_complete` | `level`, `attempt`, `score` | `track()` | 5 gold cubes |
| `level_fail` | `level`, `attempt`, `score` | `track()` | 3 red cubes |
| `error` | `severity`, `message`, `error_type`, `handled`, `source`, `fingerprint` | The SDK (`source` `auto`) | An uncaught error or a rejected promise |
| `error` | the same | `trackError()` (`source` `manual`) | No WebGL, a lost WebGL context, or **E** |

Game mode also keeps unsent events in IndexedDB (`persistQueue`), so a lost
GPU context or a tab closed offline does not lose them.

`?demo=1` plays by itself (level 1 complete, level 2 failed, one error). The
smoke test uses it.

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
in a game build. Never put a Secret key or an API key in a build: Vite puts
every `VITE_*` value in the browser bundle.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `VITE_MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `VITE_MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |
| `VITE_MANALENS_STOREFRONT` | No | `itch` (default), `steam`, `epic`, `gog`, `app_store`, `play` or `other` |
| `VITE_MANALENS_BUILD` | No | The build label. Default: `dev` under `pnpm dev`, `1` in `pnpm build` |

Without a key, the game runs and sends nothing.

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker.
2. Use a local project whose domain is `localhost` or `<name>.localhost`.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set VITE_MANALENS_PUBLISHABLE_KEY
   pnpm install
   pnpm dev
   ```

4. Open `http://localhost:5173/` (project domain `localhost`) or
   `http://<name>.localhost:5173/`.

The SDK tracks `localhost`. Dev and live data go to the same project. To
tell test builds apart, set `build` (for example `"dev"`) and filter by it.
Under `pnpm dev`, this example sets
`build` to `"dev"`.

## Run against a hosted endpoint

Set `VITE_MANALENS_ENDPOINT` to your collector URL and build:

```bash
pnpm build    # writes dist/
```

Host `dist/` on your project domain (for example `play.example.com`), or
upload it to itch.io as an HTML5 game. Every project allows `*.itch.zone`, the
hosts that itch.io serves HTML5 builds from. For another game portal, add its
host in **Project settings > Allowed origins**.

## How the SDK is installed

`package.json` installs the web SDK from npm:

```json
"@manalens/web": "^0.5.0"
```

In your own project: `pnpm add @manalens/web`.

## Files

- `src/main.ts`: the game, the SDK setup and the level and error events.
