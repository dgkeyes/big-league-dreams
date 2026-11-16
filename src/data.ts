import type { Look } from './figures';

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

export type SkillId = 'contact' | 'power' | 'speed' | 'fielding' | 'arm';
export type Skills = Record<SkillId, number>;
export const SKILLS: { id: SkillId; name: string; color: number }[] = [
  { id: 'contact', name: 'Contact', color: 0x3b82d6 },
  { id: 'power', name: 'Power', color: 0xe03131 },
  { id: 'speed', name: 'Speed', color: 0x2fa84f },
  { id: 'fielding', name: 'Fielding', color: 0xf08c00 },
  { id: 'arm', name: 'Arm', color: 0x7b3fe4 },
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
  tee: boolean;
  // Runs allowed per half inning (0 means no limit).
  runLimit: number;
  // Pitch speeds in feet per second.
  pitch: [number, number];
  // How tall the players are, in feet.
  ft: number;
}

export const GAMES_PER_LEVEL = 20;
export const LEVELS: Level[] = [
  { id: 'tball', name: 'T-Ball', age: 5, innings: 4, cpu: 38, def: 0, kRate: 0, bbRate: 0, bunts: false, tee: true, runLimit: 5, pitch: [0, 0], ft: 4.1 },
  { id: 'little', name: 'Little League', age: 8, innings: 5, cpu: 50, def: 20, kRate: 0.17, bbRate: 0.11, bunts: true, tee: false, runLimit: 0, pitch: [40, 52], ft: 4.7 },
  { id: 'high', name: 'High School', age: 15, innings: 6, cpu: 62, def: 40, kRate: 0.21, bbRate: 0.09, bunts: true, tee: false, runLimit: 0, pitch: [50, 64], ft: 5.5 },
];

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

export interface Profile {
  gender: Gender;
  league: LeagueId;
  tokens: number;
  money: number;
  questDone: boolean;
  atBats: number;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  hits: number;
  homers: number;
  skills: Skills;
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
}

const KEY = 'big-league-dreams/v1';

function fresh(): Profile {
  return {
    gender: 'boy',
    league: 'npdx',
    tokens: 0,
    money: 0,
    questDone: false,
    atBats: 0,
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    hits: 0,
    homers: 0,
    skills: { contact: 40, power: 40, speed: 40, fielding: 40, arm: 40 },
    owned: [],
    equipped: {},
  };
}

// Saves from the first prototype lack the newer fields, so fill them in.
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    const f = fresh();
    return { ...f, ...p, skills: { ...f.skills, ...p.skills }, owned: p.owned ?? [], equipped: { ...p.equipped } };
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

export function levelIndex(p: Profile) {
  return Math.min(LEVELS.length - 1, Math.floor(p.games / GAMES_PER_LEVEL));
}

export function levelOf(p: Profile) {
  return LEVELS[levelIndex(p)];
}

// Games played at the current level.
export function gamesInLevel(p: Profile) {
  return p.games - levelIndex(p) * GAMES_PER_LEVEL;
}

export function ageOf(p: Profile) {
  return Math.min(17, levelOf(p).age + Math.floor(gamesInLevel(p) / 10));
}

export function gearIn(p: Profile, slot: Slot) {
  return GEAR.find((g) => g.id === p.equipped[slot]);
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

export function lookFor(gender: Gender, league: LeagueId, p?: Profile): Look {
  const l = leagueOf(league);
  return {
    jersey: l.color,
    cap: l.dark,
    pants: 0xf4f1e8,
    skin: 0xf1c27d,
    hair: gender === 'girl' ? 0x7a4a24 : 0x4a2e17,
    girl: gender === 'girl',
    bat: p ? gearIn(p, 'bat')?.color : undefined,
    glove: p ? gearIn(p, 'glove')?.color : undefined,
    cleats: p ? gearIn(p, 'cleats')?.color : undefined,
  };
}

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa86b3c];
const HAIR = [0x2b1a10, 0x4a2e17, 0x7a4a24, 0xd8a24a, 0x1b1b1b, 0x8c3b1a];

// Teammates and opponents: the team's uniform with a mix of kids in it.
export function kidLook(league: League, i: number): Look {
  return {
    jersey: league.color,
    cap: league.dark,
    pants: 0xf4f1e8,
    skin: SKIN[(i * 7 + league.abbr.charCodeAt(0)) % SKIN.length],
    hair: HAIR[(i * 5 + league.abbr.charCodeAt(1)) % HAIR.length],
    girl: (i + league.abbr.length + league.color) % 3 === 0,
  };
}

export const KID_NAMES = [
  'Maya', 'Leo', 'Ava', 'Sam', 'Noah', 'Zoe', 'Eli', 'Ruby', 'Max', 'Nora', 'Jack', 'Iris', 'Owen', 'Lily',
  'Theo', 'Mila', 'Finn', 'June', 'Ezra', 'Cora', 'Milo', 'Hazel', 'Gus', 'Ivy', 'Kai', 'Rosa', 'Ben', 'Tess',
];

// The quest pitcher, always a little better than you.
export const ROSIE = { name: 'Rocket Rosie', ageBonus: 1, edge: 6 };

export const ROSIE_LOOK: Look = {
  jersey: 0x7b3fe4,
  cap: 0x4c1d95,
  pants: 0xf4f1e8,
  skin: 0xc68642,
  hair: 0x2b1a10,
  girl: true,
};
