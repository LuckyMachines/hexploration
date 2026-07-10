import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RUN_RELIC_CARD_SIZE,
  buildRunRelicCard,
  relicShareText,
  renderRunRelicSvg,
} from '../../lib/expeditionRelicCard';
import RunRelicCard from './RunRelicCard';

function browserOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function recordPathFor(memory = {}) {
  return memory.replayPath || memory.reportPath || '';
}

function downloadSvg(svg, filename) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function svgToPngBlob(svg) {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = url;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = RUN_RELIC_CARD_SIZE.width;
    canvas.height = RUN_RELIC_CARD_SIZE.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RunRelicSharePanel({ memory, challenge, title = 'Run Relic Card', compact = false }) {
  const [status, setStatus] = useState('');
  const card = useMemo(
    () => buildRunRelicCard({ memory, challenge, origin: browserOrigin() }),
    [challenge, memory],
  );
  const svg = useMemo(() => renderRunRelicSvg(card), [card]);
  const shareText = useMemo(() => relicShareText(card), [card]);
  const recordPath = recordPathFor(memory);

  if (!card) return null;

  async function copyText() {
    if (!navigator.clipboard) {
      setStatus('Text copy unavailable');
      return;
    }
    await navigator.clipboard.writeText(shareText);
    setStatus('Share text copied');
  }

  async function copyImage() {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      setStatus('Image copy unavailable');
      return;
    }
    const png = await svgToPngBlob(svg);
    if (!png) {
      setStatus('Image copy unavailable');
      return;
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    setStatus('Relic image copied');
  }

  function download() {
    downloadSvg(svg, card.filename);
    setStatus('Relic SVG downloaded');
  }

  const buttonClass = 'rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright hover:bg-compass/20';
  const secondaryClass = 'rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint hover:bg-blueprint/20';

  return (
    <section className="rounded border border-exp-border bg-exp-panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">{title}</p>
          <h2 className="mt-1 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">
            Share the expedition as a relic
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
            A completed run now has a visual trophy, a benchmark, and a replay link in one artifact.
          </p>
        </div>
        {status && (
          <span className="rounded border border-oxide-green/35 bg-oxide-green/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-oxide-green">
            {status}
          </span>
        )}
      </div>

      <div className={`grid gap-4 ${compact ? '' : 'lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1fr)]'}`}>
        <RunRelicCard card={card} compact={compact} />
        <div className="space-y-3">
          <div className="rounded border border-exp-border/70 bg-exp-dark/35 px-3 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Social Caption</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{shareText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyText} className={buttonClass}>
              Copy share text
            </button>
            <button type="button" onClick={copyImage} className={buttonClass}>
              Copy image
            </button>
            <button type="button" onClick={download} className={secondaryClass}>
              Download relic SVG
            </button>
            {recordPath && (/^https?:\/\//i.test(recordPath) ? (
              <a href={recordPath} className="rounded border border-exp-border bg-exp-dark/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                Open record
              </a>
            ) : (
              <Link to={recordPath} className="rounded border border-exp-border bg-exp-dark/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                Open record
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
