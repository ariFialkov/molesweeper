/**
 * Exact minesweeper posterior: for every hidden square, the probability that it is a mine
 * given (a) the numbers on every revealed square, (b) the total number of mines and
 * (c) which squares are dead (trees/rocks never hold mines).
 *
 * Frontier squares (those touching a revealed number) are enumerated with constraint
 * backtracking, split into independent components whose mine-count polynomials are
 * convolved. Non-frontier squares are handled combinatorially with binomials.
 * Boards here are tiny (36 squares) so this runs in well under a millisecond.
 */

export interface SolverInput {
  n: number;
  playable: boolean[];
  /** playable neighbours of each square */
  neighbors: number[][];
  revealed: boolean[];
  /** adjacent-mine number for each revealed square; a negative value means the number is not shown */
  numbers: number[];
  totalMines: number;
  /** squares known to be mines (flagged by the game); they are neither hidden nor safe */
  knownMines?: boolean[];
}

export interface SolverResult {
  /** P(mine) for each square; 0 for revealed / dead squares */
  probs: Float64Array;
  /** number of hidden playable squares */
  hidden: number;
  /** total weight of consistent configurations (> 0 if the board is consistent) */
  weight: number;
}

const MAXN = 64;
const BINOM: number[][] = (() => {
  const t: number[][] = [];
  for (let i = 0; i <= MAXN; i++) {
    t.push(new Array(i + 1).fill(0));
    t[i]![0] = 1;
    t[i]![i] = 1;
    for (let j = 1; j < i; j++) t[i]![j] = t[i - 1]![j - 1]! + t[i - 1]![j]!;
  }
  return t;
})();

export function binom(n: number, k: number): number {
  if (k < 0 || n < 0 || k > n) return 0;
  return BINOM[n]![k]!;
}

function convolve(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < b.length; j++) out[i + j] += a[i]! * b[j]!;
  }
  return out;
}

interface Constraint {
  vars: number[]; // indices into component variable list
  target: number;
  assignedMines: number;
  unassigned: number;
}

interface Component {
  cells: number[]; // board indices
  counts: number[]; // counts[k] = number of consistent assignments with k mines
  cellCounts: number[][]; // cellCounts[v][k] = assignments with k mines where var v is a mine
}

export function solve(input: SolverInput): SolverResult {
  const { n, playable, neighbors, revealed, numbers } = input;
  const known = input.knownMines ?? [];
  const probs = new Float64Array(n);

  const hiddenList: number[] = [];
  let knownCount = 0;
  for (let i = 0; i < n; i++) {
    if (!playable[i]) continue;
    if (known[i]) {
      knownCount++;
      probs[i] = 1;
    } else if (!revealed[i]) hiddenList.push(i);
  }
  const totalMines = input.totalMines - knownCount;
  const hidden = hiddenList.length;
  if (hidden === 0) return { probs, hidden, weight: 1 };

  // Raw constraints from revealed numbers.
  const rawConstraints: { cells: number[]; target: number }[] = [];
  const isFrontier: boolean[] = new Array(n).fill(false);
  for (let r = 0; r < n; r++) {
    if (!revealed[r] || !playable[r] || known[r] || numbers[r]! < 0) continue;
    const cells = neighbors[r]!.filter((j) => !revealed[j] && !known[j]);
    const target = numbers[r]! - neighbors[r]!.reduce((a, j) => a + (known[j] ? 1 : 0), 0);
    if (target < 0) return { probs, hidden, weight: 0 };
    if (cells.length === 0) {
      if (target !== 0) return { probs, hidden, weight: 0 };
      continue;
    }
    rawConstraints.push({ cells, target });
    for (const c of cells) isFrontier[c] = true;
  }

  const frontier = hiddenList.filter((i) => isFrontier[i]);
  const others = hiddenList.filter((i) => !isFrontier[i]);
  const nOther = others.length;

  // Union-find components over frontier cells joined by shared constraints.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let p = parent.get(x)!;
    while (p !== x) {
      const gp = parent.get(p)!;
      parent.set(x, gp);
      x = p;
      p = gp;
    }
    return x;
  };
  for (const f of frontier) parent.set(f, f);
  for (const c of rawConstraints) {
    const root = find(c.cells[0]!);
    for (let k = 1; k < c.cells.length; k++) {
      const r2 = find(c.cells[k]!);
      if (r2 !== root) parent.set(r2, root);
    }
  }
  const compByRoot = new Map<number, number[]>();
  for (const f of frontier) {
    const r = find(f);
    if (!compByRoot.has(r)) compByRoot.set(r, []);
    compByRoot.get(r)!.push(f);
  }

  const components: Component[] = [];
  for (const cells of compByRoot.values()) {
    components.push(enumerateComponent(cells, rawConstraints));
  }

  // Combine component polynomials.
  let totalPoly: number[] = [1];
  for (const comp of components) totalPoly = convolve(totalPoly, comp.counts);

  const weightFor = (k: number) => binom(nOther, totalMines - k);
  let W = 0;
  for (let k = 0; k < totalPoly.length; k++) W += totalPoly[k]! * weightFor(k);
  if (W <= 0) return { probs, hidden, weight: 0 };

  // Frontier probabilities.
  for (let ci = 0; ci < components.length; ci++) {
    const comp = components[ci]!;
    let rest: number[] = [1];
    for (let cj = 0; cj < components.length; cj++) if (cj !== ci) rest = convolve(rest, components[cj]!.counts);
    for (let v = 0; v < comp.cells.length; v++) {
      const poly = convolve(comp.cellCounts[v]!, rest);
      let s = 0;
      for (let k = 0; k < poly.length; k++) s += poly[k]! * weightFor(k);
      probs[comp.cells[v]!] = s / W;
    }
  }

  // Non-frontier probabilities (all identical).
  if (nOther > 0) {
    let s = 0;
    for (let k = 0; k < totalPoly.length; k++) s += totalPoly[k]! * binom(nOther - 1, totalMines - k - 1);
    const p = s / W;
    for (const o of others) probs[o] = p;
  }

  return { probs, hidden, weight: W };
}

function enumerateComponent(cells: number[], rawConstraints: { cells: number[]; target: number }[]): Component {
  const cellSet = new Set(cells);
  const varIndex = new Map<number, number>();
  cells.forEach((c, i) => varIndex.set(c, i));

  const constraints: Constraint[] = [];
  for (const rc of rawConstraints) {
    if (!cellSet.has(rc.cells[0]!)) continue;
    constraints.push({
      vars: rc.cells.map((c) => varIndex.get(c)!),
      target: rc.target,
      assignedMines: 0,
      unassigned: rc.cells.length,
    });
  }
  const varConstraints: number[][] = cells.map(() => []);
  constraints.forEach((c, ci) => c.vars.forEach((v) => varConstraints[v]!.push(ci)));

  // Variable order: BFS through constraints so partial assignments are checked early.
  const order: number[] = [];
  const seen = new Array(cells.length).fill(false);
  for (let start = 0; start < cells.length; start++) {
    if (seen[start]) continue;
    const queue = [start];
    seen[start] = true;
    while (queue.length) {
      const v = queue.shift()!;
      order.push(v);
      for (const ci of varConstraints[v]!) {
        for (const w of constraints[ci]!.vars) {
          if (!seen[w]) {
            seen[w] = true;
            queue.push(w);
          }
        }
      }
    }
  }

  const nv = cells.length;
  const counts = new Array(nv + 1).fill(0);
  const cellCounts: number[][] = cells.map(() => new Array(nv + 1).fill(0));
  const assign = new Array(nv).fill(0);

  const feasible = (ci: number) => {
    const c = constraints[ci]!;
    return c.assignedMines <= c.target && c.assignedMines + c.unassigned >= c.target;
  };

  const rec = (pos: number, mines: number) => {
    if (pos === nv) {
      counts[mines]++;
      for (let v = 0; v < nv; v++) if (assign[v]) cellCounts[v]![mines]++;
      return;
    }
    const v = order[pos]!;
    for (const val of [0, 1]) {
      assign[v] = val;
      let ok = true;
      for (const ci of varConstraints[v]!) {
        const c = constraints[ci]!;
        c.assignedMines += val;
        c.unassigned--;
      }
      for (const ci of varConstraints[v]!) {
        if (!feasible(ci)) {
          ok = false;
          break;
        }
      }
      if (ok) rec(pos + 1, mines + val);
      for (const ci of varConstraints[v]!) {
        const c = constraints[ci]!;
        c.assignedMines -= val;
        c.unassigned++;
      }
    }
    assign[v] = 0;
  };
  rec(0, 0);

  return { cells, counts, cellCounts };
}
