# with-react

**Harbor Lights**: a small game website in React with React Router and Vite.
It sends page views and events with the Manalens **web SDK**.

## What it shows

- **One SDK instance** (`src/analytics.ts`): a browser-only getter with
  `autoPageviews: false`. It reuses one instance, so React's development
  double effects (`StrictMode`) do not create a second one.
- **Page views from the router** (`src/analytics-tracker.tsx`): one `page()`
  call per React Router navigation, from `useLocation()`. For another router,
  use its location hook the same way.
- **A custom event:** `wishlist_clicked` with `placement` when the player
  clicks **Wishlist on Steam**.
- **`identify()` and `reset()`:** the newsletter form identifies the player
  after the signup succeeds, with an opaque player ID (never the email).
  **Sign out** calls `reset()`.

This is the setup of the website guide
[How to install privacy-first analytics in React](https://manalens.dev/integrations/react).
For a game made with React Three Fiber, see [with-threejs](../with-threejs):
the game code is the same.

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is safe
in a page. Never put a Secret key or an API key in a `VITE_*` variable: Vite
puts every `VITE_*` value in the browser bundle.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `VITE_MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `VITE_MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |

Without a key, the site runs and sends nothing.

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
   `http://<name>.localhost:5173/`. Click the links, the Steam button and the
   newsletter form. The events appear in **Activity** after a short delay.

## Run against a hosted endpoint

Set `VITE_MANALENS_ENDPOINT` to your collector URL and build:

```bash
pnpm build    # writes dist/
```

Host `dist/` on your project domain. Configure your host to serve
`index.html` for every path, so that React Router handles `/devlog` and
`/newsletter` on a full page load.

## How the SDK is installed

`package.json` installs the web SDK from npm:

```json
"@manalens/web": "^0.5.0"
```

In your own project: `pnpm add @manalens/web`.

## Files

- `src/analytics.ts`: the SDK instance.
- `src/analytics-tracker.tsx`: page views on navigation. Mount it once,
  inside the router.
- `src/main.tsx`: the pages, the custom event, `identify()` and `reset()`.
