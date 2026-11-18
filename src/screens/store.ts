// Inside Dick's Sporting Goods. Dad walks you to the baseball section to pick out new gear.
// You can wander off, but go too far and Dad comes looking, and then it's no baseball today.
import * as THREE from 'three';
import { register, go, type Screen } from '../app';
import { clock } from '../clock';
import { getProfile, saveProfile, leagueOf, uniformOf, kitOf, GEAR, STORE, SKILLS, type Gear } from '../data';
import { Kid } from '../gfx/kid';
import { addLights, part, geo, flat, toon, label, P } from '../gfx/toon';
import { Joystick } from '../input';
import { div, h, btn, show, banner, pill } from '../ui';
import { sfx } from '../sfx';
import { DAD_LOOK, DAD_CLOTHES } from './drive';

type Box = { x0: number; x1: number; y0: number; y1: number };
const WALK = 11;
const DAD_WALK = 6.5;
const TOO_FAR = 45;
const SECTION = { x: -30, y: 80 };

const SECTIONS: [string, number, number, number][] = [
  ['SOCCER', 30, 50, 0x2f9e44],
  ['BASKETBALL', 10, 50, 0xf76707],
  ['CAMPING', -10, 50, 0x5c940d],
  ['SHOES', 50, 50, 0x1c7ed6],
  ['FISHING', -30, 50, 0x0b7285],
];

export function storeScreen(): Screen {
  const prof = getProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f3f5);
  addLights(scene, 0xffffff, 0xdee2e6);
  const camera = new THREE.PerspectiveCamera(55, 1.44, 0.3, 1000);

  // Floor, walls, and the checkout counter.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 130), flat(0xdee2e6));
  floor.rotation.x = -Math.PI / 2;
  floor.position.copy(P(0, 50));
  scene.add(floor);
  for (let x = -70; x <= 70; x += 10) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 125), flat(0xced4da));
    line.rotation.x = -Math.PI / 2;
    line.position.copy(P(x, 50, 0.02));
    scene.add(line);
  }
  const walls: [number, number, number, number, number][] = [
    [0, 112, 150, 1, 0x0d5c2e],
    [-75, 50, 1, 130, 0xe9ecef],
    [75, 50, 1, 130, 0xe9ecef],
    [-45, -12, 60, 1, 0xe9ecef],
    [45, -12, 60, 1, 0xe9ecef],
  ];
  for (const [x, y, w, d, c] of walls) {
    const m = part(geo.box(w, 22, d), c, 0);
    m.position.copy(P(x, y, 11));
    scene.add(m);
  }
  const counter = part(geo.box(20, 4, 4), 0x1b6b3a, 0.08);
  counter.position.copy(P(42, 8, 2));
  scene.add(counter);
  const reg = label('CHECKOUT', 3.2, { color: '#ffffff', bg: '#0d5c2e', w: 384, h: 96 });
  reg.position.copy(P(42, 8, 9));
  scene.add(reg);
  const welcome = label(STORE.toUpperCase(), 6, { color: '#ffffff', bg: '#0d5c2e', w: 768, h: 96 });
  welcome.position.copy(P(0, 110, 16));
  scene.add(welcome);

  // Aisles of shelves, each section full of colorful stuff.
  const blocks: Box[] = [];
  const palette = [0xff6b6b, 0xffd43b, 0x4dabf7, 0x69db7c, 0xb197fc, 0xff922b, 0xf06595, 0x868e96];
  for (const [name, x, y, color] of SECTIONS) {
    const shelf = part(geo.box(6, 8, 44), 0xadb5bd, 0.06);
    shelf.position.copy(P(x, y, 4));
    scene.add(shelf);
    blocks.push({ x0: x - 4, x1: x + 4, y0: y - 23, y1: y + 23 });
    for (let i = 0; i < 8; i++) {
      for (const side of [-1, 1]) {
        const item = new THREE.Mesh(geo.box(1.4, 2, 4), toon(palette[(i * 3 + (side > 0 ? 1 : 0) + x) & 7]));
        item.position.copy(P(x + side * 3.4, y - 18 + i * 5, 2 + ((i + 1) % 2) * 3));
        scene.add(item);
      }
    }
    const sign = label(name, 3, { color: '#ffffff', bg: `#${color.toString(16).padStart(6, '0')}`, w: 512, h: 96 });
    sign.position.copy(P(x, y, 18));
    scene.add(sign);
  }

  // The baseball section: every piece of gear on its own stand, with a price tag.
  const bbSign = label('⚾ BASEBALL', 4.2, { color: '#ffffff', bg: '#e03131', w: 512, h: 96 });
  bbSign.position.copy(P(-56, 110, 15));
  scene.add(bbSign);
  const stands: { gear: Gear; x: number; y: number }[] = [];
  const slotRow = { bat: 0, glove: 1, cleats: 2 };
  const perRow = [0, 0, 0];
  for (const g of GEAR) {
    const row = slotRow[g.slot];
    const x = -66 + perRow[row]++ * 10;
    const y = 84 + row * 9;
    stands.push({ gear: g, x, y });
    const stand = part(geo.box(4, 2.6, 3), 0xf8f9fa, 0.06);
    stand.position.copy(P(x, y, 1.3));
    scene.add(stand);
    blocks.push({ x0: x - 2.5, x1: x + 2.5, y0: y - 2, y1: y + 2 });
    let model: THREE.Object3D;
    if (g.slot === 'bat') {
      model = part(geo.cyl(0.25, 0.12, 6, 10), g.color, 0.06);
      model.rotation.z = 0.3;
      model.position.copy(P(x, y, 5.6));
    } else if (g.slot === 'glove') {
      model = part(geo.sphere(1, 12), g.color, 0.06);
      model.scale.set(1, 1.15, 0.6);
      model.position.copy(P(x, y, 3.8));
    } else {
      model = part(geo.box(1.1, 0.8, 2.2), g.color, 0.05);
      model.position.copy(P(x, y, 3.1));
    }
    model.userData.spin = true;
    scene.add(model);
    const tag = label(`$${g.price}`, 1.6, { color: '#1d1b2f', bg: '#ffd43b', w: 192, h: 96 });
    tag.position.copy(P(x, y, 9.2));
    scene.add(tag);
  }

  const league = leagueOf(prof.league);
  const me = new Kid(prof.look, uniformOf(league), kitOf(prof), 4.1);
  me.setField(0, -4);
  me.face(0, 1);
  scene.add(me);
  const dad = new Kid(DAD_LOOK, DAD_CLOTHES, {}, 5.9);
  dad.setField(3, -2);
  dad.face(0, 1);
  dad.glove.visible = false;
  scene.add(dad);

  if (import.meta.env.DEV) Object.assign(window, { __store: { me, dad } });

  // ---------- UI ----------
  const ui = div('screen store');
  const msg = div('msg');
  const say = (t: string, s = '', c = '#ffd23f', ms = 1600) => banner(msg, t, s, c, ms);
  const joy = new Joystick();
  const cart = new Set<string>();
  const cash = pill('cash', `$${prof.money}`);
  const cartInfo = h('span', 'cart-info', 'Cart: empty');
  const checkout = btn('CHECK OUT', () => doCheckout(), 'green');
  const itemCard = div('item-card hidden');
  ui.append(
    div('store-top', cash, cartInfo, checkout, btn('LEAVE', () => go('hub'), 'gray')),
    msg,
    itemCard,
    div('stick-wrap', joy.el),
  );
  const total = () => [...cart].reduce((s, id) => s + GEAR.find((g) => g.id === id)!.price, 0);
  const drawCart = () => {
    cartInfo.textContent = cart.size ? `Cart: ${cart.size} item${cart.size > 1 ? 's' : ''}, $${total()}` : 'Cart: empty';
    checkout.disabled = !cart.size;
  };
  drawCart();

  let shown: Gear | null = null;
  const drawItem = (g: Gear | null) => {
    shown = g;
    show(itemCard, !!g);
    if (!g) return;
    const p = getProfile();
    const owned = p.owned.includes(g.id);
    const equipped = p.equipped[g.slot] === g.id;
    const boosts = Object.entries(g.boost)
      .map(([k, v]) => `${SKILLS.find((s) => s.id === k)!.name} +${v}`)
      .join(' · ');
    const need = total() + g.price - p.money;
    const action = owned
      ? btn(equipped ? 'USING IT ✓' : 'USE THIS ONE', () => {
          p.equipped[g.slot] = g.id;
          saveProfile(p);
          drawItem(g);
        }, equipped ? 'gray' : 'blue')
      : cart.has(g.id)
        ? btn('TAKE OUT OF CART', () => {
            cart.delete(g.id);
            drawCart();
            drawItem(g);
          }, 'gray')
        : need > 0
          ? btn(`NEED $${need} MORE`, () => {}, 'gray')
          : btn(`PUT IN CART · $${g.price}`, () => {
              cart.add(g.id);
              sfx.coin();
              drawCart();
              drawItem(g);
            }, 'green');
    if (!owned && !cart.has(g.id) && need > 0) (action as HTMLButtonElement).disabled = true;
    itemCard.replaceChildren(h('div', 'item-name', g.name), h('div', 'item-boost', boosts), action);
  };

  // ---------- Dad ----------
  type DadState = 'lead' | 'waiting' | 'search' | 'mad';
  let state: DadState = 'lead';
  const path = [
    { x: 3, y: 16 },
    { x: -20, y: 18 },
    { x: -20, y: 80 },
    SECTION,
  ];
  let leg = 0;
  let farFor = 0;
  let searchFor = 0;
  let lastWarn = -9;
  let done = false;
  say('STAY CLOSE TO DAD!', 'He’ll take you to the baseball section', '#ffffff', 2400);

  function doCheckout() {
    if (state === 'mad' || done) return;
    const d = Math.hypot(me.fx - dad.fx, me.fy - dad.fy);
    if (d > 25) {
      say('FIND DAD FIRST', 'He has the money!', '#ffffff');
      return;
    }
    const p = getProfile();
    const bill = total();
    if (bill > p.money) return;
    p.money -= bill;
    for (const id of cart) {
      const g = GEAR.find((x) => x.id === id)!;
      if (!p.owned.includes(id)) p.owned.push(id);
      p.equipped[g.slot] = id;
    }
    saveProfile(p);
    done = true;
    sfx.fanfare();
    ui.appendChild(
      div(
        'modal',
        div(
          'card results',
          h('h1', 'gold', 'NEW GEAR!'),
          h('p', '', `Dad paid $${bill}. Your new stuff is ready for the next game.`),
          btn('DRIVE HOME 🚗', () => go('hub'), 'green big-btn'),
        ),
      ),
    );
  }

  function busted() {
    state = 'mad';
    done = true;
    cart.clear();
    drawCart();
    drawItem(null);
    sfx.aww();
    const p = getProfile();
    p.noBaseball = true;
    saveProfile(p);
    ui.appendChild(
      div(
        'modal',
        div(
          'card results mad',
          h('h1', '', 'UH OH...'),
          h('p', 'dad-quote', '“There you are! You can’t run off like that. That’s it: no baseball today.”'),
          h('p', '', 'Dad put everything back. You’ll sit out today (it still counts as a game), but tomorrow is a new day.'),
          btn('GO HOME', () => go('hub'), 'blue big-btn'),
        ),
      ),
    );
  }

  const blocked = (x: number, y: number, r = 1.4) => blocks.some((b) => x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r);

  let t = 0;
  let camY = -20;
  return {
    scene,
    camera,
    ui,
    update(dt) {
      t += dt;
      // You.
      if (!done && joy.active) {
        const nx = Math.max(-72, Math.min(72, me.fx + joy.x * WALK * dt));
        const ny = Math.max(-9, Math.min(108, me.fy + joy.y * WALK * dt));
        if (!blocked(nx, me.fy)) me.setField(nx, me.fy);
        if (!blocked(me.fx, ny)) me.setField(me.fx, ny);
        me.face(joy.x, joy.y);
        me.pose('walk', t * 9);
      } else me.pose(done && state === 'mad' ? 'sad' : 'stand');

      // Dad.
      const d = Math.hypot(me.fx - dad.fx, me.fy - dad.fy);
      if (state === 'lead' || state === 'waiting') {
        if (d > TOO_FAR) {
          farFor += dt;
          if (clock.now - lastWarn > 2.5) {
            lastWarn = clock.now;
            say('TOO FAR FROM DAD!', 'Go back before he notices!', '#ff8787', 1400);
          }
          if (farFor > 5) {
            state = 'search';
            say('DAD IS LOOKING FOR YOU!', '“Where did you go?!”', '#ff8787', 2200);
          }
        } else farFor = Math.max(0, farFor - dt);
      }
      if (state === 'lead') {
        const goal = path[leg];
        const gd = Math.hypot(goal.x - dad.fx, goal.y - dad.fy);
        const behind = Math.hypot(SECTION.x - me.fx, SECTION.y - me.fy) > Math.hypot(SECTION.x - dad.fx, SECTION.y - dad.fy) + 10;
        if (d > 22 && leg > 0 && behind) {
          // Wait up for the kid if they're lagging behind (but not if they ran ahead).
          dad.face(me.fx - dad.fx, me.fy - dad.fy);
          dad.pose('stand');
        } else if (gd < 0.5) {
          leg++;
          if (leg >= path.length) {
            state = 'waiting';
            say('HERE’S THE BASEBALL STUFF!', 'Walk up to anything to check it out', '#69db7c', 2400);
          }
        } else {
          const step = Math.min(gd, DAD_WALK * dt);
          dad.setField(dad.fx + ((goal.x - dad.fx) / gd) * step, dad.fy + ((goal.y - dad.fy) / gd) * step);
          dad.face(goal.x - dad.fx, goal.y - dad.fy);
          dad.pose('walk', t * 7);
        }
      } else if (state === 'waiting') {
        dad.face(me.fx - dad.fx, me.fy - dad.fy);
        dad.pose('stand');
      } else if (state === 'search') {
        searchFor += dt;
        const step = Math.min(d, 9 * dt);
        const nx = dad.fx + ((me.fx - dad.fx) / d) * step;
        const ny = dad.fy + ((me.fy - dad.fy) / d) * step;
        if (!blocked(nx, ny, 1)) dad.setField(nx, ny);
        else if (!blocked(nx, dad.fy, 1)) dad.setField(nx, dad.fy);
        else {
          // A shelf is in the way: walk toward whichever end of the aisle is closer to the kid.
          const endY = me.fy > 50 ? 78 : 22;
          dad.setField(dad.fx, dad.fy + Math.sign(endY - dad.fy) * step);
        }
        dad.face(me.fx - dad.fx, me.fy - dad.fy);
        dad.pose('walk', t * 9);
        if (d < 5 || searchFor > 15) busted();
      }

      // Show the gear you're standing next to.
      if (!done) {
        let near: Gear | null = null;
        for (const s of stands) if (Math.hypot(s.x - me.fx, s.y - me.fy) < 6.5) near = s.gear;
        if (near !== shown) drawItem(near);
      }
      scene.traverse((o) => {
        if (o.userData.spin) o.rotation.y += dt * 0.8;
      });

      // Follow from behind and above.
      camY += (me.fy - 22 - camY) * (1 - Math.exp(-dt * 4));
      camera.position.copy(P(me.fx * 0.85, camY, 12));
      camera.lookAt(P(me.fx, me.fy + 8, 2));
    },
  };
}

register('store', storeScreen);
