// Make your player: name, boy or girl, skin, hair, eyes, jersey number, league, and position.
import * as THREE from 'three';
import { register, go, type Screen } from '../app';
import {
  getProfile, loadProfile, saveProfile, uniformOf, leagueOf, levelOf, defaultLook, kitOf,
  LEAGUES, POSITIONS, SKIN_TONES, HAIR_COLORS, EYE_COLORS, HAIR_STYLES, type Profile,
} from '../data';
import { Kid } from '../gfx/kid';
import { addLights, skyDome, tree, flat, cloud, P } from '../gfx/toon';
import { div, h, btn } from '../ui';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function stage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfeaff);
  scene.add(skyDome());
  addLights(scene);
  const grass = new THREE.Mesh(new THREE.CircleGeometry(400, 40), flat(0x5fae4f));
  grass.rotation.x = -Math.PI / 2;
  scene.add(grass);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(4, 32), flat(0xc98f55));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = 0.02;
  scene.add(dirt);
  for (let i = 0; i < 16; i++) {
    const t = tree(1 + (i % 3) * 0.3, i % 4 ? 'fir' : 'round');
    const a = -1.3 + (i / 15) * 2.6;
    t.position.copy(P(Math.sin(a) * 90, Math.cos(a) * 90 + 10));
    scene.add(t);
  }
  for (let i = 0; i < 4; i++) {
    const c = cloud(0.7);
    c.position.copy(P(-120 + i * 80, 260, 70 + (i % 2) * 30));
    scene.add(c);
  }
  return scene;
}

export function setupScreen(arg?: unknown): Screen {
  const editing = arg === 'edit' && !!loadProfile();
  const prof: Profile = getProfile();
  const scene = stage();
  const camera = new THREE.PerspectiveCamera(40, 1.44, 0.1, 2000);
  camera.position.set(2.7, 2.7, 13.5);
  camera.lookAt(2.7, 2.3, 0);

  let kid: Kid | null = null;
  let spin = 0.5;
  const rebuild = () => {
    if (kid) {
      scene.remove(kid);
      kid.char.dispose();
    }
    kid = new Kid(prof.look, uniformOf(leagueOf(prof.league)), kitOf(prof), 4.4);
    kid.rotation.y = spin;
    kid.position.x = 0;
    scene.add(kid);
    if (import.meta.env.DEV) Object.assign(window, { __kid: kid });
  };

  const ui = div('screen setup');
  const panel = div('panel setup-panel');
  const sections: (() => HTMLElement)[] = [];
  const refresh = () => {
    panel.replaceChildren(...sections.map((s) => s()));
    rebuild();
    playBtn.disabled = !prof.name.trim();
  };

  const choice = (on: boolean, label: string | Node, pick: () => void, style = '') => {
    const b = btn(label, () => {
      pick();
      refresh();
    }, `chip ${on ? 'on' : ''}`);
    if (style) b.setAttribute('style', style);
    return b;
  };
  const swatches = (list: number[], cur: number, set: (c: number) => void) =>
    div('swatches', ...list.map((c) => choice(c === cur, '', () => set(c), `background:${hex(c)}`)));

  const nameInput = h('input', 'name-input');
  nameInput.placeholder = 'Type your name';
  nameInput.maxLength = 14;
  nameInput.value = prof.name;
  nameInput.addEventListener('input', () => {
    prof.name = nameInput.value;
    playBtn.disabled = !prof.name.trim();
  });
  nameInput.addEventListener('pointerdown', (e) => e.stopPropagation());

  sections.push(
    () => div('sec', h('h3', '', 'Your name'), nameInput),
    () =>
      div(
        'sec',
        h('h3', '', 'Boy or girl'),
        div(
          'row',
          ...(['boy', 'girl'] as const).map((g) =>
            choice(prof.look.gender === g, g.toUpperCase(), () => {
              const keep = prof.look;
              prof.look = { ...defaultLook(g), skin: keep.skin, hair: keep.hair, eyes: keep.eyes, number: keep.number };
            }),
          ),
        ),
      ),
    () => div('sec', h('h3', '', 'Skin'), swatches(SKIN_TONES, prof.look.skin, (c) => (prof.look.skin = c))),
    () =>
      div(
        'sec',
        h('h3', '', 'Hair'),
        div('row wrap', ...HAIR_STYLES.map((s) => choice(prof.look.hairStyle === s.id, s.name, () => (prof.look.hairStyle = s.id)))),
        swatches(HAIR_COLORS, prof.look.hair, (c) => (prof.look.hair = c)),
      ),
    () => div('sec', h('h3', '', 'Eyes'), swatches(EYE_COLORS, prof.look.eyes, (c) => (prof.look.eyes = c))),
    () =>
      div(
        'sec',
        h('h3', '', 'Jersey number'),
        div(
          'row',
          choice(false, '−', () => (prof.look.number = prof.look.number <= 0 ? 99 : prof.look.number - 1)),
          h('span', 'big-num', String(prof.look.number)),
          choice(false, '+', () => (prof.look.number = (prof.look.number + 1) % 100)),
        ),
      ),
    () =>
      div(
        'sec',
        h('h3', '', 'Your Portland league'),
        div(
          'grid2',
          ...LEAGUES.map((l) =>
            choice(prof.league === l.id, l.name, () => (prof.league = l.id), `--team:${hex(l.color)}`),
          ),
        ),
      ),
    () =>
      div(
        'sec',
        h('h3', '', 'Your position'),
        div('grid3', ...POSITIONS.map((p) => choice(prof.position === p.id, `${p.id} · ${p.name}`, () => (prof.position = p.id)))),
      ),
  );

  const playBtn = btn(editing ? 'DONE' : 'PLAY BALL!', () => {
    prof.name = prof.name.trim();
    saveProfile(prof);
    go('hub');
  }, 'green big-btn');
  const title = div('title-block', h('h1', 'logo', 'BIG LEAGUE DREAMS'), h('p', '', editing ? 'Change your look' : `Make your player · Age ${levelOf(prof).age} · ${levelOf(prof).name}`));
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  ui.append(title, panel, div('setup-play', playBtn));
  refresh();

  // Drag on the player to spin them around.
  let dragX: number | null = null;
  ui.addEventListener('pointerdown', (e) => (dragX = e.clientX));
  ui.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    spin += (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
  });
  ui.addEventListener('pointerup', () => (dragX = null));

  let t = 0;
  return {
    scene,
    camera,
    ui,
    update(dt) {
      t += dt;
      if (dragX === null) spin += dt * 0.4;
      if (kid) {
        kid.rotation.y = spin;
        kid.pose('stand');
        kid.lookYaw = Math.sin(t * 1.3) * 0.15;
      }
    },
  };
}

register('setup', setupScreen);
