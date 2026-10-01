# Molesweeper

A casual 3D stepper betting game for desktop and mobile, installable as a PWA.
Minesweeper's logic, whack-a-mole's attitude: slingshot firecrackers into a fenced
backyard, blow squares open, dig up moles and treasure, and cash out before you find a mine.

- **Engine:** TypeScript, no framework. Exact-probability solver, deterministic seeded rounds.
- **Scene:** Three.js. Procedural models and textures only, no asset downloads, works offline.
- **PWA:** `vite-plugin-pwa` precaches everything; add to home screen on iOS/Android or install on desktop.
- **Audio:** synthesized with the Web Audio API (pop, flak, mushroom cloud rumble, disco jingle).

**Play it:** https://arifialkov.github.io/molesweeper/ (deployed by `.github/workflows/pages.yml` on every push).

## Run it

```bash
npm install
npm run dev        # dev server on your LAN, open it on your phone too
npm run build      # typecheck + production build into dist/ (includes sw.js + manifest)
npm run preview    # serve dist/
npm test           # engine tests (solver vs brute force, exact-RTP proofs)
npm run sim        # Monte Carlo on the production board, prints RTP per strategy
npm run icons      # regenerate the PWA icons (pure JS PNG writer)
```

## How a round plays

1. Pick your ammo. The ammo is the bet and you use it for the whole round:
   firecracker $5, grenade $10, ICBM $25, disco bomb $50. Each has its own explosion.
2. The backyard *is* the board: a mowed-lawn checkerboard of 36 squares under a translucent grid,
   6×6 in landscape, 4×9 in portrait (same maths either way), filling the screen.
   3–7 squares are trees or rocks (dead squares, never mines, never counted). 5–7 squares are mines.
3. Press anywhere and drag to pull the slingshot, release to fire. Aiming is free: the shot lands
   where the reticle points and the closest square blows open.
4. A safe hit blows a crater. A number pressed into the dirt counts mines in the 8 neighbours,
   exactly like minesweeper (a 0 opens its neighbours for free). The prize pops out of the crater.
5. Cash out any time after your first shot, or keep shooting. A mine ends the round and wrecks the yard.

What you can dig up (the skin is chosen by what the shot paid):

| Item | Effect | When it shows up |
| --- | --- | --- |
| 🐹 Mole | adds up to 1× bet | ordinary safe squares |
| 🦫 Groundhog | adds 1×–4× bet | bigger pots / riskier squares |
| 💎 Buried treasure | adds 5× bet and up | big pots |
| 🏛️ Aqueduct | multiplies the prize ×2–×25 | squares with ≥ 50 % mine risk |
| 🛢️ Oil seep | multiplies ×50 and beyond | squares with ≥ 98 % risk (legendary) |
| ⚰️ Secret grave | +$0.00, coffin bursts, mummy flies | 10 % of worthless squares, max 1 per yard |
| 🌳🪨 Trees & rocks | dead squares, burn mark on hit | 3–7 per yard |

Disco bombs make the mole or groundhog dance to a short jingle. ICBMs leave a mushroom cloud.

## The math: minesweeper numbers *and* a fixed 96 % RTP

The problem in the brief: showing adjacent-mine numbers gives the player real information,
and a skilled reader would beat any fixed pay table. The fix is to **price every shot from the
exact posterior mine probability of the square the player chose**, given everything currently
visible (numbers, dead squares, total mine count).

- The ticket starts worth `RTP × bet` (0.96 × bet).
- Firing at a square with mine probability `p` and surviving multiplies the ticket by `1 / (1 − p)`.
- Cashing out pays the ticket.

The expected value of any single shot is `(1 − p) × V / (1 − p) + p × 0 = V`: the ticket is a
martingale. So the expected cash-out is `0.96 × bet` for **every** stopping rule and every way of
reading the board. Clever play changes the variance (a proven-safe square pays +$0, a 50 % square
doubles the pot), never the edge. `tests/game.test.ts` proves this exactly by enumerating every mine
placement on small boards and running seven different strategies; `npm run sim` shows it on the
production board.

Consequences that shape the design:

- The numbers are honest minesweeper numbers and the only hint the player gets: the exact risk and
  the payout are deliberately not shown, so every reveal keeps its suspense.
- A square the numbers prove to be a mine is still a mine (firing at it is the one way to do worse
  than 96 %), and a round ends by itself once only proven mines remain.
- Item types are cosmetic: mole / groundhog / treasure by how much the shot added, aqueduct / oil seep
  when the shot at least doubled the pot. The pay table lives in `src/engine/config.ts`.
- The `RTP` constant is the only house-edge knob. Because the edge is applied once up front, the
  first safe shot already nets a little above the bet (the brief's "takes a few shots to get back to
  the bet" would require the edge to fall unevenly on early cash-outs, which makes RTP depend on the
  player's strategy; this design keeps it flat).

### Exact probabilities

`src/engine/solver.ts` computes `P(mine)` for every hidden square: frontier squares (those touching a
revealed number) are enumerated with constraint backtracking, split into independent components whose
mine-count polynomials are convolved, and the remaining squares are handled with binomials. On a
36-square board this takes well under a millisecond, so the tooltip can update on every drag frame.
`tests/solver.test.ts` checks it against brute force on random boards.

### Reproducible rounds

Each round is generated from a 32-bit seed (`crypto.getRandomValues`) with a mulberry32 PRNG. The seed
is printed under the prize (`round #…`) and `?seed=<hex>` replays that backyard.

## Layout

```
src/engine/    rng, config (RTP, ammo, item rules), board generation, solver, Game state machine
src/scene/     Three.js: yard, items, slingshot, particles, effects, textures, tweens
src/input/     slingshot pointer input (mouse + touch)
src/ui/        HUD overlay, styles, play-money wallet (localStorage)
src/audio/     synthesized sound effects
tests/         vitest: solver correctness, exact-RTP proofs, rules
scripts/       Monte Carlo simulation, icon generator
```

Play money only: the wallet starts at $1,000 and lives in `localStorage`.
