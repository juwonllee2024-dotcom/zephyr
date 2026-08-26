// Six-Realms landmark layer: the Verdant Great Tree, Frostveil ice spires,
// Ruins obelisks & colonnades, plus per-region ambient particle fields
// (petals, snow, embers, fireflies, golden dust).
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { REGIONS } from '../core/world-themes.js';

function softDot() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

let DOT = null;
function getDot() {
  return (DOT ??= softDot());
}

// ---------- The Verdant Heart: a colossal life-tree ----------
export function buildGreatTree(scene) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6d4a30, flatShading: true });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x8fe07a, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xd6ffb0, transparent: true, opacity: 0.5 });

  // twisted trunk from stacked, offset segments
  let y = 0;
  let sway = 0;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(9 - i * 0.9, 11 - i * 0.9, 16, 8), trunkMat);
    seg.position.set(Math.sin(sway) * 3.5, y + 8, Math.cos(sway * 0.8) * 3.5);
    seg.rotation.y = sway;
    g.add(seg);
    y += 13.5;
    sway += 0.55;
  }

  // root flare
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 4.5, 14, 5), trunkMat);
    root.position.set(Math.cos(a) * 10, 3, Math.sin(a) * 10);
    root.rotation.z = Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }

  // canopy blobs
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(20 - (i % 3) * 4, 0), leafMat);
    blob.position.set(Math.cos(a) * 22, y + 10 + Math.sin(i * 2.1) * 9, Math.sin(a) * 22);
    g.add(blob);
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(24, 0), leafMat);
  crown.position.y = y + 18;
  g.add(crown);

  // glowing motes hovering in the canopy
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9 + Math.random() * 0.7, 0), glowMat);
    const a = Math.random() * Math.PI * 2;
    m.position.set(Math.cos(a) * (12 + Math.random() * 22), y + Math.random() * 34, Math.sin(a) * (12 + Math.random() * 22));
    g.add(m);
  }

  const region = REGIONS.find((r) => r.id === 'verdant');
  g.position.set(region.x, 60, region.z);
  scene.add(g);
  return { group: g, baseY: 60 };
}

export function updateGreatTree(tree, t) {
  tree.group.rotation.y = t * 0.02; // imperceptible majesty
  tree.group.position.y = tree.baseY + Math.sin(t * 0.5) * 1.2; // breathing
}

// ---------- Frostveil ice spires ----------
export function buildIceSpires(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x1c3f05b);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xbfe8ff,
    emissive: 0x2b6d99,
    transparent: true,
    opacity: 0.85,
    shininess: 100,
    specular: 0xffffff,
    flatShading: true,
  });
  const region = REGIONS.find((r) => r.id === 'frost');
  const inst = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), mat, 46);
  const dummy = new THREE.Object3D();
  let n = 0;
  let guard = 500;
  while (n < 46 && guard-- > 0) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * region.r * 0.9;
    const x = region.x + Math.cos(a) * r;
    const z = region.z + Math.sin(a) * r;
    const h = sampler(x, z);
    if (h < 25) continue;
    const s = 6 + rand() * 15;
    dummy.position.set(x, h + s * 0.35, z);
    dummy.scale.set(s * (0.32 + rand() * 0.3), s * (1.1 + rand() * 0.9), s * (0.32 + rand() * 0.3));
    dummy.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI, (rand() - 0.5) * 0.28);
    dummy.updateMatrix();
    inst.setMatrixAt(n++, dummy.matrix);
  }
  inst.count = n;
  scene.add(inst);
  return { inst };
}

// ---------- Skyfolk ruins: glowing obelisk + broken colonnade ----------
export function buildObelisks(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x0be115e);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9aa48e, flatShading: true });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0x64e6ff, transparent: true, opacity: 0.8 });
  const region = REGIONS.find((r) => r.id === 'ruins');
  const group = new THREE.Group();
  const runes = [];

  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * region.r * 0.75;
    const x = region.x + Math.cos(a) * r;
    const z = region.z + Math.sin(a) * r;
    const h = sampler(x, z);
    if (h < 12) continue;

    const site = new THREE.Group();
    site.position.set(x, h, z);

    const H = 34 + rand() * 26;
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, H, 4), stoneMat);
    obelisk.position.y = H / 2;
    site.add(obelisk);

    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(3.4, 0), runeMat);
    cap.position.y = H + 3;
    site.add(cap);
    runes.push(cap);

    // broken colonnade ring
    const posts = 4 + Math.floor(rand() * 4);
    for (let pIdx = 0; pIdx < posts; pIdx++) {
      const pa = (pIdx / posts) * Math.PI * 2;
      const ph = 5 + rand() * 8;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, ph, 6), stoneMat);
      post.position.set(Math.cos(pa) * 13, ph / 2 - rand() * 2, Math.sin(pa) * 13);
      post.rotation.z = (rand() - 0.5) * 0.22;
      site.add(post);
    }
    group.add(site);
  }
  scene.add(group);
  return { runes };
}

export function updateObelisks(ruins, t) {
  ruins.runes.forEach((cap, i) => {
    cap.rotation.y = t * (0.6 + i * 0.13);
    cap.position.y += Math.sin(t * 1.1 + i * 2) * 0.02;
  });
}

// ---------- Per-realm ambient particles ----------
const AMBIENT = {
  sakura: { color: 0xffc2da, count: 320, size: 3.2, rise: -1.2 },   // falling petals
  frost: { color: 0xffffff, count: 380, size: 2.4, rise: -0.7 },    // snowfall
  autumn: { color: 0xff9f45, count: 260, size: 2.8, rise: 0.9 },    // rising embers
  verdant: { color: 0xd6ffb0, count: 240, size: 2.6, rise: 0.5 },   // firefly glow
  sunfall: { color: 0xffd27a, count: 220, size: 2.4, rise: 0.35 },  // golden dust
};

export function buildRealmAmbience(scene) {
  const fields = [];
  for (const [id, cfg] of Object.entries(AMBIENT)) {
    const region = REGIONS.find((r) => r.id === id);
    const rand = mulberry32(id.length * 7919 ^ region.x | 0);
    const N = cfg.count;
    const posArr = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * region.r;
      posArr[i * 3] = region.x + Math.cos(a) * r;
      posArr[i * 3 + 1] = 40 + rand() * 260;
      posArr[i * 3 + 2] = region.z + Math.sin(a) * r;
      seeds.push(rand() * Math.PI * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat = new THREE.PointsMaterial({
      map: getDot(),
      color: cfg.color,
      transparent: true,
      opacity: 0.8,
      size: cfg.size,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    fields.push({ points, geo, posArr, seeds, N, cx: region.x, cz: region.z, r: region.r, rise: cfg.rise, id });
  }
  return fields;
}

export function updateRealmAmbience(fields, t) {
  for (const f of fields) {
    for (let i = 0; i < f.N; i++) {
      f.posArr[i * 3 + 1] += f.rise * 0.016 + Math.sin(t + f.seeds[i]) * 0.01;
      f.posArr[i * 3] += Math.cos(t * 0.4 + f.seeds[i]) * 0.04; // gentle drift
      const top = f.rise > 0 ? 300 : 40;
      if (f.posArr[i * 3 + 1] > 310 || f.posArr[i * 3 + 1] < 30) f.posArr[i * 3 + 1] = 175 + Math.sin(f.seeds[i]) * 120;
    }
    f.geo.attributes.position.needsUpdate = true;
  }
}
