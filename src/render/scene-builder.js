// Scene assembly: renderer, sky dome, lighting, fog, water, sun.
// V2 "Palworld" grade: high-chroma cyan-to-azure sky, saturated golden sun,
// turquoise tropical water.
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
    vec3 col = mix(horizon, mid, smoothstep(0.02, 0.30, h));
    col = mix(col, zenith, smoothstep(0.28, 0.9, h));
    // big friendly sun glow toward -Z,+X
    vec3 sunDir = normalize(vec3(0.5, 0.42, -0.76));
    float sunAmt = pow(max(dot(normalize(vDir), sunDir), 0.0), 5.0);
    col += vec3(1.0, 0.85, 0.45) * sunAmt * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildScene(scene) {
  scene.fog = new THREE.Fog(0xbfe8f7, 420, 2600);

  const skyGeo = new THREE.SphereGeometry(6000, 28, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x1f7ad4)},   // deep azure overhead
      mid: { value: new THREE.Color(0x59b7e8) },     // classic bright blue
      horizon: { value: new THREE.Color(0xcdf3ff) }, // pale tropical haze
    },
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7fae62, 1.15);
  scene.add(hemi);

  const sunDir = new THREE.Vector3(0.5, 0.42, -0.76).normalize();
  const sun = new THREE.DirectionalLight(0xfff1cf, 1.85);
  sun.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sun);

  const sunSprite = new THREE.Sprite(makeGlowMaterial('#fff8dd', 0.95));
  sunSprite.position.copy(sunDir).multiplyScalar(5200);
  sunSprite.scale.set(1000, 1000, 1);
  scene.add(sunSprite);

  // Turquoise tropical water with animated shimmer stripes
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x21c3d6,
    transparent: true,
    opacity: 0.86,
    shininess: 120,
    specular: 0xd8ffff,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.userData.baseColor = new THREE.Color(0x21c3d6);
  scene.add(water);

  return { sky, sun, water };
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
