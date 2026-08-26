import { describe, it, expect } from 'vitest';
import { createFlightState, stepFlight, SPEED_LIMITS } from '../src/core/physics.js';

const DT = 1 / 60;

function run(state, controls, seconds = 2, dt = DT) {
  // Clone: stepFlight mutates in place, and callers inspect the initial state.
  let s = { ...state, pos: [...state.pos] };
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) s = stepFlight(s, controls, dt);
  return s;
}

describe('flight physics', () => {
  it('nose-down dive converts altitude into speed', () => {
    const start = createFlightState([0, 300, 0], 0);
    const end = run(start, { targetPitch: -1, targetRoll: 0, flap: 0 }, 2);
    expect(end.speed).toBeGreaterThan(start.speed + 10);
    expect(end.pos[1]).toBeLessThan(start.pos[1]);
  });

  it('climbing bleeds airspeed', () => {
    const start = createFlightState([0, 300, 0], 0);
    start.speed = 55;
    const end = run(start, { targetPitch: 1, targetRoll: 0, flap: 0 }, 2);
    expect(end.speed).toBeLessThan(55);
    expect(end.pos[1]).toBeGreaterThan(start.pos[1]);
  });

  it('banking right turns right (positive roll reduces heading toward +X travel)', () => {
    const start = createFlightState([0, 300, 0], 0); // heading 0 = facing -Z
    const end = run(start, { targetPitch: 0, targetRoll: 1, flap: 0 }, 1);
    // Convention: heading measured CCW around +Y; banking right must decrease heading.
    expect(end.heading).toBeLessThan(start.heading - 0.15);
    expect(end.roll).toBeGreaterThan(0.3);
    // and it actually moved off the -Z line toward +X
    expect(end.pos[0]).toBeGreaterThan(0);
  });

  it('banking left mirrors right', () => {
    const start = createFlightState([0, 300, 0], 0);
    const end = run(start, { targetPitch: 0, targetRoll: -1, flap: 0 }, 1);
    expect(end.heading).toBeGreaterThan(start.heading + 0.15);
    expect(end.pos[0]).toBeLessThan(0);
  });

  it('flap adds energy but cannot exceed the speed limit', () => {
    const start = createFlightState([0, 300, 0], 0);
    start.speed = SPEED_LIMITS.min;
    const flapped = run(start, { targetPitch: 0, targetRoll: 0, flap: 1 }, 3);
    expect(flapped.speed).toBeGreaterThan(SPEED_LIMITS.min + 10);
    const maxed = run(createFlightState([0, 300, 0], 0), { targetPitch: 0, targetRoll: 0, flap: 1 }, 10);
    expect(maxed.speed).toBeLessThanOrEqual(SPEED_LIMITS.max + 1e-6);
  });

  it('speed and angles always stay clamped even with extreme inputs', () => {
    let s = createFlightState([0, 300, 0], Math.PI * 3);
    for (let i = 0; i < 600; i++) {
      s = stepFlight(s, { targetPitch: (i % 2) * 2 - 1, targetRoll: ((i * 7) % 3) - 1, flap: 1 }, DT);
      expect(s.speed).toBeGreaterThanOrEqual(SPEED_LIMITS.min - 1e-6);
      expect(s.speed).toBeLessThanOrEqual(SPEED_LIMITS.max + 1e-6);
      expect(Math.abs(s.pitch)).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
      expect(Number.isFinite(s.pos[0] + s.pos[1] + s.pos[2])).toBe(true);
    }
  });

  it('is roughly dt-independent (two half-steps ≈ one full step)', () => {
    const a = run(createFlightState([0, 300, 0], 0.3), { targetPitch: 0.6, targetRoll: 0.4, flap: 0.5 }, 1, 1 / 30);
    const b = run(createFlightState([0, 300, 0], 0.3), { targetPitch: 0.6, targetRoll: 0.4, flap: 0.5 }, 1, 1 / 120);
    expect(Math.abs(a.pos[0] - b.pos[0])).toBeLessThan(2.0);
    expect(Math.abs(a.pos[1] - b.pos[1])).toBeLessThan(2.0);
    expect(Math.abs(a.speed - b.speed)).toBeLessThan(1.0);
  });
});
