// Terrain mesh from the shared seeded sampler, with height-band vertex colors.
import * as THREE from 'three';
import { WORLD_SIZE } from '../core/world-gen.js';

export function buildTerrain(scene, sampler, noiseSeed) {
  const SEGMENTS = 220;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const C_WATER = new THREE.Color(0x3f6f52);
  const C_SAND = new THREE.Color(0xd9c08a);
  const C_GRASS = new THREE.Color(0x5d9c4a);
  const C_FOREST = new THREE.Color(0x3f7a37);
  const C_ROCK = new THREE.Color(0x8a7a68);
  const C_SNOW = new THREE.Color(0xf2f2f5);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampler(x, z);
    pos.setY(i, h);

    if (h < 2.5) tmp.copy(C_WATER);
    else if (h < 7) tmp.copy(C_SAND);
    else if (h < 60) tmp.lerpColors(C_GRASS, C_FOREST, Math.min(1, (h - 7) / 53));
    else if (h < 170) tmp.lerpColors(C_FOREST, C_ROCK, (h - 60) / 110);
    else tmp.lerpColors(C_ROCK, C_SNOW, Math.min(1, (h - 170) / 130));

    // subtle per-vertex variation so flats don't band
    const v = ((Math.sin(x * 0.71 + noiseSeed) + Math.cos(z * 0.63)) * 0.5) * 0.045;
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
