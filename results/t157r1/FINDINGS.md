# 157-r1 — the fight-one read

Measured 2026-09-25 on commit `21ba532` (157-r1 as landed). Two instruments, both the ones already
in the repo: `npm run balance:walk -- --fight N` (new this row) and `npm run balance:run-gate`.

---

## 1. The headline

**Fight one reads 75.8% over 2,400 runs (95% CI 74.1–77.5) against the ruled 95%. It did not move.**

The first report read 77.5% over 120 runs. The new number is the same number measured twenty times
as precisely.

**And it could not have moved, because 157-r1(a) does not touch fight one.** Fight one of every run
is the SCRIPTED opening fight — `isOpeningFight`, gated on `fightsResolved === 0` — and it has held
`OPENING_FIGHT_LOADOUT`, which is `start-kit-plus-generics`, since ticket 24. The two sides' openings
were ALREADY symmetric in the one fight the diagnosis was about. What 157-r1(a) changed is every
OTHER biome-0 wild, which is fights two through about five of a run.

That is not the ruling failing. It is the ruling landing on a different fight from the one the
77.5% came from, and the read is what shows which.

---

## 2. What 157-r1(a) IS worth — measured twice, and they agree

| instrument | fight | before (a) | after (a) | delta |
|---|---|---|---|---|
| walker, `--fight 2`, 1,820 paired runs | ordinary biome-0 wild | 77.5% (75.6–79.4) | **86.2%** (84.6–87.7) | **+8.7pt** |
| `balance:run-gate --cells wild:biome0`, 400 battles | ordinary biome-0 wild | 67% | **78.5%** (74.2–82.2) | **+11.5pt** |

Paired: the same seeds, the same graphs, the same enemies, identical per-starter denominators. The
control arm was produced by disabling the biome-0 clause in `enemyLoadoutFor` and re-running; the
file was restored and md5-checked afterwards.

Both intervals exclude the other arm's point estimate. The ruling is worth about nine to eleven
points on the fights it reaches.

---

## 3. The finding this produces: **the floor is no longer a floor**

| fight | what it is | win rate |
|---|---|---|
| 1 | the scripted opening — the gentlest fight in the game by construction | **75.8%** |
| 2 | an ordinary biome-0 wild | **86.2%** |

After 157-r1(a), the run's designated easiest fight is **ten points harder** than the ordinary fight
that follows it. Ticket 24's floor exists to make the first fight the gentlest one; it now makes it
the hardest of the first five.

The cause is not a bug. At fight one both sides hold exactly eight cards from the same `startKits`
table. By fight two the player has taken a pick and possibly bought a card, and the enemy has not.
Symmetry at fight one plus growth after it inverts the order.

---

## 4. 95% is not reachable with a symmetric opening

At fight one the two sides hold the same shape, the same card count, the same IVs, and are played by
the same AI at the same beam. **The player's only edge is its firmware** — the enemy's is off.

That edge measures at +25.8 points over even (75.8% against 50%). To reach 95% the opening enemy has
to hold *less* than the player, not the same. The mirror and the target are in direct tension, and
the tension is arithmetic rather than tuning: no amount of per-card work moves a mirror match to 95%
while it stays a mirror.

**Decision for Henry, and it is the row's real question:** either the opening enemy drops the three
generics (a five-card deck against the player's eight, which is `start-kit` — the sharper list, so
this is not simply "shorter"), or fight one is not graded against `RUN_GATE_TARGETS.wild`.

---

## 5. 157-r1(b) moved fight one DOWN, and here is the number

`skoll_v1` was the only one of the twelve whose five changed. Measured both ways, 200 runs each,
same instrument:

| skoll_v1's opening five | fight one |
|---|---|
| before — `fury_strike, flare_burst ×2, brute_force, snap` (four payoffs) | **80.0%** (74.5–85.5) |
| after — `fury_strike ×2, flare_burst, howl, forage` (one payoff) | **61.0%** (54.2–67.8) |

**−19 points, intervals disjoint.** This is the ruling working exactly as written — *"the engine
should be weak"* — and it is worth naming that the ruling and the 95% target pull in opposite
directions on the same fight. Ten of the twelve kits were already one-payoff, so this is the whole
cost of (b); it is not a hidden tax spread across the roster.

---

## 6. The full fight-one table (200 runs per starter, 2,400 total)

| starter | n | win% | vs 95 | mean turns | end HP |
|---|---|---|---|---|---|
| jormungandr_v2 | 200 | 98.0% | +3.0 | 3.7 | 44% |
| skoll_v2 | 200 | 95.0% | +0.0 | 2.7 | 47% |
| kraken_v1 | 200 | 94.5% | −0.5 | 3.5 | 41% |
| kraken_v2 | 200 | 86.5% | −8.5 | 3.9 | 31% |
| fenrir_v2 | 200 | 84.0% | −11.0 | 3.7 | 43% |
| huldra_v1 | 200 | 83.0% | −12.0 | 6.4 | 46% |
| huldra_v2 | 200 | 75.0% | −20.0 | 6.9 | 33% |
| ratatoskr_v1 | 200 | 73.0% | −22.0 | 5.5 | 46% |
| fenrir_v1 | 200 | 71.0% | −24.0 | 2.6 | 14% |
| ratatoskr_v2 | 200 | 70.0% | −25.0 | 4.1 | 23% |
| skoll_v1 | 200 | 61.0% | −34.0 | 3.6 | 22% |
| jormungandr_v1 | 200 | **19.0%** | −76.0 | 5.4 | 6% |

---

## 7. jormungandr_v1, read after the row as ruled

**19.0% over 200 runs, and it is not a power problem.**

| | kit total (149c) | fight one |
|---|---|---|
| jormungandr_v1 | 11.10 | **19.0%** |
| jormungandr_v2 | 10.80 | **98.0%** |

Two decks of the same species, three tenths of a point apart in scored value, **seventy-nine points
apart in the fight**. Nothing about level, stats or scoring explains that.

What separates them is what the five cards DO:

```
jormungandr_v1  undertow@1.50 · undertow@1.50 · blind_spot@1.10 · serpents_coil@2.50 · riptide_run@4.50
jormungandr_v2  corrosive_bolt@1.80 · corrosive_bolt@1.80 · venom_fang@3.00 · serpent_flurry@3.00 · tackle@1.20
```

`undertow` is a LOOPING FREE DRAW (`LOOPING_FREE_DRAWS`) and `blind_spot` is a debuff. **Three of
v1's five cards do not advance the fight**, and its single payoff is one copy of `riptide_run`. It
opens on two live cards against an enemy's five, which is why it takes 5.4 turns to lose with 6% of
its pool left — it is not being burst down, it is being out-tempoed while it draws.

v2 opens on four cards that hit. Same species, same scored power, opposite shape.

**This is a deck-composition question, so it is Henry's.** Naming it precisely: the one-payoff rule
(157-r1(b)) says how many payoffs a five may carry; it says nothing about how many of the remaining
four may be draw or debuff. v1 is legal under (b) and unplayable at fight one.

---

## 8. Not fixed here, recorded

- **`runGate.ts`'s line ~160 docblock still cites `KIT_FRACTION_BY_BIOME[0]`**, a table ticket 60
  deleted. The prose is correct about the behaviour and wrong about where it comes from.
- **`gullinbursti_v2` 58.5%** — parked post-EA per the ruling, with *"2.5 reads high on this body"*.

---

## How to reproduce

```
npm run balance:walk -- --seeds 200 --fight 1 --label t157r1
npm run balance:walk -- --seeds 200 --fight 2 --label t157r1
npm run balance:run-gate -- --cells wild:biome0 --iterations 400
npx vite-node scratch/t157r1_kitpower.ts
```
