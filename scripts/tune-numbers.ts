/** How often should an opened square show its number? Measures round length vs. show chance. */
import { AMMO, LAYOUTS } from '../src/engine/config';
import { Game } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';

const ammo = AMMO[0]!;
const rounds = Number(process.argv[2] ?? 4000);
const hidden = (g: Game) => {
  const out: number[] = [];
  for (let i = 0; i < g.board.n; i++) if (g.isHidden(i)) out.push(i);
  return out;
};
for (const q of [0.75, 0.5, 0.35, 0.25, 0.15]) {
  const rng = mulberry32(99);
  let shots = 0, busts = 0, cleared = 0, opened = 0, flags = 0, paid = 0, shownNums = 0, zeroOpen = 0;
  for (let r = 0; r < rounds; r++) {
    const g = new Game({ layout: LAYOUTS.portrait, ammo, seed: (rng() * 4294967296) >>> 0, numberShowChance: q });
    while (!g.isOver) {
      const cells = hidden(g);
      const res = g.fire(cells[Math.floor(rng() * cells.length)]!);
      if (res.kind === 'safe') {
        opened += res.cascade.length;
        flags += res.flagged.length;
        if (res.shown) shownNums++;
        if (res.cascade.length + res.flagged.length === 0) zeroOpen++;
      }
    }
    shots += g.shots;
    if (g.phase === 'busted') busts++;
    else {
      cleared++;
      paid += g.payout;
    }
  }
  console.log(
    `show ${String(q).padEnd(4)} avg shots ${(shots / rounds).toFixed(2)}  bust ${((busts / rounds) * 100).toFixed(0)}%  cleared ${((cleared / rounds) * 100).toFixed(0)}%  free opens/round ${(opened / rounds).toFixed(1)}  flags/round ${(flags / rounds).toFixed(2)}  shots w/o side effects ${((zeroOpen / Math.max(1, shots - busts)) * 100).toFixed(0)}%  RTP(never leave) ${((paid / (rounds * ammo.bet)) * 100).toFixed(1)}%`,
  );
}
