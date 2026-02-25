function SectionHeader({ children }) {
  return (
    <h3 className="font-display tracking-[0.25em] text-compass uppercase text-xs mb-2 mt-5 first:mt-0
                   border-b border-exp-border pb-1">
      {children}
    </h3>
  );
}

export default function SectionOverview() {
  return (
    <div className="font-mono text-xs text-exp-text leading-relaxed space-y-1">
      <SectionHeader>Objective</SectionHeader>
      <p>
        You are one of 1&ndash;4 explorers stranded on a hex-grid planet.
        Explore tiles, gather <span className="text-compass">artifacts and relics</span>,
        manage your stats, and find a way to escape before the planet claims you.
      </p>

      <SectionHeader>Turn Flow</SectionHeader>
      <ol className="list-decimal list-inside space-y-1 pl-1">
        <li>
          <span className="text-exp-text-dim">Day Phase</span> &mdash;
          Each player chooses an action (Move, Dig, Rest, Help, Setup Camp, Break Down Camp)
          and submits it on-chain.
        </li>
        <li>
          <span className="text-exp-text-dim">Processing</span> &mdash;
          Actions are resolved using Chainlink VRF randomness. Cards are drawn,
          stats adjusted, and items gained or lost.
        </li>
        <li>
          <span className="text-exp-text-dim">Night Phase</span> &mdash;
          Environmental events occur. Day/night cycles continue until
          the expedition concludes.
        </li>
      </ol>

      <SectionHeader>Stats</SectionHeader>
      <p>
        Each explorer has three stats: <span className="text-compass">Movement</span> (tiles per turn),
        <span className="text-compass"> Agility</span> (evasion), and
        <span className="text-compass"> Dexterity</span> (crafting/digging).
        Stats change through card draws and rest actions.
      </p>
    </div>
  );
}
