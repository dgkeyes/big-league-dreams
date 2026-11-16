import Phaser from 'phaser';
import { sfx } from './sfx';

// The game is laid out in a fixed 1200x860 world (close to an iPad's landscape shape).
// On Retina screens the canvas renders at 2x and every camera zooms 2x, so shapes and text stay crisp.
export const W = 1200;
export const H = 860;
export const ZOOM = (window.devicePixelRatio || 1) >= 1.5 ? 2 : 1;
export const FONT_HEAD = '"Luckiest Guy", "Arial Black", sans-serif';
export const FONT_BODY = 'Fredoka, "Arial Rounded MT Bold", sans-serif';
export const INK = '#1b2a4a';

export function shade(c: number, amt: number) {
  const f = (v: number) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

export function setupCamera(scene: Phaser.Scene, fade = true) {
  scene.input.enabled = true;
  const cam = scene.cameras.main;
  cam.setZoom(ZOOM);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor('#1b3a6b');
  if (fade) cam.fadeIn(250, 27, 58, 107);
}

export function goto(scene: Phaser.Scene, key: string, data?: object) {
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(220, 27, 58, 107);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export interface TextOpts {
  color?: string;
  body?: boolean;
  stroke?: string;
  strokeThickness?: number;
  wrap?: number;
  align?: string;
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, o: TextOpts = {}) {
  return scene.add
    .text(x, y, s, {
      fontFamily: o.body ? FONT_BODY : FONT_HEAD,
      fontStyle: o.body ? '600' : '',
      fontSize: `${size}px`,
      color: o.color ?? '#ffffff',
      stroke: o.stroke ?? INK,
      strokeThickness: o.strokeThickness ?? (o.body ? 0 : Math.max(3, Math.round(size / 6))),
      align: o.align ?? 'center',
      wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
      resolution: ZOOM,
    })
    .setOrigin(0.5);
}

// A chunky, pressable button. Everything in `face` sinks when pressed.
export class Btn extends Phaser.GameObjects.Container {
  readonly face: Phaser.GameObjects.Container;
  readonly label: Phaser.GameObjects.Text;
  private g: Phaser.GameObjects.Graphics;
  private down = false;
  private selected = false;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private bw: number,
    private bh: number,
    text: string,
    private color: number,
    onClick: () => void,
    size = 32,
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.face = scene.add.container(0, 0);
    this.label = txt(scene, 0, -2, text, size);
    this.face.add(this.label);
    this.add([this.g, this.face]);
    scene.add.existing(this);
    this.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh + 8), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.down = true;
      this.draw();
    });
    this.on('pointerout', () => {
      this.down = false;
      this.draw();
    });
    this.on('pointerup', () => {
      if (!this.enabled || !this.down) return;
      this.down = false;
      this.draw();
      sfx.tap();
      onClick();
    });
    this.draw();
  }

  setSelected(on: boolean) {
    this.selected = on;
    this.draw();
    return this;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.45);
    return this;
  }

  private draw() {
    const { bw: w, bh: h, g } = this;
    const r = Math.min(24, h / 2);
    const off = this.down ? 5 : 0;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 10, w, h, r);
    g.fillStyle(shade(this.color, -0.35)).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, r);
    g.fillStyle(this.color).fillRoundedRect(-w / 2, -h / 2 + off, w, h, r);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 8, -h / 2 + off + 6, w - 16, h * 0.36, r * 0.7);
    if (this.selected) g.lineStyle(6, 0xffffff).strokeRoundedRect(-w / 2 - 3, -h / 2 + off - 3, w + 6, h + 6, r + 3);
    this.face.y = off;
  }
}

export interface TokenPill {
  c: Phaser.GameObjects.Container;
  coinX: number;
  coinY: number;
  set(v: number): void;
}

// A counter pill: gold coins for tokens, green bills for money.
export function tokenPill(scene: Phaser.Scene, x: number, y: number, n: number, kind: 'coin' | 'cash' = 'coin'): TokenPill {
  const cash = kind === 'cash';
  const c = scene.add.container(x, y).setDepth(1000);
  const g = scene.add.graphics();
  g.fillStyle(0x0b1630, 0.55).fillRoundedRect(-95, -30, 190, 60, 30);
  g.lineStyle(4, cash ? 0x51cf66 : 0xffd23f).strokeRoundedRect(-95, -30, 190, 60, 30);
  const icon = scene.add.image(-60, 0, kind).setDisplaySize(cash ? 50 : 46, cash ? 32 : 46);
  const label = (v: number) => (cash ? `$${v}` : String(v));
  const t = txt(scene, 18, 2, label(n), 34, { color: cash ? '#b2f2bb' : '#ffe066' });
  c.add([g, icon, t]);
  return {
    c,
    coinX: x - 60,
    coinY: y,
    set(v: number) {
      t.setText(label(v));
      scene.tweens.add({ targets: c, scale: { from: 1.18, to: 1 }, duration: 220 });
    },
  };
}

// A cream card over a dimmed screen. Its backdrop swallows taps meant for the field.
export class Panel {
  objs: Phaser.GameObjects.GameObject[] = [];
  constructor(scene: Phaser.Scene, w: number, h: number, y = H / 2) {
    const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x0b1630, 0.55).setDepth(950).setInteractive();
    const g = scene.add.graphics().setDepth(951);
    g.fillStyle(0x000000, 0.3).fillRoundedRect(W / 2 - w / 2, y - h / 2 + 12, w, h, 34);
    g.fillStyle(0xfff8e7).fillRoundedRect(W / 2 - w / 2, y - h / 2, w, h, 34);
    g.lineStyle(6, 0x1b2a4a).strokeRoundedRect(W / 2 - w / 2, y - h / 2, w, h, 34);
    this.objs.push(dim, g);
    scene.tweens.add({ targets: [g], alpha: { from: 0, to: 1 }, duration: 200 });
  }
  add<T extends Phaser.GameObjects.GameObject & { setDepth(d: number): T }>(o: T): T {
    o.setDepth(952);
    this.objs.push(o);
    return o;
  }
  destroy() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }
}

export function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

// Five skill bars. `extra` (from gear) shows as a lighter segment after the base value.
export function skillBars(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  rows: { name: string; color: number; base: number; extra?: number }[],
  gap = 34,
) {
  const g = scene.add.graphics();
  const labelW = 104;
  rows.forEach((r, i) => {
    const yy = y + i * gap;
    txt(scene, x + labelW / 2, yy, r.name, 19, { body: true, color: INK }).setOrigin(0.5);
    const bx = x + labelW;
    const bw = w - labelW - 44;
    g.fillStyle(0x1b2a4a, 0.12).fillRoundedRect(bx, yy - 9, bw, 18, 9);
    const base = (Math.min(99, r.base) / 99) * bw;
    const total = (Math.min(99, r.base + (r.extra ?? 0)) / 99) * bw;
    if (total > base) g.fillStyle(shade(r.color, 0.45)).fillRoundedRect(bx, yy - 9, total, 18, 9);
    g.fillStyle(r.color).fillRoundedRect(bx, yy - 9, Math.max(18, base), 18, 9);
    const v = Math.min(99, r.base + (r.extra ?? 0));
    txt(scene, bx + bw + 24, yy, String(v), 22, { color: r.extra ? '#2b8a3e' : INK, strokeThickness: 0 });
  });
  return g;
}
