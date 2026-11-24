# with-next

A Next.js App Router app with the Manalens **web SDK**.

- **Page views on navigation.** `autoPageviews` is off. `AnalyticsTracker`
  calls `page()` on the first load and each time the path or the query
  changes (client-side navigation with `<Link>`).
- **identify()**: the **Sign in** button links this browser to a user ID.
- **A custom event**: the **Start trial** button sends `trial_started`.
- **reset()**: the **Sign out** button clears the user ID, the anonymous ID
  and the session.

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is public
and safe in a page. Never put a Secret key or an API key in a `NEXT_PUBLIC_`
variable: Next.js puts those in the browser bundle.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `NEXT_PUBLIC_MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |

Without them, the app runs and sends nothing.

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker.
2. Use a local project whose domain is `localhost` or `<name>.localhost`.
   The collector accepts a web event only from a page on the project domain.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set NEXT_PUBLIC_MANALENS_PUBLISHABLE_KEY
   pnpm install
   pnpm dev
   ```

4. Open `http://localhost:3000/` (project domain `localhost`) or
   `http://<name>.localhost:3000/`. Click the links and the buttons. In the
   developer tools, `POST /v0/events` returns `202`. The SDK sends a batch
   every 5 seconds, when the page hides, and at once after `identify()`.

## Run against a hosted endpoint

Set the two variables in your host (for example Vercel project settings) and
deploy on your project domain. `NEXT_PUBLIC_*` values are read at build time,
so build again after a change.

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

- `src/lib/analytics.ts`: one SDK instance, browser only, `autoPageviews: false`.
- `src/components/analytics-tracker.tsx`: `page()` on each navigation.
- `src/app/layout.tsx`: mounts the tracker once, inside `<Suspense>`.
- `src/components/demo-actions.tsx`: `identify()`, `track()` and `reset()`.
