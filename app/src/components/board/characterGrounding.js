const LOW_STATES = new Set(['digging', 'recovering', 'downed']);
const MOTION_STATES = new Set(['moving', 'escaping']);
const BRACED_STATES = new Set(['helping', 'strained', 'carrying']);

const BOTTOM_PADDING_PX = Object.freeze({
  'signal-cartographer': Object.freeze({ neutral: 52, helping: 60 }),
  'field-mender': Object.freeze({ neutral: 23, recovering: 45 }),
  'relic-tender': Object.freeze({ neutral: 10, triumph: 50 }),
  routekeeper: Object.freeze({ neutral: 54, strained: 70 }),
});

export function characterGroundingFor(characterId, state = 'neutral', standeeProfile = {}) {
  const visualScale = standeeProfile.visualScale || 1;
  const bottomPaddingRatio = (BOTTOM_PADDING_PX[characterId]?.[state] || 0) / 1024;
  const baseShadowWidth = standeeProfile.shadowWidth || 1;
  const pose = LOW_STATES.has(state) ? 'low' : MOTION_STATES.has(state) ? 'motion' : BRACED_STATES.has(state) ? 'braced' : 'standing';
  const shadow = {
    low: [1.24, 0.68, 0.48],
    motion: [1.16, 0.42, 0.42],
    braced: [1.08, 0.5, 0.48],
    standing: [1, 0.44, 0.44],
  }[pose];
  return Object.freeze({
    visualScale,
    bottomPaddingRatio,
    footY: 0.035,
    shadowScaleX: shadow[0] * baseShadowWidth,
    shadowScaleY: shadow[1],
    shadowOpacity: shadow[2],
    pose,
  });
}
