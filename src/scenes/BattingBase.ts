import Phaser from 'phaser';
import { W, setupCamera, goto, Btn, tokenPill, TokenPill, txt } from '../ui';
import { project, fenceR, drawField, FIELDERS } from '../field';
import { Batter, makeKid, makePitcher, Look, Pitcher } from '../figures';
import { Profile, getProfile, lookFor, levelOf, Level } from '../data';
import { sfx } from '../sfx';
import { PARTY_FRAMES } from './Boot';

export const BATTER_X = 515;
export const BATTER_Y = 792;
export const BALL_DEPTH = 300;

export interface Fielder {
  c: Phaser.GameObjects.Container;
  id: string;
  x: number;
  y: number;
  hx: number;
  hy: number;
}

export interface FlyOpts {
  angle: number;
  dist: number;
  apex: number;
  // Milliseconds for the whole flight: until a fly ball lands or a grounder stops rolling.
  time: number;
  grounder?: boolean;
  // Fraction of the flight where a fielder gloves it. Above 1 means the ball stopped and waited for the fielder.
  stopAt?: number;
  // The fielder who goes after the ball.
  who?: string;
}

// Shared pieces of the field screens: the park, the defense, the batter, ball flight, and celebrations.
export abstract class BattingBase extends Phaser.Scene {
  protected prof!: Profile;
  protected lv!: Level;
  protected look!: Look;
  protected batter?: Batter;
  protected pitcher?: Pitcher;
  protected ball!: Phaser.GameObjects.Image;
  protected shadow!: Phaser.GameObjects.Ellipse;
  protected fielders: Fielder[] = [];
  protected tokens!: TokenPill;
  protected cash!: TokenPill;
  protected bpos = { x: 0, y: 0, z: 0 };
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bannerObjs: Phaser.GameObjects.Text[] = [];
  private flashText!: Phaser.GameObjects.Text;

  protected buildField() {
    setupCamera(this);
    this.prof = getProfile();
    this.lv = levelOf(this.prof);
    this.look = lookFor(this.prof.gender, this.prof.league, this.prof);
    this.bannerObjs = [];
    this.fielders = [];
    this.batter = undefined;
    this.pitcher = undefined;
    drawField(this);
    this.shadow = this.add.ellipse(0, 0, 20, 8, 0x000000, 0.28).setDepth(60);
    this.ball = this.add.image(0, 0, 'ball').setDepth(BALL_DEPTH).setVisible(false);
    this.shadow.setVisible(false);
    new Btn(this, 92, 46, 150, 58, 'BACK', 0x34495e, () => this.onBack(), 24).setDepth(1000);
    this.tokens = tokenPill(this, W - 112, 46, this.prof.tokens);
    this.cash = tokenPill(this, W - 112, 112, this.prof.money, 'cash');
    this.flashText = txt(this, W / 2, 560, '', 40, { strokeThickness: 9 }).setDepth(900).setAlpha(0);
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 120, max: 380 },
        lifespan: { min: 650, max: 1150 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 240,
        frame: PARTY_FRAMES,
        emitting: false,
      })
      .setDepth(850);
    this.confetti = this.add
      .particles(0, 0, 'confetti', {
        x: { min: 0, max: W },
        y: -20,
        speedY: { min: 140, max: 300 },
        speedX: { min: -90, max: 90 },
        rotate: { start: 0, end: 540 },
        lifespan: 4200,
        gravityY: 50,
        quantity: 3,
        frequency: 30,
        frame: PARTY_FRAMES,
        emitting: false,
      })
      // Above the dimmed field but under result cards (Panel uses 950 to 952), so it never covers text.
      .setDepth(950.5);
  }

  protected onBack() {
    goto(this, 'hub');
  }

  // Put nine kids on the field. `you` marks the position the player plays.
  protected setDefense(lookOf: (id: string, i: number) => Look, you?: string) {
    this.fielders.forEach((f) => f.c.destroy());
    this.fielders = [];
    FIELDERS.forEach((s, i) => {
      let c: Phaser.GameObjects.Container;
      if (s.id === 'P') {
        this.pitcher = makePitcher(this, lookOf('P', i));
        c = this.pitcher.c;
      } else {
        c = makeKid(this, lookOf(s.id, i), { glove: true });
      }
      if (s.id === you) {
        const tag = txt(this, 0, -130, 'YOU', 46, { color: '#ffd23f', strokeThickness: 9 });
        c.add(tag);
        this.tweens.add({ targets: tag, y: -142, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.placeFig(c, s.x, s.y);
      this.fielders.push({ c, id: s.id, x: s.x, y: s.y, hx: s.x, hy: s.y });
    });
  }

  protected setBatter(look: Look | null) {
    this.batter?.c.destroy();
    this.batter = look ? new Batter(this, BATTER_X, BATTER_Y, look, (1.9 * this.lv.ft) / 4.4) : undefined;
    this.batter?.c.setDepth(200);
  }

  protected fielder(id?: string) {
    return this.fielders.find((f) => f.id === id);
  }

  protected placeFig(c: Phaser.GameObjects.Container, x: number, y: number, ft = this.lv.ft) {
    const p = project(x, y, 0);
    c.setPosition(p.x, p.y)
      .setScale((ft * p.s) / 100)
      .setDepth(100 - y * 0.2);
  }

  protected setBall(x: number, y: number, z: number) {
    this.bpos = { x, y, z };
    const p = project(x, y, z);
    const r = Math.max(2.4, 0.55 * p.s);
    this.ball.setPosition(p.x, p.y).setDisplaySize(r * 2, r * 2);
    const gp = project(x, y, 0);
    this.shadow
      .setPosition(gp.x, gp.y)
      .setDisplaySize(r * 2.2, r * 0.8)
      .setAlpha(Phaser.Math.Clamp(0.35 - z * 0.006, 0.08, 0.35));
    const beyond = y > 5 && Math.hypot(x, y) > fenceR(Math.atan2(x, y));
    this.ball.setVisible(!(beyond && z < 6));
    this.shadow.setVisible(!beyond);
  }

  protected hideBall() {
    this.ball.setVisible(false);
    this.shadow.setVisible(false);
  }

  protected wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
  }

  protected flyBall(o: FlyOpts): Promise<void> {
    const s = { ...this.bpos };
    const ex = o.dist * Math.sin(o.angle);
    const ey = o.dist * Math.cos(o.angle);
    const stop = o.stopAt ?? 1;
    const u1 = Math.min(1, stop);
    const pos = (u: number) => ({ x: s.x + (ex - s.x) * u, y: s.y + (ey - s.y) * u });
    const f = this.fielder(o.who);
    if (f) {
      if (o.stopAt !== undefined) {
        const t = pos(u1);
        this.runFielder(f, t.x, t.y, Math.max(150, stop * o.time), () => this.hop(f));
      } else {
        // A hit: the fielder chases it down where it stops.
        this.runFielder(f, ex, ey, o.time + 450);
      }
    }
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: u1,
        duration: Math.max(1, u1 * o.time),
        onUpdate: (tw) => {
          const u = tw.getValue() ?? 0;
          const p = pos(u);
          const z = o.grounder
            ? s.z * (1 - u) * (1 - u) + 3.2 * Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u)
            : s.z * (1 - u) + 4 * o.apex * u * (1 - u);
          this.setBall(p.x, p.y, z);
          this.ball.rotation += 0.35;
        },
        onComplete: () => {
          if (o.stopAt === undefined) {
            resolve();
            return;
          }
          // The ball sat still until the fielder got there.
          this.time.delayedCall(Math.max(0, (stop - u1) * o.time), () => {
            this.hideBall();
            resolve();
          });
        },
      });
    });
  }

  // A throw from one spot on the field to another.
  protected throwBall(from: { x: number; y: number }, to: { x: number; y: number }, ms: number): Promise<void> {
    this.setBall(from.x, from.y, 4);
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          this.setBall(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, 4 + 10 * k * (1 - k));
        },
        onComplete: () => {
          this.hideBall();
          resolve();
        },
      });
    });
  }

  protected runFielder(f: Fielder, tx: number, ty: number, dur: number, onArrive?: () => void) {
    const sx = f.x;
    const sy = f.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      ease: 'Sine.easeOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        f.x = sx + (tx - sx) * k;
        f.y = sy + (ty - sy) * k;
        this.placeFig(f.c, f.x, f.y);
        f.c.y -= Math.abs(Math.sin(k * Math.PI * 8)) * 5 * f.c.scaleY;
      },
      onComplete: () => onArrive?.(),
    });
  }

  protected hop(f: Fielder) {
    this.tweens.add({ targets: f.c, y: f.c.y - 14 * f.c.scaleY, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
  }

  protected resetFielders() {
    for (const f of this.fielders) {
      if (f.c.angle !== 0) this.tweens.add({ targets: f.c, angle: 0, duration: 300 });
      if (f.x !== f.hx || f.y !== f.hy) this.runFielder(f, f.hx, f.hy, 700);
    }
  }

  protected banner(text: string, color = '#ffd23f', sub?: string, hold = 1100) {
    this.bannerObjs.forEach((o) => o.destroy());
    const size = text.length > 12 ? 76 : 96;
    this.bannerObjs = [txt(this, W / 2, 245, text, size, { color, strokeThickness: 16 }).setDepth(900)];
    if (sub) this.bannerObjs.push(txt(this, W / 2, 325, sub, 32, { strokeThickness: 8 }).setDepth(900));
    this.bannerObjs.forEach((o, i) => {
      o.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 320, delay: i * 90, ease: 'Back.easeOut' });
      this.tweens.add({ targets: o, alpha: 0, delay: hold + 400, duration: 300, onComplete: () => o.destroy() });
    });
  }

  // A quick callout, like "STRIKE!" or "PERFECT TIMING!".
  protected flash(s: string, color = '#ffffff', x = W / 2, y = 560) {
    const t = this.flashText;
    this.tweens.killTweensOf(t);
    t.setPosition(x, y).setText(s).setColor(color).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 300 });
  }

  protected fireworks(n: number) {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 260, () => {
        this.sparks.explode(40, Phaser.Math.Between(180, W - 180), Phaser.Math.Between(80, 250));
      });
    }
  }

  protected confettiBurst(ms = 1600) {
    this.confetti.start();
    this.time.delayedCall(ms, () => this.confetti.stop());
  }

  // Coins or bills fly from (fromX, fromY) into a counter, which counts up from `before`.
  protected award(pill: TokenPill, kind: 'coin' | 'cash', n: number, fromX: number, fromY: number, before: number): Promise<void> {
    const shown = Math.min(n, 10);
    return new Promise((resolve) => {
      if (n <= 0) {
        resolve();
        return;
      }
      for (let i = 0; i < shown; i++) {
        const c = this.add.image(fromX, fromY, kind).setDepth(1100);
        if (kind === 'cash') c.setDisplaySize(64, 40);
        else c.setDisplaySize(52, 52);
        this.tweens.add({
          targets: c,
          x: pill.coinX,
          y: pill.coinY,
          scale: c.scale * 0.8,
          delay: 250 + i * 120,
          duration: 600,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            c.destroy();
            pill.set(i === shown - 1 ? before + n : before + Math.round(((i + 1) * n) / shown));
            sfx.coin();
            if (i === shown - 1) resolve();
          },
        });
      }
    });
  }
}
