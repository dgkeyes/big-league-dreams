// Game time. Every wait and animation runs on this clock instead of timers, so the game can
// pause, fast-forward, and slow down for catches, and tests can step it by hand.

interface Job {
  start: number;
  dur: number;
  cond?: () => boolean;
  // Return false to stop early.
  step?: (k: number) => boolean | void;
  done: () => void;
}

export class Clock {
  now = 0;
  scale = 1;
  private jobs: Job[] = [];

  tick(dt: number) {
    this.now += dt * this.scale;
    const jobs = this.jobs;
    this.jobs = [];
    const keep: Job[] = [];
    for (const j of jobs) {
      if (j.cond) {
        if (j.cond()) j.done();
        else keep.push(j);
        continue;
      }
      const k = j.dur > 0 ? Math.min(1, (this.now - j.start) / j.dur) : 1;
      const go = j.step?.(k);
      if (k >= 1 || go === false) j.done();
      else keep.push(j);
    }
    this.jobs.push(...keep);
  }

  wait(sec: number) {
    return new Promise<void>((done) => this.jobs.push({ start: this.now, dur: sec, done }));
  }

  // Calls step with progress from 0 to 1 over sec seconds of game time.
  tween(sec: number, step: (k: number) => boolean | void) {
    return new Promise<void>((done) => {
      step(0);
      this.jobs.push({ start: this.now, dur: sec, step, done });
    });
  }

  until(cond: () => boolean) {
    return new Promise<void>((done) => this.jobs.push({ start: this.now, dur: 0, cond, done }));
  }

  // Drop everything waiting, when leaving a screen. Those promises never settle, so their scripts just stop.
  reset() {
    this.jobs = [];
    this.scale = 1;
  }
}

export const clock = new Clock();
