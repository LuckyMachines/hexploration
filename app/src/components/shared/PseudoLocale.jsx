import { useEffect } from 'react';

// Pseudo-localisation helper. Activate with `?pseudo=1` on any URL. It walks
// the DOM, wraps text with visible ASCII markers, and pads by about 40 percent
// to approximate translation growth. This catches truncation and overflow bugs.

const PAD_LEFT = '[!! ';
const PAD_RIGHT = ' !!]';
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

function pseudoText(value) {
  const padBy = Math.max(2, Math.round(value.length * PAD_RATIO));
  return PAD_LEFT + value + '~'.repeat(padBy) + PAD_RIGHT;
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
    const originals = new Map();

    function walk(root) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n = w.nextNode();
      while (n) {
        if (!seen.has(n) && n.nodeValue && n.nodeValue.trim().length > 0 && !shouldSkip(n)) {
          originals.set(n, n.nodeValue);
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
              originals.set(node, node.nodeValue);
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
      for (const [node, original] of originals) {
        if (node.isConnected) node.nodeValue = original;
      }
      document.documentElement.classList.remove('xv-pseudo-locale');
    };
  }, []);

  return null;
}
