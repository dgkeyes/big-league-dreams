import '@fontsource/luckiest-guy';
import '@fontsource/fredoka/600.css';
import { start } from './app';
import { unlockAudio } from './sfx';
import { loadProfile } from './data';
import './screens/setup';
import './screens/hub';
import './screens/game';
import './screens/quest';
import './screens/practice';
import './screens/drive';
import './screens/store';

// iPad Safari only allows sound after the first touch.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('touchend', unlockAudio, { once: true });

async function boot() {
  // Signs and jersey numbers are drawn with the game fonts, so wait for them (but never hang).
  await Promise.race([
    Promise.all([document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('600 20px Fredoka')]).catch(() => {}),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const first = new URLSearchParams(location.search).get('screen');
  start(import.meta.env.DEV && first ? first : loadProfile() ? 'hub' : 'setup');
}

void boot();
