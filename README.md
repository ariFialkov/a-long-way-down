# A Long Way Down

A one-tap 3D betting-style game (demo credits only). Tap to place the stake; the character steps off
a clifftop or rooftop and ragdolls down through procedurally generated sections of cliff face and
apartment blocks, bouncing off rocks, lamps and signs, smashing gnome huts, clotheslines and the odd
bag of sugar, until a ledge or balcony stops the fall. Runs on desktop and mobile and installs as a PWA.

```bash
npm install
npm run dev      # play at http://localhost:5173
npm run build    # production build + service worker in dist/
npm run sim      # verify RTP and the planner over 20,000 rounds
```

## How a round works

1. **Outcome** (`src/outcome.js`) - the result is drawn *before* anything moves: how many sections are
   fallen through and the win in units (1/100 of the stake). The paytable returns exactly **96% RTP**
   with a mean of **3.0 sections** per round. Change `TARGET_RTP` / `SECTION_DIST` / `RAW` to retune.
2. **Plan** (`src/planner.js`) - a piecewise-ballistic fall is laid out through the sections. Objects
   are placed *on* the trajectory (and decoys safely off it), the floor opening goes where the path
   crosses the floor, and a stopper is placed where the total has been reached. The win is then split
   across every bounce, smash and section clear so they add up to exactly the drawn amount.
3. **Show** (`src/main.js`, `src/ragdoll.js`, `src/world/`) - the torso follows the planned path while
   the rest of the body is a verlet ragdoll colliding with the scenery; chunks are generated from the
   plan plus a decor seed.

Add `?sections=4&units=400&seed=3&biome=cliff` in dev mode to force a specific round.

> Demo only: balance lives in `localStorage` and the RNG runs in the browser. A real-money version
> needs the outcome module moved to a certified server-side RNG and the usual licensing.
