// @ts-check
// Main-process analytics for an Electron game. This module does not import
// Electron, so the smoke test (../../scripts/smoke.mjs) can run it in plain
// Node.js.
//
// - The Node SDK in app mode, with the Publishable key. NEVER a Secret key:
//   the SDK refuses one in app mode, and anyone who has the app can read it.
// - The same anonymous ID as the renderer's web SDK, so the main process and
//   the renderer count as one player.
// - app_unclean_exit: a "running" flag file that a normal quit removes.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Manalens } from '@manalens/node';

const FLAG_FILE = 'manalens-running.json';

/**
 * The app platform for `context.app.platform`, from Node's `process.platform`.
 * @param {NodeJS.Platform} platform
 * @returns {'macos' | 'windows' | 'linux' | 'other'}
 */
export function platformFromOS(platform) {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'other';
}

/**
 * @typedef {object} MainAnalyticsOptions
 * @property {string} publishableKey The project Publishable key (mana_pk_...).
 * @property {string} endpoint The collector URL, without /v0/events.
 * @property {string} userDataDir Where the running flag is kept (Electron: app.getPath('userData')).
 * @property {{ platform: 'windows' | 'macos' | 'linux' | 'web' | 'android' | 'ios' | 'other', storefront?: 'steam' | 'itch' | 'epic' | 'gog' | 'app_store' | 'play' | 'other', app_version?: string, build?: string, engine?: 'godot' | 'unity' | 'unreal' | 'other' }} app
 * @property {boolean} [debug]
 * @property {typeof fetch} [fetch] For tests.
 */

export class MainAnalytics {
  /** @param {MainAnalyticsOptions} options */
  constructor(options) {
    this.options = options;
    /** @type {Manalens | undefined} */
    this.client = undefined;
    this.flagPath = join(options.userDataDir, FLAG_FILE);
  }

  /**
   * Start with the renderer's anonymous ID (sent over IPC). Sends
   * app_unclean_exit when the last run did not quit normally, then
   * app_started, and sets the running flag for this run.
   * @param {string} anonymousId
   * @returns {{ sessionId: string | undefined, uncleanExit: boolean }}
   */
  start(anonymousId) {
    if (this.client) return { sessionId: this.client.getSessionId(), uncleanExit: false };
    const { publishableKey, endpoint, app, debug, fetch } = this.options;
    this.client = new Manalens(publishableKey, {
      endpoint,
      mode: 'app',
      app,
      anonymousId,
      debug,
      ...(fetch ? { fetch } : {}),
    });
    const previous = readFlag(this.flagPath);
    if (previous) {
      this.client.track({
        event: 'app_unclean_exit',
        properties: { previous_session_id: previous.session_id ?? null, previous_build: previous.build ?? null },
      });
    }
    this.client.track({ event: 'app_started' });
    // The SDK makes the session ID with the first event.
    const sessionId = this.client.getSessionId();
    mkdirSync(this.options.userDataDir, { recursive: true });
    writeFileSync(this.flagPath, JSON.stringify({ session_id: sessionId ?? null, build: app.build ?? null, started_at: new Date().toISOString() }));
    // Send now, so that a crash soon after start does not lose these events.
    void this.client.flush();
    return { sessionId, uncleanExit: Boolean(previous) };
  }

  /**
   * Track an event from the main process (for example an auto-update).
   * @param {string} event
   * @param {Record<string, string | number | boolean | null>} [properties]
   */
  track(event, properties) {
    this.client?.track({ event, ...(properties ? { properties } : {}) });
  }

  /**
   * A normal quit: send app_quit, send the queue for at most timeoutMs, and
   * remove the running flag.
   * @param {number} [timeoutMs]
   */
  async quit(timeoutMs = 2000) {
    if (this.client) {
      this.client.track({ event: 'app_quit' });
      await this.client.shutdown(timeoutMs);
    }
    rmSync(this.flagPath, { force: true });
  }
}

/**
 * @param {string} path
 * @returns {{ session_id?: string, build?: string } | undefined}
 */
function readFlag(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}
