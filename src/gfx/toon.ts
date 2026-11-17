// Cartoon look for the 3D world: flat toon shading with dark outlines, shared so every kid reuses the same materials.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let gradientMap: THREE.DataTexture | null = null;
function gradient() {
  if (!gradientMap) {
    // Three bands of light: shadow, mid, and lit.
    const data = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const toonCache = new Map<number, THREE.MeshToonMaterial>();
export function toon(color: number) {
  let m = toonCache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient() });
    toonCache.set(color, m);
  }
  return m;
}

const flatCache = new Map<number, THREE.MeshBasicMaterial>();
export function flat(color: number) {
  let m = flatCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    flatCache.set(color, m);
  }
  return m;
}

export const INK = 0x1d1b2f;
const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// A toon mesh with an inverted-hull outline about `ink` feet thick.
export function part(geo: THREE.BufferGeometry, color: number, ink = 0.05): THREE.Mesh {
  const m = new THREE.Mesh(geo, toon(color));
  if (ink > 0) {
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const r = geo.boundingSphere!.radius || 1;
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar((r + ink) / r);
    o.raycast = () => {};
    m.add(o);
  }
  return m;
}

// Geometry is cached by shape and size, because a team of kids repeats the same parts.
const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}
export const geo = {
  sphere: (r: number, seg = 16) => cached(`s${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75))),
  capsule: (r: number, len: number) => cached(`c${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10)),
  box: (x: number, y: number, z: number) => cached(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z)),
  cyl: (rt: number, rb: number, h: number, seg = 14) => cached(`y${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 10) => cached(`k${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
};

// Text drawn into a canvas, for jersey numbers, signs, and price tags.
export function textTexture(
  text: string,
  o: { w?: number; h?: number; font?: string; color?: string; bg?: string; stroke?: string; size?: number } = {},
) {
  const w = o.w ?? 256;
  const h = o.h ?? 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, w, h);
  }
  g.font = `${o.size ?? Math.round(h * 0.7)}px ${o.font ?? '"Luckiest Guy", system-ui, sans-serif'}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (o.stroke) {
    g.lineWidth = Math.round(h * 0.08);
    g.strokeStyle = o.stroke;
    g.lineJoin = 'round';
    g.strokeText(text, w / 2, h * 0.54);
  }
  g.fillStyle = o.color ?? '#fff';
  g.fillText(text, w / 2, h * 0.54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A flat sign that always faces the camera.
export function label(text: string, height: number, o: Parameters<typeof textTexture>[1] = {}) {
  const w = o.w ?? 256;
  const h = o.h ?? 128;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, { stroke: '#1d1b2f', ...o }), depthTest: true }));
  s.scale.set((height * w) / h, height, 1);
  return s;
}

// A soft dark spot under a kid, cheaper than real shadows on an iPad.
let shadowTex: THREE.CanvasTexture | null = null;
export function blobShadow(r: number) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.38)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  m.renderOrder = -1;
  return m;
}

// Field coordinates (feet) to world space: +x is right field, +y is center field, h is height.
export function P(x: number, y: number, h = 0) {
  return new THREE.Vector3(x, h, -y);
}

// Bright daytime lights for any scene.
export function addLights(scene: THREE.Scene, sky = 0xbfe3ff, ground = 0x6a8f4a) {
  scene.add(new THREE.HemisphereLight(sky, ground, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-40, 80, 30);
  scene.add(sun);
}

// A sky dome that fades from deep blue overhead to pale at the horizon.
export function skyDome(top = 0x3d8be0, horizon = 0xcfeaff, radius = 1500) {
  const g = new THREE.SphereGeometry(radius, 24, 12);
  const pos = g.attributes.position;
  const colors: number[] = [];
  const a = new THREE.Color(horizon);
  const b = new THREE.Color(top);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / radius);
    c.copy(a).lerp(b, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  m.renderOrder = -10;
  return m;
}

// Puffy cartoon clouds.
export function cloud(scale = 1) {
  const g = new THREE.Group();
  const m = flat(0xffffff);
  const bits: [number, number, number, number][] = [
    [0, 0, 0, 14],
    [14, -3, 2, 10],
    [-14, -4, 0, 9],
    [6, 7, -2, 9],
  ];
  for (const [x, y, z, r] of bits) {
    const s = new THREE.Mesh(geo.sphere(r, 10), m);
    s.position.set(x, y, z);
    s.scale.y = 0.7;
    g.add(s);
  }
  g.scale.setScalar(scale);
  return g;
}

// Low-poly trees, used on every outdoor map.
export function tree(scale = 1, kind: 'fir' | 'round' = 'fir') {
  const g = new THREE.Group();
  const trunk = part(geo.cyl(0.8, 1.1, 6, 7), 0x7a4b28, 0);
  trunk.position.y = 3;
  g.add(trunk);
  if (kind === 'fir') {
    for (let i = 0; i < 3; i++) {
      const c = part(geo.cone(7 - i * 1.8, 9, 8), [0x2e7d4a, 0x3a9459, 0x47a866][i], 0);
      c.position.y = 8 + i * 5;
      g.add(c);
    }
  } else {
    const c = part(geo.sphere(7, 10), 0x4caf50, 0);
    c.position.y = 11;
    g.add(c);
  }
  g.scale.setScalar(scale);
  return g;
}

// Bake everything in a group that never moves into one mesh per material, so a park full of trees costs a few draw calls.
export function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    // Keep only what every toon mesh has, so the pieces can be merged.
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g = g as THREE.BufferGeometry;
    const list = byMat.get(m.material) ?? [];
    list.push(g);
    byMat.set(m.material, list);
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list);
    if (merged) out.add(new THREE.Mesh(merged, mat));
    list.forEach((g) => g.dispose());
  }
  return out;
}
