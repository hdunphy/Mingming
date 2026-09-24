# Ticket 157 — the run walker's first report: the curve is there, and the wall is fight one

**Run 2026-09-24.** `npm run balance:walk -- --seeds 10 --label t157`, all twelve EA starters,
**120 runs**, policy v0. Raw output: `results/t157/walk-10.txt`.

Ten seeds per starter rather than §3's thirty, and the reason is cost: a run that SURVIVES costs
about 60 seconds (kraken_v1's ten took 634 s; jormungandr_v1's ten took 2 s because they end
immediately). Thirty × twelve is a four-to-six hour job and is the right next run; ten × twelve is
enough for the three findings below, all of which are far outside sampling noise.

## 1. The answer to 162c: **0 of 120 runs cleared the gym**

Four starters reached it at all — `skoll_v1`, `skoll_v2`, `kraken_v1`, `huldra_v1` — and all four
lost there. **100 of the 120 deaths are in biome 0**, 14 in biome 1 and 6 in biome 2.

## 2. The deck-power curve EXISTS, and it is strong

Mean 149c score of the active deck, pooled across starters:

| fight | 1 | 4 | 8 | at the gym |
|---|---|---|---|---|
| deck power | **2.03** (n=12) | **3.11** (n=11) | **3.91** (n=6) | **4.31** (n=4) |

**The deck roughly doubles between fight 1 and fight 8.** Per §4's three-way test, that rules out
the first branch: *"if deck power is flat fight 1 → 12, the rewards are the problem (153)"*. It is
not flat, so they are not.

**And it is not survivorship either, which was the first thing to check.** Only six starters reach
fight 8, so a rising column could just mean the strong decks are the ones still standing. They did
not start stronger: **the six that reach fight 8 open at 2.06 against the all-twelve 2.03.** The
climb is the rewards working, not selection.

## 3. So the fights are the problem, and specifically FIGHT ONE

Win rate by fight index, conditional on having reached it:

| starter | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| jormungandr_v1 | **10%** | 100 | 100 | 100 | 100 | 100 |
| fenrir_v1 | **40%** | 75 | 67 | 50 | 100 | 100 |
| kraken_v2 | **60%** | 67 | 50 | 50 | 0 | — |
| ratatoskr_v2 | **70%** | 86 | 0 | — | — | — |
| skoll_v1 | **80%** | 75 | 17 | 100 | 100 | 100 |
| kraken_v1 | 90 | 89 | 75 | 67 | 75 | 67 |
| huldra_v1 / huldra_v2 / fenrir_v2 / skoll_v2 | 100 | 60–100 | 67–100 | 17–50 | 100 | 100 |

**The ruled target for a wild at tier 1 is 95%** (`RUN_GATE_TARGETS.wild`). The mean opening-fight
win rate across the twelve is **77.5%**, **eight of twelve are under the target**, five are at or
under 80%, and `jormungandr_v1` reads **10%** — it loses nine of ten opening fights and then wins
the next five in a row.

**This is corroborated by the instrument that already existed**, which matters because it means the
walker is not the thing that is wrong: measured in the same session, `runGate`'s own wild / biome-0
cell reads **67% over 24 samples against its 95% target**. The walker's pooled fight-1 rate (58% over
24 mixed-starter samples) is the same number inside its error bar. **Two independent harnesses say
the opening fight is roughly thirty points under its ruled target.**

## 4. The reward table is offering improvements — 153's number is ~2%

*"How often is the best available pick worse than every card already in the deck"*, over 341 picks:

| | picks taken | → collection |
|---|---|---|
| pooled | **341** of 1,023 offered | **about 8 picks, ~2.4%** |

(The pooled count is reconstructed from twelve rounded per-starter percentages, which is a digit
this report should not have had to lose — the printer now emits the raw count beside the
percentage, so the next run states it exactly.) Per starter the range is **0–7%**, and **seven of
twelve are at zero**: they never once took a pick that failed to beat something they were already
carrying. That is directly counter to the impression Henry's playtest left — *"picks go to the
collection because nothing improves the deck"* — and the gap between the two is itself a finding:
the machine takes the best card on offer every time and never has to look at it, while a player has
to SEE which one it is. Per §4's third branch, that points at **visibility (158/159)**, not at the
table.

## 5. What else the numbers say

- **Survivors end a fight at 28–58% of their pool.** Regular nodes full-heal, so this is not
  attrition — it is how close these fights are. `ratatoskr_v2` is the lowest at 28%.
- **The recruit policy behaves as ruled.** `skoll_v2` recruited `fenrir_v2` six times of seven
  (*"Every Burn Sköll adds is Sharp for Fenrir"*); `kraken_v1` took `jormungandr_v1` four times of
  six (*"Both engines eat Undertow"*); `ratatoskr_v2` took `huldra_v1` four times (*"Rat's Weakened
  feeds Sap Strength"*). Every one of those is an authored partner out of 158-r1's registry grammar.
  Nobody recruited for the counter element alone, because a partner was always available first —
  which is the ruling's priority working, and also means the counter-element clause is **untested by
  this run**.
- **The shop is barely used**: 51 purchases and 33 recruits across 120 runs. Most runs die before they bank 15
  scrap or before a marketplace is on a shortest path.

## 6. What this run does NOT say

Policy v0 is dumb on purpose and the curve it draws is the FLOOR a human should beat. It never
benches (ruled), never edits the deck, never removes a card, buys at most one card per shop visit,
and equips the first blueprint it finds. A human who benches the type-disadvantaged body, or who
plays around the opening fight, will do better than this. **What a floor at 0/120 says is that the
floor is below the table**, not that the game is unwinnable.

It also does not measure the counter-element recruit clause (never reached), the patch economy
beyond "take the first offer", or anything at all past biome 0 for eight of the twelve starters.

## 7. Decisions needed

1. **The opening fight is thirty points under its ruled target, on two independent instruments.**
   That is a number to rule on, not to tune around. `jormungandr_v1` at 10% is the extreme and is
   probably its own question.
2. **Thirty seeds × twelve starters is the next run** and it is a four-to-six hour job. Worth
   queueing once (1) has a direction, so it measures the game after the ruling rather than before.
