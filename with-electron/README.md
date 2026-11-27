# with-electron

An Electron game shell with Manalens in both processes:

- **Renderer:** the **web SDK** with the `app` option and game mode
  (`game: true`). `platform` comes from the OS (`macos`, `windows` or
  `linux`). The SDK sends page views, `game_open`, `session_start`,
  `session_end` and an `error` event for each uncaught error (`source`
  `auto`). The page sends level events, and a handled error with
  `trackError()` (`source` `manual`).
- **Main process:** the **Node SDK in app mode** with the Publishable key. It
  sends `app_started`, `app_quit` and `app_crash`.
- **One player:** the renderer's web SDK makes the anonymous ID. The renderer
  sends it to the main process over IPC (`game:anonymous-id`), and the main
  process uses it as `anonymousId`. Both processes count as one player.
- **Crashes:** at start the main process writes a running flag file in
  the user data folder. A normal quit removes it. If the flag is still there
  at the next start, the last run did not quit normally: the main process
  sends `app_crash` with `previous_session_id`, `previous_build` and
  `previous_app_version`. The Godot, Unity and Unreal SDKs send this event for
  you. A browser cannot tell a crash from a close, so the web SDK does not.

## Key: Publishable key only

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
to ship in the app.

> **Never put a Secret key (`mana_sk_`) or an API key in an Electron app.**
> Anyone who has the app can read every file in it. The Node SDK refuses a
> Secret key in app mode, and `src/main.mjs` refuses one at start.

## Why the renderer is not a file:// page

The collector accepts a web event only when its page URL is an `http` or
`https` URL on the project domain. A `file://` page is refused with `403`. So
`src/main.mjs` serves the local renderer files under
`https://<MANALENS_RENDERER_HOST>/` with `protocol.handle('https', ...)`. The files
stay in the app; there is no web server and no network request for them.
Every other `https` request goes out as usual.

Set `MANALENS_RENDERER_HOST` to a host on your project domain, for example
`game.example.com` for the domain `example.com`.

## Environment

The app reads `.env` when it runs from this folder. A packaged build has no
`.env`: put the Publishable key and the endpoint in your build config.

| Variable | Required | Value |
| --- | --- | --- |
| `MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |
| `MANALENS_RENDERER_HOST` | Yes | A host on the project domain. Default `game.localhost` |
| `MANALENS_STOREFRONT` | No | Default `steam` |
| `MANALENS_BUILD` | No | Default `1` |
| `MANALENS_DEBUG` | No | `true` logs failed requests of the main process |

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker.
2. Use a local project with the domain `localhost` or `<name>.localhost`. Set
   `MANALENS_RENDERER_HOST` to `game.localhost` or `game.<name>.localhost`.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set MANALENS_PUBLISHABLE_KEY and MANALENS_RENDERER_HOST
   pnpm install
   pnpm start
   ```

4. Click the buttons, then quit (Cmd+Q or close the window). The renderer
   sends `session_end`, and the main process sends `app_quit`.
5. To test crashes, click **Simulate a crash** (or kill the process), then
   start the app again. The main process sends `app_crash`.

## Run against a hosted endpoint

Set `MANALENS_ENDPOINT` to your collector URL and `MANALENS_RENDERER_HOST` to a host on
your project domain. The content security policy in `src/main.mjs` allows
`connect-src` to the endpoint origin only.

## How the SDKs are installed

`package.json` installs both packages from npm:

```json
"@manalens/node": "^0.2.0",
"@manalens/web": "^0.4.0"
```

The renderer has no bundler: the main process serves the web SDK build from
`node_modules` under `/lib/manalens-web/`. With a bundler (Vite, electron-vite,
webpack), write `import { createAnalytics } from '@manalens/web'`.

## Files

- `src/main.mjs`: the window, the `https` handler, IPC and the quit steps.
- `src/main-analytics.mjs`: the main-process analytics (Node SDK in app mode,
  the running flag). It does not import Electron, so the smoke test runs it in
  Node.js.
- `src/preload.cjs`: the small API that the renderer gets (`window.game`).
- `src/renderer/`: the page and the web SDK setup.
