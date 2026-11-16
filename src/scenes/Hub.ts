import Phaser from 'phaser';
import { W, H, setupCamera, goto, Btn, txt, tokenPill, INK } from '../ui';
import { drawField } from '../field';
import { makeKid } from '../figures';
import { getProfile, leagueOf, lookFor, ROSIE } from '../data';

// The clubhouse: your player, your tokens, and what to play next.
export class HubScene extends Phaser.Scene {
  constructor() {
    super('hub');
  }

  create() {
    setupCamera(this);
    const prof = getProfile();
    const league = leagueOf(prof.league);

    drawField(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b1630, 0.4);
    txt(this, W / 2, 62, 'CLUBHOUSE', 64, { color: '#ffd23f', strokeThickness: 12 });
    tokenPill(this, W - 112, 46, prof.tokens);

    // player card
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.3).fillRoundedRect(80, 150, 380, 580, 34);
    card.fillStyle(0xfff8e7).fillRoundedRect(80, 140, 380, 580, 34);
    card.lineStyle(6, 0x1b2a4a).strokeRoundedRect(80, 140, 380, 580, 34);
    card.fillStyle(league.color).fillRoundedRect(80, 140, 380, 86, { tl: 34, tr: 34, bl: 0, br: 0 });
    card.lineStyle(6, 0x1b2a4a).strokeRoundedRect(80, 140, 380, 580, 34);
    txt(this, 270, 184, league.name.toUpperCase(), league.name.length > 15 ? 28 : 34, { strokeThickness: 7 });
    this.add.ellipse(270, 512, 220, 44, 0x45a849);
    const kid = makeKid(this, lookFor(prof.gender, prof.league)).setPosition(270, 516).setScale(2.45);
    this.tweens.add({ targets: kid, scaleY: 2.52, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, 270, 568, 'T-BALL ROOKIE', 34, { color: INK, strokeThickness: 0 });
    txt(this, 270, 606, `Age 5  ·  Portland, Oregon  ·  ${prof.atBats} at-bats`, 19, { body: true, color: '#5b6b88' });
    new Btn(this, 270, 670, 230, 56, 'EDIT PLAYER', 0x6c757d, () => goto(this, 'setup'), 22);

    // T-ball game
    const tb = new Btn(this, 800, 270, 560, 170, 'T-BALL GAME', 0x2fa84f, () => goto(this, 'tball'), 48);
    tb.label.y = -28;
    tb.face.add(txt(this, 0, 34, 'Step up to the tee and smack it!', 24, { body: true, strokeThickness: 0 }));

    // home-run quest
    const q = new Btn(this, 800, 500, 560, 200, 'HOME RUN QUEST', 0x7b3fe4, () => goto(this, 'quest'), 48);
    q.label.y = -50;
    q.face.add(
      txt(this, 0, 8, `Hit 5 homers off ${ROSIE.name}, a pitcher\na little better than you.`, 22, {
        body: true,
        strokeThickness: 0,
      }),
    );
    const reward = this.add.container(0, 62);
    reward.add([
      this.add.image(-64, 0, 'coin').setDisplaySize(38, 38),
      txt(this, 22, 2, prof.questDone ? 'DONE!  ★' : 'EARN 10', 30, { color: '#ffe066' }),
    ]);
    q.face.add(reward);
    if (!prof.questDone) {
      this.tweens.add({ targets: reward, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    txt(this, 800, 690, 'Skill upgrades with tokens: coming soon!', 24, { body: true, color: '#dbe4ff' });
  }
}
