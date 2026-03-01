import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGoogleAnalytics, trackPageView } from '../lib/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(fullPath);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
