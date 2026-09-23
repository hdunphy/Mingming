# Ticket 157 — Automate the progression test: a run played by the machine, read as a curve

**Type:** design session → instrument. **Status:** OPEN, asked by Henry 2026-09-20: *"how can we
automate that progression testing. I have limited time to play test so need some ways for you to
help me."* **Relates to:** 148 (progression curve — the question this answers), 153 (rewards),
151 (EA deck rework), 156 (per-fight rows; the same schema this writes), 142 (route), ticket 61 /
`runGate.ts` (the fight-at-a-node harness this extends), 158, 159.

**Research:** [single-player-card-games.md](../research/single-player-card-games.md) §3–4 — the walker's policy v0 must include *skip* and *remove* as picks, or it measures a dilution curve no genre game has.

## 1. What Henry's two playtests measured, and what they could not

Two runs, ~six hours of his time, produced: Rat dies turn 1 in the Fire biome; the party benches
itself down to 1v1 by biome 3; picks go to the collection because nothing improves the deck; the
elite at Emberglass ends it. Those are real findings, but each is one sample of one route with one
starter, and the question behind them — *does the deck at fight 12 beat the deck at fight 1, and by
how much?* — needs dozens of runs per starter to answer. Henry cannot play dozens of runs. The
engine can.

## 2. What already exists, and the exact gap

- `runGate.ts` (ticket 61) already rolls a **real** encounter at a **real** node of a **real**
  region graph from a real `createRun` state, and plays it headless with the same AI on both sides.
  It is deliberately fight-at-a-node, not run: its own header says *"What this sample deliberately
  does NOT model is deck DRIFT"* and *"no AI policy exists to fire [a Driver]"*. The party walks in
  with the run-start deck every time.
- `runBatch.ts` plays a composed scenario N times, seeded, reproducible.
- 156 now records `FIGHT_DECK` / `FIGHT_TURN` rows and `runRead.ts` prints the deck-power curve for
  a human run.
- `powerscale.ts` (149c) scores any deck.

**The gap is the walk between fights.** Nothing chooses a node, takes a reward, buys at the shop,
benches a body, or equips a blueprint. That walk *is* progression; everything else is built.

## 3. The proposal: `runWalker` — an AI run, end to end

A headless policy that plays the run layer with the *simplest defensible* choices, so the curve it
produces is the floor a human should beat, not a ceiling:

| decision | policy v0 (dumb on purpose) | policy v1 (when v0 is measured) |
|---|---|---|
| route | Henry's ruled route [counter, gym element, gym biome] (142d); shortest path node by node | branch on scouted reward type |
| fight | the existing `TacticalAI`, both sides, beam 0 (the calibrated setting) | — |
| reward pick | take the card whose 149c score is highest **and** whose element/OS tag matches an active body; else the top-scoring card into the collection | 158's synergy tags once they exist |
| shop | buy the highest-scored affordable card once per visit; refresh never | 142e–g rules |
| bench/loadout | never bench (measures the type-disadvantage cost Henry paid by hand) | bench on counter-biome entry, as Henry did |
| blueprint | equip the first found | — |

Output per run is exactly 156's row schema (`FIGHT_DECK`, `FIGHT_TURN`, `FIGHT_ENDED`, `RUN_ENDED`)
so `runRead.ts` reads a machine run and a human run with the same table. Aggregated over N seeds ×
starters:

- **deck-power curve** — mean 149c score of the active deck at fight 1, 4, 8, gym; the 148 number.
- **win rate by fight index** and **first-death turn by species/biome** — Rat's turn-1 death should
  fall out of this as a row, not a memory.
- **pick census** — how often the best available pick is worse than every card already in the deck
  (the "sent to collection" rate; 153's number).
- **bench pressure** — HP fraction of the type-disadvantaged body at biome entry (the 142 §6 cost).

Cost: a run is ~14 fights × the batch cost of one 3v3 fight; `runGate` already runs 12 samples per
cell in CI-able time. 30 seeds × 6 starters is an overnight job, run in foreground chunks the way the
149b census was.

## 4. What it will *not* tell us, said up front

A policy-v0 run measures the run *system* — is there a curve to climb at all — not whether a human
can find it. If the machine's deck power is flat fight 1→12, the rewards are the problem (153). If it
climbs but the machine still loses the gym, the fights are the problem (148/151). If it climbs and
wins, and Henry doesn't, the *visibility* of the good pick is the problem (158/159). The instrument's
value is telling those three apart before another six hours are spent.

## 5. Session questions for Henry

1. Is the run-start deck the right *baseline*, or should the curve be measured against "deck at fight
   1 with the seed kit's payoffs still in the reward pool" (my 09-20 lever)? Both are one flag.
2. Should policy v0 bench like Henry did, or never bench? (Never-bench measures the cost of the
   disadvantage; bench-like-Henry measures the cost of the fix. I would run both.)
3. Which starters first — the six EA species, or the ones 151 is reworking?
4. Is the 149c score an acceptable stand-in for "deck quality" at the pick, or does it need a
   playtest-derived weight (e.g. cards a human would take)?

## 6. Gate

`npm run balance:walk -- --seeds 30 --starter fenrir_v1` prints the four tables above; the row
export round-trips through `runLog`'s zod schema; `runRead.ts` reads it unchanged; `BALANCE_ONLY`
semantics identical to `runGate`.
