// The player's bird — a stylized low-poly glider with flapping wings.
import * as THREE from 'three';

export function buildBird(scene) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xe8563f, shininess: 30 });
  const bellyMat = new THREE.MeshPhongMaterial({ color: 0xffd9a8 });
  const wingMat = new THREE.MeshPhongMaterial({
    color: 0xff7b4f,
    side: THREE.DoubleSide,
    shininess: 10,
  });
  const beakMat = new THREE.MeshBasicMaterial({ color: 0xffc23d });

  // Body: tapered capsule-ish (cone + sphere)
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 9), bodyMat);
  body.scale.set(0.85, 0.8, 2.2);
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), bellyMat);
  belly.scale.set(0.7, 0.55, 1.9);
  belly.position.y = -0.28;
  group.add(belly);

  // Head + beak + tail
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), bodyMat);
  head.position.set(0, 0.35, -1.75);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), beakMat);
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.3, -2.5);
  group.add(beak);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.5, 4), wingMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.12, 2.15);
  tail.scale.z = 0.25;
  group.add(tail);

  // Wings — pivoted at the root so they can flap around the Z axis
  const wingGeo = new THREE.BufferGeometry();
  // simple swept wing shape in XZ plane, root at origin extending +X
  const wingVerts = new Float32Array([
    0, 0, -0.9,
    0, 0, 1.0,
    6.4, 0, 1.9,
    6.4, 0, 1.9,
    6.0, 0, -0.4,
    0, 0, -0.9,
  ]);
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
  wingGeo.computeVertexNormals();

  const leftWingPivot = new THREE.Group();
  const rightWingPivot = new THREE.Group();

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.scale.x = -1; // mirror to extend -X
  leftWingPivot.add(leftWing);
  leftWingPivot.position.x = -0.7;

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWingPivot.add(rightWing);
  rightWingPivot.position.x = 0.7;

  group.add(leftWingPivot, rightWingPivot);

  scene.add(group);
  return { group, leftWingPivot, rightWingPivot };
}

// Flap phase advances faster with more flap power; wings sweep symmetric arcs.
export function animateBird(bird, flight, flapPower, tSec, bankVisual) {
  bird.group.position.set(flight.pos[0], flight.pos[1], flight.pos[2]);

  // three.js convention: object faces -Z when rotated by yaw about Y.
  bird.group.rotation.set(flight.pitch, flight.heading, flight.roll);

  const flapSpeed = 3 + flapPower * 14;
  const amp = 0.25 + flapPower * 0.75;
  const spread = 0.18 + Math.max(0, -flight.pitch) * 0.45; // glide-spread when diving

  const angle = Math.sin(tSec * flapSpeed) * amp * (flapPower > 0.02 ? 1 : 0.35) - spread;
  bird.leftWingPivot.rotation.z = -angle;
  bird.rightWingPivot.rotation.z = angle;
}
