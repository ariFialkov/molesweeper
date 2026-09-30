/** Return-to-player. Every stopping strategy has exactly this expected return (see README, "The math"). */
export const RTP = 0.96;

export interface Layout {
  cols: number;
  rows: number;
}

/** Same number of squares in both orientations, so the maths never changes. */
export const LAYOUTS = {
  landscape: { cols: 6, rows: 6 } as Layout,
  portrait: { cols: 4, rows: 9 } as Layout,
};
export const TOTAL_CELLS = 36;

/** Dead squares (trees & rocks) per backyard, inclusive. */
export const DEAD_MIN = 3;
export const DEAD_MAX = 7;

/** Mines per backyard, inclusive. */
export const MINES_MIN = 5;
export const MINES_MAX = 7;

/** Chance that a worthless ("nothing") reveal is a secret grave. Max one per backyard. */
export const GRAVE_CHANCE = 0.1;

export type AmmoId = 'firecracker' | 'grenade' | 'icbm' | 'disco';

export interface AmmoDef {
  id: AmmoId;
  name: string;
  bet: number;
  blurb: string;
  emoji: string;
}

export const AMMO: AmmoDef[] = [
  { id: 'firecracker', name: 'Firecracker', bet: 5, blurb: 'Sparky schoolyard pop', emoji: '🧨' },
  { id: 'grenade', name: 'Grenade', bet: 10, blurb: 'Flak & dirt burst', emoji: '💣' },
  { id: 'icbm', name: 'ICBM', bet: 25, blurb: 'Mini mushroom cloud', emoji: '🚀' },
  { id: 'disco', name: 'Disco Bomb', bet: 50, blurb: 'Confetti, the mole dances', emoji: '🪩' },
];

export type ItemType = 'nothing' | 'grave' | 'mole' | 'groundhog' | 'treasure' | 'aqueduct' | 'oil';

/**
 * Item "skins" are chosen by what the fair payout for that shot turned out to be.
 * gain is in units of the bet, factor is prize-after / prize-before.
 */
export const ITEM_RULES = {
  oilMinFactor: 50, // oil seep: x50 and up (x50 / x75 / x100 in spirit)
  aqueductMinFactor: 2, // aqueduct: x2 .. x25 (multiplies the running total)
  treasureMinGain: 5, // buried treasure: +5x .. +10x bet
  groundhogMinGain: 1, // groundhog: +1x .. +4x bet
  // mole: +0.05x .. +1x bet (anything smaller than a cent is "nothing")
};

export const ITEM_LABEL: Record<ItemType, string> = {
  nothing: 'Nothing here',
  grave: 'Secret grave',
  mole: 'Mole',
  groundhog: 'Groundhog',
  treasure: 'Buried treasure',
  aqueduct: 'Aqueduct',
  oil: 'Oil seep',
};

export const STARTING_BALANCE = 1000;
