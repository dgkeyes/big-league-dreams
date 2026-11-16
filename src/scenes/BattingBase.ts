import Phaser from 'phaser';
import { W, setupCamera, goto, Btn, tokenPill, TokenPill, txt } from '../ui';
import { project, fenceR, drawField, FIELDERS, BASE_PATH } from '../field';
import { Batter, makeKid, Look } from '../figures';
import { Profile, getProfile, lookFor, FIELDER_LOOK } from '../data';
import { sfx } from '../sfx';
import { PARTY_FRAMES } from './Boot';

export const BATTER_X = 515;
export const BATTER_Y = 792;
export const BALL_DEPTH = 300;

interface Fielder {
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
  time: number;
  grounder?: boolean;
  // 'catch': a fielder gets there as it lands. 'field': it rolls and a fielder picks it up.
  chase?: 'catch' | 'field';
}

// Shared pieces of the two batting screens: the field, fielders, batter, ball flight, and celebrations.
export abstract class BattingBase extends Phaser.Scene {
  protected prof!: Profile;
  protected look!: Look;
  protected batter!: Batter;
  protected ball!: Phaser.GameObjects.Image;
  protected shadow!: Phaser.GameObjects.Ellipse;
  protected fielders: Fielder[] = [];
  protected tokens!: TokenPill;
  protected bpos = { x: 0, y: 0, z: 0 };
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bannerObjs: Phaser.GameObjects.Text[] = [];

  protected buildField(withPitcherFielder: boolean) {
    setupCamera(this);
    this.prof = getProfile();
    this.look = lookFor(this.prof.gender, this.prof.league);
    this.bannerObjs = [];
    drawField(this);
    this.fielders = [];
    for (const s of FIELDERS) {
      if (s.id === 'P' && !withPitcherFielder) continue;
      const c = makeKid(this, FIELDER_LOOK, { glove: true });
      this.placeFig(c, s.x, s.y);
      this.fielders.push({ c, id: s.id, x: s.x, y: s.y, hx: s.x, hy: s.y });
    }
    this.shadow = this.add.ellipse(0, 0, 20, 8, 0x000000, 0.28).setDepth(60);
    this.ball = this.add.image(0, 0, 'ball').setDepth(BALL_DEPTH);
    this.batter = new Batter(this, BATTER_X, BATTER_Y, this.look, 1.9);
    this.batter.c.setDepth(200);
    new Btn(this, 92, 46, 150, 58, 'BACK', 0x34495e, () => goto(this, 'hub'), 24).setDepth(1000);
    this.tokens = tokenPill(this, W - 112, 46, this.prof.tokens);
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

  protected placeFig(c: Phaser.GameObjects.Container, x: number, y: number, ft = 4.4) {
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
    const roll = o.chase === 'field' ? 1.12 : 1;
    const rx = ex * roll;
    const ry = ey * roll;
    const rollMs = 450;
    const f = o.chase ? this.nearestFielder(rx, ry, !!o.grounder) : null;
    if (f) {
      if (o.chase === 'catch') this.runFielder(f, ex, ey, o.time, () => this.hop(f));
      else {
        const far = (Math.hypot(rx - f.x, ry - f.y) / 15) * 1000;
        this.runFielder(f, rx, ry, Math.max(o.time + rollMs, far), () => {
          this.hideBall();
          this.hop(f);
        });
      }
    }
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: o.time,
        onUpdate: (tw) => {
          const u = tw.getValue() ?? 0;
          const x = s.x + (ex - s.x) * u;
          const y = s.y + (ey - s.y) * u;
          const z = o.grounder
            ? s.z * (1 - u) * (1 - u) + 3.2 * Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u)
            : s.z * (1 - u) + 4 * o.apex * u * (1 - u);
          this.setBall(x, y, z);
          this.ball.rotation += 0.35;
        },
        onComplete: () => {
          if (o.chase === 'catch') {
            this.hideBall();
            resolve();
            return;
          }
          if (roll === 1) {
            resolve();
            return;
          }
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: rollMs,
            ease: 'Quad.easeOut',
            onUpdate: (tw) => {
              const k = tw.getValue() ?? 0;
              this.setBall(ex + (rx - ex) * k, ey + (ry - ey) * k, 1.5 * Math.sin(Math.PI * k));
            },
            onComplete: () => resolve(),
          });
        },
      });
    });
  }

  private nearestFielder(x: number, y: number, includePitcher: boolean) {
    let best: Fielder | null = null;
    let bd = Infinity;
    for (const f of this.fielders) {
      if (f.id === 'P' && !includePitcher) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  private runFielder(f: Fielder, tx: number, ty: number, dur: number, onArrive?: () => void) {
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

  private hop(f: Fielder) {
    this.tweens.add({ targets: f.c, y: f.c.y - 14 * f.c.scaleY, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
  }

  protected resetFielders() {
    for (const f of this.fielders) {
      if (f.x !== f.hx || f.y !== f.hy) this.runFielder(f, f.hx, f.hy, 700);
    }
  }

  protected runBases(bases: number): Promise<void> {
    const path = BASE_PATH.slice(0, bases + 1);
    const runner = makeKid(this, this.look);
    this.placeFig(runner, path[0].x, path[0].y, 4.2);
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: bases,
        duration: 900 * bases,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0;
          const i = Math.min(bases - 1, Math.floor(v));
          const k = v - i;
          const a = path[i];
          const b = path[i + 1];
          this.placeFig(runner, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 4.2);
          runner.y -= Math.abs(Math.sin(v * Math.PI * 7)) * 8 * runner.scaleY;
        },
        onComplete: () => {
          this.tweens.add({ targets: runner, y: runner.y - 22 * runner.scaleY, duration: 200, yoyo: true, repeat: 1 });
          resolve();
        },
      });
    });
  }

  protected banner(text: string, color = '#ffd23f', sub?: string, hold = 1100) {
    this.bannerObjs.forEach((o) => o.destroy());
    this.bannerObjs = [txt(this, W / 2, 245, text, 96, { color, strokeThickness: 16 }).setDepth(900)];
    if (sub) this.bannerObjs.push(txt(this, W / 2, 325, sub, 32, { strokeThickness: 8 }).setDepth(900));
    this.bannerObjs.forEach((o, i) => {
      o.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 320, delay: i * 90, ease: 'Back.easeOut' });
      this.tweens.add({ targets: o, alpha: 0, delay: hold + 400, duration: 300, onComplete: () => o.destroy() });
    });
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

  // Coins fly from (fromX, fromY) into the token counter, which counts up from `before`.
  protected awardTokens(n: number, fromX: number, fromY: number, before: number): Promise<void> {
    const shown = Math.min(n, 10);
    return new Promise((resolve) => {
      if (n <= 0) {
        resolve();
        return;
      }
      for (let i = 0; i < shown; i++) {
        const c = this.add.image(fromX, fromY, 'coin').setDisplaySize(52, 52).setDepth(1100);
        this.tweens.add({
          targets: c,
          x: this.tokens.coinX,
          y: this.tokens.coinY,
          scale: c.scale * 0.8,
          delay: 250 + i * 120,
          duration: 600,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            c.destroy();
            this.tokens.set(i === shown - 1 ? before + n : before + Math.round(((i + 1) * n) / shown));
            sfx.coin();
            if (i === shown - 1) resolve();
          },
        });
      }
    });
  }
}
