// Scene assembly: renderer, sky dome, lighting, fog, water, sun.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  return renderer;
}

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SKY_FRAG = `
  varying vec3 vDir;
  uniform vec3 zenith;
  uniform vec3 mid;
  uniform vec3 horizon;
  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
    col = mix(col, zenith, smoothstep(0.25, 0.85, h));
    // warm bloom around the sun azimuth (sun sits toward -Z,+X low on the sky)
    vec3 sunDir = normalize(vec3(0.55, 0.28, -0.79));
    float sunAmt = pow(max(dot(normalize(vDir), sunDir), 0.0), 6.0);
    col += vec3(1.0, 0.62, 0.30) * sunAmt * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildScene(scene) {
  scene.fog = new THREE.Fog(0xf2c391, 340, 2400);

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(6000, 28, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x2c4a7c) },
      mid: { value: new THREE.Color(0x8fb6dd) },
      horizon: { value: new THREE.Color(0xffd9a3) },
    },
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Lights — golden hour
  const hemi = new THREE.HemisphereLight(0xbdd7ff, 0x6e5a3f, 0.85);
  scene.add(hemi);

  const sunDir = new THREE.Vector3(0.55, 0.28, -0.79).normalize();
  const sun = new THREE.DirectionalLight(0xffdfb0, 1.35);
  sun.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sun);

  // Sun disc billboard
  const sunSprite = new THREE.Sprite(makeGlowMaterial('#fff3d0', 0.9));
  sunSprite.position.copy(sunDir).multiplyScalar(5200);
  sunSprite.scale.set(900, 900, 1);
  scene.add(sunSprite);

  // Ocean plane
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x1d5c86,
    transparent: true,
    opacity: 0.88,
    shininess: 90,
    specular: 0x88bbff,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  return { sky, sun };
}

// Soft radial glow texture shared by sprites (sun, ring halos, clouds).
export function makeRadialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGlowMaterial(colorHex, opacity = 0.8) {
  return new THREE.SpriteMaterial({
    map: makeRadialTexture(colorHex, 'rgba(255,255,255,0)'),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
