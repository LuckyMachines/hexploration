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
    desc: 'Give 1 selected stat to another explorer on your tile. They restore 2 in that stat and 1 in both others, so a timely Help can pull a critical teammate out of collapse. Echo Field makes the rescue feel spatial when crew-risk is rising.',
  },
  {
    name: 'Depart',
    color: 'border-signal-red/40',
    desc: 'Leave from the landing site to end the expedition. Empty-handed departure saves the crew; recovered value determines how strong the outcome is. Depart is the clearest answer when the forecast already names value or crew at risk.',
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
