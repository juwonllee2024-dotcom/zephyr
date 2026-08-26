// Terrain mesh from the shared seeded sampler — Six Realms edition.
// Each realm tints its grass band with its own palette; blends are smooth.
import * as THREE from 'three';
import { WORLD_SIZE } from '../core/world-gen.js';
import { regionInfluences } from '../core/world-themes.js';

// Per-realm ground palettes (low = shore-side green, high = upper-slope green,
// accent = sunlit blotches / realm character).
export const TERRAIN_THEMES = {
  meadow: { low: 0x6fd44a, high: 0x3da53d, accent: 0xc4e75a },
  sakura: { low: 0x82d168, high: 0x53ad55, accent: 0xf0bcD8 },
  frost: { low: 0xa9cebd, high: 0x84b1a2, accent: 0xeaf7ff },
  ruins: { low: 0x96c76d, high: 0x629f54, accent: 0xd9d1b9 },
  autumn: { low: 0xd9a83c, high: 0xae7a2e, accent: 0xe8642f },
  sunfall: { low: 0xcbB65e, high: 0x9f8b41, accent: 0xdf7d4a },
  verdant: { low: 0x5ccA50, high: 0x2f9040, accent: 0x9fe06a },
};

const C_SHALLOW = new THREE.Color(0x35d0c2);
const C_SAND = new THREE.Color(0xf2dfa2);
const C_HILLROCK = new THREE.Color(0x9a8f77);
const C_ROCK = new THREE.Color(0x7d7566);
const C_SNOW = new THREE.Color(0xffffff);

const _themeColors = {};
for (const [id, t] of Object.entries(TERRAIN_THEMES)) {
  _themeColors[id] = {
    low: new THREE.Color(t.low),
    high: new THREE.Color(t.high),
    accent: new THREE.Color(t.accent),
  };
}

export function buildTerrain(scene, sampler, noiseSeed) {
  const SEGMENTS = 220;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const lowC = new THREE.Color();
  const highC = new THREE.Color();
  const accC = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampler(x, z);
    pos.setY(i, h);

    if (h < 0.5) {
      tmp.copy(C_SHALLOW);
    } else if (h < 6) {
      tmp.copy(C_SAND);
    } else {
      // blend realm palettes by influence weights
      const infl = regionInfluences(x, z);
      let lr = 0, lg = 0, lb = 0, hr = 0, hg = 0, hb = 0, ar = 0, ag = 0, ab = 0, tw = 0;
      for (const [id, w] of Object.entries(infl)) {
        const tc = _themeColors[id];
        if (!tc || w <= 0) continue;
        lr += tc.low.r * w; lg += tc.low.g * w; lb += tc.low.b * w;
        hr += tc.high.r * w; hg += tc.high.g * w; hb += tc.high.b * w;
        ar += tc.accent.r * w; ag += tc.accent.g * w; ab += tc.accent.b * w;
        tw += w;
      }
      if (tw > 0) {
        lowC.setRGB(lr / tw, lg / tw, lb / tw);
        highC.setRGB(hr / tw, hg / tw, hb / tw);
        accC.setRGB(ar / tw, ag / tw, ab / tw);
      }

      // meadow patchwork blotches (realm accents show through them)
      const patch =
        Math.sin(x * 0.0026 + noiseSeed * 0.001) * Math.cos(z * 0.0031 - noiseSeed * 0.0007) +
        Math.sin((x - z) * 0.0018 + 1.7);
      const meadowMix = patch > 0.35 ? (patch - 0.35) * 0.9 : 0;

      if (h < 55) {
        tmp.lerpColors(lowC, highC, Math.min(1, (h - 6) / 49));
        tmp.lerp(accC, Math.min(0.42, meadowMix));
      } else if (h < 150) {
        tmp.lerpColors(highC, C_HILLROCK, (h - 55) / 95);
      } else if (h < 230) {
        tmp.lerpColors(C_HILLROCK, C_ROCK, (h - 150) / 80);
      } else {
        tmp.lerpColors(C_ROCK, C_SNOW, Math.min(1, (h - 230) / 110));
      }

      // Frostveil pulls the snowline down over its whole realm
      const fw = infl.frost ?? 0;
      if (fw > 0 && h > 30) {
        const snowLine = 235 - fw * 175;
        if (h > snowLine) {
          tmp.lerp(C_SNOW, Math.min(0.92, ((h - snowLine) / 60) * fw + fw * 0.25));
        }
      }
    }

    const v =
      ((Math.sin(x * 0.71 + noiseSeed) + Math.cos(z * 0.63)) * 0.5) * 0.05 +
      Math.sin(x * 0.061 + z * 0.047) * 0.03;
    colors[i * 3] = Math.max(0, tmp.r + v);
    colors[i * 3 + 1] = Math.max(0, tmp.g + v);
    colors[i * 3 + 2] = Math.max(0, tmp.b + v);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}
