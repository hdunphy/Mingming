# Ticket 157 — Automate the progression test: a run played by the machine, read as a curve

> **Status: CLOSED 2026-09-24 — `runWalker` is built and its first report is in (`results/t157/FINDINGS.md`): 0 of 120 runs cleared the gym, the deck-power curve is real (2.03 → 3.91 fight 1 → 8 and not survivorship), and the wall is the OPENING FIGHT at 77.5% against a ruled 95%. The instrument is the deliverable and it is done; the numbers are Henry's to rule on. A policy v1 reopens a row here, not the ticket.**

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

## 5. RULED by Henry, 2026-09-24

1. **Baseline: as written** — the run-start deck ("let's try it like this for now").
2. **Never bench**, but **recruit strategically**: the walker picks recruits for synergy and for the counter to the gym. The tags
   are not in the registry — they live in `collection-v2/collection.json`: each `os[]` entry's `cur` / `tempo` (currency × tempo) and
   `partners[]` (which OS feeds which). Policy v0 reads that file: prefer a recruit that is a listed partner of a body already in the
   party, and prefer the element that counters the gym (`gyms.ts` counter cycle Fire > Nature > Water > Fire — a Water/Water/Fire gym
   wants a Nature/Nature/Water party; the gym's `leaderComp` is known at run start). Log the recruit reasons.
3. **Starters: the current EA twelve** (collection v2 / the EMBER_FUSE-era kits). 151 is superseded by 160/162.
4. **Picks by 149c score**, and **log every offer and every pick by card id** (`PICK { offered: [ids], taken: id, score }`) so the
   choices can be reviewed later; print the picked cards in the run read.

Legion: build `runWalker` (§3) on those four; output in 156's row schema; `npm run balance:walk -- --seeds 30 --starter <id>`.

---

## 6. Write-back (2026-09-24) — the walker is built, and its first report

`src/debug/balance/runWalker.ts` + `runRunWalker.ts`; `npm run balance:walk -- --seeds 30 --starter <id>`.
Tests in `runWalker.test.ts` (the policy and the joins, cheap, in the gate) and
`runWalker.balance.ts` (whole runs, expensive, in `npm run balance`).

### The one structural rule of the build

**The walker holds no second opinion about any rule the game already has.** It moves the run by
dispatching `runSlice`'s own actions into a real store, rolls fights with `rollEncounter` and
`rollGauntletFight`, prices shops with `marketplace.ts`, and rolls rewards with `rollDropTable`.
What it adds is a POLICY — which node, which card, which body — and nothing else. `runGate.ts`'s
header warns about exactly the alternative, and a harness that reimplements a rule measures the
reimplementation.

The four ruled rows (§5) are one exported function each, so each can be argued with in isolation:
`chooseStep`, `choosePick`, `chooseRecruit`, and the fight itself.

**The route tie-break is the part to disagree with first.** §3 says *"shortest path node by node"*,
which leaves the choice WITHIN a layer open. A BFS discards anything not on a shortest path (a
walker that wanders measures a different run length than the one being asked about), and among what
is left the order is: workshop while a blueprint is held → marketplace → fight → node id. A random
tie-break would have made *"did the walker reach a shop"* a coin flip, and the shop is one of the
three levers 153 is about.

**§5.2's tags are not where the ruling says they are, and that is deliberate.** The ruling points at
`collection-v2/collection.json`; 158-r1 moved them into `osGrammar.ts`, which is why that row was
taken before this one. The walker reads the registry like every other consumer and parses no design
file.

### Two engine changes it needed, both small and both general

`RunResult` gained `playerEnd` and `enemyEnd`. Every other field on it is a SUMMARY, because every
other consumer measures a pool of battles; the walker is the first that plays them in sequence.
`playerEnd` is what carries HP through the gauntlet's three fights (the only place a run carries HP
at all — *"FULL HEAL between regular nodes"*). `enemyEnd` is not symmetry: **`rollDropTable` pays
only for bodies at `currentHp <= 0`**, so a walker that handed it the party as ROLLED gets an empty
bundle. The first build of this file did exactly that and measured a run in which no fight ever paid
a card — which read like a devastating finding about the reward table.

The join is POSITIONAL, and that is the second trap: `buildScenarioState` mints its own entities, so
the ids in `enemyEnd` are the battle's and never the encounter's. An id join matches nothing and
looks exactly like a fight where everybody lived.

### The first report — `results/t157/FINDINGS.md`, raw at `results/t157/walk-10.txt`

Ten seeds × twelve starters = **120 runs**, not §3's thirty: a run that SURVIVES costs about sixty
seconds (kraken_v1's ten took 634 s; jormungandr_v1's ten took 2 s because they end immediately).
Thirty × twelve is a four-to-six hour job and is the right NEXT run.

**1. 162c's question, answered: 0 of 120 runs cleared the gym.** Four starters reached it and all
four lost there. **100 of the 120 deaths are in biome 0.**

**2. The deck-power curve exists and is strong.** 2.03 → 3.11 → 3.91 → 4.31 at fights 1 / 4 / 8 / gym.
**And it is not survivorship**: the six starters that reach fight 8 open at 2.06 against the
all-twelve 2.03, so the climb is the rewards working rather than the strong decks being the
survivors. Per §4's first branch, **the rewards are not the problem.**

**3. So the fights are, and specifically fight ONE.** Mean opening-fight win rate **77.5%** against
`RUN_GATE_TARGETS.wild`'s ruled **95%**; eight of twelve starters are under it; `jormungandr_v1`
reads **10%** and then wins its next five in a row. **Corroborated by the instrument that already
existed** — measured in the same session, `runGate`'s own wild/biome-0 cell reads **67% over 24
samples**. Two independent harnesses put the opening fight about thirty points under target, which
is what makes this a finding about the game rather than about the walker.

**4. 153's number is about 2%.** Of 341 picks taken, roughly eight were worse than everything
already in the deck; seven of twelve starters never took one at all. That is directly counter to the
impression the playtest left (*"picks go to the collection because nothing improves the deck"*), and
the gap is itself the finding: the machine takes the best card on offer every time and never has to
FIND it. Per §4's third branch, that points at visibility (158/159), not at the table.

**5. The recruit policy behaves as ruled and the counter-element clause went untested.** skoll_v2
took fenrir_v2 six times of seven, kraken_v1 took jormungandr_v1 four times, ratatoskr_v2 took
huldra_v1 four times — every one an authored partner from 158-r1's grammar. **Nobody ever recruited
for the counter element alone, because a partner was always available first**, which is the ruling's
priority working and also means that half of §5.2 is unmeasured.

### What this report does not say

Policy v0 is dumb on purpose; the curve is **the FLOOR a human should beat**. It never benches
(ruled), never edits the deck, never removes a card, buys at most one card per shop visit, and
equips the first blueprint it finds. A floor at 0/120 says the floor is below the table, not that
the game is unwinnable.

One deviation from §3 worth naming: the table says *"beam 0 (the calibrated setting)"*, and the
walker plays at the beam the ENCOUNTER carries (8). Taking §3's number would have meant the harness
holding a second opinion about the AI width against the run's own, which is the one thing this file
is built not to do. It is also most of the cost.

### Decisions needed

1. **The opening fight is ~30 points under its ruled target on two independent instruments.** A
   number to rule on, not to tune around. `jormungandr_v1` at 10% is probably its own question.
2. **Thirty seeds × twelve starters is the next run**, four to six hours. Worth queueing after (1)
   has a direction, so it measures the game after the ruling rather than before.
