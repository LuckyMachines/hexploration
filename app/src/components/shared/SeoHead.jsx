import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoConfig } from '../../lib/seoConfig';
import { routeForLocation } from '../../lib/publicRoutes';
import { buildSeoMeta } from '../../lib/seoMeta';

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
}

function ensureLink(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
}

function ensureJsonLd(id, data) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

export default function SeoHead() {
  const location = useLocation();

  useEffect(() => {
    const config = getSeoConfig();
    const route = routeForLocation({ pathname: location.pathname, search: location.search });
    const meta = buildSeoMeta(route, config);

    document.title = meta.title;
    ensureMeta('meta[name="description"]', { name: 'description', content: meta.description });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: meta.robots });
    ensureLink('link[rel="canonical"]', { rel: 'canonical', href: meta.canonicalUrl });

    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: meta.openGraph.type });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: meta.openGraph.siteName });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: meta.openGraph.title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: meta.openGraph.description });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: meta.openGraph.url });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: meta.openGraph.image });
    ensureMeta('meta[property="og:locale"]', { property: 'og:locale', content: meta.openGraph.locale });

    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: meta.twitter.card });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: meta.twitter.title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: meta.twitter.description });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: meta.twitter.image });
    ensureJsonLd('xenovoya-jsonld', meta.jsonLd);
  }, [location.pathname, location.search]);

  return null;
}
