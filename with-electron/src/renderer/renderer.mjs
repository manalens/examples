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
  // Game mode: the SDK sends session_start, game_open (is_first_open,
  // first_open_at), session_end, and an error event for each uncaught error
  // or unhandled rejection (source "auto"). Unsent events wait in IndexedDB
  // for the next start.
  game: true,
});

// The main process uses the same anonymous ID (Node SDK in app mode).
const anonymousId = analytics.getAnonymousId();
if (anonymousId) {
  const main = await window.game.setAnonymousId(anonymousId);
  const ids = document.getElementById('ids');
  if (ids) ids.textContent = `anonymous_id ${anonymousId}\nmain session_id ${main?.sessionId ?? ''}\nlast run crashed: ${main?.crashed ?? false}`;
}

/** Called by the main process before a normal quit. */
window.gameQuit = async () => {
  // The SDK ends the game session on pagehide. Electron quits before the page
  // hides, so send that event now: it queues session_end. Then send the queue.
  window.dispatchEvent(new Event('pagehide'));
  await analytics.flush();
};

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
  // An uncaught error: game mode sends it as an error event (handled false).
  setTimeout(() => { throw new Error('Example error from the renderer'); });
});
onClick('handled-error', () => {
  // A handled error: trackError() sends it with source "manual".
  try {
    throw new Error('Save failed');
  } catch (error) {
    analytics.trackError(error, { errorType: 'SaveFailed', properties: { slot: 1 } });
  }
});
onClick('crash', async () => {
  await analytics.flush();
  await window.game.simulateCrash();
});
