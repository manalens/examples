# with-paddle

A game store page that sells a soundtrack with **Paddle Billing**, and links
each payment to the player in Manalens.

## What it shows

Manalens records revenue from the Paddle **webhook** that you connect in
**Settings > Integrations > Paddle**. This app sends no revenue event. Its job
is to put **one opaque player ID** in two places:

| Where | How | File |
| --- | --- | --- |
| Manalens | `manalens.identify(playerId)` with the web SDK snippet | `public/index.html` |
| Paddle | `customData.user_id` in `Paddle.Checkout.open()` | `public/index.html` |

Then revenue shows by channel, campaign and player.

- **The player ID comes from the server.** Every visitor gets a random
  `player_...` ID in a signed cookie, as a stand-in for your own login, and
  the server puts it in the page.
- **Paddle.js runs in the browser**, so a player could change `customData`
  before the checkout opens. When a purchase must be tied to a verified
  account, create the transaction on your server with the Paddle API and the
  same `custom_data`, then open it with Paddle.js.
- **Never an email.** Use an opaque ID, the same one that your game and your
  website send.
- **The thanks page sends no purchase.** A player can open it without paying.
  The webhook is the record.
- `checkout_started` with `provider` is a funnel step, not revenue.

The webhook setup is in the guide
[How to connect Paddle](https://manalens.dev/integrations/paddle). For Stripe
Checkout, see [with-stripe](../with-stripe).

## Keys

| Key | Where | Public? |
| --- | --- | --- |
| Manalens **Publishable key** (`mana_pk_...`) | The page | Yes |
| Paddle **client-side token** | The page (Paddle.js needs it) | Yes |

A `test_...` token uses the Paddle sandbox. Manalens refuses sandbox keys, so
only a live Paddle Billing account records revenue. To check the whole path,
connect a live account, make a small real purchase and refund it.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |
| `PADDLE_CLIENT_TOKEN` | For checkout | Turns on the buy button. `test_...` uses the sandbox |
| `PADDLE_PRICE_ID` | For checkout | The Paddle price to sell, `pri_...` |
| `COOKIE_SECRET` | No | Signs the player cookie. Default: a new random secret on each start |
| `PORT` | No | Default `8091` |

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local worker.
2. Use a local project whose domain is `localhost` or `<name>.localhost`.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set the Manalens key and the Paddle token
   pnpm install
   pnpm start
   ```

4. Open `http://localhost:8091/`. The page sends a page view and `identify`
   with the player ID that it shows. Click **Buy with Paddle**.
5. In Manalens, connect Paddle under **Settings > Integrations**. After a live
   purchase, the payment shows in **Activity** and on the player profile with
   the same player ID.

## How the SDK is installed

`package.json` installs `@manalens/web` (`^0.5.0`) from npm, and the server
serves its `snippet.global.js`. On your own site, host the file yourself (see
[with-html](../with-html)).

## Files

- `src/app.mjs`: the routes and the player cookie.
- `src/server.mjs`: reads the environment and starts the server.
- `public/index.html`: the store page, `identify()` and Paddle.js.
- `public/thanks.html`: the success page.
