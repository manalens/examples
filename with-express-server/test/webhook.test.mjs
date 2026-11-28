// @ts-check
// Tests for POST /webhooks/purchase. A fake analytics client records the
// tracked events, so no key and no collector are needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.mjs';

const purchase = { event_id: 'evt_1', user_id: 'player_123', amount_cents: 499, currency: 'USD', sku: 'dlc_harbor', store: 'web' };

/**
 * Start the app on a random local port and post one purchase webhook.
 * @param {string | undefined} webhookSecret
 * @param {Record<string, string>} [headers]
 */
async function postPurchase(webhookSecret, headers = {}) {
  /** @type {unknown[]} */
  const tracked = [];
  const analytics = /** @type {any} */ ({ track: (/** @type {unknown} */ event) => { tracked.push(event); } });
  const app = createApp({ analytics, webhookSecret });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/webhooks/purchase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(purchase),
    });
    return { status: res.status, tracked };
  } finally {
    server.close();
  }
}

test('an empty WEBHOOK_SECRET rejects a request with no header', async () => {
  const { status, tracked } = await postPurchase('');
  assert.equal(status, 401);
  assert.equal(tracked.length, 0);
});

test('an unset WEBHOOK_SECRET rejects a request with no header', async () => {
  const { status, tracked } = await postPurchase(undefined);
  assert.equal(status, 401);
  assert.equal(tracked.length, 0);
});

test('an empty WEBHOOK_SECRET rejects a request with an empty header', async () => {
  const { status, tracked } = await postPurchase('', { 'x-webhook-secret': '' });
  assert.equal(status, 401);
  assert.equal(tracked.length, 0);
});

test('a missing header gives 401', async () => {
  const { status, tracked } = await postPurchase('test-secret');
  assert.equal(status, 401);
  assert.equal(tracked.length, 0);
});

test('a wrong header gives 401', async () => {
  const { status, tracked } = await postPurchase('test-secret', { 'x-webhook-secret': 'wrong' });
  assert.equal(status, 401);
  assert.equal(tracked.length, 0);
});

test('the correct header sends the purchase event', async () => {
  const { status, tracked } = await postPurchase('test-secret', { 'x-webhook-secret': 'test-secret' });
  assert.equal(status, 204);
  assert.equal(tracked.length, 1);
  const event = /** @type {any} */ (tracked[0]);
  assert.equal(event.event, 'purchase');
  assert.equal(event.userId, 'player_123');
  assert.equal(event.properties.revenue, 4.99);
});
