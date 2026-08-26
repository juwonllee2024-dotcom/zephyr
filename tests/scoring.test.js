import { describe, it, expect } from 'vitest';
import { createScore, onRingPassed, tickScore, COMBO_WINDOW_SEC } from '../src/core/scoring.js';

describe('scoring', () => {
  it('awards base 100 for the first ring', () => {
    const s = createScore();
    const { gained } = onRingPassed(s, { perfect: false }, 0);
    expect(gained).toBe(100);
    expect(s.score).toBe(100);
  });

  it('perfect center bonus pays 1.5×', () => {
    const s = createScore();
    const { gained } = onRingPassed(s, { perfect: true }, 0);
    expect(gained).toBe(150);
  });

  it('combo multiplier grows with consecutive rings', () => {
    const s = createScore();
    let last;
    for (let i = 0; i < 6; i++) last = onRingPassed(s, { perfect: false }, i * 1.0);
    expect(s.combo).toBe(6);
    // 6th ring in a row should be worth clearly more than base
    expect(last.gained).toBeGreaterThan(160);
  });

  it('combo resets after the window lapses without a ring', () => {
    const s = createScore();
    onRingPassed(s, { perfect: false }, 0);
    onRingPassed(s, { perfect: false }, 1);
    expect(s.combo).toBe(2);
    tickScore(s, 10); // > COMBO_WINDOW_SEC
    expect(tickScore(s, 0.016)).toBe(false);
    expect(s.combo).toBe(0);
    const { gained } = onRingPassed(s, { perfect: false }, 20);
    expect(gained).toBe(100);
  });

  it('COMBO_WINDOW_SEC is sane', () => {
    expect(COMBO_WINDOW_SEC).toBeGreaterThanOrEqual(4);
    expect(COMBO_WINDOW_SEC).toBeLessThanOrEqual(10);
  });
});
