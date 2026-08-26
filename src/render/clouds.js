// Soft volumetric-looking clouds built from layered glow sprites.
// Each sprite carries its own material so opacity can fade per-distance —
// otherwise flying through a cloud whites out the whole screen.
import * as THREE from 'three';
import { makeRadialTexture } from './scene-builder.js';

let cloudTex = null;
function getCloudTexture() {
  if (!cloudTex) cloudTex = makeRadialTexture('rgba(255,250,244,0.92)', 'rgba(255,250,244,0)');
  return cloudTex;
}

export function buildClouds(scene, world) {
  const group = new THREE.Group();
  const sprites = [];

  for (const c of world.clouds) {
    // each cloud is a small cluster of sprites → fluffy silhouette
    const puffs = 3 + (Math.floor(c.scale) % 3);
    for (let i = 0; i < puffs; i++) {
      const mat = new THREE.SpriteMaterial({
        map: getCloudTexture(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      const offX = (i - (puffs - 1) / 2) * c.scale * 0.55;
      s.position.set(c.x + offX, c.y + Math.sin(i * 2.7) * c.scale * 0.08, c.z + Math.cos(i * 1.9) * c.scale * 0.18);
      const sc = c.scale * (1.15 - 0.13 * Math.abs(i - (puffs - 1) / 2));
      s.scale.set(sc, sc * 0.62, 1);
      group.add(s);
      sprites.push({ sprite: s, mat, base: 0.42, radius: sc * 0.5 });
    }
  }
  scene.add(group);
  return { group, sprites };
}

// Fade any puff the camera is inside/near so clouds read as volume, not walls.
export function updateClouds(clouds, camera) {
  if (!camera) return;
  for (const p of clouds.sprites) {
    const d = camera.position.distanceTo(p.sprite.position);
    const k = Math.min(1, Math.max(0.05, (d - p.radius * 0.7) / (p.radius * 1.6)));
    p.mat.opacity = p.base * k;
  }
}
