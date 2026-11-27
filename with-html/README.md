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

To load the SDK from the Manalens CDN, use the pinned URL and the
`integrity` value from the
[release notes](https://github.com/manalens/manalens-js/releases/tag/web-v0.5.0):

```html
<script
  src="https://cdn.manalens.dev/web@0.5.0"
  integrity="sha384-Qip2jzG2B+MR5a/+/sS+KIao4wZg0NemgALmFShR4yFW/A4wchaEZu8jdVcw1ITS"
  crossorigin="anonymous"
  data-publishable-key="YOUR_PUBLISHABLE_KEY"
  data-endpoint="https://YOUR_COLLECTOR_ENDPOINT"
  defer
></script>
```

Change the version and the hash together.

## How the SDK is installed

`pnpm install` installs `@manalens/web` (`^0.5.0`) from npm, and `serve.mjs` serves
its `dist/snippet.global.js` as `/snippet.global.js`.

`pnpm check` checks that the `integrity` value in each page matches that
file. CI runs it. After an SDK update, put the new value in both pages. It
is the same value as in the release notes of that version.
