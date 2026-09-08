import { useState } from 'react';

export default function ShareGameLink({ label = 'Copy game link' }) {
  const [status, setStatus] = useState('idle');

  const copy = async () => {
    if (typeof window === 'undefined') return;
    setStatus('idle');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const field = document.createElement('textarea');
        field.value = window.location.href;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('copy-unavailable');
      }
      setStatus('copied');
      window.setTimeout(() => setStatus('idle'), 1600);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={copy}
        className="min-h-11 rounded border border-blueprint/35 bg-blueprint/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint transition-colors hover:border-blueprint/60 hover:bg-blueprint/10"
      >
        {status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : label}
      </button>
      {status === 'error' && (
        <p role="status" className="mt-1 max-w-56 font-mono text-[10px] leading-relaxed text-signal-red">
          Copy was blocked. Select the address from your browser bar.
        </p>
      )}
    </div>
  );
}
