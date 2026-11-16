import Phaser from 'phaser';
import { W, txt, Btn, Panel, goto, INK, pick } from '../ui';
import { BattingBase, Fielder } from './BattingBase';
import { project, fenceR, BASE_PATH } from '../field';
import { makeKid, Look } from '../figures';
import {
  LEAGUES,
  League,
  leagueOf,
  kidLook,
  KID_NAMES,
  saveProfile,
  skillsOf,
  Skills,
  SKILLS,
  SkillId,
  GAMES_PER_LEVEL,
  LEVELS,
  levelIndex,
  gamesInLevel,
} from '../data';
import {
  battedBall,
  judge,
  resolve,
  cpuPA,
  Bases,
  Outcome,
  Swing,
  BattedBall,
  fielderSpeed,
  throwSpeed,
  runnerTime,
  FIRST_BASE,
  landing,
} from '../play';
import { sfx } from '../sfx';

interface Kid {
  name: string;
  look: Look;
  you?: boolean;
}
type Pt = { x: number; y: number };
type PitchEnd = { kind: 'ball' | 'strike' | 'foul'; swung?: boolean; bunt?: boolean } | { kind: 'inplay'; o: Outcome };
interface Chance {
  need: 'run' | 'dive';
  // Fraction of the ball's flight when it reaches you, where, and when (seconds).
  frac: number;
  at: Pt;
  t: number;
  // How much farther than your running reach it is (a dive covers this).
  gap: number;
}

const YOU_POS = 'SS';
const SECOND = { x: 0, y: 84.8 };
const TEE = { x: 0, y: 0.4, z: 2.5 };
const LINEUP = 9;
const METER = { x: 770, y: 795, w: 380, h: 34 };
const RED = 0.85;
const lerp = Phaser.Math.Linear;
const rnd = Phaser.Math.FloatBetween;
const clamp = Phaser.Math.Clamp;

const ordinal = (n: number) => `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'}`;

// A full game. You bat leadoff and play shortstop; the game shows your at-bats and the balls hit to you,
// and plays everything else out quickly.
export class GameScene extends BattingBase {
  private gen = 0;
  private us!: League;
  private them!: League;
  private ours: Kid[] = [];
  private theirs: Kid[] = [];
  private ourIdx = 0;
  private theirIdx = 0;
  private inning = 1;
  private top = true;
  private outs = 0;
  private halfRuns = 0;
  private bases: Bases = [false, false, false];
  private runners: (Phaser.GameObjects.Container | null)[] = [null, null, null];
  private score = { us: 0, them: 0 };
  private count = { b: 0, s: 0 };
  private sk!: Skills;
  private line = { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, outs: 0, errors: 0 };

  // Taps on the field (not on buttons) go to whatever is waiting for one.
  private onTap?: () => void;
  private mode: Swing = 'contact';
  private modeBtns: { m: Swing; b: Btn }[] = [];
  private batUi: Phaser.GameObjects.GameObject[] = [];
  private zone?: Phaser.GameObjects.Graphics;
  private upText!: Phaser.GameObjects.Text;

  // The pitch in flight.
  private phase: 'wait' | 'windup' | 'flight' | 'gone' = 'wait';
  private swung = false;
  private missed = false;
  private pitchTween?: Phaser.Tweens.Tween;
  private pitchOff = 0;
  private pitchDone?: (r: PitchEnd) => void;

  private meterMarker?: Phaser.GameObjects.Graphics;
  private meterPos = 0;

  private hud!: {
    us: Phaser.GameObjects.Text;
    them: Phaser.GameObjects.Text;
    inning: Phaser.GameObjects.Text;
    count: Phaser.GameObjects.Text;
    g: Phaser.GameObjects.Graphics;
  };

  constructor() {
    super('game');
  }

  create() {
    this.gen += 1;
    this.buildField();
    this.sk = skillsOf(this.prof);
    this.us = leagueOf(this.prof.league);
    this.them = pick(LEAGUES.filter((l) => l.id !== this.us.id));
    const names = Phaser.Utils.Array.Shuffle([...KID_NAMES]);
    this.ours = [{ name: 'YOU', look: this.look, you: true }];
    for (let i = 1; i < LINEUP; i++) this.ours.push({ name: names[i], look: kidLook(this.us, i) });
    this.theirs = Array.from({ length: LINEUP }, (_, i) => ({ name: names[i + LINEUP], look: kidLook(this.them, i + 20) }));
    this.ourIdx = 0;
    this.theirIdx = 0;
    this.inning = 1;
    this.top = true;
    this.outs = 0;
    this.bases = [false, false, false];
    this.runners = [null, null, null];
    this.score = { us: 0, them: 0 };
    this.count = { b: 0, s: 0 };
    this.line = { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, outs: 0, errors: 0 };
    this.onTap = undefined;
    this.meterMarker = undefined;
    this.batUi = [];
    this.modeBtns = [];
    this.mode = 'contact';
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    if (this.lv.tee) this.drawTee();
    this.drawZone();
    this.drawHud();
    this.upText = txt(this, 210, 640, '', 30, { strokeThickness: 8 }).setDepth(900);

    this.input.off('pointerdown');
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.onTap?.();
    });
    this.intro();
  }

  update(time: number) {
    if (!this.meterMarker) return;
    this.meterPos = Math.sin(time * 0.0034);
    this.meterMarker.x = METER.x + (this.meterPos * METER.w) / 2;
  }

  private alive(g: number) {
    return g === this.gen && this.scene.isActive();
  }

  protected onBack() {
    const p = new Panel(this, 620, 320);
    p.add(txt(this, W / 2, 360, 'LEAVE THE GAME?', 48, { color: '#ffd23f', strokeThickness: 10 }));
    p.add(txt(this, W / 2, 425, "It won't count toward moving up.", 26, { body: true, color: INK }));
    p.add(new Btn(this, W / 2 - 140, 510, 240, 72, 'LEAVE', 0xe03131, () => goto(this, 'hub'), 30));
    p.add(new Btn(this, W / 2 + 140, 510, 240, 72, 'KEEP PLAYING', 0x2fa84f, () => p.destroy(), 24));
  }

  // ---------- screen pieces ----------

  private drawTee() {
    const g = this.add.graphics().setDepth(150);
    const base = project(TEE.x, TEE.y, 0);
    const top = project(TEE.x, TEE.y, TEE.z - 0.25);
    g.fillStyle(0x000000, 0.25).fillEllipse(base.x, base.y + 2, 60, 14);
    g.fillStyle(0x222222).fillEllipse(base.x, base.y, 52, 14);
    g.fillStyle(0x333333).fillRect(base.x - 5, top.y, 10, base.y - top.y);
    g.fillStyle(0x111111).fillRoundedRect(base.x - 8, top.y - 4, 16, 10, 3);

  }

  private zoneBox() {
    return { x: 0.85, lo: 0.3 * this.lv.ft, hi: 0.62 * this.lv.ft };
  }

  // The strike zone, shown over the plate while you bat.
  private drawZone() {
    if (this.lv.tee) return;
    const z = this.zoneBox();
    const a = project(-z.x, 0, z.hi);
    const b = project(z.x, 0, z.lo);
    const g = this.add.graphics().setDepth(250).setVisible(false);
    g.fillStyle(0xffffff, 0.08).fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    g.lineStyle(3, 0xffffff, 0.75).strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    this.zone = g;
  }

  private drawHud() {
    const x0 = W / 2 - 300;
    const bg = this.add.graphics().setDepth(1000);
    bg.fillStyle(0x0b1630, 0.8).fillRoundedRect(x0, 12, 600, 82, 22);
    bg.lineStyle(4, 0xffffff, 0.75).strokeRoundedRect(x0, 12, 600, 82, 22);
    bg.fillStyle(this.them.color).fillRoundedRect(x0 + 16, 22, 14, 28, 4);
    bg.fillStyle(this.us.color).fillRoundedRect(x0 + 16, 56, 14, 28, 4);
    txt(this, x0 + 74, 37, this.them.abbr, 26).setDepth(1001);
    txt(this, x0 + 74, 71, this.us.abbr, 26).setDepth(1001);
    this.hud = {
      them: txt(this, x0 + 150, 37, '0', 30, { color: '#ffe066' }).setDepth(1001),
      us: txt(this, x0 + 150, 71, '0', 30, { color: '#ffe066' }).setDepth(1001),
      inning: txt(this, x0 + 250, 53, '', 26).setDepth(1001),
      count: txt(this, x0 + 380, 72, '', 22, { body: true }).setDepth(1001),
      g: this.add.graphics().setDepth(1001),
    };
    txt(this, x0 + 380, 34, 'OUTS', 20).setDepth(1001);
    this.updateHud();
  }

  private updateHud() {
    const x0 = W / 2 - 300;
    this.hud.them.setText(String(this.score.them));
    this.hud.us.setText(String(this.score.us));
    this.hud.inning.setText(`${this.top ? 'TOP' : 'BOT'} ${this.inning}`);
    this.hud.count.setText(this.lv.tee ? '' : `Balls ${this.count.b}  Strikes ${this.count.s}`);
    const g = this.hud.g.clear();
    for (let i = 0; i < 2; i++) {
      g.fillStyle(i < this.outs ? 0xff6b6b : 0xffffff, i < this.outs ? 1 : 0.2).fillCircle(x0 + 430 + i * 24, 34, 9);
    }
    // mini diamond: first, second, third
    const cx = x0 + 530;
    const spots = [
      { x: cx + 26, y: 56 },
      { x: cx, y: 32 },
      { x: cx - 26, y: 56 },
    ];
    spots.forEach((s, i) => {
      const pts = [
        { x: s.x, y: s.y - 11 },
        { x: s.x + 11, y: s.y },
        { x: s.x, y: s.y + 11 },
        { x: s.x - 11, y: s.y },
      ];
      g.fillStyle(this.bases[i] ? 0xffd23f : 0xffffff, this.bases[i] ? 1 : 0.2).fillPoints(pts, true);
    });
    g.fillStyle(0xffffff, 0.5).fillRect(cx - 4, 76, 8, 8);
  }

  // CONTACT, POWER, and BUNT buttons, shown while you bat.
  private showBatUi(on: boolean) {
    this.batUi.forEach((o) => o.destroy());
    this.batUi = [];
    this.modeBtns = [];
    this.zone?.setVisible(on && !this.lv.tee);
    if (!on) return;
    const modes: { m: Swing; label: string; color: number }[] = [
      { m: 'contact', label: 'CONTACT', color: 0x3b82d6 },
      { m: 'power', label: 'POWER', color: 0xe03131 },
    ];
    if (this.lv.bunts) modes.push({ m: 'bunt', label: 'BUNT', color: 0x2fa84f });
    if (!this.lv.bunts && this.mode === 'bunt') this.mode = 'contact';
    const bottom = 800;
    modes.forEach((d, i) => {
      const y = bottom - (modes.length - 1 - i) * 72;
      const b = new Btn(this, 1088, y, 190, 60, d.label, d.color, () => this.setMode(d.m), 26).setDepth(1000);
      this.modeBtns.push({ m: d.m, b });
      this.batUi.push(b);
    });
    const tip = txt(this, 1088, bottom - modes.length * 72 + 22, 'SWING TYPE', 22).setDepth(1000);
    this.batUi.push(tip);
    this.setMode(this.mode);
  }

  private setMode(m: Swing) {
    this.mode = m;
    this.modeBtns.forEach(({ m: k, b }) => b.setSelected(k === m));
    if (this.phase === 'flight' && !this.swung) this.batter?.setBunt(m === 'bunt');
  }

  // A sliding arrow on a red, yellow, and green bar. Tap when it is in the green.
  private meter(label: string, green: number): Promise<{ q: number; pos: number }> {
    const { x, y, w, h } = METER;
    const yellow = green + 0.27;
    const g = this.add.graphics().setDepth(1000);
    g.fillStyle(0x0b1630, 0.6).fillRoundedRect(x - w / 2 - 12, y - h / 2 - 12, w + 24, h + 24, 20);
    g.fillStyle(0xe03131).fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    g.fillStyle(0xfab005).fillRect(x - (yellow * w) / 2, y - h / 2, yellow * w, h);
    g.fillStyle(0x2fa84f).fillRect(x - (green * w) / 2, y - h / 2, green * w, h);
    g.lineStyle(4, 0xffffff).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    const t = txt(this, x, y - 52, label, 26).setDepth(1000);
    const m = this.add.graphics().setDepth(1001);
    m.fillStyle(0xffffff).fillTriangle(-13, -h / 2 - 22, 13, -h / 2 - 22, 0, -h / 2 - 2);
    m.lineStyle(3, 0x1b2a4a).strokeTriangle(-13, -h / 2 - 22, 13, -h / 2 - 22, 0, -h / 2 - 2);
    m.fillStyle(0xffffff).fillRect(-2, -h / 2, 4, h);
    m.y = y;
    this.meterMarker = m;
    return new Promise((res) => {
      this.onTap = () => {
        this.onTap = undefined;
        this.meterMarker = undefined;
        const pos = this.meterPos;
        const d = Math.abs(pos);
        let q = 0;
        if (d < green) q = 0.85 + ((green - d) / green) * 0.15;
        else if (d < yellow) q = 0.45 + ((yellow - d) / (yellow - green)) * 0.4;
        else if (d < RED) q = 0.12 + ((RED - d) / (RED - yellow)) * 0.33;
        [g, t, m].forEach((o) => o.destroy());
        res({ q, pos });
      };
    });
  }

  // ---------- the game ----------

  private intro() {
    const g = this.gen;
    const n = gamesInLevel(this.prof) + 1;
    const p = new Panel(this, 860, 600);
    p.add(txt(this, W / 2, 190, 'GAME DAY!', 64, { color: '#ffd23f', strokeThickness: 12 }));
    p.add(
      txt(this, W / 2, 255, `${this.lv.name}  ·  Game ${n} of ${GAMES_PER_LEVEL}`, 28, { color: '#5b6b88', strokeThickness: 0 }),
    );
    p.add(txt(this, W / 2, 312, `${this.us.name}  vs  ${this.them.name}`, 34, { color: INK, strokeThickness: 0 }));
    const tips = [
      `${this.lv.innings} innings. You bat leadoff and play shortstop.`,
      this.lv.tee ? 'Tap when the arrow is in the GREEN to hit off the tee.' : 'Tap to swing when the ball gets to the plate.',
      'CONTACT: easier to hit.   POWER: hits it far, harder to time.',
      this.lv.bunts ? 'BUNT: tap it softly and run for first!' : 'No bunting in T-ball. Swing away!',
      'In the field: tap GRAB IT or DIVE when the ball comes to you.',
    ];
    if (!this.lv.tee) tips.splice(2, 0, "Don't swing at pitches outside the box: 4 balls is a walk!");
    p.add(txt(this, W / 2, 445, tips.join('\n'), 23, { body: true, color: INK }));
    p.add(
      new Btn(this, W / 2, 625, 320, 80, 'PLAY BALL!', 0x2fa84f, () => {
        p.destroy();
        void this.run(g);
      }, 36),
    );
  }

  private async run(g: number) {
    const n = this.lv.innings;
    for (this.inning = 1; ; this.inning++) {
      this.top = true;
      await this.half(g);
      if (!this.alive(g)) return;
      if (this.inning >= n && this.score.us > this.score.them) break;
      this.top = false;
      await this.half(g);
      if (!this.alive(g)) return;
      if (this.inning >= n && this.score.us !== this.score.them) break;
      // One extra inning, then it's a tie.
      if (this.inning >= n + 1) break;
    }
    if (this.alive(g)) await this.finish();
  }

  private async half(g: number) {
    this.outs = 0;
    this.halfRuns = 0;
    this.bases = [false, false, false];
    this.runners.forEach((r) => r?.destroy());
    this.runners = [null, null, null];
    if (this.top) this.setDefense((id, i) => (id === YOU_POS ? this.look : kidLook(this.us, i)), YOU_POS);
    else this.setDefense((_, i) => kidLook(this.them, i + 20));
    this.setBatter(null);
    this.updateHud();
    this.banner(
      `${this.top ? 'TOP' : 'BOTTOM'} OF THE ${ordinal(this.inning)}`,
      '#ffffff',
      this.top ? `You're at shortstop. ${this.them.name} bats.` : `${this.us.name} bats!`,
      900,
    );
    await this.wait(1700);
    while (this.outs < 3) {
      if (!this.alive(g)) return;
      const kid = this.top ? this.theirs[this.theirIdx++ % LINEUP] : this.ours[this.ourIdx++ % LINEUP];
      this.hideBall();
      this.count = { b: 0, s: 0 };
      this.updateHud();
      const o = kid.you ? await this.yourPA() : await this.simPA(kid);
      if (!this.alive(g)) return;
      await this.apply(o, kid);
      if (!this.alive(g)) return;
      this.resetFielders();
      await this.wait(this.top || kid.you ? 900 : 600);
      if (!this.top && this.inning >= this.lv.innings && this.score.us > this.score.them) {
        sfx.cheer(3);
        this.banner('WALK-OFF!', '#ffd23f', `${this.us.name} wins it!`, 1400);
        await this.wait(2000);
        return;
      }
    }
    this.setBatter(null);
    this.banner(this.lv.runLimit && this.halfRuns >= this.lv.runLimit ? `${this.lv.runLimit}-RUN LIMIT!` : '3 OUTS!', '#ffffff', 'Switch sides!', 700);
    await this.wait(1400);
  }

  // Update the bases, outs, and score for a plate appearance, with the runners running.
  private async apply(o: Outcome, kid: Kid) {
    const room = this.lv.runLimit ? this.lv.runLimit - this.halfRuns : Infinity;
    const runs = Math.min(o.runs, room);
    const sub = runs > 0 ? `${runs} run${runs === 1 ? '' : 's'} score${runs === 1 ? 's' : ''}!` : undefined;
    const good = this.top ? !o.hit && o.batter === 'out' : o.hit || o.batter !== 'out' || runs > 0;
    this.banner(o.label, good ? '#ffd23f' : '#ffffff', sub, 900);
    if (o.label === 'HOME RUN!') {
      sfx.cheer(3);
      if (!this.top) this.fireworks(kid.you ? 6 : 3);
    } else if (good && (kid.you || o.label.startsWith('DIVING') || o.label === 'DOUBLE PLAY!')) {
      sfx.cheer(1.6);
    }
    await this.moveRunners(o, kid.look);
    this.outs = o.outs;
    this.bases = o.bases;
    this.halfRuns += runs;
    if (this.top) this.score.them += runs;
    else this.score.us += runs;
    if (kid.you) {
      this.line.pa += 1;
      if (o.label === 'WALK') this.line.bb += 1;
      else if (!o.label.startsWith('SACRIFICE')) this.line.ab += 1;
      if (o.hit) this.line.h += 1;
      if (o.label === 'HOME RUN!') this.line.hr += 1;
      if (o.label.startsWith('STRIKEOUT')) this.line.k += 1;
      this.line.rbi += runs;
    }
    if (this.lv.runLimit && this.halfRuns >= this.lv.runLimit) {
      this.outs = 3;
    }
    this.updateHud();
  }

  // Each runner moves to a base in `o.bases` or scores; the batter goes where the outcome says.
  private async moveRunners(o: Outcome, batterLook: Look) {
    const moves: Promise<void>[] = [];
    const next: (Phaser.GameObjects.Container | null)[] = [null, null, null];
    const taken = [false, false, false];
    if (typeof o.batter === 'number') taken[o.batter] = true;
    let runs = o.runs;
    for (let b = 2; b >= 0; b--) {
      const fig = this.runners[b];
      if (!fig) continue;
      if (o.outRunner === b || o.outs >= 3) {
        this.tweens.add({ targets: fig, alpha: 0, duration: 400, delay: 300, onComplete: () => fig.destroy() });
        continue;
      }
      if (runs > 0) {
        runs--;
        moves.push(this.runPath(fig, b, 3).then(() => fig.destroy()));
        continue;
      }
      let to = -1;
      for (let k = 2; k >= b; k--) {
        if (o.bases[k] && !taken[k]) {
          to = k;
          break;
        }
      }
      if (to < 0) {
        fig.destroy();
        continue;
      }
      taken[to] = true;
      next[to] = fig;
      if (to !== b) moves.push(this.runPath(fig, b, to));
    }
    if (o.batter !== 'out') {
      const fig = makeKid(this, batterLook);
      this.placeFig(fig, BASE_PATH[0].x, BASE_PATH[0].y, this.lv.ft * 0.95);
      const to = o.batter === 'home' ? 3 : o.batter;
      moves.push(
        this.runPath(fig, -1, to).then(() => {
          if (o.batter === 'home') fig.destroy();
        }),
      );
      if (typeof o.batter === 'number') next[o.batter] = fig;
    }
    this.runners = next;
    if (o.batter !== 'out') this.setBatter(null);
    await Promise.all(moves);
  }

  // Run from base `from` (-1 is home plate) to base `to` (3 is scoring).
  private runPath(fig: Phaser.GameObjects.Container, from: number, to: number): Promise<void> {
    const pts = BASE_PATH.slice(from + 1, to + 2);
    const segs = pts.length - 1;
    if (segs <= 0) return Promise.resolve();
    const ft = this.lv.ft * 0.95;
    return new Promise((res) => {
      this.tweens.addCounter({
        from: 0,
        to: segs,
        duration: 650 * segs,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0;
          const i = Math.min(segs - 1, Math.floor(v));
          const k = v - i;
          const a = pts[i];
          const b = pts[i + 1];
          this.placeFig(fig, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, ft);
          fig.y -= Math.abs(Math.sin(v * Math.PI * 6)) * 8 * fig.scaleY;
        },
        onComplete: () => res(),
      });
    });
  }

  // ---------- batting ----------

  private async yourPA(): Promise<Outcome> {
    this.setBatter(this.look);
    this.upText.setText("YOU'RE UP!").setColor('#ffd23f');
    this.showBatUi(true);
    const o = this.lv.tee ? await this.teePA() : await this.pitchedPA();
    this.showBatUi(false);
    this.upText.setText('');
    return o;
  }

  private swingAnim(): Promise<void> {
    return new Promise((r) => {
      if (!this.batter?.swing(this, () => r())) r();
    });
  }

  private async teePA(): Promise<Outcome> {
    for (;;) {
      this.setBall(TEE.x, TEE.y, TEE.z);
      const { q, pos } = await this.meter('TAP IN THE GREEN!', this.mode === 'power' ? 0.13 : 0.24);
      sfx.swing();
      await this.swingAnim();
      if (q === 0) {
        sfx.whiff();
        this.flash('SWING AND A MISS!', '#ffffff');
        await this.wait(1100);
        this.flash('In T-ball you keep swinging!', '#ffe066');
        await this.wait(600);
        continue;
      }
      this.cameras.main.shake(110, 0.004);
      const angle = clamp(pos * 0.5 + rnd(-0.4, 0.4), -0.7, 0.7);
      const b = battedBall(this.mode === 'power' ? Math.min(1, q * 1.05) : q, angle, this.mode, this.sk.power);
      return this.inPlay(b, this.mode, this.sk.speed, true);
    }
  }

  private async pitchedPA(): Promise<Outcome> {
    let { b, s } = { b: 0, s: 0 };
    for (;;) {
      this.count = { b, s };
      this.updateHud();
      const r = await this.pitch();
      if (r.kind === 'inplay') return r.o;
      if (r.kind === 'ball') {
        b += 1;
        this.flash(b === 4 ? 'BALL FOUR!' : 'BALL', '#8ce99a');
        if (b === 4) return resolve('BB', null, this.bases, this.outs);
      } else if (r.kind === 'strike') {
        s += 1;
        this.flash(r.swung ? 'STRIKE! (swinging)' : 'STRIKE! (looking)', '#ff8787');
        if (s === 3) return resolve('K', null, this.bases, this.outs);
      } else {
        if (r.bunt && s === 2) {
          this.flash('FOUL BUNT WITH 2 STRIKES!', '#ff8787');
          const o = resolve('K', null, this.bases, this.outs);
          return { ...o, label: 'STRIKEOUT! (foul bunt)' };
        }
        if (s < 2) s += 1;
        this.flash('FOUL BALL!', '#ffe066');
      }
      this.count = { b, s };
      this.updateHud();
      await this.wait(900);
    }
  }

  private pitchSpeed() {
    const [lo, hi] = this.lv.pitch;
    // Pitchers mix in a slow one now and then.
    return Math.random() < 0.2 ? lo * 0.75 : rnd(lo, hi);
  }

  private windup(fast: boolean, onRelease: () => void) {
    const p = this.pitcher;
    if (!p) {
      onRelease();
      return;
    }
    const { c, arm } = p;
    const k = fast ? 0.6 : 1;
    arm.setRotation(0.15);
    this.tweens.add({ targets: c, y: c.y - 6 * c.scaleY, duration: 450 * k, yoyo: true, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: arm,
      rotation: 3.0,
      duration: 480 * k,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: arm,
          rotation: 5.8,
          duration: 150,
          ease: 'Quad.easeIn',
          onComplete: () => {
            onRelease();
            this.tweens.add({ targets: arm, rotation: 0.15 + Math.PI * 2, delay: 300, duration: 300 });
          },
        });
      },
    });
  }

  // Pick where a pitch crosses the plate, and how far outside the zone that is.
  private pitchSpot() {
    const z = this.zoneBox();
    if (Math.random() < 0.58) {
      return { x: rnd(-0.7, 0.7), z: rnd(z.lo + 0.15, z.hi - 0.15), off: 0 };
    }
    if (Math.random() < 0.5) {
      const off = rnd(0.25, 1.1);
      return { x: (Math.random() < 0.5 ? -1 : 1) * (z.x + off), z: rnd(z.lo, z.hi), off };
    }
    const off = rnd(0.25, 0.9);
    return { x: rnd(-0.7, 0.7), z: Math.random() < 0.5 ? z.lo - off : z.hi + off, off };
  }

  // Animate one pitch from the mound to the catcher. `fast` is for computer at-bats.
  private throwPitch(spot: { x: number; z: number }, fast: boolean, onDone: () => void) {
    const sp = fast ? this.lv.pitch[1] : this.pitchSpeed();
    const s = { x: -1.2, y: 44, z: 0.8 * this.lv.ft };
    const endY = -5;
    const u0 = s.y / (s.y - endY);
    this.setBall(s.x, s.y, s.z);
    this.pitchTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ((s.y - endY) / sp) * 1000,
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        const v = u / u0;
        const arc = 0.9 * 4 * Math.min(v, 1) * (1 - Math.min(v, 1));
        this.setBall(s.x + (spot.x - s.x) * v, s.y + (endY - s.y) * u, s.z + (spot.z - s.z) * v + arc);
        this.ball.rotation += 0.4;
      },
      onComplete: onDone,
    });
  }

  private pitch(): Promise<PitchEnd> {
    return new Promise((done) => {
      this.phase = 'wait';
      this.swung = false;
      this.missed = false;
      this.pitchDone = (r) => {
        this.pitchDone = undefined;
        this.onTap = undefined;
        this.batter?.setBunt(false);
        done(r);
      };
      this.onTap = () => this.trySwing();
      this.time.delayedCall(650, () => {
        this.phase = 'windup';
        this.windup(false, () => {
          const spot = this.pitchSpot();
          this.pitchOff = spot.off;
          this.phase = 'flight';
          if (this.mode === 'bunt' && !this.swung) this.batter?.setBunt(true);
          this.throwPitch(spot, false, () => {
            this.phase = 'gone';
            this.hideBall();
            sfx.thud();
            this.markPitch(spot);
            if (!this.swung) this.pitchDone?.({ kind: spot.off > 0 ? 'ball' : 'strike' });
            else if (this.missed) this.pitchDone?.({ kind: 'strike', swung: true });
          });
        });
      });
    });
  }

  // A dot where the pitch crossed the plate, so you can see if it was a strike.
  private markPitch(spot: { x: number; z: number }) {
    const p = project(spot.x, 0, spot.z);
    const d = this.add.circle(p.x, p.y, 9, 0xffffff, 0.9).setStrokeStyle(3, 0xd62828).setDepth(260);
    this.tweens.add({ targets: d, alpha: 0, delay: 900, duration: 400, onComplete: () => d.destroy() });
  }

  private trySwing() {
    if (this.swung || !this.batter || this.phase === 'wait' || this.phase === 'gone') return;
    this.swung = true;
    const swing = this.mode;
    if (swing === 'bunt') {
      this.batter.bunt(this);
      this.time.delayedCall(120, () => this.contact(swing));
      return;
    }
    if (this.batter.swinging) return;
    sfx.swing();
    this.batter.swing(this, () => this.contact(swing));
  }

  private contact(swing: Swing) {
    if (!this.pitchDone) return;
    const err = this.phase === 'flight' ? this.bpos.y : this.phase === 'gone' ? -99 : 99;
    const base = swing === 'bunt' ? 11 : swing === 'power' ? 5.5 : 8;
    const win = base * (0.75 + this.sk.contact / 160);
    const off = this.pitchOff;
    const missChance = off > 0 ? Math.min(0.85, (swing === 'bunt' ? 0.2 : 0.3) + off * 0.5) : 0;
    if (Math.abs(err) > win || Math.random() < missChance) {
      sfx.whiff();
      this.missed = true;
      if (this.phase === 'gone') this.pitchDone({ kind: 'strike', swung: true });
      return;
    }
    this.pitchTween?.stop();
    this.phase = 'gone';
    let q = 1 - (err / win) ** 2;
    q *= Math.max(0.3, 1 - off * 0.6);
    q = clamp(q - (this.lv.cpu - this.sk.contact) / 400, 0, 1);
    const angle = (-err / win) * 0.95 + rnd(-0.1, 0.1);
    const foul =
      swing === 'bunt' ? Math.random() < 0.15 + (1 - q) * 0.3 : Math.abs(angle) > 0.8 || (q < 0.2 && Math.random() < 0.5);
    if (foul) {
      sfx.crack(false);
      const side = angle === 0 ? 1 : Math.sign(angle);
      void this.flyBall({ angle: side * rnd(1.0, 1.3), dist: rnd(30, 80), apex: rnd(8, 25), time: 1100 }).then(() => {
        this.hideBall();
        this.pitchDone?.({ kind: 'foul', bunt: swing === 'bunt' });
      });
      return;
    }
    if (swing !== 'bunt') this.cameras.main.shake(110, 0.004);
    const b = battedBall(q, clamp(angle, -0.75, 0.75), swing, this.sk.power);
    void this.inPlay(b, swing, this.sk.speed, true).then((o) => this.pitchDone?.({ kind: 'inplay', o }));
  }

  // A teammate's or opponent's turn at bat, played out quickly.
  private async simPA(kid: Kid): Promise<Outcome> {
    this.setBatter(kid.look);
    this.upText.setText(`${kid.name.toUpperCase()} BATTING`).setColor('#ffffff');
    const pa = cpuPA(this.lv, this.lv.cpu, this.lv.cpu);
    await this.wait(350);
    if (this.lv.tee) {
      this.setBall(TEE.x, TEE.y, TEE.z);
      await this.wait(350);
    } else {
      // Show the last pitch of the at-bat.
      const z = this.zoneBox();
      const spot = pa.kind === 'BB' ? { x: 1.6, z: z.lo } : { x: rnd(-0.6, 0.6), z: (z.lo + z.hi) / 2 };
      await new Promise<void>((r) =>
        this.windup(true, () => {
          if (pa.kind === 'inplay') {
            // Stop the pitch at the plate, where the batter hits it.
            this.throwPitch(spot, true, () => r());
            this.time.delayedCall(((44 / this.lv.pitch[1]) * 1000) - 60, () => {
              this.pitchTween?.stop();
              r();
            });
          } else this.throwPitch(spot, true, () => r());
        }),
      );
    }
    if (pa.kind !== 'inplay') {
      if (pa.kind === 'K') {
        sfx.swing();
        await this.swingAnim();
        sfx.whiff();
      } else sfx.thud();
      this.hideBall();
      this.upText.setText('');
      return resolve(pa.kind, null, this.bases, this.outs);
    }
    if (pa.swing === 'bunt') this.batter?.bunt(this);
    else {
      sfx.swing();
      await this.swingAnim();
    }
    this.upText.setText('');
    if (this.top) {
      const ch = this.youChance(pa.b);
      if (ch) return this.youField(pa.b, ch);
    }
    return this.inPlay(pa.b, pa.swing, this.lv.cpu, false);
  }

  // A ball in play that the computer fields.
  private async inPlay(b: BattedBall, swing: Swing, runSpeed: number, you: boolean): Promise<Outcome> {
    const p = judge(b, this.lv.def, runSpeed);
    const res = p.error ? 'E' : p.res;
    const dp = !!p.throwOut && this.bases[0] && this.outs < 2 && Math.random() < 0.45;
    const o = resolve(res, b, this.bases, this.outs, { dp, bunt: swing === 'bunt' });
    if (swing !== 'bunt') sfx.crack(res === 'HR');
    const gloved = p.res === 'OUT' || !!p.error;
    const ms = b.time * 1000;
    const stopAt = gloved ? (b.grounder ? ((p.t ?? b.time) * 1000) / ms : 1) : undefined;
    // Run out of the box while the ball is in the air.
    if (o.batter !== 'out' || b.grounder) this.time.delayedCall(250, () => this.batter?.c.setVisible(false));
    if (res === 'HR') {
      const dist = Math.max(b.dist, fenceR(b.angle)) + 30;
      await this.flyBall({ angle: b.angle, dist, apex: 38, time: 1900 });
      if (you) this.fireworks(5);
    } else {
      await this.flyBall({ angle: b.angle, dist: b.dist, apex: b.apex, time: ms, grounder: b.grounder, stopAt, who: p.who === 'C' ? undefined : p.who });
    }
    if (b.grounder && p.res === 'OUT' && !p.error && p.at) {
      const t = throwSpeed(this.lv.def);
      if (o.label === 'DOUBLE PLAY!') {
        await this.throwBall(p.at, SECOND, (Math.hypot(p.at.x - SECOND.x, p.at.y - SECOND.y) / t) * 1000 + 100);
        await this.throwBall(SECOND, FIRST_BASE, (60 / t) * 1000);
      } else {
        await this.throwBall(p.at, FIRST_BASE, (Math.hypot(p.at.x - FIRST_BASE.x, p.at.y - FIRST_BASE.y) / t) * 1000);
      }
      const fb = this.fielder('1B');
      if (fb) this.hop(fb);
    }
    if (you && res === 'HR') this.confettiBurst(1200);
    return o;
  }

  // ---------- fielding ----------

  // Can you get to this ball at shortstop, and do you need to dive? Null when it's not your ball.
  private youChance(b: BattedBall): Chance | null {
    const f = this.fielder(YOU_POS);
    if (!f) return null;
    const v = fielderSpeed(this.sk.fielding);
    const dive = 6 + this.sk.fielding / 10;
    let ch: Chance | null = null;
    if (!b.grounder) {
      if (b.dist > fenceR(b.angle) + 2) return null;
      const at = landing(b);
      const d = Math.hypot(f.hx - at.x, f.hy - at.y);
      const reach = v * Math.max(0, b.time - 0.35) * (b.apex < 12 ? 0.5 : 0.8) + 3;
      if (d <= reach + dive) ch = { need: d <= reach ? 'run' : 'dive', frac: 1, at, t: b.time, gap: Math.max(0, d - reach) };
    } else {
      const s = Math.sin(b.angle);
      const c = Math.cos(b.angle);
      const gs = b.dist / b.time;
      for (let p = 4; p <= b.dist; p += 1) {
        const at = { x: p * s, y: p * c };
        const t = p / gs;
        const d = Math.hypot(f.hx - at.x, f.hy - at.y);
        const reach = v * Math.max(0, t - 0.3) + 2.5;
        if (d <= reach) {
          ch = { need: 'run', frac: p / b.dist, at, t, gap: 0 };
          break;
        }
        if (!ch && d <= reach + dive) ch = { need: 'dive', frac: p / b.dist, at, t, gap: d - reach };
      }
    }
    if (!ch) return null;
    // Leave it to a teammate who gets there clearly first.
    const other = judge(b, this.lv.def, this.lv.cpu, YOU_POS);
    if (other.res === 'OUT' && !other.error && (other.t ?? 99) + 0.15 < ch.t) return null;
    return ch;
  }

  private slowMo(on: boolean) {
    this.tweens.timeScale = on ? 0.5 : 1;
    this.time.timeScale = on ? 0.5 : 1;
  }

  private async youField(b: BattedBall, ch: Chance): Promise<Outcome> {
    const you = this.fielder(YOU_POS)!;
    sfx.crack(false);
    this.time.delayedCall(250, () => this.batter?.c.setVisible(false));
    this.slowMo(true);
    this.flash("IT'S HIT TO YOU!", '#ffd23f', W / 2, 520);

    // You start running at once. On a ball you have to dive for, you end up a little short.
    const d = Math.hypot(ch.at.x - you.hx, ch.at.y - you.hy);
    const k = d > 0 ? Math.max(0, d - ch.gap - (ch.need === 'dive' ? 1 : 0)) / d : 0;
    const stand = { x: lerp(you.hx, ch.at.x, k), y: lerp(you.hy, ch.at.y, k) };
    this.runFielder(you, stand.x, stand.y, Math.max(200, ch.t * 1000 * 0.9));

    let choice: 'run' | 'dive' | null = null;
    const btns = [
      new Btn(this, W / 2 - 160, 780, 280, 86, b.grounder ? 'GRAB IT' : 'CATCH IT', 0x3b82d6, () => pickIt('run'), 34),
      new Btn(this, W / 2 + 160, 780, 280, 86, 'DIVE!', 0xe03131, () => pickIt('dive'), 40),
    ].map((x) => x.setDepth(1000));
    const pickIt = (c: 'run' | 'dive') => {
      if (choice) return;
      choice = c;
      btns.forEach((x) => x.setEnabled(false));
    };

    await this.flyBall({ angle: b.angle, dist: b.dist, apex: b.apex, time: b.time * 1000, grounder: b.grounder, stopAt: ch.frac });
    btns.forEach((x) => x.destroy());
    const picked = choice as 'run' | 'dive' | null;
    let gotIt = false;
    let note = '';
    if (picked === 'dive') {
      await this.dive(you, ch.at);
      const p = ch.need === 'run' ? 0.97 : clamp(0.5 + this.sk.fielding / 160, 0.5, 0.92);
      gotIt = Math.random() < p;
      note = gotIt ? '' : 'Off the glove!';
    } else if (picked === 'run') {
      if (ch.need === 'run') {
        gotIt = Math.random() > clamp(0.1 - this.sk.fielding / 700, 0.02, 0.1);
        note = gotIt ? '' : 'Bobbled it!';
        if (gotIt) this.hop(you);
      } else note = 'Just out of reach. You needed to DIVE!';
    } else note = 'Too slow! Tap a button next time.';
    this.slowMo(false);

    if (!gotIt) {
      this.flash(note, '#ffffff', W / 2, 520);
      if (picked && ch.need === 'run') this.line.errors += 1;
      const rest = judge(b, this.lv.def, this.lv.cpu, YOU_POS);
      const res = rest.res === 'OUT' || rest.res === 'HR' ? '1B' : rest.res;
      // The ball keeps going and an outfielder chases it.
      this.ball.setVisible(true);
      const left = Math.max(0, 1 - ch.frac);
      await this.flyBall({
        angle: b.angle,
        dist: b.grounder ? b.dist : b.dist + 14,
        apex: 0,
        time: Math.max(500, left * b.time * 1000 + (b.grounder ? 0 : 500)),
        grounder: true,
        who: rest.who && rest.who !== 'C' && rest.who !== YOU_POS ? rest.who : 'LF',
      });
      const label = picked && ch.need === 'run' ? 'SAFE ON AN ERROR!' : undefined;
      const o = resolve(label ? 'E' : res, b, this.bases, this.outs);
      return label ? { ...o, label } : o;
    }

    const dove = picked === 'dive';
    if (!b.grounder) {
      this.line.outs += 1;
      const o = resolve('OUT', b, this.bases, this.outs);
      sfx.cheer(dove ? 2.2 : 1.2);
      if (dove) this.fireworks(3);
      return { ...o, label: dove ? 'DIVING CATCH!' : 'YOU CAUGHT IT!' };
    }

    // Now throw to first before the runner gets there.
    if (dove) await this.wait(450);
    const { q } = await this.meter('THROW TO FIRST! TAP IN THE GREEN', 0.2);
    const runT = runnerTime(this.lv.cpu);
    if (q < 0.1) {
      sfx.whiff();
      this.line.errors += 1;
      await this.throwBall(ch.at, { x: FIRST_BASE.x + 14, y: FIRST_BASE.y - 6 }, 500);
      const o = resolve('E', b, this.bases, this.outs);
      return { ...o, label: 'WILD THROW!' };
    }
    const tv = throwSpeed(this.sk.arm) * (0.7 + 0.4 * q);
    const dist = Math.hypot(ch.at.x - FIRST_BASE.x, ch.at.y - FIRST_BASE.y);
    const arrive = ch.t + (dove ? 0.6 : 0) + 0.35 + dist / tv;
    const out = arrive < runT;
    const dp = out && q > 0.75 && this.bases[0] && this.outs < 2;
    if (dp) {
      await this.throwBall(ch.at, SECOND, (Math.hypot(ch.at.x - SECOND.x, ch.at.y - SECOND.y) / tv) * 1000);
      await this.throwBall(SECOND, FIRST_BASE, (60 / throwSpeed(this.lv.def)) * 1000);
    } else {
      await this.throwBall(ch.at, FIRST_BASE, (dist / tv) * 1000);
    }
    const fb = this.fielder('1B');
    if (fb) this.hop(fb);
    if (!out) {
      const o = resolve('1B', b, this.bases, this.outs);
      return { ...o, label: 'SAFE! BEAT THE THROW', hit: true };
    }
    this.line.outs += dp ? 2 : 1;
    const o = resolve('OUT', b, this.bases, this.outs, { dp });
    if (dove) return { ...o, label: dp ? 'DIVING DOUBLE PLAY!' : 'DIVING STOP! OUT!' };
    return dp ? o : { ...o, label: q > 0.85 ? 'GREAT THROW! OUT!' : 'OUT AT FIRST!' };
  }

  private dive(f: Fielder, to: Pt): Promise<void> {
    const side = project(to.x, to.y).x < f.c.x ? -1 : 1;
    this.tweens.add({ targets: f.c, angle: side * 80, duration: 140 });
    const sx = f.x;
    const sy = f.y;
    sfx.thud();
    return new Promise((res) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 170,
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          f.x = lerp(sx, to.x, k);
          f.y = lerp(sy, to.y, k);
          this.placeFig(f.c, f.x, f.y);
        },
        onComplete: () => res(),
      });
    });
  }

  // ---------- end of the game ----------

  private async finish() {
    this.setBatter(null);
    this.showBatUi(false);
    const p = this.prof;
    const before = { tokens: p.tokens, money: p.money, level: levelIndex(p) };
    const won = this.score.us > this.score.them;
    const tie = this.score.us === this.score.them;
    const money = 10 + (won ? 15 : tie ? 5 : 0) + this.line.h * 5 + this.line.hr * 10 + this.line.outs * 3;
    const tokens = won ? 3 : 2;
    // Kids grow: two skills go up a point every game.
    const grew = Phaser.Utils.Array.Shuffle(SKILLS.map((s) => s.id)).slice(0, 2) as SkillId[];
    grew.forEach((id) => (p.skills[id] = Math.min(99, p.skills[id] + 1)));
    p.games += 1;
    if (won) p.wins += 1;
    else if (tie) p.ties += 1;
    else p.losses += 1;
    p.hits += this.line.h;
    p.homers += this.line.hr;
    p.atBats += this.line.ab;
    p.money += money;
    p.tokens += tokens;
    saveProfile(p);
    const moved = levelIndex(p) > before.level;

    if (won) {
      sfx.fanfare();
      this.confettiBurst(2200);
    } else sfx.aww();
    const panel = new Panel(this, 820, 620);
    const title = won ? 'YOU WIN!' : tie ? 'TIE GAME!' : 'TOUGH LOSS';
    panel.add(txt(this, W / 2, 180, title, 68, { color: '#ffd23f', strokeThickness: 12 }));
    panel.add(
      txt(this, W / 2, 248, `${this.us.name} ${this.score.us},  ${this.them.name} ${this.score.them}`, 30, {
        color: INK,
        strokeThickness: 0,
      }),
    );
    const l = this.line;
    const bat = `${l.h} for ${l.ab}` + (l.hr ? `  ·  ${l.hr} HR` : '') + (l.rbi ? `  ·  ${l.rbi} RBI` : '') + (l.bb ? `  ·  ${l.bb} BB` : '');
    const field = l.outs ? `${l.outs} out${l.outs === 1 ? '' : 's'} in the field` : 'No outs in the field this time';
    const names = grew.map((id) => SKILLS.find((s) => s.id === id)!.name);
    panel.add(
      txt(this, W / 2, 345, `Your game: ${bat}\n${field}\nYou earned $${money} and ${tokens} tokens!\nYou grew: +1 ${names[0]}, +1 ${names[1]}`, 26, {
        body: true,
        color: INK,
      }),
    );
    const done = gamesInLevel(p);
    const next = LEVELS[levelIndex(p)];
    const prog = moved
      ? `MOVING UP! Next stop: ${next.name} (age ${next.age})!`
      : levelIndex(p) === LEVELS.length - 1 && p.games >= GAMES_PER_LEVEL * LEVELS.length
        ? `${next.name} veteran: ${p.games} games played!`
        : `Game ${done} of ${GAMES_PER_LEVEL} in ${next.name}`;
    panel.add(txt(this, W / 2, 455, prog, moved ? 34 : 26, { color: moved ? '#e2457a' : '#5b6b88', strokeThickness: 0 }));
    if (moved) {
      this.fireworks(6);
      this.confettiBurst(3000);
    }
    const home = project(0, 0, 3);
    await this.award(this.cash, 'cash', money, home.x - 60, home.y - 300, before.money);
    await this.award(this.tokens, 'coin', tokens, home.x + 60, home.y - 300, before.tokens);
    panel.add(new Btn(this, W / 2 - 170, 560, 300, 80, 'NEXT GAME', 0x2fa84f, () => goto(this, 'game'), 34));
    panel.add(new Btn(this, W / 2 + 170, 560, 300, 80, 'CLUBHOUSE', 0x3b82d6, () => goto(this, 'hub'), 34));
  }
}
