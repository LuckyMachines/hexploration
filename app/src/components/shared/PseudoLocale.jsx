import { useEffect } from 'react';

// Pseudo-localisation helper. Activate with `?pseudo=1` on any URL. Walks
// the DOM, wraps every text node with `ʟ` markers, and pads by ~40% to
// approximate German / Russian growth. Catches truncation and overflow
// bugs without needing real translations.

const PAD_LEFT = 'ʟ';
const PAD_RIGHT = 'ʟ';
const PAD_RATIO = 0.4;

const SKIP_SELECTOR = [
  'code',
  'kbd',
  'pre',
  '[data-no-pseudo]',
  '.font-mono',
  '[contenteditable]',
  'title',
  'script',
  'style',
].join(',');

function pseudoText(s) {
  const padBy = Math.max(2, Math.round(s.length * PAD_RATIO));
  return PAD_LEFT + s + '·'.repeat(padBy) + PAD_RIGHT;
}

function shouldSkip(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(SKIP_SELECTOR)) return true;
  return false;
}

export default function PseudoLocale() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pseudo') !== '1') return;

    const seen = new WeakSet();

    function walk(root) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n = w.nextNode();
      while (n) {
        if (!seen.has(n) && n.nodeValue && n.nodeValue.trim().length > 0 && !shouldSkip(n)) {
          n.nodeValue = pseudoText(n.nodeValue);
          seen.add(n);
        }
        n = w.nextNode();
      }
    }

    walk(document.body);

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (!seen.has(node) && node.nodeValue && node.nodeValue.trim() && !shouldSkip(node)) {
              node.nodeValue = pseudoText(node.nodeValue);
              seen.add(node);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walk(node);
          }
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    document.documentElement.classList.add('xv-pseudo-locale');

    return () => {
      obs.disconnect();
      document.documentElement.classList.remove('xv-pseudo-locale');
    };
  }, []);

  return null;
}
