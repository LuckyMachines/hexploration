import GameBrowser from './GameBrowser';
import SystemHealth from '../shared/SystemHealth';
import SocialHub from '../social/SocialHub';

export default function LiveClientStack({ crewOpen = false, onCrewToggle = () => {} }) {
  return (
    <div className="space-y-4">
      <GameBrowser />
      <details
        id="crew-network"
        tabIndex={-1}
        data-testid="crew-network-details"
        open={crewOpen}
        onToggle={(event) => onCrewToggle(event.currentTarget.open)}
        className="scroll-mt-24 rounded border border-blueprint/30 bg-exp-panel"
      >
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4 font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
          <span>Crew, parties, and friends</span>
          <span className="text-blueprint">Connect to manage</span>
        </summary>
        <div className="border-t border-exp-border p-4">
          <SocialHub />
        </div>
      </details>
      <details data-testid="system-health-details" className="rounded border border-exp-border bg-exp-panel">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4 font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
          <span>Network and contract status</span>
          <span className="text-exp-text-dim">Inspect</span>
        </summary>
        <div className="border-t border-exp-border p-4">
          <SystemHealth />
        </div>
      </details>
    </div>
  );
}
