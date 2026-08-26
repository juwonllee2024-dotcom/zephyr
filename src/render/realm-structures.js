// Six-Realms signature structures — the "cool things" in each kingdom.
// Everything here is deliberately oversized (fantasy-poster scale).
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { REGIONS } from '../core/world-themes.js';

function regionById(id) {
  return REGIONS.find((r) => r.id === id);
}

// ---------- 🌸 Sakura: torii gate avenue across the lagoon ----------
export function buildToriiAvenue(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x70221);
  const red = new THREE.MeshLambertMaterial({ color: 0xd93a3a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b1d16 });
  const group = new THREE.Group();

  const start = regionById('sakura');
  // avenue of 7 gates marching toward the lagoon center, growing taller
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = start.x + (0 - start.x) * t + Math.sin(i * 1.9) * 26;
    const z = start.z + (-340 - start.z) * t;
    const h = Math.max(sampler(x, z), -8);
    const H = 26 + i * 5;

    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, H, 8), red);
      leg.position.set(x + s * (10 + i * 0.8), h + H / 2, z);
      group.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(30 + i * 2, 2.2, 3), red);
    top.position.set(x, h + H, z);
    top.rotation.z = 0.05; // gracefully curved illusion
    group.add(top);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(24 + i * 1.5, 1.4, 2), red);
    mid.position.set(x, h + H * 0.78, z);
    group.add(mid);
    if (i % 2 === 0) {
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 0.5), dark);
      plaque.position.set(x, h + H * 0.9, z);
      group.add(plaque);
    }
  }
  scene.add(group);
  return group;
}

// ---------- ❄️ Frostveil: giant frozen lake + crystal palace spire ----------
export function buildFrozenLake(scene, seed) {
  const region = regionById('frost');
  const geo = new THREE.CircleGeometry(190, 40);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xa8dff5,
    transparent: true,
    opacity: 0.82,
    shininess: 160,
    specular: 0xffffff,
  });
  const lake = new THREE.Mesh(geo, mat);
  lake.position.set(region.x + 120, 47.5, region.z + 90); // sits on the frost plateau
  scene.add(lake);

  // cracked surface lines
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(150, 1.1), crackMat);
    crack.rotation.x = -Math.PI / 2;
    crack.rotation.z = a;
    crack.position.set(lake.position.x + Math.cos(a) * 60, 47.62, lake.position.z + Math.sin(a) * 60);
    scene.add(crack);
  }
  return lake;
}

export function buildIcePalaceSpire(scene, seed) {
  const rand = mulberry32(seed ^ 0x1c3f05b);
  const region = regionById('frost');
  const mat = new THREE.MeshPhongMaterial({
    color: 0xbfe8ff,
    emissive: 0x2b6d99,
    transparent: true,
    opacity: 0.88,
    shininess: 110,
    specular: 0xffffff,
    flatShading: true,
  });
  const group = new THREE.Group();
  const cx = region.x - 180;
  const cz = region.z - 140;

  // colossal central spike cluster
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const dist = 20 + rand() * 90;
    const x = cx + Math.cos(a) * dist;
    const z = cz + Math.sin(a) * dist;
    const H = 34 + rand() * 56; // up to ~90
    const spike = new THREE.Mesh(new THREE.ConeGeometry(6 + rand() * 9, H, 6), mat);
    spike.position.set(x, 52 + H * 0.32, z);
    spike.rotation.set((rand() - 0.5) * 0.34, rand() * Math.PI, (rand() - 0.5) * 0.34);
    group.add(spike);
  }
  // the throne spire
  const king = new THREE.Mesh(new THREE.ConeGeometry(22, 120, 7), mat);
  king.position.set(cx, 52 + 46, cz);
  group.add(king);
  scene.add(group);
  return group;
}

// ---------- 🏛️ Skyfolk: grand ziggurat + obelisk ring + floating arches ----------
export function buildGrandZiggurat(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x51ee);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd8cfae, flatShading: true });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0.85 });
  const region = regionById('ruins');
  const g = new THREE.Group();

  const cx = region.x - 60;
  const cz = region.z + 80;
  let baseY = Math.max(sampler(cx, cz), 18);
  const TIERS = 6;
  let w = 170;
  for (let i = 0; i < TIERS; i++) {
    const tierH = 15;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, tierH, w), stoneMat);
    box.position.set(cx, baseY + tierH / 2 + i * tierH, cz);
    box.rotation.y = i * 0.06;
    g.add(box);
    w *= 0.72;
    baseY += 0;
  }

  // beacon crystal on top
  const capY = baseY + TIERS * 15 + 8;
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(11, 0), runeMat);
  cap.position.set(cx, capY, cz);
  g.add(cap);

  // obelisk ring around it
  const ring = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ox = cx + Math.cos(a) * 210;
    const oz = cz + Math.sin(a) * 210;
    const oy = Math.max(sampler(ox, oz), 15);
    const H = 58 + rand() * 42;
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.6, H, 4), stoneMat);
    ob.position.set(ox, oy + H / 2, oz);
    ob.rotation.y = rand() * Math.PI;
    g.add(ob);
    const runeCap = new THREE.Mesh(new THREE.OctahedronGeometry(4.4, 0), runeMat.clone());
    runeCap.material.opacity = 0.75;
    runeCap.position.set(ox, oy + H + 5, oz);
    g.add(runeCap);
    ring.push(runeCap);
  }

  // floating broken arches orbiting the ziggurat slowly
  const arches = [];
  for (let i = 0; i < 4; i++) {
    const arch = new THREE.Group();
    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 44, 6), stoneMat);
    seg1.position.y = 22;
    arch.add(seg1);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 30, 6), stoneMat);
    seg2.position.set(9, 52, 0);
    seg2.rotation.z = -0.7;
    arch.add(seg2);
    const a = (i / 4) * Math.PI * 2;
    const dist = 300 + i * 40;
    arch.position.set(cx + Math.cos(a) * dist, 130 + rand() * 50, cz + Math.sin(a) * dist);
    arch.userData.orbit = { cx, cz, r: dist, y: arch.position.y, phase: a, speed: 0.02 + rand() * 0.015 };
    g.add(arch);
    arches.push(arch);
  }

  scene.add(g);
  return { group: g, cap, ring, arches };
}

export function updateGrandZiggurat(z, t) {
  z.cap.rotation.y = t * 0.4;
  z.cap.position.y += Math.sin(t * 1.2) * 0.04;
  z.ring.forEach((r, i) => {
    r.rotation.y = -t * (0.5 + i * 0.11);
  });
  for (const a of z.arches) {
    const o = a.userData.orbit;
    const ang = o.phase + t * o.speed;
    a.position.set(o.cx + Math.cos(ang) * o.r, o.y + Math.sin(t * 0.4 + o.phase) * 6, o.cz + Math.sin(ang) * o.r);
    a.rotation.y = -ang;
  }
}

// ---------- 🍁 Autumn: log-cabin village + giant windmill ----------
export function buildAutumnVillage(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0xa777);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc2452e, flatShading: true });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const region = regionById('autumn');
  const group = new THREE.Group();
  const houses = [];

  const cx = region.x - 160;
  const cz = region.z - 120;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.5;
    const r = 30 + rand() * 85;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const h = sampler(x, z);
    if (h < 8) continue;

    const W = 10 + rand() * 6;
    const D = 8 + rand() * 5;
    const Hh = 6 + rand() * 3;
    const house = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), wallMat);
    body.position.y = Hh / 2;
    house.add(body);

    // oversized fantasy roof — nearly as tall as the house
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.92, Hh * 1.35, 4), roofMat);
    roof.position.y = Hh + Hh * 0.66;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.4), woodMat);
    door.position.set(0, 1.6, D / 2);
    house.add(door);

    house.position.set(x, h, z);
    house.rotation.y = rand() * Math.PI;
    group.add(house);
    houses.push(house);
  }

  // the great windmill
  const wx = cx + 150;
  const wz = cz + 60;
  const wh = Math.max(sampler(wx, wz), 10);
  const mill = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 7.5, 34, 8), wallMat);
  tower.position.y = 17;
  mill.add(tower);
  const millRoof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 9, 8), roofMat);
  millRoof.position.y = 38;
  mill.add(millRoof);

  const hub = new THREE.Group();
  hub.position.set(0, 33, 7);
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 17, 0.6), woodMat);
    blade.position.y = 8.5;
    const holder = new THREE.Group();
    holder.rotation.z = (b / 4) * Math.PI * 2;
    holder.add(blade);
    hub.add(holder);
  }
  mill.add(hub);
  mill.position.set(wx, wh, wz);
  group.add(mill);

  scene.add(group);
  return { group, windmillHub: hub };
}

export function updateAutumnVillage(v, dtScaled) {
  v.windmillHub.rotation.z += dtScaled;
}

// ---------- 🌅 Sunfall: monolith towers + oasis ----------
export function buildSunfallMonoliths(scene, seed) {
  const rand = mulberry32(seed ^ 0x5011d);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0xb05c3a, flatShading: true });
  const bandMat = new THREE.MeshLambertMaterial({ color: 0xd98e5a, flatShading: true });
  const region = regionById('sunfall');
  const group = new THREE.Group();
  const towers = [];

  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r = 60 + rand() * 420;
    const x = region.x + Math.cos(a) * r;
    const z = region.z + Math.sin(a) * r;
    const W = 16 + rand() * 14;
    const H = 48 + rand() * 46;

    const tower = new THREE.Group();
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.62, W * 0.78, H * 0.62, 7), rockMat);
    lower.position.y = H * 0.31;
    tower.add(lower);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.45, W * 0.66, H * 0.42, 7), bandMat);
    upper.position.y = H * 0.83;
    tower.add(upper);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(W * 0.5, W * 0.7, 7), rockMat);
    cap.position.y = H + W * 0.28;
    tower.add(cap);

    tower.position.set(x, 24, z);
    group.add(tower);
    towers.push({ group: tower, x, z, r: W * 0.8, top: 24 + H + W * 0.6 });
  }
  scene.add(group);
  return { group, towers };
}

export function buildOasis(scene, seed) {
  const region = regionById('sunfall');
  const geo = new THREE.CircleGeometry(64, 30);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({ color: 0x37c9b8, transparent: true, opacity: 0.85, shininess: 120 }),
  );
  water.position.set(region.x + 260, 25.5, region.z + 200);
  scene.add(water);
  // palms around it
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6238 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x4db36a, flatShading: true });
  const rand = mulberry32(seed ^ 0x04a51);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const px = water.position.x + Math.cos(a) * (70 + rand() * 26);
    const pz = water.position.z + Math.sin(a) * (70 + rand() * 26);
    const palm = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 16, 6), trunkMat);
    tr.position.y = 8;
    tr.rotation.z = (rand() - 0.5) * 0.3;
    palm.add(tr);
    for (let l = 0; l < 5; l++) {
      const la = (l / 5) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.6, 10, 4), leafMat);
      frond.position.set(Math.cos(la) * 3.4, 16.4, Math.sin(la) * 3.4);
      frond.rotation.set(Math.cos(la) * 1.25, 0, -Math.sin(la) * 1.25);
      palm.add(frond);
    }
    palm.position.set(px, 24, pz);
    scene.add(palm);
  }
  return water;
}

// ---------- 💚 Verdant: glowing mushroom rings + spirit pond ----------
export function buildMushroomRings(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0x5beef0);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0xe8dfC8 });
  const caps = [
    new THREE.MeshBasicMaterial({ color: 0x8affc1, transparent: true, opacity: 0.85 }),
    new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.85 }),
  ];
  const region = regionById('verdant');
  const group = new THREE.Group();

  for (let ringI = 0; ringI < 3; ringI++) {
    const cx = region.x + (rand() - 0.5) * 500;
    const cz = region.z + (rand() - 0.5) * 500;
    const R = 26 + rand() * 30;
    const n = 8 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      const h = Math.max(sampler(x, z), 20);
      const shroom = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 7 + rand() * 6, 6), stemMat);
      stem.position.y = 4;
      shroom.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(3.4 + rand() * 2, 8, 6), caps[ringI % 2]);
      cap.scale.y = 0.55;
      cap.position.y = 8 + rand() * 3;
      shroom.add(cap);
      shroom.position.set(x, h, z);
      group.add(shroom);
    }
  }
  scene.add(group);
  return group;
}

export function buildSpiritPond(scene) {
  const region = regionById('verdant');
  const geo = new THREE.CircleGeometry(52, 28);
  geo.rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({
      color: 0x9fe8d0,
      emissive: 0x1f6d55,
      transparent: true,
      opacity: 0.86,
      shininess: 130,
    }),
  );
  pond.position.set(region.x + 230, 33, region.z - 160);
  scene.add(pond);
  return pond;
}

// ---------- 🌼 Hub meadow: two tiny farm hamlets ----------
export function buildHubFarms(scene, sampler, seed) {
  const rand = mulberry32(seed ^ 0xfa77);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x9c7040 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7ba05a, flatShading: true });
  const barnMat = new THREE.MeshLambertMaterial({ color: 0xb5563f });
  const group = new THREE.Group();

  const sites = [
    [240, -240],
    [-300, 160],
  ];
  for (const [sx, sz] of sites) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand();
      const r = 18 + rand() * 30;
      const x = sx + Math.cos(a) * r;
      const z = sz + Math.sin(a) * r;
      const h = sampler(x, z);
      if (h < 6) continue;
      const house = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6.5), wallMat);
      body.position.y = 2.5;
      house.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 4.6, 4), roofMat);
      roof.position.y = 7.2;
      roof.rotation.y = Math.PI / 4;
      house.add(roof);
      house.position.set(x, h, z);
      house.rotation.y = rand() * Math.PI;
      group.add(house);
    }
    // one red barn
    const bx = sx + (rand() - 0.5) * 60;
    const bz = sz + (rand() - 0.5) * 60;
    const bh = sampler(bx, bz);
    if (bh > 6) {
      const barn = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 9), barnMat);
      barn.position.set(bx, bh + 4, bz);
      barn.rotation.y = rand();
      group.add(barn);
      const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(8.4, 5, 4), roofMat);
      barnRoof.position.set(bx, bh + 10.4, bz);
      barnRoof.rotation.y = Math.PI / 4;
      group.add(barnRoof);
    }
  }
  scene.add(group);
  return group;
}
