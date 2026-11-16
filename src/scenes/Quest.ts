import Phaser from 'phaser';
import { W, txt, Btn, Panel, goto, INK } from '../ui';
import { BattingBase } from './BattingBase';
import { project, fenceR } from '../field';
import { makeKid, Look } from '../figures';
import { saveProfile, ROSIE, ROSIE_LOOK, ageOf, overall, skillsOf } from '../data';
import { judge } from '../play';
import { sfx } from '../sfx';

const GOAL = 5;
// Tuned by simulation: steady tappers (about ±90 ms) almost always win; sloppy ones (±160 ms) win about 70% of the time.
const PITCHES = 15;
// How far (in feet) the ball can be from the plate when the bat arrives and still be hit.
const WINDOW = 7;
const REWARD = 10;
const REPLAY_REWARD = 2;

const GRAY: Look = { jersey: 0x9aa5b1, cap: 0x495057, pants: 0xe9ecef, skin: 0xe0ac69, hair: 0x3b2614, girl: false };

type Phase = 'wait' | 'windup' | 'flight' | 'gone';

// The home-run quest: hit 5 homers off Rocket Rosie before you run out of pitches.
export class QuestScene extends BattingBase {
  private homers = 0;
  private left = PITCHES;
  private phase: Phase = 'wait';
  private swung = false;
  private pitchTween?: Phaser.Tweens.Tween;
  private slots: Phaser.GameObjects.Image[] = [];
  private leftText!: Phaser.GameObjects.Text;

  constructor() {
    super('quest');
  }

  create() {
    this.buildField();
    this.homers = 0;
    this.left = PITCHES;
    this.phase = 'wait';
    this.slots = [];
    this.setDefense((id) => (id === 'P' ? ROSIE_LOOK : GRAY));
    this.setBatter(this.look);
    this.drawHud();

    this.input.off('pointerdown');
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.trySwing();
    });
    this.showIntro();
  }

  private drawHud() {
    const g = this.add.graphics().setDepth(1000);
    g.fillStyle(0x0b1630, 0.55).fillRoundedRect(W / 2 - 290, 16, 580, 64, 32);
    g.lineStyle(4, 0x7b3fe4).strokeRoundedRect(W / 2 - 290, 16, 580, 64, 32);
    txt(this, W / 2 - 205, 50, 'HOMERS', 28).setDepth(1001);
    for (let i = 0; i < GOAL; i++) {
      const x = W / 2 - 115 + i * 46;
      this.add.circle(x, 48, 18, 0xffffff, 0.18).setStrokeStyle(3, 0xffffff, 0.5).setDepth(1001);
      this.slots.push(this.add.image(x, 48, 'ball').setDisplaySize(36, 36).setDepth(1002).setVisible(false));
    }
    this.leftText = txt(this, W / 2 + 190, 50, '', 26).setDepth(1001);
    this.updateLeft();
  }

  private updateLeft() {
    this.leftText.setText(`PITCHES: ${this.left}`);
    this.leftText.setColor(this.left <= 5 ? '#ff8787' : '#ffffff');
  }

  private showIntro() {
    const you = overall(this.prof);
    const p = new Panel(this, 820, 560);
    p.add(txt(this, W / 2, 210, 'HOME RUN QUEST', 60, { color: '#ffd23f', strokeThickness: 12 }));
    p.add(this.add.ellipse(W / 2 - 250, 470, 170, 36, 0x45a849));
    p.add(makeKid(this, ROSIE_LOOK, { glove: true }).setPosition(W / 2 - 250, 474).setScale(2.3));
    p.add(txt(this, W / 2 + 90, 300, ROSIE.name.toUpperCase(), 40, { color: '#7b3fe4', strokeThickness: 0 }));
    p.add(
      txt(
        this,
        W / 2 + 90,
        352,
        `Age ${ageOf(this.prof) + ROSIE.ageBonus}  ·  Pitcher  ·  Rating ${you + ROSIE.edge}\n(You are ${you}. She's a little better!)`,
        22,
        { body: true, color: '#5b6b88' },
      ),
    );
    p.add(
      txt(
        this,
        W / 2 + 90,
        455,
        `Hit ${GOAL} home runs before you\nrun out of ${PITCHES} pitches.\nTap anywhere to swing when the\nball gets to home plate!`,
        24,
        { body: true, color: INK },
      ),
    );
    const reward = this.add.container(W / 2, 560);
    reward.add([
      this.add.image(-122, 0, 'coin').setDisplaySize(44, 44),
      txt(this, 20, 2, `EARN ${REWARD} TOKENS`, 30, { color: '#ffd23f', strokeThickness: 0 }),
    ]);
    p.add(reward);
    p.add(
      new Btn(this, W / 2, 650, 320, 80, 'PLAY BALL!', 0x2fa84f, () => {
        p.destroy();
        this.nextPitch();
      }, 36),
    );
  }

  private nextPitch() {
    if (this.homers >= GOAL) {
      void this.win();
      return;
    }
    if (this.left <= 0) {
      this.lose();
      return;
    }
    this.phase = 'wait';
    this.swung = false;
    this.time.delayedCall(700, () => this.windup());
  }

  private windup() {
    this.phase = 'windup';
    const { c, arm } = this.pitcher!;
    const y0 = c.y;
    arm.setRotation(0.15);
    this.tweens.add({ targets: c, y: y0 - 6 * c.scaleY, duration: 450, yoyo: true, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: arm,
      rotation: 3.0,
      duration: 480,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: arm,
          rotation: 5.8,
          duration: 150,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.throwPitch();
            this.tweens.add({ targets: arm, rotation: 0.15 + Math.PI * 2, delay: 300, duration: 300 });
          },
        });
      },
    });
  }

  private throwPitch() {
    this.phase = 'flight';
    this.left -= 1;
    this.updateLeft();
    // Rosie mixes slow floaters with her fastball, so every pitch needs watching.
    const speed = Math.random() < 0.25 ? Phaser.Math.Between(30, 36) : Phaser.Math.Between(42, 54);
    const s = { x: -1.2, y: 44, z: 4.5 };
    const e = { x: 0.3, y: -6, z: 2.0 };
    this.setBall(s.x, s.y, s.z);
    this.pitchTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ((s.y - e.y) / speed) * 1000,
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        this.setBall(s.x + (e.x - s.x) * u, s.y + (e.y - s.y) * u, s.z + (e.z - s.z) * u + 1.2 * 4 * u * (1 - u));
        this.ball.rotation += 0.4;
      },
      onComplete: () => {
        this.phase = 'gone';
        this.hideBall();
        sfx.thud();
        if (!this.swung) {
          this.flash('SWING!', '#ffffff', 360, 600);
          this.time.delayedCall(800, () => this.nextPitch());
        }
      },
    });
  }

  private trySwing() {
    if (this.phase === 'wait' || this.swung || !this.batter || this.batter.swinging) return;
    this.swung = true;
    sfx.swing();
    this.batter.swing(this, () => this.contact());
  }

  private window() {
    return WINDOW * (0.75 + skillsOf(this.prof).contact / 160);
  }

  private contact() {
    const err = this.phase === 'flight' ? this.bpos.y : this.phase === 'windup' ? 99 : -99;
    if (Math.abs(err) > this.window()) {
      sfx.whiff();
      this.flash(err > 0 ? 'TOO EARLY!' : 'TOO LATE!', '#ffffff', 360, 600);
      // The pitch keeps going; when it reaches the backstop the next one starts.
      if (this.phase === 'gone') this.time.delayedCall(800, () => this.nextPitch());
      return;
    }
    this.pitchTween?.stop();
    this.phase = 'gone';
    void this.hit(err);
  }

  private async hit(err: number) {
    const win = this.window();
    const power = skillsOf(this.prof).power;
    // Quality falls off gently near the sweet spot, so near-perfect swings all clear the fence.
    const q = 1 - Math.pow(Math.abs(err) / win, 2);
    // Early swings pull the ball to left field, late swings push it to right.
    const angle = Phaser.Math.Clamp((-err / win) * 0.75 + Phaser.Math.FloatBetween(-0.12, 0.12), -0.75, 0.75);
    let dist = 45 + q * (130 + (power - 40) * 0.4) + Phaser.Math.Between(-8, 8);
    const homer = dist > fenceR(angle) + 2;
    if (homer) dist += 30;
    const grounder = !homer && q < 0.35;
    const apex = homer ? 38 : grounder ? 0 : 10 + q * 26;
    const time = homer ? 1900 : (grounder ? 700 : 900) + dist * 8;
    sfx.crack(homer);
    this.cameras.main.shake(110, homer ? 0.006 : 0.003);
    if (Math.abs(err) < 1.5) this.flash('PERFECT TIMING!', '#8ce99a', 360, 600);
    else this.flash(err > 0 ? 'A LITTLE EARLY' : 'A LITTLE LATE', '#ffe066', 360, 600);

    const play = homer ? null : judge({ angle, dist, apex, grounder, time: time / 1000 }, 50, 50);
    const caught = play?.res === 'OUT';
    await this.flyBall({
      angle,
      dist,
      apex,
      time,
      grounder,
      who: play?.who === 'C' ? undefined : play?.who,
      stopAt: caught ? (grounder && play?.t ? (play.t * 1000) / time : 1) : undefined,
    });

    if (homer) {
      const slot = this.slots[this.homers];
      this.homers += 1;
      sfx.cheer(2.6);
      this.fireworks(4);
      this.banner('HOME RUN!', '#ffd23f', `${this.homers} of ${GOAL}`, 1300);
      slot.setVisible(true).setScale(0.1);
      this.tweens.add({ targets: slot, scale: 36 / 64, duration: 400, ease: 'Back.easeOut' });
      await this.wait(1500);
    } else {
      sfx.aww();
      if (grounder) this.banner('GROUNDER', '#ffffff', 'Get under it for a homer!');
      else if (dist > 105) this.banner('SO CLOSE!', '#ffffff', caught ? 'Caught at the wall!' : 'Off the wall!');
      else this.banner(caught ? 'CAUGHT!' : 'BASE HIT', '#ffffff', 'Not a homer. Keep swinging!');
      await this.wait(1400);
    }
    this.hideBall();
    this.resetFielders();
    await this.wait(500);
    this.nextPitch();
  }

  private async win() {
    const first = !this.prof.questDone;
    const earned = first ? REWARD : REPLAY_REWARD;
    const before = this.prof.tokens;
    this.prof.tokens += earned;
    this.prof.questDone = true;
    saveProfile(this.prof);
    sfx.fanfare();
    this.confettiBurst(2500);
    this.fireworks(6);
    const p = new Panel(this, 720, 440);
    p.add(txt(this, W / 2, 280, 'QUEST COMPLETE!', 64, { color: '#ffd23f', strokeThickness: 12 }));
    p.add(
      txt(
        this,
        W / 2,
        375,
        `You hit ${GOAL} homers off ${ROSIE.name}!\n${first ? `You earned ${earned} tokens!` : `Replay bonus: ${earned} tokens.`}`,
        30,
        { body: true, color: INK },
      ),
    );
    const home = project(0, 0, 3);
    await this.award(this.tokens, 'coin', earned, home.x, home.y - 200, before);
    p.add(new Btn(this, W / 2 - 160, 540, 280, 80, 'PLAY AGAIN', 0x7b3fe4, () => goto(this, 'quest'), 32));
    p.add(new Btn(this, W / 2 + 160, 540, 280, 80, 'CLUBHOUSE', 0x3b82d6, () => goto(this, 'hub'), 32));
  }

  private lose() {
    sfx.aww();
    const p = new Panel(this, 700, 420);
    p.add(txt(this, W / 2, 290, 'SO CLOSE!', 68, { color: '#ffd23f', strokeThickness: 12 }));
    p.add(
      txt(
        this,
        W / 2,
        385,
        `You hit ${this.homers} homer${this.homers === 1 ? '' : 's'}. ${ROSIE.name} is tough!\nWatch for her slow floaters.`,
        28,
        { body: true, color: INK },
      ),
    );
    p.add(new Btn(this, W / 2 - 160, 520, 280, 80, 'TRY AGAIN', 0x7b3fe4, () => goto(this, 'quest'), 32));
    p.add(new Btn(this, W / 2 + 160, 520, 280, 80, 'CLUBHOUSE', 0x3b82d6, () => goto(this, 'hub'), 32));
  }
}
