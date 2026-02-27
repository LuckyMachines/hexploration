import { useAutomationStatus } from '../../hooks/useAutomationStatus';

export default function AutomationStatus() {
  const { mode, pendingRequests, isLoading } = useAutomationStatus();

  if (isLoading) return null;

  if (mode === 'mock') {
    if (pendingRequests > 0) {
      return (
        <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
          <span className="inline-block w-2 h-2 rounded-full bg-compass shadow-[0_0_4px_var(--color-compass)] animate-pulse" />
          <span className="tracking-wider uppercase">
            Mock VRF Processing ({pendingRequests})
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
        <span className="inline-block w-2 h-2 rounded-full bg-oxide-green shadow-[0_0_4px_var(--color-oxide-green)]" />
        <span className="tracking-wider uppercase">Mock VRF Active</span>
      </div>
    );
  }

  if (mode === 'external-queue') {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
        <span className="inline-block w-2 h-2 rounded-full bg-oxide-green shadow-[0_0_4px_var(--color-oxide-green)]" />
        <span className="tracking-wider uppercase">External Queue VRF Active</span>
      </div>
    );
  }

  if (mode === 'external') {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
        <span className="inline-block w-2 h-2 rounded-full bg-oxide-green shadow-[0_0_4px_var(--color-oxide-green)]" />
        <span className="tracking-wider uppercase">External VRF Active</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
      <span className="inline-block w-2 h-2 rounded-full bg-signal-red shadow-[0_0_4px_var(--color-signal-red)]" />
      <span className="tracking-wider uppercase">VRF Config Mismatch</span>
    </div>
  );
}
