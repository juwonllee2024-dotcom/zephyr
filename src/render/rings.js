// Golden rings + hazard pillars + floating islands from world data.
import * as THREE from 'three';
import { makeRadialTexture } from './scene-builder.js';

export function buildRings(scene, world) {
  const ringObjects = [];
  const torusGeo = new THREE.TorusGeometry(1, 0.075, 10, 40);
  const haloTex = makeRadialTexture('rgba(255,225,170,1)', 'rgba(255,190,110,0)');

  for (const r of world.rings) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    const mesh = new THREE.Mesh(torusGeo, mat);
    mesh.position.set(r.x, r.y, r.z);
    mesh.scale.setScalar(r.radius);

    // Orient the torus so its axis aligns with the ring axis.
    const axis = new THREE.Vector3(r.axisX, r.axisY, r.axisZ).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);

    // Additive halo sprite behind the torus for glow (faded by distance in update).
    // The radial map is essential: a mapless sprite renders as a solid square.
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      color: 0xffc46b,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(r.radius * 2.2, r.radius * 2.2, 1);
    mesh.add(halo);

    scene.add(mesh);
    ringObjects.push({ data: r, mesh, mat, haloMat, passed: false, passedAt: -999 });
  }
  return ringObjects;
}

export function updateRingVisuals(ringObjects, tNow, camera) {
  for (const ro of ringObjects) {
    // Halos must vanish up close or they fill the screen with additive white.
    if (camera && ro.haloMat) {
      const d = camera.position.distanceTo(ro.mesh.position);
      ro.haloMat.opacity = 0.22 * Math.min(1, Math.max(0, (d - 60) / 340));
    }
    if (!ro.passed && ro.mat.color.getHex() !== 0xffb347) {
      ro.mat.color.setHex(0xffb347);
    }
    if (ro.passed && tNow - ro.passedAt < 0.6) {
      // quick celebratory pulse then dim
      const k = 1 + 0.35 * Math.sin((tNow - ro.passedAt) / 0.6 * Math.PI);
      ro.mesh.scale.setScalar(ro.data.radius * k);
      ro.mat.color.setHex(0xfff0b0);
    } else if (ro.passed) {
      ro.mesh.scale.setScalar(ro.data.radius);
      ro.mat.color.setHex(0x5e6b52); // spent rings go muted green-gray
    } else {
      // gentle breathing glow on uncollected rings
      const breathe = 1 + 0.03 * Math.sin(tNow * 2 + ro.data.x * 0.01);
      ro.mesh.scale.setScalar(ro.data.radius * breathe);
    }
  }
}

export function markRingPassed(ro, tNow) {
  ro.passed = true;
  ro.passedAt = tNow;
}

export function buildPillars(scene, world) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshLambertMaterial({ color: 0xb3a184, flatShading: true });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x4f9e46, flatShading: true });

  for (const p of world.pillars) {
    const h = p.h ?? p.top;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(p.r * 0.72, p.r, h, 7, 1),
      rockMat,
    );
    cyl.position.set(p.x, h / 2, p.z);
    cyl.rotation.y = p.r * 3.7; // deterministic per-pillar twist
    group.add(cyl);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(p.r * 1.05, p.r * 1.3, 7), capMat);
    cap.position.set(p.x, h + p.r * 0.6, p.z);
    cap.rotation.y = p.r * 2.1;
    group.add(cap);
  }
  scene.add(group);
  return group;
}

export function buildIslands(scene, world, rand) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x77685c, flatShading: true });
  const topMat = new THREE.MeshLambertMaterial({ color: 0x69a84f, flatShading: true });
  const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const treeLeafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d33, flatShading: true });

  for (const isl of world.islands) {
    const islandGroup = new THREE.Group();
    islandGroup.position.set(isl.x, isl.y, isl.z);

    // Top disc
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.rx, isl.rx * 0.82, isl.depth * 0.35, 9),
      topMat,
    );
    top.position.y = isl.depth * 0.32;
    islandGroup.add(top);

    // Inverted rocky cone underneath
    const under = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.rx * 0.82, isl.rx * 0.16, isl.depth, 9),
      rockMat,
    );
    under.position.y = -isl.depth * 0.34;
    islandGroup.add(under);

    // A few trees
    for (let i = 0; i < isl.treeCount; i++) {
      const a = rand() * Math.PI * 2;
      const rr = rand() * isl.rx * 0.55;
      const tx = Math.cos(a) * rr;
      const tz = Math.sin(a) * rr;
      const trunkH = 1.6 + rand() * 2.2;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, trunkH, 5), treeTrunkMat);
      trunk.position.set(tx, isl.depth * 0.5 + trunkH / 2, tz);
      islandGroup.add(trunk);

      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.3 + rand(), 2.6 + rand() * 2, 6), treeLeafMat);
      leaf.position.set(tx, isl.depth * 0.5 + trunkH + 1.2, tz);
      islandGroup.add(leaf);
    }

    scene.add(islandGroup);
    group.add(islandGroup);
  }
  return group;
}
