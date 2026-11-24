import { createAnalytics, type Analytics } from '@manalens/web';

let instance: Analytics | undefined;

/**
 * One web SDK instance for the whole app, in the browser only. Automatic page
 * views are off: AnalyticsTracker sends a page view on each App Router
 * navigation. Returns undefined on the server and when the key is not set.
 */
export function getAnalytics(): Analytics | undefined {
  if (typeof window === 'undefined') return undefined;
  const publishableKey = process.env.NEXT_PUBLIC_MANALENS_PUBLISHABLE_KEY;
  const endpoint = process.env.NEXT_PUBLIC_MANALENS_ENDPOINT;
  if (!publishableKey || !endpoint) return undefined;
  return (instance ??= createAnalytics({ publishableKey, endpoint, autoPageviews: false }));
}
