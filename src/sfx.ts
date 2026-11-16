// Tiny synthesized sound effects, so the prototype needs no audio files.
// iPad Safari only plays Web Audio after a touch, so main.ts calls unlockAudio on the first tap.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      out = ctx.createGain();
      out.gain.value = 0.7;
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const b = a.createBuffer(1, 1, 22050);
  const s = a.createBufferSource();
  s.buffer = b;
  s.connect(a.destination);
  s.start(0);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, delay = 0, freqEnd?: number) {
  const a = audio();
  if (!a || !out) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(
  dur: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  gain: number,
  attack = 0.003,
  delay = 0,
  freqEnd?: number,
) {
  const a = audio();
  if (!a || !out) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 3, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  tap() {
    tone(660, 0.08, 'triangle', 0.22);
  },
  swing() {
    noise(0.2, 'bandpass', 500, 1.2, 0.35, 0.04, 0, 2600);
  },
  crack(big = false) {
    noise(0.1, 'highpass', 1800, 0.7, 0.9);
    tone(big ? 2300 : 1700, 0.05, 'square', 0.12);
    tone(160, 0.14, 'sine', 0.5, 0, 60);
  },
  whiff() {
    noise(0.28, 'bandpass', 350, 1, 0.35, 0.06, 0, 1400);
  },
  thud() {
    tone(130, 0.12, 'sine', 0.45, 0, 70);
    noise(0.06, 'lowpass', 700, 1, 0.4);
  },
  cheer(len = 2.4) {
    noise(len, 'bandpass', 1100, 0.5, 0.32, 0.25);
    noise(len * 0.8, 'bandpass', 2400, 0.9, 0.16, 0.3, 0.1);
    tone(1800, 0.35, 'sine', 0.06, 0.3, 2400);
  },
  coin() {
    tone(988, 0.08, 'square', 0.12);
    tone(1319, 0.25, 'square', 0.12, 0.08);
  },
  fanfare() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.3, i * 0.12));
    tone(1047, 0.7, 'triangle', 0.32, 0.36);
  },
  aww() {
    tone(440, 0.5, 'triangle', 0.2, 0, 330);
    tone(330, 0.7, 'triangle', 0.2, 0.3, 220);
  },
};
