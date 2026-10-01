import { describe, expect, it } from 'vitest';
import { generateBoard, neighborsOf, type Board } from '../src/engine/board';
import { mulberry32 } from '../src/engine/rng';
import { solve } from '../src/engine/solver';

/** Brute force: enumerate every placement of `mines` among hidden playable cells. */
function bruteForce(board: Board, revealed: boolean[]): Float64Array {
  const n = board.n;
  const hidden: number[] = [];
  for (let i = 0; i < n; i++) if (board.kind[i] === 'dirt' && !revealed[i]) hidden.push(i);
  const probs = new Float64Array(n);
  let total = 0;
  const choose = (start: number, left: number, chosen: number[]) => {
    if (left === 0) {
      const isMine = new Array(n).fill(false);
      for (const c of chosen) isMine[c] = true;
      for (let r = 0; r < n; r++) {
        if (!revealed[r]) continue;
        const cnt = board.neighbors[r]!.reduce((a, j) => a + (isMine[j] ? 1 : 0), 0);
        if (cnt !== board.numbers[r]) return;
      }
      total++;
      for (const c of chosen) probs[c]++;
      return;
    }
    for (let k = start; k <= hidden.length - left; k++) choose(k + 1, left - 1, [...chosen, hidden[k]!]);
  };
  choose(0, board.mineCount, []);
  for (let i = 0; i < n; i++) probs[i] /= total;
  return probs;
}

describe('solver', () => {
  it('matches brute force on random partially revealed boards', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed);
      const layout = seed % 2 ? { cols: 4, rows: 4 } : { cols: 5, rows: 3 };
      const board = generateBoard(layout, rng, seed, { deadMin: 1, deadMax: 3, minesMin: 2, minesMax: 4 });
      const revealed = new Array(board.n).fill(false);
      // reveal a few random safe cells (with cascades on zeros)
      const safe = board.kind.map((k, i) => (k === 'dirt' && !board.mines[i] ? i : -1)).filter((i) => i >= 0);
      const count = 1 + Math.floor(rng() * 4);
      for (let k = 0; k < count; k++) {
        const i = safe[Math.floor(rng() * safe.length)]!;
        revealed[i] = true;
      }
      const res = solve({
        n: board.n,
        playable: board.kind.map((k) => k === 'dirt'),
        neighbors: board.neighbors,
        revealed,
        numbers: board.numbers,
        totalMines: board.mineCount,
      });
      const expected = bruteForce(board, revealed);
      for (let i = 0; i < board.n; i++) expect(res.probs[i]).toBeCloseTo(expected[i]!, 10);
    }
  });

  it('gives uniform risk on an untouched board', () => {
    const rng = mulberry32(7);
    const board = generateBoard({ cols: 6, rows: 6 }, rng, 7);
    const playable = board.kind.map((k) => k === 'dirt');
    const res = solve({
      n: board.n,
      playable,
      neighbors: board.neighbors,
      revealed: new Array(board.n).fill(false),
      numbers: board.numbers,
      totalMines: board.mineCount,
    });
    const hidden = playable.filter(Boolean).length;
    for (let i = 0; i < board.n; i++) {
      if (playable[i]) expect(res.probs[i]).toBeCloseTo(board.mineCount / hidden, 12);
      else expect(res.probs[i]).toBe(0);
    }
  });

  it('accounts for known (flagged) mines', () => {
    const rng = mulberry32(21);
    const board = generateBoard({ cols: 5, rows: 4 }, rng, 21, { deadMin: 1, deadMax: 2, minesMin: 3, minesMax: 4 });
    const playable = board.kind.map((k) => k === 'dirt');
    const mineIdx = board.mines.findIndex((m) => m);
    const known = new Array(board.n).fill(false);
    known[mineIdx] = true;
    const revealed = new Array(board.n).fill(false);
    const safe = board.kind.map((k, i) => (k === 'dirt' && !board.mines[i] ? i : -1)).filter((i) => i >= 0);
    revealed[safe[0]!] = true;
    revealed[safe[3]!] = true;
    const res = solve({ n: board.n, playable, neighbors: board.neighbors, revealed, numbers: board.numbers, totalMines: board.mineCount, knownMines: known });
    // brute force with the mine fixed: enumerate the other mines among hidden non-known squares
    const hidden: number[] = [];
    for (let i = 0; i < board.n; i++) if (playable[i] && !revealed[i] && !known[i]) hidden.push(i);
    const expected = new Float64Array(board.n);
    let total = 0;
    const rec = (start: number, left: number, chosen: number[]) => {
      if (left === 0) {
        const isMine = new Array(board.n).fill(false);
        isMine[mineIdx] = true;
        for (const c of chosen) isMine[c] = true;
        for (let r = 0; r < board.n; r++) {
          if (!revealed[r]) continue;
          const cnt = board.neighbors[r]!.reduce((a, j) => a + (isMine[j] ? 1 : 0), 0);
          if (cnt !== board.numbers[r]) return;
        }
        total++;
        for (const c of chosen) expected[c]++;
        return;
      }
      for (let k = start; k <= hidden.length - left; k++) rec(k + 1, left - 1, [...chosen, hidden[k]!]);
    };
    rec(0, board.mineCount - 1, []);
    for (const i of hidden) expect(res.probs[i]).toBeCloseTo(expected[i]! / total, 10);
    expect(res.probs[mineIdx]).toBe(1);
  });

  it('neighbours respect grid edges', () => {
    expect(neighborsOf({ cols: 4, rows: 9 }, 0).sort((a, b) => a - b)).toEqual([1, 4, 5]);
    expect(neighborsOf({ cols: 6, rows: 6 }, 35).sort((a, b) => a - b)).toEqual([28, 29, 34]);
    expect(neighborsOf({ cols: 6, rows: 6 }, 7).length).toBe(8);
  });
});
