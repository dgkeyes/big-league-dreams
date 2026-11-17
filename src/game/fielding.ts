// Fielding in first person: run with the joystick, look by dragging, then FIELD, DIVE, and THROW.
import * as THREE from 'three';
import { clock } from '../clock';
import { fielderSpeed, runnerTime, throwSpeed, type BattedBall, type Result } from '../play';
import type { Level, Pos, Skills } from '../data';
import type { Joystick, LookPad } from '../input';
import { part, geo, P } from '../gfx/toon';
import { sfx } from '../sfx';
import { Park, BASES, ballAt, clamp, type XY, type XYH } from './park';

export type FieldResult = { kind: 'catch' } | { kind: 'out' } | { kind: 'safe'; res: Result; label: string };
export type FieldButtons = 'none' | 'field' | 'throw' | 'throwIn' | 'step';

export interface FieldHud {
  banner(text: string, sub?: string, color?: string): void;
  buttons(state: FieldButtons): void;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Fielding {
  x = 0;
  y = 0;
  yaw = 0;
  pitch = 0;
  pos: Pos = 'SS';
  active = false;
  // True while a ball hit to the player is live; the joystick always works, but the camera only chases the ball then.
  private chasing = false;
  // True for the whole time the player has a play to make.
  busy = false;
  private eye: number;
  private glove = new THREE.Group();
  private heldBall: THREE.Mesh;
  private ring: THREE.Mesh;
  private reachUntil = -1;
  private diveUntil = -1;
  private stunUntil = -1;
  private diveDir = { x: 0, y: 0 };
  private wantThrow = false;
  // Somewhere for the camera to look when the player isn't steering it.
  focus: XYH | null = null;

  constructor(
    private park: Park,
    lv: Level,
    private sk: () => Skills,
    private hud: FieldHud,
    private joy: Joystick,
    private look: LookPad,
    gloveColor = 0x9a5a2b,
  ) {
    this.eye = lv.ft * 0.92;
    const mitt = part(geo.sphere(0.32, 12), gloveColor, 0.03);
    mitt.scale.set(0.42, 0.46, 0.28);
    this.glove.add(mitt);
    this.heldBall = part(geo.sphere(0.14, 10), 0xffffff, 0.02);
    this.heldBall.position.set(0.05, 0.05, 0.2);
    this.heldBall.visible = false;
    this.glove.add(this.heldBall);
    this.glove.visible = false;
    park.camera.add(this.glove);
    park.scene.add(park.camera);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    park.scene.add(this.ring);
    this.gloveRest();
  }

  private gloveRest() {
    this.glove.position.set(-0.78, -0.56, -1.6);
    this.glove.rotation.set(0.2, 0.3, 0.3);
  }

  // Stand at a position, ready for the pitch.
  enter(pos: Pos) {
    this.pos = pos;
    const s = this.park.spotOf(pos);
    this.x = s.x;
    this.y = pos === 'P' ? s.y - 1 : s.y;
    this.faceTo(0, 0);
    this.pitch = -0.08;
    this.active = true;
    this.chasing = false;
    this.glove.visible = true;
    this.heldBall.visible = false;
    this.gloveRest();
  }

  leave() {
    this.active = false;
    this.glove.visible = false;
    this.ring.visible = false;
  }

  private faceTo(tx: number, ty: number) {
    this.yaw = Math.atan2(-(tx - this.x), ty - this.y);
  }

  update(dt: number) {
    if (!this.active) return;
    const now = clock.now;
    const drag = this.look.take();
    this.yaw -= drag.x * 0.006;
    this.pitch = clamp(this.pitch - drag.y * 0.005, -1.1, 0.9);
    if (now - this.look.lastDrag > 1.2 && this.focus) {
      // Turn toward the ball, unless the player is looking around on their own.
      const want = Math.atan2(-(this.focus.x - this.x), this.focus.y - this.y);
      const d = Math.hypot(this.focus.x - this.x, this.focus.y - this.y);
      const wantP = clamp(Math.atan2(this.focus.h - this.eye, Math.max(d, 1)), -0.9, 1.0);
      const k = 1 - Math.exp(-dt * (this.chasing ? 6 : 3));
      this.yaw += wrap(want - this.yaw) * k;
      this.pitch += (wantP - this.pitch) * k;
    }
    let camH = this.eye;
    if (now < this.diveUntil) {
      const k = 1 - (this.diveUntil - now) / 0.45;
      this.x += this.diveDir.x * 20 * dt;
      this.y += this.diveDir.y * 20 * dt;
      camH = this.eye - (this.eye - 1) * Math.min(1, k * 2);
    } else if (now < this.stunUntil) {
      camH = 1 + (this.eye - 1) * (1 - (this.stunUntil - now) / 0.9);
    } else if (import.meta.env.DEV && this.chasing && (window as unknown as { __autoField?: boolean }).__autoField) {
      // Test helper: run at the ball and grab it.
      const b = this.focus ?? this.park.ballPos();
      const d = Math.hypot(b.x - this.x, b.y - this.y);
      const v = fielderSpeed(this.sk().fielding) * 1.3;
      if (d > 0.5) {
        this.x += ((b.x - this.x) / d) * Math.min(d, v * dt);
        this.y += ((b.y - this.y) / d) * Math.min(d, v * dt);
      }
      if (d < 3) this.field();
    } else if (this.joy.active) {
      const v = fielderSpeed(this.sk().fielding) * 1.3 * (this.heldBall.visible ? 0.4 : 1);
      const fx = -Math.sin(this.yaw);
      const fy = Math.cos(this.yaw);
      const rx = Math.cos(this.yaw);
      const ry = Math.sin(this.yaw);
      this.x += (rx * this.joy.x + fx * this.joy.y) * v * dt;
      this.y += (ry * this.joy.x + fy * this.joy.y) * v * dt;
      camH += Math.abs(Math.sin(now * 14)) * 0.12;
    }
    this.x = clamp(this.x, -140, 140);
    this.y = clamp(this.y, -20, 160);
    const cam = this.park.camera;
    cam.position.copy(P(this.x, this.y, camH));
    cam.rotation.set(this.pitch, this.yaw, now < this.diveUntil ? 0.25 : 0, 'YXZ');
    this.park.sizeBall();
    if (now < this.reachUntil) this.glove.position.set(-0.25, -0.3, -1.4);
    else if (now < this.diveUntil) this.glove.position.set(-0.1, -0.15, -1.5);
    else this.gloveRest();
  }

  // FIELD button: hold the glove out for a moment.
  field() {
    if (!this.chasing || clock.now < this.stunUntil) return;
    this.reachUntil = clock.now + 0.6;
  }

  // DIVE button: lunge at the ball.
  dive() {
    if (!this.chasing || clock.now < this.stunUntil || clock.now < this.diveUntil) return;
    const b = this.park.ballPos();
    const d = Math.hypot(b.x - this.x, b.y - this.y) || 1;
    this.diveDir = { x: (b.x - this.x) / d, y: (b.y - this.y) / d };
    this.diveUntil = clock.now + 0.45;
    this.reachUntil = this.diveUntil;
    this.stunUntil = this.diveUntil + 0.9;
    sfx.thud();
  }

  throwNow() {
    this.wantThrow = true;
  }

  // The ball was hit to the player. Play it out and say what happened.
  async play(...args: Parameters<Fielding['playBall']>): Promise<FieldResult> {
    try {
      return await this.playBall(...args);
    } finally {
      this.busy = false;
    }
  }

  private async playBall(b: BattedBall, runSpeed: number, h0: number, onFirst: XY = BASES[1]): Promise<FieldResult> {
    const park = this.park;
    const t0 = clock.now;
    const rt = runnerTime(runSpeed);
    this.chasing = true;
    this.busy = true;
    this.wantThrow = false;
    this.reachUntil = this.diveUntil = this.stunUntil = -1;
    this.hud.buttons('field');
    if (!b.grounder) {
      const end = ballAt(b, b.time, h0);
      this.ring.position.set(end.x, 0.08, -end.y);
      this.ring.visible = true;
    }
    // Slow things down a little so a young player can get there.
    clock.scale = 0.7;
    let stopped: XYH | null = null;
    let have: 'catch' | 'pickup' | null = null;
    let gone = false;
    await clock.until(() => {
      const t = clock.now - t0;
      const p = stopped ?? ballAt(b, t, h0);
      park.setBall(p);
      this.focus = p;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      const reach = clock.now < this.diveUntil ? 4.2 : 3.4;
      const reachable = p.h < this.eye + 2.8;
      if (clock.now < this.reachUntil && d <= reach && reachable) {
        have = !b.grounder && t < b.time && !stopped ? 'catch' : 'pickup';
        return true;
      }
      // A grounder that reaches the player's feet stops there; FIELD picks it up.
      if (!stopped && b.grounder && d < 1.6 && p.h < 2.5) {
        stopped = { x: p.x, y: p.y, h: 0.2 };
        sfx.thud();
      }
      const late = t > b.time + (b.grounder ? 1.2 : 2.2);
      if (late && !stopped && d > 10) {
        gone = true;
        return true;
      }
      return false;
    });
    clock.scale = 1;
    this.ring.visible = false;
    const t = clock.now - t0;
    if (gone) {
      this.chasing = false;
      this.hud.buttons('none');
      this.focus = null;
      park.setBall(null);
      const d = b.dist;
      const res: Result = d < 95 ? '1B' : d < 135 || Math.random() < 0.6 ? '2B' : '3B';
      return { kind: 'safe', res, label: 'IT GOT BY YOU!' };
    }
    sfx.thud();
    this.heldBall.visible = true;
    park.setBall(null);
    this.focus = null;
    if (have === 'catch') {
      this.chasing = false;
      this.hud.buttons('none');
      this.hud.banner(clock.now < this.diveUntil + 0.05 ? 'DIVING CATCH!' : 'YOU CAUGHT IT!', 'OUT!', '#69db7c');
      await clock.wait(1.2);
      this.heldBall.visible = false;
      return { kind: 'catch' };
    }
    // Got it on the ground. Now beat the runner to first.
    const far = Math.hypot(this.x, this.y) > 105;
    const nearBag = Math.hypot(this.x - onFirst.x, this.y - onFirst.y) < 6;
    this.hud.buttons(far ? 'throwIn' : nearBag ? 'step' : 'throw');
    this.chasing = false;
    this.focus = { ...onFirst, h: 2 };
    if (import.meta.env.DEV && (window as unknown as { __autoField?: boolean }).__autoField) void clock.wait(0.3).then(() => this.throwNow());
    await clock.until(() => this.wantThrow || clock.now - t0 > rt + 0.6);
    this.hud.buttons('none');
    if (this.wantThrow && !far) {
      this.heldBall.visible = false;
      const from = { x: this.x, y: this.y, h: this.eye - 0.5 };
      const to = { ...onFirst, h: 3 };
      // Your throws carry a bit more than the computer's, since a person needs a moment to tap THROW.
      const arm = throwSpeed(this.sk().arm) * 1.15;
      const flight = nearBag ? 0.2 : Math.hypot(to.x - from.x, to.y - from.y) / arm;
      const arrive = clock.now - t0 + flight + 0.1;
      if (!nearBag) {
        sfx.swing();
        await park.throwBall(from, to, arm);
      } else await clock.wait(0.2);
      park.setBall(null);
      sfx.thud();
      if (arrive < rt) return { kind: 'out' };
      return { kind: 'safe', res: '1B', label: 'SAFE AT FIRST!' };
    }
    this.heldBall.visible = false;
    if (far) {
      const res: Result = b.dist < 95 || t < 2.5 ? '1B' : '2B';
      return { kind: 'safe', res, label: res === '1B' ? 'BASE HIT' : 'DOUBLE!' };
    }
    return { kind: 'safe', res: '1B', label: 'TOO SLOW! SAFE!' };
  }
}
