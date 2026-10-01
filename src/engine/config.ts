/** Return-to-player. Every stopping strategy has exactly this expected return (see README, "The math"). */
export const RTP = 0.96;

export interface Layout {
  cols: number;
  rows: number;
}

/** The same 4x9 board, rotated for the screen: identical squares, identical maths. */
export const LAYOUTS = {
  landscape: { cols: 9, rows: 4 } as Layout,
  portrait: { cols: 4, rows: 9 } as Layout,
};
export const TOTAL_CELLS = 36;

/** Dead squares (trees & rocks) per backyard, inclusive. */
export const DEAD_MIN = 3;
export const DEAD_MAX = 7;

/** Mines per backyard, inclusive. */
export const MINES_MIN = 5;
export const MINES_MAX = 7;

/**
 * Chance that a square the player shoots shows its number (once the prize has burrowed away).
 * Decided by a seeded coin flip that never looks at the value, so a missing number leaks nothing.
 * Squares the game opens for free always show their number. Fewer numbers means fewer proofs
 * for the game to resolve, so rounds stay suspenseful longer (scripts/tune-numbers.ts).
 */
export const NUMBER_SHOW_CHANCE = 0.25;

export type AmmoId = 'firecracker' | 'grenade' | 'icbm' | 'disco';

export interface AmmoDef {
  id: AmmoId;
  name: string;
  bet: number;
  blurb: string;
  /** icon sprite name (src/ui/icons.ts) */
  icon: 'firecracker' | 'grenade' | 'rocket' | 'disco';
}

export const AMMO: AmmoDef[] = [
  { id: 'firecracker', name: 'Firecracker', bet: 5, blurb: 'Sparky schoolyard pop', icon: 'firecracker' },
  { id: 'grenade', name: 'Grenade', bet: 10, blurb: 'Flak & dirt burst', icon: 'grenade' },
  { id: 'icbm', name: 'ICBM', bet: 25, blurb: 'Mini mushroom cloud', icon: 'rocket' },
  { id: 'disco', name: 'Disco Bomb', bet: 50, blurb: 'Confetti, the mole dances', icon: 'disco' },
];

export type ItemType = 'nothing' | 'mole' | 'groundhog' | 'treasure' | 'aqueduct' | 'oil';

/**
 * Item "skins" are chosen by what the fair payout for that shot turned out to be.
 * gain is in units of the bet, factor is prize-after / prize-before.
 */
export const ITEM_RULES = {
  aqueductMinFactor: 2, // aqueduct: x2 .. x25 (multiplies the running total)
  treasureMinGain: 1, // buried treasure: +1x bet and up (about 1 safe shot in 20)
  groundhogMinGain: 0.35, // groundhog: +0.35x .. +1x bet (about 1 safe shot in 4)
  // mole: anything smaller (anything under a cent is "nothing")
};

/**
 * Oil seep: a jackpot that can strike on any safe shot, multiplying the whole pot by 50, 75 or 100.
 * It is paid for by shaving every ordinary prize by a fixed factor (see oilShave), so the game
 * stays an exact martingale: no strategy can do better or worse than RTP.
 */
export const OIL_SEEP = {
  /** chance per safe shot by the player (1 in 2000: roughly one round in 500) */
  chance: 0.0005,
  multipliers: [50, 75, 100],
  weights: [0.6, 0.3, 0.1],
};

export function oilExpectedMultiplier(multipliers = OIL_SEEP.multipliers, weights = OIL_SEEP.weights): number {
  const w = weights.reduce((a, b) => a + b, 0);
  return multipliers.reduce((acc, m, i) => acc + (m * weights[i]!) / w, 0);
}

/** Every ordinary gain is multiplied by this so that the seep's expected value is funded exactly. */
export function oilShave(chance: number, expectedMultiplier = oilExpectedMultiplier()): number {
  return 1 / (1 + chance * (expectedMultiplier - 1));
}

export const ITEM_LABEL: Record<ItemType, string> = {
  nothing: 'Nothing here',
  mole: 'Mole',
  groundhog: 'Groundhog',
  treasure: 'Buried treasure',
  aqueduct: 'Aqueduct',
  oil: 'Oil seep',
};

export const STARTING_BALANCE = 1000;
