function SectionHeader({ children }) {
  return (
    <h3 className="font-display tracking-[0.25em] text-compass uppercase text-xs mb-2 mt-5 first:mt-0
                   border-b border-exp-border pb-1">
      {children}
    </h3>
  );
}

const ACTIONS = [
  {
    name: 'Move',
    color: 'border-compass/40',
    desc: 'Travel across the hex grid to chart new ground and keep the route home alive. Signal, Old Trail, and High Ground make route planning more readable, while Unstable Ground warns that the step may get expensive.',
  },
  {
    name: 'Setup Camp',
    color: 'border-oxide-green/40',
    desc: 'Establish a campsite at your current location. Campsites provide a safe resting point and can be used by any player.',
  },
  {
    name: 'Break Down Camp',
    color: 'border-oxide-green/40',
    desc: 'Pack up an existing campsite at your location, reclaiming it for future use elsewhere.',
  },
  {
    name: 'Dig',
    color: 'border-desert/40',
    desc: 'Search your current tile for artifacts and relics. Cache and Relic Vein can make Dig tempting, but Unstable Ground or greedy pressure can move the forecast from artifact risk to crew risk.',
  },
  {
    name: 'Rest',
    color: 'border-blueprint/40',
    desc: 'Recover one stat point so the crew can survive another turn, reach extraction, or reduce crew-risk pressure. Shelter turns Rest into a more legible board play.',
  },
  {
    name: 'Help',
    color: 'border-compass-bright/40',
    desc: 'Assist another explorer so a weak teammate does not become the visible cost of delay. Echo Field makes Help feel spatial when crew-risk is rising.',
  },
  {
    name: 'Flee',
    color: 'border-signal-red/40',
    desc: 'Escape from the landing site when the crew has recovered enough value. Flee is the strongest reduction when the forecast already names value or crew at risk, especially after route traits have shown the way home.',
  },
];

export default function SectionActions() {
  return (
    <div className="font-mono text-xs text-exp-text leading-relaxed">
      <SectionHeader>Available Actions</SectionHeader>
      <div className="space-y-3 mt-3">
        {ACTIONS.map((action) => (
          <div key={action.name} className={`border ${action.color} rounded p-3 bg-exp-dark/40`}>
            <h4 className="font-display text-xs tracking-widest uppercase text-compass mb-1">
              {action.name}
            </h4>
            <p className="text-exp-text-dim">{action.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
