# Ticket 157 — Automate the progression test: a run played by the machine, read as a curve

> **RULED 2026-09-25 (157-r2/r3): the scripted opener holds the start kit MINUS its payoff (the player keeps theirs); fight one stays graded at 95; jormungandr_v1's five swaps one undertow for surge_protection (re-tagged glue). See HANDOFF 2026-09-25.**

> **157-r1 SHIPPED 2026-09-25 (`21ba532`). The ladder mirrors the start-kit shape at biome 0 and every start five carries one payoff. Both instruments say (a) is worth +8.7 to +11.5 points — on fights TWO onward. Fight one did not move (75.8% over 2,400 runs) and could not have: it is the scripted opening, which has mirrored the start kit since ticket 24. Two decisions are back with Henry — the opening fight cannot reach 95 while it is a mirror, and jormungandr_v1's 19% is a deck-composition question, not a power one. See §7 and `results/t157r1/FINDINGS.md`.**

> **RULED 2026-09-24 on the first report (0/120 gym clears, fight one 77.5%): the enemy ladder mirrors the start-kit shape in biome 0 AND every start five carries exactly one payoff (157-r1); the 30×12 walk waits for a 5-seed fight-one read near 95. See HANDOFF 2026-09-24 evening block.**

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

---

## 7. Write-back (2026-09-25) — 157-r1 shipped, and the fight-one read

Commit `21ba532`. Full numbers in `results/t157r1/FINDINGS.md`; the short version, because the
report is what Henry reads.

### What landed

**(a)** `enemyLoadoutFor(kind, tier, biomeIndex)`. A biome-0 wild holds `start-kit-plus-generics` —
`startDeckFor`'s own composition, so the mirror is the SAME code the player's opening goes through
rather than a second copy of it. Biome 1 onward is the full tuned kit, untouched. Elites and the
gauntlet move at no depth. `biomeIndex` defaults to **1**, so a caller that has not been taught
about this gets the old behaviour rather than a silently gentler fight.

**The biome and the tier are two independent adjustments, and the first draft got that wrong.** It
returned early at biome 0 and ate ticket 60's tier raise with it: a tier-3 run's first-biome wilds
came out greedy and firmware-less, which is that rung quietly deleted for a third of the map. The
biome decides what the deck HOLDS; the tier decides how well it is PLAYED.

**(b)** All twelve kits audited. Ten already carried exactly one payoff. `skoll_v1` carried four
(`flare_burst` ×2 @3.00, `brute_force` @3.10, `snap` @2.80) and is now `fury_strike ×2 ·
flare_burst · howl · forage`. **`jormungandr_v2` carries two and cannot be fixed inside its own
five**: TOXIN_FANG's deck holds only three non-payoff non-consume cards, so one payoff plus all of
them is four and the fifth must be a payoff. Exempted in `startKits.test.ts` with the arithmetic
pinned rather than with a waiver — fixing it needs a DECK change, which is Henry's.

### The read

| | | |
|---|---|---|
| fight one (the scripted opening), 2,400 runs | **75.8%** (74.1–77.5) | −19.2pt |
| fight two (an ordinary biome-0 wild), 1,820 paired runs | 77.5% → **86.2%** | **+8.7pt from (a)** |
| `run-gate --cells wild:biome0`, 400 battles | 67% → **78.5%** | **+11.5pt from (a)** |
| `skoll_v1` fight one, old kit → new kit, 200 each | 80.0% → **61.0%** | **−19pt from (b)** |

**Fight one did not move, and could not have.** It is the SCRIPTED opening (`isOpeningFight`), which
has held `OPENING_FIGHT_LOADOUT` — already `start-kit-plus-generics` — since ticket 24. The two
sides' openings were symmetric in the one fight the diagnosis was about. (a) fixed every *other*
biome-0 wild, which is where both instruments show it paying.

### The decision this produces

**The floor is no longer a floor**: the designated gentlest fight is now ten points harder than the
ordinary wild after it, because at fight one both sides hold eight cards from the same table and by
fight two the player has picked and the enemy has not.

**And 95% is not reachable while fight one is a mirror.** Same shape, same count, same IVs, same AI,
same beam; the player's only edge is firmware, and that edge measures at +25.8 points over even.
Either the opening enemy drops the three generics — note that is `start-kit`, the *sharper* list, so
it is not simply "shorter" — or fight one is not graded against `RUN_GATE_TARGETS.wild`.

### jormungandr_v1, read after the row as ruled

**19.0% over 200 runs, and it is not a power problem.** v1's five scores 11.10 by 149c; v2's scores
10.80 and reads **98%**. Three tenths apart in value, seventy-nine points apart in the fight.

```
v1  undertow@1.50 · undertow@1.50 · blind_spot@1.10 · serpents_coil@2.50 · riptide_run@4.50
v2  corrosive_bolt@1.80 · corrosive_bolt@1.80 · venom_fang@3.00 · serpent_flurry@3.00 · tackle@1.20
```

`undertow` is a LOOPING FREE DRAW and `blind_spot` is a debuff: **three of v1's five cards do not
advance the fight**, and its single payoff is one copy. It opens on two live cards against five,
loses over 5.4 turns with 6% of its pool left, and is out-tempoed rather than burst down.

The one-payoff rule constrains how many payoffs a five may carry and says nothing about how many of
the remaining four may be draw or debuff. **v1 is legal under (b) and unplayable at fight one.**
Deck composition, so Henry's.

### The instrument

`npm run balance:walk -- --seeds 200 --fight N` truncates the walk after N fights and prints the
fight-N table against the gate's own target. It is a truncation, not a second harness: same
`createRun`, same node, same `rollEncounter`, same `runOne`, pinned by a test that asserts a
truncated walk's fight one is byte-identical to a full walk's on the same seed. 2,400 fight-one runs
cost about a minute; the full walk that produced the first report cost hours for five seeds each.
