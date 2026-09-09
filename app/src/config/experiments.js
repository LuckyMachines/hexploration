export const EXPERIMENTS_VERSION = '1.0.0';

export const experiments = Object.freeze({
  'starter-cta-language': Object.freeze({
    id: 'starter-cta-language',
    status: 'planned',
    objective: 'Help first-time visitors choose a playable path without mistaking wallet setup for the game.',
    hypothesis: 'Outcome-led CTA language increases starter completion without lowering live-lobby entry.',
    primaryMetric: 'starter_completed / starter_opened',
    guardrails: ['live_join / pageview', 'ux_error / starter_opened'],
    environments: ['production'],
    allocationPercent: 0,
    variants: [
      { id: 'control', weight: 50 },
      { id: 'outcome-led', weight: 50 },
    ],
    owner: 'product-design',
  }),
});
