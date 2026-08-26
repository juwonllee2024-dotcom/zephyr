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
  let lastVelUp = null;
  let lastT = null;
  let pumping = false; // latched shake-mode flag
  let zoneName = 'mid';
  let zoneSince = 0;
  const crossings = [];

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
      lastVelUp = null;
      lastT = null;
      flap = 0;
      pumping = false;
      zoneName = 'mid';
      crossings.length = 0;
      return { roll: 0, pitch: 0, flap: 0, tracked: false };
    }
    const dtPrev = lastT !== null ? t - lastT : 0;
    lastT = t;

    const sw = Math.max(Math.abs(lms[LS].x - lms[RS].x), 1e-3);

    // Torso lean → bank. Person's right shoulder dropping = bank right (+).
    const rollRaw = shape(clamp(((lms[RS].y - lms[LS].y) / sw) * sensitivity, -1, 1));

    // ---- Anatomical posture measures (image y is DOWN):
    //   upM  > 0  → wrists ABOVE the shoulder line (how far)
    //   dnM  > 0  → wrists BELOW the hip line (how far)
    // Arms hanging at your sides = mid/neutral by construction — standing
    // still must never read as "dive".
    const LS2 = 23, RS2 = 24;
    const shoulderMidY = (lms[LS].y + lms[RS].y) / 2;
    const wristMidY = (lms[LW].y + lms[RW].y) / 2;
    const hipMidY = ((lms[LS2]?.y ?? 0.65) + (lms[RS2]?.y ?? 0.65)) / 2;
    const upM = (shoulderMidY - wristMidY) / sw;
    const dnM = (wristMidY - hipMidY) / sw;

    // Upward wrist velocity → wing-flap impulse (image y is down, so up = negative dy).
    let velUp = 0;
    if (lastWristMidY !== null && dtPrev > 0 && dtPrev < 0.5) {
      velUp = ((lastWristMidY - wristMidY) / sw) / dtPrev;
    }
    lastWristMidY = wristMidY;

    // ---- Posture zones with dwell: commands need a HELD position, so a shake
    // sweeping through the up-zone never reads as "climb", and a fast raise
    // never gets mistaken for flapping-away-the-altitude-control.
    const zoneNow =
      upM > 0.45 ? 'up'
      : (upM < 0 && dnM > 0.2) ? 'down'
      : 'mid';
    if (zoneNow !== zoneName) {
      zoneName = zoneNow;
      zoneSince = t;
    }
    const dwell = t - zoneSince;
    const calm = Math.abs(velUp) < 2.5;

    // Flap: quick up-strokes from mid/low zone. Hands held fully up = climb.
    const flapTarget = zoneNow === 'up' ? 0 : clamp((velUp - 1.9) / 3.6, 0, 1);
    flap = Math.max(flap * Math.exp(-5 * Math.max(dtPrev, 0)), flapTarget);

    // ---- Shake latch (extra safety for mid-zone oscillation).
    const CROSS = 1.5;
    if (lastVelUp !== null && lastVelUp !== undefined) {
      const crossedUp = lastVelUp >= -CROSS && velUp < -CROSS;
      const crossedDown = lastVelUp <= CROSS && velUp > CROSS;
      if ((crossedUp || crossedDown) && Math.abs(velUp - lastVelUp) < 60) {
        crossings.push(t);
      }
    }
    while (crossings.length && t - crossings[0] > 0.6) crossings.shift();
    lastVelUp = velUp;
    if (!pumping && crossings.length >= 2) pumping = true;
    else if (pumping && crossings.length === 0 && flap < 0.2) pumping = false;

    smRoll = smRoll === null ? rollRaw : ema(smRoll, rollRaw);

    // ---- Pitch: HELD postures command; everything else is level flight.
    // No partial-raise trim: any leak here lets shake stroke-bottoms read as
    // DIVE. Clean model: hands held HIGH = climb, held LOW (below hips) =
    // dive, otherwise 0. HOLD must exceed any in-zone time a shake produces.
    const HOLD = 0.4;
    let pTarget = 0;
    if (zoneNow === 'up' && dwell > HOLD && calm) pTarget = 1;
    else if (zoneNow === 'down' && dwell > HOLD && calm) pTarget = -1;

    if (smPitch === null) smPitch = pTarget;
    else if (Math.abs(pTarget) > Math.abs(smPitch)) smPitch += (pTarget - smPitch) * alphaRise;
    else smPitch += (pTarget - smPitch) * alphaFall;

    return { roll: smRoll, pitch: smPitch, flap, tracked: true };
  }

  return { update };
}
