import { TILE_LABELS, TILE_COLORS, Tile } from '../../lib/constants';

function SectionHeader({ children }) {
  return (
    <h3 className="font-display tracking-[0.25em] text-compass uppercase text-xs mb-2 mt-5 first:mt-0
                   border-b border-exp-border pb-1">
      {children}
    </h3>
  );
}

const TERRAIN_INFO = [
  { tile: Tile.JUNGLE, desc: 'Dense vegetation. May slow movement but hides valuable artifacts.' },
  { tile: Tile.PLAINS, desc: 'Open grassland. Easy to traverse with moderate dig potential.' },
  { tile: Tile.DESERT, desc: 'Harsh arid terrain. May drain stats but contains buried treasures.' },
  { tile: Tile.MOUNTAIN, desc: 'Rocky highlands. Difficult to cross but rich in relics.' },
  { tile: Tile.LANDING, desc: 'Your ship\'s landing zone. The escape point for fleeing the planet.' },
  { tile: Tile.RELIC, desc: 'Ancient ruins. Guaranteed relic discovery but dangerous encounters.' },
];

export default function SectionTerrain() {
  return (
    <div className="font-mono text-xs text-exp-text leading-relaxed">
      <SectionHeader>Terrain Types</SectionHeader>
      <div className="space-y-2 mt-3">
        {TERRAIN_INFO.map(({ tile, desc }) => (
          <div key={tile} className="flex items-start gap-3 p-2 rounded bg-exp-dark/40 border border-exp-border">
            <div
              className="w-5 h-5 rounded shrink-0 mt-0.5"
              style={{ backgroundColor: TILE_COLORS[tile] }}
            />
            <div>
              <span className="font-display text-xs tracking-widest uppercase" style={{ color: TILE_COLORS[tile] }}>
                {TILE_LABELS[tile]}
              </span>
              <p className="text-exp-text-dim mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionHeader>Fog of War</SectionHeader>
      <p>
        Unexplored tiles are hidden under fog. Moving into a fog tile reveals its terrain type
        and any items or encounters present. Plan your exploration carefully.
      </p>
    </div>
  );
}
