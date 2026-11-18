// Character types and scales copied from Leila's game (dgkeyes/sabin-elementary, src/core/save.ts and src/config.ts),
// so the character files in this folder stay the same as hers.

export interface Avatar {
  body: 'f' | 'm';
  height: number;
  build: number;
  skin: string;
  eyes: string;
  freckles: boolean;
  glasses: boolean;
}

export interface Worn {
  id: string;
  color: string;
  color2: string;
}

export interface Look {
  hair: string;
  hairColor: string;
  top: Worn;
  bottom: Worn;
  shoes: Worn;
  hat: Worn | null;
  backpack: Worn | null;
}

/** Kids are scaled down from the adult-sized base models. */
export const KID_SCALE = 0.8;
export const ADULT_SCALE = 1.0;
