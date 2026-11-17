// The 3D ballpark: a kid-sized field (60-foot bases, 150 feet to center) in Portland, with Mount Hood out past center.
import * as THREE from 'three';
import { fenceR } from '../play';
import { part, geo, toon, flat, P, tree, cloud, skyDome, addLights, textTexture, mergeStatic } from './toon';

export const BASES = [
  { x: 0, y: 0 },
  { x: 42.43, y: 42.43 },
  { x: 0, y: 84.85 },
  { x: -42.43, y: 42.43 },
];

// The painted ground: grass stripes, dirt, chalk lines, all in one texture so it costs one draw call.
const X0 = -150;
const X1 = 150;
const Y0 = -40;
const Y1 = 170;
function groundTexture() {
  const W = 2048;
  const H = Math.round((W * (Y1 - Y0)) / (X1 - X0));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const s = W / (X1 - X0);
  const px = (x: number) => (x - X0) * s;
  const py = (y: number) => (Y1 - y) * s;

  g.fillStyle = '#4caa48';
  g.fillRect(0, 0, W, H);
  // Mowing stripes in a diamond pattern.
  g.save();
  g.translate(px(0), py(0));
  g.rotate(Math.PI / 4);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  const band = 14 * s;
  for (let i = -30; i < 30; i += 2) g.fillRect(i * band, -4000, band, 8000);
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = -30; i < 30; i += 2) g.fillRect(-4000, i * band, 8000, band);
  g.restore();

  const dirt = '#c98f55';
  // Infield dirt: an arc around the mound, cut off at the foul lines.
  g.fillStyle = dirt;
  g.beginPath();
  g.arc(px(0), py(40), 62 * s, Math.PI, Math.PI * 2);
  g.fill();
  // Base paths from home to first and third.
  g.strokeStyle = dirt;
  g.lineWidth = 6 * s;
  g.beginPath();
  g.moveTo(px(BASES[1].x), py(BASES[1].y));
  g.lineTo(px(0), py(0));
  g.lineTo(px(BASES[3].x), py(BASES[3].y));
  g.stroke();
  // Infield grass inside the base paths.
  g.fillStyle = '#4fb04b';
  g.beginPath();
  const inset = 7;
  g.moveTo(px(0), py(inset * 1.6));
  g.lineTo(px(42.43 - inset), py(42.43));
  g.lineTo(px(0), py(84.85 - inset * 1.6));
  g.lineTo(px(-42.43 + inset), py(42.43));
  g.closePath();
  g.fill();
  // Dirt around home plate and the mound, and cut-outs at each base.
  g.fillStyle = dirt;
  const circle = (x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(px(x), py(y), r * s, 0, Math.PI * 2);
    g.fill();
  };
  circle(0, 0, 11);
  circle(0, 43, 6);
  circle(BASES[1].x, BASES[1].y, 6);
  circle(BASES[3].x, BASES[3].y, 6);
  circle(BASES[2].x, BASES[2].y, 6);
  // Warning track along the fence.
  g.strokeStyle = '#b98352';
  g.lineWidth = 8 * s;
  g.beginPath();
  for (let a = -Math.PI / 4; a <= Math.PI / 4 + 0.001; a += 0.02) {
    const r = fenceR(a) - 4;
    const x = px(r * Math.sin(a));
    const y = py(r * Math.cos(a));
    if (a === -Math.PI / 4) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();

  // Chalk.
  g.strokeStyle = '#ffffff';
  g.lineWidth = 0.45 * s;
  g.beginPath();
  g.moveTo(px(0), py(0));
  g.lineTo(px(140), py(140));
  g.moveTo(px(0), py(0));
  g.lineTo(px(-140), py(140));
  g.stroke();
  // Batter's boxes.
  g.lineWidth = 0.3 * s;
  g.strokeRect(px(-4.2), py(2.5), 2.6 * s, 5 * s);
  g.strokeRect(px(1.6), py(2.5), 2.6 * s, 5 * s);
  g.strokeRect(px(-1.3), py(-2), 2.6 * s, 4 * s);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let groundTex: THREE.CanvasTexture | null = null;

// The fence line, from the left-field foul pole around to the right-field pole, then back behind home plate.
function fencePoints() {
  const pts: { x: number; y: number }[] = [];
  for (let a = -Math.PI / 4; a <= Math.PI / 4 + 1e-6; a += Math.PI / 80) {
    const r = fenceR(a);
    pts.push({ x: r * Math.sin(a), y: r * Math.cos(a) });
  }
  pts.push({ x: 95, y: 30 }, { x: 45, y: -14 });
  for (let a = Math.PI * 0.72; a <= Math.PI * 1.28 + 1e-6; a += Math.PI / 24) pts.push({ x: 26 * Math.sin(a), y: 26 * Math.cos(a) });
  pts.push({ x: -45, y: -14 }, { x: -95, y: 30 });
  pts.push(pts[0]);
  return pts;
}

function wall(pts: { x: number; y: number }[], height: number, color: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    pos.push(p.x, 0, -p.y, p.x, height, -p.y);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide }));
  return m;
}

export function buildPark(scene: THREE.Scene, home = 'HOME', away = 'AWAY') {
  scene.background = new THREE.Color(0xcfeaff);
  scene.fog = new THREE.Fog(0xcfeaff, 500, 1400);
  scene.add(skyDome());
  addLights(scene);
  // Everything that never moves gets merged at the end, to keep draw calls low on an iPad.
  const statics = new THREE.Group();

  const outer = new THREE.Mesh(new THREE.CircleGeometry(1400, 40), flat(0x5fae4f));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  scene.add(outer);

  groundTex ??= groundTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Y1 - Y0), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((X0 + X1) / 2, 0, -(Y0 + Y1) / 2);
  scene.add(ground);

  // Bases and home plate.
  for (const b of BASES.slice(1)) {
    const m = part(geo.box(1.3, 0.35, 1.3), 0xffffff, 0.04);
    m.position.copy(P(b.x, b.y, 0.17));
    m.rotation.y = Math.PI / 4;
    statics.add(m);
  }
  const plateShape = new THREE.Shape([
    new THREE.Vector2(-0.71, 0),
    new THREE.Vector2(0.71, 0),
    new THREE.Vector2(0.71, -0.71),
    new THREE.Vector2(0, -1.42),
    new THREE.Vector2(-0.71, -0.71),
  ]);
  const plate = new THREE.Mesh(new THREE.ShapeGeometry(plateShape), flat(0xffffff));
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, 0.04, -0.7);
  plate.rotation.z = Math.PI;
  scene.add(plate);
  const rubber = new THREE.Mesh(geo.box(2, 0.12, 0.5), flat(0xffffff));
  rubber.position.copy(P(0, 43, 0.06));
  statics.add(rubber);

  // Fence: dark green padding with a yellow top, and taller netting behind home.
  const pts = fencePoints();
  statics.add(wall(pts, 6, 0x1f5d3a));
  const top = wall(pts, 0.6, 0xffd23f);
  top.position.y = 6;
  statics.add(top);
  for (const side of [-1, 1]) {
    const pole = part(geo.cyl(0.4, 0.4, 30, 8), 0xffd23f, 0.05);
    pole.position.copy(P(side * 120 * Math.SQRT1_2, 120 * Math.SQRT1_2, 15));
    statics.add(pole);
  }
  const back: { x: number; y: number }[] = [];
  for (let a = Math.PI * 0.72; a <= Math.PI * 1.28 + 1e-6; a += Math.PI / 24) back.push({ x: 26 * Math.sin(a), y: 26 * Math.cos(a) });
  const net = wall(back, 18, 0x9aa5b1);
  (net.material as THREE.Material).transparent = true;
  (net.material as THREE.Material).opacity = 0.35;
  scene.add(net);

  // Dugouts on each side, and bleachers behind them.
  for (const side of [-1, 1]) {
    const dug = new THREE.Group();
    const bench = part(geo.box(24, 1.6, 2), 0x8d6e4a, 0.05);
    bench.position.y = 0.8;
    dug.add(bench);
    const roof = part(geo.box(28, 0.6, 8), side < 0 ? 0x2f6fe0 : 0xe2457a, 0.06);
    roof.position.set(0, 7.5, -1);
    dug.add(roof);
    const backWall = part(geo.box(28, 7.5, 0.6), 0x6c757d, 0.05);
    backWall.position.set(0, 3.75, -4.5);
    dug.add(backWall);
    dug.position.copy(P(side * 58, 4));
    dug.lookAt(P(0, 30));
    statics.add(dug);
    for (let row = 0; row < 4; row++) {
      const step = part(geo.box(30, 1.2, 3), 0xadb5bd, 0.04);
      step.position.copy(P(side * (88 + row * 2.5), -10 - row * 2.5, 0.6 + row * 1.2));
      step.lookAt(P(0, 40, 0.6 + row * 1.2));
      statics.add(step);
    }
  }

  // Scoreboard past center field.
  const board = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 16),
    new THREE.MeshBasicMaterial({ map: textTexture(`${away}  vs  ${home}`, { w: 512, h: 160, bg: '#173d2a', color: '#ffd23f', size: 70 }) }),
  );
  face.position.y = 22;
  board.add(face);
  const frame = part(geo.box(46, 18, 1), 0x0f2a1d, 0.1);
  frame.position.set(0, 22, -0.6);
  board.add(frame);
  for (const s of [-1, 1]) {
    const leg = part(geo.box(1.5, 14, 1.5), 0x343a40, 0);
    leg.position.set(s * 14, 7, -0.6);
    board.add(leg);
  }
  board.position.copy(P(0, 185));
  scene.add(board);

  // Trees around the park and Mount Hood on the horizon.
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI * 0.62 + (i / 69) * Math.PI * 1.24;
    const r = 200 + ((i * 37) % 60);
    const t = tree(1.4 + ((i * 13) % 10) / 10, i % 3 === 0 ? 'round' : 'fir');
    t.position.copy(P(r * Math.sin(a), r * Math.cos(a)));
    statics.add(t);
  }
  for (let i = 0; i < 24; i++) {
    const a = Math.PI * 0.7 + (i / 23) * Math.PI * 0.6;
    const t = tree(1.6, 'fir');
    t.position.copy(P(140 * Math.sin(a), 140 * Math.cos(a) - 20));
    statics.add(t);
  }
  const hood = new THREE.Group();
  const rock = new THREE.Mesh(geo.cone(260, 300, 9), toon(0x6b7c93));
  rock.position.y = 150;
  hood.add(rock);
  const snow = new THREE.Mesh(geo.cone(118, 136, 9), toon(0xf8fbff));
  snow.position.y = 232;
  hood.add(snow);
  hood.position.copy(P(-380, 1150));
  statics.add(hood);
  for (const [x, y, s] of [
    [380, 1100, 0.8],
    [700, 1000, 0.6],
    [-800, 1050, 0.7],
  ]) {
    const hill = new THREE.Mesh(geo.cone(300, 160, 8), toon(0x5d8a5a));
    hill.position.copy(P(x, y, 80 * s));
    hill.scale.setScalar(s * 1.4);
    statics.add(hill);
  }
  for (let i = 0; i < 8; i++) {
    const c = cloud(1.2 + (i % 3) * 0.5);
    c.position.copy(P(-600 + i * 170, 700 + (i % 2) * 200, 220 + (i % 3) * 60));
    statics.add(c);
  }
  scene.add(mergeStatic(statics));
}
