'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getAnalytics } from '../lib/analytics';

/**
 * Sends a page view on the first load and on each App Router navigation.
 * Mount it once in the root layout, inside <Suspense> (useSearchParams needs it).
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    getAnalytics()?.page();
  }, [pathname, search]);
  return null;
}
