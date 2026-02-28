import { useState } from 'react';
import SectionOverview from './SectionOverview';
import SectionActions from './SectionActions';
import SectionTerrain from './SectionTerrain';
import SectionHowTo from './SectionHowTo';

const TABS = [
  { key: 'overview', label: 'Overview', Component: SectionOverview },
  { key: 'actions', label: 'Actions', Component: SectionActions },
  { key: 'terrain', label: 'Terrain', Component: SectionTerrain },
  { key: 'howto', label: 'How to Play', Component: SectionHowTo },
];

export default function FieldManual() {
  const [activeTab, setActiveTab] = useState('overview');
  const Active = TABS.find((t) => t.key === activeTab)?.Component ?? SectionOverview;

  return (
    <div>
      {/* Header bar */}
      <div className="bg-exp-dark border-b border-exp-border px-5 py-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-[0.25em] text-compass uppercase">
            Field Manual
          </h2>
          <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
            Hexploration // Explorer Reference
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-5 pt-4 pb-2">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-3 py-1.5 text-xs font-mono uppercase tracking-wider
                border rounded transition-all duration-200
                ${isActive
                  ? 'text-compass bg-compass/10 border-compass/40'
                  : 'text-exp-text-dim bg-exp-dark/40 border-exp-border hover:text-exp-text hover:border-exp-text-dim/40'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        <Active />
      </div>
    </div>
  );
}
