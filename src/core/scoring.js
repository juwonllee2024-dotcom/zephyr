// Score, combo multiplier and combo-window expiry.

export const COMBO_WINDOW_SEC = 6;

export function createScore() {
  return {
    score: 0,
    combo: 0,
    bestCombo: 0,
    rings: 0,
    lastRingT: -1e9,
    expiredHandled: true,
  };
}

export function multiplier(combo) {
  return Math.min(4, 1 + 0.25 * Math.max(0, combo - 1));
}

export function onRingPassed(score, { perfect = false } = {}, t) {
  score.combo = t - score.lastRingT <= COMBO_WINDOW_SEC ? score.combo + 1 : 1;
  score.lastRingT = t;
  score.expiredHandled = false;
  score.bestCombo = Math.max(score.bestCombo, score.combo);
  score.rings += 1;
  const mult = multiplier(score.combo);
  const gained = Math.round(100 * (perfect ? 1.5 : 1) * mult);
  score.score += gained;
  return { gained, mult, combo: score.combo };
}

// Call every frame with the current clock. Returns true exactly once when the
// combo window lapses (so the UI can play a "combo lost" sting).
export function tickScore(score, t) {
  if (
    !score.expiredHandled &&
    score.combo > 0 &&
    t - score.lastRingT > COMBO_WINDOW_SEC
  ) {
    score.combo = 0;
    score.expiredHandled = true;
    return true;
  }
  return false;
}
