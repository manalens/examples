// Game events on top of the web SDK. The web SDK sends page views; it does not
// send game events for you. This module sends them with plain track() calls,
// with the names and properties of the event conventions:
// see "Event conventions" in the App and game events docs (sdks/app-events).
//
// game_open        is_first_open, first_open_at   each launch
// session_start                                    a launch, or input after 30 minutes idle
// session_end      duration_s                      page hide, or 30 minutes idle
// level_start      level, attempt
// level_complete   level, attempt, score
// level_fail       level, attempt, score
// error            severity, message, error_type, handled, fingerprint

/** The part of the web SDK that this module uses. */
export interface Tracker {
  track(event: string, properties?: Record<string, string | number | boolean | null>): void;
  flush(keepalive?: boolean): Promise<void>;
}

const IDLE_MS = 30 * 60 * 1000;
const FIRST_OPEN_KEY = 'cube_catch_first_open_at';

export class GameAnalytics {
  private sessionStartedAt: number | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly analytics: Tracker) {}

  /** Call once at launch: game_open, then session_start. */
  open(): void {
    let firstOpenAt: string | null = null;
    try {
      firstOpenAt = localStorage.getItem(FIRST_OPEN_KEY);
      if (!firstOpenAt) localStorage.setItem(FIRST_OPEN_KEY, new Date().toISOString());
    } catch {
      // Storage can be blocked (private mode). Then every launch is a first open.
    }
    this.analytics.track('game_open', {
      is_first_open: !firstOpenAt,
      first_open_at: firstOpenAt ?? new Date().toISOString(),
    });
    this.startSession();

    // The tab closes or goes to the background for good: end the session.
    window.addEventListener('pagehide', () => this.endSession(true));
    // Uncaught errors become error events. Keep personal data out of message.
    window.addEventListener('error', event => this.error(event.error ?? event.message, { handled: false, error_type: 'uncaught' }));
    window.addEventListener('unhandledrejection', event => this.error(event.reason, { handled: false, error_type: 'unhandled_rejection' }));
  }

  /** Call on player input. Starts a new session after 30 minutes idle. */
  activity(): void {
    if (this.sessionStartedAt === undefined) this.startSession();
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.endSession(false), IDLE_MS);
  }

  levelStart(level: number, attempt: number): void {
    this.analytics.track('level_start', { level, attempt });
  }

  levelComplete(level: number, attempt: number, score: number): void {
    this.analytics.track('level_complete', { level, attempt, score });
  }

  levelFail(level: number, attempt: number, score: number): void {
    this.analytics.track('level_fail', { level, attempt, score });
  }

  error(error: unknown, options: { handled: boolean; error_type?: string; severity?: 'warning' | 'error' | 'critical' }): void {
    const message = error instanceof Error ? error.message : String(error);
    const errorType = options.error_type ?? (error instanceof Error ? error.name : 'Error');
    this.analytics.track('error', {
      severity: options.severity ?? 'error',
      message: message.slice(0, 200),
      error_type: errorType,
      handled: options.handled,
      // Groups the same error together in reports.
      fingerprint: `${errorType}:${message.slice(0, 80)}`,
    });
  }

  private startSession(): void {
    this.sessionStartedAt = Date.now();
    this.analytics.track('session_start');
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.endSession(false), IDLE_MS);
  }

  private endSession(pageHide: boolean): void {
    if (this.sessionStartedAt === undefined) return;
    const duration = Math.round((Date.now() - this.sessionStartedAt) / 1000);
    this.sessionStartedAt = undefined;
    clearTimeout(this.idleTimer);
    this.analytics.track('session_end', { duration_s: duration });
    // keepalive lets the request finish while the page unloads.
    void this.analytics.flush(pageHide);
  }
}
