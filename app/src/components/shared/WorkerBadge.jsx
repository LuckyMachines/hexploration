import { useWorkerStatus } from '../../hooks/useWorkerStatus';

export default function WorkerBadge() {
  const { mockVRFActive, pendingRequests, isLoading } = useWorkerStatus();

  if (isLoading) return null;

  if (!mockVRFActive) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
        <span className="inline-block w-2 h-2 rounded-full bg-signal-red shadow-[0_0_4px_var(--color-signal-red)]" />
        <span className="tracking-wider uppercase">VRF Offline</span>
      </div>
    );
  }

  if (pendingRequests > 0) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
        <span className="inline-block w-2 h-2 rounded-full bg-compass shadow-[0_0_4px_var(--color-compass)] animate-pulse" />
        <span className="tracking-wider uppercase">
          Processing ({pendingRequests} pending)
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
      <span className="inline-block w-2 h-2 rounded-full bg-oxide-green shadow-[0_0_4px_var(--color-oxide-green)]" />
      <span className="tracking-wider uppercase">Automation Active</span>
    </div>
  );
}
