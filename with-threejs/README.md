# with-threejs

**Cube Catch**: a tiny three.js browser game that sends game events with the
Manalens **web SDK** and the `app` option.

Move the paddle with the arrow keys or the mouse. Catch 5 gold cubes to
complete a level. Three red cubes fail it. Press **E** to report a handled
error.

## What it shows

The `app` option makes every event a web event (with `context.page`) that
also carries `context.app`. The App filters and breakdowns (platform,
storefront, version, build, engine) and errors by build then work for the
game.

```ts
createAnalytics({
  publishableKey,
  endpoint,
  app: { platform: 'web', engine: 'other', storefront: 'itch', app_version: '1.0.0', build: '1' },
});
```

`app_version` comes from `package.json`. The web SDK does not send game events
for you. `src/game-analytics.ts` sends them with `track()`:

| Event | Properties | When |
| --- | --- | --- |
| `game_open` | `is_first_open`, `first_open_at` | Each launch |
| `session_start` | none | Launch, or input after 30 minutes idle |
| `session_end` | `duration_s` | The page hides, or 30 minutes idle |
| `level_start` | `level`, `attempt` | A level starts |
| `level_complete` | `level`, `attempt`, `score` | 5 gold cubes |
| `level_fail` | `level`, `attempt`, `score` | 3 red cubes |
| `error` | `severity`, `message`, `error_type`, `handled`, `fingerprint` | An uncaught error, a rejected promise, no WebGL, a lost WebGL context, or **E** |

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
| `VITE_MANALENS_BUILD` | No | The build label, default `1` |

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

The package is not on npm yet. `package.json` installs the built copy
from the repository's `vendor/` folder:

```json
"@manalens/web": "file:../vendor/manalens-web-0.1.0.tgz"
```

In your own project, copy the tarball and install it, or install from GitHub
(it is public, MIT): `pnpm add github:manalens/manalens-js`.

TODO: change it to `"@manalens/web": "^0.1.0"`.

## Files

- `src/main.ts`: the game and the SDK setup.
- `src/game-analytics.ts`: the game events, the 30-minute idle session and
  error capture. Copy it into your game.
