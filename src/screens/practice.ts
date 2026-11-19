// Practice days: the batting cages (10 pitches from a machine) and fielding drills (the coach hits you 6 balls).
import { register, go, type Screen } from '../app';
import { clock } from '../clock';
import { getProfile, saveProfile, levelOf, skillsOf, kitOf, teamOf, uniformOf, teamKids, bump, PRACTICE, type SkillId } from '../data';
import { battedBall, type Swing } from '../play';
import { Park, rnd } from '../game/park';
import { Batting } from '../game/batting';
import { Fielding, type FieldButtons } from '../game/fielding';
import { Joystick, LookPad } from '../input';
import { div, h, btn, pad, show, banner, pill } from '../ui';
import { sfx } from '../sfx';
import { part, geo, P } from '../gfx/toon';

function doneCard(ui: HTMLElement, title: string, line: string, gains: SkillId[], cash: number) {
  const p = getProfile();
  gains.forEach((g) => bump(p, g));
  p.money += cash;
  p.practices++;
  p.practiceDone = true;
  p.time = Math.max(p.time, PRACTICE.end);
  saveProfile(p);
  sfx.fanfare();
  ui.appendChild(
    div(
      'modal',
      div(
        'card results',
        h('h1', 'gold', title),
        h('p', '', line),
        div('row', pill('cash', `+${cash}`)),
        h('p', 'gains', gains.map((g) => `${g[0].toUpperCase()}${g.slice(1)} +1`).join('   ')),
        btn('BACK HOME', () => go('hub'), 'green big-btn'),
      ),
    ),
  );
}

export function cagesScreen(): Screen {
  const prof = getProfile();
  const lv = levelOf(prof);
  const park = new Park(lv, 'CAGES', 'BP');
  // Netting around the plate, so it feels like a batting cage.
  for (const [x, y, w, d] of [
    [-6, 20, 0.2, 44],
    [6, 20, 0.2, 44],
  ]) {
    const net = part(geo.box(w, 10, d), 0x343a40, 0);
    (net.material as { transparent: boolean; opacity: number }).transparent = true;
    (net.material as { transparent: boolean; opacity: number }).opacity = 0.25;
    net.position.copy(P(x, y, 5));
    park.scene.add(net);
  }
  const machine = part(geo.box(2, 2.5, 2), 0xff922b, 0.05);
  machine.position.copy(P(0, lv.pitchDist, 1.25));
  park.scene.add(machine);

  const ui = div('screen cages');
  const msg = div('msg');
  const say = (t: string, s = '', c = '#ffd23f') => banner(msg, t, s, c);
  const TOTAL = 10;
  const tally = h('span', '', `0 hits · ${TOTAL} pitches left`);
  let mode: Swing = 'contact';
  const modeBtns = (['power', 'contact', 'bunt'] as Swing[]).map((m) => {
    const b = pad(m.toUpperCase(), () => {
      mode = m;
      modeBtns.forEach((x) => x.classList.toggle('on', x === b));
    }, `mode mode-${m}`);
    return b;
  });
  modeBtns[1].classList.add('on');
  const ctl = div('ctl bat-ctl', div('modes', ...modeBtns), pad('SWING!', () => batting.swing(mode), 'big swing'));
  ui.append(div('quest-info', h('div', 'q-title', 'BATTING CAGES'), div('q-left', tally)), div('top-right', btn('✕', () => go('hub'), 'round quit')), msg, ctl);
  const batting = new Batting(park, lv, () => skillsOf(prof), { banner: say, count: () => {} }, kitOf(prof).bat, kitOf(prof).glove, prof.look.skin);
  let watching = false;

  async function run() {
    let hits = 0;
    let best = 0;
    say('BATTING CAGES', 'Try every kind of swing!', '#ffffff');
    batting.enter(true);
    await clock.wait(1.8);
    for (let i = 0; i < TOTAL; i++) {
      batting.enter(true);
      watching = false;
      show(ctl, true);
      await clock.wait(0.5);
      // The machine throws a little slower than game pitchers, and always strikes.
      const speed = lv.tee ? rnd(24, 30) : rnd(lv.pitch[0] - 6, lv.pitch[1] - 6);
      const r = await batting.pitch(null, { model: 'game', speed: () => speed, strikeRate: 0.9, cpu: lv.cpu - 10 });
      tally.textContent = `${hits} hits · ${TOTAL - i - 1} pitches left`;
      if (r.kind === 'foul') {
        say('FOUL', '', '#ffffff');
        await batting.foulBall();
        continue;
      }
      if (r.kind !== 'inplay') continue;
      hits++;
      best = Math.max(best, r.b.dist);
      tally.textContent = `${hits} hits · ${TOTAL - i - 1} pitches left`;
      batting.leave();
      show(ctl, false);
      watching = true;
      park.snapTv();
      say(r.q > 0.85 ? 'CRUSHED IT!' : r.q > 0.5 ? 'NICE HIT!' : 'GOT A PIECE', `${Math.round(r.b.dist)} feet`, '#ffd23f');
      await park.flyBall(r.b, r.b.time + 0.6, lv.ft * 0.5);
      park.setBall(null);
    }
    batting.leave();
    show(ctl, false);
    const gains: SkillId[] = hits >= 6 ? ['contact', 'power'] : ['contact'];
    doneCard(ui, 'GREAT PRACTICE!', `${hits} hits in ${TOTAL} pitches. Longest: ${Math.round(best)} feet.`, gains, 5 + hits);
  }
  void run();
  return { scene: park.scene, camera: park.camera, ui, update: (dt) => watching && park.tvCam(dt) };
}

export function drillsScreen(): Screen {
  const prof = getProfile();
  const lv = levelOf(prof);
  const league = teamOf(prof);
  const uni = uniformOf(league);
  const park = new Park(lv, league.abbr, 'DRILLS');
  // Drills happen at your spot, except pitchers and catchers practice at shortstop.
  const pos = prof.position === 'P' || prof.position === 'C' ? 'SS' : prof.position;
  const mates = teamKids(league, 9);
  park.setDefense(uni, mates, pos);
  park.remove(park.fielders.get('C') ?? null);
  park.fielders.delete('C');
  const coach = park.kid({ gender: 'boy', skin: 0xe0ac69, hair: 0x6b4a2b, hairStyle: 'short', eyes: 0x4a2e17, number: 0 }, { ...uni, jersey: 0x495057, pants: 0x343a40 }, {}, 5.9);
  coach.setField(-2.6, 0.2);
  coach.face(1, 0);
  coach.pose('bat');

  const ui = div('screen drills');
  const msg = div('msg');
  const say = (t: string, s = '', c = '#ffd23f') => banner(msg, t, s, c);
  const joy = new Joystick();
  const look = new LookPad(ui, () => clock.now);
  const fieldBtn = pad('FIELD', () => fielding.field(), 'big field');
  const diveBtn = pad('DIVE', () => fielding.dive(), 'mid dive');
  const throwBtn = pad('THROW TO 1ST', () => fielding.throwNow(), 'big throw');
  const buttons = (s: FieldButtons) => {
    show(fieldBtn, s === 'field');
    show(diveBtn, s === 'field');
    show(throwBtn, s === 'throw' || s === 'throwIn' || s === 'step');
    throwBtn.textContent = s === 'throwIn' ? 'THROW IT IN' : s === 'step' ? 'STEP ON 1ST' : 'THROW TO 1ST';
  };
  const TOTAL = 6;
  const tally = h('span', '', `0 good plays · ${TOTAL} to go`);
  ui.append(
    div('quest-info', h('div', 'q-title', 'FIELDING DRILLS'), div('q-left', tally)),
    div('top-right', btn('✕', () => go('hub'), 'round quit')),
    msg,
    div('ctl field-ctl', diveBtn, fieldBtn, throwBtn),
    div('stick-wrap', joy.el),
  );
  const fielding = new Fielding(park, lv, () => skillsOf(prof), { banner: say, buttons }, joy, look, kitOf(prof).glove);

  async function run() {
    let good = 0;
    let throws = 0;
    buttons('none');
    fielding.enter(pos);
    say('FIELDING DRILLS', 'Use the stick to run. FIELD to grab it, DIVE to lay out!', '#ffffff');
    await clock.wait(2.6);
    for (let i = 0; i < TOTAL; i++) {
      fielding.enter(pos);
      park.resetFielders();
      coach.pose('bat');
      fielding.focus = { x: 0, y: 0, h: 3 };
      await clock.wait(1.2);
      await clock.tween(0.25, (k) => coach.pose('swing', k));
      sfx.crack(false);
      // Hit it near the player, sometimes a few steps away so they have to run or dive.
      const me = park.spotOf(pos);
      const angle = Math.atan2(me.x, me.y) + rnd(-0.14, 0.14);
      const d = Math.hypot(me.x, me.y);
      const outfield = d > 100;
      const grounder = !outfield && Math.random() < 0.7;
      const q = grounder ? 0.5 : 0.7;
      const b = { ...battedBall(q, angle, 'contact', 40), grounder };
      b.dist = grounder ? d + 25 : d + rnd(-14, 14);
      b.apex = grounder ? 0 : outfield ? rnd(28, 36) : rnd(16, 24);
      b.time = grounder ? b.dist / 45 : 1.2 + b.dist * 0.012;
      const r = await fielding.play(b, lv.cpu, 3);
      if (r.kind !== 'safe') good++;
      if (r.kind === 'out') throws++;
      if (r.kind === 'out') say('OUT AT FIRST!', 'Great throw!', '#69db7c');
      else if (r.kind === 'safe') say(r.label, 'Shake it off, here comes another', '#ffffff');
      tally.textContent = `${good} good plays · ${TOTAL - i - 1} to go`;
      await clock.wait(1.4);
    }
    fielding.leave();
    buttons('none');
    const gains: SkillId[] = throws ? ['fielding', 'arm'] : ['fielding'];
    doneCard(ui, 'NICE GLOVE!', `${good} good plays out of ${TOTAL}.`, gains, 5 + good * 2);
  }
  void run();
  return {
    scene: park.scene,
    camera: park.camera,
    ui,
    update(dt) {
      if (park.ball.visible && !fielding.busy) fielding.focus = park.ballPos();
      fielding.update(dt);
    },
  };
}

register('cages', cagesScreen);
register('drills', drillsScreen);
