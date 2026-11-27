# with-stripe

A game store page that sells a soundtrack with **Stripe Checkout**, and links
each payment to the player in Manalens.

## What it shows

Manalens records revenue from the Stripe **webhook** that you connect in
**Settings > Integrations > Stripe**. This app sends no revenue event. Its job
is to put **one opaque player ID** in two places:

| Where | How | File |
| --- | --- | --- |
| Manalens | `manalens.identify(playerId)` with the web SDK snippet | `public/index.html` |
| Stripe | `metadata.user_id` and `client_reference_id` on the Checkout Session, set **on the server** | `src/app.mjs` |

Then revenue shows by channel, campaign and player.

- **The player ID comes from the server.** Every visitor gets a random
  `player_...` ID in a signed cookie, as a stand-in for your own login. The
  browser never sends the ID to `/api/stripe/checkout`, so a player cannot
  link a payment to someone else. (On a Stripe Payment Link, the buyer can
  change `client_reference_id` in the URL.)
- **Never an email.** Use an opaque ID, the same one that your game and your
  website send.
- **The thanks page sends no purchase.** A player can open it without paying.
  The webhook is the record.
- `checkout_started` with `provider` is a funnel step, not revenue.

The webhook setup is in the guide
[How to connect Stripe](https://manalens.dev/integrations/stripe). For Paddle
Billing, see [with-paddle](../with-paddle).

## Keys

| Key | Where | Public? |
| --- | --- | --- |
| Manalens **Publishable key** (`mana_pk_...`) | The page | Yes |
| Stripe **secret key** | The server only | **No** |

Manalens ignores Stripe test mode events. You can try the checkout with test
keys, but only a live account records revenue in Manalens. To check the whole
path, connect a live account, make a small real purchase and refund it.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `MANALENS_PUBLISHABLE_KEY` | Yes | The Publishable key, `mana_pk_...` |
| `MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |
| `STRIPE_SECRET_KEY` | For checkout | Turns on the buy button |
| `STRIPE_PRICE_ID` | For checkout | The Stripe Price to sell, `price_...` |
| `COOKIE_SECRET` | No | Signs the player cookie. Default: a new random secret on each start |
| `PORT` | No | Default `8090` |

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local worker.
2. Use a local project whose domain is `localhost` or `<name>.localhost`.
3. Configure, install and start:

   ```bash
   cp .env.example .env    # set the Manalens key and the Stripe keys
   pnpm install
   pnpm start
   ```

4. Open `http://localhost:8090/`. The page sends a page view and `identify`
   with the player ID that it shows. Click **Buy with Stripe**.
5. In Manalens, connect Stripe under **Settings > Integrations**. After a live
   purchase, the payment shows in **Activity** and on the player profile with
   the same player ID.

## How the SDK is installed

`package.json` installs `@manalens/web` (`^0.4.0`) from npm, and the server
serves its `snippet.global.js`. On your own site, host the file yourself (see
[with-html](../with-html)).

## Files

- `src/app.mjs`: the routes, the player cookie and the Checkout Session.
- `src/server.mjs`: reads the environment and starts the server.
- `public/index.html`: the store page and `identify()`.
- `public/thanks.html`: the success page.
