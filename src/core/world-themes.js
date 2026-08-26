// Six Realms of Zephyr — radial themed regions with HARD identities.
// Cores are pure (weight 1), borders blend naturally over a narrow band only.

export const REGIONS = [
  { id: 'sakura', x: 60, z: -1180, r: 720 },
  { id: 'frost', x: -1050, z: -620, r: 800 },
  { id: 'ruins', x: 1150, z: -520, r: 780 },
  { id: 'autumn', x: 1280, z: 480, r: 760 },
  { id: 'sunfall', x: -1320, z: 380, r: 780 },
  { id: 'verdant', x: -180, z: 1230, r: 740 },
];

// Sharpened influence: full strength inside CORE (62% of radius), fading to
// zero exactly at the rim. Beyond the rim a realm contributes NOTHING.
const CORE = 0.62;

export function regionInfluence(region, x, z) {
  const d = Math.hypot(x - region.x, z - region.z);
  if (d >= region.r) return 0;
  const t = d / region.r;
  if (t <= CORE) return 1;
  return 1 - (t - CORE) / (1 - CORE); // linear falloff across the border band
}

// Dominant realm at a point ('meadow' when none holds sway).
export function regionAt(x, z) {
  let best = null;
  let bestW = 0.34; // must truly own the ground to count
  for (const r of REGIONS) {
    const w = regionInfluence(r, x, z);
    if (w > bestW) {
      bestW = w;
      best = r.id;
    }
  }
  return best ?? 'meadow';
}

// Weights for palette blending: dominant wins; the runner-up may tint only
// inside the narrow border band (natural seams, not soup).
export function regionInfluences(x, z) {
  const raw = {};
  for (const r of REGIONS) raw[r.id] = regionInfluence(r, x, z);
  let first = null;
  let firstW = -1;
  let secondW = 0;
  for (const [id, w] of Object.entries(raw)) {
    if (w > firstW) {
      secondW = firstW;
      first = id;
      firstW = w;
    } else if (w > secondW) {
      secondW = w;
    }
  }
  const out = {};
  for (const [id, w] of Object.entries(raw)) {
    out[id] = id === first ? w : Math.min(w, 0.38); // neighbors only tint a bit
  }
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  out.meadow = Math.max(0, 1 - sum);
  return { dominant: firstW >= 0.34 ? first : 'meadow', weights: out };
}
