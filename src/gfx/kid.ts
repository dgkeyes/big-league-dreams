// A ballplayer built on the characters from Leila's game (Sabin Elementary): rigged Quaternius bodies with
// clothes painted on, real hair, and animation clips. This wrapper keeps the baseball code's simple
// interface (pose, face, setField) and adds what baseball needs: a uniform with a real jersey number,
// a cap, a glove, a bat, and batting, bunting, and diving poses made with two-bone IK.
// The model faces +z, and its left side is +x. World units are feet; the kid is heightFt tall.
import * as THREE from 'three';
import { Character, type AnimName } from '../characters/character';
import { getAssets } from '../characters/assets';
import { BODY_LANDMARKS } from '../characters/lookShader';
import type { Look as SabinLook } from '../characters/types';
import { textTexture } from './toon';

export type HairStyle = 'short' | 'buzz' | 'curly' | 'ponytail' | 'long' | 'mullet';
export interface Look {
  gender: 'boy' | 'girl';
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  eyes: number;
  number: number;
}
export interface Uniform {
  jersey: number;
  cap: number;
  pants: number;
  socks: number;
  // Street clothes (Dad, or you on the way to the store) instead of a baseball uniform.
  casual?: boolean;
}
export interface Kit {
  bat?: number;
  glove?: number;
  cleats?: number;
}

export type PoseName = 'stand' | 'walk' | 'run' | 'ready' | 'bat' | 'swing' | 'bunt' | 'throw' | 'dive' | 'cheer' | 'sit' | 'crouch' | 'sad';

const HAIR_IDS: Record<HairStyle, string> = {
  short: 'parted',
  buzz: 'short',
  curly: 'afro',
  ponytail: 'ponytail',
  long: 'long',
  mullet: 'mullet',
};

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _x = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// Rotate a bone in world space so the direction to its child joint points along `dir` (world).
function aim(bone: THREE.Bone, child: THREE.Bone, dir: THREE.Vector3) {
  const p0 = bone.getWorldPosition(_v);
  const cur = child.getWorldPosition(_w).sub(p0).normalize();
  _q.setFromUnitVectors(cur, _x.copy(dir).normalize());
  bone.getWorldQuaternion(_qw).premultiply(_q);
  bone.parent!.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qw));
  bone.updateMatrixWorld(true);
}

// Two-bone IK: bend shoulder and elbow so the wrist reaches `target`, with the elbow toward `pole` (all world).
function reach(upper: THREE.Bone, lower: THREE.Bone, hand: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  const s = upper.getWorldPosition(new THREE.Vector3());
  const a = lower.getWorldPosition(new THREE.Vector3()).distanceTo(s);
  const b = hand.getWorldPosition(new THREE.Vector3()).distanceTo(lower.getWorldPosition(new THREE.Vector3()));
  const toT = target.clone().sub(s);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = toT.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const bend = pole.clone().sub(s);
  bend.sub(dir.clone().multiplyScalar(bend.dot(dir))).normalize();
  const elbow = s.clone().add(dir.clone().multiplyScalar(a * cosA)).add(bend.multiplyScalar(a * sinA));
  aim(upper, lower, elbow.clone().sub(s));
  aim(lower, hand, target.clone().sub(lower.getWorldPosition(new THREE.Vector3())));
}

// Every kid on screen, so the main loop can animate them.
const live = new Set<Kid>();

export class Kid extends THREE.Group {
  // Scales the character (meters) to the kid's height in feet. Drive scales it down to fit in the car.
  readonly body = new THREE.Group();
  readonly char: Character;
  readonly glove: THREE.Object3D;
  readonly bat: THREE.Object3D;
  readonly sc: number;
  // Turns the head left and right (radians), for idle screens.
  lookYaw = 0;
  // Hide the glove for good (Dad at the store).
  gloveOn = true;
  private state: PoseName = 'stand';
  private k = 0;
  private last = new THREE.Vector3();
  private speed = 0;
  // Root-local character height in meters.
  private H: number;

  constructor(
    public look: Look,
    public uni: Uniform,
    kit: Kit = {},
    public heightFt = 4,
  ) {
    super();
    const adult = heightFt > 5.2;
    const body = look.gender === 'girl' ? 'f' : 'm';
    this.char = new Character(
      { body, skin: hex(look.skin), eyes: hex(look.eyes), freckles: false, glasses: false, height: 1, build: adult ? 1.04 : 1 },
      sabinLook(look, uni, kit),
      !adult,
    );
    const asset = getAssets().bodies[body];
    this.H = asset.height * this.char.scale;
    this.sc = heightFt / this.H;
    this.body.scale.setScalar(this.sc);
    this.body.add(this.char.root);
    this.add(this.body);
    if (!uni.casual) this.addNumbers(look.number, body);

    // A glove on the left hand and a bat for the right, placed on the hands each frame.
    const gMat = new THREE.MeshStandardMaterial({ color: kit.glove ?? 0x9a5a2b, roughness: 0.75 });
    this.glove = new THREE.Mesh(new THREE.SphereGeometry(0.075 * heightFt, 14, 10), gMat);
    this.glove.scale.set(0.8, 1.05, 0.45);
    this.glove.visible = !uni.casual;
    this.add(this.glove);
    this.bat = new THREE.Group();
    const len = heightFt * 0.58;
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 * heightFt * 0.55, 0.012 * heightFt, len, 12),
      new THREE.MeshStandardMaterial({ color: kit.bat ?? 0xd9a066, roughness: 0.55 }),
    );
    barrel.position.y = len / 2 - 0.04 * heightFt;
    this.bat.add(barrel);
    this.bat.visible = false;
    this.add(this.bat);
    live.add(this);
    this.pose('stand');
  }

  // The jersey number on the back, and smaller on the front, in the body's rest space so it follows the torso.
  private addNumbers(n: number, body: 'f' | 'm') {
    const L = BODY_LANDMARKS[body];
    const mat = new THREE.MeshBasicMaterial({ map: textTexture(String(n), { w: 128, h: 128, color: '#ffffff', stroke: '#1d1b2f', size: 96 }), transparent: true, depthWrite: false, toneMapped: false });
    // Measured from the smoothed bodies: the upper back leans out, so the back number tilts with it.
    const m = body === 'm';
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), mat);
    back.position.set(0, 1.24, m ? -0.165 : -0.138);
    back.rotation.set(0.32, Math.PI, 0);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), mat);
    front.position.set(0.07, 1.29, m ? 0.112 : 0.108);
    void L;
    for (const m of [back, front]) {
      m.renderOrder = 2;
      this.char.attach.get('spine_03')!.add(m);
    }
  }

  // Face a direction on the field (x toward right field, y toward center field).
  face(dx: number, dy: number) {
    if (Math.abs(dx) + Math.abs(dy) < 1e-4) return;
    this.rotation.y = Math.atan2(dx, -dy);
  }

  setField(x: number, y: number) {
    this.position.set(x, 0, -y);
  }

  get fx() {
    return this.position.x;
  }
  get fy() {
    return -this.position.z;
  }

  // Pick a pose. `t` is 0 to 1 through one-shot moves (swing, throw, dive); walking and running ignore it.
  pose(name: PoseName, t = 0) {
    this.state = name;
    this.k = t;
  }

  private animate(dt: number) {
    const c = this.char;
    const st = this.state;
    const loop = (n: AnimName, ts = 1) => c.fadeTo(n, 0.15, ts);
    c.armsUp = 0;
    switch (st) {
      case 'walk':
      case 'run': {
        // Match the legs to how fast the kid is really moving.
        const mps = this.speed / this.sc;
        if (st === 'run') loop('run', THREE.MathUtils.clamp(mps / (3.3 * c.scale), 0.7, 2.2));
        else loop('walk', THREE.MathUtils.clamp(mps / (1.45 * c.scale), 0.6, 1.8));
        break;
      }
      case 'crouch':
        loop('crouch');
        break;
      case 'throw':
        // In the clip the arm is cocked back at about 12% of the way through and released by 16%.
        c.holdAt('throw', this.k < 0.5 ? this.k * 0.24 : 0.12 + (this.k - 0.5) * 0.36);
        break;
      case 'sit':
        loop('sit');
        break;
      case 'cheer':
        loop('dance');
        break;
      case 'sad':
        loop('no');
        break;
      case 'dive':
        loop('idle');
        c.armsUp = 1;
        break;
      default:
        loop('idle');
    }
    c.update(dt);
  }

  private bones(...names: string[]) {
    return names.map((n) => this.char.bones.get(n)!);
  }

  // A point in the character's own frame (meters, x left, y up, z forward) to world space.
  private pt(x: number, y: number, z: number) {
    return this.char.root.localToWorld(new THREE.Vector3(x * this.H, y * this.H, z * this.H));
  }
  private dir(x: number, y: number, z: number) {
    return new THREE.Vector3(x, y, z).normalize().transformDirection(this.char.root.matrixWorld);
  }

  // Poses the animation library doesn't have, layered on top of the clip.
  private procedural() {
    const c = this.char;
    const root = c.root;
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    if (this.state === 'dive') {
      const k = ease(Math.min(1, this.k));
      root.rotation.x = 1.4 * k;
      root.position.set(0, 0.12 * this.H * k, 0.45 * this.H * k);
    }
    this.updateMatrixWorld(true);
    const [spine, spine3, head] = this.bones('spine_01', 'spine_03', 'Head');
    if (this.lookYaw && head) {
      head.quaternion.premultiply(_q.setFromAxisAngle(UP, this.lookYaw));
      head.updateMatrixWorld(true);
    }
    const st = this.state;
    if (st === 'bat' || st === 'swing' || st === 'bunt') {
      const k = st === 'swing' ? Math.min(1, this.k) : 0;
      const bunt = st === 'bunt';
      // Turn the shoulders: loaded back, through the ball, then around toward the pitcher (+x).
      const twist = bunt ? 0.9 : k < 0.55 ? lerp(-0.45, 0.6, ease(k / 0.55)) : lerp(0.6, 1.3, ease((k - 0.55) / 0.45));
      spine.quaternion.premultiply(_q.setFromAxisAngle(UP, twist * 0.6));
      spine.updateMatrixWorld(true);
      spine3.quaternion.premultiply(_q.setFromAxisAngle(UP, twist * 0.4));
      spine3.updateMatrixWorld(true);
      const [ul, ll, hl, ur, lr, hr] = this.bones('upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r');
      // Where the hands grip the bat, and which way the bat points, in the character's frame.
      let grip: THREE.Vector3;
      let bd: THREE.Vector3;
      if (bunt) {
        grip = this.pt(0.1, 0.6, 0.2);
        bd = this.dir(0.05, 0.08, 1);
      } else {
        const keys = [
          { k: 0, g: [-0.13, 0.78, 0.04], d: [-0.35, 0.85, -0.4] },
          { k: 0.55, g: [0.02, 0.6, 0.2], d: [0.15, -0.05, 1] },
          { k: 1, g: [0.14, 0.74, 0.04], d: [0.55, 0.35, -0.75] },
        ];
        const i = k < 0.55 ? 0 : 1;
        const u = ease((k - keys[i].k) / (keys[i + 1].k - keys[i].k));
        const g = keys[i].g.map((v, j) => lerp(v, keys[i + 1].g[j], u));
        const d = keys[i].d.map((v, j) => lerp(v, keys[i + 1].d[j], u));
        grip = this.pt(g[0], g[1], g[2]);
        bd = this.dir(d[0], d[1], d[2]);
      }
      const top = grip.clone().add(bd.clone().multiplyScalar((bunt ? 0.2 : 0.045) * this.heightFt));
      reach(ul, ll, hl, grip, this.pt(0.4, 0.2, -0.2));
      reach(ur, lr, hr, top, this.pt(-0.5, 0.2, -0.2));
      this.bat.visible = true;
      this.worldToLocal(this.bat.position.copy(grip));
      this.bat.quaternion.setFromUnitVectors(UP, bd.transformDirection(this.matrixWorld.clone().invert()));
    } else this.bat.visible = false;
    // Batters set the glove down.
    this.glove.visible = !this.uni.casual && !this.bat.visible && this.gloveOn;

    // The glove sits on the left hand.
    if (this.glove.visible) {
      const hl = c.bones.get('hand_l')!;
      this.worldToLocal(hl.getWorldPosition(this.glove.position));
      this.glove.position.y += 0.02 * this.heightFt;
    }
  }

  private inScene() {
    let o: THREE.Object3D | null = this;
    while (o.parent) o = o.parent;
    return (o as THREE.Scene).isScene === true && this.visible;
  }

  update(dt: number) {
    if (!this.inScene()) return;
    const p = this.getWorldPosition(_v);
    if (dt > 0) this.speed = lerp(this.speed, p.distanceTo(this.last) / dt, 0.3);
    this.last.copy(p);
    this.animate(dt);
    this.procedural();
  }

  // Animate every kid in the current screen.
  static tick(dt: number) {
    for (const k of live) k.update(dt);
  }

  // Forget the last screen's kids.
  static clear() {
    live.clear();
  }
}

function sabinLook(look: Look, uni: Uniform, kit: Kit): SabinLook {
  if (uni.casual)
    return {
      hair: HAIR_IDS[look.hairStyle],
      hairColor: hex(look.hair),
      top: { id: 'dad-tee', color: hex(uni.jersey), color2: '#ffffff' },
      bottom: { id: 'jeans', color: hex(uni.pants), color2: '#2a4066' },
      shoes: { id: 'sneakers', color: hex(uni.socks), color2: '#ffffff' },
      hat: { id: 'cap', color: hex(uni.cap), color2: hex(uni.cap) },
      backpack: null,
    };
  return {
    hair: HAIR_IDS[look.hairStyle],
    hairColor: hex(look.hair),
    top: { id: 'bb-jersey', color: hex(uni.jersey), color2: hex(uni.cap) },
    bottom: { id: 'bb-pants', color: hex(uni.pants), color2: '#ffffff' },
    shoes: { id: 'bb-socks', color: hex(uni.socks), color2: hex(kit.cleats ?? 0x2b2b35) },
    hat: { id: 'cap', color: hex(uni.cap), color2: hex(uni.cap) },
    backpack: null,
  };
}
