// Home: a day in the life. You wake up at 7, can eat breakfast, go to practice from 10:30 to 11:30, have lunch,
// play a game from 1 to 3 on game days, go to the store up to twice a day, and go to bed.
import * as THREE from 'three';
import { register, go, type Screen } from '../app';
import {
  getProfile, loadProfile, saveProfile, levelOf, skillsOf, overall, uniformOf, kitOf, displayName, dayName, dayKind,
  myTeam, teamOf, nextEvent, hasTime, newDay, clockText,
  GAMES_PER_LEVEL, SKILLS, STORE, STORE_TRIPS, POSITIONS, LEVELS, HIGH, COLLEGE, PRACTICE, GAME,
  finishGame, moveUp, type Profile,
} from '../data';
import { HIGH_SCHOOLS, MLB_TEAMS } from '../content/teams';
import { COLLEGES } from '../content/colleges';
import { makeKid } from '../gfx/kid';
import { buildPark } from '../gfx/field3d';
import { P } from '../gfx/toon';
import { div, h, btn, pill, skillBars, show, banner, confetti } from '../ui';
import { sfx } from '../sfx';

const MEALS: Record<string, { label: string; say: string; min: number }> = {
  breakfast: { label: 'EAT BREAKFAST 🥞', say: 'Pancakes! Ready for practice.', min: 30 },
  lunch: { label: 'EAT LUNCH 🥪', say: 'A turkey sandwich and an apple.', min: 30 },
  dinner: { label: 'EAT DINNER 🍝', say: 'Spaghetti night!', min: 45 },
};

// Save a change to today and come back home.
function act(change: (p: Profile) => void, arg?: string) {
  const p = getProfile();
  change(p);
  saveProfile(p);
  go('hub', arg);
}

export function hubScreen(arg?: unknown): Screen {
  if (!loadProfile()) {
    // No player yet: make one first.
    queueMicrotask(() => go('setup'));
  }
  const prof = getProfile();
  const lv = levelOf(prof);
  const team = teamOf(prof);
  const scene = new THREE.Scene();
  buildPark(scene, team.abbr, 'PDX');
  const kid = makeKid(prof.look, uniformOf(team), kitOf(prof), 4.4);
  kid.setField(-6, 16);
  kid.face(0.6, -1);
  scene.add(kid);
  const camera = new THREE.PerspectiveCamera(45, 1.44, 0.1, 4000);
  camera.position.copy(P(-1, 4, 5));
  camera.lookAt(P(-1.2, 16, 3.2));

  const ui = div('screen hub');
  const msg = div('msg');
  const s = skillsOf(prof);
  const pos = POSITIONS.find((p) => p.id === prof.position)!;
  const top = div(
    'hub-top',
    div(
      'player-card',
      h('div', 'pc-name', displayName(prof)),
      h('div', 'pc-sub', `#${prof.look.number} · ${pos.name} · ${team.name}`),
      h('div', 'pc-sub', `Age ${lv.age} · ${lv.name} · Overall ${overall(prof)}`),
    ),
    div('pills', div('pill clock', h('span', '', `🕒 ${clockText(prof.time)}`)), pill('cash', `$${prof.money}`), pill('token', String(prof.tokens))),
  );

  // This week. Every day has practice, and every other day a game after it.
  const week = div('week');
  const start = prof.day - (prof.day % 7);
  for (let d = start; d < start + 7; d++) {
    const kind = dayKind(d);
    week.appendChild(
      div(
        `day ${d === prof.day ? 'today' : ''} ${d < prof.day ? 'past' : ''} ${kind}`,
        h('div', 'day-name', dayName(d).slice(0, 3).toUpperCase()),
        h('div', 'day-icon', kind === 'game' ? '⚾' : '🧢'),
        h('div', 'day-kind', kind === 'game' ? 'GAME DAY' : 'PRACTICE'),
      ),
    );
  }

  const next = nextEvent(prof);
  const benched = prof.noBaseball && !!next;
  // Elias: a no-baseball day still counts as one of your games toward moving up.
  const sitOut = () => {
    const p = getProfile();
    const moved = finishGame(p, 'sat');
    p.practiceDone = true;
    p.gameDone = true;
    p.noBaseball = false;
    p.time = Math.max(p.time, dayKind(p.day) === 'game' ? GAME.end : PRACTICE.end);
    saveProfile(p);
    go('hub', moved ? 'moved' : undefined);
  };
  const toPractice = () => {
    act((p) => (p.time = Math.max(p.time, PRACTICE.start)), 'practice');
  };
  const toGame = () => {
    const p = getProfile();
    p.time = Math.max(p.time, GAME.start);
    saveProfile(p);
    go('game');
  };
  const bed = () => act((p) => newDay(p), 'morning');

  let main: HTMLElement;
  if (benched)
    main = div(
      'today-card sad',
      h('h2', '', 'No baseball today.'),
      h('p', '', 'Dad said so, after you ran off at the store. It still counts as one of your games.'),
      btn('SIT OUT TODAY 😞', sitOut, 'blue big-btn'),
    );
  else if (next)
    main = div(
      'today-card',
      h('h2', '', `${dayName(prof.day)}: ${dayKind(prof.day) === 'game' ? 'Game day!' : 'Practice day'}`),
      h('p', '', next.kind === 'practice' ? `Practice is 10:30 to 11:30 AM.${dayKind(prof.day) === 'game' ? ' The game is 1 to 3 PM.' : ''}` : 'The game is 1 to 3 PM.'),
      next.kind === 'practice'
        ? btn(prof.time < next.start ? 'GO TO PRACTICE 🧢' : 'PRACTICE TIME! 🧢', toPractice, 'green big-btn')
        : btn('PLAY TODAY’S GAME ⚾', toGame, 'green big-btn'),
    );
  else
    main = div(
      'today-card',
      h('h2', '', prof.time >= 20 * 60 ? 'Time for bed!' : 'Free time!'),
      h('p', '', prof.noBaseball ? 'Dad said no baseball tomorrow.' : `Baseball is done for today. Tomorrow is ${dayName(prof.day + 1)}: ${dayKind(prof.day + 1) === 'game' ? 'practice and a game' : 'practice'}.`),
      btn('GO TO BED 💤', bed, 'blue big-btn'),
    );

  // Things to do between practice and games.
  const eat = (meal: string) =>
    btn(MEALS[meal].label, () =>
      act((p) => {
        p.ate.push(meal);
        p.time += MEALS[meal].min;
        if (meal === 'dinner') p.time = Math.max(p.time, 18 * 60);
      }, `ate:${meal}`),
    'yellow');
  const ate = (m: string) => prof.ate.includes(m);
  const meals: HTMLElement[] = [];
  if (!benched) {
    if (!ate('breakfast') && prof.time < 11 * 60 && hasTime(prof, MEALS.breakfast.min)) meals.push(eat('breakfast'));
    if (!ate('lunch') && prof.time >= PRACTICE.end && prof.time < 16 * 60 && hasTime(prof, MEALS.lunch.min)) meals.push(eat('lunch'));
    if (!ate('dinner') && !next && prof.time >= 12 * 60) meals.push(eat('dinner'));
  }
  const tripsLeft = STORE_TRIPS - prof.storeTrips;
  const storeOk = !benched && tripsLeft > 0 && hasTime(prof, 60);
  const store = btn(
    tripsLeft > 0 ? `GO TO ${STORE.toUpperCase()} 🚗 (${tripsLeft} LEFT)` : 'NO MORE STORE TRIPS TODAY',
    () => {
      const p = getProfile();
      p.storeTrips++;
      p.time += 60;
      saveProfile(p);
      go('drive');
    },
    'orange',
  );
  store.disabled = !storeOk;
  const side = div(
    'hub-side',
    ...meals,
    store,
    btn('HOME RUN QUEST ★', () => go('quest'), 'purple'),
    btn('CHANGE MY LOOK', () => go('setup', 'edit'), 'blue'),
    prof.level < LEVELS.length - 1 ? btn('SKIP LEVEL ⏭', () => show(skip, true), 'gray') : null,
  );

  const skip = prof.level < LEVELS.length - 1
    ? div(
        'modal hidden',
        div(
          'card',
          h('h2', '', `Skip to ${LEVELS[prof.level + 1].name}?`),
          h('p', '', `You'll be ${LEVELS[prof.level + 1].age} and play against bigger players right away.`),
          div(
            'row',
            btn('YES, SKIP IT!', () => act((p) => moveUp(p), 'moved'), 'green'),
            btn('NOT YET', () => show(skip, false), 'gray'),
          ),
        ),
      )
    : div('hidden');

  const atTop = prof.level >= LEVELS.length - 1;
  const progress = div(
    'progress',
    h('div', 'prog-label', atTop ? `${lv.name}: the top level!` : `${prof.gamesAtLevel} of ${GAMES_PER_LEVEL} games to move up to ${LEVELS[prof.level + 1].name}`),
    div('prog-bar', Object.assign(div('prog-fill'), { style: `width:${atTop ? 100 : (prof.gamesAtLevel / GAMES_PER_LEVEL) * 100}%` })),
    h('div', 'prog-hint', atTop ? '' : 'Or hit a home run every at-bat in one game!'),
  );

  const practice = div(
    `modal ${arg === 'practice' ? '' : 'hidden'}`,
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
    skip,
    msg,
  );
  // Moving up to high school, college, or the MLB means picking where you play.
  if (!myTeam(prof)) ui.appendChild(teamPicker(prof));
  if (arg === 'moved') {
    sfx.fanfare();
    confetti(ui);
    banner(msg, `${lv.name.toUpperCase()}!`, `You moved up! You're ${lv.age} now.`, '#ffd23f', 2600);
  } else if (arg === 'morning') {
    banner(msg, `GOOD MORNING!`, `It's ${dayName(prof.day)}, 7:00 AM`, '#ffd23f', 2000);
  } else if (typeof arg === 'string' && arg.startsWith('ate:')) {
    sfx.coin();
    banner(msg, 'YUM!', MEALS[arg.slice(4)]?.say ?? '', '#ffd23f', 1600);
  }

  let t = 0;
  return {
    scene,
    camera,
    ui,
    update(dt) {
      t += dt;
      kid.pose('stand');
      kid.lookYaw = Math.sin(t * 0.8) * 0.25;
    },
  };
}

// Pick your high school (Portland Public Schools), your college (every Division I baseball school), or your MLB team.
function teamPicker(prof: Profile) {
  const lvl = prof.level;
  const pick = (name: string) =>
    act((p) => {
      if (lvl === HIGH) p.school = name;
      else if (lvl === COLLEGE) p.college = name;
      else p.mlbTeam = name;
    }, 'picked');
  const title = lvl === HIGH ? 'Pick your high school!' : lvl === COLLEGE ? 'Pick your college!' : 'Pick your MLB team!';
  const sub = lvl === HIGH ? 'All nine Portland public high schools' : lvl === COLLEGE ? `Every school with Division I baseball (${COLLEGES.length} of them)` : 'All 30 teams';
  const list = div('pick-list');
  const fill = (q = '') => {
    const ql = q.trim().toLowerCase();
    const items =
      lvl === HIGH
        ? HIGH_SCHOOLS.map((n) => ({ name: n, label: `${n} High`, note: '' }))
        : lvl === COLLEGE
          ? COLLEGES.map((c) => ({ name: c.name, label: c.name, note: c.state }))
          : MLB_TEAMS.map((n) => ({ name: n, label: n, note: '' }));
    list.replaceChildren(
      ...items
        .filter((i) => !ql || i.label.toLowerCase().includes(ql) || i.note.toLowerCase().includes(ql))
        .map((i) => btn(i.note ? div('', h('div', '', i.label), h('div', 'pick-note', i.note)) : i.label, () => pick(i.name), 'chip')),
    );
  };
  fill();
  let search: HTMLInputElement | null = null;
  if (lvl === COLLEGE) {
    search = h('input', 'name-input');
    search.placeholder = 'Search by name or state';
    search.addEventListener('input', () => fill(search!.value));
    search.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  list.addEventListener('pointerdown', (e) => e.stopPropagation());
  return div('modal', div('card picker', h('h2', '', title), h('p', '', sub), search, list));
}

register('hub', hubScreen);
