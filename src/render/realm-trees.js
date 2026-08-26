// Realm-themed vegetation: every Six-Realms region gets its own tree palette,
// scattered by region influence so groves fade naturally into neighbors.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { REGIONS } from '../core/world-themes.js';

const REALM_TREES = {
  sakura: [0xff9ec7, 0xffc2da, 0xf27ba8],
  autumn: [0xd4552e, 0xe08a2c, 0xc7b23a, 0xb8431f],
  verdant: [0x2f9040, 0x3fae4a, 0x63c93f],
  frost: [0x9fd4c4, 0xbfe6d8, 0xdff3ec], // pale icy pines
  ruins: [0x7fae5f, 0x94bd74],
  sunfall: [0xc79b3c, 0xd9ad55, 0xa8842f],
  meadow: [0x3fae4a, 0x63c93f, 0x2f9e57],
};

export function buildRealmTrees(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x51ab73e1);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  // one InstancedMesh set per realm (trunk + shared canopy geo)
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.48, 3.1, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(2.7, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x71482a, flatShading: true });

  const PER_REALM = 420;
  const sets = [];
  for (const region of REGIONS) {
    const leafMats = REALM_TREES[region.id].map(
      (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }),
    );
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, PER_REALM);
    const canopies = leafMats.map(
      (m) => new THREE.InstancedMesh(canopyGeo, m, Math.ceil((PER_REALM * 2) / leafMats.length)),
    );
    for (const c of canopies) {
      c.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.count * 3).fill(1), 3);
    }
    scene.add(trunks);
    for (const c of canopies) scene.add(c);
    sets.push({ region, trunks, canopies, counts: [0, 0, 0], placed: 0 });
  }

  let guardTotal = PER_REALM * REGIONS.length * 10;
  let setIdx = 0;
  while (guardTotal-- > 0 && sets.some((s) => s.placed < PER_REALM)) {
    const s = sets[setIdx % sets.length];
    setIdx++;
    if (s.placed >= PER_REALM) continue;

    // scatter inside the region disc
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * s.region.r * 0.92;
    const x = s.region.x + Math.cos(a) * r;
    const z = s.region.z + Math.sin(a) * r;
    if (Math.abs(x) > WORLD_EDGE || Math.abs(z) > WORLD_EDGE) continue;
    const h = sampler(x, z);
    if (h < 7 || h > 145) continue;

    placeTree(s, x, z, h, rand, dummy, tint);
  }

  for (const s of sets) {
    s.trunks.count = s.placed;
    s.trunks.instanceMatrix.needsUpdate = true;
    for (let ci = 0; ci < s.canopies.length; ci++) {
      s.canopies[ci].count = Math.min(s.canopies[ci].count, s.counts[ci]);
      s.canopies[ci].instanceMatrix.needsUpdate = true;
      if (s.canopies[ci].instanceColor) s.canopies[ci].instanceColor.needsUpdate = true;
    }
  }
}

function placeTree(s, x, z, h, rand, dummy, tint) {
  const scale = 0.9 + rand() * 1.35;
  dummy.position.set(x, h + 1.35 * scale, z);
  dummy.scale.setScalar(scale);
  dummy.rotation.set(0, rand() * Math.PI * 2, 0);
  dummy.updateMatrix();
  s.trunks.setMatrixAt(s.placed, dummy.matrix);

  const ci = s.placed % s.canopies.length;
  for (let b = 0; b < 2; b++) {
    dummy.position.set(
      x + (rand() - 0.5) * scale,
      h + (3.3 + b * 1.45) * scale,
      z + (rand() - 0.5) * scale,
    );
    dummy.scale.setScalar(scale * (b === 0 ? 1 : 0.72));
    dummy.rotation.set(rand(), rand(), rand());
    dummy.updateMatrix();
    const slot = s.counts[ci];
    if (slot < s.canopies[ci].count) {
      s.canopies[ci].setMatrixAt(slot, dummy.matrix);
      const base = new THREE.Color(s.canopies[ci].material.color).getHSL({ h: 0, s: 0, l: 0 });
      tint.setHSL(base.h + (rand() - 0.5) * 0.03, base.s, base.l + (rand() - 0.5) * 0.16);
      s.canopies[ci].setColorAt(slot, tint);
      s.counts[ci]++;
    }
  }
  s.placed++;
}

const WORLD_EDGE = 1900;
