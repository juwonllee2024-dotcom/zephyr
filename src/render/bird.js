// The player's bird — V3: sculpted silhouette. Curved extruded wing planform
// (real airfoil outline, not boxes), two-joint wings with traveling-wave flap,
// slim lathe body, forked tail, crest, and comet wingtip trails.
import * as THREE from 'three';

function latheBodyGeo() {
  const prof = [
    [0.02, -1.95], [0.14, -1.62], [0.3, -1.1], [0.46, -0.45],
    [0.54, 0.2], [0.5, 0.85], [0.37, 1.35], [0.16, 1.68], [0.02, 1.78],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Curved wing outline (span = +X, chord = +Y/backward) extruded thin.
function innerWingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -1.05);
  s.quadraticCurveTo(2.2, -1.5, 3.4, -1.05);   // swept leading edge
  s.lineTo(3.5, 0.35);                          // inner-tip
  s.quadraticCurveTo(1.8, 0.95, 0, 1.3);        // trailing curve to root
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 1,
  });
  g.rotateX(Math.PI / 2); // shape +Y → world +Z (backward)
  return g;
}

function outerWingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -1.0);
  s.quadraticCurveTo(1.7, -1.05, 2.9, -0.25);   // tapering lead to pointed tip
  s.quadraticCurveTo(3.15, 0.05, 2.75, 0.4);    // rounded primary tip
  s.quadraticCurveTo(1.4, 0.85, 0, 0.55);       // scalloped trailing edge
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.04, bevelSegments: 1,
  });
  g.rotateX(Math.PI / 2);
  return g;
}

function makeTrail(scene, colorHex) {
  const N = 34;
  const posArr = new Float32Array(N * 3);
  const colArr = new Float32Array(N * 3);
  const c = new THREE.Color(colorHex);
  for (let i = 0; i < N; i++) {
    const k = Math.pow(i / (N - 1), 2.6);
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
  return { line, posArr, N };
}

export function pushTrail(trail, v) {
  const { posArr, N } = trail;
  posArr.copyWithin(0, 3);
  const o = (N - 1) * 3;
  posArr[o] = v.x;
  posArr[o + 1] = v.y;
  posArr[o + 2] = v.z;
  trail.line.geometry.attributes.position.needsUpdate = true;
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
  group.scale.setScalar(1.5);

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xd94f3d, shininess: 52 });
  const bellyMat = new THREE.MeshPhongMaterial({ color: 0xffe9c4, shininess: 14 });
  const wingMat = new THREE.MeshPhongMaterial({
    color: 0xef6a35,
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 26,
  });
  const accentMat = new THREE.MeshPhongMaterial({ color: 0x21b3a6, shininess: 46 });
  const tipMat = new THREE.MeshPhongMaterial({
    color: 0xb84a26, // darker primary feathers → two-tone raptor wings
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 20,
  });

  // Body + belly + neck + head
  const body = new THREE.Mesh(latheBodyGeo(), bodyMat);
  group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), bellyMat);
  belly.scale.set(0.78, 0.55, 1.55);
  belly.position.set(0, -0.2, 0.3);
  group.add(belly);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.6, 10), bodyMat);
  neck.position.set(0, 0.3, -1.5);
  neck.rotation.x = 0.55;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 11), bodyMat);
  head.position.set(0, 0.56, -1.76);
  group.add(head);

  // Beak — upper + lower mandible
  const beakUp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.58, 8), new THREE.MeshBasicMaterial({ color: 0xffb521 }));
  beakUp.rotation.x = -Math.PI / 2;
  beakUp.position.set(0, 0.57, -2.28);
  group.add(beakUp);
  const beakLo = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xe09a12 }));
  beakLo.rotation.x = -Math.PI / 2;
  beakLo.position.set(0, 0.49, -2.16);
  group.add(beakLo);

  // Crest plumes
  for (let i = 0; i < 3; i++) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8 - i * 0.13, 6), accentMat);
    plume.position.set((i - 1) * 0.11, 0.82 + i * 0.04, -1.58 - i * 0.08);
    plume.rotation.x = -2.3;
    plume.rotation.z = (i - 1) * 0.3;
    group.add(plume);
  }

  // Eyes
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x26160f }));
    eye.position.set(s * 0.23, 0.64, -1.92);
    group.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(s * 0.27, 0.67, -1.96);
    group.add(glint);
  }

  // Forked tail fan
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.06, 1.7);
  for (let i = 0; i < 5; i++) {
    const k = i - 2;
    const len = 1.5 - Math.abs(k) * 0.32;
    const feather = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.028, len),
      Math.abs(k) === 2 ? accentMat : wingMat,
    );
    feather.position.set(0, 0, len / 2 + 0.1);
    feather.rotation.y = k * 0.24;
    const holder = new THREE.Group();
    holder.rotation.y = k * 0.1;
    holder.add(feather);
    tailGroup.add(holder);
  }
  group.add(tailGroup);

  // ---- Wings: inner + outer joint per side -----------------------------
  function buildWing(side) {
    const innerPivot = new THREE.Group();
    innerPivot.position.set(0.3 * side, 0.08, -0.2);

    const inner = new THREE.Mesh(innerWingGeo(), wingMat);
    inner.scale.x = side;
    innerPivot.add(inner);

    // teal shoulder patch
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), accentMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(0.85 * side, 0.085, 0.15);
    innerPivot.add(patch);

    const outerPivot = new THREE.Group();
    outerPivot.position.set(3.45 * side, 0, -0.1);
    const outer = new THREE.Mesh(outerWingGeo(), tipMat);
    outer.scale.x = side;
    outerPivot.add(outer);

    const tipAnchor = new THREE.Object3D();
    tipAnchor.position.set(3.0 * side, 0, -0.2);
    outerPivot.add(tipAnchor);

    innerPivot.add(outerPivot);
    group.add(innerPivot);
    return { innerPivot, outerPivot, tipAnchor };
  }

  const Rw = buildWing(1);
  const Lw = buildWing(-1);

  const trailR = makeTrail(scene, 0xffc46b);
  const trailL = makeTrail(scene, 0xffc46b);

  scene.add(group);
  return {
    group,
    R: Rw,
    L: Lw,
    tipR: Rw.tipAnchor,
    tipL: Lw.tipAnchor,
    tailGroup,
    trailR,
    trailL,
  };
}

export function animateBird(bird, flight, flapPower, tSec) {
  bird.group.position.set(flight.pos[0], flight.pos[1], flight.pos[2]);
  // Aircraft convention: yaw → pitch → roll. Roll sign is NEGATED because a
  // right turn (positive roll in our physics) must dip the RIGHT wing —
  // rotating +Z lifts +X (right wing UP), which is a left bank.
  bird.group.rotation.order = 'YXZ';
  bird.group.rotation.set(flight.pitch, flight.heading, -flight.roll);

  const gliding = flapPower < 0.02;
  const f = 3.2 + flapPower * 13;
  const amp = gliding ? 0.05 : 0.28 + flapPower * 0.6;
  const diveSpread = gliding ? Math.max(0, -flight.pitch) * 0.35 : 0;

  const aIn = Math.sin(tSec * f) * amp + (gliding ? 0.2 : 0.03) - diveSpread;
  const aOut = Math.sin(tSec * f - 0.85) * amp * 1.15 + (gliding ? 0.3 : 0.05);

  bird.R.innerPivot.rotation.z = aIn;
  bird.R.outerPivot.rotation.z = aOut;
  bird.L.innerPivot.rotation.z = -aIn;
  bird.L.outerPivot.rotation.z = -aOut;

  bird.tailGroup.rotation.x = flight.pitch * 0.5;
  bird.tailGroup.rotation.y = flight.roll * 0.35;
}
