// Frame-by-frame collision + traversal evaluation. Stateless apart from an
// optional cached terrain sampler on the world object.
import { makeTerrainSampler } from './world-gen.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function evaluateFrame(prev, cur, world, playerRadius = 1.5) {
  // ---- Ring hoops: did the segment cross the ring plane inside the circle?
  const ringHits = [];
  for (const r of world.rings) {
    const s0 =
      (prev[0] - r.x) * r.axisX + (prev[1] - r.y) * r.axisY + (prev[2] - r.z) * r.axisZ;
    const s1 =
      (cur[0] - r.x) * r.axisX + (cur[1] - r.y) * r.axisY + (cur[2] - r.z) * r.axisZ;
    const crossed = (s0 < 0 && s1 >= 0) || (s0 > 0 && s1 <= 0);
    if (!crossed) continue;

    const denom = s0 - s1;
    const t = denom === 0 ? 0 : s0 / denom;
    const px = prev[0] + (cur[0] - prev[0]) * t;
    const py = prev[1] + (cur[1] - prev[1]) * t;
    const pz = prev[2] + (cur[2] - prev[2]) * t;

    const ox = px - r.x;
    const oy = py - r.y;
    const oz = pz - r.z;
    const along = ox * r.axisX + oy * r.axisY + oz * r.axisZ;
    const dist = Math.hypot(
      ox - along * r.axisX,
      oy - along * r.axisY,
      oz - along * r.axisZ,
    );
    if (dist <= r.radius) {
      ringHits.push({ id: r.id, offset: dist / r.radius, perfect: dist < r.radius * 0.25 });
    }
  }
  ringHits.sort((a, b) => a.offset - b.offset);

  // ---- Pillar shafts: segment-to-point distance in XZ + height overlap.
  let pillarHit = null;
  const dx = cur[0] - prev[0];
  const dz = cur[2] - prev[2];
  const len2 = dx * dx + dz * dz;
  const minY = Math.min(prev[1], cur[1]);
  const maxY = Math.max(prev[1], cur[1]);
  for (const p of world.pillars) {
    const pTop = p.top ?? p.h; // fixtures may express height only
    const t = len2 > 1e-9 ? clamp01(((p.x - prev[0]) * dx + (p.z - prev[2]) * dz) / len2) : 0;
    const qx = prev[0] + dx * t;
    const qz = prev[2] + dz * t;
    const dh = Math.hypot(qx - p.x, qz - p.z);
    if (dh < p.r + playerRadius && minY < pTop && maxY > 0) {
      pillarHit = { id: p.id, x: qx, z: qz };
      break;
    }
  }

  // ---- Terrain floor.
  const sampler = world._sampler ?? (world._sampler = makeTerrainSampler(world));
  const groundY = sampler(cur[0], cur[2]);

  return {
    ringHits,
    pillarHit,
    groundY,
    groundHit: cur[1] < groundY + playerRadius,
  };
}
