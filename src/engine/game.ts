import { generateBoard, type Board, type CellKind } from './board';
import { GRAVE_CHANCE, ITEM_RULES, RTP, type AmmoDef, type ItemType, type Layout } from './config';
import { mulberry32, randomSeed, type Rng } from './rng';
import { solve } from './solver';

export type Phase = 'ready' | 'playing' | 'busted' | 'cashed';

export interface ShotPreview {
  index: number;
  risk: number; // P(mine)
  factor: number; // prize after / prize before, if safe
  gain: number; // currency added to the prize, if safe
  totalAfter: number;
  item: ItemType;
  certainMine: boolean;
  certainSafe: boolean;
}

export interface CascadeReveal {
  index: number;
  number: number;
}

export type ShotResult =
  | { kind: 'dead'; index: number; cell: CellKind }
  | { kind: 'already'; index: number }
  | { kind: 'mine'; index: number; lostBet: number }
  | {
      kind: 'safe';
      index: number;
      number: number;
      item: ItemType;
      risk: number;
      factor: number;
      gain: number;
      totalBefore: number;
      totalAfter: number;
      /** extra squares opened for free because this one had no adjacent mines */
      cascade: CascadeReveal[];
      /** the round ended by itself (yard fully cleared) */
      autoCashout: boolean;
    };

export interface GameOptions {
  layout: Layout;
  ammo: AmmoDef;
  seed?: number;
  rtp?: number;
  /** testing hook: play a specific board instead of generating one */
  board?: Board;
}

/**
 * One round of Molesweeper.
 *
 * Pricing: the ticket starts worth RTP * bet. Each safe reveal at posterior mine risk p
 * multiplies the ticket by 1/(1-p). Because the expected value of every shot is exactly
 * the ticket's current value, cashing out at ANY point returns RTP * bet in expectation,
 * no matter how cleverly (or badly) the numbers are read. The only way to do worse is to
 * fire at a square the numbers already prove to be a mine.
 */
export class Game {
  readonly board: Board;
  readonly bet: number;
  readonly ammo: AmmoDef;
  readonly rtp: number;
  readonly seed: number;
  readonly rng: Rng;

  phase: Phase = 'ready';
  revealed: boolean[];
  /** ticket value (what a cash-out pays) */
  total: number;
  shots = 0;
  graveUsed = false;
  probs: Float64Array;
  mineHit: number | null = null;
  readonly history: ShotResult[] = [];

  constructor(opts: GameOptions) {
    this.seed = opts.seed ?? randomSeed();
    this.rng = mulberry32(this.seed);
    this.ammo = opts.ammo;
    this.bet = opts.ammo.bet;
    this.rtp = opts.rtp ?? RTP;
    this.board = opts.board ?? generateBoard(opts.layout, this.rng, this.seed);
    this.revealed = new Array(this.board.n).fill(false);
    this.total = this.bet * this.rtp;
    this.probs = this.computeProbs();
  }

  get layout(): Layout {
    return this.board.layout;
  }

  get mineCount(): number {
    return this.board.mineCount;
  }

  get isOver(): boolean {
    return this.phase === 'busted' || this.phase === 'cashed';
  }

  get canCashOut(): boolean {
    return this.phase === 'playing' && this.shots > 0;
  }

  /** what the player sees as "prize" (their stake before the first shot) */
  get displayedTotal(): number {
    if (this.phase === 'busted') return 0;
    if (this.shots === 0) return this.bet;
    return this.total;
  }

  get hiddenPlayableCount(): number {
    let c = 0;
    for (let i = 0; i < this.board.n; i++) if (this.board.kind[i] === 'dirt' && !this.revealed[i]) c++;
    return c;
  }

  cellKind(i: number): CellKind {
    return this.board.kind[i]!;
  }

  isRevealed(i: number): boolean {
    return this.revealed[i]!;
  }

  numberAt(i: number): number {
    return this.board.numbers[i]!;
  }

  private computeProbs(): Float64Array {
    const res = solve({
      n: this.board.n,
      playable: this.board.kind.map((k) => k === 'dirt'),
      neighbors: this.board.neighbors,
      revealed: this.revealed,
      numbers: this.board.numbers,
      totalMines: this.board.mineCount,
    });
    if (res.weight <= 0) throw new Error('inconsistent board state');
    return res.probs;
  }

  /** Risk / reward preview for aiming at a square. Null for dead, revealed or finished. */
  preview(index: number): ShotPreview | null {
    if (this.isOver) return null;
    if (this.board.kind[index] !== 'dirt' || this.revealed[index]) return null;
    const risk = this.probs[index]!;
    const before = this.shots === 0 ? this.bet : this.total;
    const totalAfter = risk >= 1 ? 0 : this.total / (1 - risk);
    const gain = Math.max(0, totalAfter - before);
    const factor = before > 0 ? totalAfter / before : 1;
    return {
      index,
      risk,
      factor,
      gain,
      totalAfter,
      item: classifyItem(gain, factor, this.bet),
      certainMine: risk >= 1 - 1e-12,
      certainSafe: risk <= 1e-12,
    };
  }

  /** Fire the current ammo at a square. */
  fire(index: number): ShotResult {
    if (this.isOver) throw new Error('round is over');
    const kind = this.board.kind[index]!;
    if (kind !== 'dirt') return { kind: 'dead', index, cell: kind };
    if (this.revealed[index]) return { kind: 'already', index };

    this.phase = 'playing';
    this.shots++;

    if (this.board.mines[index]) {
      this.phase = 'busted';
      this.mineHit = index;
      this.revealed[index] = true;
      const res: ShotResult = { kind: 'mine', index, lostBet: this.bet };
      this.history.push(res);
      return res;
    }

    const risk = this.probs[index]!;
    const totalBefore = this.shots === 1 ? this.bet : this.total;
    const totalAfter = this.total / (1 - risk);
    const gain = Math.max(0, totalAfter - totalBefore);
    const factor = totalBefore > 0 ? totalAfter / totalBefore : 1;
    this.total = totalAfter;

    let item = classifyItem(gain, factor, this.bet);
    if (item === 'nothing' && !this.graveUsed && this.rng() < GRAVE_CHANCE) {
      item = 'grave';
      this.graveUsed = true;
    }

    this.revealed[index] = true;
    const cascade: CascadeReveal[] = [];
    if (this.board.numbers[index] === 0) this.cascadeFrom(index, cascade);

    this.probs = this.computeProbs();

    let autoCashout = false;
    if (this.yardCleared()) {
      this.phase = 'cashed';
      autoCashout = true;
    }

    const res: ShotResult = {
      kind: 'safe',
      index,
      number: this.board.numbers[index]!,
      item,
      risk,
      factor,
      gain,
      totalBefore,
      totalAfter,
      cascade,
      autoCashout,
    };
    this.history.push(res);
    return res;
  }

  /** Opening a "0" opens its neighbours too (they are provably safe, so they are worth nothing). */
  private cascadeFrom(index: number, out: CascadeReveal[]) {
    const stack = [index];
    while (stack.length) {
      const i = stack.pop()!;
      for (const j of this.board.neighbors[i]!) {
        if (this.revealed[j]) continue;
        this.revealed[j] = true;
        out.push({ index: j, number: this.board.numbers[j]! });
        if (this.board.numbers[j] === 0) stack.push(j);
      }
    }
  }

  /** No hidden square is worth shooting: everything left is a certain mine (or nothing is left). */
  private yardCleared(): boolean {
    for (let i = 0; i < this.board.n; i++) {
      if (this.board.kind[i] !== 'dirt' || this.revealed[i]) continue;
      if (this.probs[i]! < 1 - 1e-12) return false;
    }
    return true;
  }

  cashOut(): number {
    if (!this.canCashOut) throw new Error('cannot cash out now');
    this.phase = 'cashed';
    return this.payout;
  }

  /** Cash paid on a cash-out, rounded down to the cent. */
  get payout(): number {
    if (this.phase !== 'cashed') return 0;
    return Math.floor(this.total * 100 + 1e-9) / 100;
  }
}

export function classifyItem(gain: number, factor: number, bet: number): ItemType {
  if (gain < 0.005) return 'nothing';
  if (factor >= ITEM_RULES.oilMinFactor) return 'oil';
  if (factor >= ITEM_RULES.aqueductMinFactor) return 'aqueduct';
  const g = gain / bet;
  if (g >= ITEM_RULES.treasureMinGain) return 'treasure';
  if (g >= ITEM_RULES.groundhogMinGain) return 'groundhog';
  return 'mole';
}

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatFactor(f: number): string {
  if (f >= 100) return `×${Math.round(f)}`;
  if (f >= 10) return `×${f.toFixed(1)}`;
  return `×${f.toFixed(2)}`;
}
