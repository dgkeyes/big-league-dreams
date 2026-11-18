import type { HairStyle, Kit, Look, Uniform } from './gfx/kid';

export type LeagueId = 'wilshire' | 'npdx' | 'parkside' | 'hollywood';
export type Gender = 'boy' | 'girl';

export interface League {
  id: LeagueId;
  name: string;
  abbr: string;
  color: number;
  dark: number;
}

// Version 1 is Portland only: the four leagues from the design doc.
export const LEAGUES: League[] = [
  { id: 'wilshire', name: 'Wilshire Riverside', abbr: 'WIL', color: 0x12a39a, dark: 0x0b6b66 },
  { id: 'npdx', name: 'North Portland', abbr: 'NPX', color: 0x2f6fe0, dark: 0x1a4296 },
  { id: 'parkside', name: 'Parkside', abbr: 'PRK', color: 0xf08c00, dark: 0xa85d00 },
  { id: 'hollywood', name: 'Hollywood Rose City', abbr: 'HRC', color: 0xe2457a, dark: 0xa02556 },
];

export function uniformOf(l: League): Uniform {
  return { jersey: l.color, cap: l.dark, pants: 0xf4f1e8, socks: l.dark };
}

export type Pos = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';
export const POSITIONS: { id: Pos; name: string }[] = [
  { id: 'P', name: 'Pitcher' },
  { id: 'C', name: 'Catcher' },
  { id: '1B', name: 'First Base' },
  { id: '2B', name: 'Second Base' },
  { id: 'SS', name: 'Shortstop' },
  { id: '3B', name: 'Third Base' },
  { id: 'LF', name: 'Left Field' },
  { id: 'CF', name: 'Center Field' },
  { id: 'RF', name: 'Right Field' },
];

export type SkillId = 'contact' | 'power' | 'speed' | 'fielding' | 'arm';
export type Skills = Record<SkillId, number>;
export const SKILLS: { id: SkillId; name: string; color: string }[] = [
  { id: 'contact', name: 'Contact', color: '#3b82d6' },
  { id: 'power', name: 'Power', color: '#e03131' },
  { id: 'speed', name: 'Speed', color: '#2fa84f' },
  { id: 'fielding', name: 'Fielding', color: '#f08c00' },
  { id: 'arm', name: 'Arm', color: '#7b3fe4' },
];

export interface Level {
  id: string;
  name: string;
  age: number;
  innings: number;
  // Rating of the other kids at this level (0 to 100).
  cpu: number;
  // How well the fielders on both teams play.
  def: number;
  kRate: number;
  bbRate: number;
  bunts: boolean;
  // T-ball: a coach lobs pitches, and after three misses the ball goes on a tee.
  tee: boolean;
  // Runs allowed per half inning (0 means no limit).
  runLimit: number;
  // Pitch speeds in feet per second, and how far away the pitcher stands.
  pitch: [number, number];
  pitchDist: number;
  // How tall the players are, in feet.
  ft: number;
}

// Elias: every game is 9 innings, and you move up after 5 games (or one game with a homer every at-bat).
export const GAMES_PER_LEVEL = 5;
export const LEVELS: Level[] = [
  { id: 'tball', name: 'T-Ball', age: 5, innings: 9, cpu: 38, def: 0, kRate: 0, bbRate: 0, bunts: false, tee: true, runLimit: 5, pitch: [24, 30], pitchDist: 30, ft: 4.1 },
  { id: 'little', name: 'Little League', age: 8, innings: 9, cpu: 50, def: 20, kRate: 0.17, bbRate: 0.11, bunts: true, tee: false, runLimit: 0, pitch: [40, 52], pitchDist: 46, ft: 4.7 },
  { id: 'high', name: 'High School', age: 15, innings: 9, cpu: 62, def: 40, kRate: 0.21, bbRate: 0.09, bunts: true, tee: false, runLimit: 0, pitch: [50, 64], pitchDist: 56, ft: 5.5 },
];

export const STORE = "Dick's Sporting Goods";

export type Slot = 'bat' | 'glove' | 'cleats';
export interface Gear {
  id: string;
  slot: Slot;
  name: string;
  price: number;
  boost: Partial<Skills>;
  color: number;
}

export const GEAR: Gear[] = [
  { id: 'wood-slugger', slot: 'bat', name: 'Wood Slugger', price: 60, boost: { power: 5 }, color: 0xc68a4a },
  { id: 'line-drive', slot: 'bat', name: 'Line Drive Alloy', price: 60, boost: { contact: 5 }, color: 0x4dabf7 },
  { id: 'rose-rocket', slot: 'bat', name: 'Rose City Rocket', price: 180, boost: { power: 8, contact: 4 }, color: 0xf06595 },
  { id: 'leather-glove', slot: 'glove', name: 'Pro Leather Glove', price: 50, boost: { fielding: 5 }, color: 0x8b4513 },
  { id: 'quick-glove', slot: 'glove', name: 'Quick Hands Glove', price: 90, boost: { fielding: 4, arm: 4 }, color: 0x343a40 },
  { id: 'gold-glove', slot: 'glove', name: 'Gold Glove', price: 180, boost: { fielding: 8, arm: 5 }, color: 0xf2c94c },
  { id: 'speed-cleats', slot: 'cleats', name: 'Speed Cleats', price: 50, boost: { speed: 5 }, color: 0xff6b6b },
  { id: 'turf-cleats', slot: 'cleats', name: 'Turf Grippers', price: 90, boost: { speed: 4, fielding: 3 }, color: 0x12b886 },
  { id: 'lightning-cleats', slot: 'cleats', name: 'Lightning Cleats', price: 160, boost: { speed: 9 }, color: 0xffd43b },
];

export const SKIN_TONES = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0xa86b3c, 0x8d5524, 0x5c3a1e];
export const HAIR_COLORS = [0x1b1b1b, 0x2b1a10, 0x4a2e17, 0x7a4a24, 0xb5652b, 0xd8a24a, 0xf1d58a];
export const EYE_COLORS = [0x4a2e17, 0x2f6fe0, 0x2fa84f, 0x8a6a2a];
export const HAIR_STYLES: { id: HairStyle; name: string }[] = [
  { id: 'short', name: 'Short' },
  { id: 'buzz', name: 'Buzz' },
  { id: 'curly', name: 'Curly' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'long', name: 'Long' },
  { id: 'mullet', name: 'Mullet' },
];

export interface Profile {
  name: string;
  look: Look;
  league: LeagueId;
  position: Pos;
  tokens: number;
  money: number;
  questDone: boolean;
  level: number;
  gamesAtLevel: number;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  atBats: number;
  hits: number;
  homers: number;
  skills: Skills;
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
  // Days count up from 0, which is a Monday.
  day: number;
  // Dad said no baseball today, after wandering off at the store.
  noBaseball: boolean;
  practices: number;
}

const KEY = 'big-league-dreams/v1';

export function defaultLook(gender: Gender = 'boy'): Look {
  return {
    gender,
    skin: SKIN_TONES[1],
    hair: HAIR_COLORS[2],
    hairStyle: gender === 'girl' ? 'ponytail' : 'short',
    eyes: EYE_COLORS[0],
    number: 7,
  };
}

function fresh(): Profile {
  return {
    name: '',
    look: defaultLook(),
    league: 'npdx',
    position: 'SS',
    tokens: 0,
    money: 0,
    questDone: false,
    level: 0,
    gamesAtLevel: 0,
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    atBats: 0,
    hits: 0,
    homers: 0,
    skills: { contact: 40, power: 40, speed: 40, fielding: 40, arm: 40 },
    owned: [],
    equipped: {},
    day: 0,
    noBaseball: false,
    practices: 0,
  };
}

// Saves from the 2D prototype lack the newer fields, so fill them in.
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile> & { gender?: Gender };
    const f = fresh();
    const out: Profile = { ...f, ...p, skills: { ...f.skills, ...p.skills }, owned: p.owned ?? [], equipped: { ...p.equipped } };
    if (!p.look) out.look = defaultLook(p.gender ?? 'boy');
    if (p.level === undefined) {
      // The 2D version moved up every 20 games.
      out.level = Math.min(LEVELS.length - 1, Math.floor((p.games ?? 0) / 20));
      out.gamesAtLevel = Math.min(GAMES_PER_LEVEL - 1, (p.games ?? 0) - out.level * 20);
    }
    return out;
  } catch {
    return null;
  }
}

export function getProfile(): Profile {
  return loadProfile() ?? fresh();
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private browsing can block storage; the game still plays.
  }
}

export function leagueOf(id: LeagueId): League {
  return LEAGUES.find((l) => l.id === id) ?? LEAGUES[0];
}

export function levelOf(p: Profile) {
  return LEVELS[Math.min(p.level, LEVELS.length - 1)];
}

export function displayName(p: Profile) {
  return p.name.trim() || 'You';
}

export function gearIn(p: Profile, slot: Slot) {
  return GEAR.find((g) => g.id === p.equipped[slot]);
}

export function kitOf(p: Profile): Kit {
  return { bat: gearIn(p, 'bat')?.color, glove: gearIn(p, 'glove')?.color, cleats: gearIn(p, 'cleats')?.color };
}

// Skills with the boosts from equipped gear.
export function skillsOf(p: Profile): Skills {
  const s = { ...p.skills };
  for (const slot of ['bat', 'glove', 'cleats'] as Slot[]) {
    const g = gearIn(p, slot);
    if (!g) continue;
    for (const [k, v] of Object.entries(g.boost)) s[k as SkillId] = Math.min(99, s[k as SkillId] + (v ?? 0));
  }
  return s;
}

export function overall(p: Profile) {
  const s = skillsOf(p);
  return Math.round((s.contact + s.power + s.speed + s.fielding + s.arm) / 5);
}

export function bump(p: Profile, id: SkillId, n = 1) {
  p.skills[id] = Math.min(99, p.skills[id] + n);
}

// Count a finished game. A day Dad said no baseball ('sat') counts toward moving up but not the record.
// Returns true when the player moves up a level.
export function finishGame(p: Profile, result: 'W' | 'L' | 'T' | 'sat', homerEveryAB = false) {
  p.games++;
  p.gamesAtLevel++;
  if (result === 'W') p.wins++;
  else if (result === 'L') p.losses++;
  else if (result === 'T') p.ties++;
  if (p.level < LEVELS.length - 1 && (p.gamesAtLevel >= GAMES_PER_LEVEL || homerEveryAB)) {
    moveUp(p);
    return true;
  }
  return false;
}

export function moveUp(p: Profile) {
  if (p.level >= LEVELS.length - 1) return;
  p.level++;
  p.gamesAtLevel = 0;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const dayName = (d: number) => DAYS[d % 7];
// Practice and games take turns every day, and the pattern keeps rolling across weeks.
export const dayKind = (d: number): 'practice' | 'game' => (d % 2 === 0 ? 'practice' : 'game');

const NAMES = [
  'Maya', 'Leo', 'Ava', 'Sam', 'Noah', 'Zoe', 'Eli', 'Ruby', 'Max', 'Nora', 'Jack', 'Iris', 'Owen', 'Lily',
  'Theo', 'Mila', 'Finn', 'June', 'Ezra', 'Cora', 'Milo', 'Hazel', 'Gus', 'Ivy', 'Kai', 'Rosa', 'Ben', 'Tess',
];
const STYLES: HairStyle[] = ['short', 'buzz', 'curly', 'ponytail', 'long'];

// Teammates and opponents: a mix of kids, the same ones every time for a given team.
export function teamKids(league: League, count = 9) {
  const seed = league.abbr.charCodeAt(0) + league.abbr.charCodeAt(2) * 3;
  const kids = Array.from({ length: count }, (_, i) => {
    const girl = (i + seed) % 3 === 0;
    const look: Look = {
      gender: girl ? 'girl' : 'boy',
      skin: SKIN_TONES[(i * 5 + seed) % SKIN_TONES.length],
      hair: HAIR_COLORS[(i * 3 + seed) % HAIR_COLORS.length],
      hairStyle: girl ? (i % 2 ? 'ponytail' : 'long') : STYLES[(i + seed) % 3],
      eyes: EYE_COLORS[(i + seed) % EYE_COLORS.length],
      number: ((i * 7 + seed) % 29) + 1,
    };
    return { name: NAMES[(i * 5 + seed) % NAMES.length], look };
  });
  // Every team has one kid with a mullet. Slot 0 is skipped because on your own team that's you.
  const rocker = kids.find((k, i) => i > 0 && k.look.gender === 'boy');
  if (rocker) rocker.look.hairStyle = 'mullet';
  return kids;
}

// The quest pitcher, always a little better than you.
export const ROSIE = { name: 'Rocket Rosie', edge: 6 };
export const ROSIE_LOOK: Look = { gender: 'girl', skin: 0xc68642, hair: 0x2b1a10, hairStyle: 'ponytail', eyes: 0x4a2e17, number: 99 };
export const ROSIE_UNI: Uniform = { jersey: 0x7b3fe4, cap: 0x4c1d95, pants: 0xf4f1e8, socks: 0x4c1d95 };
