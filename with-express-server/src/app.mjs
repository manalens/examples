// @ts-check
import { createHash, timingSafeEqual } from 'node:crypto';
import express from 'express';

/**
 * The Express app. It gets the analytics client from the caller, so that
 * server.mjs and the smoke test (../scripts/smoke.mjs) can each pass their own.
 *
 * @param {object} deps
 * @param {import('@manalens/node').Manalens} deps.analytics
 * @param {string} [deps.webhookSecret] the shared secret of the purchase webhook
 */
export function createApp({ analytics, webhookSecret = '' }) {
  const app = express();
  // req.ip is the client IP only when Express trusts the proxy in front of it.
  // 'loopback' trusts a proxy on this machine. Behind a load balancer, set the
  // number of proxy hops instead (for example 1). See the Express docs.
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // A player's own request (from your website or your game). The IP and the
  // user agent are the player's, so pass them as context. The collector uses
  // the IP only for the country, in memory, and never stores it. It reads the
  // device, OS and browser from the user agent.
  app.post('/api/checkout', (req, res) => {
    const { userId, anonymousId, items } = req.body ?? {};
    if (!isId(userId) && !isId(anonymousId)) {
      res.status(400).json({ error: 'userId or anonymousId is required' });
      return;
    }
    analytics.track({
      event: 'checkout_started',
      ...(isId(userId) ? { userId } : {}),
      // Optional: the browser's analytics.getAnonymousId(), or the game's
      // anonymous ID. It joins this server event to that device.
      ...(isId(anonymousId) ? { anonymousId } : {}),
      properties: { items: Array.isArray(items) ? items.length : 0 },
      context: { ip: req.ip, userAgent: req.get('user-agent') },
    });
    res.sendStatus(204);
  });

  // A webhook from a payment provider. The request comes from the provider,
  // not from the player, so do NOT send req.ip or the user agent here: they
  // would give the provider's country and device to the player.
  app.post('/webhooks/purchase', (req, res) => {
    if (webhookSecret && !sameSecret(req.get('x-webhook-secret') ?? '', webhookSecret)) {
      res.sendStatus(401);
      return;
    }
    const { event_id: eventId, user_id: userId, anonymous_id: anonymousId, amount_cents: amountCents, currency, sku, store } = req.body ?? {};
    if (typeof eventId !== 'string' || !eventId || !isId(userId) || !Number.isInteger(amountCents) || amountCents < 0) {
      res.status(400).json({ error: 'event_id, user_id and an integer amount_cents are required' });
      return;
    }
    analytics.track({
      event: 'purchase',
      userId,
      ...(isId(anonymousId) ? { anonymousId } : {}),
      // A fixed message ID per provider event: when the provider sends the
      // same webhook again, reports count the purchase once.
      messageId: uuidFrom(`purchase:${eventId}`),
      properties: {
        amount_cents: amountCents,
        currency: typeof currency === 'string' ? currency : 'USD',
        store: typeof store === 'string' ? store : 'web',
        sku: typeof sku === 'string' ? sku : null,
        // A numeric `revenue` property counts in the Revenue metric.
        revenue: amountCents / 100,
      },
    });
    res.sendStatus(204);
  });

  return app;
}

/** @param {unknown} value */
function isId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255;
}

/**
 * Compare two secrets in constant time.
 * @param {string} given
 * @param {string} expected
 */
function sameSecret(given, expected) {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * A stable UUID (version 8, RFC 9562) made from a string.
 * @param {string} value
 */
export function uuidFrom(value) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '8';
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
