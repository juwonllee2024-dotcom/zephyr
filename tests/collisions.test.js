import { describe, it, expect } from 'vitest';
import { evaluateFrame } from '../src/core/collisions.js';

function ring(id, x, y, z, radius = 8, axis = [0, 0, 1]) {
  const len = Math.hypot(...axis);
  return { id, x, y, z, radius, axisX: axis[0] / len, axisY: axis[1] / len, axisZ: axis[2] / len };
}

describe('ring pass detection', () => {
  const world = {
    rings: [
      ring('r1', 0, 100, 0, 8, [0, 0, 1]),        // hoop facing Z
      ring('r2', 50, 100, 0, 8, [0, 0, 1]),
      ring('r3', 0, 200, 0, 8, [1, 0, 0]),        // hoop facing X
    ],
    pillars: [],
  };

  it('detects a clean pass through the hoop center', () => {
    const res = evaluateFrame([-5, 100, -10], [5, 100, 10], world, 1);
    expect(res.ringHits.map(h => h.id)).toContain('r1');
    const hit = res.ringHits.find(h => h.id === 'r1');
    expect(hit.offset).toBeLessThan(0.2);
    expect(hit.perfect).toBe(true);
  });

  it('ignores passes outside the hoop radius', () => {
    const res = evaluateFrame([-5, 130, -10], [5, 130, 10], world, 1);
    expect(res.ringHits).toHaveLength(0);
  });

  it('does not double-count when fully past the ring', () => {
    const res = evaluateFrame([-5, 100, 20], [5, 100, 40], world, 1);
    expect(res.ringHits).toHaveLength(0);
  });

  it('works for any hoop orientation', () => {
    const res = evaluateFrame([-10, 200, -5], [10, 200, 5], world, 1);
    expect(res.ringHits.map(h => h.id)).toContain('r3');
  });

  it('flags off-center but in-hoop passes as non-perfect', () => {
    const res = evaluateFrame([-5, 106.5, -10], [5, 106.5, 10], world, 1);
    const hit = res.ringHits.find(h => h.id === 'r1');
    expect(hit).toBeDefined();
    expect(hit.perfect).toBe(false);
  });
});

describe('pillar collision', () => {
  const world = {
    rings: [],
    pillars: [
      { id: 'p1', x: 0, z: 0, h: 150, r: 6 },
      { id: 'p2', x: 100, z: 100, h: 80, r: 4 },
    ],
  };

  it('detects flying into a pillar shaft', () => {
    const res = evaluateFrame([-30, 50, 0], [30, 50, 0], world, 1.5);
    expect(res.pillarHit).not.toBe(null);
  });

  it('clears a pillar when flying above its top', () => {
    const res = evaluateFrame([-30, 170, 0], [30, 170, 0], world, 1.5);
    expect(res.pillarHit).toBe(null);
  });

  it('misses distant pillars entirely', () => {
    const res = evaluateFrame([-30, 50, -400], [30, 50, -400], world, 1.5);
    expect(res.pillarHit).toBe(null);
  });
});
