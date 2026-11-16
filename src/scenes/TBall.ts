import Phaser from 'phaser';
import { W, txt, Btn, Panel, goto, INK } from '../ui';
import { BattingBase } from './BattingBase';
import { project, fenceR } from '../field';
import { saveProfile } from '../data';
import { sfx } from '../sfx';

const TEE = { x: 0, y: 0.4, z: 2.5 };
const METER = { x: 930, y: 790, w: 380, h: 34 };
const GREEN = 0.18;
const YELLOW = 0.45;
const RED = 0.85;
const HIT_NAMES = ['', 'SINGLE!', 'DOUBLE!', 'TRIPLE!', 'HOME RUN!'];
const HIT_TOKENS = [0, 1, 2, 3, 5];

// One T-ball at-bat: the ball sits on a tee, and you swing when the arrow is in the green.
export class TBallScene extends BattingBase {
  private marker!: Phaser.GameObjects.Graphics;
  private meterObjs: Phaser.GameObjects.GameObject[] = [];
  private pos = 0;
  private ready = false;

  constructor() {
    super('tball');
  }

  create() {
    this.buildField(true);
    this.ready = false;
    this.pos = 0;
    txt(this, W / 2, 46, 'T-BALL GAME', 48, { color: '#ffd23f', strokeThickness: 10 }).setDepth(1000);
    this.drawTee();
    this.setBall(TEE.x, TEE.y, TEE.z);
    this.drawMeter();

    this.input.off('pointerdown');
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.swing();
    });

    const p = new Panel(this, 700, 380);
    p.add(txt(this, W / 2, 300, 'BATTER UP!', 64, { color: '#ffd23f', strokeThickness: 12 }));
    p.add(
      txt(this, W / 2, 400, 'Watch the arrow. When it is in the GREEN,\ntap anywhere to swing!', 30, {
        body: true,
        color: INK,
      }),
    );
    p.add(
      new Btn(this, W / 2, 520, 300, 80, "I'M READY!", 0x2fa84f, () => {
        p.destroy();
        this.ready = true;
      }, 36),
    );
  }

  update(time: number) {
    if (!this.marker?.visible) return;
    this.pos = Math.sin(time * 0.0034);
    this.marker.x = METER.x + (this.pos * METER.w) / 2;
  }

  private drawTee() {
    const g = this.add.graphics().setDepth(150);
    const base = project(TEE.x, TEE.y, 0);
    const top = project(TEE.x, TEE.y, TEE.z - 0.25);
    g.fillStyle(0x000000, 0.25).fillEllipse(base.x, base.y + 2, 60, 14);
    g.fillStyle(0x222222).fillEllipse(base.x, base.y, 52, 14);
    g.fillStyle(0x333333).fillRect(base.x - 5, top.y, 10, base.y - top.y);
    g.fillStyle(0x111111).fillRoundedRect(base.x - 8, top.y - 4, 16, 10, 3);
  }

  private drawMeter() {
    const { x, y, w, h } = METER;
    const g = this.add.graphics().setDepth(1000);
    g.fillStyle(0x0b1630, 0.6).fillRoundedRect(x - w / 2 - 12, y - h / 2 - 12, w + 24, h + 24, 20);
    g.fillStyle(0xe03131).fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    g.fillStyle(0xfab005).fillRect(x - (YELLOW * w) / 2, y - h / 2, YELLOW * w, h);
    g.fillStyle(0x2fa84f).fillRect(x - (GREEN * w) / 2, y - h / 2, GREEN * w, h);
    g.lineStyle(4, 0xffffff).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    const label = txt(this, x, y - 52, 'TAP IN THE GREEN!', 26).setDepth(1000);
    this.marker = this.add.graphics().setDepth(1001);
    this.marker.fillStyle(0xffffff).fillTriangle(-13, -h / 2 - 22, 13, -h / 2 - 22, 0, -h / 2 - 2);
    this.marker.lineStyle(3, 0x1b2a4a).strokeTriangle(-13, -h / 2 - 22, 13, -h / 2 - 22, 0, -h / 2 - 2);
    this.marker.fillStyle(0xffffff).fillRect(-2, -h / 2, 4, h);
    this.marker.y = y;
    this.meterObjs = [g, label, this.marker];
  }

  private quality(d: number) {
    if (d < GREEN) return 0.85 + ((GREEN - d) / GREEN) * 0.15;
    if (d < YELLOW) return 0.45 + ((YELLOW - d) / (YELLOW - GREEN)) * 0.4;
    if (d < RED) return 0.12 + ((RED - d) / (RED - YELLOW)) * 0.33;
    return 0;
  }

  private swing() {
    if (!this.ready || this.batter.swinging) return;
    this.ready = false;
    const pos = this.pos;
    const q = this.quality(Math.abs(pos));
    sfx.swing();
    this.batter.swing(this, () => {
      if (q === 0) {
        sfx.whiff();
        this.banner('SWING AND A MISS!', '#ffffff', "That's okay! In T-ball you keep swinging.");
        this.time.delayedCall(1300, () => (this.ready = true));
        return;
      }
      void this.hit(pos, q);
    });
  }

  private async hit(pos: number, q: number) {
    this.meterObjs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    sfx.crack(q > 0.85);
    this.cameras.main.shake(120, 0.004);
    const angle = Phaser.Math.Clamp(pos * 0.5 + Phaser.Math.FloatBetween(-0.4, 0.4), -0.7, 0.7);
    let dist = 30 + q * 135 + Phaser.Math.Between(-6, 6);
    const homer = dist > fenceR(angle) + 2;
    if (homer) dist += 25;
    const grounder = q < 0.4;
    const bases = homer ? 4 : dist < 65 ? 1 : dist < 105 ? 2 : 3;

    // The batter drops the bat and runs while the ball is still in the air.
    this.time.delayedCall(250, () => this.batter.c.setVisible(false));
    const run = this.wait(250).then(() => this.runBases(bases));
    await this.flyBall({
      angle,
      dist,
      apex: grounder ? 0 : 8 + q * 28,
      time: (grounder ? 700 : 900) + dist * 9,
      grounder,
      chase: homer ? undefined : 'field',
    });
    if (homer) {
      sfx.cheer(3);
      this.fireworks(5);
      this.banner('HOME RUN!', '#ffd23f', 'Over the fence!', 2000);
    } else {
      sfx.cheer(1.4);
      this.banner(HIT_NAMES[bases], '#ffd23f', 'Everybody runs in T-ball!');
    }
    await run;
    await this.wait(500);

    const earned = HIT_TOKENS[bases];
    const before = this.prof.tokens;
    this.prof.tokens += earned;
    this.prof.atBats += 1;
    saveProfile(this.prof);
    const home = project(0, 0, 3);
    await this.awardTokens(earned, home.x, home.y, before);
    this.showResult(bases, earned);
  }

  private showResult(bases: number, earned: number) {
    if (bases === 4) this.confettiBurst();
    sfx.fanfare();
    const p = new Panel(this, 680, 400);
    p.add(txt(this, W / 2, 290, HIT_NAMES[bases], 72, { color: '#ffd23f', strokeThickness: 12 }));
    p.add(
      txt(this, W / 2, 385, `Great at-bat!\nYou earned ${earned} token${earned === 1 ? '' : 's'}.`, 32, {
        body: true,
        color: INK,
      }),
    );
    p.add(new Btn(this, W / 2 - 150, 520, 260, 80, 'BAT AGAIN', 0x2fa84f, () => goto(this, 'tball'), 32));
    p.add(new Btn(this, W / 2 + 150, 520, 260, 80, 'CLUBHOUSE', 0x3b82d6, () => goto(this, 'hub'), 32));
  }
}
