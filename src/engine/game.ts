import { generateBoard, type Board, type CellKind } from './board';
import { ITEM_RULES, NUMBER_SHOW_CHANCE, OIL_SEEP, RTP, oilShave, type AmmoDef, type ItemType, type Layout } from './config';
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
  /** false: the dirt is unreadable, the number is not shown */
  shown: boolean;
}

export type ShotResult =
  | { kind: 'dead'; index: number; cell: CellKind }
  | { kind: 'already'; index: number }
  | { kind: 'mine'; index: number; lostBet: number }
  | {
      kind: 'safe';
      index: number;
      number: number;
      /** false: the dirt is unreadable, the number is not shown */
      shown: boolean;
      item: ItemType;
      /** 50 / 75 / 100 when the oil seep struck on this shot, else 0 */
      oilMultiplier: number;
      risk: number;
      factor: number;
      gain: number;
      totalBefore: number;
      totalAfter: number;
      /** squares the numbers now prove safe: opened for free by the game */
      cascade: CascadeReveal[];
      /** squares the numbers now prove to be mines: dug up and defused by the game */
      flagged: number[];
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
  /** override NUMBER_SHOW_CHANCE (simulations) */
  numberShowChance?: number;
  /** override the oil seep chance (0 disables it, 1 strikes every time; both keep the RTP exact) */
  oilChance?: number;
  oilMultipliers?: number[];
  oilWeights?: number[];
}

/**
 * One round of Molesweeper.
 *
 * Pricing: the ticket starts worth RTP * bet. Each safe reveal at posterior mine risk p
 * multiplies the ticket by 1/(1-p). Because the expected value of every shot is exactly
 * the ticket's current value, cashing out at ANY point returns RTP * bet in expectation,
 * no matter how cleverly (or badly) the numbers are read.
 *
 * No deduction is ever left to the player: after every shot the game itself opens every
 * square the visible numbers prove safe (worth nothing) and flags every square they prove
 * to be a mine, repeating until every remaining hidden square has 0 < p < 1. Whatever the
 * player can still hit is a genuine gamble.
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
  /** mines the game has dug up and defused because the numbers proved them */
  flagged: boolean[];
  /** opened squares whose number is readable */
  shown: boolean[];
  readonly numberShowChance: number;
  readonly oilChance: number;
  readonly oilMultipliers: number[];
  readonly oilWeights: number[];
  /** ordinary gains are multiplied by this to fund the oil seep */
  readonly shave: number;
  /** separate stream for the seep so the draw never depends on how the board unfolded */
  private oilRng: Rng;
  /** ticket value (what a cash-out pays) */
  total: number;
  shots = 0;
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
    this.flagged = new Array(this.board.n).fill(false);
    this.shown = new Array(this.board.n).fill(false);
    this.numberShowChance = opts.numberShowChance ?? NUMBER_SHOW_CHANCE;
    this.oilChance = opts.oilChance ?? OIL_SEEP.chance;
    this.oilMultipliers = opts.oilMultipliers ?? OIL_SEEP.multipliers;
    this.oilWeights = opts.oilWeights ?? OIL_SEEP.weights;
    const w = this.oilWeights.reduce((a, b) => a + b, 0);
    const expectedK = this.oilMultipliers.reduce((acc, m, i) => acc + (m * this.oilWeights[i]!) / w, 0);
    this.shave = oilShave(this.oilChance, expectedK);
    this.oilRng = mulberry32((this.seed ^ 0x6f1c5eed) >>> 0);
    this.total = this.bet * this.rtp;
    this.probs = this.computeProbs();
  }

  get layout(): Layout {
    return this.board.layout;
  }

  get mineCount(): number {
    return this.board.mineCount;
  }

  /** mines still buried somewhere unknown */
  get minesLeft(): number {
    return this.board.mineCount - this.flagged.filter(Boolean).length;
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
    for (let i = 0; i < this.board.n; i++) if (this.isHidden(i)) c++;
    return c;
  }

  /** a square the player can still fire at */
  isHidden(i: number): boolean {
    return this.board.kind[i] === 'dirt' && !this.revealed[i] && !this.flagged[i];
  }

  isFlagged(i: number): boolean {
    return this.flagged[i]!;
  }

  cellKind(i: number): CellKind {
    return this.board.kind[i]!;
  }

  isRevealed(i: number): boolean {
    return this.revealed[i]!;
  }

  /** the number the player can read on an opened square, or -1 if unreadable / not opened */
  numberAt(i: number): number {
    return this.revealed[i] && this.shown[i] ? this.board.numbers[i]! : -1;
  }

  /** Open a square. Free (proven-safe) opens always show their number; a player's shot shows it on a
   *  seeded coin flip that never looks at the value. */
  private open(i: number, byPlayer: boolean) {
    this.revealed[i] = true;
    this.shown[i] = byPlayer ? this.rng() < this.numberShowChance : true;
  }

  private computeProbs(): Float64Array {
    const res = solve({
      n: this.board.n,
      playable: this.board.kind.map((k) => k === 'dirt'),
      neighbors: this.board.neighbors,
      revealed: this.revealed,
      numbers: this.board.numbers.map((n, i) => (this.shown[i] ? n : -1)),
      totalMines: this.board.mineCount,
      knownMines: this.flagged,
    });
    if (res.weight <= 0) throw new Error('inconsistent board state');
    return res.probs;
  }

  /** Risk / reward preview for aiming at a square. Null for dead, revealed or finished. */
  preview(index: number): ShotPreview | null {
    if (this.isOver) return null;
    if (!this.isHidden(index)) return null;
    const risk = this.probs[index]!;
    const before = this.shots === 0 ? this.bet : this.total;
    const totalAfter = risk >= 1 ? 0 : (this.total * this.shave) / (1 - risk);
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
    if (this.revealed[index] || this.flagged[index]) return { kind: 'already', index };

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
    const oilMultiplier = this.drawOil();
    const totalAfter = (this.total * this.shave * (oilMultiplier || 1)) / (1 - risk);
    const gain = Math.max(0, totalAfter - totalBefore);
    const factor = totalBefore > 0 ? totalAfter / totalBefore : 1;
    this.total = totalAfter;

    const item: ItemType = oilMultiplier ? 'oil' : classifyItem(gain, factor, this.bet);

    this.open(index, true);
    const cascade: CascadeReveal[] = [];
    const flagged: number[] = [];
    this.autoResolve(cascade, flagged);

    let autoCashout = false;
    if (this.yardCleared()) {
      this.phase = 'cashed';
      autoCashout = true;
    }

    const res: ShotResult = {
      kind: 'safe',
      index,
      number: this.board.numbers[index]!,
      shown: this.shown[index]!,
      item,
      oilMultiplier,
      risk,
      factor,
      gain,
      totalBefore,
      totalAfter,
      cascade,
      flagged,
      autoCashout,
    };
    this.history.push(res);
    return res;
  }

  /** One draw per safe shot: 0, or one of the seep multipliers. */
  private drawOil(): number {
    const u = this.oilRng();
    if (u >= this.oilChance) return 0;
    // reuse the same uniform, rescaled, to pick the multiplier
    let v = (u / this.oilChance) * this.oilWeights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < this.oilMultipliers.length; i++) {
      v -= this.oilWeights[i]!;
      if (v <= 0) return this.oilMultipliers[i]!;
    }
    return this.oilMultipliers[this.oilMultipliers.length - 1]!;
  }

  /**
   * The game plays out every proof itself: squares the visible numbers prove safe are opened
   * (worth nothing), squares they prove to be mines are flagged. Repeats until every hidden
   * square is a genuine gamble. Depends only on what the player can see, so it leaks nothing.
   */
  private autoResolve(opened: CascadeReveal[], flagged: number[]) {
    for (;;) {
      this.probs = this.computeProbs();
      let changed = false;
      for (let i = 0; i < this.board.n; i++) {
        if (!this.isHidden(i)) continue;
        const p = this.probs[i]!;
        if (p <= 1e-12) {
          this.open(i, false);
          opened.push({ index: i, number: this.board.numbers[i]!, shown: this.shown[i]! });
          changed = true;
        } else if (p >= 1 - 1e-12) {
          this.flagged[i] = true;
          flagged.push(i);
          changed = true;
        }
      }
      if (!changed) return;
    }
  }

  /** Nothing is left to gamble on. */
  private yardCleared(): boolean {
    return this.hiddenPlayableCount === 0;
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
