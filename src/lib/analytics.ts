const gaMeasurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
let analyticsInitialized = false;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function canUseAnalytics(): boolean {
  return gaMeasurementId.length > 0 && typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function initGoogleAnalytics(): boolean {
  if (!canUseAnalytics()) {
    return false;
  }

  if (!document.querySelector(`script[data-ga-id="${gaMeasurementId}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
    script.setAttribute('data-ga-id', gaMeasurementId);
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }

  if (!analyticsInitialized) {
    window.gtag('js', new Date());
    window.gtag('config', gaMeasurementId, { send_page_view: false, anonymize_ip: true });
    analyticsInitialized = true;
  }

  return true;
}

export function trackPageView(path: string): void {
  if (!canUseAnalytics()) {
    return;
  }

  if (!analyticsInitialized && !initGoogleAnalytics()) {
    return;
  }

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title
  });
}
