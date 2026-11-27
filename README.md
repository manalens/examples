# Manalens Examples

Runnable example projects for the Manalens SDKs. Each `with-*`
folder is a separate project with its own README, `.env.example` and
dependencies. Copy the folder that is nearest to your stack.

| Example | SDK | Key | Shows |
| --- | --- | --- | --- |
| [with-next](./with-next) | Web SDK (npm) | Publishable key | Page views on App Router navigation, `identify()`, a custom event, `reset()` |
| [with-html](./with-html) | Web SDK (script tag) | Publishable key | The snippet with `data-publishable-key`, `data-endpoint` and Subresource Integrity, a custom event button |
| [with-astro](./with-astro) | Web SDK (script tag) | Publishable key | An Astro site: the snippet in the base layout with SRI, one page view per View Transitions navigation, `wishlist_clicked`, `identify()` after a newsletter form |
| [with-react](./with-react) | Web SDK (npm) | Publishable key | A React + React Router site with Vite: one page view per navigation, `wishlist_clicked`, `identify()` and `reset()` |
| [with-threejs](./with-threejs) | Web SDK (npm) | Publishable key | A three.js browser game with the `app` option and game mode (`game_open`, `session_start`, `session_end`, `error`), `level_*` events, and `trackError()` for a lost WebGL context |
| [with-electron](./with-electron) | Web SDK + Node SDK (app mode) | Publishable key | Renderer and main process with one anonymous ID, `app_crash` with a running flag |
| [with-godot](./with-godot) | Godot SDK | Publishable key | A Godot 4 project with `publishable_key`, level events, `track_error()`, `link_url()` |
| [with-unity](./with-unity) | Unity SDK | Publishable key | A Unity project with `PublishableKey`, level events, `TrackError()`, `Identify()`, `LinkUrl()` |
| [with-unreal](./with-unreal) | Unreal plugin | Publishable key | An Unreal Engine 5 C++ project with the plugin: `SetConsent()`, `Identify()`, level events with `Track()`, `TrackError()`, and one Blueprint path |
| [with-express-server](./with-express-server) | Node SDK (server mode) | Secret key | The player's IP and user agent as context, a purchase webhook route |
| [with-stripe](./with-stripe) | Web SDK (script tag) | Publishable key | One player ID in `identify()` and in the Stripe Checkout Session metadata (set on the server), so Stripe webhook revenue joins the player |
| [with-paddle](./with-paddle) | Web SDK (script tag) | Publishable key | One player ID in `identify()` and in the Paddle.js `customData`, so Paddle webhook revenue joins the player |

## Keys

- The **Publishable key** (`mana_pk_...`) sends website and game events. It is
  public: it is safe in a page, a game build and an Electron app.
- The **Secret key** (`mana_sk_...`) sends server events. Keep it on your
  backend only. Never put it in a page, a game build or an Electron app.
- An **API key** (`mana_api_...`) reads data. No example uses it.

Get both keys in your project under **Settings > General > Credentials**.

## Endpoint

Every example needs the collector URL (the endpoint), without `/v0/events`:

- **Local stack:** `http://localhost:3101`, the API of the Manalens
  repository (`apps/api`) with the local worker.
- **Hosted:** your collector URL from the project's install page.

Web events (`with-next`, `with-html`, `with-astro`, `with-react`,
`with-threejs`, `with-stripe`, `with-paddle` and the Electron renderer) must come from a page on the **project domain**, one of
its subdomains, or a host in **Project settings > Allowed origins**. A new
project lists `*.itch.zone`, so a build on itch.io (`html.itch.zone` or
`html-classic.itch.zone`) works with no change. For another game portal, add
its host there. For a local test, use a project with the domain `localhost`
or `<name>.localhost` and open the page on that host. Chromium sends every
`*.localhost` name to your machine.

## How the examples get the SDKs

Every example uses the latest release of its SDK:

| SDK | Version | Used by | How |
| --- | --- | --- | --- |
| [`@manalens/web`](https://www.npmjs.com/package/@manalens/web) | 0.4.0 | with-next, with-html, with-astro, with-react, with-threejs, with-electron, with-stripe, with-paddle | npm, `"@manalens/web": "^0.4.0"` |
| [`@manalens/node`](https://www.npmjs.com/package/@manalens/node) | 0.2.0 | with-express-server, with-electron | npm, `"@manalens/node": "^0.2.0"` |
| [Godot addon](https://github.com/manalens/manalens-godot) | 0.4.0 | with-godot | A copy of `addons/manalens` from tag `v0.4.0` |
| [Unity package](https://github.com/manalens/manalens-unity) `dev.manalens.sdk` | 0.3.0 | with-unity | Git URL in `Packages/manifest.json`, `https://github.com/manalens/manalens-unity.git#v0.3.0` |
| [Unreal plugin](https://github.com/manalens/manalens-unreal) | 0.3.0 | with-unreal | `with-unreal/get-plugin.sh` downloads tag `v0.3.0` into `with-unreal/Plugins/Manalens` |

The web and Node SDK source is in
[manalens-js](https://github.com/manalens/manalens-js). All SDKs are MIT.

To use an SDK in your own project:

- Web SDK: `pnpm add @manalens/web`, or the CDN tag from the
  [release notes](https://github.com/manalens/manalens-js/releases) (see
  [with-html](./with-html)).
- Node SDK: `pnpm add @manalens/node`.
- Godot: copy `addons/manalens` of a release into your project.
- Unity: in the Package Manager, add the git URL
  `https://github.com/manalens/manalens-unity.git#v0.3.0`.
- Unreal: copy the `Manalens` folder of a release into `Plugins/`.

## Smoke test

[scripts/smoke.mjs](./scripts/smoke.mjs) sends events from the examples to a
collector and fails when a request does not get a 2xx answer. Use a test
project: the events are real.

```bash
cp .env.example .env          # MANALENS_ENDPOINT, MANALENS_PUBLISHABLE_KEY, MANALENS_SECRET_KEY, MANALENS_PAGE_HOST
pnpm install                  # Playwright, for the browser checks
pnpm exec playwright install chromium-headless-shell
pnpm install:all              # the dependencies of each example
pnpm smoke
```

| Check | What it runs |
| --- | --- |
| `express` | The Express app with a server-mode client: `checkout_started` (with IP and user agent) and `purchase` |
| `electron-main` | The Electron main-process module in Node.js: `app_crash`, `app_started`, `app_quit` |
| `godot` | The Godot project headless (`-- --demo`). Skipped without Godot; set `GODOT` to the binary |
| `unity` | Builds a desktop player of the Unity project, then runs it in batch mode (`--demo`). Skipped without Unity; set `UNITY` to the Editor binary |
| `unreal` | Runs the Unreal project with the plugin and `-ManalensDemo`. Skipped without Unreal; set `UNREAL_EDITOR` to `UnrealEditor-Cmd` (the project must be built) or `UNREAL_GAME` to a packaged game |
| `html` | The snippet page in headless Chromium: two page views and `signup_clicked` |
| `threejs` | The game with `?demo=1` in headless Chromium: game, session, level and error events |
| `next` | `next dev` in headless Chromium: page views on navigation, `trial_started`, `identify` |
| `react` | `vite dev` in headless Chromium: one page event per React Router navigation (also with `StrictMode`), `wishlist_clicked`, `identify` |
| `stripe` | The Stripe store page in headless Chromium, without payment keys: `identify` has the player ID that the server puts in the Checkout Session |
| `paddle` | The Paddle store page in headless Chromium, without payment keys: `identify` has the player ID that the page puts in `customData` |
| `astro` | The built Astro site in headless Chromium: `wishlist_clicked`, `identify`, and View Transitions navigation (links and back). It fails unless the page events sent equal the pages visited, path and title (also after back) |

Set `MANALENS_SMOKE_ONLY=express,godot` to run some checks only. The Electron
renderer needs a desktop session; check it by hand (see
[with-electron](./with-electron)).

## CI

[.github/workflows/build.yml](./.github/workflows/build.yml) installs, builds
and type-checks each example, checks the SRI hash of `with-html` and
`with-astro`, and loads the Godot project headless. It uses no secrets and sends no events.
It does not build `with-unity` (the Unity Editor needs a license) or
`with-unreal` (it needs the Unreal Engine). Run the
`unity` smoke check on a machine with Unity.

## License

[MIT](./LICENSE)
