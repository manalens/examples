// @ts-check
// The renderer: the web SDK with the `app` option. Every event is a web event
// (channel "web", with context.page) that also carries context.app.

// The web SDK build, served by the main process from node_modules. With a
// bundler, write: import { createAnalytics } from '@manalens/web';
const sdkUrl = '/lib/manalens-web/index.js';
const { createAnalytics } = /** @type {typeof import('@manalens/web')} */ (await import(sdkUrl));

const config = await window.game.config();
const analytics = createAnalytics({
  publishableKey: config.publishableKey,
  endpoint: config.endpoint,
  // platform comes from the OS (main process): macos, windows or linux.
  app: config.app,
});

// The main process uses the same anonymous ID (Node SDK in app mode).
const anonymousId = analytics.getAnonymousId();
if (anonymousId) {
  const main = await window.game.setAnonymousId(anonymousId);
  const ids = document.getElementById('ids');
  if (ids) ids.textContent = `anonymous_id ${anonymousId}\nmain session_id ${main?.sessionId ?? ''}\nlast run crashed: ${main?.uncleanExit ?? false}`;
}

// game_open: each launch.
const firstOpenAt = localStorage.getItem('first_open_at');
if (!firstOpenAt) localStorage.setItem('first_open_at', new Date().toISOString());
analytics.track('game_open', { is_first_open: !firstOpenAt, first_open_at: firstOpenAt ?? localStorage.getItem('first_open_at') });

// session_start / session_end.
const sessionStart = Date.now();
analytics.track('session_start');

/** Called by the main process before a normal quit. */
window.gameQuit = async () => {
  analytics.track('session_end', { duration_s: Math.round((Date.now() - sessionStart) / 1000) });
  await analytics.flush();
};

// Uncaught errors become error events. Do not put personal data in message.
window.addEventListener('error', event => {
  analytics.track('error', { severity: 'error', message: String(event.message).slice(0, 200), error_type: 'uncaught', handled: false });
});

let level = 1;
let attempt = 1;
const levelLabel = /** @type {HTMLElement} */ (document.getElementById('level'));
analytics.track('level_start', { level, attempt });

/** @param {string} id @param {() => void} handler */
const onClick = (id, handler) => document.getElementById(id)?.addEventListener('click', handler);

onClick('complete', () => {
  analytics.track('level_complete', { level, attempt, score: 100 * level });
  level += 1;
  attempt = 1;
  levelLabel.textContent = String(level);
  analytics.track('level_start', { level, attempt });
});
onClick('fail', () => {
  analytics.track('level_fail', { level, attempt, score: 0 });
  attempt += 1;
  analytics.track('level_start', { level, attempt });
});
onClick('error', () => {
  setTimeout(() => { throw new Error('Example error from the renderer'); });
});
onClick('crash', async () => {
  await analytics.flush();
  await window.game.simulateCrash();
});
