export const colorTokens = [
  ['Void', 'Background', '--color-exp-dark', 'bg-exp-dark'],
  ['Surface', 'App shell', '--color-exp-surface', 'bg-exp-surface'],
  ['Panel', 'Grouped tools', '--color-exp-panel', 'bg-exp-panel'],
  ['Border', 'Quiet structure', '--color-exp-border', 'bg-exp-border'],
  ['Text', 'Primary copy', '--color-exp-text', 'bg-exp-text'],
  ['Compass', 'Primary intent', '--color-compass-bright', 'bg-compass-bright'],
  ['Oxide', 'Recovery/success', '--color-oxide-green', 'bg-oxide-green'],
  ['Oxide text', 'Accessible success text', '--color-oxide-green-bright', 'bg-oxide-green-bright'],
  ['Blueprint', 'Plan/information', '--color-blueprint', 'bg-blueprint'],
  ['Signal', 'Danger/failure', '--color-signal-red', 'bg-signal-red'],
  ['Signal text', 'Accessible danger text', '--color-signal-red-bright', 'bg-signal-red-bright'],
  ['Relic', 'Artifact/rare', '--color-relic', 'bg-relic'],
  ['Relic text', 'Accessible rare text', '--color-relic-bright', 'bg-relic-bright'],
  ['Jungle', 'Terrain', '--color-jungle', 'bg-jungle'],
  ['Desert', 'Terrain', '--color-desert', 'bg-desert'],
];

export const scaleTokens = [
  ['Space', '--ds-space-1 through --ds-space-12', '4 / 8 / 12 / 16 / 24 / 32 / 48 px', 'Use the 4 px rhythm; increase gaps before adding dividers.'],
  ['Radius', '--ds-radius-sm/md/lg/full', '4 / 6 / 10 px / full', 'Mechanical panels stay restrained; status dots may be circular.'],
  ['Border', '--ds-border-hairline/strong', '1 / 2 px', 'One pixel structures; two pixels only for focus or urgent emphasis.'],
  ['Elevation', '--ds-shadow-inset/lift/modal', 'Inset / lift / modal', 'Prefer instrument depth; reserve floating shadow for overlays.'],
  ['Motion', '--ds-motion-input/state/reveal/ambient', '90 / 180 / 320 / 900 ms', 'Input, transition, reveal, ambient. Never delay control.'],
  ['Target', '--ds-target-min', '44 px minimum', 'All primary pointer controls remain usable on touch and controller.'],
  ['Typography', '--font-display/body/mono', 'Display / readable / data', 'Choose type by reading job rather than visual novelty.'],
];

export const semanticTokens = [
  ['Intent', '--ds-color-intent', 'Primary player command'],
  ['Information', '--ds-color-info', 'Planning and system explanation'],
  ['Success', '--ds-color-success', 'Accepted action and recovery'],
  ['Danger', '--ds-color-danger', 'Named loss or urgent correction'],
  ['Artifact', '--ds-color-artifact', 'Rare discovery and memory'],
  ['Focus', '--ds-color-focus', 'Keyboard and controller focus'],
];

export const tokenContract = {
  spacing: ['--ds-space-1', '--ds-space-2', '--ds-space-3', '--ds-space-4', '--ds-space-6', '--ds-space-8', '--ds-space-12'],
  radius: ['--ds-radius-sm', '--ds-radius-md', '--ds-radius-lg', '--ds-radius-full'],
  border: ['--ds-border-hairline', '--ds-border-strong'],
  motion: ['--ds-motion-input', '--ds-motion-state', '--ds-motion-reveal', '--ds-motion-ambient'],
  target: ['--ds-target-min'],
  type: ['--font-display', '--font-body', '--font-mono'],
};
