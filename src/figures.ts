import Phaser from 'phaser';

// Ballplayers drawn with solid, outlined vector shapes. A figure is about 100 units tall with its feet at (0, 0).

export interface Look {
  jersey: number;
  cap: number;
  pants: number;
  skin: number;
  hair: number;
  girl: boolean;
  bat?: number;
  glove?: number;
  cleats?: number;
}

export interface KidOpts {
  glove?: boolean;
  omitLeftArm?: boolean;
}

type G = Phaser.GameObjects.Graphics;
type Radius = number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius;

const OUT = 0x1f2433;
const LW = 2.2;

export function darker(c: number, amt: number) {
  const f = (v: number) => Math.round(v * (1 - amt));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

function box(g: G, x: number, y: number, w: number, h: number, r: Radius, c: number) {
  g.fillStyle(c).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(LW, OUT).strokeRoundedRect(x, y, w, h, r);
}

function dot(g: G, x: number, y: number, r: number, c: number) {
  g.fillStyle(c).fillCircle(x, y, r);
  g.lineStyle(LW, OUT).strokeCircle(x, y, r);
}

function oval(g: G, x: number, y: number, w: number, h: number, c: number) {
  g.fillStyle(c).fillEllipse(x, y, w, h);
  g.lineStyle(LW, OUT).strokeEllipse(x, y, w, h);
}

function cap(g: G, cx: number, cy: number, r: number, c: number) {
  g.fillStyle(c);
  g.slice(cx, cy, r, Math.PI, Math.PI * 2, false);
  g.fillPath();
  g.lineStyle(LW, OUT);
  g.beginPath();
  g.arc(cx, cy, r, Math.PI, Math.PI * 2, false);
  g.closePath();
  g.strokePath();
}

function face(g: G, L: Look, x: number, y: number, side = false) {
  const eyes = side ? [x + 5] : [x - 5, x + 5];
  for (const ex of eyes) {
    g.fillStyle(0xffffff).fillEllipse(ex, y, 5.5, 6.5);
    g.fillStyle(0x2b1d14).fillCircle(ex + 0.6, y + 0.6, 2);
    g.fillStyle(0xffffff).fillCircle(ex + 1.2, y - 0.4, 0.7);
  }
  g.lineStyle(1.6, darker(L.skin, 0.3));
  g.beginPath();
  g.arc(side ? x + 9 : x, y + 4, 2, 0.2, Math.PI - 0.2, false);
  g.strokePath();
  g.fillStyle(0xff7f7f, 0.28).fillCircle(side ? x + 2 : x - 8, y + 5, 2.8);
  if (!side) g.fillCircle(x + 8, y + 5, 2.8);
  g.lineStyle(1.8, 0x7a2e24);
  g.beginPath();
  g.arc(side ? x + 6 : x, y + 6.5, 3.6, 0.35, Math.PI - 0.35, false);
  g.strokePath();
}

export function drawKid(g: G, L: Look, o: KidOpts = {}) {
  g.fillStyle(0x000000, 0.22).fillEllipse(0, 0, 44, 9);
  if (L.girl) oval(g, 15, -76, 9, 24, L.hair);
  // legs, socks, cleats
  box(g, -12, -44, 11, 36, 4, L.pants);
  box(g, 1, -44, 11, 36, 4, L.pants);
  g.fillStyle(darker(L.pants, 0.12)).fillRect(7, -42, 4, 32);
  g.fillStyle(L.cap).fillRect(-11, -17, 9, 9).fillRect(2, -17, 9, 9);
  oval(g, -7, -4, 17, 8, L.cleats ?? 0x2b2b2b);
  oval(g, 7, -4, 17, 8, L.cleats ?? 0x2b2b2b);
  // arms
  const arm = (x: number) => {
    box(g, x + 1, -62, 8, 25, 4, L.skin);
    box(g, x, -73, 10, 15, 4, L.jersey);
  };
  arm(15);
  if (!o.omitLeftArm) arm(-25);
  // torso with shading, collar, placket, and belt
  box(g, -16, -76, 32, 39, { tl: 10, tr: 10, bl: 4, br: 4 }, L.jersey);
  g.fillStyle(darker(L.jersey, 0.22), 0.6).fillRoundedRect(6, -74, 9, 35, { tl: 0, tr: 8, bl: 0, br: 3 });
  g.fillStyle(L.cap).fillTriangle(-6, -76, 6, -76, 0, -67);
  g.lineStyle(1.5, 0xffffff, 0.55).lineBetween(0, -66, 0, -42);
  g.fillStyle(0x2b2b2b).fillRect(-15, -42, 30, 4);
  if (o.glove) {
    const c = L.glove ?? 0x9c6b3c;
    oval(g, 21, -36, 15, 17, c);
    g.lineStyle(1.4, darker(c, 0.4)).lineBetween(17, -40, 25, -40).lineBetween(17, -35, 25, -35);
  } else {
    dot(g, 20, -36, 4.5, L.skin);
  }
  if (!o.omitLeftArm) dot(g, -20, -36, 4.5, L.skin);
  // neck, ears, head, hair
  g.fillStyle(darker(L.skin, 0.12)).fillRect(-4, -80, 8, 6);
  dot(g, -13, -86, 3.4, L.skin);
  dot(g, 13, -86, 3.4, L.skin);
  dot(g, 0, -88, 13, L.skin);
  if (L.girl) {
    oval(g, -12, -82, 7, 18, L.hair);
    oval(g, 12, -82, 7, 18, L.hair);
  } else {
    g.fillStyle(L.hair).fillRect(-13, -92, 4, 7).fillRect(9, -92, 4, 7);
  }
  face(g, L, 0, -86);
  // cap with brim and logo
  cap(g, 0, -92, 14, L.cap);
  g.fillStyle(0xffffff, 0.9).fillCircle(0, -98, 3);
  oval(g, 0, -92, 32, 7, darker(L.cap, 0.2));
}

export function makeKid(scene: Phaser.Scene, L: Look, o: KidOpts = {}) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  drawKid(g, L, o);
  c.add(g);
  return c;
}

export interface Pitcher {
  c: Phaser.GameObjects.Container;
  arm: Phaser.GameObjects.Graphics;
}

// Facing the batter, a right-handed pitcher throws with the arm on the viewer's left.
export function makePitcher(scene: Phaser.Scene, L: Look): Pitcher {
  const c = makeKid(scene, L, { glove: true, omitLeftArm: true });
  const arm = scene.add.graphics();
  box(arm, -5.5, -4, 11, 15, 4, L.jersey);
  box(arm, -4, 9, 8, 22, 4, L.skin);
  dot(arm, 0, 32, 4.5, L.skin);
  arm.setPosition(-20, -67).setRotation(0.15);
  c.add(arm);
  return { c, arm };
}

const lerp = Phaser.Math.Linear;
export const CONTACT_MS = 90;

// The batter, drawn from the side and facing the pitcher (screen right).
export class Batter {
  readonly c: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private bat: Phaser.GameObjects.Graphics;
  private arms: Phaser.GameObjects.Graphics;
  swinging = false;
  private bunting = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private L: Look,
    scale: number,
  ) {
    this.c = scene.add.container(x, y).setScale(scale);
    this.body = scene.add.graphics();
    this.bat = scene.add.graphics();
    this.arms = scene.add.graphics();
    this.drawBody();
    this.drawBat();
    this.c.add([this.body, this.bat, this.arms]);
    this.pose(8, -66, -2.4);
  }

  private drawBody() {
    const g = this.body;
    const L = this.L;
    g.fillStyle(0x000000, 0.2).fillEllipse(0, 0, 66, 12);
    // legs in a batting stance
    g.lineStyle(13, OUT);
    g.lineBetween(-5, -40, -17, -7);
    g.lineBetween(6, -40, 18, -7);
    g.lineStyle(9.5, L.pants);
    g.lineBetween(-5, -40, -17, -7);
    g.lineBetween(6, -40, 18, -7);
    oval(g, -15, -4, 21, 9, L.cleats ?? 0x2b2b2b);
    oval(g, 21, -4, 21, 9, L.cleats ?? 0x2b2b2b);
    box(g, -14, -78, 28, 42, { tl: 12, tr: 10, bl: 4, br: 4 }, L.jersey);
    g.fillStyle(darker(L.jersey, 0.22), 0.6).fillRoundedRect(-13, -76, 8, 38, { tl: 10, tr: 0, bl: 3, br: 0 });
    g.fillStyle(0x2b2b2b).fillRect(-13, -40, 26, 4);
    if (L.girl) oval(g, -17, -80, 11, 24, L.hair);
    // head
    dot(g, 2, -90, 13.5, L.skin);
    face(g, L, 2, -88, true);
    // helmet with ear flap and brim
    cap(g, 0, -93, 17, L.cap);
    box(g, -17, -95, 30, 6, 2, L.cap);
    dot(g, -5, -88, 7.5, L.cap);
    oval(g, 19, -93, 16, 5, darker(L.cap, 0.2));
    g.fillStyle(0xffffff, 0.35).fillEllipse(-4, -104, 11, 4);
  }

  private drawBat() {
    const g = this.bat;
    const barrel = this.L.bat ?? 0xc9d1db;
    g.fillStyle(0x2b2b2b).fillCircle(-6, 0, 3.4).fillRoundedRect(-6, -2.2, 20, 4.4, 2);
    const pts = [
      { x: 12, y: -2.4 },
      { x: 44, y: -4.6 },
      { x: 47, y: 0 },
      { x: 44, y: 4.6 },
      { x: 12, y: 2.4 },
    ];
    g.fillStyle(barrel).fillPoints(pts, true);
    g.lineStyle(1.6, OUT).strokePoints(pts, true);
    g.fillStyle(this.L.jersey).fillRect(14, -2.8, 6, 5.6);
    g.fillStyle(0xffffff, 0.5).fillRect(22, -3.2, 20, 1.6);
  }

  pose(hx: number, hy: number, rot: number) {
    // The bat looks shorter when it points toward or away from the camera.
    this.bat.setPosition(hx, hy).setRotation(rot);
    this.bat.scaleX = 0.55 + 0.45 * Math.abs(Math.cos(rot));
    const g = this.arms;
    const sx = 3;
    const sy = -70;
    const mx = lerp(sx, hx, 0.45);
    const my = lerp(sy, hy, 0.45) + 4;
    g.clear();
    g.lineStyle(11, OUT).lineBetween(sx, sy, mx, my);
    g.lineStyle(8, this.L.jersey).lineBetween(sx, sy, mx, my);
    g.lineStyle(9, OUT).lineBetween(mx, my, hx, hy);
    g.lineStyle(6, this.L.skin).lineBetween(mx, my, hx, hy);
    g.fillStyle(0xffffff).fillCircle(hx, hy, 5);
    g.lineStyle(1.6, OUT).strokeCircle(hx, hy, 5);
  }

  // Square around and hold the bat out level to bunt.
  setBunt(on: boolean) {
    if (this.swinging) return;
    this.bunting = on;
    if (on) this.pose(22, -64, -0.12);
    else this.pose(8, -66, -2.4);
  }

  // A little push of the bat toward the ball.
  bunt(scene: Phaser.Scene) {
    if (!this.bunting) this.setBunt(true);
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 260,
      yoyo: true,
      onUpdate: (tw) => this.pose(22 + 6 * (tw.getValue() ?? 0), -64, -0.12),
    });
  }

  // The bat loops down behind the batter, reaches the ball CONTACT_MS later, then wraps over the shoulder.
  swing(scene: Phaser.Scene, onContact: () => void) {
    if (this.swinging) return false;
    this.swinging = true;
    this.bunting = false;
    const A = { x: 8, y: -66, r: -2.4 };
    const B = { x: 20, y: -40, r: -Math.PI * 2 };
    const C = { x: 12, y: -70, r: -Math.PI * 2 - 2.3 };
    const step = (from: typeof A, to: typeof A, k: number) =>
      this.pose(lerp(from.x, to.x, k), lerp(from.y, to.y, k), lerp(from.r, to.r, k));
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: CONTACT_MS,
      ease: 'Quad.easeIn',
      onUpdate: (tw) => step(A, B, tw.getValue() ?? 0),
      onComplete: () => {
        onContact();
        scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 220,
          ease: 'Quad.easeOut',
          onUpdate: (tw) => step(B, C, tw.getValue() ?? 0),
          onComplete: () => {
            const C2 = { ...C, r: C.r + Math.PI * 2 };
            scene.tweens.addCounter({
              from: 0,
              to: 1,
              delay: 450,
              duration: 260,
              ease: 'Sine.easeInOut',
              onUpdate: (tw) => step(C2, A, tw.getValue() ?? 0),
              onComplete: () => {
                this.swinging = false;
              },
            });
          },
        });
      },
    });
    return true;
  }
}
