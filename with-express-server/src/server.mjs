// @ts-check
import { Manalens } from '@manalens/node';
import { createApp } from './app.mjs';

const secretKey = process.env.MANALENS_SECRET_KEY;
const endpoint = process.env.MANALENS_ENDPOINT;
if (!secretKey || !endpoint) {
  console.error('Set MANALENS_SECRET_KEY and MANALENS_ENDPOINT (copy .env.example to .env).');
  process.exit(1);
}

// Server mode is the default. The SDK refuses a Publishable key here, and it
// checks the length and checksum of the Secret key at startup.
const analytics = new Manalens(secretKey, {
  endpoint,
  debug: process.env.MANALENS_DEBUG === 'true',
});

const app = createApp({ analytics, webhookSecret: process.env.WEBHOOK_SECRET });
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});

// The SDK adds no exit hooks. Send the queued events before the process exits.
async function stop() {
  server.close();
  await analytics.shutdown();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
