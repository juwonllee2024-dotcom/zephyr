// Maps MediaPipe pose landmarks to flight controls.
// Landmarks: 33 × {x,y,z,visibility}, x∈[0,1] rightward, y∈[0,1] DOWNWARD.
//
//   roll  ← torso lean (shoulder-height difference, normalized by shoulder width)
//   pitch ← arms raised above shoulders = climb; dropped low = dive
//   flap  ← quick upward wrist velocity ("pumping" both arms)

const LS = 11, RS = 12, LW = 15, RW = 16;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createMotionMapper(opts = {}) {
  const alphaRise = opts.alphaRise ?? 0.5;   // fast attack…
  const alphaFall = opts.alphaFall ?? 0.15;  // …slow release (kills jitter)
  const sensitivity = opts.sensitivity ?? 2.0;
  const pitchGain = opts.pitchGain ?? 1.7;
  const deadzone = opts.deadzone ?? 0.08;    // soft knee: rest ≠ command
  const staleSec = opts.staleSec ?? 0.6;

  let smRoll = null;
  let smPitch = null;
  let flap = 0;
  let lastWristMidY = null;
  let lastT = null;

  function ema(cur, raw) {
    const a = raw > cur ? alphaRise : alphaFall;
    return cur + (raw - cur) * a;
  }

  // Soft deadzone: below `deadzone` reads as zero, above it reshapes smoothly
  // to fill the full range — so "not doing" and "doing" feel clearly different.
  function shape(v) {
    const s = Math.sign(v);
    const a = Math.abs(v);
    if (a <= deadzone) return 0;
    const t = Math.min(1, (a - deadzone) / (1 - deadzone));
    return s * t * t * (3 - 2 * t);
  }

  function update(lms, t) {
    const key = [LS, RS, LW, RW];
    const visible = key.every((i) => lms[i] && (lms[i].visibility ?? 1) > 0.5);
    if (!visible) {
      flap *= 0.85;
      return { roll: smRoll ?? 0, pitch: smPitch ?? 0, flap, tracked: false };
    }

    // Stale stream (tracker stalled / person walked away): require re-acquire.
    if (lastT !== null && t - lastT > staleSec) {
      smRoll = null;
      smPitch = null;
      lastWristMidY = null;
      lastT = null;
      flap = 0;
      return { roll: 0, pitch: 0, flap: 0, tracked: false };
    }
    const dtPrev = lastT !== null ? t - lastT : 0;
    lastT = t;

    const sw = Math.max(Math.abs(lms[LS].x - lms[RS].x), 1e-3);

    // Torso lean → bank. Person's right shoulder dropping = bank right (+).
    const rollRaw = shape(clamp(((lms[RS].y - lms[LS].y) / sw) * sensitivity, -1, 1));

    // Arm raise → climb / dive. Positive when wrists ride above shoulder line.
    const shoulderMidY = (lms[LS].y + lms[RS].y) / 2;
    const wristMidY = (lms[LW].y + lms[RW].y) / 2;
    const raise = (shoulderMidY - wristMidY) / sw - 0.35; // 0 ≈ arms hanging
    const pitchRaw = shape(clamp(raise * pitchGain, -1, 1));

    // Upward wrist velocity → wing-flap impulse (image y is down, so up = negative dy).
    let velUp = 0;
    if (lastWristMidY !== null && dtPrev > 0 && dtPrev < 0.5) {
      velUp = ((lastWristMidY - wristMidY) / sw) / dtPrev;
    }
    lastWristMidY = wristMidY;
    const flapTarget = clamp((velUp - 1.9) / 3.6, 0, 1);
    flap = Math.max(flap * Math.exp(-5 * Math.max(dtPrev, 0)), flapTarget);

    smRoll = smRoll === null ? rollRaw : ema(smRoll, rollRaw);
    smPitch = smPitch === null ? pitchRaw : ema(smPitch, pitchRaw);

    return { roll: smRoll, pitch: smPitch, flap, tracked: true };
  }

  return { update };
}
