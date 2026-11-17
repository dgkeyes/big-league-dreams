// A ballpark with players in it, plus the moves they make: running, throwing, catching, and the flight of the ball.
import * as THREE from 'three';
import { clock } from '../clock';
import { FIELDERS, fenceR, type BattedBall } from '../play';
import type { Level, Pos } from '../data';
import { buildPark, BASES } from '../gfx/field3d';
import { Kid, type Kit, type Look, type Uniform } from '../gfx/kid';
import { part, geo, P } from '../gfx/toon';

export { BASES };
export type XY = { x: number; y: number };
export type XYH = { x: number; y: number; h: number };

export const SPOTS: Record<Pos, XY> = {
  ...(Object.fromEntries(FIELDERS.map((f) => [f.id, { x: f.x, y: f.y }])) as Record<Pos, XY>),
  C: { x: 0, y: -4 },
};
export const ORDER: Pos[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Where a batted ball is t seconds after contact. Fly balls roll a little after they land; nothing rolls through the fence.
export function ballAt(b: BattedBall, t: number, h0 = 2.4): XYH {
  const s = Math.sin(b.angle);
  const c = Math.cos(b.angle);
  const wall = fenceR(b.angle) - 1.5;
  let d: number;
  let h: number;
  if (b.grounder) {
    const k = Math.min(1, t / b.time);
    d = b.dist * (1 - (1 - k) ** 2);
    h = 0.15 + Math.abs(Math.sin(k * Math.PI * 5)) * 2.6 * (1 - k) ** 2 + h0 * Math.max(0, 1 - k * 12);
  } else if (t <= b.time) {
    const k = t / b.time;
    d = b.dist * k;
    h = h0 * (1 - k) + 4 * b.apex * k * (1 - k) + 0.15 * k;
  } else {
    const r = Math.min(1, (t - b.time) / 1.8);
    d = b.dist + (b.apex > 14 ? 10 : 22) * (1 - (1 - r) ** 2);
    h = 0.15 + Math.abs(Math.sin(r * Math.PI * 2)) * 2 * (1 - r);
  }
  if (b.dist < wall + 3) d = Math.min(d, wall);
  return { x: d * s, y: d * c, h };
}

export class Park {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1.44, 0.1, 4000);
  readonly ball: THREE.Mesh;
  private shadow: THREE.Mesh;
  fielders = new Map<Pos, Kid>();
  runners: (Kid | null)[] = [null, null, null];
  batter: Kid | null = null;
  pitcher: Kid | null = null;
  private extras: THREE.Object3D[] = [];
  private camTarget = new THREE.Vector3(0, 0, -60);

  constructor(
    public lv: Level,
    home = 'HOME',
    away = 'AWAY',
  ) {
    buildPark(this.scene, home, away);
    this.ball = part(geo.sphere(0.24, 12), 0xffffff, 0.04);
    this.ball.visible = false;
    this.scene.add(this.ball);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.visible = false;
    this.scene.add(this.shadow);
  }

  kid(look: Look, uni: Uniform, kit: Kit = {}, ft = this.lv.ft) {
    const k = new Kid(look, uni, kit, ft);
    this.scene.add(k);
    return k;
  }

  remove(k: Kid | null) {
    if (k) this.scene.remove(k);
  }

  // Put a team on the field. `you` leaves that position empty, because the player stands there in first person.
  setDefense(uni: Uniform, kids: { look: Look }[], you?: Pos) {
    for (const k of this.fielders.values()) this.scene.remove(k);
    this.fielders.clear();
    ORDER.forEach((pos, i) => {
      if (pos === you) return;
      const k = this.kid(kids[i % kids.length].look, uni);
      this.fielders.set(pos, k);
    });
    this.resetFielders();
    this.pitcher = this.fielders.get('P') ?? null;
  }

  spotOf(pos: Pos): XY {
    // In T-ball a coach pitches, so the kid playing pitcher stands off to the side.
    if (pos === 'P') return this.lv.tee ? { x: 9, y: this.lv.pitchDist + 6 } : { x: 0, y: this.lv.pitchDist };
    return SPOTS[pos];
  }

  resetFielders() {
    for (const [pos, k] of this.fielders) {
      k.userData.tok = (k.userData.tok ?? 0) + 1;
      const s = this.spotOf(pos);
      k.setField(s.x, s.y);
      k.face(-s.x, -s.y);
      k.pose(pos === 'P' ? 'stand' : pos === 'C' ? 'crouch' : 'ready');
      k.visible = true;
    }
  }

  // A T-ball coach pitches instead of a kid: a grown-up in a team jacket.
  coach(uni: Uniform) {
    const look: Look = { gender: 'boy', skin: 0xe0ac69, hair: 0x6b4a2b, hairStyle: 'short', eyes: 0x4a2e17, number: 0 };
    const c = this.kid(look, { ...uni, jersey: 0x495057, pants: 0x343a40 }, {}, 5.9);
    c.setField(0, this.lv.pitchDist - 4);
    c.face(0, -1);
    this.extras.push(c);
    return c;
  }

  setBatter(look: Look | null, uni?: Uniform, kit?: Kit) {
    this.remove(this.batter);
    this.batter = null;
    if (!look || !uni) return null;
    const k = this.kid(look, uni, kit);
    k.setField(-2.6, 0.2);
    k.face(1, 0);
    k.pose('bat');
    this.batter = k;
    return k;
  }

  setBall(p: XYH | null) {
    this.ball.visible = this.shadow.visible = !!p;
    if (!p) return;
    this.ball.position.set(p.x, Math.max(0.2, p.h), -p.y);
    this.shadow.position.set(p.x, 0.05, -p.y);
    this.ball.rotation.x += 0.3;
  }

  ballPos(): XYH {
    return { x: this.ball.position.x, y: -this.ball.position.z, h: this.ball.position.y };
  }

  // Run a kid somewhere. Starting another move on the same kid stops this one.
  runTo(k: Kid, to: XY, speed: number, end: 'ready' | 'stand' | 'none' = 'ready') {
    const tok = (k.userData.tok = (k.userData.tok ?? 0) + 1);
    const from = { x: k.fx, y: k.fy };
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    if (d < 0.3) return Promise.resolve();
    k.face(to.x - from.x, to.y - from.y);
    const pose = speed > 7 ? 'run' : 'walk';
    return clock.tween(d / speed, (t) => {
      if (k.userData.tok !== tok) return false;
      k.setField(lerp(from.x, to.x, t), lerp(from.y, to.y, t));
      k.pose(pose, t * d * (pose === 'run' ? 0.9 : 1.4));
      if (t >= 1 && end !== 'none') k.pose(end);
    });
  }

  // Run along the bases, from one base index to another (4 is home).
  async runBases(k: Kid, from: number, to: number, speed: number) {
    for (let b = from + 1; b <= to; b++) {
      const p = BASES[b % 4];
      await this.runTo(k, p, speed, b === to ? 'stand' : 'none');
    }
  }

  // A thrown ball, in a gentle arc.
  throwBall(from: XYH, to: XYH, speed: number, thrower?: Kid) {
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const dur = Math.max(0.2, d / speed);
    if (thrower) {
      thrower.face(to.x - from.x, to.y - from.y);
      void clock.tween(0.35, (k) => thrower.pose('throw', 0.5 + k * 0.5));
    }
    return clock.tween(dur, (k) => {
      this.setBall({ x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), h: lerp(from.h, to.h, k) + d * 0.06 * 4 * k * (1 - k) });
    });
  }

  // Fly the batted ball for `until` seconds (or until it stops).
  flyBall(b: BattedBall, until: number, h0 = 2.4) {
    return clock.tween(until, (k) => this.setBall(ballAt(b, k * until, h0)));
  }

  // Camera: a TV view from behind home plate that follows the ball.
  tvCam(dt: number, follow = true) {
    const want = follow && this.ball.visible ? this.ball.position.clone() : new THREE.Vector3(0, 4, -70);
    want.y = Math.max(want.y, 3);
    const k = 1 - Math.exp(-dt * 4);
    this.camTarget.lerp(want, k);
    const zoomOut = clamp(-this.camTarget.z / 140, 0, 1);
    // Stay inside the backstop netting so it doesn't fog up the view.
    const pos = new THREE.Vector3(this.camTarget.x * 0.25, 11 + zoomOut * 16, 20 + zoomOut * 3);
    this.camera.position.lerp(pos, k);
    this.camera.lookAt(this.camTarget);
    this.sizeBall();
  }

  // A real baseball is a speck from far away, so the ball grows with distance to stay easy to follow.
  sizeBall() {
    const d = this.camera.position.distanceTo(this.ball.position);
    this.ball.scale.setScalar(clamp(d / 40, 1, 3.5));
  }

  snapTv() {
    this.camTarget.set(0, 4, -70);
    this.camera.position.set(0, 11, 20);
    this.camera.lookAt(this.camTarget);
  }

  // Bright bursts in the sky for home runs.
  fireworks(n = 4) {
    const colors = [0xffd23f, 0xff5d8f, 0x4dabf7, 0x69db7c, 0xb197fc];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true });
      const dirs: THREE.Vector3[] = [];
      for (let j = 0; j < 26; j++) {
        const s = new THREE.Mesh(geo.sphere(1.6, 6), m);
        g.add(s);
        dirs.push(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(25, 40)));
      }
      g.position.copy(P(rnd(-90, 90), rnd(160, 230), rnd(70, 120)));
      g.visible = false;
      this.scene.add(g);
      void clock.wait(i * 0.35).then(() =>
        clock.tween(1.6, (k) => {
          g.children.forEach((c, j) => c.position.copy(dirs[j]).multiplyScalar(Math.sqrt(k)).setY(dirs[j].y * Math.sqrt(k) - 20 * k * k));
          g.visible = true;
          m.opacity = 1 - k * k;
          if (k >= 1) this.scene.remove(g);
        }),
      );
    }
  }

  clearExtras() {
    for (const e of this.extras) this.scene.remove(e);
    this.extras = [];
  }
}
