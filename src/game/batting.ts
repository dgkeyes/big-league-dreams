// Batting in first person: the pitch comes in, the player picks POWER, CONTACT, or BUNT, and taps SWING in time.
import * as THREE from 'three';
import { clock } from '../clock';
import { battedBall, fenceR, type BattedBall, type Swing } from '../play';
import type { Level, Skills } from '../data';
import type { Kid } from '../gfx/kid';
import { part, geo, P } from '../gfx/toon';
import { sfx } from '../sfx';
import { Park, clamp, rnd, type XYH } from './park';

export type PitchResult =
  | { kind: 'ball' }
  | { kind: 'strike'; swung: boolean }
  | { kind: 'foul'; bunt: boolean }
  | { kind: 'inplay'; b: BattedBall; swing: Swing; q: number; err: number };

export type PAResult = { kind: 'K' } | { kind: 'BB' } | { kind: 'inplay'; b: BattedBall; swing: Swing; q: number };

export interface BatHud {
  banner(text: string, sub?: string, color?: string): void;
  count(balls: number, strikes: number): void;
}

export interface BatOptions {
  // 'quest' uses the home-run quest's hit model, tuned so steady swings clear the fence.
  model: 'game' | 'quest';
  // Feet per second for each pitch.
  speed: () => number;
  // Chance a pitch is in the strike zone.
  strikeRate: number;
  // How good the other team is (0 to 100); better pitchers take a little off your contact.
  cpu: number;
}

const QUEST_WINDOW = 7;

export class Batting {
  private fp = new THREE.Group();
  private bat = new THREE.Group();
  private zone: THREE.LineLoop;
  private tee: THREE.Group;
  private swingMode: Swing = 'contact';
  private busy = false;
  // Set while a pitch is live, so a swing can be judged against it.
  private live: ((now: number) => void) | null = null;
  readonly lo: number;
  readonly hi: number;

  constructor(
    private park: Park,
    private lv: Level,
    private sk: () => Skills,
    private hud: BatHud,
    batColor = 0xd9a066,
    gloveColor = 0x2f6fe0,
    skin = 0xf1c27d,
  ) {
    this.lo = lv.ft * 0.32;
    this.hi = lv.ft * 0.68;
    // The bat and hands, held up by the camera like in a first-person game.
    const barrel = part(geo.cyl(0.085, 0.04, 2.3, 10), batColor, 0.02);
    barrel.position.y = 1.15;
    this.bat.add(barrel);
    for (const y of [0.0, 0.22]) {
      const hand = part(geo.sphere(0.13, 10), y ? skin : gloveColor, 0.02);
      hand.scale.set(1, 0.8, 1);
      hand.position.y = y;
      this.bat.add(hand);
    }
    this.fp.add(this.bat);
    this.fp.visible = false;
    park.camera.add(this.fp);
    park.scene.add(park.camera);
    this.restPose();

    const pts = [new THREE.Vector3(-0.83, this.lo, 0), new THREE.Vector3(0.83, this.lo, 0), new THREE.Vector3(0.83, this.hi, 0), new THREE.Vector3(-0.83, this.hi, 0)];
    this.zone = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    this.zone.visible = false;
    park.scene.add(this.zone);

    this.tee = new THREE.Group();
    const post = part(geo.cyl(0.09, 0.09, lv.ft * 0.5, 8), 0x222222, 0.02);
    post.position.y = lv.ft * 0.25;
    this.tee.add(post);
    const base = part(geo.box(1.2, 0.12, 1.2), 0x222222, 0.02);
    base.position.y = 0.06;
    this.tee.add(base);
    this.tee.position.copy(P(0, 1.2));
    this.tee.visible = false;
    park.scene.add(this.tee);
  }

  private restPose() {
    this.bat.position.set(0.62, -0.62, -1.15);
    this.bat.rotation.set(0.35, 0, -0.55);
  }

  // Look out from the batter's box, a step behind your own eyes so you can see the plate.
  enter(showZone: boolean) {
    const eye = this.lv.ft * 0.92;
    const cam = this.park.camera;
    cam.position.copy(P(-1.5, -5.5, eye + 0.6));
    cam.lookAt(P(0, 22, this.lv.ft * 0.45));
    this.fp.visible = true;
    this.zone.visible = showZone;
    // The catcher squats right where the camera is, so hide them while you bat.
    const c = this.park.fielders.get('C');
    if (c) c.visible = false;
    this.restPose();
  }

  leave() {
    const c = this.park.fielders.get('C');
    if (c) c.visible = true;
    this.fp.visible = false;
    this.zone.visible = false;
    this.tee.visible = false;
  }

  // Called by the SWING button.
  swing(mode: Swing) {
    if (this.busy || !this.fp.visible) return;
    this.busy = true;
    this.swingMode = mode;
    if (mode === 'bunt') {
      // Square around and hold the bat out over the plate.
      void clock.tween(0.12, (k) => {
        this.bat.position.set(0.62 - 0.5 * k, -0.62 + 0.15 * k, -1.15);
        this.bat.rotation.set(0.35 - 0.5 * k, 0, -0.55 + 2.1 * k);
      });
    } else {
      sfx.swing();
      const fast = mode === 'power' ? 0.22 : 0.26;
      void clock.tween(fast, (k) => {
        const e = k * k;
        this.bat.rotation.set(0.35 - 1.6 * e, 0.4 * e, -0.55 + 3.6 * e);
        this.bat.position.set(0.62 - 0.9 * e, -0.62 + 0.1 * e, -1.15 - 0.2 * e);
      });
    }
    // The bat reaches the plate about 0.12 s after the tap.
    void clock.wait(0.12).then(() => this.live?.(clock.now));
  }

  private async recover() {
    await clock.wait(0.45);
    this.restPose();
    this.busy = false;
  }

  // One pitch from `pitcher` (a kid or the coach). Resolves with what happened.
  pitch(pitcher: Kid | null, opt: BatOptions): Promise<PitchResult> {
    return new Promise<PitchResult>((resolve) => {
      this.busy = false;
      this.restPose();
      const park = this.park;
      const ry = pitcher ? pitcher.fy - 2 : this.lv.pitchDist;
      const rx = (pitcher?.fx ?? 0) - 0.8;
      const rh = (pitcher ? pitcher.heightFt : this.lv.ft) * 1.05;
      const inZone = Math.random() < opt.strikeRate;
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = inZone ? rnd(-0.6, 0.6) : side * rnd(1.05, 1.8);
      const th = inZone || Math.random() < 0.5 ? rnd(this.lo + 0.15, this.hi - 0.15) : Math.random() < 0.5 ? this.lo - rnd(0.4, 0.9) : this.hi + rnd(0.4, 0.9);
      const off = Math.max(0, Math.abs(tx) - 0.83) + Math.max(0, this.lo - th, th - this.hi);
      const v = opt.speed();
      const T = ry / v;
      let t0 = -1;
      let done = false;
      const finish = (r: PitchResult) => {
        if (done) return;
        done = true;
        this.live = null;
        resolve(r);
      };
      let missed = false;
      const ballY = (now: number) => (t0 < 0 ? 99 : ry * (1 - (now - t0) / T));

      this.live = (now) => {
        if (done) return;
        const y = ballY(now);
        const err = t0 < 0 ? 99 : y < -4 ? -99 : y;
        const r = this.contact(this.swingMode, err, off, opt);
        if (!r) {
          sfx.whiff();
          this.hud.banner(err > 0 ? 'TOO EARLY!' : 'TOO LATE!', '', '#ffffff');
          void this.recover();
          if (t0 < 0 || y < 0) finish({ kind: 'strike', swung: true });
          else missed = true;
          return;
        }
        finish(r);
      };

      // Windup, then the pitch.
      void (async () => {
        if (pitcher) {
          pitcher.face(-pitcher.fx, -pitcher.fy);
          await clock.tween(0.6, (k) => pitcher.pose('throw', k * 0.5));
          void clock.tween(0.2, (k) => pitcher.pose('throw', 0.5 + k * 0.5)).then(() => pitcher.pose('stand'));
        } else await clock.wait(0.4);
        if (done) return;
        t0 = clock.now;
        // Tests can make the batter swing on time by setting window.__autoSwing to a swing type.
        const auto = import.meta.env.DEV && (window as unknown as { __autoSwing?: Swing }).__autoSwing;
        if (auto) void clock.wait(Math.max(0, T - 0.12 + rnd(-0.03, 0.03))).then(() => this.swing(auto));
        const R: XYH = { x: rx, y: ry, h: rh };
        await clock.tween(T * (1 + 4 / ry), (k) => {
          if (done) return false;
          const u = k * (1 + 4 / ry);
          park.setBall({ x: R.x + (tx - R.x) * u, y: R.y * (1 - u), h: R.h + (th - R.h) * u + 0.8 * 4 * Math.min(u, 1) * (1 - Math.min(u, 1)) });
        });
        if (done) return;
        sfx.thud();
        park.setBall(null);
        if (missed) finish({ kind: 'strike', swung: true });
        else finish(off > 0 ? { kind: 'ball' } : { kind: 'strike', swung: false });
      })();
    });
  }

  // Swing at a ball sitting on the tee. Waits for the player.
  async teeSwing(opt: BatOptions): Promise<PitchResult> {
    this.busy = false;
    this.restPose();
    this.tee.visible = true;
    const spot = { x: 0, y: 1.2, h: this.lv.ft * 0.5 + 0.2 };
    this.park.setBall(spot);
    const auto = import.meta.env.DEV && (window as unknown as { __autoSwing?: Swing }).__autoSwing;
    if (auto) void clock.wait(0.5).then(() => this.swing(auto));
    const r = await new Promise<PitchResult | null>((resolve) => {
      this.live = () => {
        this.live = null;
        // A steadier hitter barrels it up more often.
        const win = 8 * (0.75 + this.sk().contact / 160);
        const err = rnd(-1, 1) * win * (1.05 - this.sk().contact / 140);
        resolve(this.contact(this.swingMode, err, 0, opt));
      };
    });
    this.tee.visible = false;
    if (!r) {
      sfx.whiff();
      this.park.setBall(spot);
      await this.recover();
      return { kind: 'strike', swung: true };
    }
    return r;
  }

  // Judge a swing. Null is a miss.
  private contact(swing: Swing, err: number, off: number, opt: BatOptions): PitchResult | null {
    const sk = this.sk();
    if (opt.model === 'quest') {
      const win = QUEST_WINDOW * (0.75 + sk.contact / 160) * (swing === 'power' ? 0.75 : 1);
      if (Math.abs(err) > win) return null;
      sfx.crack(true);
      const q = 1 - (err / win) ** 2;
      const angle = clamp((-err / win) * 0.75 + rnd(-0.12, 0.12), -0.75, 0.75);
      let dist = 45 + q * (130 + (sk.power - 40) * 0.4) + rnd(-8, 8) + (swing === 'power' ? 12 : 0);
      const homer = dist > fenceR(angle) + 2;
      if (homer) dist += 30;
      const grounder = !homer && q < 0.35;
      const apex = homer ? 38 : grounder ? 0 : 10 + q * 26;
      const time = homer ? 1.9 : (grounder ? 0.7 : 0.9) + dist * 0.008;
      return { kind: 'inplay', b: { angle, dist, apex, grounder, time }, swing, q, err };
    }
    const base = swing === 'bunt' ? 11 : swing === 'power' ? 5.5 : 8;
    const win = base * (0.75 + sk.contact / 160);
    const missChance = off > 0 ? Math.min(0.85, (swing === 'bunt' ? 0.2 : 0.3) + off * 0.5) : 0;
    if (Math.abs(err) > win || Math.random() < missChance) return null;
    let q = 1 - (err / win) ** 2;
    q *= Math.max(0.3, 1 - off * 0.6);
    q = clamp(q - (opt.cpu - sk.contact) / 400, 0, 1);
    const angle = (-err / win) * 0.95 + rnd(-0.1, 0.1);
    const foul = swing === 'bunt' ? Math.random() < 0.15 + (1 - q) * 0.3 : Math.abs(angle) > 0.8 || (q < 0.2 && Math.random() < 0.5);
    if (foul) {
      sfx.crack(false);
      return { kind: 'foul', bunt: swing === 'bunt' };
    }
    sfx.crack(q > 0.85 && swing === 'power');
    return { kind: 'inplay', b: battedBall(q, clamp(angle, -0.75, 0.75), swing, sk.power), swing, q, err };
  }

  // A foul ball flies off to the side.
  async foulBall() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const b: BattedBall = { angle: side * rnd(1.0, 1.35), dist: rnd(30, 70), apex: rnd(10, 25), grounder: false, time: 1.1 };
    await this.park.flyBall(b, 1.1, this.lv.ft * 0.5);
    this.park.setBall(null);
  }

  // A whole plate appearance for the player, pitch by pitch.
  async atBat(pitcher: Kid | null, opt: BatOptions, tee: boolean): Promise<PAResult> {
    let balls = 0;
    let strikes = 0;
    let onTee = false;
    this.enter(!tee);
    for (;;) {
      this.hud.count(balls, strikes);
      await clock.wait(0.6);
      const r = onTee ? await this.teeSwing(opt) : await this.pitch(pitcher, opt);
      switch (r.kind) {
        case 'inplay':
          return r;
        case 'ball':
          // A coach's wild pitch doesn't count in T-ball.
          if (tee) break;
          balls++;
          this.hud.banner('BALL', `${balls} - ${strikes}`, '#9ad7ff');
          if (balls >= 4) {
            this.hud.banner('WALK!', 'Take your base', '#9ad7ff');
            this.leave();
            return { kind: 'BB' };
          }
          break;
        case 'strike':
          strikes++;
          if (!r.swung) this.hud.banner('STRIKE!', `${balls} - ${strikes}`, '#ff8787');
          if (strikes >= 3) {
            if (tee) {
              // T-ball never strikes you out: after three misses, the ball goes on the tee.
              if (!onTee) this.hud.banner('TEE TIME!', 'Hit it off the tee', '#ffd23f');
              onTee = true;
              break;
            }
            this.hud.banner('STRIKE THREE!', 'You struck out', '#ff8787');
            this.leave();
            return { kind: 'K' };
          }
          break;
        case 'foul':
          this.hud.banner('FOUL BALL', '', '#ffffff');
          await this.foulBall();
          if (r.bunt && strikes === 2 && !tee) {
            this.hud.banner('FOUL BUNT', 'Strike three!', '#ff8787');
            this.leave();
            return { kind: 'K' };
          }
          if (strikes < 2) strikes++;
          break;
      }
      this.park.setBall(onTee ? this.park.ballPos() : null);
    }
  }
}

