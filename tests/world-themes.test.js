import { describe, it, expect } from 'vitest';
import { REGIONS, regionAt, regionInfluence, regionInfluences } from '../src/core/world-themes.js';

describe('world themes', () => {
  it('spawn area is the meadow hub', () => {
    expect(regionAt(0, 0)).toBe('meadow');
    expect(regionAt(120, -140)).toBe('meadow');
  });

  it('each realm core is PURE — full influence, no neighbor tint', () => {
    for (const r of REGIONS) {
      expect(regionAt(r.x, r.z)).toBe(r.id);
      expect(regionInfluence(r, r.x, r.z)).toBe(1);
      const infl = regionInfluences(r.x, r.z);
      expect(infl.dominant).toBe(r.id);
      for (const [id, w] of Object.entries(infl.weights)) {
        if (id !== r.id && id !== 'meadow') expect(w).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it('borders blend naturally (both sides tinted, neither pure)', () => {
    const s = REGIONS.find((r) => r.id === 'sakura');
    const edgeX = s.x + s.r * 0.9;
    const infl = regionInfluences(edgeX, s.z);
    // near the rim, sakura is fading out
    expect(infl.weights.sakura).toBeGreaterThan(0);
    expect(infl.weights.sakura).toBeLessThan(0.5);
  });

  it('influence never exceeds 1 and reaches exactly 0 at/over the rim', () => {
    const f = REGIONS.find((r) => r.id === 'frost');
    expect(regionInfluence(f, f.x + f.r * 3, f.z)).toBe(0);
    const infl = regionInfluences(-1950, 1950);
    expect(infl.dominant).toBe('meadow');
    const sum = Object.values(infl.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('midpoints inside a realm stay in that realm', () => {
    const a = REGIONS.find((r) => r.id === 'autumn');
    expect(regionAt(a.x + a.r * 0.4, a.z)).toBe('autumn');
    const v = REGIONS.find((r) => r.id === 'verdant');
    expect(regionAt(v.x, v.z + v.r * 0.45)).toBe('verdant');
  });
});
