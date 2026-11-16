import type { Look } from './figures';

export type LeagueId = 'wilshire' | 'npdx' | 'parkside' | 'hollywood';
export type Gender = 'boy' | 'girl';

export interface League {
  id: LeagueId;
  name: string;
  color: number;
  dark: number;
}

// Version 1 is Portland only: the four leagues from the design doc.
export const LEAGUES: League[] = [
  { id: 'wilshire', name: 'Wilshire Riverside', color: 0x12a39a, dark: 0x0b6b66 },
  { id: 'npdx', name: 'North Portland', color: 0x2f6fe0, dark: 0x1a4296 },
  { id: 'parkside', name: 'Parkside', color: 0xf08c00, dark: 0xa85d00 },
  { id: 'hollywood', name: 'Hollywood Rose City', color: 0xe2457a, dark: 0xa02556 },
];

export interface Profile {
  gender: Gender;
  league: LeagueId;
  tokens: number;
  questDone: boolean;
  atBats: number;
}

const KEY = 'big-league-dreams/v1';

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function getProfile(): Profile {
  return loadProfile() ?? { gender: 'boy', league: 'npdx', tokens: 0, questDone: false, atBats: 0 };
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

export function lookFor(gender: Gender, league: LeagueId): Look {
  const l = leagueOf(league);
  return {
    jersey: l.color,
    cap: l.dark,
    pants: 0xf4f1e8,
    skin: 0xf1c27d,
    hair: gender === 'girl' ? 0x7a4a24 : 0x4a2e17,
    girl: gender === 'girl',
  };
}

// The quest pitcher: a 6-year-old, a little better than a brand-new 5-year-old.
export const ROSIE = { name: 'Rocket Rosie', age: 6, rating: 46 };
export const PLAYER_RATING = 40;

export const ROSIE_LOOK: Look = {
  jersey: 0x7b3fe4,
  cap: 0x4c1d95,
  pants: 0xf4f1e8,
  skin: 0xc68642,
  hair: 0x2b1a10,
  girl: true,
};

export const FIELDER_LOOK: Look = {
  jersey: 0x9aa5b1,
  cap: 0x495057,
  pants: 0xe9ecef,
  skin: 0xe0ac69,
  hair: 0x3b2614,
  girl: false,
};
