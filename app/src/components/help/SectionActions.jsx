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
    desc: 'Travel across the hex grid. Your Movement stat determines how many tiles you can traverse in a single turn. Build a path through adjacent tiles.',
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
    desc: 'Search the ground at your current tile for buried artifacts and relics. Success depends on your Dexterity stat and terrain type.',
  },
  {
    name: 'Rest',
    color: 'border-blueprint/40',
    desc: 'Recover one stat point in a chosen attribute (Movement, Agility, or Dexterity). Best done at a campsite for maximum effect.',
  },
  {
    name: 'Help',
    color: 'border-compass-bright/40',
    desc: 'Assist another player at your location by boosting one of their stats. Select a target player and the attribute to boost.',
  },
  {
    name: 'Flee',
    color: 'border-signal-red/40',
    desc: 'Attempt to escape the planet from the landing site. Only available when you have gathered enough artifacts and relics.',
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
