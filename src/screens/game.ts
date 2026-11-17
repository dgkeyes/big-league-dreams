// A full game (9 innings) or a practice scrimmage (3 innings). You bat leadoff in first person and play your own position.
import { register, go, type Screen } from '../app';
import { clock } from '../clock';
import {
  getProfile, saveProfile, leagueOf, levelOf, skillsOf, kitOf, uniformOf, teamKids, displayName, finishGame, bump,
  LEAGUES, POSITIONS, type Pos, type Profile, type SkillId,
} from '../data';
import { cpuPA, judge, resolve, type Bases, type BattedBall, type Outcome, type Play, type Swing } from '../play';
import type { Kid, Look } from '../gfx/kid';
import { Park, BASES, ORDER, ballAt, rnd, type XYH } from '../game/park';
import { Batting } from '../game/batting';
import { Fielding, type FieldButtons } from '../game/fielding';
import { Joystick, LookPad } from '../input';
import { div, h, btn, pad, show, banner, pill, confetti } from '../ui';
import { sfx } from '../sfx';

type Mode = 'game' | 'scrimmage';
const runFps = (speed: number) => 12 + speed / 6;

export function gameScreen(arg?: unknown): Screen {
  const mode: Mode = arg === 'scrimmage' ? 'scrimmage' : 'game';
  const prof = getProfile();
  const lv = levelOf(prof);
  const sk = () => skillsOf(prof);
  const my = leagueOf(prof.league);
  const others = LEAGUES.filter((l) => l.id !== my.id);
  // A scrimmage is against your own teammates, split in two.
  const opp = mode === 'scrimmage' ? { ...my, abbr: 'GRY', name: 'Gray Team', color: 0x868e96, dark: 0x495057 } : others[Math.floor(Math.random() * others.length)];
  const myUni = uniformOf(my);
  const oppUni = uniformOf(opp);
  const myLook: Look = prof.look;
  const mates = teamKids(my, 9).filter((_, i) => i !== 0);
  const oppKids = teamKids(opp, 9);
  const innings = mode === 'scrimmage' ? 3 : lv.innings;
  const myPos = prof.position;

  const park = new Park(lv, opp.abbr, my.abbr);
  const ui = div('screen game');
  const joy = new Joystick();
  const look = new LookPad(ui, () => clock.now);

  // ---------- HUD ----------
  const scoreYou = h('span', 'sc-r', '0');
  const scoreOpp = h('span', 'sc-r', '0');
  const innEl = div('sc-inn');
  const outsEl = div('sc-outs');
  const countEl = div('sc-count');
  const diamond = div('sc-bases', div('b b2'), div('b b3'), div('b b1'));
  const board = div(
    'scoreboard',
    div('sc-teams', div('sc-row', h('span', 'sc-chip', my.abbr), scoreYou), div('sc-row', h('span', 'sc-chip', opp.abbr), scoreOpp)),
    div('sc-mid', innEl, outsEl),
    diamond,
    countEl,
  );
  (board.querySelectorAll('.sc-chip')[0] as HTMLElement).style.background = `#${my.color.toString(16).padStart(6, '0')}`;
  (board.querySelectorAll('.sc-chip')[1] as HTMLElement).style.background = `#${opp.color.toString(16).padStart(6, '0')}`;
  const ticker = div('ticker');
  const msg = div('msg');

  let swingMode: Swing = 'contact';
  const modeBtns = (['power', 'contact', 'bunt'] as Swing[]).map((m) => {
    const b = pad(m.toUpperCase(), () => {
      swingMode = m;
      sfx.tap();
      modeBtns.forEach((x) => x.classList.toggle('on', x === b));
    }, `mode mode-${m}`);
    return b;
  });
  modeBtns[1].classList.add('on');
  if (lv.tee) show(modeBtns[2], false);
  const swingBtn = pad('SWING!', () => batting.swing(swingMode), 'big swing');
  const batCtl = div('ctl bat-ctl', div('modes', ...modeBtns), swingBtn);

  const fieldBtn = pad('FIELD', () => fielding.field(), 'big field');
  const diveBtn = pad('DIVE', () => fielding.dive(), 'mid dive');
  const throwBtn = pad('THROW TO 1ST', () => fielding.throwNow(), 'big throw');
  const fieldCtl = div('ctl field-ctl', diveBtn, fieldBtn, throwBtn);
  let pitchGo: (() => void) | null = null;
  const pitchBtn = pad('PITCH', () => pitchGo?.(), 'big pitch');
  const stickWrap = div('stick-wrap', joy.el);

  let ff = false;
  const ffBtn = btn('▶▶', () => {
    ff = !ff;
    ffBtn.classList.toggle('on', ff);
    if (watching) clock.scale = ff ? 3 : 1;
  }, 'round ff');
  const quitBtn = btn('✕', () => show(quitCard, true), 'round quit');
  const quitCard = div(
    'modal hidden',
    div('card', h('h2', '', 'Leave the game?'), h('p', '', "It won't count, and you won't get paid."), div('row', btn('KEEP PLAYING', () => show(quitCard, false), 'green'), btn('LEAVE', () => go('hub'), 'red'))),
  );
  ui.append(board, div('top-right', ffBtn, quitBtn), ticker, msg, batCtl, fieldCtl, pitchBtn, stickWrap, quitCard);

  let watching = true;
  type HudMode = 'watch' | 'bat' | 'field';
  const hudMode = (m: HudMode) => {
    watching = m === 'watch';
    show(batCtl, m === 'bat');
    show(fieldCtl, m === 'field');
    show(stickWrap, m === 'field');
    show(pitchBtn, false);
    show(countEl, m === 'bat' && !lv.tee);
    clock.scale = watching && ff ? 3 : 1;
  };
  const fieldButtons = (s: FieldButtons) => {
    show(fieldBtn, s === 'field');
    show(diveBtn, s === 'field');
    show(throwBtn, s === 'throw' || s === 'throwIn' || s === 'step');
    throwBtn.textContent = s === 'throwIn' ? 'THROW IT IN' : s === 'step' ? 'STEP ON 1ST' : 'THROW TO 1ST';
  };
  const say = (text: string, sub = '', color = '#ffd23f') => banner(msg, text, sub, color);
  const tick = (text: string) => {
    ticker.textContent = text;
  };

  const batting = new Batting(park, lv, sk, { banner: say, count: (b, s) => (countEl.innerHTML = `<b>${b}</b> BALLS &nbsp; <b>${s}</b> STRIKES`) }, kitOf(prof).bat, kitOf(prof).glove, myLook.skin);
  const fielding = new Fielding(park, lv, sk, { banner: say, buttons: fieldButtons }, joy, look, kitOf(prof).glove);

  // ---------- game state ----------
  const score = { you: 0, opp: 0 };
  let inning = 1;
  let top = true;
  let outs = 0;
  let bases: Bases = [false, false, false];
  let lineup = 0;
  let oppLineup = 0;
  const stats = { pa: 0, ab: 0, hits: 0, hr: 0, rbi: 0, plays: 0, throwOuts: 0, dives: 0 };
  let over = false;

  const drawBoard = () => {
    scoreYou.textContent = String(score.you);
    scoreOpp.textContent = String(score.opp);
    innEl.textContent = `${top ? '▲' : '▼'} ${inning}`;
    outsEl.innerHTML = [0, 1, 2].map((i) => `<i class="${i < outs ? 'on' : ''}"></i>`).join('');
    diamond.querySelectorAll('.b').forEach((e) => {
      const n = Number((e as HTMLElement).className.match(/b(\d)/)![1]);
      e.classList.toggle('on', bases[n - 1]);
    });
  };

  // ---------- plays ----------

  // Who runs where, given the result. Lead runners score first.
  function planRunners(batter: Kid | null, o: Outcome) {
    const list: { kid: Kid; from: number }[] = [];
    const outKids: Kid[] = [];
    for (const i of [2, 1, 0]) {
      const k = park.runners[i];
      if (!k) continue;
      if (o.outRunner === i) outKids.push(k);
      else list.push({ kid: k, from: i + 1 });
    }
    if (batter) {
      if (o.batter === 'out') outKids.push(batter);
      else list.push({ kid: batter, from: 0 });
    }
    // On the third out, nobody needs to move.
    if (o.outs >= 3) return { plans: [], outKids: [...outKids, ...list.map((r) => r.kid)], next: [null, null, null] as (Kid | null)[] };
    let runs = o.runs;
    const open = [3, 2, 1].filter((b) => o.bases[b - 1]);
    const next: (Kid | null)[] = [null, null, null];
    const plans: { kid: Kid; from: number; to: number }[] = [];
    for (const r of list) {
      if (runs > 0) {
        plans.push({ kid: r.kid, from: r.from, to: 4 });
        runs--;
        continue;
      }
      const t = open.find((b) => b >= Math.max(1, r.from) && !next[b - 1]);
      if (t) {
        next[t - 1] = r.kid;
        plans.push({ kid: r.kid, from: r.from, to: t });
      } else outKids.push(r.kid);
    }
    return { plans, outKids, next };
  }

  async function moveRunners(batter: Kid | null, o: Outcome, speed: number) {
    const { plans, outKids, next } = planRunners(batter, o);
    const runs: Promise<void>[] = plans.map(async (p) => {
      await park.runBases(p.kid, Math.max(p.from, 0), p.to, speed);
      if (p.to === 4) {
        p.kid.pose('cheer', 0.2);
        await clock.wait(0.5);
        park.remove(p.kid);
      }
    });
    for (const k of outKids) {
      k.pose('sad');
      void clock.wait(0.9).then(() => park.remove(k));
    }
    park.runners = next;
    await Promise.all(runs);
  }

  // Animate a play the computer decided: the ball, the fielder, and the throw.
  async function showPlay(b: BattedBall, play: Play, h0: number) {
    const f = play.who ? park.fielders.get(play.who as Pos) : undefined;
    if (play.res === 'HR') {
      await park.flyBall(b, b.time + 0.5, h0);
      park.setBall(null);
      return;
    }
    const cover = park.fielders.get('1B');
    if (b.grounder && play.res === 'OUT' && cover && play.who !== '1B') void park.runTo(cover, BASES[1], 16);
    if (play.res === 'OUT' || play.error) {
      const at = play.at!;
      const t = play.t ?? b.time;
      if (f) void park.runTo(f, at, Math.max(6, Math.hypot(at.x - f.fx, at.y - f.fy) / Math.max(0.3, t)));
      await park.flyBall(b, t, h0);
      if (play.error) {
        say('ERROR!', 'The ball got away', '#ffffff');
        await park.flyBall({ ...b, dist: b.dist + 12, time: b.time + 0.5 }, 0.5, h0);
        park.setBall(null);
        return;
      }
      park.setBall(null);
      if (f) f.pose('ready');
      if (b.grounder && f) {
        const from: XYH = { x: f.fx, y: f.fy, h: 3 };
        if (play.who === '1B') await park.runTo(f, BASES[1], 14);
        else await park.throwBall(from, { ...BASES[1], h: 3 }, 60, f);
        park.setBall(null);
      }
      return;
    }
    // A hit: the ball lands, and an outfielder chases it down.
    const rest = ballAt(b, b.time + 1.8, h0);
    if (f) void park.runTo(f, rest, 15);
    await park.flyBall(b, b.time + 1.2, h0);
    park.setBall(null);
  }

  // Throw a pitch to a computer batter and show the swing.
  async function cpuPitch(pitcher: Kid | null, from: XYH, batter: Kid, kind: 'K' | 'BB' | 'inplay') {
    if (pitcher) {
      pitcher.face(-pitcher.fx, -pitcher.fy);
      await clock.tween(0.5, (k) => pitcher.pose('throw', k * 0.5));
      void clock.tween(0.2, (k) => pitcher.pose('throw', 0.5 + k * 0.5)).then(() => pitcher.pose('stand'));
    } else await clock.wait(0.3);
    const v = lv.tee ? 26 : rnd(lv.pitch[0], lv.pitch[1]);
    const T = from.y / v;
    const tx = kind === 'BB' ? 1.6 : rnd(-0.5, 0.5);
    let swung = false;
    await clock.tween(T, (k) => {
      park.setBall({ x: from.x + (tx - from.x) * k, y: from.y * (1 - k), h: from.h + (lv.ft * 0.5 - from.h) * k + 2.4 * k * (1 - k) });
      if (!swung && kind !== 'BB' && k > 0.82) {
        swung = true;
        void clock.tween(0.22, (s) => batter.pose('swing', s));
      }
    });
    if (kind === 'inplay') sfx.crack(false);
    else {
      sfx.thud();
      park.setBall(null);
    }
  }

  function applyOutcome(o: Outcome, batting: 'you' | 'opp') {
    score[batting] += o.runs;
    outs = o.outs;
    bases = o.bases;
    drawBoard();
  }

  // ---------- your team bats ----------
  async function offense() {
    top = true;
    outs = 0;
    bases = [false, false, false];
    park.runners.forEach((k) => park.remove(k));
    park.runners = [null, null, null];
    drawBoard();
    park.setDefense(oppUni, oppKids);
    park.clearExtras();
    const pitcher = lv.tee ? park.coach(myUni) : park.pitcher;
    let runsThisHalf = 0;
    say(`TOP OF THE ${ordinal(inning)}`, `${my.name} batting`, '#ffffff');
    await clock.wait(1.2);
    while (outs < 3 && !over) {
      if (lv.runLimit && runsThisHalf >= lv.runLimit) {
        say(`${lv.runLimit} RUN LIMIT`, 'Switch sides!', '#ffffff');
        await clock.wait(1.5);
        break;
      }
      const slot = lineup % 9;
      lineup++;
      const before = score.you;
      if (slot === 0) await yourPA(pitcher);
      else await matePA(slot, pitcher);
      runsThisHalf += score.you - before;
      park.resetFielders();
      await clock.wait(0.5);
    }
    park.setBatter(null);
  }

  async function yourPA(pitcher: Kid | null) {
    hudMode('bat');
    park.setBatter(null);
    tick(`${displayName(prof).toUpperCase()} IS UP!`);
    stats.pa++;
    const r = await batting.atBat(pitcher, { model: 'game', speed: () => rnd(lv.pitch[0], lv.pitch[1]), strikeRate: lv.tee ? 0.92 : 0.6, cpu: lv.cpu }, lv.tee);
    batting.leave();
    hudMode('watch');
    park.snapTv();
    const me = park.kid(myLook, myUni, kitOf(prof));
    me.setField(-2.6, 0.2);
    if (r.kind === 'K') {
      stats.ab++;
      park.remove(me);
      applyOutcome(resolve('K', null, bases, outs), 'you');
      await clock.wait(1);
      return;
    }
    if (r.kind === 'BB') {
      const o = resolve('BB', null, bases, outs);
      await moveRunners(me, o, runFps(sk().speed));
      applyOutcome(o, 'you');
      return;
    }
    stats.ab++;
    const play = judge(r.b, lv.def, sk().speed);
    const o = outcomeOf(r.b, play, r.swing);
    if (play.res === 'HR') {
      sfx.cheer(2.6);
      park.fireworks(5);
    }
    const before = score.you;
    await Promise.all([showPlay(r.b, play, lv.ft * 0.5), clock.wait(0.25).then(() => moveRunners(me, o, runFps(sk().speed)))]);
    applyOutcome(o, 'you');
    stats.rbi += score.you - before;
    if (o.hit) stats.hits++;
    if (play.res === 'HR') stats.hr++;
    say(o.label, play.res === 'HR' ? 'WAY TO GO!' : o.runs ? `${o.runs} run${o.runs > 1 ? 's' : ''} scored!` : '', o.hit ? '#ffd23f' : '#ffffff');
    if (o.hit) sfx.cheer(1.5);
    else sfx.aww();
    await clock.wait(1.2);
  }

  async function matePA(slot: number, pitcher: Kid | null) {
    hudMode('watch');
    park.snapTv();
    const mate = mates[(slot - 1) % mates.length];
    tick(`${mate.name.toUpperCase()} BATTING`);
    const k = park.setBatter(mate.look, myUni)!;
    const pa = cpuPA(lv, lv.cpu, lv.cpu);
    const from = pitcher ? { x: pitcher.fx - 0.8, y: pitcher.fy - 2, h: pitcher.heightFt } : { x: 0, y: lv.pitchDist, h: 4 };
    await cpuPitch(pitcher, from, k, pa.kind);
    park.batter = null;
    await afterCpuPitch(pa, k, 'you');
  }

  function outcomeOf(b: BattedBall, play: Play, swing: Swing) {
    if (play.error) return resolve('E', b, bases, outs);
    const dp = play.res === 'OUT' && b.grounder && !!play.throwOut && bases[0] && outs < 2 && Math.random() < 0.35;
    return resolve(play.res, b, bases, outs, { dp, bunt: swing === 'bunt' });
  }

  async function afterCpuPitch(pa: ReturnType<typeof cpuPA>, k: Kid, side: 'you' | 'opp') {
    if (pa.kind === 'K') {
      say('STRIKEOUT!', '', '#ff8787');
      k.pose('sad');
      await clock.wait(0.9);
      park.remove(k);
      applyOutcome(resolve('K', null, bases, outs), side);
      return;
    }
    if (pa.kind === 'BB') {
      say('WALK', '', '#9ad7ff');
      const o = resolve('BB', null, bases, outs);
      await moveRunners(k, o, runFps(lv.cpu));
      applyOutcome(o, side);
      return;
    }
    const play = judge(pa.b, lv.def, lv.cpu, side === 'opp' ? myPos : undefined);
    const o = outcomeOf(pa.b, play, pa.swing);
    if (play.res === 'HR') {
      sfx.cheer(2);
      if (side === 'you') park.fireworks(3);
    }
    await Promise.all([showPlay(pa.b, play, lv.ft * 0.5), clock.wait(0.25).then(() => moveRunners(k, o, runFps(lv.cpu)))]);
    applyOutcome(o, side);
    say(o.label, o.runs ? `${o.runs} run${o.runs > 1 ? 's' : ''} scored` : '', side === 'you' && o.hit ? '#ffd23f' : '#ffffff');
    await clock.wait(1.1);
  }

  // ---------- the other team bats, you play the field ----------
  async function defense() {
    top = false;
    outs = 0;
    bases = [false, false, false];
    park.runners.forEach((k) => park.remove(k));
    park.runners = [null, null, null];
    drawBoard();
    const assigned = ORDER.map((pos, i) => (pos === myPos ? { look: myLook } : mates[i % mates.length]));
    park.setDefense(myUni, assigned, myPos);
    park.clearExtras();
    const coach = lv.tee ? park.coach(oppUni) : null;
    const pitcher = coach ?? park.pitcher;
    fielding.enter(myPos);
    hudMode('field');
    fieldButtons('none');
    let runsThisHalf = 0;
    say(`BOTTOM OF THE ${ordinal(inning)}`, `You're playing ${POSITIONS.find((p) => p.id === myPos)!.name}!`, '#ffffff');
    await clock.wait(1.4);
    while (outs < 3 && !over) {
      if (lv.runLimit && runsThisHalf >= lv.runLimit) {
        say(`${lv.runLimit} RUN LIMIT`, 'Switch sides!', '#ffffff');
        await clock.wait(1.5);
        break;
      }
      // The home team wins as soon as it takes the lead in the last inning.
      if (inning >= innings && score.opp > score.you) break;
      const kid = oppKids[oppLineup % 9];
      oppLineup++;
      tick(`${kid.name.toUpperCase()} BATTING`);
      const before = score.opp;
      await oppPA(kid, pitcher);
      runsThisHalf += score.opp - before;
      if (!over) {
        park.resetFielders();
        fielding.enter(myPos);
        fieldButtons('none');
        await clock.wait(0.6);
      }
    }
    fielding.leave();
    park.setBatter(null);
  }

  async function oppPA(kid: { look: Look }, pitcher: Kid | null) {
    const k = park.setBatter(kid.look, oppUni)!;
    fielding.focus = { x: 0, y: 0, h: 2 };
    const youPitch = myPos === 'P' && !lv.tee;
    let from: XYH;
    if (youPitch) {
      show(pitchBtn, true);
      await new Promise<void>((r) => (pitchGo = r));
      pitchGo = null;
      show(pitchBtn, false);
      from = { x: fielding.x - 0.6, y: fielding.y - 1, h: lv.ft };
    } else {
      await clock.wait(0.8);
      from = pitcher ? { x: pitcher.fx - 0.8, y: pitcher.fy - 2, h: pitcher.heightFt } : { x: 0, y: lv.pitchDist, h: 4 };
    }
    const pitchRating = youPitch ? lv.cpu + (sk().arm - 40) * 0.6 : lv.cpu;
    const pa = cpuPA(lv, lv.cpu, pitchRating);
    await cpuPitch(youPitch ? null : pitcher, from, k, pa.kind);
    park.batter = null;
    if (pa.kind !== 'inplay') {
      if (youPitch && pa.kind === 'K') stats.plays++;
      await afterCpuPitch(pa, k, 'opp');
      return;
    }
    const auto = judge(pa.b, lv.def, lv.cpu);
    if (auto.who !== myPos || auto.res === 'HR') {
      // Someone else's ball. Watch it, and the camera follows the ball.
      await afterCpuPitch(pa, k, 'opp');
      return;
    }
    // It's coming to you!
    say('HERE IT COMES!', '', '#ffd23f');
    void park.runTo(k, BASES[1], runFps(lv.cpu), 'stand');
    const fr = await fielding.play(pa.b, lv.cpu, lv.ft * 0.5);
    let o: Outcome;
    if (fr.kind === 'catch' || fr.kind === 'out') {
      stats.plays++;
      if (fr.kind === 'out') {
        stats.throwOuts++;
        say('OUT AT FIRST!', 'Great throw!', '#69db7c');
        sfx.cheer(1.2);
      } else sfx.cheer(1.4);
      o = resolve('OUT', pa.b, bases, outs);
    } else {
      say(fr.label, '', '#ffffff');
      o = resolve(fr.res, pa.b, bases, outs);
    }
    hudMode('field');
    await moveRunners(k, o, runFps(lv.cpu));
    applyOutcome(o, 'opp');
    await clock.wait(0.8);
  }

  // ---------- the whole game ----------
  async function run() {
    drawBoard();
    hudMode('watch');
    park.snapTv();
    say(mode === 'scrimmage' ? 'SCRIMMAGE!' : 'PLAY BALL!', `${my.name} vs ${opp.name}`, '#ffd23f');
    sfx.fanfare();
    await clock.wait(2);
    for (inning = 1; inning <= innings && !over; inning++) {
      await offense();
      drawBoard();
      if (inning === innings && score.opp > score.you) break;
      await defense();
    }
    inning = Math.min(inning, innings);
    finish();
  }

  function finish() {
    over = true;
    hudMode('watch');
    show(batCtl, false);
    const result: 'W' | 'L' | 'T' = score.you > score.opp ? 'W' : score.you < score.opp ? 'L' : 'T';
    const p: Profile = getProfile();
    let cash = 15 + stats.hits * 5 + stats.hr * 15 + stats.plays * 5 + (result === 'W' ? 20 : result === 'T' ? 10 : 0);
    let tokens = 1 + stats.hr + (result === 'W' ? 1 : 0);
    const up: SkillId[] = [];
    if (stats.hr) up.push('power');
    if (stats.hits) up.push('contact');
    if (stats.plays) up.push('fielding');
    if (stats.throwOuts) up.push('arm');
    up.push('speed', 'contact', 'fielding');
    const gains = [...new Set(up)].slice(0, 2);
    let moved = false;
    if (mode === 'scrimmage') {
      cash = Math.round(cash / 2);
      tokens = 0;
      p.practices++;
      gains.splice(1);
    } else {
      moved = finishGame(p, result, stats.ab >= 2 && stats.hr === stats.ab);
    }
    gains.forEach((g) => bump(p, g));
    p.money += cash;
    p.tokens += tokens;
    p.atBats += stats.ab;
    p.hits += stats.hits;
    p.homers += stats.hr;
    p.day++;
    p.noBaseball = false;
    saveProfile(p);

    const title = mode === 'scrimmage' ? 'SCRIMMAGE OVER' : result === 'W' ? 'YOU WIN!' : result === 'L' ? 'TOUGH LOSS' : 'IT’S A TIE!';
    const card = div(
      'modal',
      div(
        'card results',
        h('h1', result === 'W' ? 'gold' : '', title),
        h('p', 'final', `${my.abbr} ${score.you}  –  ${score.opp} ${opp.abbr}`),
        h('p', '', `You went ${stats.hits} for ${stats.ab}${stats.hr ? ` with ${stats.hr} home run${stats.hr > 1 ? 's' : ''}` : ''}${stats.rbi ? `, ${stats.rbi} RBI` : ''}. ${stats.plays ? `${stats.plays} play${stats.plays > 1 ? 's' : ''} in the field.` : ''}`),
        div('row', pill('cash', `+${cash}`), tokens ? pill('token', `+${tokens}`) : null),
        h('p', 'gains', gains.map((g) => `${g[0].toUpperCase()}${g.slice(1)} +1`).join('   ')),
        moved ? h('h2', 'gold', `YOU MOVED UP TO ${levelOf(p).name.toUpperCase()}!`) : mode === 'game' ? h('p', '', `${p.gamesAtLevel} of 10 games at ${levelOf(p).name}`) : null,
        btn('BACK HOME', () => go('hub'), 'green big-btn'),
      ),
    );
    ui.appendChild(card);
    if (result === 'W' || moved) {
      sfx.fanfare();
      confetti(ui);
    }
  }

  void run();

  return {
    scene: park.scene,
    camera: park.camera,
    ui,
    update(dt) {
      if (fielding.active) {
        // Between plays, the camera follows whatever the ball is doing.
        if (park.ball.visible && !fielding.busy) fielding.focus = park.ballPos();
        fielding.update(dt);
      }
      else if (watching || over) park.tvCam(dt);
    },
  };
}

function ordinal(n: number) {
  return `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'}`;
}

register('game', gameScreen);

