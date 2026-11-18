// A 3D cartoon kid in a baseball uniform, posed by rotating simple joints.
// The model faces +z, and its left side is +x. It is built 4 units tall and scaled to the level's height in feet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, geo, toon, textTexture, blobShadow } from './toon';

// Merge the meshes hanging directly off one joint into one mesh per material. A kid has dozens of parts,
// and a field has twenty kids, so this keeps the draw calls down on an iPad.
function mergeJoint(j: THREE.Group, keep: Set<THREE.Object3D>) {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const used: THREE.Object3D[] = [];
  const add = (m: THREE.Mesh, matrix: THREE.Matrix4) => {
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g = g.applyMatrix4(matrix);
    const mat = m.material as THREE.Material;
    byMat.set(mat, [...(byMat.get(mat) ?? []), g]);
  };
  for (const c of j.children) {
    const m = c as THREE.Mesh;
    if (!m.isMesh || keep.has(m) || (m.material as THREE.MeshBasicMaterial).map) continue;
    m.updateMatrix();
    add(m, m.matrix);
    for (const o of m.children) {
      const om = o as THREE.Mesh;
      if (!om.isMesh) continue;
      om.updateMatrix();
      add(om, m.matrix.clone().multiply(om.matrix));
    }
    used.push(m);
  }
  if (used.length < 2) return;
  for (const u of used) j.remove(u);
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (merged) j.add(new THREE.Mesh(merged, mat));
  }
}

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
}
export interface Kit {
  bat?: number;
  glove?: number;
  cleats?: number;
}

export type PoseName = 'stand' | 'walk' | 'run' | 'ready' | 'bat' | 'swing' | 'bunt' | 'throw' | 'dive' | 'cheer' | 'sit' | 'crouch' | 'sad';

const shellCache = new Map<string, THREE.BufferGeometry>();
// Part of a sphere around the back and sides of the head, for hair under the cap.
function shell(r: number, t0: number, t1: number) {
  const k = `${r}:${t0}:${t1}`;
  let g = shellCache.get(k);
  if (!g) {
    g = new THREE.SphereGeometry(r, 18, 8, Math.PI - 0.5, Math.PI + 1, t0, t1 - t0);
    shellCache.set(k, g);
  }
  return g;
}
let domeGeo: THREE.BufferGeometry | null = null;
let smileGeo: THREE.BufferGeometry | null = null;
const numberMats = new Map<string, THREE.MeshBasicMaterial>();

function grp(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

export class Kid extends THREE.Group {
  readonly body = new THREE.Group();
  readonly hips: THREE.Group;
  readonly torso: THREE.Group;
  readonly head: THREE.Group;
  readonly shL: THREE.Group;
  readonly shR: THREE.Group;
  readonly elL: THREE.Group;
  readonly elR: THREE.Group;
  readonly hipL: THREE.Group;
  readonly hipR: THREE.Group;
  readonly knL: THREE.Group;
  readonly knR: THREE.Group;
  readonly handR: THREE.Group;
  readonly handL: THREE.Group;
  readonly bat: THREE.Group;
  readonly glove: THREE.Mesh;
  readonly sc: number;
  private joints: THREE.Group[];

  constructor(
    public look: Look,
    public uni: Uniform,
    kit: Kit = {},
    public heightFt = 4,
  ) {
    super();
    const s = (this.sc = heightFt / 4);
    this.body.scale.setScalar(s);
    this.add(this.body);
    this.add(blobShadow(0.85 * s));

    this.hips = grp(this.body, 0, 1.65, 0);
    const pants = part(geo.capsule(0.36, 0.2), uni.pants, 0.04);
    pants.scale.set(1.15, 1, 0.85);
    this.hips.add(pants);
    const legs: THREE.Group[] = [];
    const knees: THREE.Group[] = [];
    for (const side of [1, -1]) {
      const hip = grp(this.hips, side * 0.2, -0.05, 0);
      const thigh = part(geo.capsule(0.16, 0.42), uni.pants, 0.04);
      thigh.position.y = -0.35;
      hip.add(thigh);
      const knee = grp(hip, 0, -0.78, 0);
      const shin = part(geo.capsule(0.13, 0.42), uni.socks, 0.04);
      shin.position.y = -0.3;
      knee.add(shin);
      const shoe = part(geo.box(0.27, 0.17, 0.46), kit.cleats ?? 0x2b2b35, 0.03);
      shoe.position.set(0, -0.72, 0.09);
      knee.add(shoe);
      legs.push(hip);
      knees.push(knee);
    }
    [this.hipL, this.hipR] = legs;
    [this.knL, this.knR] = knees;

    this.torso = grp(this.hips, 0, 0.1, 0);
    const jersey = part(geo.capsule(0.42, 0.55), uni.jersey, 0.04);
    jersey.position.y = 0.5;
    jersey.scale.set(1.08, 1, 0.8);
    this.torso.add(jersey);
    const belt = new THREE.Mesh(geo.cyl(0.43, 0.43, 0.1, 16), toon(0x24242c));
    belt.scale.set(1.12, 1, 0.84);
    belt.position.y = 0.02;
    this.torso.add(belt);
    // The jersey number, on the back and smaller on the front.
    const key = `${look.number}:${uni.jersey}`;
    let nm = numberMats.get(key);
    if (!nm) {
      nm = new THREE.MeshBasicMaterial({
        map: textTexture(String(look.number), { w: 128, h: 128, stroke: '#1d1b2f', size: 92 }),
        transparent: true,
      });
      numberMats.set(key, nm);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), nm);
    back.position.set(0, 0.62, -0.345);
    back.rotation.y = Math.PI;
    this.torso.add(back);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), nm);
    front.position.set(-0.2, 0.75, 0.345);
    this.torso.add(front);

    const arms: THREE.Group[] = [];
    const elbows: THREE.Group[] = [];
    const hands: THREE.Group[] = [];
    for (const side of [1, -1]) {
      const sh = grp(this.torso, side * 0.52, 0.98, 0);
      const upper = part(geo.capsule(0.13, 0.3), uni.jersey, 0.04);
      upper.position.y = -0.22;
      sh.add(upper);
      const el = grp(sh, 0, -0.5, 0);
      const fore = part(geo.capsule(0.1, 0.28), look.skin, 0.035);
      fore.position.y = -0.2;
      el.add(fore);
      const hand = grp(el, 0, -0.46, 0);
      const fist = part(geo.sphere(0.12, 10), look.skin, 0.03);
      hand.add(fist);
      arms.push(sh);
      elbows.push(el);
      hands.push(hand);
    }
    [this.shL, this.shR] = arms;
    [this.elL, this.elR] = elbows;
    [this.handL, this.handR] = hands;

    this.glove = part(geo.sphere(0.27, 12), kit.glove ?? 0x9a5a2b, 0.035);
    this.glove.scale.set(0.95, 1.05, 0.55);
    this.glove.position.set(0.04, -0.05, 0.06);
    this.handL.add(this.glove);

    this.bat = new THREE.Group();
    const barrel = part(geo.cyl(0.075, 0.035, 1.75, 10), kit.bat ?? 0xd9a066, 0.025);
    barrel.position.y = 0.72;
    this.bat.add(barrel);
    const knob = new THREE.Mesh(geo.sphere(0.06, 8), toon(0x3b2614));
    knob.position.y = -0.14;
    this.bat.add(knob);
    this.bat.visible = false;
    this.handR.add(this.bat);

    this.head = grp(this.torso, 0, 1.2, 0);
    this.buildHead(look, uni);

    this.joints = [this.hips, this.torso, this.head, this.shL, this.shR, this.elL, this.elR, this.hipL, this.hipR, this.knL, this.knR, this.handR, this.handL];
    const keep = new Set<THREE.Object3D>([this.glove]);
    for (const j of this.joints) mergeJoint(j, keep);
    this.pose('stand');
  }

  private buildHead(look: Look, uni: Uniform) {
    const h = this.head;
    const skull = part(geo.sphere(0.52, 18), look.skin, 0.045);
    skull.position.y = 0.45;
    h.add(skull);
    for (const side of [1, -1]) {
      const ear = part(geo.sphere(0.12, 8), look.skin, 0.03);
      ear.position.set(side * 0.52, 0.42, 0);
      h.add(ear);
      const white = new THREE.Mesh(geo.sphere(0.11, 10), toon(0xffffff));
      white.scale.z = 0.5;
      white.position.set(side * 0.18, 0.47, 0.46);
      h.add(white);
      const iris = new THREE.Mesh(geo.sphere(0.07, 10), toon(look.eyes));
      iris.scale.z = 0.5;
      iris.position.set(side * 0.18, 0.46, 0.505);
      h.add(iris);
      const pupil = new THREE.Mesh(geo.sphere(0.035, 8), toon(0x111111));
      pupil.position.set(side * 0.18, 0.46, 0.53);
      h.add(pupil);
      const cheek = new THREE.Mesh(geo.sphere(0.07, 8), toon(0xff9aa2));
      cheek.scale.z = 0.4;
      cheek.position.set(side * 0.3, 0.3, 0.44);
      h.add(cheek);
    }
    const nose = new THREE.Mesh(geo.sphere(0.06, 8), toon(look.skin));
    nose.position.set(0, 0.36, 0.52);
    h.add(nose);
    if (!smileGeo) smileGeo = new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI);
    const smile = new THREE.Mesh(smileGeo, toon(0x7a2a2a));
    smile.position.set(0, 0.26, 0.48);
    smile.rotation.z = Math.PI;
    h.add(smile);

    // Hair shows below the cap at the back and sides.
    const hair = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, toon(look.hair));
      (m.material as THREE.Material).side = THREE.DoubleSide;
      m.position.y = 0.45;
      h.add(m);
      return m;
    };
    if (look.hairStyle === 'buzz') hair(shell(0.53, 0.9, 1.75));
    else hair(shell(0.55, 0.85, 1.95));
    if (look.hairStyle === 'long') {
      const l = part(geo.box(0.9, 0.75, 0.2), look.hair, 0.03);
      l.position.set(0, 0.05, -0.38);
      h.add(l);
    } else if (look.hairStyle === 'ponytail') {
      const tail = part(geo.capsule(0.14, 0.4), look.hair, 0.03);
      tail.position.set(0, 0.3, -0.66);
      tail.rotation.x = 0.5;
      h.add(tail);
      const tie = new THREE.Mesh(geo.sphere(0.1, 8), toon(uni.jersey));
      tie.position.set(0, 0.5, -0.56);
      h.add(tie);
    } else if (look.hairStyle === 'mullet') {
      // Business in the front, party in the back: short on top, long down the back of the neck.
      const back = part(geo.box(0.78, 0.7, 0.22), look.hair, 0.03);
      back.position.set(0, 0.02, -0.4);
      back.rotation.x = -0.12;
      h.add(back);
      for (const side of [1, -1]) {
        const flip = part(geo.capsule(0.11, 0.22), look.hair, 0.03);
        flip.position.set(side * 0.3, -0.28, -0.46);
        flip.rotation.set(0.5, 0, side * 0.5);
        h.add(flip);
      }
    } else if (look.hairStyle === 'curly') {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI - 1.5 + (i * 3) / 8;
        for (const y of [0.15, 0.4]) {
          const c = new THREE.Mesh(geo.sphere(0.13, 8), toon(look.hair));
          c.position.set(Math.sin(a) * 0.52, y, Math.cos(a) * 0.52);
          h.add(c);
        }
      }
    }

    if (!domeGeo) domeGeo = new THREE.SphereGeometry(0.56, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = part(domeGeo, uni.cap, 0.035);
    cap.position.y = 0.5;
    cap.rotation.x = -0.08;
    h.add(cap);
    const brim = part(geo.cyl(0.36, 0.36, 0.05, 16), uni.cap, 0.03);
    brim.scale.set(1, 1, 0.85);
    brim.position.set(0, 0.56, 0.52);
    brim.rotation.x = 0.12;
    h.add(brim);
    const button = new THREE.Mesh(geo.sphere(0.06, 8), toon(uni.cap));
    button.position.y = 1.06;
    h.add(button);
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

  // Set a pose. `t` is a phase in radians for walk and run, and 0 to 1 for one-shot moves.
  pose(name: PoseName, t = 0) {
    for (const j of this.joints) j.rotation.set(0, 0, 0);
    this.hips.position.y = 1.65;
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.bat.visible = false;
    const { shL, shR, elL, elR, hipL, hipR, knL, knR, torso, head } = this;
    shL.rotation.z = 0.12;
    shR.rotation.z = -0.12;
    elL.rotation.x = -0.15;
    elR.rotation.x = -0.15;
    switch (name) {
      case 'stand':
        break;
      case 'walk':
      case 'run': {
        const amp = name === 'run' ? 0.9 : 0.45;
        const s = Math.sin(t);
        hipL.rotation.x = -s * amp;
        hipR.rotation.x = s * amp;
        knL.rotation.x = 0.25 + Math.max(0, s) * amp * 1.2;
        knR.rotation.x = 0.25 + Math.max(0, -s) * amp * 1.2;
        shL.rotation.x = s * amp;
        shR.rotation.x = -s * amp;
        elL.rotation.x = elR.rotation.x = name === 'run' ? -1.3 : -0.4;
        torso.rotation.x = name === 'run' ? 0.2 : 0.05;
        this.body.position.y = Math.abs(Math.cos(t)) * 0.12 * this.sc * amp;
        break;
      }
      case 'ready':
      case 'crouch': {
        const deep = name === 'crouch' ? 1.6 : 1;
        this.hips.position.y = 1.65 - 0.32 * deep;
        hipL.rotation.x = hipR.rotation.x = -0.55 * deep;
        knL.rotation.x = knR.rotation.x = 0.95 * deep;
        hipL.rotation.z = 0.22;
        hipR.rotation.z = -0.22;
        torso.rotation.x = 0.45;
        head.rotation.x = -0.4;
        shL.rotation.x = shR.rotation.x = -0.9;
        elL.rotation.x = elR.rotation.x = -0.4;
        break;
      }
      case 'bat':
      case 'swing': {
        // A right-handed batter, hands up by the back shoulder, then turning through the ball.
        const k = name === 'swing' ? ease(Math.min(1, t)) : 0;
        this.bat.visible = true;
        hipL.rotation.z = 0.25;
        hipR.rotation.z = -0.25;
        knL.rotation.x = knR.rotation.x = 0.25;
        this.hips.position.y = 1.6;
        torso.rotation.y = lerp(-0.5, 1.4, k);
        head.rotation.y = lerp(1.0, -0.3, k);
        shR.rotation.x = lerp(-1.0, -1.6, k);
        shR.rotation.z = lerp(-0.9, 0.2, k);
        elR.rotation.x = lerp(-1.8, -0.3, k);
        shL.rotation.x = lerp(-1.3, -1.6, k);
        shL.rotation.z = lerp(-0.6, 0.3, k);
        elL.rotation.x = lerp(-1.2, -0.2, k);
        this.handR.rotation.x = lerp(-1.4, -1.5, k);
        this.handR.rotation.z = lerp(0.4, 1.8, k);
        break;
      }
      case 'bunt':
        this.bat.visible = true;
        torso.rotation.y = 0.9;
        this.hips.position.y = 1.5;
        knL.rotation.x = knR.rotation.x = 0.5;
        hipL.rotation.x = hipR.rotation.x = -0.3;
        shR.rotation.x = shL.rotation.x = -1.4;
        elR.rotation.x = elL.rotation.x = -0.3;
        this.handR.rotation.z = Math.PI / 2;
        break;
      case 'throw': {
        // Arm back and up, then over the top and through.
        const k = Math.min(1, t);
        const a = k < 0.5 ? lerp(0, 2.4, ease(k * 2)) : lerp(2.4, 5.3, ease((k - 0.5) * 2));
        shR.rotation.x = a;
        elR.rotation.x = -0.7;
        shL.rotation.x = lerp(-1.4, 0.4, k);
        torso.rotation.y = lerp(-0.6, 0.5, k);
        torso.rotation.x = lerp(0, 0.35, k);
        hipL.rotation.x = lerp(0, -0.6, k);
        knL.rotation.x = lerp(0, 0.4, k);
        hipR.rotation.x = lerp(0, 0.4, k);
        break;
      }
      case 'dive': {
        const k = ease(Math.min(1, t));
        this.body.rotation.x = 1.35 * k;
        this.body.position.y = -0.2 * k * this.sc;
        this.body.position.z = 1.2 * k * this.sc;
        shL.rotation.x = shR.rotation.x = lerp(0, -2.9, k);
        elL.rotation.x = elR.rotation.x = 0;
        hipL.rotation.x = 0.2 * k;
        hipR.rotation.x = 0.35 * k;
        knL.rotation.x = 0.6 * k;
        head.rotation.x = -0.9 * k;
        break;
      }
      case 'cheer': {
        const b = Math.abs(Math.sin(t * 6));
        shL.rotation.x = shR.rotation.x = -2.8;
        shL.rotation.z = 0.35 + b * 0.2;
        shR.rotation.z = -0.35 - b * 0.2;
        this.body.position.y = b * 0.4 * this.sc;
        break;
      }
      case 'sad':
        head.rotation.x = 0.45;
        torso.rotation.x = 0.15;
        shL.rotation.z = 0.05;
        shR.rotation.z = -0.05;
        break;
      case 'sit':
        this.hips.position.y = 1.0;
        hipL.rotation.x = hipR.rotation.x = -1.5;
        knL.rotation.x = knR.rotation.x = 1.5;
        shL.rotation.x = shR.rotation.x = -0.6;
        elL.rotation.x = elR.rotation.x = -0.6;
        break;
    }
  }
}
