import { Tile } from './constants';

// Small SVG icons for each terrain type, rendered inside hex tiles
function JungleIcon(props) {
  return (
    <g {...props}>
      <path d="M0,-6 L2,-2 L1,-2 L3,2 L2,2 L4,6 L-4,6 L-2,2 L-3,2 L-1,-2 L-2,-2 Z"
            fill="currentColor" opacity="0.6" />
    </g>
  );
}

function PlainsIcon(props) {
  return (
    <g {...props}>
      <path d="M-5,3 Q-2,-2 0,1 Q2,-3 5,2" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <line x1="-4" y1="5" x2="4" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </g>
  );
}

function DesertIcon(props) {
  return (
    <g {...props}>
      <path d="M-5,4 Q-2,0 0,3 Q2,-1 5,3" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="3" cy="-3" r="2" fill="currentColor" opacity="0.4" />
    </g>
  );
}

function MountainIcon(props) {
  return (
    <g {...props}>
      <path d="M-5,5 L-1,-4 L0,-2 L1,-4 L5,5 Z" fill="currentColor" opacity="0.5" />
    </g>
  );
}

function LandingIcon(props) {
  return (
    <g {...props}>
      <path d="M0,-5 L2,-1 L5,0 L2,1 L0,5 L-2,1 L-5,0 L-2,-1 Z" fill="currentColor" opacity="0.6" />
    </g>
  );
}

function RelicIcon(props) {
  return (
    <g {...props}>
      <rect x="-3" y="-5" width="6" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      <circle cx="0" cy="-1" r="1.5" fill="currentColor" opacity="0.5" />
      <line x1="-2" y1="4" x2="2" y2="4" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </g>
  );
}

export const TERRAIN_ICONS = {
  [Tile.JUNGLE]: JungleIcon,
  [Tile.PLAINS]: PlainsIcon,
  [Tile.DESERT]: DesertIcon,
  [Tile.MOUNTAIN]: MountainIcon,
  [Tile.LANDING]: LandingIcon,
  [Tile.RELIC]: RelicIcon,
};
