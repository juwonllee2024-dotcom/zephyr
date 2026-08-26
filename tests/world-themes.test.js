import { describe, it, expect } from 'vitest';
import { REGIONS, regionAt, regionInfluence, regionInfluences } from '../src/core/world-themes.js';

describe('world themes', () => {
  it('spawn area is the meadow hub', () => {
    expect(regionAt(0, 0)).toBe('meadow');
    expect(regionAt(120, -140)).toBe('meadow');
  });

  it('each realm center resolves to its own id', () => {
    for (const r of REGIONS) {
      expect(regionAt(r.x, r.z)).toBe(r.id);
      expect(regionInfluence(r, r.x, r.z)).toBeCloseTo(1);
    }
  });

  it('midpoints inside a realm stay in that realm', () => {
    const s = REGIONS.find((r) => r.id === 'sakura');
    expect(regionAt(s.x, s.z - s.r * 0.5)).toBe('sakura');
    const f = REGIONS.find((r) => r.id === 'frost');
    expect(regionAt(f.x + f.r * 0.4, f.z)).toBe('frost');
  });

  it('influences never exceed sane bounds and always cover the world', () => {
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() * 2 - 1) * 2000;
      const z = (Math.random() * 2 - 1) * 2000;
      const infl = regionInfluences(x, z);
      const sum = Object.values(infl).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1);
      for (const v of Object.values(infl)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(typeof regionAt(x, z)).toBe('string');
    }
  });

  it('far corners beyond every realm default to meadow', () => {
    expect(regionAt(-1950, 1950)).toBe('meadow');
  });
});
