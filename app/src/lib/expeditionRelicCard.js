export const RUN_RELIC_CARD_SIZE = {
  width: 1200,
  height: 1600,
};

const PALETTES = {
  clean: {
    id: 'clean',
    name: 'Clean Departure',
    bg: '#10150f',
    panel: '#172016',
    accent: '#86d37f',
    accent2: '#e8c860',
    ink: '#f3eed7',
    dim: '#9aa18f',
    danger: '#e05a4f',
    route: '#3a7cc4',
  },
  redline: {
    id: 'redline',
    name: 'Redline',
    bg: '#150f10',
    panel: '#211416',
    accent: '#e05a4f',
    accent2: '#e8c860',
    ink: '#f3eed7',
    dim: '#ac9b8f',
    danger: '#ff6b59',
    route: '#7aa7dc',
  },
  value: {
    id: 'value',
    name: 'Value Run',
    bg: '#111416',
    panel: '#171c22',
    accent: '#e8c860',
    accent2: '#86d37f',
    ink: '#f3eed7',
    dim: '#9ca8b0',
    danger: '#e05a4f',
    route: '#3a7cc4',
  },
  warning: {
    id: 'warning',
    name: 'Warning',
    bg: '#141311',
    panel: '#201d18',
    accent: '#d88945',
    accent2: '#e05a4f',
    ink: '#f3eed7',
    dim: '#aaa18e',
    danger: '#e05a4f',
    route: '#3a7cc4',
  },
};

function hash(value) {
  let h = 2166136261;
  for (const char of String(value || '')) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function safeText(value, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function clamp(value, min = 0, max = 9999) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

export function escapeRelicText(value = '') {
  return safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value = '', max = 72) {
  const text = safeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function paletteForMemory(memory = {}) {
  if (memory.outcome !== 'escaped') return PALETTES.warning;
  if ((memory.finalPressure || 0) >= 75 || memory.escapeCostLevel === 'crew-risk') return PALETTES.redline;
  if (memory.escapeCostLevel === 'clean') return PALETTES.clean;
  if ((memory.artifacts || 0) > 0) return PALETTES.value;
  return PALETTES.warning;
}

function recordUrlFor(memory = {}, origin = '') {
  const path = memory.replayPath || memory.reportPath || '';
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${String(origin || '').replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function relicQuote(memory = {}) {
  if (memory.fingerprint?.replayHook) return truncate(memory.fingerprint.replayHook, 118);
  const moment = memory.bestMoment || {};
  return truncate(
    memory.bestMomentLabel
    || moment.text
    || moment.summary
    || memory.insight
    || 'The expedition became a record worth challenging.',
    118,
  );
}

function relicStamp(memory = {}) {
  if (memory.outcome !== 'escaped') return 'WARNING';
  if (memory.escapeCostLevel === 'clean') return 'CLEAN';
  if ((memory.finalPressure || 0) >= 75) return 'REDLINE';
  if ((memory.artifacts || 0) > 0) return 'VALUE';
  return 'ESCAPED';
}

function routeMarks(seedValue) {
  const seed = hash(seedValue);
  return Array.from({ length: 9 }, (_, index) => ({
    active: index <= 4 + (seed % 3),
    danger: ((seed >> index) & 3) === 3,
    value: ((seed >> (index + 4)) & 5) === 5,
  }));
}

export function buildRunRelicCard({ memory = null, challenge = null, origin = '' } = {}) {
  if (!memory) return null;
  const palette = paletteForMemory(memory);
  const recordUrl = recordUrlFor(memory, origin);
  const fingerprint = memory.fingerprint || null;
  const title = truncate(fingerprint?.title || memory.title || 'Xenovoya Expedition', 54);
  const subtitle = truncate(fingerprint?.subtitle || memory.scenarioName || 'Xenovoya Expedition', 72);
  const challengeTarget = challenge?.target || fingerprint?.beatTarget || memory.insight || 'Beat the score, lower the cost, or bring more value home.';
  return {
    id: `relic-${memory.id || hash(title)}`,
    title,
    subtitle,
    eyebrow: 'Xenovoya Run Relic',
    stamp: relicStamp(memory),
    outcome: memory.outcomeLabel || memory.outcome || 'Complete',
    fingerprint,
    score: clamp(memory.score),
    arc: memory.arcLabel || memory.arcShape || 'Run Arc',
    pressure: clamp(memory.finalPressure, 0, 100),
    cost: memory.escapeCostLabel || 'Unknown',
    value: clamp(memory.artifacts, 0, 99),
    crew: `${clamp(memory.survivors, 0, 12)}/${clamp(memory.crew, 0, 12)}`,
    quote: relicQuote(memory),
    badges: (memory.badges || []).slice(0, 6),
    challengeTitle: challenge?.title || 'Beat This Expedition',
    challengeTarget: truncate(challengeTarget, 112),
    reward: challenge?.reward || 'New Personal Best',
    recordUrl,
    palette,
    routeMarks: routeMarks(memory.id || memory.seed || title),
    filename: `${safeText(title, 'xenovoya-run-relic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'xenovoya-run-relic'}.svg`,
  };
}

function svgText(text, x, y, options = {}) {
  const {
    size = 34,
    weight = 500,
    fill = '#f3eed7',
    family = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    anchor = 'start',
    spacing = 0,
  } = options;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${escapeRelicText(text)}</text>`;
}

function metricBlock(label, value, x, y, palette) {
  return `
    <rect x="${x}" y="${y}" width="236" height="130" rx="12" fill="${palette.panel}" stroke="${palette.route}" stroke-opacity="0.45"/>
    ${svgText(label, x + 24, y + 42, { size: 22, fill: palette.dim, weight: 700 })}
    ${svgText(value, x + 24, y + 96, { size: 40, fill: palette.ink, weight: 800 })}
  `;
}

function badgePills(card) {
  const badges = card.badges.length ? card.badges : ['Unbadged Legend'];
  return badges.slice(0, 6).map((badge, index) => {
    const x = 92 + (index % 2) * 500;
    const y = 1124 + Math.floor(index / 2) * 70;
    return `
      <rect x="${x}" y="${y}" width="450" height="46" rx="23" fill="${card.palette.panel}" stroke="${card.palette.accent}" stroke-opacity="0.55"/>
      ${svgText(badge, x + 225, y + 31, { size: 22, fill: card.palette.accent, weight: 800, anchor: 'middle' })}
    `;
  }).join('');
}

function routeGlyph(card) {
  return card.routeMarks.map((mark, index) => {
    const x = 141 + index * 104;
    const y = 892 + (index % 2) * 32;
    const fill = mark.danger ? card.palette.danger : mark.value ? card.palette.accent2 : mark.active ? card.palette.route : card.palette.panel;
    const opacity = mark.active || mark.danger || mark.value ? 0.88 : 0.45;
    return `<polygon points="${x},${y - 42} ${x + 48},${y - 20} ${x + 48},${y + 28} ${x},${y + 50} ${x - 48},${y + 28} ${x - 48},${y - 20}" fill="${fill}" opacity="${opacity}" stroke="${card.palette.ink}" stroke-opacity="0.16"/>`;
  }).join('');
}

export function renderRunRelicSvg(card) {
  if (!card) return '';
  const { width, height } = RUN_RELIC_CARD_SIZE;
  const p = card.palette;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeRelicText(card.title)} Run Relic Card">
  <defs>
    <linearGradient id="relic-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="54%" stop-color="${p.panel}"/>
      <stop offset="100%" stop-color="#070907"/>
    </linearGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#relic-bg)"/>
  <rect x="44" y="44" width="1112" height="1512" rx="28" fill="none" stroke="${p.accent}" stroke-width="3" stroke-opacity="0.7"/>
  <rect x="74" y="74" width="1052" height="1452" rx="22" fill="none" stroke="${p.route}" stroke-width="2" stroke-opacity="0.35"/>
  <g filter="url(#soft-shadow)">
    <rect x="92" y="112" width="1016" height="332" rx="20" fill="${p.panel}" stroke="${p.accent}" stroke-opacity="0.55"/>
    ${svgText(card.eyebrow, 130, 172, { size: 24, fill: p.accent, weight: 800 })}
    ${svgText(card.stamp, 1040, 172, { size: 28, fill: p.accent2, weight: 900, anchor: 'end' })}
    ${svgText(card.title, 130, 258, { size: 58, fill: p.ink, weight: 900, family: 'Impact, Haettenschweiler, Arial Narrow, sans-serif' })}
    ${svgText(card.subtitle, 132, 318, { size: 26, fill: p.dim, weight: 600 })}
    ${svgText(`"${card.quote}"`, 132, 392, { size: 30, fill: p.ink, weight: 500 })}
  </g>
  <g>
    ${metricBlock('SCORE', String(card.score), 92, 500, p)}
    ${metricBlock('ARC', card.arc, 350, 500, p)}
    ${metricBlock('PRESSURE', String(card.pressure), 608, 500, p)}
    ${metricBlock('CREW', card.crew, 866, 500, p)}
  </g>
  <rect x="92" y="696" width="1016" height="314" rx="20" fill="${p.panel}" stroke="${p.route}" stroke-opacity="0.45"/>
  ${svgText('ROUTE MEMORY', 132, 758, { size: 24, fill: p.dim, weight: 800 })}
  ${routeGlyph(card)}
  ${svgText(`Outcome: ${card.outcome}`, 132, 1016, { size: 27, fill: p.ink, weight: 800 })}
  ${svgText(`Cost: ${card.cost} / Value: ${card.value}`, 664, 1016, { size: 27, fill: p.ink, weight: 800 })}
  ${badgePills(card)}
  <rect x="92" y="1362" width="1016" height="118" rx="20" fill="${p.panel}" stroke="${p.accent2}" stroke-opacity="0.55"/>
  ${svgText(card.challengeTitle, 132, 1418, { size: 28, fill: p.accent2, weight: 900 })}
  ${svgText(card.challengeTarget, 132, 1466, { size: 24, fill: p.ink, weight: 600 })}
  ${svgText(card.recordUrl ? 'Open the record, then beat it.' : 'Finish the next expedition, then beat it.', 600, 1530, { size: 22, fill: p.dim, weight: 700, anchor: 'middle' })}
</svg>`;
}

export function relicShareText(card) {
  if (!card) return '';
  const link = card.recordUrl ? ` ${card.recordUrl}` : '';
  return `${card.title}: score ${card.score}, pressure ${card.pressure}, ${card.outcome}. ${card.challengeTitle}: ${card.challengeTarget}.${link}`;
}
