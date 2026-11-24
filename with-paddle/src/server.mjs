// @ts-check
import { randomBytes } from 'node:crypto';
import { createApp } from './app.mjs';

const publishableKey = process.env.MANALENS_PUBLISHABLE_KEY ?? '';
const endpoint = process.env.MANALENS_ENDPOINT ?? '';
if (!publishableKey || !endpoint) {
  console.error('Set MANALENS_PUBLISHABLE_KEY and MANALENS_ENDPOINT (copy .env.example to .env).');
  process.exit(1);
}

const app = createApp({
  publishableKey,
  endpoint,
  // A new secret on each start signs out every player. Use a fixed secret
  // from your secret store in production.
  cookieSecret: process.env.COOKIE_SECRET || randomBytes(32).toString('hex'),
  paddleClientToken: process.env.PADDLE_CLIENT_TOKEN,
  paddlePriceId: process.env.PADDLE_PRICE_ID,
});

const port = Number(process.env.PORT || 8091);
app.listen(port, () => {
  console.log(`Open http://localhost:${port}/ (or http://<your project domain>:${port}/ for a *.localhost project domain)`);
  if (!process.env.PADDLE_CLIENT_TOKEN) console.log('Paddle is off: set PADDLE_CLIENT_TOKEN and PADDLE_PRICE_ID.');
});
