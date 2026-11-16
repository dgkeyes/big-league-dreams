import Phaser from 'phaser';
import { W, H, setupCamera, goto, Btn, txt, INK } from '../ui';
import { drawField } from '../field';
import { makeKid } from '../figures';
import { LEAGUES, Gender, LeagueId, loadProfile, saveProfile, lookFor, leagueOf } from '../data';

// Make your player: boy or girl, and one of the four Portland leagues.
export class SetupScene extends Phaser.Scene {
  private gender: Gender = 'boy';
  private league: LeagueId | null = null;
  private kid?: Phaser.GameObjects.Container;
  private leagueText!: Phaser.GameObjects.Text;
  private genderBtns: Record<Gender, Btn> = {} as Record<Gender, Btn>;
  private leagueBtns: Btn[] = [];
  private play!: Btn;

  constructor() {
    super('setup');
  }

  create() {
    setupCamera(this);
    const prev = loadProfile();
    this.gender = prev?.gender ?? 'boy';
    this.league = prev?.league ?? null;
    this.kid = undefined;
    this.leagueBtns = [];

    drawField(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b1630, 0.45);
    const title = txt(this, W / 2, 78, 'BIG LEAGUE DREAMS', 78, { color: '#ffd23f', strokeThickness: 14 });
    this.tweens.add({ targets: title, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, W / 2, 140, 'Make your player and pick your Portland league', 26, { body: true });

    // preview card
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.3).fillRoundedRect(110, 200, 380, 540, 34);
    card.fillStyle(0xfff8e7).fillRoundedRect(110, 190, 380, 540, 34);
    card.lineStyle(6, 0x1b2a4a).strokeRoundedRect(110, 190, 380, 540, 34);
    txt(this, 300, 236, 'YOU!', 40, { color: '#ffd23f' });
    this.add.ellipse(300, 596, 220, 44, 0x45a849);
    this.leagueText = txt(this, 300, 640, '', 28, { color: INK, strokeThickness: 0, wrap: 340 });
    txt(this, 300, 690, 'Age 5  ·  T-Ball', 24, { body: true, color: '#5b6b88' });

    // 1. boy or girl
    txt(this, 820, 200, '1. Who are you?', 30);
    this.genderBtns.boy = new Btn(this, 705, 262, 210, 76, 'BOY', 0x3b82d6, () => this.setGender('boy'), 32);
    this.genderBtns.girl = new Btn(this, 935, 262, 210, 76, 'GIRL', 0xe2457a, () => this.setGender('girl'), 32);

    // 2. league
    txt(this, 820, 352, '2. Pick your league', 30);
    LEAGUES.forEach((l, i) => {
      const b = new Btn(this, 820, 414 + i * 78, 440, 64, l.name.toUpperCase(), l.color, () => this.setLeague(l.id), 26);
      this.leagueBtns.push(b);
    });

    this.play = new Btn(this, 820, 770, 360, 84, 'PLAY BALL!', 0x2fa84f, () => this.start(), 40);
    this.refresh();
  }

  private setGender(g: Gender) {
    this.gender = g;
    this.refresh(true);
  }

  private setLeague(id: LeagueId) {
    this.league = id;
    this.refresh(true);
  }

  private refresh(bounce = false) {
    this.genderBtns.boy.setSelected(this.gender === 'boy');
    this.genderBtns.girl.setSelected(this.gender === 'girl');
    LEAGUES.forEach((l, i) => this.leagueBtns[i].setSelected(l.id === this.league));
    this.play.setEnabled(this.league !== null);

    this.kid?.destroy();
    // Before a league is picked the player wears a plain gray practice shirt.
    const look = lookFor(this.gender, this.league ?? 'npdx');
    if (!this.league) {
      look.jersey = 0xadb5bd;
      look.cap = 0x6c757d;
    }
    this.kid = makeKid(this, look).setPosition(300, 600).setScale(3.1);
    if (bounce) this.tweens.add({ targets: this.kid, y: 570, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    this.leagueText.setText(this.league ? leagueOf(this.league).name : 'Pick a league!');
  }

  private start() {
    if (!this.league) return;
    const prev = loadProfile();
    saveProfile({
      gender: this.gender,
      league: this.league,
      tokens: prev?.tokens ?? 0,
      questDone: prev?.questDone ?? false,
      atBats: prev?.atBats ?? 0,
    });
    goto(this, 'hub');
  }
}
