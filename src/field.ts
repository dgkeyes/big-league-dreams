import Phaser from 'phaser';
import { W, H, ZOOM } from './ui';
import { fenceR } from './play';

export { fenceR, FIELDERS } from './play';

// World units are feet. Home plate is the origin, +y points to center field, +x to right field, +z is up.
// The camera sits behind home plate, so the field is drawn in simple perspective.
export const HORIZON = 300;
const CAM_BACK = 90;
const CAM_H = 22;
const FOCAL = 1923;
const DEG = Math.PI / 180;

export function project(x: number, y: number, z = 0) {
  const s = FOCAL / Math.max(4, y + CAM_BACK);
  return { x: W / 2 + x * s, y: HORIZON + (CAM_H - z) * s, s };
}

export const MOUND = { x: 0, y: 46 };
export const BASE_PATH = [
  { x: -3, y: -1 },
  { x: 42.4, y: 42.4 },
  { x: 0, y: 84.8 },
  { x: -42.4, y: 42.4 },
  { x: 0, y: 0 },
];

function polar(r: number, th: number) {
  return { x: r * Math.sin(th), y: r * Math.cos(th) };
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// The field is hundreds of shapes, so it is drawn once into a texture (at Retina resolution) and reused.
export function drawField(scene: Phaser.Scene) {
  if (!scene.textures.exists('field')) {
    const g = scene.make.graphics({}, false);
    paintField(g);
    g.setScale(ZOOM);
    const dt = scene.textures.addDynamicTexture('field', W * ZOOM, H * ZOOM);
    dt?.draw(g, 0, 0);
    g.destroy();
  }
  return scene.add.image(0, 0, 'field').setOrigin(0).setScale(1 / ZOOM).setDepth(0);
}

function paintField(g: Phaser.GameObjects.Graphics) {
  const P = (x: number, y: number, z = 0) => project(x, y, z);
  const fill = (pts: { x: number; y: number }[], color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  };
  const circle = (cx: number, cy: number, r: number) =>
    Array.from({ length: 36 }, (_, i) => P(cx + r * Math.cos((i / 36) * Math.PI * 2), cy + r * Math.sin((i / 36) * Math.PI * 2)));

  // sky, sun, clouds
  // Thin bands instead of a gradient fill, which the Canvas renderer cannot draw.
  const top = Phaser.Display.Color.ValueToColor(0x3b82d6);
  const bottom = Phaser.Display.Color.ValueToColor(0xc4ecff);
  const bands = 46;
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    g.fillRect(0, (i * (HORIZON + 160)) / bands, W, (HORIZON + 160) / bands + 1);
  }
  g.fillStyle(0xfff3b0, 0.45).fillCircle(170, 115, 64);
  g.fillStyle(0xffe066).fillCircle(170, 115, 42);
  const cloud = (x: number, y: number, k: number) => {
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(x, y, 26 * k).fillCircle(x + 30 * k, y - 12 * k, 32 * k).fillCircle(x + 64 * k, y, 24 * k);
    g.fillRoundedRect(x - 10 * k, y - 4 * k, 90 * k, 28 * k, 14 * k);
  };
  cloud(380, 120, 1);
  cloud(640, 70, 0.75);
  cloud(1030, 150, 0.9);

  // Mt. Hood and the hills
  g.fillStyle(0x7d8fc4).fillTriangle(700, 335, 1100, 335, 905, 150);
  fill(
    [
      { x: 905, y: 150 },
      { x: 866, y: 192 },
      { x: 882, y: 188 },
      { x: 893, y: 202 },
      { x: 906, y: 188 },
      { x: 920, y: 205 },
      { x: 933, y: 190 },
      { x: 946, y: 196 },
    ],
    0xffffff,
  );
  g.fillStyle(0x6c9f7a).fillEllipse(260, 352, 780, 110).fillEllipse(990, 356, 760, 96);

  // tree line behind the fence
  g.fillStyle(0x235c3b).fillRect(0, 410, W, 220);
  const r = rng(11);
  for (let layer = 0; layer < 2; layer++) {
    for (let x = -20 + layer * 11; x < W + 30; x += 22) {
      const h = (layer ? 45 : 65) + r() * 50;
      const base = 455 + layer * 4;
      g.fillStyle(layer ? (r() < 0.5 ? 0x2b7048 : 0x24653f) : 0x1b4f33);
      g.fillTriangle(x - 18, base, x + 18, base, x, base - h);
    }
  }

  const ths: number[] = [];
  for (let d = -80; d <= 80; d += 2) ths.push(d * DEG);
  const ring = (dr: number, z = 0) =>
    ths.map((t) => {
      const q = polar(fenceR(t) - dr, t);
      return P(q.x, q.y, z);
    });
  const fenceBottom = ring(0);

  // grass with mowing stripes
  fill([...fenceBottom, { x: W + 3000, y: H + 60 }, { x: -3000, y: H + 60 }], 0x45a849);
  for (let d = -80; d < 80; d += 10) {
    const a = polar(fenceR(d * DEG), d * DEG);
    const b = polar(fenceR((d + 5) * DEG), (d + 5) * DEG);
    fill([P(0, -30), P(a.x, a.y), P(b.x, b.y)], 0x55b958);
  }
  fill([...ring(0), ...ring(8).reverse()], 0xc2814f);

  // infield
  const dirt = 0xd9975b;
  const arc = [];
  for (let d = -52; d <= 52; d += 4) {
    const q = polar(82, d * DEG);
    arc.push(P(q.x, q.y));
  }
  fill([...arc, P(0, -4)], dirt);
  fill([P(0, 11.9), P(30.5, 42.4), P(0, 72.9), P(-30.5, 42.4)], 0x4caf50);
  fill(circle(0, 0.5, 13), dirt);
  fill(circle(MOUND.x, MOUND.y, 5), 0xcf8a52);
  fill([P(-1, 45.8), P(1, 45.8), P(1, 46.3), P(-1, 46.3)], 0xffffff);

  // chalk
  g.lineStyle(3, 0xffffff, 0.95);
  for (const sx of [-1, 1]) {
    const a = P(0, 0);
    const b = P(sx * 84.85, 84.85);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  g.lineStyle(2, 0xffffff, 0.8);
  for (const sx of [-1, 1]) {
    const x0 = sx * 1.2;
    const x1 = sx * 4.9;
    g.strokePoints([P(x0, -3), P(x1, -3), P(x1, 3), P(x0, 3)], true);
  }
  fill([P(-0.71, 0.71), P(0.71, 0.71), P(0.71, 0), P(0, -0.71), P(-0.71, 0)], 0xffffff);
  for (const b of BASE_PATH.slice(1, 4)) {
    fill([P(b.x - 1, b.y), P(b.x, b.y + 1), P(b.x + 1, b.y), P(b.x, b.y - 1)], 0xffffff);
  }

  // outfield wall
  const fenceTop = ring(0, 6);
  fill([...fenceTop, ...[...fenceBottom].reverse()], 0x1e5a3c);
  g.lineStyle(2, 0x2a7350, 0.8);
  for (let i = 0; i < ths.length; i += 2) g.lineBetween(fenceTop[i].x, fenceTop[i].y, fenceBottom[i].x, fenceBottom[i].y);
  g.lineStyle(4, 0xffd23f).strokePoints(fenceTop, false);
}
