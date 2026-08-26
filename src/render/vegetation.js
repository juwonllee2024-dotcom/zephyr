// Palworld-grade vegetation & props: instanced trees (trunk + 2-tier canopy),
// boulders, flower patches — plus autumn and sakura biome groves.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { WORLD_SIZE } from '../core/world-gen.js';

const HALF = WORLD_SIZE / 2;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function buildVegetation(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const dummy = new THREE.Object3D();

  // ---------- trees ----------
  const TREES = 1600;
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 3.2, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(2.9, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a4d2b, flatShading: true });
  const leafMats = [
    new THREE.MeshLambertMaterial({ color: 0x3fae4a, flatShading: true }),
    new THREE.MeshLambertMaterial({ color: 0x63c93f, flatShading: true }),
    new THREE.MeshLambertMaterial({ color: 0x2f9e57, flatShading: true }),
  ];
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
  const canopies = leafMats.map((m) => new THREE.InstancedMesh(canopyGeo, m, Math.ceil((TREES * 2) / leafMats.length)));
  const canopyCount = [0, 0, 0];
  const leafBase = leafMats.map((m) => new THREE.Color(m.color).getHSL({ h: 0, s: 0, l: 0 }));
  const tint = new THREE.Color();
  for (const c of canopies) c.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.count * 3).fill(1), 3);

  // ---------- boulders ----------
  const ROCKS = 380;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8f8a7d, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  let rockN = 0;

  // ---------- flower points (single draw call, per-vertex colors) ----------
  const FLOWERS = 2600;
  const petalTex = makeFlowerTexture();
  const fPos = [];
  const fCol = [];
  const palette = [
    [1.0, 0.44, 0.57], [1.0, 0.85, 0.24], [1.0, 0.62, 0.27],
    [0.94, 0.33, 0.33], [0.78, 0.49, 1.0], [1, 1, 1],
  ];
  let flowerTries = 0;
  while (fPos.length / 3 < FLOWERS && flowerTries < FLOWERS * 6) {
    flowerTries++;
    const x = (rand() * 2 - 1) * HALF * 0.9;
    const z = (rand() * 2 - 1) * HALF * 0.9;
    const h = sampler(x, z);
    if (h < 7 || h > 70) continue;
    fPos.push(x, h + 0.55, z);
    const c = palette[Math.floor(rand() * palette.length)];
    fCol.push(c[0], c[1], c[2]);
  }
  const flowerGeo = new THREE.BufferGeometry();
  flowerGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  flowerGeo.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 3));
  const flowerMat = new THREE.PointsMaterial({
    map: petalTex,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    size: 1.8,
    sizeAttenuation: true,
    alphaTest: 0.08,
  });
  const flowers = new THREE.Points(flowerGeo, flowerMat);
  scene.add(flowers);

  // ---------- trees ----------
  let placedTrees = 0;
  let guard = 0;
  while (placedTrees < TREES && guard < TREES * 12) {
    guard++;
    const x = (rand() * 2 - 1) * HALF * 0.92;
    const z = (rand() * 2 - 1) * HALF * 0.92;
    const h = sampler(x, z);
    if (h < 7 || h > 150) continue;           // beaches to lower hills only
    if (rand() < 0.25 && h > 90) continue;    // thin out upper slopes

    const s = 1.1 + rand() * 1.6;
    dummy.position.set(x, h + 1.4 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(placedTrees, dummy.matrix);

    // two stacked canopy blobs, each with its own tint jitter so forests
    // don't read as copy-paste rows
    const ci = placedTrees % leafMats.length;
    for (let b = 0; b < 2; b++) {
      dummy.position.set(x + (rand() - 0.5) * 1.1 * s, h + (3.4 + b * 1.5) * s, z + (rand() - 0.5) * 1.1 * s);
      dummy.scale.setScalar(s * (b === 0 ? 1 : 0.72));
      dummy.rotation.set(rand(), rand(), rand());
      dummy.updateMatrix();
      const slot = canopyCount[ci];
      if (slot < canopies[ci].count) {
        canopies[ci].setMatrixAt(slot, dummy.matrix);
        // hue/lightness jitter around the material's base green
        const base = leafBase[ci];
        tint.setHSL(
          clamp01(base.h + (rand() - 0.5) * 0.05),
          clamp01(base.s + (rand() - 0.5) * 0.18),
          clamp01(base.l + (rand() - 0.5) * 0.22),
        );
        canopies[ci].setColorAt(slot, tint);
        canopyCount[ci]++;
      }
    }
    placedTrees++;
  }
  trunks.count = placedTrees;

  guard = 0;
  while (rockN < ROCKS && guard < ROCKS * 12) {
    guard++;
    const x = (rand() * 2 - 1) * HALF * 0.95;
    const z = (rand() * 2 - 1) * HALF * 0.95;
    const h = sampler(x, z);
    if (h < 4) continue;
    const s = 0.8 + rand() * 2.6;
    dummy.position.set(x, h + s * 0.35, z);
    dummy.scale.set(s, s * (0.65 + rand() * 0.4), s);
    dummy.rotation.set(rand(), rand(), rand());
    dummy.updateMatrix();
    rocks.setMatrixAt(rockN++, dummy.matrix);
  }
  rocks.count = rockN;

  scene.add(trunks);
  for (const c of canopies) {
    c.count = Math.min(c.count, canopyCount[leafMats.indexOf(c.material)] ?? c.count);
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
    scene.add(c);
  }
  scene.add(rocks);
  scene.add(flowers);

  buildBiomes(scene, sampler, seed);
  return { trunks, canopies, rocks, flowers };
}

// Distinct biome groves: fiery autumn woods and pink sakura glades.
function buildBiomes(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x51ab73e1);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  const BIOMES = [
    {
      name: 'autumn',
      count: 300,
      colors: [0xd4552e, 0xe08a2c, 0xc7b23a],
      // placed AHEAD of the default flight path (bird spawns heading -Z)
      cx: 380, cz: -680,
      spread: 430,
    },
    {
      name: 'sakura',
      count: 280,
      colors: [0xff9ec7, 0xffb7d5, 0xf27ba8],
      cx: -620, cz: -800,
      spread: 420,
    },
  ];

  for (const bio of BIOMES) {
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 3.0, 6);
    const canopyGeo = new THREE.IcosahedronGeometry(2.6, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6d4326, flatShading: true });
    const leafMats = bio.colors.map(
      (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }),
    );
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, bio.count);
    const canopies = leafMats.map(
      (m) => new THREE.InstancedMesh(canopyGeo, m, Math.ceil((bio.count * 2) / leafMats.length)),
    );
    const counts = [0, 0, 0];
    for (const c of canopies) {
      c.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.count * 3).fill(1), 3);
    }

    let placed = 0;
    let guard = 0;
    const cx = bio.cx;
    const cz = bio.cz;
    while (placed < bio.count && guard < bio.count * 12) {
      guard++;
      const x = cx + (rand() * 2 - 1) * bio.spread;
      const z = cz + (rand() * 2 - 1) * bio.spread;
      const h = sampler(x, z);
      if (h < 7 || h > 130) continue;
      const s = 0.9 + rand() * 1.3;
      dummy.position.set(x, h + 1.3 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      const ci = placed % 3;
      for (let b = 0; b < 2; b++) {
        dummy.position.set(x + (rand() - 0.5) * s, h + (3.2 + b * 1.4) * s, z + (rand() - 0.5) * s);
        dummy.scale.setScalar(s * (b === 0 ? 1 : 0.7));
        dummy.rotation.set(rand(), rand(), rand());
        dummy.updateMatrix();
        const slot = counts[ci];
        if (slot < canopies[ci].count) {
          canopies[ci].setMatrixAt(slot, dummy.matrix);
          const base = new THREE.Color(leafMats[ci].color).getHSL({ h: 0, s: 0, l: 0 });
          tint.setHSL(base.h + (rand() - 0.5) * 0.04, base.s, base.l + (rand() - 0.5) * 0.18);
          canopies[ci].setColorAt(slot, tint);
          counts[ci]++;
        }
      }
      placed++;
    }
    trunks.count = placed;
    scene.add(trunks);
    for (const c of canopies) {
      c.count = Math.min(c.count, counts[leafMats.indexOf(c.material)] ?? c.count);
      if (c.instanceColor) c.instanceColor.needsUpdate = true;
      scene.add(c);
    }
  }
}

function makeFlowerTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const palette = ['#ff6f91', '#ffd93d', '#ff9f45', '#f05454', '#c77dff', '#ffffff'];
  const pick = palette[Math.floor(Math.random() * palette.length)];
  g.fillStyle = pick;
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * S * 0.22, S / 2 + Math.sin(a) * S * 0.22, S * 0.17, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffe9a8';
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.13, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- ambient life: circling bird flocks ----------
export function buildFlocks(scene, world, rand) {
  const flocks = [];
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6, side: THREE.DoubleSide });
  const bodyGeo = new THREE.ConeGeometry(0.35, 1.6, 5);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, -0.5, 0, 0, 0.5, 1.6, 0, 0.2]), 3),
  );
  wingGeo.computeVertexNormals();

  for (let f = 0; f < 7; f++) {
    const group = new THREE.Group();
    const members = [];
    const n = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, wingMat);
      body.rotation.x = -Math.PI / 2;
      b.add(body);
      const wl = new THREE.Mesh(wingGeo, wingMat);
      wl.scale.x = -1;
      b.add(wl);
      const wr = new THREE.Mesh(wingGeo, wingMat);
      b.add(wr);
      b.position.set((rand() - 0.5) * 26, (rand() - 0.5) * 10, (rand() - 0.5) * 26);
      group.add(b);
      members.push({ obj: b, phase: rand() * Math.PI * 2 });
    }
    const center = {
      x: (rand() * 2 - 1) * 1200,
      y: 200 + rand() * 240,
      z: (rand() * 2 - 1) * 1200,
    };
    const radius = 60 + rand() * 130;
    const speed = 0.08 + rand() * 0.1;
    scene.add(group);
    flocks.push({ group, members, center, radius, speed, t: rand() * 100 });
  }
  return flocks;
}

export function updateFlocks(flocks, dt) {
  for (const f of flocks) {
    f.t += dt * f.speed;
    const cx = f.center.x + Math.cos(f.t) * f.radius;
    const cz = f.center.z + Math.sin(f.t) * f.radius;
    const heading = f.t + Math.PI / 2; // tangent direction
    f.group.position.set(cx, f.center.y + Math.sin(f.t * 2.3) * 12, cz);
    f.group.rotation.y = -heading;
    for (const m of f.members) {
      m.obj.position.y += Math.sin(f.t * 8 + m.phase) * 0.04;
      const flap = Math.sin(f.t * 40 + m.phase) * 0.5;
      m.obj.children[1].rotation.z = flap;
      m.obj.children[2].rotation.z = -flap;
    }
  }
}
