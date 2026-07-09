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
        Xenovoya is a Chart &amp; Depart expedition. You are one of 1&ndash;4
        explorers stranded on a hex-grid planet. Chart useful tiles, recover
        <span className="text-compass"> artifacts and relics</span>, protect
        the route home, and depart alive before the planet claims you.
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
          the survey concludes.
        </li>
      </ol>

      <SectionHeader>Depart Pressure</SectionHeader>
      <p>
        Depart Pressure measures how hard it is becoming to leave cleanly. Distance
        from landing, recovered value, weak stats, route mistakes, and late turns
        all push it upward. A strong run is not just more charting; it is knowing
        when the pressure says the map has given enough.
      </p>

      <SectionHeader>Escape Cost Preview</SectionHeader>
      <p>
        Escape Cost Preview turns pressure into a forecast. It shows whether
        departure looks clean, close, value-risky, crew-risky, or near route
        collapse. It is an at-risk signal, not a guaranteed result, so use it to
        decide what one more delay may cost.
      </p>

      <SectionHeader>Cost Reduction Actions</SectionHeader>
      <p>
        Every forecast has counterplay. The tablet lists the best reduction for
        the current warning: depart now, move home, recover value, rest, help, or
        stop digging before pressure turns the cost tier worse.
      </p>

      <SectionHeader>Tile Traits</SectionHeader>
      <p>
        Revealed tiles can carry traits such as Signal, Old Trail, Shelter,
        Cache, High Ground, Echo Field, Relic Vein, or Unstable Ground. Traits
        are route forecasts: they show what the tile tempts you to do and how
        that choice may affect pressure, escape cost, or crew recovery.
      </p>

      <SectionHeader>Turn Aftermath</SectionHeader>
      <p>
        After resolution, the client highlights the turn&apos;s strongest
        consequence: route progress, pressure spike, crew save, artifact payoff,
        trait warning, or clean opening. Read that moment before choosing the
        next action; it is the shortest answer to whether the crew can afford
        one more turn.
      </p>

      <SectionHeader>Expedition Arc</SectionHeader>
      <p>
        The Arc Track names the run chapter: Survey, Greed Window, Departure
        Window, Redline, or Final Call. Use it to understand whether the next
        choice is about learning the map, taking value, leaving cleanly, reducing
        a named cost, or making the run-defining call.
      </p>

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
