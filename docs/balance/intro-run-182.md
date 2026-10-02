# Intro run measurement (ticket 182c)

Measured 2026-10-02 with the walker (`src/debug/balance/runWalker.ts`, `intro: true`), read by
`src/debug/balance/introWalk.ts`, run by `src/debug/balance/runIntroWalk.ts`:

```
npx vite-node src/debug/balance/runIntroWalk.ts -- --seeds 30 --label final --arm plain --starter kraken_v1
```

The walker plays the hand-built intro map with its ordinary card, upgrade and recruit choices, with the intro's own
rules on (no patches, no sell panel, no blueprint shelf, only the stray Mingming's two options). Fights are 2 wild
fights then the leader (2 enemies). **No card was added or changed.** Only the leader's species and IVs were tuned.

## Result: the leader as shipped

Seeds `final:<starter>:0` to `29`, a lost fight ends the walk (the honest arm).

| Starter (intro biome) | Recruit the walker took | Reached leader | Leader won | Win rate |
|---|---|---|---|---|
| Kraken (Fire) | Ratatoskr (30 of 30) | 30 | 28 | 93% |
| Fenrir (Nature) | Ratatoskr (30 of 30) | 30 | 30 | 100% |
| Ratatoskr (Water) | Fenrir (30 of 30) | 30 | 29 | 97% |
| **All** | | 90 | **87** | **97%** |

Target was at least 75%, met on every starter. The walker plays the cards sensibly but does not read the screen, so a
new player will win less often than this; the margin is deliberate, not a sign the leader is soft. Fenrir's intro is the
easy one whatever is done to it (Fire beats Nature, and Nature has only two species to choose from).

## The leader pairs

| Intro biome | Leader pair as shipped |
|---|---|
| Fire (Kraken starter) | Skoll + Skoll, v1, IV 0 |
| Nature (Fenrir starter) | Huldra + Ratatoskr, v1, IV 31 |
| Water (Ratatoskr starter) | Jormungandr + Jormungandr, v1, IV 0 |

Same species twice is fine for the player (two nicknamed leaders) but is a design choice to confirm: the Fire and Water
pools have only two species each, and the stronger one of each pair (Fenrir, Kraken) made the leader too hard for the
weakest starters.

## Every pair tried (10 seeds each unless noted; leader wins / runs that reached it)

The first column is the starter, because the pair only matters against the starter that meets it. Small samples:
10 seeds is plus or minus 15 points, which is why the shipped pairs were then re-measured at 30.

| Starter | Pair (IV) | Result |
|---|---|---|
| Kraken | Skoll + Fenrir (10) | 4/10 (and 2/3 in the first probe) |
| Kraken | Skoll + Fenrir (0) | 7/10 |
| Kraken | Fenrir + Fenrir (5) | 5/10 |
| Kraken | Skoll + Skoll (5) | 9/10 |
| Kraken | Skoll (5) + Fenrir (0) | 5/10 |
| Kraken | Skoll (0) + Fenrir (5) | 5/10 |
| Kraken | Skoll + Skoll (10) | 7/10 |
| **Kraken** | **Skoll + Skoll (0)** | **28/30** |
| Fenrir | Huldra + Ratatoskr (10) | 10/10 (3/3 in the first probe) |
| Fenrir | Huldra + Ratatoskr (31) | 9/9 reached (one run lost earlier) |
| Fenrir | Huldra + Huldra (15) | 9/9 reached |
| Fenrir | Huldra + Huldra (31) | 9/9 reached |
| **Fenrir** | **Huldra + Ratatoskr (31)** | **30/30** |
| Ratatoskr | Jormungandr + Kraken (10) | 0/10 (0/3 in the first probe) |
| Ratatoskr | Jormungandr + Kraken (0) | 3/10 |
| Ratatoskr | Jormungandr + Kraken (4) | 2/10 |
| Ratatoskr | Jormungandr + Kraken (8) | 2/10 |
| Ratatoskr | Jormungandr + Jormungandr (0) | 8/10 |
| Ratatoskr | Jormungandr + Jormungandr (10) | 8/10 |
| Ratatoskr | Jormungandr alone (0), information only | 10/10 |
| **Ratatoskr** | **Jormungandr + Jormungandr (0)** | **29/30** |

What it says: IVs barely matter (the whole 0 to 31 band moved Water by about one fight in ten); species decides it.
Kraken is the strongest body in the Water pool and Ratatoskr is the weakest starter, so that pairing was never going to
reach 75%.

## Length (the 15 to 20 minute target)

| Starter | Fights per run | Turns per fight (mean) | Longest fight | Turns per run | Minutes at 20 s a turn |
|---|---|---|---|---|---|
| Kraken | 3.0 | 2.9 | 4 | 8.8 | 2.9 |
| Fenrir | 3.0 | 2.9 | 4 | 8.8 | 2.9 |
| Ratatoskr | 3.0 | 4.1 | 6 | 12.3 | 4.1 |

Twenty seconds a turn is an assumption (Henry times his own run in 181 Phase 1 for the real figure). **This is far
under the 15 to 20 minute target:** the fights are about three turns each, so the fighting is three or four minutes and
reading, shopping and the stray Mingming add a few more. The estimate does not include time spent reading screens, which
a new player will spend more of than the walker. Per the ticket the map was not changed. If the real time confirms it is
short, the cheapest changes are another wild fight in the map (`introMap.ts`) or a third enemy on the leader
(`introLeader.ts`), each a small edit. Neither was made.

## What changed in the walker to measure this

`WalkInput.intro` (off by default, so every other walk is exactly as it was) starts the walk from `createIntroRun`, uses
the intro's gauntlet length, skips the gate patch, the shop patch, junk removal and the shop blueprint when the intro's
rules say they are not there, and gives the stray Mingming's recruit only its two options.
