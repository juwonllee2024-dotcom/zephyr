// Six Realms of Zephyr — radial themed regions around the spawn hub.
// Pure logic: no three/DOM. Used by terrain tinting, vegetation scattering,
// landmark placement and ambient particles.

export const HUB_RADIUS = 430;

export const REGIONS = [
  { id: 'sakura', x: 60, z: -1180, r: 720 },     // ahead of spawn flight path
  { id: 'frost', x: -1050, z: -620, r: 800 },
  { id: 'ruins', x: 1150, z: -520, r: 780 },
  { id: 'autumn', x: 1280, z: 480, r: 760 },
  { id: 'sunfall', x: -1320, z: 380, r: 780 },
  { id: 'verdant', x: -180, z: 1230, r: 740 },
];

// Influence weight 0..1 of a region at a point (1 at center, 0 at edge/beyond).
export function regionInfluence(region, x, z) {
  const d = Math.hypot(x - region.x, z - region.z);
  return Math.max(0, 1 - d / region.r);
}

// Dominant region id at a point; 'meadow' when no realm holds sway (the hub
// and all transition bands).
export function regionAt(x, z) {
  let best = null;
  let bestW = 0.18; // below this, treat as neutral meadow
  for (const r of REGIONS) {
    const w = regionInfluence(r, x, z);
    if (w > bestW) {
      bestW = w;
      best = r.id;
    }
  }
  return best ?? 'meadow';
}

// All influences at once (used for blending terrain palettes smoothly).
export function regionInfluences(x, z) {
  const out = {};
  let any = false;
  for (const r of REGIONS) {
    const w = Math.pow(regionInfluence(r, x, z), 1.4); // sharpen cores, soften edges
    out[r.id] = w;
    if (w > 0) any = true;
  }
  out.meadow = any ? Math.max(0, 1 - Math.min(1, Object.values(out).reduce((a, b) => a + b, 0))) : 1;
  return out;
}
