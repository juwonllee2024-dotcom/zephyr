// Terrain mesh from the shared seeded sampler — V2 Palworld palette:
// vivid meadow greens, sandy shores, colorful rock bands, clean snow caps.
import * as THREE from 'three';
import { WORLD_SIZE } from '../core/world-gen.js';

export function buildTerrain(scene, sampler, noiseSeed) {
  const SEGMENTS = 220;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const C_SHALLOW = new THREE.Color(0x35d0c2); // teal shallows
  const C_SAND = new THREE.Color(0xf2dfa2);    // warm beach sand
  const C_MEADOW = new THREE.Color(0x6fd44a);  // vivid palworld green
  const C_PATCH = new THREE.Color(0xc4e75a);   // sunlit yellow-green meadow blotches
  const C_LUSH = new THREE.Color(0x3da53d);    // deeper grass
  const C_HILLROCK = new THREE.Color(0x9a8f77);
  const C_ROCK = new THREE.Color(0x7d7566);
  const C_SNOW = new THREE.Color(0xffffff);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampler(x, z);
    pos.setY(i, h);

    if (h < 0.5) tmp.copy(C_SHALLOW);
    else if (h < 6) tmp.copy(C_SAND);
    else {
      // meadow patchwork: broad low-frequency blotches break up flat greens
      const patch =
        Math.sin(x * 0.0026 + noiseSeed * 0.001) * Math.cos(z * 0.0031 - noiseSeed * 0.0007) +
        Math.sin((x - z) * 0.0018 + 1.7);
      const meadowMix = patch > 0.35 ? (patch - 0.35) * 0.9 : 0;
      if (h < 55) {
        tmp.lerpColors(C_MEADOW, C_LUSH, Math.min(1, (h - 6) / 49));
        tmp.lerp(C_PATCH, Math.min(0.45, meadowMix));
      } else if (h < 150) {
        tmp.lerpColors(C_LUSH, C_HILLROCK, (h - 55) / 95);
      } else if (h < 230) {
        tmp.lerpColors(C_HILLROCK, C_ROCK, (h - 150) / 80);
      } else {
        tmp.lerpColors(C_ROCK, C_SNOW, Math.min(1, (h - 230) / 110));
      }
    }

    // cheerful fine-grain variation
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
