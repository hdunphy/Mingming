# Ticket 170c: where does the walker die?

**What this answers.** The run walker is the program that plays whole runs for us (it picks cards, buys, recruits and steps through the map; it fights with the real battle engine). Almost every balance number in the last few tickets came from it. Before anyone says "the game is too hard here", we need to know how much of a result is the game and how much is the walker playing badly. This report follows the walker to the place where each run ends and describes what it was holding when it got there. It is a report only. Nothing about how the walker plays was changed.

## How it was run

- **Measured at** commit `ff4eacb` (the 170c commit in your repository), on **2026-10-01**.
- **Walks:** all 12 EA starters, 30 seeds each, **360 walks**. Tier 0, no modifiers, and **no ghost rule** (a lost fight ends the walk, as it does in every other measurement). The seeds are the tier ladder's own (`tier-ladder:<starter>:<i>`), so these are the same walks as the ladder's Tier 0 row.
- **Walker settings:** the defaults. That matters for one finding below: by default the walker **never buys upgrades** (the upgrade policy is an option that is off unless a report switches it on, as 174's report did).
- **Reproduce:** `BALANCE_CACHE_DIR=/tmp/cache npm run balance -- src/debug/balance/walkerDeaths.balance.ts`. About 40 minutes on two cores.
- **Not modelled:** the run full-heals between nodes, so a fight outside the gym starts at full health. The "HP at the start" line below is only meaningful for the gauntlet.

## The shape of it

Out of 360 walks:

| How the walk ended | Walks |
| --- | --- |
| Cleared the gym | 3 |
| Died in the gauntlet (the three gym fights) | 33 |
| Died on the way to the gym | 324 |
| Ended without dying or clearing | 0 |

So **9 walks in 10 never see the gym**. Only 127 of 360 (35%) even leave the first biome: 233 of the 357 deaths happen in biome 0.

### How many fights did it win before dying?

Counting only the walks that died on the way to the gym (324):

| Fights won | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Walks | 10 | 46 | 77 | 92 | 39 | 18 | 17 | 14 | 7 | 1 | 2 | 1 |

Seven in ten of those deaths (225 of 324) come by the fourth fight. The peak is at three fights won, which is where biome 0's first elite sits.

### What killed it?

By node kind, over all 357 deaths: **elite 195**, wild 116, gym 33, rival 13. By biome: **biome 0: 233**, biome 1: 83, biome 2: 41.

Crossing the two: the **biome 0 elite alone killed 152 walks, 42% of all 360**. Next come biome 0 wilds (70), biome 1 wilds (44), biome 1 elites (38), and the 33 gym deaths (all in the last biome). The three gauntlet fights killed 14, 12 and 7 walks in order, so the first gauntlet fight is the hardest of the three, but the walks that reach the gym lose there about 9 times in 10 (33 deaths and 3 clears out of 36).

The fights that killed were short: **4.4 turns on average**. The element of the killing enemy is close to an even split (Water 145, Fire 126, Nature 123), so no single element is doing the killing. Mean party HP at the start of the killing fight is 0.97 because almost every killing fight was outside the gauntlet and so started at full health; in the gauntlet the party carries damage, and that is the only place the number says anything.

## The walk at the moment it died

| What | Value |
| --- | --- |
| Deck size (mean) | 15.1 cards |
| Deck power (the walker's own card-score average) | 3.3 |
| Corrupted Data (junk) cards | 0.00. No walk ever held one, so junk is not a cause. |
| Scrap unspent, mean / median | **60.6 / 55** |
| Died holding at least 25 scrap | 85.4% |
| Died holding at least 45 scrap (a whole starting purse) | **67.2%** |
| Party size (mean) | **1.36** (1 = never recruited) |
| Died holding a blueprint it never used | **55.2%** |
| Upgrade benches walked past (mean) | 1.28 |
| Upgrades bought (mean) | 0.00 |
| Patch shelves seen / shop patches taken (mean) | 0.67 / 0.07 |

Three things stand out.

**It dies alone.** 257 of the 357 deaths (72%) were a single Mingming. Walks that died with a party of one won 2.8 fights on average and 0.4% of them reached the gym. Walks that died with a party of three won 9.5 fights and 63% of them were in the gym. That is a strong association and I want to be careful with it: a walk that lives longer has more chances to recruit, so part of it runs the other way. What it does show is a gap between what the walker finds and what it uses. 197 walks died holding a blueprint (the item that turns into a second Mingming at a workshop), and those deaths include walks that died in the first biome.

**It dies with money.** Two thirds of the dead hold 45 scrap or more. Walks that survive to four fights or more die holding about 80 on average. At the same time the walker bought **no upgrades at all** in these 360 walks, because that policy is off by default, and it walked past an upgrade bench 1.3 times a run. Part of this is simply that the walker has no way to turn scrap into survival it believes in, and part is that the early fights end before the money matters. This report cannot separate the two. (174's report ran the walker with the upgrade policy on in both arms and found the elite win rate went from 55.3% to 59.0% when the run also got 45 starting scrap and a second bench slot. That is the effect of more money and a second slot, not of switching the policy on, which nobody has measured; it suggests the lever is not large.)

**Its deck is small and weak in the walker's own terms.** An average deck of 15 cards scoring 3.3. For scale, the lowest quarter of dying decks score below 2.45 and the highest quarter above 3.97. I cannot tell from this alone whether 3.3 is low for the game or normal; there is no comparison deck in this report.

## By starter

| Starter | Walks | Cleared | Died in gauntlet | Died before gym | Mean fights won (before-gym deaths) | Killer kinds |
| --- | --- | --- | --- | --- | --- | --- |
| fenrir_v1 | 30 | 0 | 3 | 27 | 3.48 | wild 14, elite 12, gym 3, rival 1 |
| fenrir_v2 | 30 | 0 | 1 | 29 | 3.52 | elite 18, wild 9, rival 2, gym 1 |
| skoll_v1 | 30 | 0 | 2 | 28 | 2.64 | elite 16, wild 11, gym 2, rival 1 |
| skoll_v2 | 30 | 2 | 7 | 21 | 4.29 | elite 17, gym 7, wild 4 |
| kraken_v1 | 30 | 0 | 5 | 25 | 4.36 | elite 21, gym 5, wild 4 |
| kraken_v2 | 30 | 0 | 6 | 24 | 3.75 | elite 22, gym 6, wild 2 |
| jormungandr_v1 | 30 | 0 | 1 | 29 | 1.76 | wild 18, elite 9, rival 2, gym 1 |
| jormungandr_v2 | 30 | 1 | 3 | 26 | 3.73 | elite 20, wild 5, gym 3, rival 1 |
| ratatoskr_v1 | 30 | 0 | 0 | 30 | 2.57 | elite 17, wild 12, rival 1 |
| ratatoskr_v2 | 30 | 0 | 3 | 27 | 2.96 | elite 14, wild 13, gym 3 |
| huldra_v1 | 30 | 0 | 1 | 29 | 2.62 | elite 17, wild 11, gym 1, rival 1 |
| huldra_v2 | 30 | 0 | 1 | 29 | 2.69 | wild 13, elite 12, rival 4, gym 1 |

The walker does very differently with different starters, and that is a finding on its own. The best three (skoll_v2, kraken_v1, kraken_v2) get to the gym in 5 to 9 walks of 30 and die mostly to the elite or the gym. **jormungandr_v1 is the outlier at the other end**: it averages 1.8 fights won and loses to a plain wild fight 18 times in 30 (every other starter loses to a wild fewer than 15 times, most fewer than 13). ratatoskr_v1 never reached the gym in 30 walks. With 30 walks a starter the difference between 3.5 and 4.3 fights is within noise; the gap between jormungandr_v1 and the rest is not.

## What this means for the numbers we quote

- A "win rate" or "clear rate" from this walker is mostly a measure of **the biome 0 elite and a one-Mingming party**. When a tier looks 5 points harder or a card 5 points weaker, most of the walks that decide it died long before the part of the game that changed.
- That is why 170a's ghost walk exists for the gauntlet (a gauntlet measured on real walks has 36 parties to look at; on ghost walks it has all 360).
- Nothing here says the game's first elite is too hard for a person. A person recruits, upgrades and reads the fight. It says the walker's first elite is a wall.

## The three most likely causes, ranked

I did not test any of these. They are the three readings the numbers support best, and 170d should choose among them (or reject them) with a measured before and after.

1. **The walker fights the first-biome elite with the deck and the party it has, and loses.** The biome 0 elite ended 152 of 360 walks (42%), after about three fights, and biome 0 wilds ended 70 more; 233 of 357 deaths are in biome 0. If any one thing changes the walker's reach, it is how it gets through biome 0 (what it buys and picks before the elite, whether it fights the elite at all when it has other routes, or what it does at the nodes before it).
2. **The walker almost never recruits.** The mean party at death is 1.36, 72% of deaths are a single Mingming, and 55% of the dead were holding a blueprint they never turned into a second Mingming. Walks that died with three Mingmings won 9.5 fights and reached the gym 63% of the time; walks with one won 2.8 and reached it 0.4%. Some of that gap is just living longer, but a blueprint in the pocket at death is a plain, countable miss.
3. **The walker dies holding scrap and never upgrades.** Mean scrap at death is 60.6, two thirds of the dead held 45 or more, the upgrade policy is off by default so 0.00 upgrades were bought, and the walker passed 1.3 upgrade benches a run. After 174 gave each visit two upgrade slots this is a bigger gap than it was. The one lever with any measurement behind it is 174's (elite wins 55.3% to 59.0% when scrap and slots both went up, upgrades on in both arms), which suggests it is the smallest of the three, but it is the cheapest to test: it is one option the walker already has.

**Stopped here.** Row 170d is yours to choose from this list. I have not started it.
