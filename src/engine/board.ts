import { DEAD_MAX, DEAD_MIN, MINES_MAX, MINES_MIN, type Layout } from './config';
import { randInt, shuffle, type Rng } from './rng';

export type CellKind = 'dirt' | 'tree' | 'rock';

export interface Board {
  layout: Layout;
  n: number;
  kind: CellKind[]; // 'dirt' is playable
  mines: boolean[];
  mineCount: number;
  /** playable (non-dead) 8-neighbours of each cell */
  neighbors: number[][];
  /** number of adjacent mines for each cell (only meaningful on dirt) */
  numbers: number[];
  seed: number;
}

export function neighborsOf(layout: Layout, i: number): number[] {
  const { cols, rows } = layout;
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
      out.push(rr * cols + cc);
    }
  }
  return out;
}

export interface GenerateOptions {
  deadMin?: number;
  deadMax?: number;
  minesMin?: number;
  minesMax?: number;
}

export function generateBoard(layout: Layout, rng: Rng, seed: number, opts: GenerateOptions = {}): Board {
  const n = layout.cols * layout.rows;
  const deadCount = randInt(rng, opts.deadMin ?? DEAD_MIN, opts.deadMax ?? DEAD_MAX);
  const mineCount = randInt(rng, opts.minesMin ?? MINES_MIN, opts.minesMax ?? MINES_MAX);

  const order = shuffle(
    rng,
    Array.from({ length: n }, (_, i) => i),
  );
  const kind: CellKind[] = new Array(n).fill('dirt');
  for (let k = 0; k < deadCount; k++) {
    kind[order[k]!] = rng() < 0.55 ? 'tree' : 'rock';
  }
  const mines: boolean[] = new Array(n).fill(false);
  const playable = order.slice(deadCount);
  shuffle(rng, playable);
  for (let k = 0; k < mineCount; k++) mines[playable[k]!] = true;

  const neighbors: number[][] = [];
  const numbers: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const nb = neighborsOf(layout, i).filter((j) => kind[j] === 'dirt');
    neighbors.push(nb);
  }
  for (let i = 0; i < n; i++) {
    numbers[i] = neighbors[i]!.reduce((acc, j) => acc + (mines[j] ? 1 : 0), 0);
  }
  return { layout, n, kind, mines, mineCount, neighbors, numbers, seed };
}
