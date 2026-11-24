// Sends one page view per React Router navigation. Mount it once, inside the
// router. For another router, use its location hook the same way.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnalytics } from './analytics';

export function AnalyticsTracker() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    getAnalytics()?.page();
  }, [pathname, search]);
  return null;
}
