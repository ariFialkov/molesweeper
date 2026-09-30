/**
 * Monte Carlo sanity check on the production board (36 squares, 3-7 dead, 5-7 mines).
 *   npm run sim -- [rounds]
 */
import { AMMO, LAYOUTS, RTP } from '../src/engine/config';
import { Game } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';

const rounds = Number(process.argv[2] ?? 20000);
const ammo = AMMO[0]!;

type Strategy = { name: string; pick: (g: Game, rng: () => number) => number | 'cashout' };

const hidden = (g: Game) => {
  const out: number[] = [];
  for (let i = 0; i < g.board.n; i++) if (g.cellKind(i) === 'dirt' && !g.isRevealed(i) && g.probs[i]! < 1 - 1e-12) out.push(i);
  return out;
};

const strategies: Strategy[] = [
  { name: 'one shot & leave', pick: (g, r) => (g.shots >= 1 ? 'cashout' : hidden(g)[Math.floor(r() * hidden(g).length)]!) },
  { name: 'three safest shots', pick: (g) => (g.shots >= 3 ? 'cashout' : hidden(g).sort((a, b) => g.probs[a]! - g.probs[b]!)[0]!) },
  { name: 'safest until 3x', pick: (g) => (g.total >= 3 * g.bet ? 'cashout' : hidden(g).sort((a, b) => g.probs[a]! - g.probs[b]!)[0]!) },
  { name: 'riskiest until 10x', pick: (g) => (g.total >= 10 * g.bet ? 'cashout' : hidden(g).sort((a, b) => g.probs[b]! - g.probs[a]!)[0]!) },
  { name: 'random, 25% leave', pick: (g, r) => (g.shots > 0 && r() < 0.25 ? 'cashout' : hidden(g)[Math.floor(r() * hidden(g).length)]!) },
  { name: 'never leave', pick: (g, r) => hidden(g)[Math.floor(r() * hidden(g).length)]! },
];

for (const layout of [LAYOUTS.landscape, LAYOUTS.portrait]) {
  console.log(`\n=== ${layout.cols}x${layout.rows}, ${rounds} rounds per strategy, bet $${ammo.bet}, target RTP ${RTP} ===`);
  for (const s of strategies) {
    const rng = mulberry32(12345);
    let paid = 0;
    let busts = 0;
    let shots = 0;
    let maxX = 0;
    const items: Record<string, number> = {};
    for (let r = 0; r < rounds; r++) {
      const g = new Game({ layout, ammo, seed: (rng() * 4294967296) >>> 0 });
      while (!g.isOver) {
        const m = s.pick(g, rng);
        if (m === 'cashout') {
          g.cashOut();
          break;
        }
        const res = g.fire(m);
        if (res.kind === 'safe') items[res.item] = (items[res.item] ?? 0) + 1;
      }
      shots += g.shots;
      if (g.phase === 'busted') busts++;
      else {
        paid += g.payout;
        maxX = Math.max(maxX, g.payout / g.bet);
      }
    }
    const rtp = paid / (rounds * ammo.bet);
    const itemStr = Object.entries(items)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    console.log(
      `${s.name.padEnd(22)} RTP ${(rtp * 100).toFixed(2)}%  bust ${((busts / rounds) * 100).toFixed(1)}%  avg shots ${(shots / rounds).toFixed(2)}  best ${maxX.toFixed(1)}x  [${itemStr}]`,
    );
  }
}
