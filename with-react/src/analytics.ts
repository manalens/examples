// One browser-only SDK instance for the whole app.
//
// autoPageviews is false because <AnalyticsTracker> owns page tracking: it
// calls page() after each React Router navigation. The getter reuses one
// instance, so React's development double effects do not create a second one.
import { createAnalytics } from '@manalens/web';

const publishableKey = import.meta.env.VITE_MANALENS_PUBLISHABLE_KEY as string | undefined;
const endpoint = import.meta.env.VITE_MANALENS_ENDPOINT as string | undefined;

let instance: ReturnType<typeof createAnalytics> | undefined;
let warned = false;

export function getAnalytics() {
  if (typeof window === 'undefined') return undefined;
  // Without a key (for example in CI) the site runs and sends nothing.
  if (!publishableKey || !endpoint) {
    if (!warned) console.warn('Set VITE_MANALENS_PUBLISHABLE_KEY and VITE_MANALENS_ENDPOINT in .env. No events are sent.');
    warned = true;
    return undefined;
  }
  return (instance ??= createAnalytics({ publishableKey, endpoint, autoPageviews: false }));
}
