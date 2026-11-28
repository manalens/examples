# with-express-server

An Express server that sends server events with the Manalens
**Node SDK** in server mode.

- `POST /api/checkout`: a request from the player. It sends
  `checkout_started` with the player's IP (`req.ip`) and user agent as
  `context.ip` and `context.userAgent`. The collector uses the IP only for the
  country, in memory, and never stores it. It reads the device, OS and browser
  from the user agent.
- `POST /webhooks/purchase`: a webhook from a payment provider. It sends
  `purchase` with a numeric `revenue` property. It does **not** send the IP or
  the user agent, because they are the provider's, not the player's. The
  message ID comes from the provider's event ID, so a repeated webhook counts
  once. The request must send the `x-webhook-secret` header with the value of
  `WEBHOOK_SECRET`. A missing or wrong header gets `401`. When
  `WEBHOOK_SECRET` is empty, every webhook request gets `401`.

## Key: Secret key

This example needs the project **Secret key** (`mana_sk_...`).

> **Warning:** The Secret key is for your backend only. Keep it in an
> environment variable or a secret store. Never commit it, and never put it
> in a page, a game build or an Electron app. Anyone who has it can send
> server events to your project. A request from a browser with a Secret key
> gets `403`. If the key leaks, rotate it in **Settings > General >
> Credentials**.

Create the key in **Settings > General > Credentials > Create secret key**
(owner or admin, with MFA). It is shown once.

## Environment

| Variable | Required | Value |
| --- | --- | --- |
| `MANALENS_SECRET_KEY` | Yes | The Secret key, `mana_sk_...` |
| `MANALENS_ENDPOINT` | Yes | The collector URL without `/v0/events` |
| `WEBHOOK_SECRET` | Yes | The shared secret for `x-webhook-secret`. Empty rejects every webhook request. `.env.example` has a local test value |
| `PORT` | No | Default `3000` |
| `MANALENS_DEBUG` | No | `true` logs dropped events and failed requests |

## Run against the local stack

1. Start the Manalens API (`http://localhost:3101`) and the local
   worker from the main repository.
2. Copy the env file and set the Secret key of a local test project:

   ```bash
   cp .env.example .env
   ```

3. Install and start:

   ```bash
   pnpm install
   pnpm start
   ```

4. Send requests:

   ```bash
   curl -i -X POST http://localhost:3000/api/checkout \
     -H 'content-type: application/json' \
     -d '{"userId":"player_123","items":["sword"]}'

   curl -i -X POST http://localhost:3000/webhooks/purchase \
     -H 'content-type: application/json' \
     -H 'x-webhook-secret: local-test-secret-change-me' \
     -d '{"event_id":"evt_1","user_id":"player_123","amount_cents":499,"currency":"USD","sku":"dlc_harbor","store":"web"}'
   ```

   The webhook request sends the `WEBHOOK_SECRET` value of `.env.example`.
   If you change it in `.env`, change it in the command too.

5. Stop the server with Ctrl+C. It sends the queued events first
   (`analytics.shutdown()`). The events appear in **Activity** after a short
   delay.

## Run against a hosted endpoint

Set `MANALENS_ENDPOINT` to your collector URL and `MANALENS_SECRET_KEY` to the project's
Secret key, in your host's secret store. Behind a load balancer, set
`trust proxy` in `src/app.mjs` to the number of proxy hops, so that `req.ip`
is the client IP.

Set `WEBHOOK_SECRET` to a long random secret, also in the secret store. For
example: `openssl rand -hex 32`. Never use the value from `.env.example`.

The shared `x-webhook-secret` header only shows the idea. A real payment
provider webhook must check the provider's HMAC signature of the raw request
body instead (for example, the `Stripe-Signature` header of Stripe or the
`Paddle-Signature` header of Paddle), with the provider SDK or its documented
steps.

## How the SDK is installed

`package.json` installs the Node SDK from npm:

```json
"@manalens/node": "^0.2.1"
```

In your own project: `pnpm add @manalens/node`.

## Files

- `src/app.mjs`: the routes. It gets the analytics client as an argument, so
  the smoke test can pass its own.
- `src/server.mjs`: creates the client from the environment, starts the
  server, and calls `shutdown()` on exit.
- `test/webhook.test.mjs`: tests of the webhook secret check, with a fake
  analytics client. Run them with `pnpm test`.
