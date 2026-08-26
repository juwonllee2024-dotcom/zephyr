// Landmarks & life that make the world feel like a place:
// giant sky mantas, island waterfalls, hot-air balloons, glowing crystals,
// ancient stone circles, and a distant rainbow.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

// ---------- Sky mantas: colossal gentle giants gliding in circles ----------
export function buildSkyMantas(scene, rand) {
  const mantas = [];
  let i = 0;
  const bodyMat = new THREE.MeshPhongMaterial({
    color: 0x3d4f8a,
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 30,
  });
  const bellyMat = new THREE.MeshPhongMaterial({ color: 0xcfd8ee });

  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), bodyMat);
    body.scale.set(1.15, 0.32, 1.7);
    g.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(8.4, 10, 7), bellyMat);
    belly.scale.set(1.05, 0.22, 1.55);
    belly.position.y = -0.9;
    g.add(belly);

    // tail streamer
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.08, 22, 6), bodyMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 20;
    g.add(tail);

    // cephalic fins
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 5), bodyMat);
      horn.position.set(s * 2.6, 1.2, -13);
      horn.rotation.x = -1.9;
      g.add(horn);
    }

    // flapping wing planes (pivot at body)
    const wings = [];
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0, -7, 0, 0, 7, 26, 1.5, 9, 26, 1.5, -9, 0, 0, -7, 26, 1.5, 9]),
        3,
      ),
    );
    wingGeo.computeVertexNormals();
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(wingGeo, bodyMat);
      w.scale.x = s;
      pivot.add(w);
      g.add(pivot);
      wings.push({ pivot, s });
    }

    const orbit = {
      r: 420 + rand() * 500,
      y: 260 + rand() * 220,
      speed: 0.03 + rand() * 0.035,
      phase: rand() * Math.PI * 2,
      // first manta guaranteed in view from spawn; others scattered
      cx: i === 0 ? 120 : (rand() * 2 - 1) * 700,
      cz: i === 0 ? -520 : (rand() * 2 - 1) * 700,
      flapPhase: rand() * 10,
    };
    scene.add(g);
    mantas.push({ group: g, wings, orbit });
    i++;
  }
  return mantas;
}

export function updateSkyMantas(mantas, t) {
  for (const m of mantas) {
    const o = m.orbit;
    const a = o.phase + t * o.speed;
    m.group.position.set(o.cx + Math.cos(a) * o.r, o.y + Math.sin(t * 0.21 + o.phase) * 14, o.cz + Math.sin(a) * o.r);
    m.group.rotation.y = -a;
    m.group.rotation.z = Math.sin(t * 0.16 + o.phase) * 0.07;
    const flap = Math.sin(t * 0.85 + o.flapPhase);
    for (const w of m.wings) w.pivot.rotation.z = flap * 0.28 * w.s;
  }
}

// ---------- Waterfalls pouring off floating islands into the sea ----------
export function buildWaterfalls(scene, world, rand) {
  const FALLS = 8;
  const drops = []; // {x,y0,z,len}
  // bias toward islands near the spawn so falls are part of the first view
  const candidates = [...world.islands]
    .sort((a, b) => a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z))
    .slice(0, 14);
  for (let i = 0; i < FALLS; i++) {
    const isl = candidates[Math.floor(rand() * candidates.length)];
    const ang = rand() * Math.PI * 2;
    const x = isl.x + Math.cos(ang) * isl.rx * 0.7;
    const z = isl.z + Math.sin(ang) * isl.rz * 0.7;
    drops.push({ x, y0: isl.y - isl.depth * 0.6, z, len: isl.y - 2 });
  }

  // falling streaks as one Points cloud
  const PER = 90;
  const N = FALLS * PER;
  const posArr = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    seeds[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const tex = makeSoftDot();
  const mat = new THREE.PointsMaterial({
    map: tex,
    color: 0xbfefff,
    transparent: true,
    opacity: 0.75,
    size: 3.2,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // mist puffs at the sea surface
  const mistMat = new THREE.SpriteMaterial({
    map: tex,
    color: 0xeaf7ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const mists = [];
  for (const d of drops) {
    const s = new THREE.Sprite(mistMat.clone());
    s.position.set(d.x, 4, d.z);
    const sc = 18 + d.len * 0.06;
    s.scale.set(sc, sc * 0.5, 1);
    scene.add(s);
    mists.push(s);
  }

  return { points, geo, posArr, seeds, N, drops, PER, mists };
}

export function updateWaterfalls(wf, t) {
  const { posArr, seeds, N, drops, PER } = wf;
  for (let i = 0; i < N; i++) {
    const d = drops[i % drops.length];
    const k = (seeds[i] + t * 0.14) % 1; // 0 top → 1 sea
    const spread = 1 + k * 2.2;
    posArr[i * 3] = d.x + Math.sin(i * 7.13 + k * 5) * spread;
    posArr[i * 3 + 1] = d.y0 - k * d.len;
    posArr[i * 3 + 2] = d.z + Math.cos(i * 5.71 + k * 5) * spread;
  }
  wf.geo.attributes.position.needsUpdate = true;
  for (const m of wf.mists) {
    const s = m.scale.x * (1 + Math.sin(t * 1.7 + m.position.x) * 0.08);
    m.scale.set(s, s * 0.5, 1);
  }
}

// ---------- Hot-air balloons drifting on the wind ----------
export function buildBalloons(scene, rand) {
  const balloons = [];
  const envelopeColors = [0xff6b6b, 0xffd93d, 0x6bcB77, 0x4d96ff, 0xc77dff, 0xff9f45];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();

    const envelope = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 10),
      new THREE.MeshLambertMaterial({ color: envelopeColors[i % envelopeColors.length] }),
    );
    envelope.scale.set(1, 1.2, 1);
    g.add(envelope);

    const stripe = new THREE.Mesh(
      new THREE.SphereGeometry(6.05, 12, 10, 0, Math.PI / 3),
      new THREE.MeshLambertMaterial({ color: 0xfff3e0 }),
    );
    stripe.scale.set(1, 1.2, 1);
    g.add(stripe);

    const basket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4), new THREE.MeshLambertMaterial({ color: 0x8a5a33 }));
    basket.position.y = -8.6;
    g.add(basket);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4), new THREE.MeshBasicMaterial({ color: 0x5c4030 }));
        rope.position.set(sx * 1, -6.2, sz * 1);
        g.add(rope);
      }
    }

    const path = {
      cx: (rand() * 2 - 1) * 600,
      cz: (rand() * 2 - 1) * 600,
      r: 120 + rand() * 260,
      y: 130 + rand() * 200,
      speed: (0.02 + rand() * 0.03) * (rand() > 0.5 ? 1 : -1),
      phase: rand() * Math.PI * 2,
      bobPhase: rand() * 10,
    };
    scene.add(g);
    balloons.push({ group: g, path });
  }
  return balloons;
}

export function updateBalloons(balloons, t) {
  for (const b of balloons) {
    const p = b.path;
    const a = p.phase + t * p.speed;
    b.group.position.set(
      p.cx + Math.cos(a) * p.r,
      p.y + Math.sin(t * 0.4 + p.bobPhase) * 6,
      p.cz + Math.sin(a) * p.r,
    );
    b.group.rotation.y = -a + Math.PI / 2;
  }
}

// ---------- Glowing crystal beacons crowding the pillar tops ----------
export function buildCrystals(scene, world, rand) {
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2fc4ff, transparent: true, opacity: 1 });
  const count = world.pillars.length * 3;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (const p of world.pillars) {
    const h = p.h ?? p.top;
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      dummy.position.set(
        p.x + Math.cos(a) * p.r * 0.45,
        h + p.r * 1.4 + rand() * 3.2,
        p.z + Math.sin(a) * p.r * 0.45,
      );
      // big enough to read as glowing beacons from cruising altitude
      const s = 2.2 + rand() * 2.8;
      dummy.scale.set(s * 0.55, s * (1.5 + rand() * 1.1), s * 0.55);
      dummy.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
      dummy.updateMatrix();
      inst.setMatrixAt(n++, dummy.matrix);
    }
  }
  inst.count = n;
  scene.add(inst);
  return { inst, mat };
}

export function updateCrystals(crystals, t) {
  const k = 0.72 + Math.sin(t * 1.4) * 0.22;
  crystals.mat.color.setRGB(0.5 * k + 0.15, 0.91 * k, 1 * k);
}

// ---------- Ancient stone circles atop the largest islands ----------
export function buildTemples(scene, world, rand) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9aa48e, flatShading: true });
  const glyphMat = new THREE.MeshBasicMaterial({ color: 0x64e6b8, transparent: true, opacity: 0.65 });

  // Always include the island NEAREST to spawn as a first-view landmark,
  // then fill with the largest islands.
  const nearest = [...world.islands].sort(
    (a, b) => a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z),
  )[0];
  const picked = [nearest];
  for (const isl of [...world.islands].sort((a, b) => b.rx * b.rz - a.rx * a.rz)) {
    if (picked.length >= 4) break;
    if (!picked.includes(isl)) picked.push(isl);
  }

  for (const isl of picked) {
    const c = new THREE.Group();
    const R = isl.rx * 0.55;
    const posts = 7;
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7 + rand() * 2, 1.6), stoneMat);
      post.position.set(Math.cos(a) * R, isl.depth * 0.5 + 3.5, Math.sin(a) * R);
      post.rotation.y = a;
      c.add(post);
      if (i % 2 === 0) {
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(R * 0.62, 1.1, 2), stoneMat);
        lintel.position.set(Math.cos(a) * R, isl.depth * 0.5 + 7.8, Math.sin(a) * R);
        lintel.rotation.y = -a + Math.PI / 2;
        c.add(lintel);
      }
    }
    // glowing center stone
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), glyphMat);
    core.position.y = isl.depth * 0.5 + 3;
    c.add(core);
    c.position.set(isl.x, isl.y, isl.z);
    scene.add(c);
    group.add(c);
    group.userData.cores = group.userData.cores ?? [];
    group.userData.cores.push(core);
  }
  return group;
}

export function updateTemples(temples, t) {
  const cores = temples.userData.cores ?? [];
  cores.forEach((core, i) => {
    core.rotation.y = t * (0.5 + i * 0.17);
    core.position.y += Math.sin(t * 1.3 + i) * 0.01;
  });
}

// ---------- A distant rainbow ----------
export function buildRainbow(scene) {
  const geo = new THREE.TorusGeometry(1500, 60, 2, 60, Math.PI);
  const colors = [];
  const band = [
    [1, 0.3, 0.3], [1, 0.65, 0.3], [1, 0.95, 0.4],
    [0.5, 0.95, 0.5], [0.4, 0.75, 1], [0.55, 0.4, 0.95],
  ];
  const segCount = 61; // torus radial segments along the arc (open ended)
  const tubular = 3;
  for (let i = 0; i < segCount; i++) {
    const bandIdx = Math.min(band.length - 1, Math.floor((i / (segCount - 1)) * band.length));
    const c = band[bandIdx];
    for (let j = 0; j < tubular; j++) {
      colors.push(c[0], c[1], c[2]);
    }
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const arc = new THREE.Mesh(geo, mat);
  arc.position.set(-900, 60, -2100);
  arc.rotation.z = 0.12;
  scene.add(arc);
  return arc;
}

function makeSoftDot() {
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
