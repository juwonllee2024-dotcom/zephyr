// Debug harness: replay failing scenarios frame-by-frame with state dumps.
import { createMotionMapper } from '../src/core/motion-mapper.js';

const LS = 11, RS = 12, LW = 15, RW = 16;
function pose({ shoulderTilt = 0, wristRaise = 0, phase = 0 }) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
  lms[LS] = { x: 0.45, y: 0.40 + shoulderTilt / 2, z: 0, visibility: 0.95 };
  lms[RS] = { x: 0.55, y: 0.40 - shoulderTilt / 2, z: 0, visibility: 0.95 };
  lms[23] = { x: 0.46, y: 0.63, z: 0, visibility: 0.95 };
  lms[24] = { x: 0.54, y: 0.63, z: 0, visibility: 0.95 };
  const wy = 0.52 - wristRaise * 0.22;
  lms[LW] = { x: 0.44, y: wy + phase * 0.05, z: 0, visibility: 0.95 };
  lms[RW] = { x: 0.56, y: wy - phase * 0.05, z: 0, visibility: 0.95 };
  return lms;
}

function run(label, frames, fn) {
  const m = createMotionMapper();
  m.update(pose({}), 0.0);
  let t = 0.05;
  let out;
  let maxDive = 0;
  let maxClimb = 0;
  let maxFlap = 0;
  for (const f of frames) {
    out = m.update(pose(f), t);
    t += 1 / 60;
    maxDive = Math.min(maxDive, out.pitch);
    maxClimb = Math.max(maxClimb, out.pitch);
    maxFlap = Math.max(maxFlap, out.flap);
  }
  console.log(`${label}: finalPitch=${out.pitch.toFixed(2)} maxClimb=${maxClimb.toFixed(2)} maxDive=${maxDive.toFixed(2)} maxFlap=${maxFlap.toFixed(2)}`);
}

const shake = [];
for (let i = 0; i < 150; i++) shake.push({ wristRaise: 0.2 + Math.sin(i / 150 * Math.PI * 2 * 2.5) * 0.9 });

const raiseHold = [];
for (let i = 0; i < 20; i++) raiseHold.push({ wristRaise: -0.2 + (i / 20) * 1.2 });
for (let i = 0; i < 40; i++) raiseHold.push({ wristRaise: 1 });

const hang = [];
for (let i = 0; i < 40; i++) hang.push({});

const diveHold = [];
for (let i = 0; i < 40; i++) diveHold.push({ wristRaise: -1 });

run('A smooth raise + hold (want CLIMB)', raiseHold);
run('B shaking hands (want FLAP, NO dive)', shake);
run('C arms hanging (want NEUTRAL)', hang);
run('D hands held low (want DIVE)', diveHold);
