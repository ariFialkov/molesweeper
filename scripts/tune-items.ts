/** Distribution of what a safe shot adds (in bets) and of the pot factor, to place the item-skin thresholds. */
import { AMMO, LAYOUTS } from '../src/engine/config';
import { Game } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';

const ammo = AMMO[0]!;
const rng = mulberry32(5);
const gains: number[] = [];
const factors: number[] = [];
const hidden = (g: Game) => {
  const out: number[] = [];
  for (let i = 0; i < g.board.n; i++) if (g.isHidden(i)) out.push(i);
  return out;
};
for (let r = 0; r < 20000; r++) {
  const g = new Game({ layout: LAYOUTS.portrait, ammo, seed: (rng() * 4294967296) >>> 0 });
  while (!g.isOver) {
    if (g.shots > 0 && rng() < 0.25) break;
    const cells = hidden(g);
    const res = g.fire(cells[Math.floor(rng() * cells.length)]!);
    if (res.kind === 'safe') {
      gains.push(res.gain / g.bet);
      factors.push(res.factor);
    }
  }
}
gains.sort((a, b) => a - b);
factors.sort((a, b) => a - b);
const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]!.toFixed(2);
console.log(`safe shots: ${gains.length}`);
console.log('gain/bet quantiles  10%', q(gains, 0.1), ' 50%', q(gains, 0.5), ' 75%', q(gains, 0.75), ' 90%', q(gains, 0.9), ' 95%', q(gains, 0.95), ' 99%', q(gains, 0.99));
console.log('factor quantiles    10%', q(factors, 0.1), ' 50%', q(factors, 0.5), ' 75%', q(factors, 0.75), ' 90%', q(factors, 0.9), ' 95%', q(factors, 0.95), ' 99%', q(factors, 0.99));
const share = (lo: number, hi: number) => ((gains.filter((g) => g >= lo && g < hi).length / gains.length) * 100).toFixed(1) + '%';
console.log('gain/bet  <0.5:', share(0, 0.5), ' 0.5-1:', share(0.5, 1), ' 1-2:', share(1, 2), ' 2-5:', share(2, 5), ' >=5:', share(5, 1e9));
console.log('factor >=2:', ((factors.filter((f) => f >= 2).length / factors.length) * 100).toFixed(1) + '%', ' >=1.5:', ((factors.filter((f) => f >= 1.5).length / factors.length) * 100).toFixed(1) + '%');
