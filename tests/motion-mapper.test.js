import { describe, it, expect } from 'vitest';
import { createMotionMapper } from '../src/core/motion-mapper.js';

// MediaPipe pose landmark indices used by the mapper.
const LS = 11, RS = 12, LE = 13, RE = 14, LW = 15, RW = 16, LH = 23, RH = 24;

// Helper: build a minimal 33-landmark pose. Coordinates: x∈[0,1] rightward, y∈[0,1] DOWNWARD (image space).
function pose({ shoulderTilt = 0, wristRaise = 0, vis = 0.95, phase = 0 }) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
  // torso baseline
  lms[LS] = { x: 0.45, y: 0.40 + shoulderTilt / 2, z: 0, visibility: vis };
  lms[RS] = { x: 0.55, y: 0.40 - shoulderTilt / 2, z: 0, visibility: vis };
  lms[LH] = { x: 0.46, y: 0.65, z: 0, visibility: vis };
  lms[RH] = { x: 0.54, y: 0.65, z: 0, visibility: vis };
  // arms hang by default (wrists near hips); wristRaise>0 lifts hands above shoulders
  lms[LW] = { x: 0.44, y: 0.62 - wristRaise * 0.35 + phase * 0.05, z: 0, visibility: vis };
  lms[RW] = { x: 0.56, y: 0.62 - wristRaise * 0.35 - phase * 0.05, z: 0, visibility: vis };
  lms[LE] = { x: 0.44, y: 0.52 - wristRaise * 0.18, z: 0, visibility: vis };
  lms[RE] = { x: 0.56, y: 0.52 - wristRaise * 0.18, z: 0, visibility: vis };
  return lms;
}

describe('motion mapper', () => {
  it('reads level shoulders as neutral roll', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    const out = m.update(pose({}), 0.05);
    expect(out.tracked).toBe(true);
    expect(Math.abs(out.roll)).toBeLessThan(0.08);
  });

  it('leaning right (right shoulder lower) banks right', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    const out = m.update(pose({ shoulderTilt: -0.12 }), 0.05); // negative tilt = right shoulder lower (larger y)
    expect(out.roll).toBeGreaterThan(0.25);
  });

  it('arms raised commands a climb', () => {
    const m = createMotionMapper();
    m.update(pose({ wristRaise: 1 }), 0.0);
    const out = m.update(pose({ wristRaise: 1 }), 0.05);
    expect(out.pitch).toBeGreaterThan(0.5);
  });

  it('arms lowered commands a dive', () => {
    const m = createMotionMapper();
    m.update(pose({ wristRaise: -1 }), 0.0);
    const out = m.update(pose({ wristRaise: -1 }), 0.05);
    expect(out.pitch).toBeLessThan(-0.3);
  });

  it('rhythmic arm pumping produces flap impulses; stillness does not', () => {
    const m = createMotionMapper();
    let sawFlap = false;
    let t = 0;
    // pump at ~2.5 Hz for 2 seconds
    for (let i = 0; i < 120; i++) {
      const phase = Math.sin(i / 120 * Math.PI * 2 * 2.5 * 0.8);
      const out = m.update(pose({ wristRaise: 0.2 + phase * 0.9 }), t);
      t += 1 / 60;
      if (out.flap > 0.3) sawFlap = true;
    }
    expect(sawFlap).toBe(true);

    const still = createMotionMapper();
    t = 0;
    let maxFlapStill = 0;
    for (let i = 0; i < 120; i++) {
      const out = still.update(pose({ wristRaise: 0.2 }), t);
      t += 1 / 60;
      maxFlapStill = Math.max(maxFlapStill, out.flap);
    }
    expect(maxFlapStill).toBeLessThan(0.3);
  });

  it('goes untracked when frames stop arriving or visibility collapses', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    expect(m.update(pose({}), 0.05).tracked).toBe(true);
    expect(m.update(pose({}), 2.0).tracked).toBe(false); // stale
    const lowVis = createMotionMapper();
    const out = lowVis.update(pose({ vis: 0.2 }), 0.0);
    expect(out.tracked).toBe(false);
  });

  it('smooths jittery input (EMA output spread ≪ raw signal spread)', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    const outs = [];
    let t = 0.05;
    // Alternating extreme lean: raw roll saturates at ±1 (spread 2.0).
    for (let i = 0; i < 60; i++) {
      outs.push(m.update(pose({ shoulderTilt: i % 2 === 0 ? 0.4 : -0.4 }), t).roll);
      t += 1 / 60;
    }
    const spread = Math.max(...outs) - Math.min(...outs);
    expect(spread).toBeLessThan(1.2); // less than 60% of the raw 2.0 swing
  });

  it('moderate jitter stays gentle', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    const outs = [];
    let t = 0.05;
    // ±0.01 in image space ≈ real sensor noise after sw-normalization
    for (let i = 0; i < 90; i++) {
      outs.push(m.update(pose({ shoulderTilt: i % 2 === 0 ? 0.01 : -0.01 }), t).roll);
      t += 1 / 60;
    }
    const spread = Math.max(...outs) - Math.min(...outs);
    expect(spread).toBeLessThan(0.5);
  });

  it('soft deadzone: sub-threshold twitches read as zero', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    const out = m.update(pose({ shoulderTilt: 0.004 }), 0.05); // tiny sway
    expect(Math.abs(out.roll)).toBeLessThan(0.02);
  });
});
