import Phaser from 'phaser';
import '@fontsource/luckiest-guy';
import '@fontsource/fredoka/600.css';
import { W, H, ZOOM } from './ui';
import { unlockAudio } from './sfx';
import { BootScene } from './scenes/Boot';
import { SetupScene } from './scenes/Setup';
import { HubScene } from './scenes/Hub';
import { TBallScene } from './scenes/TBall';
import { QuestScene } from './scenes/Quest';

// iPad Safari only allows sound after the first touch.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('touchend', unlockAudio, { once: true });

async function start() {
  // Phaser draws text into canvases, so wait for the fonts (but never hang on them).
  await Promise.race([
    Promise.all([document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('600 20px Fredoka')]).catch(() => {}),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const game = new Phaser.Game({
    // ?canvas forces the 2D canvas renderer, for browsers without a GPU.
    type: new URLSearchParams(location.search).has('canvas') ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: W * ZOOM,
    height: H * ZOOM,
    backgroundColor: '#1b3a6b',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [BootScene, SetupScene, HubScene, TBallScene, QuestScene],
  });
  // Handy for poking at the game from the browser console while developing.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
