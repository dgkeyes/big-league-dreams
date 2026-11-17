// Home: the week's calendar (practice and games take turns every day), your player, and where to go next.
import * as THREE from 'three';
import { register, go, type Screen } from '../app';
import {
  getProfile, loadProfile, saveProfile, leagueOf, levelOf, skillsOf, overall, uniformOf, kitOf, displayName, dayName, dayKind,
  GAMES_PER_LEVEL, SKILLS, STORE, POSITIONS, LEVELS,
} from '../data';
import { Kid } from '../gfx/kid';
import { buildPark } from '../gfx/field3d';
import { P } from '../gfx/toon';
import { div, h, btn, pill, skillBars, show } from '../ui';

export function hubScreen(): Screen {
  if (!loadProfile()) {
    // No player yet: make one first.
    queueMicrotask(() => go('setup'));
  }
  const prof = getProfile();
  const lv = levelOf(prof);
  const league = leagueOf(prof.league);
  const scene = new THREE.Scene();
  buildPark(scene, league.abbr, 'PDX');
  const kid = new Kid(prof.look, uniformOf(league), kitOf(prof), 4.4);
  kid.setField(-6, 16);
  kid.face(0.6, -1);
  scene.add(kid);
  const camera = new THREE.PerspectiveCamera(45, 1.44, 0.1, 4000);
  camera.position.copy(P(-1, 4, 5));
  camera.lookAt(P(-1.2, 16, 3.2));

  const ui = div('screen hub');
  const s = skillsOf(prof);
  const pos = POSITIONS.find((p) => p.id === prof.position)!;
  const top = div(
    'hub-top',
    div(
      'player-card',
      h('div', 'pc-name', displayName(prof)),
      h('div', 'pc-sub', `#${prof.look.number} · ${pos.name} · ${league.name}`),
      h('div', 'pc-sub', `Age ${lv.age} · ${lv.name} · Overall ${overall(prof)}`),
    ),
    div('pills', pill('cash', `$${prof.money}`), pill('token', String(prof.tokens))),
  );

  // This week, with today in the middle of the strip.
  const week = div('week');
  const start = prof.day - (prof.day % 7);
  for (let d = start; d < start + 7; d++) {
    const kind = dayKind(d);
    week.appendChild(
      div(
        `day ${d === prof.day ? 'today' : ''} ${d < prof.day ? 'past' : ''} ${kind}`,
        h('div', 'day-name', dayName(d).slice(0, 3).toUpperCase()),
        h('div', 'day-icon', kind === 'game' ? '⚾' : '🧢'),
        h('div', 'day-kind', kind === 'game' ? 'GAME' : 'PRACTICE'),
      ),
    );
  }

  const today = dayKind(prof.day);
  const nextDay = () => {
    const p = getProfile();
    p.day++;
    p.noBaseball = false;
    saveProfile(p);
    go('hub');
  };
  const main = prof.noBaseball
    ? div(
        'today-card sad',
        h('h2', '', 'No baseball today.'),
        h('p', '', 'Dad said so, after you ran off at the store. Tomorrow is a new day!'),
        btn('GO TO BED 💤', nextDay, 'blue big-btn'),
      )
    : div(
        'today-card',
        h('h2', '', `${dayName(prof.day)}: ${today === 'game' ? 'Game day!' : 'Practice day'}`),
        today === 'game'
          ? btn('PLAY TODAY’S GAME ⚾', () => go('game'), 'green big-btn')
          : btn('GO TO PRACTICE 🧢', () => show(practice, true), 'green big-btn'),
      );

  const side = div(
    'hub-side',
    btn('HOME RUN QUEST ★', () => go('quest'), 'purple'),
    btn(`GO TO ${STORE.toUpperCase()} 🚗`, () => go('drive'), 'orange'),
    btn('CHANGE MY LOOK', () => go('setup', 'edit'), 'blue'),
  );

  const atTop = prof.level >= LEVELS.length - 1;
  const progress = div(
    'progress',
    h('div', 'prog-label', atTop ? `${lv.name}: the top level!` : `${prof.gamesAtLevel} of ${GAMES_PER_LEVEL} games to move up to ${LEVELS[prof.level + 1].name}`),
    div('prog-bar', Object.assign(div('prog-fill'), { style: `width:${atTop ? 100 : (prof.gamesAtLevel / GAMES_PER_LEVEL) * 100}%` })),
    h('div', 'prog-hint', atTop ? '' : 'Or hit a home run every at-bat in one game!'),
  );

  const practice = div(
    'modal hidden',
    div(
      'card',
      h('h2', '', 'Practice!'),
      h('p', '', 'What do you want to work on today?'),
      div(
        'col',
        btn('FIELDING DRILLS 🧤', () => go('drills'), 'orange'),
        btn('BATTING CAGES 🏏', () => go('cages'), 'blue'),
        btn('SCRIMMAGE (3 INNINGS) ⚾', () => go('game', 'scrimmage'), 'green'),
      ),
      btn('NOT NOW', () => show(practice, false), 'gray'),
    ),
  );

  ui.append(
    top,
    week,
    div('hub-main', main, side),
    div('hub-bottom', div('panel stats', skillBars(s, SKILLS)), div('panel', progress, h('div', 'record', `Record ${prof.wins}-${prof.losses}${prof.ties ? `-${prof.ties}` : ''} · ${prof.homers} HR · ${prof.hits} hits`))),
    practice,
  );

  let t = 0;
  return {
    scene,
    camera,
    ui,
    update(dt) {
      t += dt;
      kid.pose('stand');
      kid.head.rotation.y = Math.sin(t * 0.8) * 0.25;
      kid.shR.rotation.x = Math.sin(t * 2) * 0.05;
    },
  };
}

register('hub', hubScreen);
