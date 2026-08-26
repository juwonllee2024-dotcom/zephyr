// Energy-conserving arcade glider physics. Pure functions, no DOM/three imports.

export const SPEED_LIMITS = { min: 18, max: 95 };

const TRIM_SPEED = 40;   // relaxed level-flight cruising speed
const RELAX = 0.15;      // how strongly speed relaxes toward trim
const G_EXCHANGE = 38;   // altitude <-> speed trading power
const FLAP_ACCEL = 13;   // extra acceleration while flapping
const MAX_BANK = 1.15;   // rad
const MAX_PITCH = 0.62;  // rad ≈ 35° — steep enough to soar, shallow enough
                         // that the world stays framed and speed stays alive
const ROLL_RATE = 3.0;   // rad/s
const PITCH_RATE = 2.2;  // rad/s
const TURN_RATE = 1.35;  // heading change per unit bank

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function approach(cur, target, maxDelta) {
  const d = target - cur;
  return cur + clamp(d, -maxDelta, maxDelta);
}

export function createFlightState(pos = [0, 300, 0], heading = 0) {
  return { pos: [...pos], heading, pitch: 0, roll: 0, speed: TRIM_SPEED };
}

// controls: { targetPitch: -1..1 (climb+), targetRoll: -1..1 (right+), flap: 0..1 }
export function stepFlight(s, controls, dtRaw) {
  const dt = clamp(dtRaw, 0, 0.05);

  const targetRoll = clamp(controls.targetRoll || 0, -1, 1) * MAX_BANK;
  const targetPitch = clamp(controls.targetPitch || 0, -1, 1) * MAX_PITCH;
  s.roll = approach(s.roll, targetRoll, ROLL_RATE * dt);
  s.pitch = approach(s.pitch, targetPitch, PITCH_RATE * dt);

  // Banking right (positive roll) turns right: heading decreases.
  s.heading -= s.roll * TURN_RATE * dt;

  // Longitudinal energy: dive trades altitude for speed, climb pays it back,
  // flap muscles add a little more, drag relaxes speed toward trim.
  const relax = (TRIM_SPEED - s.speed) * RELAX;
  const gravity = -Math.sin(s.pitch) * G_EXCHANGE;
  const flapAccel = FLAP_ACCEL * clamp(controls.flap || 0, 0, 1);
  s.speed += (relax + gravity + flapAccel) * dt;
  s.speed = clamp(s.speed, SPEED_LIMITS.min, SPEED_LIMITS.max);

  // Integrate position. Heading 0 faces -Z; banking right curves toward +X.
  const cf = Math.cos(s.pitch);
  const fx = -Math.sin(s.heading) * cf;
  const fy = Math.sin(s.pitch);
  const fz = -Math.cos(s.heading) * cf;
  s.pos[0] += fx * s.speed * dt;
  s.pos[1] += fy * s.speed * dt;
  s.pos[2] += fz * s.speed * dt;

  s.pitch = clamp(s.pitch, -Math.PI / 2, Math.PI / 2);
  return s;
}

// Unit forward vector of the current flight attitude.
export function forwardVector(s) {
  const cf = Math.cos(s.pitch);
  return [-Math.sin(s.heading) * cf, Math.sin(s.pitch), -Math.cos(s.heading) * cf];
}
