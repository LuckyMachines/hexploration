import { useState } from 'react';

export default function ShareGameLink({ label = 'Copy game link' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded border border-blueprint/35 bg-blueprint/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint transition-colors hover:border-blueprint/60 hover:bg-blueprint/10"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

