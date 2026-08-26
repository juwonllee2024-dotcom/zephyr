// The player's bird — fully articulated: lathe-turned body, segmented wings
// (inner/mid/outer with traveling-wave flap lag), primary-feather fans,
// crest, tail fan, eyes, and glowing wingtip trails.
import * as THREE from 'three';

function latheBodyGeo() {
  const prof = [
    [0.02, -2.05], [0.17, -1.7], [0.36, -1.15], [0.54, -0.5],
    [0.64, 0.15], [0.6, 0.8], [0.44, 1.32], [0.2, 1.66], [0.03, 1.76],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 22);
  geo.rotateX(-Math.PI / 2); // profile +Y (chest) → -Z (forward)
  return geo;
}

// Tapered, swept-back wing segment extending +X from its pivot.
function wingSegmentGeo(len, rootChord, tipChord, sweepBack) {
  const geo = new THREE.BoxGeometry(len, 0.07, 1);
  geo.translate(len / 2, 0, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getX(i) / len));
    const chord = rootChord + (tipChord - rootChord) * t;
    pos.setZ(i, pos.getZ(i) * chord + sweepBack * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

function featherFan(count, span, chord) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({
    color: 0xb03a26,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  for (let i = 0; i < count; i++) {
    const k = count === 1 ? 0.5 : i / (count - 1);
    const f = new THREE.Mesh(new THREE.BoxGeometry(span, 0.035, chord), mat);
    f.position.x = span * 0.42;
    f.position.z = 0.1 + k * 0.12;
    f.rotation.y = -0.15 - k * 0.55; // fan backwards
    f.rotation.x = -0.06 * k;
    g.add(f);
  }
  return g;
}

function makeTrail(scene, colorHex) {
  const N = 34;
  const posArr = new Float32Array(N * 3);
  const colArr = new Float32Array(N * 3);
  // comet fade: newest point (tail index) bright, oldest fades to black
  const c = new THREE.Color(colorHex);
  for (let i = 0; i < N; i++) {
    const k = Math.pow(i / (N - 1), 2.6); // steep fade → soft comet tail
    colArr[i * 3] = c.r * k * 0.45;
    colArr[i * 3 + 1] = c.g * k * 0.45;
    colArr[i * 3 + 2] = c.b * k * 0.45;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  return { line, posArr, colArr, N };
}

export function pushTrail(trail, v) {
  const { posArr, colArr, N } = trail;
  posArr.copyWithin(0, 3);
  colArr.copyWithin(0, 3);
  const o = (N - 1) * 3;
  posArr[o] = v.x;
  posArr[o + 1] = v.y;
  posArr[o + 2] = v.z;
  trail.line.geometry.attributes.position.needsUpdate = true;
  trail.line.geometry.attributes.color.needsUpdate = true;
}

export function resetTrail(trail, v) {
  for (let i = 0; i < trail.N; i++) {
    trail.posArr[i * 3] = v.x;
    trail.posArr[i * 3 + 1] = v.y;
    trail.posArr[i * 3 + 2] = v.z;
  }
  trail.line.geometry.attributes.position.needsUpdate = true;
}
export function buildBird(scene) {
  const group = new THREE.Group();
  group.scale.setScalar(1.65); // hero-scale presence on screen

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xd94f3d, shininess: 46 });
  const bellyMat = new THREE.MeshPhongMaterial({ color: 0xffe6bf, shininess: 12 });
  const wingMat = new THREE.MeshPhongMaterial({
    color: 0xf06a33,
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 18,
  });
  const accentMat = new THREE.MeshPhongMaterial({ color: 0x2ea8a0, shininess: 40 }); // teal crest/tail accents
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x26160f });

  // Body + cream belly plate
  const body = new THREE.Mesh(latheBodyGeo(), bodyMat);
  group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), bellyMat);
  belly.scale.set(0.82, 0.6, 1.5);
  belly.position.set(0, -0.22, 0.25);
  group.add(belly);

  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 10), bodyMat);
  neck.position.set(0, 0.32, -1.55);
  neck.rotation.x = 0.5;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 11), bodyMat);
  head.position.set(0, 0.62, -1.82);
  group.add(head);

  // Beak
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 8), new THREE.MeshBasicMaterial({ color: 0xffb521 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.56, -2.38);
  group.add(beak);

  // Crest — three swept teal plumes
  for (let i = 0; i < 3; i++) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.85 - i * 0.14, 6), accentMat);
    plume.position.set((i - 1) * 0.13, 0.88 + i * 0.05, -1.62 - i * 0.1);
    plume.rotation.x = -2.25;
    plume.rotation.z = (i - 1) * 0.28;
    group.add(plume);
  }

  // Eyes with glints
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), darkMat);
    eye.position.set(s * 0.26, 0.72, -1.98);
    group.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(s * 0.31, 0.75, -2.03);
    group.add(glint);
  }

  // Tail fan (accent-tipped)
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.08, 1.85);
  for (let i = 0; i < 5; i++) {
    const k = i - 2;
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 1.35), i % 2 === 0 ? accentMat : wingMat);
    feather.position.z = 0.62;
    feather.rotation.y = k * 0.2;
    tailGroup.add(feather);
  }
  group.add(tailGroup);

  // ---- Segmented wings ------------------------------------------------
  const SEG = [
    { len: 1.7, root: 1.15, tip: 0.95, sweep: 0.1 },
    { len: 1.55, root: 0.95, tip: 0.7, sweep: 0.28 },
    { len: 1.45, root: 0.7, tip: 0.34, sweep: 0.42 },
  ];

  function buildWing(side) {
    // side: +1 right (+X), -1 left (-X)
    let parent = group;
    const pivots = [];
    let tipAnchor = null;
    for (let i = 0; i < SEG.length; i++) {
      const s = SEG[i];
      const pivot = new THREE.Group();
      // first segment roots at the shoulder; later segments continue from the previous tip
      pivot.position.set(i === 0 ? 0.45 * side : SEG[i - 1].len, 0, i === 0 ? -0.1 : 0);
      const seg = new THREE.Mesh(wingSegmentGeo(s.len, s.root, s.tip, s.sweep), wingMat);
      seg.scale.x = side;
      pivot.add(seg);
      if (i === SEG.length - 1) {
        const fan = featherFan(4, 1.5, 0.34);
        fan.position.x = s.len * side;
        fan.scale.x = side;
        pivot.add(fan);
        tipAnchor = new THREE.Object3D();
        tipAnchor.position.x = (s.len + 0.7) * side;
        pivot.add(tipAnchor);
      }
      parent.add(pivot);
      pivots.push(pivot);
      parent = pivot;
    }
    return { pivots, tip: tipAnchor };
  }

  const R = buildWing(1);
  const L = buildWing(-1);

  // Wingtip trails
  const trailR = makeTrail(scene, 0xffc46b);
  const trailL = makeTrail(scene, 0xffc46b);

  scene.add(group);
  return {
    group,
    R: R.pivots,
    L: L.pivots,
    tipR: R.tip,
    tipL: L.tip,
    tailGroup,
    trailR,
    trailL,
  };
}

// Traveling-wave flap: each segment lags the previous → organic wing motion.
export function animateBird(bird, flight, flapPower, tSec) {
  bird.group.position.set(flight.pos[0], flight.pos[1], flight.pos[2]);
  bird.group.rotation.set(flight.pitch, flight.heading, flight.roll);

  const gliding = flapPower < 0.02;
  const flapSpeed = 3.2 + flapPower * 13;
  const amp = gliding ? 0.06 : 0.3 + flapPower * 0.62;
  const diveSpread = gliding ? Math.max(0, -flight.pitch) * 0.4 : 0;

  // Gliding holds a shallow V (dihedral); flapping sweeps a traveling wave.
  const a0 = Math.sin(tSec * flapSpeed) * amp + (gliding ? 0.22 : 0.04) - diveSpread;
  const a1 = Math.sin(tSec * flapSpeed - 0.7) * amp * 1.15 + (gliding ? 0.12 : 0.02);
  const a2 = Math.sin(tSec * flapSpeed - 1.4) * amp * 1.3;

  // Right wing lifts with +Z rotation, left mirrors with -Z.
  bird.R[0].rotation.z = a0;
  bird.R[1].rotation.z = a1;
  bird.R[2].rotation.z = a2;
  bird.L[0].rotation.z = -a0;
  bird.L[1].rotation.z = -a1;
  bird.L[2].rotation.z = -a2;

  // Tail feathers counter-pitch for balance
  bird.tailGroup.rotation.x = flight.pitch * 0.55;
}
