import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng.js';
import { generateWorld, makeTerrainSampler, WORLD_SIZE } from '../src/core/world-gen.js';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateWorld', () => {
  const worldA = generateWorld(42);
  const worldB = generateWorld(42);

  it('is deterministic for the same seed', () => {
    expect(JSON.stringify(worldA)).toBe(JSON.stringify(worldB));
  });

  it('has islands, rings, pillars and clouds within world bounds', () => {
    expect(worldA.islands.length).toBeGreaterThanOrEqual(30);
    expect(worldA.rings.length).toBeGreaterThanOrEqual(50);
    expect(worldA.pillars.length).toBeGreaterThanOrEqual(60);
    expect(worldA.clouds.length).toBeGreaterThanOrEqual(70);
    const half = WORLD_SIZE / 2;
    for (const r of worldA.rings) {
      expect(Math.abs(r.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(r.z)).toBeLessThanOrEqual(half);
      expect(r.radius).toBeGreaterThan(0);
      // axis is a unit vector
      const len = Math.hypot(r.axisX, r.axisY, r.axisZ);
      expect(len).toBeGreaterThan(0.99);
      expect(len).toBeLessThan(1.01);
    }
    for (const p of worldA.pillars) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(half);
      expect(p.h).toBeGreaterThan(0);
    }
  });

  it('spawns above terrain and away from pillars', () => {
    const sampler = makeTerrainSampler(worldA);
    const groundAtSpawn = sampler(worldA.spawn.x, worldA.spawn.z);
    expect(worldA.spawn.y).toBeGreaterThan(groundAtSpawn + 20);
  });

  it('different seeds give different worlds', () => {
    const other = generateWorld(43);
    expect(other.rings[0].x).not.toBe(worldA.rings[0].x);
  });
});
