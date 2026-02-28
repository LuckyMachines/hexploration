import GameBrowser from '../components/game/GameBrowser';
import SystemHealth from '../components/shared/SystemHealth';

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-widest text-compass uppercase mb-2 font-display">
        Expedition Console
      </h1>
      <p className="text-exp-text-dim font-mono text-sm mb-8">
        Select an expedition or launch a new one
      </p>
      <SystemHealth />
      <GameBrowser />
    </div>
  );
}
