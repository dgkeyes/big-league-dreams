// Riding to Dick's Sporting Goods with Dad: a short drive through a Portland neighborhood.
import * as THREE from 'three';
import { register, go, type Screen } from '../app';
import { clock } from '../clock';
import { getProfile, levelOf, STORE, HIGH } from '../data';
import { makeKid, type Look } from '../gfx/kid';
import { addLights, skyDome, tree, part, geo, flat, toon, cloud, textTexture } from '../gfx/toon';
import { div, h, btn, banner } from '../ui';
import { sfx } from '../sfx';

export const DAD_LOOK: Look = { gender: 'boy', skin: 0xf1c27d, hair: 0x4a2e17, hairStyle: 'short', eyes: 0x4a2e17, number: 1 };
export const DAD_CLOTHES = { jersey: 0x2f9e44, cap: 0x343a40, pants: 0x3c5a8a, socks: 0x343a40, casual: true };

export function car(color = 0x1c7ed6) {
  const g = new THREE.Group();
  const body = part(geo.box(6.4, 2.2, 13), color, 0.08);
  body.position.y = 2.2;
  g.add(body);
  // A roof on four posts with see-through windows, so you can see Dad and yourself inside.
  const roof = part(geo.box(5.8, 0.4, 7), color, 0.08);
  roof.position.set(0, 5.8, -0.8);
  g.add(roof);
  for (const [x, z] of [
    [-2.7, 2.5],
    [2.7, 2.5],
    [-2.7, -4.1],
    [2.7, -4.1],
  ]) {
    const post = part(geo.box(0.3, 2.6, 0.3), color, 0.04);
    post.position.set(x, 4.5, z);
    g.add(post);
  }
  const glass = new THREE.Mesh(geo.box(5.5, 2.4, 6.6), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, depthWrite: false }));
  glass.position.set(0, 4.5, -0.8);
  g.add(glass);
  for (const [x, z] of [
    [-3.1, 4],
    [3.1, 4],
    [-3.1, -4.2],
    [3.1, -4.2],
  ]) {
    const w = part(geo.cyl(1.2, 1.2, 0.9, 14), 0x212529, 0.05);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 1.2, z);
    g.add(w);
  }
  for (const x of [-2.2, 2.2]) {
    const light = new THREE.Mesh(geo.box(1.1, 0.6, 0.2), flat(0xfff3bf));
    light.position.set(x, 2.6, 6.5);
    g.add(light);
    const tail = new THREE.Mesh(geo.box(1.1, 0.6, 0.2), flat(0xff6b6b));
    tail.position.set(x, 2.6, -6.5);
    g.add(tail);
  }
  return g;
}

function house(color: number) {
  const g = new THREE.Group();
  const box = part(geo.box(22, 14, 18), color, 0.1);
  box.position.y = 7;
  g.add(box);
  const roof = part(geo.cone(16, 9, 4), 0x6c3a2a, 0.1);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 18.5;
  g.add(roof);
  const door = new THREE.Mesh(geo.box(3.4, 6.5, 0.4), toon(0x5c3a1e));
  door.position.set(0, 3.25, 9.1);
  g.add(door);
  return g;
}

// The storefront at the end of the drive.
export function storefront() {
  const g = new THREE.Group();
  const wall = part(geo.box(120, 34, 50), 0xe9ecef, 0.15);
  wall.position.y = 17;
  g.add(wall);
  const stripe = part(geo.box(121, 6, 51), 0x1b6b3a, 0);
  stripe.position.y = 31;
  g.add(stripe);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 13),
    new THREE.MeshBasicMaterial({ map: textTexture(STORE.toUpperCase(), { w: 1024, h: 160, color: '#ffffff', bg: '#0d5c2e', size: 100 }) }),
  );
  sign.position.set(0, 24, 25.2);
  g.add(sign);
  const doors = new THREE.Mesh(geo.box(18, 11, 0.5), toon(0x9ad7ff));
  doors.position.set(0, 5.5, 25.1);
  g.add(doors);
  return g;
}

export function driveScreen(): Screen {
  const prof = getProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfeaff);
  scene.fog = new THREE.Fog(0xcfeaff, 300, 900);
  scene.add(skyDome());
  addLights(scene);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), flat(0x69b85a));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const ROAD = 1600;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(26, ROAD), flat(0x495057));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, -ROAD / 2 + 50);
  scene.add(road);
  for (let z = 40; z > -ROAD + 60; z -= 20) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 8), flat(0xffd43b));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.05, z);
    scene.add(dash);
  }
  const colors = [0xffc9c9, 0xa5d8ff, 0xffec99, 0xb2f2bb, 0xd0bfff, 0xffd8a8];
  for (let i = 0; i < 26; i++) {
    for (const side of [-1, 1]) {
      const z = -i * 55 - 20;
      if (z < -1350) continue;
      if ((i + (side > 0 ? 1 : 0)) % 3 === 0) {
        const t = tree(1.3, i % 2 ? 'round' : 'fir');
        t.position.set(side * (22 + (i % 4) * 3), 0, z);
        scene.add(t);
      } else {
        const hs = house(colors[(i * 2 + side + 6) % colors.length]);
        hs.position.set(side * 38, 0, z);
        hs.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        scene.add(hs);
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    const c = cloud(1.3);
    c.position.set(-300 + i * 130, 160 + (i % 2) * 40, -500 - i * 80);
    scene.add(c);
  }
  const shop = storefront();
  shop.position.set(0, 0, -1480);
  scene.add(shop);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(160, 140), flat(0x868e96));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(0, 0.04, -1390);
  scene.add(lot);

  const auto = car();
  scene.add(auto);
  // Dad drives and you ride next to him, until high school: then you drive and Dad rides along.
  const youDrive = prof.level >= HIGH;
  const DRIVER = 1.4;
  const PASSENGER = -1.4;
  const dad = makeKid(DAD_LOOK, DAD_CLOTHES, {}, 5.9);
  dad.position.set(youDrive ? PASSENGER : DRIVER, 1.5, -0.8);
  dad.pose('sit');
  dad.body.scale.multiplyScalar(0.62);
  auto.add(dad);
  const myFt = youDrive ? levelOf(prof).ft : 4.1;
  const me = makeKid(prof.look, { jersey: 0xff922b, cap: 0x1971c2, pants: 0x3c5a8a, socks: 0xe53e3e, casual: true }, {}, myFt);
  me.position.set(youDrive ? DRIVER : PASSENGER, youDrive ? 1.5 : 1.8, -0.8);
  me.pose('sit');
  me.body.scale.multiplyScalar(youDrive ? 0.62 : 0.75);
  auto.add(me);
  auto.rotation.y = Math.PI;

  const camera = new THREE.PerspectiveCamera(55, 1.44, 0.5, 3000);
  const ui = div('screen drive');
  const msg = div('msg');
  const honk = btn('📯 HONK!', () => {
    sfx.honk();
    banner(msg, 'BEEP BEEP!', '', '#ffffff', 700);
  }, 'orange honk');
  // Hold GAS to go, and steer with the arrows to stay on the road.
  const held = { gas: false, left: false, right: false };
  const hold = (label: string, key: keyof typeof held, cls: string) => {
    const b = h('button', `pad ${cls}`, label);
    const set = (on: boolean) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      held[key] = on;
      b.classList.toggle('down', on);
    };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
    return b;
  };
  ui.append(
    msg,
    div('top-right', btn('SKIP ▶▶', () => go('store'), 'gray small')),
    youDrive
      ? div('drive-ctl steer', hold('◀', 'left', 'mid blue'), honk, hold('GAS', 'gas', 'mid green'), hold('▶', 'right', 'mid blue'))
      : div('drive-ctl', honk),
  );

  let z = 0;
  let x = 5;
  let speed = 0;
  let warned = 0;
  let arrived = false;
  void (async () => {
    banner(msg, `Off to ${STORE}!`, youDrive ? 'You’re driving! Hold GAS and steer' : 'Dad is driving', '#ffd23f', 2200);
    await clock.until(() => arrived);
    banner(msg, 'WE’RE HERE!', '', '#69db7c', 1500);
    await clock.wait(1.8);
    go('store');
  })();

  let t = 0;
  return {
    scene,
    camera,
    ui,
    update(dt) {
      t += dt;
      const stopAt = -1380;
      // Speed up, cruise, then slow down into the parking lot.
      const left = z - stopAt;
      if (youDrive) {
        // Your foot on the gas, but the car still slows into the parking lot by itself.
        speed = held.gas ? Math.min(speed + dt * 35, 80) : Math.max(0, speed - dt * 45);
        speed = Math.min(speed, Math.max(4, left * 0.9));
        if (speed > 1) x += ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * dt * 14;
        x = Math.max(-10, Math.min(10, x));
        if (Math.abs(x) > 9.5 && t - warned > 3) {
          warned = t;
          banner(msg, 'STAY ON THE ROAD!', '“Careful!” says Dad', '#ff8787', 1200);
        }
        auto.rotation.y = Math.PI + ((held.left ? 1 : 0) - (held.right ? 1 : 0)) * 0.08;
      } else {
        speed = Math.min(speed + dt * 30, 95, Math.max(4, left * 0.9));
        x = Math.sin(t * 0.7) * 0.3 + 5;
      }
      if (left > 0.5) z -= speed * dt;
      else arrived = true;
      auto.position.set(x, Math.abs(Math.sin(t * 9)) * 0.05, z);
      camera.position.set(auto.position.x + 7, 14, z + 20);
      camera.lookAt(auto.position.x, 3, z - 10);
    },
  };
}

register('drive', driveScreen);
