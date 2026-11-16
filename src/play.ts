// Baseball rules with no Phaser in them: batted balls, who fields them, and how runners move.
// World units are feet: home plate is (0, 0), +y points to center field, +x to right field.

export type Swing = 'contact' | 'power' | 'bunt';
export type Result = 'OUT' | '1B' | '2B' | '3B' | 'HR';
export type Bases = [boolean, boolean, boolean];

export interface Spot {
  id: string;
  x: number;
  y: number;
}

export const FIELDERS: Spot[] = [
  { id: 'LF', x: -62, y: 118 },
  { id: 'CF', x: 0, y: 135 },
  { id: 'RF', x: 62, y: 118 },
  { id: '2B', x: 22, y: 74 },
  { id: 'SS', x: -22, y: 74 },
  { id: '1B', x: 36, y: 50 },
  { id: '3B', x: -36, y: 50 },
  { id: 'P', x: 0, y: 46 },
];
export const FIRST_BASE = { x: 42.4, y: 42.4 };
export const BASE_FT = 60;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Kid-sized park: 150 ft to center, 120 ft down the lines. Theta is radians from center field.
export function fenceR(theta: number) {
  return 120 + 30 * Math.cos(2 * clamp(theta, -Math.PI / 2, Math.PI / 2));
}

export interface BattedBall {
  angle: number;
  // Fly balls: where it lands. Grounders: how far it rolls.
  dist: number;
  apex: number;
  grounder: boolean;
  // Seconds until it lands (fly) or stops rolling (grounder).
  time: number;
}

export function landing(b: BattedBall, d = b.dist) {
  return { x: d * Math.sin(b.angle), y: d * Math.cos(b.angle) };
}

// q is contact quality from 0 (barely) to 1 (perfect). Power is the batter's power skill.
export function battedBall(q: number, angle: number, swing: Swing, power: number): BattedBall {
  if (swing === 'bunt') {
    // A good bunt is soft and dies near a foul line; a bad one rolls right back to the pitcher.
    const dist = 30 - q * 14 + rnd(-3, 3);
    const side = angle === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(angle);
    const aim = side * (0.15 + q * 0.5) + rnd(-0.08, 0.08);
    return { angle: clamp(aim, -0.72, 0.72), dist, apex: 0, grounder: true, time: dist / 14 };
  }
  const mult = swing === 'power' ? 1.15 : 0.9;
  const grounder = q < 0.35 || Math.random() < (swing === 'contact' ? 0.3 : 0.15);
  if (grounder) {
    const dist = 55 + q * 80 + rnd(-10, 10);
    return { angle, dist, apex: 0, grounder, time: dist / (40 + q * 35) };
  }
  if (Math.random() < 0.18 * (1 - q)) {
    const dist = rnd(25, 70);
    return { angle, dist, apex: rnd(32, 40), grounder: false, time: 2.4 };
  }
  const dist = 25 + q * (88 + power * 0.35) * mult + rnd(-8, 8);
  const apex = clamp(6 + q * 22 + (swing === 'power' ? 6 : 0) + rnd(-4, 4), 5, 38);
  return { angle, dist, apex, grounder: false, time: 0.8 + dist * 0.009 + apex * 0.01 };
}

export interface Play {
  res: Result;
  // Who makes the play (OUT), or who chases it down (hits). Absent for homers.
  who?: string;
  // Where the fielder gets the ball, and when (seconds after contact).
  at?: { x: number; y: number };
  t?: number;
  error?: boolean;
  throwOut?: boolean;
}

export function fielderSpeed(def: number) {
  return 9 + def / 10;
}
export function throwSpeed(arm: number) {
  return 35 + arm * 0.55;
}
export function runnerTime(speed: number) {
  return 0.6 + BASE_FT / (12 + speed / 6);
}

function nearest(x: number, y: number, ids?: string[]) {
  let best = FIELDERS[0];
  let bd = Infinity;
  for (const f of FIELDERS) {
    if (ids && !ids.includes(f.id)) continue;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return { f: best, d: bd };
}

function hitByDistance(b: BattedBall, runSpeed: number): Result {
  if (b.dist < 95) return '1B';
  if (b.dist < 128 || runSpeed < 55 || Math.random() < 0.6) return '2B';
  return '3B';
}

// Decide what happens to a ball nobody controls. `skip` leaves out a fielder the player controls.
export function judge(b: BattedBall, def: number, runSpeed: number, skip?: string): Play {
  const ids = FIELDERS.map((f) => f.id).filter((id) => id !== skip);
  const v = fielderSpeed(def);
  const errorRate = clamp(0.2 - def / 350, 0.02, 0.15);
  if (!b.grounder && b.dist > fenceR(b.angle) + 2) return { res: 'HR' };
  if (b.grounder) {
    const s = Math.sin(b.angle);
    const c = Math.cos(b.angle);
    const gs = b.dist / b.time;
    let pick: { f: Spot; t: number; p: number } | null = null;
    for (const f of FIELDERS) {
      if (!ids.includes(f.id) || f.id === 'LF' || f.id === 'CF' || f.id === 'RF') continue;
      const p = f.x * s + f.y * c;
      const perp = Math.abs(f.x * c - f.y * s);
      if (p < 4) continue;
      if (p > b.dist) {
        // The ball stops short (a bunt or a dribbler), so the fielder charges in to get it.
        const end = landing(b);
        const t = Math.max(b.time, Math.hypot(f.x - end.x, f.y - end.y) / v + 0.3);
        if (!pick || t < pick.t) pick = { f, t, p: b.dist };
        continue;
      }
      const t = p / gs;
      if (perp <= v * Math.max(0, t - 0.3) + 2.5 && (!pick || t < pick.t)) pick = { f, t, p };
    }
    if (b.dist < 40 && !skip) {
      // The catcher pounces on balls that die in front of the plate.
      const end = landing(b);
      const t = Math.max(b.time, Math.hypot(end.x, end.y + 3) / (v * 0.8) + 0.5);
      if (!pick || t < pick.t) pick = { f: { id: 'C', x: 0, y: -3 }, t, p: b.dist };
    }
    if (pick) {
      const at = { x: pick.p * s, y: pick.p * c };
      if (Math.random() < errorRate) return { res: '1B', who: pick.f.id, at, t: pick.t, error: true };
      const toFirst = pick.f.id === '1B' ? 0.5 : Math.hypot(at.x - FIRST_BASE.x, at.y - FIRST_BASE.y) / throwSpeed(def);
      const out = pick.t + 0.45 + toFirst < runnerTime(runSpeed);
      return { res: out ? 'OUT' : '1B', who: pick.f.id, at, t: pick.t, throwOut: out };
    }
    const end = landing(b);
    return { res: b.dist > 115 && Math.abs(b.angle) > 0.55 ? '2B' : '1B', who: nearest(end.x, end.y, ['LF', 'CF', 'RF']).f.id };
  }
  const end = landing(b);
  const n = nearest(end.x, end.y, ids);
  // Line drives get there fast, so fielders cover less ground.
  const reach = v * Math.max(0, b.time - 0.35) * (b.apex < 12 ? 0.5 : 0.8) + 3;
  if (n.d <= reach) {
    if (Math.random() < errorRate * 0.6) return { res: '1B', who: n.f.id, at: end, t: b.time, error: true };
    return { res: 'OUT', who: n.f.id, at: end, t: b.time };
  }
  return { res: hitByDistance(b, runSpeed), who: nearest(end.x, end.y, ['LF', 'CF', 'RF']).f.id, at: end, t: b.time };
}

export type BatterTo = 'out' | 0 | 1 | 2 | 'home';
export interface Outcome {
  bases: Bases;
  runs: number;
  outs: number;
  batter: BatterTo;
  // A runner put out on the bases (the lead runner on a double play), by base index.
  outRunner?: number;
  label: string;
  hit: boolean;
}

const EMPTY: Bases = [false, false, false];

// Turn a plate appearance's result into the new bases, outs, and runs.
export function resolve(
  res: Result | 'K' | 'BB' | 'E',
  b: BattedBall | null,
  bases: Bases,
  outs: number,
  o: { dp?: boolean; bunt?: boolean } = {},
): Outcome {
  const third = (label: string, outRunner?: number): Outcome => ({ bases: EMPTY, runs: 0, outs: 3, batter: 'out', outRunner, label, hit: false });
  switch (res) {
    case 'K':
      return outs + 1 >= 3 ? third('STRIKEOUT!') : { bases, runs: 0, outs: outs + 1, batter: 'out', label: 'STRIKEOUT!', hit: false };
    case 'BB':
      return { ...advance(bases, 'BB'), outs, batter: 0, label: 'WALK', hit: false };
    case 'E':
      return { ...advance(bases, '1B'), outs, batter: 0, label: 'SAFE ON AN ERROR!', hit: false };
    case 'HR':
      return { ...advance(bases, 'HR'), outs, batter: 'home', label: 'HOME RUN!', hit: true };
    case '3B':
    case '2B':
    case '1B': {
      const n = res === '1B' ? 0 : res === '2B' ? 1 : 2;
      return { ...advance(bases, res), outs, batter: n as BatterTo, label: ['SINGLE!', 'DOUBLE!', 'TRIPLE!'][n], hit: true };
    }
    case 'OUT':
      if (b?.grounder) {
        if (o.dp && bases[0] && outs < 2) {
          if (outs + 2 >= 3) return third('DOUBLE PLAY!', 0);
          return { bases: [false, false, bases[1]], runs: Number(bases[2]), outs: outs + 2, batter: 'out', outRunner: 0, label: 'DOUBLE PLAY!', hit: false };
        }
        const label = o.bunt && bases.some(Boolean) ? 'SACRIFICE BUNT' : 'GROUND OUT';
        if (outs + 1 >= 3) return third(label);
        return { ...advance(bases, 'OUT', { sacrifice: true, outs }), outs: outs + 1, batter: 'out', label, hit: false };
      } else {
        const label = !b ? 'OUT' : b.apex < 12 ? 'LINE OUT' : b.dist < 70 ? 'POP OUT' : 'FLY OUT';
        if (outs + 1 >= 3) return third(label);
        const sac = !!b && b.dist > 85 && bases[2];
        return { ...advance(bases, 'OUT', { sacFly: sac, outs }), outs: outs + 1, batter: 'out', label: sac ? 'SACRIFICE FLY' : label, hit: false };
      }
  }
}

export interface PALevel {
  kRate: number;
  bbRate: number;
  bunts: boolean;
}
export type CpuPA = { kind: 'K' } | { kind: 'BB' } | { kind: 'inplay'; b: BattedBall; swing: Swing };

// A computer batter's plate appearance against a pitcher. Ratings are 0 to 100.
export function cpuPA(lv: PALevel, bat: number, pitch: number): CpuPA {
  const edge = (pitch - bat) / 60;
  if (Math.random() < lv.kRate * (1 + edge)) return { kind: 'K' };
  if (Math.random() < lv.bbRate) return { kind: 'BB' };
  const swing: Swing = lv.bunts && Math.random() < 0.05 ? 'bunt' : Math.random() < 0.3 ? 'power' : 'contact';
  const q = clamp(Math.pow(Math.random(), 0.85) * (0.75 + bat / 200) - edge * 0.2, 0, 1);
  return { kind: 'inplay', b: battedBall(q, rnd(-0.7, 0.7), swing, bat), swing };
}

// Move runners for a result. Returns the new bases and how many runs scored.
export function advance(bases: Bases, res: Result | 'BB', opts: { sacFly?: boolean; sacrifice?: boolean; outs?: number } = {}) {
  const [a, b, c] = bases;
  let runs = 0;
  let next: Bases = [a, b, c];
  switch (res) {
    case 'HR':
      runs = 1 + Number(a) + Number(b) + Number(c);
      next = [false, false, false];
      break;
    case '3B':
      runs = Number(a) + Number(b) + Number(c);
      next = [false, false, true];
      break;
    case '2B':
      runs = Number(b) + Number(c);
      next = [false, true, a];
      break;
    case '1B': {
      // A runner on second scores half the time; otherwise stops at third.
      const home = b && Math.random() < 0.5;
      runs = Number(c) + Number(home);
      next = [true, a, b && !home];
      break;
    }
    case 'BB':
      runs = Number(a && b && c);
      next = [true, a || b, (a && b) || c];
      break;
    case 'OUT':
      if ((opts.outs ?? 0) < 2 && opts.sacrifice) {
        runs = Number(c);
        next = [false, a, b];
      } else if ((opts.outs ?? 0) < 2 && opts.sacFly && c) {
        runs = 1;
        next = [a, b, false];
      }
      break;
  }
  return { bases: next, runs };
}
