import Phaser from 'phaser';

// Cartoon kids drawn with vector shapes. A figure is about 100 units tall with its feet at (0, 0).

export interface Look {
  jersey: number;
  cap: number;
  pants: number;
  skin: number;
  hair: number;
  girl: boolean;
}

export interface KidOpts {
  glove?: boolean;
  omitLeftArm?: boolean;
}

export function drawKid(g: Phaser.GameObjects.Graphics, L: Look, o: KidOpts = {}) {
  g.fillStyle(0x000000, 0.2).fillEllipse(0, 0, 46, 10);
  if (L.girl) g.fillStyle(L.hair).fillEllipse(17, -74, 12, 24).fillCircle(14, -84, 8);
  // legs, socks, shoes
  g.fillStyle(L.pants).fillRoundedRect(-13, -42, 11, 38, 4).fillRoundedRect(2, -42, 11, 38, 4);
  g.fillStyle(L.cap).fillRect(-13, -15, 11, 9).fillRect(2, -15, 11, 9);
  g.fillStyle(0x2b2b2b).fillEllipse(-8, -3, 17, 8).fillEllipse(8, -3, 17, 8);
  // arms
  g.fillStyle(L.skin).fillRoundedRect(16, -62, 9, 26, 4);
  g.fillStyle(L.jersey).fillRoundedRect(15, -72, 11, 15, 4);
  if (!o.omitLeftArm) {
    g.fillStyle(L.skin).fillRoundedRect(-25, -62, 9, 26, 4);
    g.fillStyle(L.jersey).fillRoundedRect(-26, -72, 11, 15, 4);
  }
  // torso and belt
  g.fillStyle(L.jersey).fillRoundedRect(-17, -75, 34, 39, { tl: 11, tr: 11, bl: 4, br: 4 });
  g.fillStyle(0xffffff, 0.25).fillRect(-17, -60, 34, 4);
  g.fillStyle(0x2b2b2b).fillRect(-15, -40, 30, 4);
  if (o.glove) g.fillStyle(0x8b5a2b).fillCircle(22, -36, 8).fillStyle(0x6b4220).fillCircle(22, -36, 4);
  // head
  g.fillStyle(L.skin).fillRect(-4, -79, 8, 6).fillCircle(0, -89, 15);
  if (L.girl) g.fillStyle(L.hair).fillEllipse(-13, -85, 7, 16).fillEllipse(13, -85, 7, 16);
  // cap
  g.fillStyle(L.cap);
  g.slice(0, -92, 16, Math.PI, Math.PI * 2, false);
  g.fillPath();
  g.fillEllipse(0, -91, 34, 8);
  g.fillStyle(0xffffff, 0.3).fillEllipse(-5, -102, 9, 4);
  // face
  g.fillStyle(0x2b2b2b).fillCircle(-5, -86, 2.3).fillCircle(5, -86, 2.3);
  g.fillStyle(0xff8a8a, 0.55).fillCircle(-9, -81, 3).fillCircle(9, -81, 3);
  g.lineStyle(2, 0x8a3b2e);
  g.beginPath();
  g.arc(0, -82, 5, 0.35, Math.PI - 0.35, false);
  g.strokePath();
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
  arm.fillStyle(L.jersey).fillRoundedRect(-5.5, -4, 11, 15, 4);
  arm.fillStyle(L.skin).fillRoundedRect(-4.5, 9, 9, 22, 4);
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
    g.lineStyle(11, L.pants);
    g.lineBetween(-5, -40, -17, -7);
    g.lineBetween(6, -40, 18, -7);
    g.fillStyle(0x2b2b2b).fillEllipse(-15, -4, 20, 9).fillEllipse(21, -4, 20, 9);
    g.fillStyle(L.jersey).fillRoundedRect(-14, -77, 28, 41, { tl: 12, tr: 10, bl: 4, br: 4 });
    g.fillStyle(0xffffff, 0.25).fillRect(-14, -62, 28, 4);
    g.fillStyle(0x2b2b2b).fillRect(-13, -40, 26, 4);
    if (L.girl) g.fillStyle(L.hair).fillEllipse(-17, -80, 12, 24);
    // head
    g.fillStyle(L.skin).fillCircle(2, -90, 14).fillCircle(15, -89, 3.2);
    // helmet with ear flap and brim
    g.fillStyle(L.cap);
    g.slice(0, -93, 17, Math.PI, Math.PI * 2, false);
    g.fillPath();
    g.fillRect(-17, -94, 34, 5).fillCircle(-4, -88, 8).fillEllipse(19, -93, 16, 5);
    g.fillStyle(0xffffff, 0.35).fillEllipse(-4, -104, 11, 4);
    // face
    g.fillStyle(0x2b2b2b).fillCircle(10, -87, 2.3);
    g.fillStyle(0xff8a8a, 0.55).fillCircle(8, -81, 3);
    g.lineStyle(2, 0x8a3b2e);
    g.beginPath();
    g.arc(11, -82, 4, 0.3, Math.PI * 0.75, false);
    g.strokePath();
  }

  private drawBat() {
    const g = this.bat;
    g.fillStyle(0x2b2b2b).fillCircle(-6, 0, 3.4).fillRoundedRect(-6, -2.2, 20, 4.4, 2);
    g.fillStyle(0xc9d1db).fillPoints(
      [
        { x: 12, y: -2.4 },
        { x: 44, y: -4.6 },
        { x: 47, y: 0 },
        { x: 44, y: 4.6 },
        { x: 12, y: 2.4 },
      ],
      true,
    );
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
    g.lineStyle(9, this.L.jersey).lineBetween(sx, sy, mx, my);
    g.lineStyle(7, this.L.skin).lineBetween(mx, my, hx, hy);
    g.fillStyle(0xffffff).fillCircle(hx, hy, 5);
  }

  // The bat loops down behind the batter, reaches the ball CONTACT_MS later, then wraps over the shoulder.
  swing(scene: Phaser.Scene, onContact: () => void) {
    if (this.swinging) return false;
    this.swinging = true;
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
