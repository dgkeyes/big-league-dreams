import Phaser from 'phaser';
import { loadProfile } from '../data';

export const PARTY = [0xffd23f, 0xff6b6b, 0x74c0fc, 0x8ce99a, 0xf783ac, 0xb197fc];
export const PARTY_FRAMES = PARTY.map((_, i) => i);

// Draws the few bitmap textures the game needs, then opens setup (first visit) or the clubhouse.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    const g = this.add.graphics();

    // baseball
    g.fillStyle(0xffffff).fillCircle(32, 32, 30);
    g.lineStyle(3, 0xc9ced6).strokeCircle(32, 32, 29);
    g.lineStyle(3.5, 0xd62828);
    g.beginPath();
    g.arc(-4, 32, 26, -0.75, 0.75, false);
    g.strokePath();
    g.beginPath();
    g.arc(68, 32, 26, Math.PI - 0.75, Math.PI + 0.75, false);
    g.strokePath();
    g.generateTexture('ball', 64, 64);
    g.clear();

    // token coin with a star
    g.fillStyle(0xb8860b).fillCircle(32, 34, 30);
    g.fillStyle(0xffd23f).fillCircle(32, 31, 30);
    g.fillStyle(0xf5b700).fillCircle(32, 31, 22);
    const star: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7.5 : 17;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      star.push({ x: 32 + r * Math.cos(a), y: 32 + r * Math.sin(a) });
    }
    g.fillStyle(0xfff3b0).fillPoints(star, true);
    g.generateTexture('coin', 64, 66);
    g.clear();

    // Sparks and confetti get one frame per party color, because the Canvas renderer cannot tint.
    PARTY.forEach((c, i) => g.fillStyle(c).fillCircle(8 + i * 16, 8, 6));
    g.generateTexture('spark', 16 * PARTY.length, 16);
    g.clear();
    PARTY.forEach((c, i) => g.fillStyle(c).fillRect(i * 12, 0, 12, 7));
    g.generateTexture('confetti', 12 * PARTY.length, 7);
    g.destroy();
    PARTY.forEach((_, i) => {
      this.textures.get('spark').add(i, 0, i * 16, 0, 16, 16);
      this.textures.get('confetti').add(i, 0, i * 12, 0, 12, 7);
    });

    this.scene.start(loadProfile() ? 'hub' : 'setup');
  }
}
