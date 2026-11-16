import Phaser from 'phaser';
import { W, H, setupCamera, goto, Btn, txt, tokenPill, INK, skillBars } from '../ui';
import { drawField } from '../field';
import { makeKid } from '../figures';
import {
  getProfile,
  leagueOf,
  lookFor,
  ROSIE,
  levelOf,
  ageOf,
  gamesInLevel,
  GAMES_PER_LEVEL,
  SKILLS,
  skillsOf,
  levelIndex,
  LEVELS,
} from '../data';

// The clubhouse: your player, your money and tokens, and what to do next.
export class HubScene extends Phaser.Scene {
  constructor() {
    super('hub');
  }

  create() {
    setupCamera(this);
    const prof = getProfile();
    const league = leagueOf(prof.league);
    const lv = levelOf(prof);
    const sk = skillsOf(prof);

    drawField(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b1630, 0.4);
    txt(this, 470, 62, 'CLUBHOUSE', 64, { color: '#ffd23f', strokeThickness: 12 });
    tokenPill(this, W - 112, 46, prof.tokens);
    tokenPill(this, W - 112, 112, prof.money, 'cash');

    // player card
    const card = this.add.graphics();
    const cx = 50;
    const cw = 440;
    card.fillStyle(0x000000, 0.3).fillRoundedRect(cx, 140, cw, 690, 34);
    card.fillStyle(0xfff8e7).fillRoundedRect(cx, 130, cw, 690, 34);
    card.fillStyle(league.color).fillRoundedRect(cx, 130, cw, 74, { tl: 34, tr: 34, bl: 0, br: 0 });
    card.lineStyle(6, 0x1b2a4a).strokeRoundedRect(cx, 130, cw, 690, 34);
    txt(this, cx + cw / 2, 168, league.name.toUpperCase(), league.name.length > 15 ? 30 : 36, { strokeThickness: 7 });
    this.add.ellipse(160, 432, 170, 34, 0x45a849);
    const kid = makeKid(this, lookFor(prof.gender, prof.league, prof)).setPosition(160, 436).setScale(2.0);
    this.tweens.add({ targets: kid, scaleY: 2.06, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const info = [
      `Age ${ageOf(prof)}`,
      `Record ${prof.wins}-${prof.losses}${prof.ties ? `-${prof.ties}` : ''}`,
      `${prof.hits} hits  ·  ${prof.homers} HR`,
    ];
    txt(this, 375, 262, lv.name.toUpperCase(), 32, { color: INK, strokeThickness: 0 });
    txt(this, 375, 335, info.join('\n'), 22, { body: true, color: '#5b6b88' });
    skillBars(
      this,
      cx + 18,
      480,
      cw - 36,
      SKILLS.map((s) => ({ name: s.name, color: s.color, base: prof.skills[s.id], extra: sk[s.id] - prof.skills[s.id] })),
    );

    // progress toward moving up
    const last = levelIndex(prof) === LEVELS.length - 1;
    const done = Math.min(GAMES_PER_LEVEL, gamesInLevel(prof));
    const next = LEVELS[levelIndex(prof) + 1];
    txt(
      this,
      cx + cw / 2,
      665,
      last ? `${lv.name}: ${prof.games} career games` : `${done} of ${GAMES_PER_LEVEL} games played, then ${next.name}!`,
      22,
      { body: true, color: INK },
    );
    const bar = this.add.graphics();
    bar.fillStyle(0x1b2a4a, 0.15).fillRoundedRect(cx + 40, 690, cw - 80, 20, 10);
    bar.fillStyle(0xe2457a).fillRoundedRect(cx + 40, 690, Math.max(20, ((cw - 80) * (last ? 1 : done)) / (last ? 1 : GAMES_PER_LEVEL)), 20, 10);
    new Btn(this, cx + cw / 2, 768, 230, 54, 'EDIT PLAYER', 0x6c757d, () => goto(this, 'setup'), 22);

    // play a game
    const gb = new Btn(this, 845, 285, 600, 170, 'PLAY A GAME', 0x2fa84f, () => goto(this, 'game'), 50);
    gb.label.y = -30;
    gb.face.add(
      txt(this, 0, 34, `${lv.name}  ·  ${lv.innings} innings  ·  Game ${done + 1 > GAMES_PER_LEVEL ? done : done + 1}`, 24, {
        body: true,
        strokeThickness: 0,
      }),
    );

    // home-run quest
    const q = new Btn(this, 845, 490, 600, 150, 'HOME RUN QUEST', 0x7b3fe4, () => goto(this, 'quest'), 42);
    q.label.y = -40;
    q.face.add(txt(this, 0, 4, `Hit 5 homers off ${ROSIE.name}!`, 22, { body: true, strokeThickness: 0 }));
    const reward = this.add.container(0, 44);
    reward.add([
      this.add.image(-64, 0, 'coin').setDisplaySize(34, 34),
      txt(this, 22, 2, prof.questDone ? 'DONE!  ★' : 'EARN 10', 28, { color: '#ffe066' }),
    ]);
    q.face.add(reward);
    if (!prof.questDone) {
      this.tweens.add({ targets: reward, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // the shop
    const s = new Btn(this, 845, 680, 600, 140, 'SPORTS SHOP', 0xf08c00, () => goto(this, 'shop'), 42);
    s.label.y = -24;
    s.face.add(txt(this, 0, 28, '"Dad, can we go to the shop for new gear?"', 22, { body: true, strokeThickness: 0 }));
  }
}
