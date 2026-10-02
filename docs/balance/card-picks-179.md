# Ticket 179: one card pick per fight, measured

**What this measures.** Henry's complaint (2026-10-01) was scrap bloat: a 3v3 win handed out three card picks, most of them ended up in the collection and got sold (5 to 20 scrap each) on top of the fight's own scrap. Ticket 179a changed `rollDropTable` so every fight offers **one** pick of three, whatever its size. Blueprint rolls and fight scrap are untouched (checked byte for byte, see the commit). This report walks the run walker through the parent and through 179a and puts the numbers side by side.

## How it was run

- **Walker:** `runWalker.ts` exactly as in 174 (upgrade policy ON, up to two upgrades per visit, opening scrap 45).
- **Before arm:** the parent of 179a (commit `b328792`).
- **After arm:** 179a (`3baeec7`).
- **Seeds:** all 12 EA starters, 30 seeds each, 360 walks per arm, the same seeds in both arms (`scrap174:<starter>:<i>`). Per-biome numbers are means over the walks that reached that biome.
- **Control:** the before arm reproduces 174's "after" arm to the digit (360 walks, 5.2 fights, 1056/1172 wild and 263/446 elite fights won, 46 gym reaches, 4 clears, biome-0 income 44.5). So the instrument is the one 174 used and nothing drifted between 174 and 179.
- **Reproduce:** `npx vite-node src/debug/balance/runCardPicksWalk.ts --arm after --seeds 30 --out after.json` in each tree, then `npx vite-node src/debug/balance/runCardPicksReport.ts before.json after.json`. About 40 to 70 minutes per arm on two cores. (New files in this commit: `cardPicksWalk.ts` and its test, `runCardPicksWalk.ts`, `runCardPicksReport.ts`. 174's scripts are untouched.)

## Results

### Cards per run

| mean per run | before | after | change |
|---|---|---|---|
| pick screens shown | 5.3 | 4.1 | -1.2 |
| cards offered | 16.0 | 12.3 | -3.7 |
| cards taken into the deck | 5.2 | 4.0 | -1.2 |
| cards taken to the collection | 0.1 | 0.1 | -0.0 |
| picks skipped | 0.0 | 0.0 | 0.0 |
| cards sold (walker never sells) | 0.0 | 0.0 | 0.0 |
| scrap from selling (walker never sells) | 0.0 | 0.0 | 0.0 |
| scrap if every collection card were sold (upper bound) | 0.8 | 0.8 | +0.0 |

How to read the last three rows: **the walker never sells a card.** Selling is a human move (the shop's Sell tab) and the walker has no sell policy, so "cards sold" and "scrap from selling" are 0 in both arms by construction. The only selling number the walker can give is the last row, an **upper bound**: what the cards it sent to the collection would fetch if every one were sold. That row did not move (0.8 both arms) because the walker takes almost every card into the deck and rarely shelves one (0.1 a run).

### Final deck size

"Counted cards" excludes junk. "The floor" is `minimumActiveDeck` for the party the walk ended with: 8, 13 or 18 cards for one, two or three members.

| | before | after |
|---|---|---|
| all walks: walks | 360 | 360 |
| all walks: mean final deck (counted cards) | 16.0 | 14.8 |
| all walks: mean floor for the party it ended with | 10.1 | 10.1 |
| all walks: at the floor | 4.7% (17/360) | 4.7% (17/360) |
| all walks: 20+ cards | 22.2% (80/360) | 20.8% (75/360) |
| walks that reached the gym: walks | 46 | 46 |
| walks that reached the gym: mean final deck (counted cards) | 34.3 | 26.8 |
| walks that reached the gym: mean floor for the party it ended with | 15.9 | 15.8 |
| walks that reached the gym: at the floor | 0.0% (0/46) | 0.0% (0/46) |
| walks that reached the gym: 20+ cards | 100.0% (46/46) | 100.0% (46/46) |

### Run shape and win rates

| | before | after |
|---|---|---|
| walks | 360 | 360 |
| mean fights per run | 5.2 | 5.2 |
| mean upgrades bought per run | 1.1 | 1.2 |
| wild fights won | 90.1% (1056/1172) | 90.0% (1061/1179) |
| elite fights won | 59.0% (263/446) | 59.5% (266/447) |
| walks that reached the gym | 46 (12.8%) | 46 (12.8%) |
| walks that cleared the gym | 4 (1.1%) | 7 (1.9%) |

### Per biome

### Biome 0 (reached: before 360 of 360 walks, after 360 of 360)

| mean per run | before | after | change |
|---|---|---|---|
| fights | 3.4 | 3.4 | 0.0 |
| revisits | 0.0 | 0.0 | 0.0 |
| income | 44.5 | 44.4 | -0.1 |
| spent | 41.7 | 41.7 | 0.0 |
| low point (scrap) | 19.0 | 19.0 | 0.0 |
| scrap at biome end | 47.9 | 47.7 | -0.1 |

### Biome 1 (reached: before 148 of 360 walks, after 147 of 360)

| mean per run | before | after | change |
|---|---|---|---|
| fights | 2.8 | 2.9 | +0.1 |
| revisits | 0.0 | 0.0 | 0.0 |
| income | 44.6 | 47.0 | +2.4 |
| spent | 57.2 | 58.5 | +1.3 |
| low point (scrap) | 24.5 | 23.7 | -0.8 |
| scrap at biome end | 54.4 | 55.4 | +1.1 |

### Biome 2 (reached: before 59 of 360 walks, after 63 of 360)

| mean per run | before | after | change |
|---|---|---|---|
| fights | 3.8 | 3.8 | -0.0 |
| revisits | 0.0 | 0.0 | 0.0 |
| income | 47.9 | 45.0 | -2.9 |
| spent | 74.2 | 75.6 | +1.5 |
| low point (scrap) | 18.4 | 20.8 | +2.4 |
| scrap at biome end | 43.1 | 44.0 | +0.8 |

### Spend by reason (mean scrap per run that reached the biome)

| biome | reason | before | after | change |
|---|---|---|---|---|
| 0 | upgradeDeckCard | 21.0 | 21.0 | 0.0 |
| 0 | buyMarketCard | 13.2 | 13.2 | 0.0 |
| 0 | recruitIntoParty | 6.1 | 6.1 | 0.0 |
| 0 | blueprint | 1.1 | 1.1 | 0.0 |
| 0 | event | 0.3 | 0.3 | 0.0 |
| 1 | upgradeDeckCard | 19.4 | 19.5 | +0.1 |
| 1 | buyMarketCard | 17.2 | 17.4 | +0.3 |
| 1 | blueprint | 9.1 | 9.5 | +0.4 |
| 1 | recruitIntoParty | 6.9 | 7.1 | +0.2 |
| 1 | fitPatch | 4.6 | 4.9 | +0.3 |
| 2 | upgradeDeckCard | 26.3 | 28.3 | +2.0 |
| 2 | buyMarketCard | 17.6 | 17.4 | -0.2 |
| 2 | blueprint | 14.4 | 15.9 | +1.5 |
| 2 | recruitIntoParty | 9.3 | 9.1 | -0.2 |
| 2 | fitPatch | 6.1 | 5.0 | -1.1 |
| 2 | event | 0.4 | 0.0 | -0.4 |

## What the numbers say

1. **The change did what it says on the walker's cards.** Pick screens per run fell from 5.3 to 4.1 and cards offered from 16.0 to 12.3 (3.7 fewer). The walker takes almost everything it is shown, so cards taken into the deck fell by the same 1.2 (5.2 to 4.0).
2. **Scrap did not move, and in this instrument it cannot.** Income, spending, the low point and scrap at the end of each biome are within about three points of the before arm in every biome. The last biome ends at 43.1 before and 44.0 after (biome 2, 59 and 63 walks). That is not evidence that the change did nothing to the late surplus. It is the same limit 174 hit: the walker never sells, never revisits and takes the shortest path, so it cannot show the late surplus at all, before or after. **What 179 was built to cut is the scrap from selling surplus cards, and this walk has no selling in it.**
3. **The size of the effect for a human, as an estimate and not a measurement.** The walker's runs are mostly one or two bodies (the mean floor is 10.1 cards, about 1.4 bodies), so they lose only 1.2 picks. A human 3v3 fight used to hand out 3 cards and now hands out 1, so two fewer cards per full-party fight. At 5 to 20 scrap a card that is up to 10 to 40 scrap of selling income less per full-party fight, and about 6 to 24 per walker-shaped run. The fight's own scrap (10, 15 or 20 by size) is unchanged.
4. **Decks stay healthy.** Walks that reached the gym ended with 34.3 cards before and 26.8 after: still above the 20 to 25 gate, and 46 of 46 in both arms were at 20 or more and none at the floor. The all-walk mean fell from 16.0 to 14.8 and the share at the floor stayed at 4.7% (17 walks), which is the early deaths. The walker is a greedy taker, so a human who skips more picks will have a thinner deck than this.
5. **Win rates did not move.** Wild fights 90.1% to 90.0%, elite 59.0% to 59.5%, gym reaches 46 and 46. Gym clears went from 4 to 7 of 360. At these sizes that is noise (the walks diverge after the first changed pick); do not read it as a balance result.

## Verdict

**Late-run scrap (biome 2, scrap at the end of the biome) did not go down in the walker: 43.1 before, 44.0 after, because the walker never sells, so this run cannot show 179's real effect.** What it does show is that cards offered fell by 3.7 a run, decks still reach a healthy size (26.8 cards at the gym against a gate of 20 to 25, none at the floor), and nothing else moved: win rates, fight scrap and blueprint income are unchanged.

No number was changed to hit a target and no lever needs pulling on this evidence. If the next human playtest shows decks that feel thin, the levers the ticket names are shop card stock, event card picks, and `SALVAGE_CHOICES_PER_FOE` (the three options inside the one pick).

## Limits

- The walker has no sell policy, so the thing 179 targets (scrap from selling) is not measured. Teaching the walker to sell would change the instrument for every ticket that uses it, so it was not done here. The next human playtest, read with `RunLogPanel`'s "Scrap by biome" table, is the honest check.
- Only 63 of 360 after-arm walks reach the last biome and 46 reach the gym, so the biome 2 and gym-deck columns are small samples.
- The 170e Draft Start golden hash in `draftPolicy.test.ts` moved once on purpose (`d1a64b1db0e0586a` to `942eb155ecef6c8e`), because that walk now takes one pick per fight. The other draft walk and the 170a default walk did not move.
