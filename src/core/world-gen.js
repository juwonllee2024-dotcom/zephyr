// Procedural world generation: terrain sampler (with Six-Realms sculpting),
// floating islands, ring chains, rock pillars and clouds.
import { mulberry32 } from './rng.js';
import { regionInfluences } from './world-themes.js';

export const WORLD_SIZE = 4000;
const HALF = WORLD_SIZE / 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hash2(ix, iz, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const ux = smooth(fx);
  const uz = smooth(fz);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x, z, seed, octaves = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, z * freq, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

// Terrain elevation at world position, shaped per realm:
//   frost   — jagged razor peaks (ridged noise) rising from a high plateau
//   ruins   — stepped ziggurat terraces (quantized heights)
//   sakura  — sunken turquoise lagoon at its heart
//   autumn  — amplified cozy hills
//   sunfall — flattened steppes with bold flat-top mesas
//   verdant — gentle bowl cradling the Great Tree
export function terrainHeight(x, z, seed) {
  const base = fbm(x * 0.004, z * 0.004, seed) * 90 - 30;
  const detail = fbm(x * 0.02, z * 0.02, seed + 999) * 12;
  const d = Math.hypot(x, z);
  const edge = smooth(clamp((d - HALF * 0.55) / (HALF * 0.45), 0, 1));
  const mountains = edge * (140 + fbm(x * 0.002, z * 0.002, seed + 55) * 260);
  let h = base + detail + mountains;

  // ---- realm shaping (EXAGGERATED — realms must shout, not whisper) ----
  const infl = regionInfluences(x, z).weights;

  // Frostveil: towering frozen plateau + razor ridges (up to ~+230)
  const fw = infl.frost ?? 0;
  if (fw > 0) {
    const r1 = 1 - Math.abs(fbm(x * 0.006, z * 0.006, seed + 71) * 2 - 1);
    const r2 = 1 - Math.abs(fbm(x * 0.017, z * 0.017, seed + 131) * 2 - 1);
    const ridge = Math.pow(r1, 1.6); // sharpen crests
    h = h * (1 - fw * 0.8) + fw * (52 + ridge * 175 + r2 * 34);
  }

  // Skyfolk ruins: massive ziggurat terraces (26-unit steps)
  const rw = infl.ruins ?? 0;
  if (rw > 0.2) {
    const step = 26;
    const q = Math.floor(h / step) * step + 7;
    h = h * (1 - rw * 0.85) + q * (rw * 0.85);
  }

  // Sakura: deep lagoon crater at the basin heart
  const sw = infl.sakura ?? 0;
  if (sw > 0) {
    const dl = Math.hypot(x - 60, z - (-1180));
    const bowl = Math.max(0, 1 - dl / 340);
    h -= bowl * bowl * 78 * sw;
    h += sw * 9;
  }

  // Autumn: big cozy rolling hills
  const aw = infl.autumn ?? 0;
  if (aw > 0) {
    h += Math.sin(x * 0.008 + 1.3) * Math.cos(z * 0.0071) * 30 * aw;
  }

  // Sunfall: pancake steppes + heroic mesas (+120 flat tops)
  const pw = infl.sunfall ?? 0;
  if (pw > 0) {
    const flat = 22 + fbm(x * 0.003, z * 0.003, seed + 301) * 12;
    h = h * (1 - pw * 0.72) + flat * (pw * 0.72);
    const mesas = [
      [-1520, 180, 190, 120],
      [-1060, 540, 140, 84],
      [-1600, 700, 115, 66],
    ];
    for (const [mx, mz, mr, mh] of mesas) {
      const dm = Math.hypot(x - mx, z - mz);
      if (dm < mr * 1.4) {
        const t = clamp(1 - dm / (mr * 1.4), 0, 1);
        const plateau = Math.min(1, t * 2.6);
        h = Math.max(h, h * (1 - pw) + pw * (flat + mh * plateau + 10));
      }
    }
  }

  // Verdant: dramatic bowl cradling the Great Tree
  const vw = infl.verdant ?? 0;
  if (vw > 0) {
    const dv = Math.hypot(x - (-180), z - 1230);
    const bowl = Math.max(0, 1 - dv / 480);
    h = h * (1 - vw * 0.62 * bowl) + vw * (34 + fbm(x * 0.01, z * 0.01, seed + 401) * 10) * bowl;
    const knoll = Math.max(0, 1 - dv / 170);
    h += knoll * knoll * 44 * vw;
  }

  return h;
}

export function makeTerrainSampler(world) {
  const seed = world.noiseSeed | 0;
  return (x, z) => terrainHeight(x, z, seed);
}

function discPoint(rand, maxRadius, minRadius = 0) {
  const a = rand() * Math.PI * 2;
  const r = minRadius + Math.sqrt(rand()) * (maxRadius - minRadius);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

export function generateWorld(seed) {
  const rand = mulberry32(seed);
  const noiseSeed = Math.floor(rand() * 1e9);

  // --- Floating islands -------------------------------------------------
  const islands = [];
  for (let i = 0; i < 36; i++) {
    const [x, z] = discPoint(rand, HALF * 0.8, 260);
    islands.push({
      id: `isl-${i}`,
      x, z,
      y: 120 + rand() * 320,
      rx: 18 + rand() * 45,
      rz: 18 + rand() * 45,
      depth: 24 + rand() * 40,
      treeCount: Math.floor(rand() * 4),
    });
  }

  // --- Rings: curved chains that trace flight paths + scattered bonus ---
  const rings = [];
  let ringId = 0;
  const addRing = (x, y, z, radius, axis) => {
    const len = Math.hypot(axis[0], axis[1], axis[2]);
    rings.push({
      id: `ring-${ringId++}`,
      x, y, z,
      radius,
      axisX: axis[0] / len,
      axisY: axis[1] / len,
      axisZ: axis[2] / len,
    });
  };

  const CHAINS = 7;
  const PER_CHAIN = 6;
  for (let c = 0; c < CHAINS; c++) {
    const [sx, sz] = discPoint(rand, HALF * 0.62, 320);
    let x = sx;
    let z = sz;
    let heading = rand() * Math.PI * 2;
    let y = 90 + rand() * 160;
    const turnBias = (rand() - 0.5) * 0.55;
    for (let i = 0; i < PER_CHAIN; i++) {
      const ground = terrainHeight(x, z, noiseSeed);
      y = clamp(y + (rand() - 0.5) * 50, Math.max(ground + 45, 50), 480);
      // ring faces the direction of travel (slight random tilt)
      addRing(x, y, z, 8 + rand() * 5, [-Math.sin(heading), (rand() - 0.5) * 0.3, -Math.cos(heading)]);
      heading += turnBias + (rand() - 0.5) * 0.35;
      x += -Math.sin(heading) * 135;
      z += -Math.cos(heading) * 135;
      const d = Math.hypot(x, z);
      if (d > HALF * 0.88) {
        x *= (HALF * 0.7) / d;
        z *= (HALF * 0.7) / d;
        heading += Math.PI * (0.6 + rand() * 0.3);
      }
    }
  }
  for (let i = 0; i < 14; i++) {
    const [x, z] = discPoint(rand, HALF * 0.9);
    const ground = terrainHeight(x, z, noiseSeed);
    const y = Math.max(ground + 60, 70) + rand() * 380;
    const ang = rand() * Math.PI * 2;
    addRing(x, y, z, 8 + rand() * 5, [Math.cos(ang), (rand() - 0.5) * 0.4, Math.sin(ang)]);
  }

  // --- Rock pillars (slalom hazards) ------------------------------------
  const pillars = [];
  let attempts = 0;
  while (pillars.length < 64 && attempts < 800) {
    attempts++;
    const [x, z] = discPoint(rand, HALF * 0.85, 190);
    const ground = terrainHeight(x, z, noiseSeed);
    if (ground < 4) continue; // keep them on land, out of lakes
    pillars.push({
      id: `pil-${pillars.length}`,
      x, z,
      r: 3.5 + rand() * 5.5,
      h: 55 + rand() * 195,
      top: ground + 55 + rand() * 195,
    });
  }

  // --- Clouds ------------------------------------------------------------
  const clouds = [];
  for (let i = 0; i < 84; i++) {
    const [x, z] = discPoint(rand, HALF);
    clouds.push({ x, z, y: 170 + rand() * 520, scale: 45 + rand() * 95 });
  }

  const spawnY = Math.max(terrainHeight(0, 0, noiseSeed) + 90, 170);
  return {
    seed,
    noiseSeed,
    islands,
    rings,
    pillars,
    clouds,
    spawn: { x: 0, y: spawnY, z: 0, heading: 0 },
  };
}
