import { describe, expect, it } from 'vitest';
import { generateBoard, type Board } from '../src/engine/board';
import { AMMO, RTP } from '../src/engine/config';
import { Game, classifyItem } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';

const ammo = AMMO[0]!;

/** Every mine placement on a fixed dead-cell pattern, each equally likely. */
function allBoards(template: Board): Board[] {
  const playable: number[] = [];
  for (let i = 0; i < template.n; i++) if (template.kind[i] === 'dirt') playable.push(i);
  const out: Board[] = [];
  const rec = (start: number, left: number, chosen: number[]) => {
    if (left === 0) {
      const mines = new Array(template.n).fill(false);
      for (const c of chosen) mines[c] = true;
      const numbers = template.neighbors.map((nb) => nb.reduce((a, j) => a + (mines[j] ? 1 : 0), 0));
      out.push({ ...template, mines, numbers });
      return;
    }
    for (let k = start; k <= playable.length - left; k++) rec(k + 1, left - 1, [...chosen, playable[k]!]);
  };
  rec(0, template.mineCount, []);
  return out;
}

type Strategy = (g: Game) => number | 'cashout';

/** squares the player can still fire at */
const hiddenCells = (g: Game) => {
  const out: number[] = [];
  for (let i = 0; i < g.board.n; i++) if (g.isHidden(i)) out.push(i);
  return out;
};

const strategies: Record<string, Strategy> = {
  firstHiddenForever: (g) => hiddenCells(g)[0]!,
  lowestRiskForever: (g) => hiddenCells(g).sort((a, b) => g.probs[a]! - g.probs[b]!)[0]!,
  highestRiskUnderCertain: (g) => {
    const cells = hiddenCells(g).filter((i) => g.probs[i]! < 1 - 1e-12);
    return cells.sort((a, b) => g.probs[b]! - g.probs[a]!)[0]!;
  },
  lowestRiskStopAt2: (g) => (g.shots >= 2 ? 'cashout' : hiddenCells(g).sort((a, b) => g.probs[a]! - g.probs[b]!)[0]!),
  greedyUntilDouble: (g) => {
    if (g.total >= 2 * g.bet) return 'cashout';
    const cells = hiddenCells(g).filter((i) => g.probs[i]! < 1 - 1e-12);
    return cells.sort((a, b) => g.probs[a]! - g.probs[b]!)[0]!;
  },
  onlyZeroRiskThenLeave: (g) => {
    const safe = hiddenCells(g).filter((i) => g.probs[i]! <= 1e-12);
    if (safe.length) return safe[0]!;
    if (g.shots === 0) return hiddenCells(g)[Math.floor(hiddenCells(g).length / 2)]!;
    return 'cashout';
  },
  seededRandom: (g) => {
    const cells = hiddenCells(g);
    const r = mulberry32(g.shots * 7919 + 13)();
    if (g.shots > 0 && r < 0.3) return 'cashout';
    return cells[Math.floor(r * cells.length)]!;
  },
};

function play(board: Board, strategy: Strategy): number {
  const g = new Game({ layout: board.layout, ammo, board, seed: 1 });
  while (!g.isOver) {
    const move = strategy(g);
    if (move === 'cashout') {
      g.cashOut();
      break;
    }
    g.fire(move);
  }
  return g.phase === 'cashed' ? g.total : 0;
}

describe('Game fairness', () => {
  const template = generateBoard({ cols: 4, rows: 4 }, mulberry32(3), 3, { deadMin: 2, deadMax: 2, minesMin: 3, minesMax: 3 });
  const boards = allBoards(template);

  it('enumerates every placement', () => {
    expect(boards.length).toBe(364); // C(14,3)
  });

  for (const [name, strategy] of Object.entries(strategies)) {
    it(`returns exactly RTP for strategy "${name}"`, () => {
      let sum = 0;
      for (const b of boards) sum += play(b, strategy);
      const rtp = sum / boards.length / ammo.bet;
      expect(rtp).toBeCloseTo(RTP, 9);
    });
  }

  it('also holds on a portrait layout with more mines', () => {
    const t = generateBoard({ cols: 3, rows: 5 }, mulberry32(11), 11, { deadMin: 1, deadMax: 1, minesMin: 4, minesMax: 4 });
    const bs = allBoards(t);
    for (const strategy of Object.values(strategies)) {
      let sum = 0;
      for (const b of bs) sum += play(b, strategy);
      expect(sum / bs.length / ammo.bet).toBeCloseTo(RTP, 9);
    }
  });
});

describe('Game rules', () => {
  it('starts ready, prices the first shot from the bet, and pays the ticket on cash-out', () => {
    const g = new Game({ layout: { cols: 6, rows: 6 }, ammo, seed: 42 });
    expect(g.phase).toBe('ready');
    expect(g.canCashOut).toBe(false);
    expect(g.displayedTotal).toBe(ammo.bet);
    const safe = hiddenCells(g).find((i) => !g.board.mines[i])!;
    const pv = g.preview(safe)!;
    expect(pv.risk).toBeCloseTo(g.mineCount / g.hiddenPlayableCount, 12);
    const r = g.fire(safe);
    expect(r.kind).toBe('safe');
    if (r.kind === 'safe') {
      expect(r.totalAfter).toBeCloseTo(pv.totalAfter, 12);
      expect(r.gain).toBeCloseTo(pv.gain, 12);
    }
    if (!g.isOver) {
      expect(g.canCashOut).toBe(true);
      const paid = g.cashOut();
      expect(paid).toBeLessThanOrEqual(g.total + 1e-6);
      expect(paid).toBeGreaterThan(g.total - 0.01);
    }
  });

  it('busts on a mine and shooting trees is harmless', () => {
    const g = new Game({ layout: { cols: 6, rows: 6 }, ammo, seed: 5 });
    const dead = g.board.kind.findIndex((k) => k !== 'dirt');
    expect(g.fire(dead).kind).toBe('dead');
    expect(g.shots).toBe(0);
    const mine = g.board.mines.findIndex((m) => m);
    const r = g.fire(mine);
    expect(r.kind).toBe('mine');
    expect(g.phase).toBe('busted');
    expect(g.displayedTotal).toBe(0);
    expect(() => g.fire(0)).toThrow();
  });

  it('never leaves a deduction on the board: every square in play is a real gamble', () => {
    let opened = 0;
    let flags = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const g = new Game({ layout: seed % 2 ? { cols: 9, rows: 4 } : { cols: 4, rows: 9 }, ammo, seed });
      const rng = mulberry32(seed);
      while (!g.isOver) {
        const cells = hiddenCells(g);
        const safe = cells.filter((i) => !g.board.mines[i]);
        if (!safe.length) break;
        const r = g.fire(safe[Math.floor(rng() * safe.length)]!);
        expect(r.kind).toBe('safe');
        if (r.kind !== 'safe') break;
        opened += r.cascade.length;
        flags += r.flagged.length;
        for (const c of r.cascade) expect(g.board.mines[c.index]).toBe(false);
        for (const f of r.flagged) expect(g.board.mines[f]).toBe(true);
        for (let i = 0; i < g.board.n; i++) {
          if (!g.isHidden(i)) continue;
          expect(g.probs[i]).toBeGreaterThan(1e-9);
          expect(g.probs[i]).toBeLessThan(1 - 1e-9);
        }
        expect(g.minesLeft).toBe(g.mineCount - g.flagged.filter(Boolean).length);
      }
    }
    expect(opened).toBeGreaterThan(0);
    expect(flags).toBeGreaterThan(0);
  });

  it('a flagged mine is inert and the round ends once nothing is left to gamble on', () => {
    let checked = false;
    for (let seed = 1; seed < 3000 && !checked; seed++) {
      const g = new Game({ layout: { cols: 9, rows: 4 }, ammo, seed });
      while (!g.isOver) {
        const safe = hiddenCells(g).filter((i) => !g.board.mines[i]);
        if (!safe.length) break;
        g.fire(safe[0]!);
        const f = g.flagged.findIndex(Boolean);
        if (f >= 0 && !g.isOver) {
          expect(g.fire(f).kind).toBe('already');
          expect(g.phase).toBe('playing');
          checked = true;
          break;
        }
      }
    }
    expect(checked).toBe(true);
    // play a board to the end: all safe squares opened => auto cash-out
    const g = new Game({ layout: { cols: 4, rows: 9 }, ammo, seed: 77 });
    while (!g.isOver) {
      const safe = hiddenCells(g).filter((i) => !g.board.mines[i]);
      g.fire(safe[0]!);
    }
    expect(g.phase).toBe('cashed');
    expect(g.hiddenPlayableCount).toBe(0);
  });

  it('classifies items by payout', () => {
    const bet = 5;
    expect(classifyItem(0, 1, bet)).toBe('nothing');
    expect(classifyItem(1, 1.2, bet)).toBe('mole');
    expect(classifyItem(3, 1.5, bet)).toBe('groundhog');
    expect(classifyItem(7, 1.5, bet)).toBe('treasure');
    expect(classifyItem(30, 1.9, bet)).toBe('treasure');
    expect(classifyItem(30, 3, bet)).toBe('aqueduct');
    expect(classifyItem(500, 60, bet)).toBe('oil');
  });

  it('is reproducible from its seed', () => {
    const a = new Game({ layout: { cols: 4, rows: 9 }, ammo, seed: 999 });
    const b = new Game({ layout: { cols: 4, rows: 9 }, ammo, seed: 999 });
    expect(a.board.mines).toEqual(b.board.mines);
    expect(a.board.kind).toEqual(b.board.kind);
  });
});
