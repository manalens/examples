// @ts-check
// A game store page that sells a soundtrack with Stripe Checkout or Paddle
// Billing, and links each payment to the player in Manalens.
//
// The rule: use ONE opaque player ID everywhere.
//   - The page calls manalens.identify(playerId) with the web SDK.
//   - Stripe: the server creates the Checkout Session with
//     metadata.user_id = playerId (and client_reference_id).
//   - Paddle: Paddle.Checkout.open() gets customData.user_id = playerId.
// Manalens reads the payment from the Stripe or Paddle webhook that you
// connect in Settings > Integrations, and joins it to the player by that ID.
// This app sends no revenue event itself.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';

const snippet = readFileSync(fileURLToPath(import.meta.resolve('@manalens/web/snippet')));
const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const thanks = readFileSync(new URL('../public/thanks.html', import.meta.url), 'utf8');
const escapeAttr = (/** @type {string} */ value) => value.replace(/[&"<>]/g, c => `&#${c.charCodeAt(0)};`);

/**
 * @param {object} config
 * @param {string} config.publishableKey The Manalens Publishable key (public).
 * @param {string} config.endpoint The collector URL, without /v0/events.
 * @param {string} config.cookieSecret Signs the player cookie.
 * @param {import('stripe').Stripe} [config.stripe] A Stripe client, or undefined to turn Stripe off.
 * @param {string} [config.stripePriceId]
 * @param {string} [config.paddleClientToken] Public: Paddle.js needs it in the page.
 * @param {string} [config.paddlePriceId]
 */
export function createApp(config) {
  const app = express();
  app.use(cookieParser(config.cookieSecret));

  // The signed-in player. In your game, this is your own login session or
  // account ID. Here every visitor gets an opaque player ID in a signed
  // cookie, so the browser cannot choose the ID that a payment is linked to.
  app.use((req, res, next) => {
    let playerId = req.signedCookies.player_id;
    if (typeof playerId !== 'string' || !/^player_[a-f0-9]{12}$/.test(playerId)) {
      playerId = `player_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
      res.cookie('player_id', playerId, { signed: true, httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
    }
    res.locals.playerId = playerId;
    next();
  });

  app.get('/snippet.global.js', (_req, res) => {
    res.type('text/javascript').set('cache-control', 'no-cache').send(snippet);
  });

  app.get('/', (_req, res) => {
    const values = {
      MANALENS_PUBLISHABLE_KEY: config.publishableKey,
      MANALENS_ENDPOINT: config.endpoint,
      PLAYER_ID: res.locals.playerId,
      STRIPE_ENABLED: config.stripe && config.stripePriceId ? 'true' : 'false',
      PADDLE_CLIENT_TOKEN: config.paddleClientToken ?? '',
      PADDLE_PRICE_ID: config.paddlePriceId ?? '',
    };
    let html = page;
    for (const [name, value] of Object.entries(values)) html = html.replaceAll(`%${name}%`, escapeAttr(value));
    res.type('html').send(html);
  });

  app.get('/thanks', (_req, res) => {
    res.type('html').send(thanks.replaceAll('%MANALENS_PUBLISHABLE_KEY%', escapeAttr(config.publishableKey)).replaceAll('%MANALENS_ENDPOINT%', escapeAttr(config.endpoint)));
  });

  // Stripe: create the Checkout Session on the server, with the player ID from
  // the server session. On a Payment Link, the buyer can change
  // client_reference_id in the URL; here the browser never sends the ID.
  app.post('/api/stripe/checkout', async (req, res) => {
    if (!config.stripe || !config.stripePriceId) {
      res.status(501).json({ error: 'Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID' });
      return;
    }
    const playerId = res.locals.playerId;
    const origin = `${req.protocol}://${req.get('host')}`;
    try {
      const session = await config.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: config.stripePriceId, quantity: 1 }],
        // Manalens reads metadata.user_id first, then client_reference_id.
        metadata: { user_id: playerId },
        client_reference_id: playerId,
        success_url: `${origin}/thanks?provider=stripe`,
        cancel_url: `${origin}/`,
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error('Stripe Checkout failed:', error instanceof Error ? error.message : error);
      res.status(502).json({ error: 'Stripe Checkout failed' });
    }
  });

  return app;
}
