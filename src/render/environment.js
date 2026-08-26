// Living-environment extras: animated ocean waves, drifting sparkle motes,
// distant mega floating islands (fog silhouettes).
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

// Segmented ocean whose vertices breathe — visible swell from the air.
export function buildOcean(scene) {
  const geo = new THREE.PlaneGeometry(9000, 9000, 88, 88);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x21c3d6,
    transparent: true,
    opacity: 0.87,
    shininess: 130,
    specular: 0xdcffff,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  scene.add(mesh);
  return { mesh, geo, base: Float32Array.from(geo.attributes.position.array) };
}

export function updateOcean(ocean, t) {
  const pos = ocean.geo.attributes.position.array;
  const base = ocean.base;
  for (let i = 0; i < pos.length; i += 3) {
    const x = base[i];
    const z = base[i + 2];
    pos[i + 1] =
      Math.sin(x * 0.0042 + t * 0.9) * 1.5 +
      Math.cos(z * 0.005 + t * 1.15) * 1.3 +
      Math.sin((x + z) * 0.0015 + t * 0.55) * 2.1;
  }
  ocean.geo.attributes.position.needsUpdate = true;
  ocean.geo.computeVertexNormals();
}

// Sparkle motes drifting in the air column — sells altitude and wind.
export function buildMotes(scene, seed) {
  const rand = mulberry32(seed ^ 0x1234abcd);
  const N = 260;
  const posArr = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    posArr[i * 3] = (rand() * 2 - 1) * 1500;
    posArr[i * 3 + 1] = 50 + rand() * 480;
    posArr[i * 3 + 2] = (rand() * 2 - 1) * 1500;
    seeds.push(rand() * Math.PI * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const tex = makeDotTexture();
  const mat = new THREE.PointsMaterial({
    map: tex,
    color: 0xfff8dc,
    transparent: true,
    opacity: 0.55,
    size: 2.6,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, geo, posArr, seeds, N };
}

export function updateMotes(motes, t) {
  const pos = motes.posArr;
  for (let i = 0; i < motes.N; i++) {
    const ph = motes.seeds[i];
    pos[i * 3 + 1] += Math.sin(t * 0.6 + ph) * 0.02 + 0.03;
    pos[i * 3] += Math.sin(t * 0.35 + ph * 2) * 0.03;
    if (pos[i * 3 + 1] > 560) pos[i * 3 + 1] = 50;
  }
  motes.geo.attributes.position.needsUpdate = true;
}

// Huge far-away floating islands — fog-silhouetted landmarks on the horizon.
export function buildMegaIslands(scene, seed) {
  const rand = mulberry32(seed ^ 0x7fea33c1);
  const group = new THREE.Group();
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x86a06b, flatShading: true });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x53b04a, flatShading: true });

  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2 + rand() * 0.5;
    const dist = 1550 + rand() * 500;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const y = 300 + rand() * 320;
    const s = 130 + rand() * 130;

    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.8, s * 0.3, 9), grassMat);
    g.add(top);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.8, s * 0.1, s * 1.1, 9), rockMat);
    under.position.y = -s * 0.65;
    g.add(under);
    g.position.set(x, y, z);
    g.rotation.y = rand() * Math.PI;
    group.add(g);
  }
  scene.add(group);
  return group;
}

function makeDotTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,250,220,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}
