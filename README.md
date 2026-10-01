# Molesweeper

A casual 3D stepper betting game for desktop and mobile, installable as a PWA.
Minesweeper's logic, whack-a-mole's attitude: slingshot firecrackers into a fenced
backyard, blow squares open, dig up moles and treasure, and cash out before you find a mine.

- **Engine:** TypeScript, no framework. Exact-probability solver, deterministic seeded rounds.
- **Scene:** Three.js. Procedural models and textures only, no asset downloads, works offline.
- **PWA:** `npm run build:pwa` adds a manifest and a precaching service worker (add to home screen on
  iOS/Android, install on desktop). The plain `npm run build` is a static WebGL site for hosts that only
  accept standard build files.
- **Audio:** synthesized with the Web Audio API (pop, flak, mushroom cloud rumble, disco jingle).

**Play it:** https://arifialkov.github.io/molesweeper/ (deployed by `.github/workflows/pages.yml` on every push).

## Run it

```bash
npm install
npm run dev        # dev server on your LAN, open it on your phone too
npm run build      # typecheck + static production build into dist/ (html, js, css, png only)
npm run build:pwa  # same, plus the web manifest and service worker for an installable PWA
npm run preview    # serve dist/
npm test           # engine tests (solver vs brute force, exact-RTP proofs)
npm run sim        # Monte Carlo on the production board, prints RTP per strategy
npm run icons      # regenerate the PWA icons (pure JS PNG writer)
```

## How a round plays

1. Pick your ammo. The ammo is the bet and you use it for the whole round:
   firecracker $5, grenade $10, ICBM $25, disco bomb $50. Each has its own explosion.
2. The backyard *is* the board: a mowed-lawn checkerboard of 36 squares under a translucent grid,
   4×9 on a phone and the same board rotated to 9×4 on a wide screen, filling the display.
   3–7 squares are trees or rocks (dead squares, never mines, never counted). 5–7 squares are mines.
3. Press anywhere and drag to pull the slingshot, release to fire. Aiming is free: the shot lands
   where the reticle points and the closest square blows open.
4. A safe hit blows a crater and the prize pops out and stays on the board. About one prize square in
   four also has a number pressed into the dirt counting the mines in the 8 neighbours, exactly like
   minesweeper. Squares the game opens for free always show their number.
5. You never get to do the maths. Whenever the visible numbers prove a square safe, the game opens it
   for free (worth nothing); whenever they prove a mine, the game digs it up and plants a flag on it.
   Every square you can still hit is a genuine gamble, so the round can end on any shot.
6. Cash out any time after your first shot, or keep shooting. A mine ends the round and wrecks the yard.

What you can dig up (the skin is chosen by what the shot paid):

| Item | Effect | When it shows up |
| --- | --- | --- |
| 🐹 Mole | adds under 0.35× bet | about 70 % of safe shots |
| 🦫 Groundhog | adds 0.35×–1× bet | about 25 % of safe shots |
| 💎 Buried treasure | adds 1× bet and up | about 5 % of safe shots, big pots |
| 🏛️ Aqueduct | multiplies the prize ×2–×25 | squares with ≥ 50 % mine risk |
| 🛢️ Oil seep | multiplies ×50 / ×75 / ×100 | a jackpot that can strike on any safe shot, ~1 round in 500 |
| 🌳🪨 Trees & rocks | dead squares, burn mark on hit | 3–7 per yard |

Disco bombs shower confetti and make the mole or groundhog dance to a short jingle. ICBMs leave a mushroom cloud.

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
- **No skill is left on the table.** True numbers inevitably create proofs (two 1s sharing a single
  hidden neighbour, a 1 whose other neighbours you have opened). Rather than let the player harvest
  them, the game resolves every proof the moment it exists: proven-safe squares open for free, proven
  mines get flagged, repeating until every hidden square has `0 < p < 1`. This depends only on what
  the player can see, so it leaks nothing and the pricing stays exact.
- **Numbers on prize squares are a coin flip.** With every number shown, minesweeper boards are mostly
  deducible and the game would resolve a third of all yards by itself after a shot or two. A square
  the player shoots therefore shows its number with probability
  `NUMBER_SHOW_CHANCE` (0.25); squares the game opens for free always do. The flip is seeded and never
  looks at the value, so a missing number carries no information; the solver simply treats that square
  as safe with an unknown count. `scripts/tune-numbers.ts` shows the trade-off.
- **The oil seep is a funded jackpot.** Each safe shot has a small chance `OIL_SEEP.chance` of also
  striking oil, multiplying the pot by 50, 75 or 100. Every ordinary gain is multiplied by
  `shave = 1 / (1 + chance × (E[K] − 1))` so that `E[step] = V` still holds exactly: the martingale, and
  therefore the 96 % for every strategy, is untouched. At the default rate ordinary prizes are about
  3 % smaller in expectation per shot (moles roughly 15 % smaller). The draw comes from its own seeded
  stream so it never depends on how the board unfolded.
- **Item skins are cosmetic**, chosen from what the shot paid (`ITEM_RULES`), so their frequency can be
  retuned freely without touching the RTP. `scripts/tune-items.ts` prints the prize distribution.
- Item types are cosmetic: mole / groundhog / treasure by how much the shot added, aqueduct / oil seep
  when the shot at least doubled the pot. The pay table lives in `src/engine/config.ts`.
- The `RTP` constant is the only house-edge knob. Because the edge is applied once up front, the
  first safe shot already nets a little above the bet (the brief's "takes a few shots to get back to
  the bet" would require the edge to fall unevenly on early cash-outs, which makes RTP depend on the
  player's strategy; this design keeps it flat).

### Exact probabilities

`src/engine/solver.ts` computes `P(mine)` for every hidden square given the readable numbers, the
flagged mines and the total mine count: frontier squares (those touching a readable number) are
enumerated with constraint backtracking, split into independent components whose mine-count
polynomials are convolved, and the remaining squares are handled with binomials. On a
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
