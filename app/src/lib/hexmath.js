// Flat-top hexagonal grid geometry
// Zone aliases are "x,y" strings (0-indexed)

const HEX_SIZE = 30; // radius of circumscribed circle
const SQRT3 = Math.sqrt(3);

// Flat-top hex: width = 2*size, height = sqrt(3)*size
export const HEX_WIDTH = HEX_SIZE * 2;
export const HEX_HEIGHT = HEX_SIZE * SQRT3;

// Convert column,row to pixel center (flat-top, offset coordinates)
// Even columns are shifted down
export function hexToPixel(col, row) {
  const x = col * (HEX_SIZE * 1.5);
  const y = row * HEX_HEIGHT + (col % 2 === 1 ? HEX_HEIGHT / 2 : 0);
  return { x, y };
}

// Parse a zone alias "col,row" to {col, row}
export function parseAlias(alias) {
  if (!alias || typeof alias !== 'string') return null;
  const parts = alias.split(',');
  if (parts.length !== 2) return null;
  return { col: parseInt(parts[0], 10), row: parseInt(parts[1], 10) };
}

// Build alias from col, row
export function toAlias(col, row) {
  return `${col},${row}`;
}

// Get pixel center for a zone alias
export function aliasToPixel(alias) {
  const coord = parseAlias(alias);
  if (!coord) return { x: 0, y: 0 };
  return hexToPixel(coord.col, coord.row);
}

// Get all 6 adjacent hex aliases for flat-top offset coordinates
export function getAdjacent(col, row) {
  const isOddCol = col % 2 === 1;
  const neighbors = isOddCol
    ? [
        [col + 1, row],
        [col + 1, row + 1],
        [col, row + 1],
        [col - 1, row + 1],
        [col - 1, row],
        [col, row - 1],
      ]
    : [
        [col + 1, row - 1],
        [col + 1, row],
        [col, row + 1],
        [col - 1, row],
        [col - 1, row - 1],
        [col, row - 1],
      ];

  return neighbors.map(([c, r]) => toAlias(c, r));
}

// Check if two aliases are adjacent
export function isAdjacent(alias1, alias2) {
  const c1 = parseAlias(alias1);
  if (!c1) return false;
  return getAdjacent(c1.col, c1.row).includes(alias2);
}

// Generate SVG points for a flat-top hexagon centered at (cx, cy)
export function hexPoints(cx, cy, size = HEX_SIZE) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return points.join(' ');
}

// Calculate viewBox for a grid of cols x rows
export function gridViewBox(cols, rows, padding = 20) {
  const maxCol = cols - 1;
  const maxRow = rows - 1;

  // Get corner positions
  const topLeft = hexToPixel(0, 0);
  const bottomRight = hexToPixel(maxCol, maxRow);

  // Account for odd column shift
  const maxY = Math.max(
    bottomRight.y + HEX_HEIGHT / 2,
    hexToPixel(maxCol % 2 === 0 ? 1 : maxCol, maxRow).y + HEX_HEIGHT / 2
  );

  const minX = topLeft.x - HEX_SIZE - padding;
  const minY = topLeft.y - HEX_HEIGHT / 2 - padding;
  const width = bottomRight.x + HEX_SIZE + padding - minX;
  const height = maxY + padding - minY;

  return `${minX} ${minY} ${width} ${height}`;
}
