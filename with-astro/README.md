# with-astro

An Astro 7 site with the Manalens **web SDK snippet**: one
`<script>` tag in the base layout, no npm import in the pages.

- **The snippet in the base layout.** `src/layouts/Base.astro` adds the tag
  with `is:inline`, `data-publishable-key`, `data-endpoint`, `integrity` and
  `crossorigin="anonymous"` (Subresource Integrity) and
  `data-auto-pageviews="false"`. It makes `window.manalens`. The
  layout sends the page views (see below).
- **Analytics off without a key.** An empty `PUBLIC_MANALENS_PUBLISHABLE_KEY` gives
  pages with no analytics tag.
- **View Transitions.** The devlog pages (`/devlog/` and each post) use
  `<ClientRouter />`. Each page, also after **back** and **forward**, sends
  **one** page view with the correct title. See
  [Page views with View Transitions](#page-views-with-view-transitions).
- **A custom event**: the **Wishlist on Steam** button sends
  `track('wishlist_clicked', { store: 'steam' })`.
- **identify()**: the fake newsletter form calls
  `identify('subscriber_demo_42', { newsletter: true })` after the submit.
  It sends no email.

```astro
<script
  is:inline
  src="/snippet.global.js"
  integrity="sha384-..."
  crossorigin="anonymous"
  data-publishable-key={MANALENS_PUBLISHABLE_KEY}
  data-endpoint={MANALENS_ENDPOINT}
  data-auto-pageviews="false"
  defer
></script>
```

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is public
and safe in a page. Never put a Secret key or an API key in a `PUBLIC_`
variable: Astro writes those values into the built pages.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `PUBLIC_MANALENS_PUBLISHABLE_KEY` | No | The Publishable key, `mana_pk_...`. Empty turns analytics off. |
| `PUBLIC_MANALENS_ENDPOINT` | With a key | The collector URL without `/v0/events` |

Astro reads `PUBLIC_` values at build time. Build again after a change.

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker.
2. Use a local project whose domain is `localhost` or `<name>.localhost`.
   The collector accepts a web event only from a page on the project domain.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set PUBLIC_MANALENS_PUBLISHABLE_KEY
   pnpm install
   pnpm dev
   ```

4. Open `http://localhost:4321/` (project domain `localhost`) or
   `http://<name>.localhost:4321/`. Click **Wishlist on Steam**, send the
   newsletter form, then open the devlog and click between the posts. In the
   developer tools, `POST /v0/events` returns `202`. The SDK sends a batch
   every 5 seconds, when the page hides, and at once after `identify()`.

To check the production build: `pnpm build`, then `pnpm preview`.

## Run against a hosted endpoint

Set the two variables in your host (for example the Vercel or Netlify project
settings), build, and deploy on your project domain.

When the package is on npm, load the pinned jsDelivr file instead of
`/snippet.global.js`, and use the `integrity` value from the release notes:

```astro
<script
  is:inline
  src="https://cdn.jsdelivr.net/npm/@manalens/web@0.1.0/dist/snippet.global.js"
  integrity="sha384-HASH_FROM_THE_RELEASE_NOTES"
  crossorigin="anonymous"
  data-publishable-key={MANALENS_PUBLISHABLE_KEY}
  data-endpoint={MANALENS_ENDPOINT}
  data-auto-pageviews="false"
  defer
></script>
```

Change the version and the hash together.

## Page views with View Transitions

With `<ClientRouter />`, a link does not load a new page. Astro loads the
next page, swaps the content and the title, changes the URL, and then fires
`astro:page-load`. It fires `astro:page-load` also once on the first load,
and after **back** and **forward**.

The rule: **turn off the automatic page views with
`data-auto-pageviews="false"`, and call `page()` on every `astro:page-load`,
including the first.**

```js
document.addEventListener('astro:page-load', function () {
  if (window.manalens) window.manalens.page();
});
```

Why this gives exactly one page view per page, with the correct title:

- `astro:page-load` fires after the swap, so `page()` reads the title of the
  new page.
- The snippet sends no page view by itself, so nothing else counts the page.
- `page()` without properties sends nothing when the path and query are the
  same as the last page view. Do not call `page()` with properties here: a
  call with properties is always sent.

Put this script in the `<head>`, and register the listeners one time only.
The router keeps a head script that is the same on the next page, but runs
each `<body>` script again after a swap. A body script would add one more
listener on each navigation. For the same reason, the button and form
listeners in this example are on `document` (event delegation): they work
on the new content after a swap.

Pages without `<ClientRouter />` (the home page here) load a full page on
each link, and `astro:page-load` never fires there. The layout sends their
page view on the window `load` event instead (it checks for the
`astro-view-transitions-enabled` meta tag that `<ClientRouter />` adds).

Without `data-auto-pageviews="false"` the counts are also correct: the SDK
build in `vendor/` waits after back and forward until the
title changes, and `page()` skips the path it sent last. The rule above is
simpler, and it does not depend on that wait (at most 1 second).

## Hugo, Eleventy, Jekyll and other static site generators

Use the same script tag in the base layout of your site (for example
`layouts/_default/baseof.html` in Hugo, `_includes/base.njk` in Eleventy, or
`_layouts/default.html` in Jekyll). Put the values in the tag, or fill them in
from your site config. Each page loads the full page, so the snippet sends the
page view on load and you need nothing more. There is no separate example for
these generators.

## How the SDK is installed

The package is not on npm yet. `pnpm install` installs the built
copy from `../vendor/manalens-web-0.1.0.tgz`.
`scripts/snippet.mjs` (run by `pnpm dev` and `pnpm build`) copies its
`dist/snippet.global.js` to `public/snippet.global.js`. It fails when the
file hash is not `MANALENS_SNIPPET_INTEGRITY` in `src/config.ts`.

`pnpm check` checks the hash only. CI runs `pnpm build`. After an SDK update,
put the new value in `src/config.ts`.

TODO: change the dependency to `"@manalens/web": "^0.1.0"`
and use the jsDelivr URL in `src/config.ts`.

## Files

- `src/config.ts`: the key and endpoint from the environment, the SDK file
  path and its hash.
- `src/layouts/Base.astro`: the snippet tag, the View Transitions page views,
  the custom event and `identify()`.
- `src/pages/index.astro`: the home page (no View Transitions), the button and
  the newsletter form.
- `src/pages/devlog/`: the devlog list and posts, with `<ClientRouter />`.
- `scripts/snippet.mjs`: copies the SDK file and checks its hash.
