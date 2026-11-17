// The home-run quest: hit 5 home runs off Rocket Rosie in 15 pitches to earn 10 tokens.
import { register, go, type Screen } from '../app';
import { clock } from '../clock';
import { getProfile, saveProfile, levelOf, skillsOf, kitOf, teamKids, LEAGUES, ROSIE, ROSIE_LOOK, ROSIE_UNI } from '../data';
import { judge, fenceR, type Swing } from '../play';
import { Park, rnd } from '../game/park';
import { Batting } from '../game/batting';
import { div, h, btn, pad, show, banner, pill, confetti } from '../ui';
import { sfx } from '../sfx';

const GOAL = 5;
const PITCHES = 15;
const REWARD = 10;
const REPLAY_REWARD = 2;

export function questScreen(): Screen {
  const prof = getProfile();
  const lv = levelOf(prof);
  const park = new Park(lv, 'ROSIE', 'YOU');
  const gray = { jersey: 0x9aa5b1, cap: 0x495057, pants: 0xe9ecef, socks: 0x495057 };
  park.setDefense(gray, teamKids(LEAGUES[2], 9));
  park.remove(park.pitcher);
  park.fielders.delete('P');
  // Rosie is always a year older and a little taller than you.
  const rosie = park.kid({ ...ROSIE_LOOK }, ROSIE_UNI, {}, lv.ft + 0.4);
  rosie.setField(0, 44);
  rosie.face(0, -1);

  const ui = div('screen quest');
  const msg = div('msg');
  const say = (t: string, s = '', c = '#ffd23f') => banner(msg, t, s, c);
  const slots = div('hr-slots', ...Array.from({ length: GOAL }, () => div('hr-slot')));
  const left = h('span', '', String(PITCHES));
  const info = div('quest-info', h('div', 'q-title', `${ROSIE.name.toUpperCase()}`), slots, div('q-left', 'Pitches left: ', left));
  let swingMode: Swing = 'power';
  const modeBtns = (['power', 'contact'] as Swing[]).map((m) => {
    const b = pad(m.toUpperCase(), () => {
      swingMode = m;
      modeBtns.forEach((x) => x.classList.toggle('on', x === b));
    }, `mode mode-${m}`);
    return b;
  });
  modeBtns[0].classList.add('on');
  const swingBtn = pad('SWING!', () => batting.swing(swingMode), 'big swing');
  const ctl = div('ctl bat-ctl', div('modes', ...modeBtns), swingBtn);
  ui.append(info, div('top-right', btn('✕', () => go('hub'), 'round quit')), msg, ctl);

  const batting = new Batting(park, lv, () => skillsOf(prof), { banner: say, count: () => {} }, kitOf(prof).bat, kitOf(prof).glove, prof.look.skin);
  let homers = 0;
  let pitches = PITCHES;
  let watching = false;

  async function run() {
    batting.enter(false);
    show(ctl, false);
    say('HOME RUN QUEST', `Hit ${GOAL} homers off ${ROSIE.name}!`, '#ffd23f');
    await clock.wait(2.4);
    show(ctl, true);
    while (pitches > 0 && homers < GOAL) {
      batting.enter(false);
      watching = false;
      await clock.wait(0.7);
      pitches--;
      left.textContent = String(pitches);
      // Rosie mixes slow floaters with her fastball, so every pitch needs watching.
      const speed = Math.random() < 0.25 ? rnd(30, 36) : rnd(42, 54);
      const r = await batting.pitch(rosie, { model: 'quest', speed: () => speed, strikeRate: 1, cpu: 50 });
      if (r.kind !== 'inplay') {
        if (r.kind === 'strike' && !r.swung) say('SWING!', 'Tap SWING when the ball gets close', '#ffffff');
        await clock.wait(0.6);
        continue;
      }
      const b = r.b;
      const homer = b.dist > fenceR(b.angle) + 2;
      batting.leave();
      show(ctl, false);
      watching = true;
      park.snapTv();
      if (Math.abs(r.err) < 1.5) say('PERFECT TIMING!', '', '#8ce99a');
      const play = homer ? null : judge(b, 50, 50);
      const f = play?.who ? park.fielders.get(play.who as never) : undefined;
      if (f && play?.at) void park.runTo(f, play.at, 15);
      await park.flyBall(b, homer ? b.time + 0.4 : play?.res === 'OUT' && play.t ? play.t : b.time + 1, lv.ft * 0.5);
      park.setBall(null);
      if (homer) {
        homers++;
        slots.children[homers - 1].classList.add('on');
        sfx.cheer(2.6);
        park.fireworks(4);
        say('HOME RUN!', `${homers} of ${GOAL}`, '#ffd23f');
        await clock.wait(1.8);
      } else {
        sfx.aww();
        if (b.grounder) say('GROUNDER', 'Get under it for a homer!', '#ffffff');
        else if (b.dist > 105) say('SO CLOSE!', play?.res === 'OUT' ? 'Caught at the wall!' : 'Off the wall!', '#ffffff');
        else say(play?.res === 'OUT' ? 'CAUGHT!' : 'BASE HIT', 'Not a homer. Keep swinging!', '#ffffff');
        await clock.wait(1.5);
      }
      park.resetFielders();
      show(ctl, true);
    }
    end();
  }

  function end() {
    batting.leave();
    show(ctl, false);
    watching = true;
    const won = homers >= GOAL;
    const p = getProfile();
    const reward = won ? (p.questDone ? REPLAY_REWARD : REWARD) : 0;
    if (won) {
      p.tokens += reward;
      p.questDone = true;
      p.skills.power = Math.min(99, p.skills.power + 1);
      saveProfile(p);
      sfx.fanfare();
      confetti(ui);
    }
    ui.appendChild(
      div(
        'modal',
        div(
          'card results',
          h('h1', won ? 'gold' : '', won ? 'QUEST COMPLETE!' : 'SO CLOSE!'),
          h('p', '', `You hit ${homers} home run${homers === 1 ? '' : 's'} off ${ROSIE.name}.`),
          won ? div('row', pill('token', `+${reward}`)) : h('p', '', `You need ${GOAL}. Try POWER, and swing right as the ball gets to you.`),
          div('row', btn('TRY AGAIN', () => go('quest'), 'blue'), btn('BACK HOME', () => go('hub'), 'green')),
        ),
      ),
    );
  }

  void run();
  return {
    scene: park.scene,
    camera: park.camera,
    ui,
    update(dt) {
      if (watching) park.tvCam(dt);
    },
  };
}

register('quest', questScreen);
