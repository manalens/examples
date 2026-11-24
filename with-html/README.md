# with-html

A static HTML page with the Manalens **web SDK snippet**: one
`<script>` tag, no build step.

- The snippet sends a page view on load (`index.html` and `pricing.html`).
- The **Sign up** button sends a custom event,
  `window.manalens.track('signup_clicked', ...)`.
- The tag has `integrity` and `crossorigin="anonymous"` (Subresource
  Integrity). The browser refuses the SDK file if its bytes change.

```html
<script
  src="/snippet.global.js"
  integrity="sha384-..."
  crossorigin="anonymous"
  data-publishable-key="YOUR_PUBLISHABLE_KEY"
  data-endpoint="https://YOUR_COLLECTOR_ENDPOINT"
  defer
></script>
```

## Key: Publishable key

This example needs the project **Publishable key** (`mana_pk_...`). It is public
and safe in a page. Never put a Secret key or an API key in a page.

## Environment

`serve.mjs` fills in `%MANALENS_PUBLISHABLE_KEY%` and `%MANALENS_ENDPOINT%` in the pages.
On your own site, write the values in the tag.

| Variable | Required | Value |
| --- | --- | --- |
| `MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |
| `PORT` | No | Default `8080` |

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker.
2. Use a local project whose domain is `localhost` or `<name>.localhost`.
   The collector accepts a web event only from a page on the project domain.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set MANALENS_PUBLISHABLE_KEY
   pnpm install
   pnpm start
   ```

4. Open `http://localhost:8080/` (project domain `localhost`) or
   `http://<name>.localhost:8080/`. Click **Sign up**, then open the pricing
   page. In the developer tools, `POST /v0/events` returns `202`.

## Run against a hosted endpoint

Set `MANALENS_ENDPOINT` to your collector URL. Serve the page from your project
domain (or a subdomain). On a real site you do not need `serve.mjs`: copy the
`<script>` tag into the `<head>` of every page.

When the package is on npm, use the pinned jsDelivr URL and the
`integrity` value from the release notes:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@manalens/web@0.1.0/dist/snippet.global.js"
  integrity="sha384-HASH_FROM_THE_RELEASE_NOTES"
  crossorigin="anonymous"
  data-publishable-key="YOUR_PUBLISHABLE_KEY"
  data-endpoint="https://YOUR_COLLECTOR_ENDPOINT"
  defer
></script>
```

Change the version and the hash together.

## How the SDK is installed

The package is not on npm yet. `pnpm install` installs the built
copy from `../vendor/manalens-web-0.1.0.tgz`, and `serve.mjs` serves
its `dist/snippet.global.js` as `/snippet.global.js`.

`pnpm check` checks that the `integrity` value in each page matches that
file. CI runs it. After an SDK update, put the new value in both pages.

TODO: change the dependency to `"@manalens/web": "^0.1.0"`
and show the jsDelivr tag in the pages.
