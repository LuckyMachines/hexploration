const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const PLAUSIBLE_HOST = String(ENV.VITE_PLAUSIBLE_HOST || '').replace(/\/$/, '');
const PLAUSIBLE_DOMAIN = String(ENV.VITE_PLAUSIBLE_DOMAIN || '');
let ready = false;

export function analyticsEnabled() { return Boolean(PLAUSIBLE_HOST && PLAUSIBLE_DOMAIN && typeof document !== 'undefined'); }

export function initAnalytics() {
  if (!analyticsEnabled() || ready || document.querySelector('script[data-xenovoya-plausible]')) return;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = PLAUSIBLE_DOMAIN;
  script.dataset.api = `${PLAUSIBLE_HOST}/api/event`;
  script.dataset.xenovoyaPlausible = 'true';
  script.src = `${PLAUSIBLE_HOST}/js/script.manual.js`;
  script.onload = () => { ready = true; };
  document.head.appendChild(script);
}

export function trackRetentionEvent(name, props = {}) {
  if (!analyticsEnabled() || typeof window === 'undefined') return false;
  const safeProps = Object.fromEntries(Object.entries(props).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)));
  const plausible = window.plausible;
  if (typeof plausible !== 'function') return false;
  plausible(name, { props: safeProps });
  return true;
}
