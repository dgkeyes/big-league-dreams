import Phaser from 'phaser';
import { W, H, setupCamera, goto, Btn, txt, tokenPill, INK, skillBars } from '../ui';
import { drawField } from '../field';
import { makeKid, darker } from '../figures';
import { getProfile, saveProfile, lookFor, GEAR, Gear, Slot, SKILLS, skillsOf, overall, Profile } from '../data';
import { sfx } from '../sfx';

type G = Phaser.GameObjects.Graphics;

// Small pictures of a bat, a glove, and a pair of cleats.
function drawGear(g: G, slot: Slot, color: number, x: number, y: number) {
  const out = 0x1f2433;
  g.lineStyle(3, out);
  if (slot === 'bat') {
    const pts = [
      { x: -48, y: 22 },
      { x: 30, y: -16 },
      { x: 44, y: -20 },
      { x: 48, y: -12 },
      { x: 36, y: -4 },
      { x: -44, y: 28 },
    ].map((p) => ({ x: p.x + x, y: p.y + y }));
    g.fillStyle(color).fillPoints(pts, true).strokePoints(pts, true);
    g.fillStyle(0x2b2b2b).fillCircle(x - 50, y + 27, 6);
    g.fillStyle(0xffffff, 0.45).fillRect(x - 4, y - 6, 26, 3);
  } else if (slot === 'glove') {
    g.fillStyle(color);
    for (let i = 0; i < 4; i++) {
      g.fillRoundedRect(x - 26 + i * 13, y - 34, 12, 34, 6).strokeRoundedRect(x - 26 + i * 13, y - 34, 12, 34, 6);
    }
    g.fillEllipse(x - 4, y + 6, 66, 52).strokeEllipse(x - 4, y + 6, 66, 52);
    g.fillRoundedRect(x - 46, y - 12, 18, 34, 8).strokeRoundedRect(x - 46, y - 12, 18, 34, 8);
    g.fillStyle(darker(color, 0.3)).fillEllipse(x - 2, y + 8, 30, 24);
  } else {
    for (const dx of [-26, 18]) {
      const pts = [
        { x: -14, y: -20 },
        { x: 4, y: -20 },
        { x: 8, y: 0 },
        { x: 28, y: 6 },
        { x: 28, y: 14 },
        { x: -16, y: 14 },
      ].map((p) => ({ x: p.x + x + dx, y: p.y + y }));
      g.fillStyle(color).fillPoints(pts, true).strokePoints(pts, true);
      g.fillStyle(0xffffff).fillRect(x + dx - 12, y - 4, 18, 4);
      g.fillStyle(out);
      for (let i = 0; i < 4; i++) g.fillTriangle(x + dx - 12 + i * 10, y + 14, x + dx - 6 + i * 10, y + 14, x + dx - 9 + i * 10, y + 21);
    }
  }
}

function boostText(gear: Gear) {
  return Object.entries(gear.boost)
    .map(([k, v]) => `+${v} ${SKILLS.find((s) => s.id === k)!.name}`)
    .join('  ');
}

// Rose City Sports: spend the money you earn in games on gear that boosts your skills.
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('shop');
  }

  create(data: { noFade?: boolean }) {
    setupCamera(this, !data?.noFade);
    const prof = getProfile();
    drawField(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b1630, 0.55);
    txt(this, 610, 56, 'ROSE CITY SPORTS', 54, { color: '#ffd23f', strokeThickness: 11 });
    txt(this, 610, 108, 'Dad drove you to the shop! What do you want to get?', 24, { body: true });
    new Btn(this, 92, 46, 150, 58, 'DONE', 0x34495e, () => goto(this, 'hub'), 24);
    tokenPill(this, W - 112, 46, prof.tokens);
    tokenPill(this, W - 112, 112, prof.money, 'cash');

    this.drawPlayer(prof);

    const cols = [480, 735, 990];
    const rows: Slot[] = ['bat', 'glove', 'cleats'];
    rows.forEach((slot, r) => {
      GEAR.filter((g) => g.slot === slot).forEach((gear, c) => this.drawItem(prof, gear, cols[c], 255 + r * 200));
    });
    txt(this, 735, 818, 'Gear boosts your skills. Play games to earn more money!', 22, { body: true, color: '#dbe4ff' });
  }

  private drawPlayer(prof: Profile) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(28, 160, 310, 680, 30);
    g.fillStyle(0xfff8e7).fillRoundedRect(28, 150, 310, 680, 30);
    g.lineStyle(6, 0x1b2a4a).strokeRoundedRect(28, 150, 310, 680, 30);
    this.add.ellipse(183, 400, 160, 32, 0x45a849);
    makeKid(this, lookFor(prof.gender, prof.league, prof), { glove: true }).setPosition(183, 404).setScale(2.0);
    txt(this, 183, 446, `OVERALL ${overall(prof)}`, 30, { color: INK, strokeThickness: 0 });
    const sk = skillsOf(prof);
    skillBars(
      this,
      38,
      494,
      290,
      SKILLS.map((s) => ({ name: s.name, color: s.color, base: prof.skills[s.id], extra: sk[s.id] - prof.skills[s.id] })),
    );
    const worn = (['bat', 'glove', 'cleats'] as Slot[]).map((slot) => {
      const gear = GEAR.find((x) => x.id === prof.equipped[slot]);
      return `${slot === 'bat' ? 'Bat' : slot === 'glove' ? 'Glove' : 'Cleats'}: ${gear ? gear.name : 'old one'}`;
    });
    txt(this, 183, 740, worn.join('\n'), 20, { body: true, color: '#5b6b88' });
  }

  private drawItem(prof: Profile, gear: Gear, x: number, y: number) {
    const w = 240;
    const h = 185;
    const owned = prof.owned.includes(gear.id);
    const on = prof.equipped[gear.slot] === gear.id;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 8, w, h, 22);
    g.fillStyle(on ? 0xe6fcf5 : 0xfff8e7).fillRoundedRect(x - w / 2, y - h / 2, w, h, 22);
    g.lineStyle(5, on ? 0x2fa84f : 0x1b2a4a).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 22);
    drawGear(g, gear.slot, gear.color, x, y - 48);
    txt(this, x, y + 6, gear.name.toUpperCase(), gear.name.length > 14 ? 19 : 22, { color: INK, strokeThickness: 0 });
    txt(this, x, y + 34, boostText(gear), 18, { body: true, color: '#2b8a3e' });
    const afford = prof.money >= gear.price;
    let label = `BUY $${gear.price}`;
    let color = 0xf08c00;
    if (on) {
      label = 'WEARING IT';
      color = 0x2fa84f;
    } else if (owned) {
      label = 'USE IT';
      color = 0x3b82d6;
    }
    const b = new Btn(this, x, y + 68, 190, 42, label, color, () => this.choose(gear), 20);
    if (!owned && !afford) b.setEnabled(false);
  }

  private choose(gear: Gear) {
    const prof = getProfile();
    if (prof.equipped[gear.slot] === gear.id) return;
    if (!prof.owned.includes(gear.id)) {
      if (prof.money < gear.price) return;
      prof.money -= gear.price;
      prof.owned.push(gear.id);
      sfx.coin();
      sfx.fanfare();
    }
    prof.equipped[gear.slot] = gear.id;
    saveProfile(prof);
    this.scene.restart({ noFade: true });
  }
}
