# Ticket 174: the scrap curve, before and after

**What this measures.** Henry's complaint (2026-09-30) was that biome 0 is short of scrap (recruits, first cards, grinding) and the last biome is long on it (nothing left to buy but upgrades). Ticket 174 made two changes: a run opens on **45 scrap** instead of 20 (174b), and the market and workshop allow **two upgrades per visit** instead of one (174c). This report walks the run walker through both versions and puts the numbers side by side.

## How it was run

- **Walker:** `runWalker.ts` as changed in 174d: every purchase now leaves a `SCRAP` row in the log (before, only income and blueprints did), and at the market and workshop the upgrade policy takes up to `UPGRADES_PER_VISIT` upgrades per visit by its existing ranking (best-scored upgradable card first). The gate's free upgrade stays at one.
- **Upgrade policy ON in both arms.** Without it the walker never buys an upgrade and the late surplus cannot show.
- **Before arm:** the same walker with `STARTING_SCRAP = 20` and `UPGRADES_PER_VISIT = 1` (the two constants put back by hand in a scratch copy; nothing else differs).
- **After arm:** the committed values, 45 and 2.
- **Seeds:** all 12 EA starters, 30 seeds each, 360 walks per arm, the same seeds in both arms (`scrap174:<starter>:<i>`). The per-biome numbers are means over the walks that reached that biome.
- **Reproduce:** `npm run balance:scrap-walk -- --arm after --seeds 30 --out after.json` in each tree, then `npm run balance:scrap-report -- before.json after.json`. About 1.5 hours per arm on two cores.

## Results

### Run shape and win rates

| | before | after |
|---|---|---|
| walks | 360 | 360 |
| mean fights per run | 4.9 | 5.2 |
| mean upgrades bought per run | 0.5 | 1.1 |
| wild fights won | 89.8% (1018/1134) | 90.1% (1056/1172) |
| elite fights won | 55.3% (235/425) | 59.0% (263/446) |
| walks that reached the gym | 36 (10.0%) | 46 (12.8%) |
| walks that cleared the gym | 2 (0.6%) | 4 (1.1%) |

### Per biome

#### Biome 0 (reached: before 360 of 360 walks, after 360 of 360)

| mean per run | before | after | change |
|---|---|---|---|
| fights | 3.4 | 3.4 | +0.0 |
| revisits | 0.0 | 0.0 | 0.0 |
| income | 43.3 | 44.5 | +1.3 |
| spent | 23.0 | 41.7 | +18.7 |
| low point (scrap) | 12.5 | 19.0 | +6.5 |
| scrap at biome end | 40.3 | 47.9 | +7.6 |

#### Biome 1 (reached: before 139 of 360 walks, after 148 of 360)

| mean per run | before | after | change |
|---|---|---|---|
| fights | 2.7 | 2.8 | +0.1 |
| revisits | 0.0 | 0.0 | 0.0 |
| income | 41.0 | 44.6 | +3.6 |
| spent | 51.9 | 57.2 | +5.3 |
| low point (scrap) | 28.7 | 24.5 | -4.2 |
| scrap at biome end | 56.3 | 54.4 | -1.9 |

#### Biome 2 (reached: before 49 of 360 walks, after 59 of 360)

| mean per run | before | after | change |
|---|---|---|---|
| fights | 3.6 | 3.8 | +0.1 |
| revisits | 0.0 | 0.0 | 0.0 |
| income | 44.3 | 47.9 | +3.6 |
| spent | 74.0 | 74.2 | +0.2 |
| low point (scrap) | 25.0 | 18.4 | -6.6 |
| scrap at biome end | 45.7 | 43.1 | -2.6 |

### Spend by reason (mean scrap per run that reached the biome)

| biome | reason | before | after | change |
|---|---|---|---|---|
| 0 | buyMarketCard | 13.1 | 13.2 | +0.0 |
| 0 | upgradeDeckCard | 3.5 | 21.0 | +17.5 |
| 0 | recruitIntoParty | 6.1 | 6.1 | 0.0 |
| 0 | blueprint | 0.0 | 1.1 | +1.1 |
| 0 | event | 0.3 | 0.3 | 0.0 |
| 1 | upgradeDeckCard | 16.9 | 19.4 | +2.5 |
| 1 | buyMarketCard | 17.4 | 17.2 | -0.3 |
| 1 | blueprint | 8.6 | 9.1 | +0.5 |
| 1 | recruitIntoParty | 6.7 | 6.9 | +0.3 |
| 1 | fitPatch | 2.3 | 4.6 | +2.3 |
| 2 | upgradeDeckCard | 24.6 | 26.3 | +1.7 |
| 2 | buyMarketCard | 19.3 | 17.6 | -1.7 |
| 2 | blueprint | 15.3 | 14.4 | -0.9 |
| 2 | recruitIntoParty | 9.7 | 9.3 | -0.4 |
| 2 | fitPatch | 4.6 | 6.1 | +1.5 |
| 2 | event | 0.5 | 0.4 | -0.1 |

## What the numbers say

1. **The opening grant gets spent in biome 0, and mostly on upgrades.** Biome 0 spending rose from 23.0 to 41.7 per run; 17.5 of the 18.7 extra went to upgrades (3.5 to 21.0). Card purchases (13.1 to 13.2) and recruits (6.1 to 6.1) did not move at all. The walker's card and recruit rules were not limited by scrap, so the extra 25 scrap reached the only policy that could use it. The biome-0 low point rose from 12.5 to 19.0 and scrap at the end of the biome from 40.3 to 47.9, so the squeeze is looser by about 6 to 8 scrap on average.
2. **The late surplus is NOT reproduced by the walker, so this run cannot say whether two upgrades per visit fixed it.** In the final biome the walker finishes with about 45 scrap before and 43 after, against 57 to 137 in the human runs (`playtest-results`, read with `npm run balance:scrap-curve`). The reason is shape, not tuning: the walker never revisits a node (revisits are 0.0 in every biome; the human runs show 1 to 12 in biome 0), never sells a card (sales brought the human runs up to 80 scrap in a biome), and takes the shortest path, so its biome 0 is 3.4 fights and 43 income where the human runs are 3 to 8 fights and 80 to 195 income. Only 59 of 360 walks reach the last biome in the after arm (49 before), so that column is also a small sample.
3. **Where the second upgrade slot did show up:** mean upgrades bought per run went from 0.5 to 1.1, and upgrade spending rose in every biome (biome 1: 16.9 to 19.4, biome 2: 24.6 to 26.3).
4. **Win rates moved a little in the good direction and are inside the noise.** Wild fights 89.8% to 90.1%. Elite fights 55.3% to 59.0% (about 3.4 points of standard error at these sizes). Walks that reach the gym 36 to 46 of 360; gym clears 2 to 4 of 360. Nothing here says the changes made the game easier or harder in a way that matters.
5. **Run length did not change:** 4.9 to 5.2 fights per walk. The ticket's worry that adding scrap would lengthen runs does not show, and neither does the hoped-for shortening; the walker does not grind, so it cannot show that either.

## Limits, so nobody reads more into this than is there

- The walker is a poor stand-in for the exact thing 174 is about. Henry's grinding (re-entering the same wild node for scrap) and his late surplus (card sales, extra fights, 45-scrap elites) are both human behaviours the walker does not do. This report shows the **constants did what they were meant to do inside the walker's economy** (more spent early, a higher floor in biome 0, more upgrades bought); it does not measure the human feel.
- Only 2 walks in 360 clear the gym before and 4 after. Do not read the gym line as a balance result.
- The honest check is the next playtest. `RunLogPanel` now has a "Scrap by biome" table, so the same numbers for a human run are one screen away.

## For ticket 176 (the map redesign)

The one structural number the walker does give: on its shortest route biome 0 pays about 43 scrap over 3.4 fights, and that same route is where the first recruit (25) and the first cards (15 to 25) are bought. The human runs that ground (8 fights in biome 0) took 130 to 195 income, so the squeeze Henry feels is about the straight route being thin, not about the average route. If biome 0 gets a layer added in 176, expect about 10 more scrap per added wild fight (a one-enemy wild pays 10).
