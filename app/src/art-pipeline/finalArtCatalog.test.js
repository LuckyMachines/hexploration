import { describe, expect, it } from 'vitest';
import {
  FINAL_ART_EXPANSION_VERSION,
  FINAL_ART_EXPANSION_MANIFEST,
  FINAL_ART_EXPANSION_2_MANIFEST,
  FUTURE_RELIC_SIGNALS,
  GUEST_ABILITY_ART,
  GUEST_ENCOUNTER_ART,
  GUEST_LOCATION_ART,
  guestLocationArtwork,
} from './finalArtCatalog';

describe('final art expansion catalog', () => {
  it('covers every authored hero location with unique optimized backplates', () => {
    expect(FINAL_ART_EXPANSION_VERSION).toBe('2026-09-13.2');
    expect(Object.keys(GUEST_LOCATION_ART)).toHaveLength(20);
    expect(new Set(Object.values(GUEST_LOCATION_ART)).size).toBe(20);
    expect(Object.values(GUEST_LOCATION_ART).every((path) => path.endsWith('.webp'))).toBe(true);
    expect(guestLocationArtwork('Echo Fork')).toContain('echo-fork.webp');
    expect(guestLocationArtwork('Unknown Place', '/fallback.webp')).toBe('/fallback.webp');
  });

  it('keeps the reviewed generation batch and its exact prompts with the runtime catalog', () => {
    expect(FINAL_ART_EXPANSION_MANIFEST.model).toBe('gpt-image-2');
    expect(FINAL_ART_EXPANSION_MANIFEST.provider).toBe('azure-foundry');
    expect(FINAL_ART_EXPANSION_MANIFEST.assets).toHaveLength(16);
    expect(FINAL_ART_EXPANSION_MANIFEST.assets.every(({ status, prompt }) => (
      status === 'approved' && prompt.length > 200
    ))).toBe(true);
    expect(new Set(FINAL_ART_EXPANSION_MANIFEST.assets.map(({ productionPath }) => productionPath)).size).toBe(16);
    expect(FINAL_ART_EXPANSION_MANIFEST.rejectedEvidence).toHaveLength(1);
    expect(FINAL_ART_EXPANSION_2_MANIFEST.model).toBe('gpt-image-2');
    expect(FINAL_ART_EXPANSION_2_MANIFEST.assets).toHaveLength(16);
    expect(FINAL_ART_EXPANSION_2_MANIFEST.assets.every(({ status, prompt }) => (
      status === 'approved' && prompt.length > 200
    ))).toBe(true);
  });

  it('connects encounter, crew ability, and future relic art to gameplay ids', () => {
    expect(Object.keys(GUEST_ENCOUNTER_ART).sort()).toEqual([
      'bellstone-rise', 'cinderwake-flats', 'echo-fork', 'far-slate', 'furnace-scar',
      'glassroot-choir', 'rootlight-vale', 'stormneedle-pass', 'veilwood-fringe', 'wind-vault',
    ]);
    expect(Object.keys(GUEST_ABILITY_ART).sort()).toEqual(['anchor', 'attune', 'mend', 'trace']);
    expect(FUTURE_RELIC_SIGNALS.map(({ id }) => id)).toEqual([
      'echo-compass',
      'stormglass-seed',
      'bellstone-clapper',
      'veilglass-map',
      'ashwake-key',
      'hushgrass-spindle',
    ]);
  });
});
