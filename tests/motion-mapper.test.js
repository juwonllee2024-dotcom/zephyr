import { describe, it, expect } from 'vitest';
import { createMotionMapper } from '../src/core/motion-mapper.js';

// MediaPipe pose landmark indices used by the mapper.
const LS = 11, RS = 12, LE = 13, RE = 14, LW = 15, RW = 16, LH = 23, RH = 24;

// Helper: build a minimal 33-landmark pose. Coordinates: x∈[0,1] rightward, y∈[0,1] DOWNWARD (image space).
// Anatomically ordered (image y): shoulders 0.40 → hips 0.63 → hanging wrists 0.52-ish… wait,
// hanging wrists reach mid-thigh ≈ just above hip line here modeled at 0.52 relative to hips 0.63.
function pose({ shoulderTilt = 0, wristRaise = 0, vis = 0.95, phase = 0, wristGap = 1 }) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
  // torso baseline
  lms[LS] = { x: 0.45, y: 0.40 + shoulderTilt / 2, z: 0, visibility: vis };
  lms[RS] = { x: 0.55, y: 0.40 - shoulderTilt / 2, z: 0, visibility: vis };
  // hips sit well below shoulders in image space
  lms[23] = { x: 0.46, y: 0.63, z: 0, visibility: vis };
  lms[24] = { x: 0.54, y: 0.63, z: 0, visibility: vis };
  // wrists: +1 = fully raised above shoulders, 0 = hanging mid-chest height,
  // -1 = pushed toward the lap. wristGap: 1 = arms wide, ~0.2 = hands together.
  const wy = 0.52 - wristRaise * 0.22;
  const halfGap = 0.06 * wristGap;
  lms[LW] = { x: 0.5 - halfGap, y: wy + phase * 0.05, z: 0, visibility: vis };
  lms[RW] = { x: 0.5 + halfGap, y: wy - phase * 0.05, z: 0, visibility: vis };
  lms[LE] = { x: 0.5 - halfGap - 0.03, y: wy + 0.10 - wristRaise * 0.05, z: 0, visibility: vis };
  lms[RE] = { x: 0.5 + halfGap + 0.03, y: wy + 0.10 - wristRaise * 0.05, z: 0, visibility: vis };
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
    let out;
    let t = 0.05;
    for (let i = 0; i < 45; i++) {
      out = m.update(pose({ wristRaise: 1 }), t);
      t += 1 / 60;
    }
    expect(out.pitch).toBeGreaterThan(0.5);
  });

  it('hands together below chest, HELD 2s, commands a dive', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    let out;
    let t = 0.05;
    for (let i = 0; i < 140; i++) {
      out = m.update(pose({ wristRaise: -0.6, wristGap: 0.25 }), t);
      t += 1 / 60;
    }
    expect(out.pitch).toBeLessThan(-0.5);
    expect(out.diveCharge).toBe(1);
  });

  it('dive charge builds progressively during the 2s hold', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    let out;
    let t = 0.05;
    const charges = [];
    for (let i = 0; i < 60; i++) {
      out = m.update(pose({ wristRaise: -0.6, wristGap: 0.25 }), t);
      t += 1 / 60;
      charges.push(out.diveCharge);
    }
    expect(charges[10]).toBeLessThan(charges[50]); // charging, not instant
    expect(out.diveCharge).toBeGreaterThan(0.3);   // partial charge visible
    expect(out.pitch).toBeGreaterThanOrEqual(-0.05); // not yet diving at ~1s
  });

  it('arms hanging wide NEVER dives, no matter how long', () => {
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    let out;
    let t = 0.05;
    for (let i = 0; i < 240; i++) {
      out = m.update(pose({}), t);
      t += 1 / 60;
    }
    expect(out.pitch).toBe(0);
    expect(out.zone).toBe('mid');
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

  it('flapping overrides pitch once shaking is established', () => {
    // Regression for real-user report: shaking hands to flap was read as "going down".
    // The very first upstroke is inherently ambiguous (~0.4s transient), so we
    // assert AFTER the first stroke — from then on the gate must hold pitch at 0.
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    let maxAbsPitch = 0;
    let sawFlap = false;
    let t = 0.05;
    for (let i = 30; i < 150; i++) {
      const phase = Math.sin(i / 150 * Math.PI * 2 * 2.5);
      const out = m.update(pose({ wristRaise: 0.2 + phase * 0.9 }), t);
      t += 1 / 60;
      maxAbsPitch = Math.max(maxAbsPitch, Math.abs(out.pitch));
      if (out.flap > 0.3) sawFlap = true;
    }
    expect(sawFlap).toBe(true);
    expect(maxAbsPitch).toBeLessThan(0.3); // established shaking must not DIVE/CLIMB
  });

  it('held poses keep full authority (gating only during active pumping)', () => {
    // held climb converges to full authority via EMA
    const m = createMotionMapper();
    m.update(pose({}), 0.0);
    let out;
    let t = 0.05;
    for (let i = 0; i < 45; i++) {
      out = m.update(pose({ wristRaise: 1 }), t);
      t += 1 / 60;
    }
    expect(out.pitch).toBeGreaterThan(0.7);
    // held dive too (hands together below chest)
    const down = createMotionMapper();
    down.update(pose({}), 0.0);
    let dOut;
    t = 0.05;
    for (let i = 0; i < 140; i++) {
      dOut = down.update(pose({ wristRaise: -0.6, wristGap: 0.25 }), t);
      t += 1 / 60;
    }
    expect(dOut.pitch).toBeLessThan(-0.6);
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
