# Ticket 178: Search for the strongest teams and decks (MAP-Elites)

> **PARKED 2026-10-01 (Henry).** Its premise was ticket 177's cheap AI, which missed its bar (24.8% wins against the lite AI's 37%). Re-plan before building; do not start.

**Type:** balance tooling. **Status:** OPEN, **queued behind tickets 170 (rows 170a/170b) and 177; do not start until Henry says go.** Decisions S1–S4 below have recommended defaults; build those unless Henry rules otherwise.

**Henry (2026-10-01):** *"Should we look to find OP deck combos with a genetic algorithm or some other algorithm? Instead of brute forcing everything, use some algorithm to figure out what card/Mingming/OS combination is best at beating each gym or completing a run."*

**The approach: MAP-Elites, a quality-diversity search.** A plain genetic algorithm converges on one winning deck. MAP-Elites keeps the best deck found for each "niche" (here, each team of three Mingmings with their firmware) against each gym. The result is a map: the best deck for every team, which teams dominate, which cards keep appearing in winning decks (overpowered suspects), and which never appear at all (dead cards).

**This is a red team, not a tuner.** It changes **no game code and no game data**. It finds suspects; Henry rules on them. Expect it to find exploits and bugs: that's part of the value.

---

## Decisions (recommended defaults first)

- **S1. What counts as a legal deck** (so results are decks a player could actually build in a run):
  - a party of 3 `LAUNCH_SPECIES`, no two the same species, each with one of its two firmware
  - deck size 20–25 (the 20–25 gate)
  - each card is in that party's `rewardCardPool`, a member's start kit, or the market's neutral list (`MARKET_NEUTRAL_UTILITY`), and passes `isRewardable` or is a kit card
  - at most 2 copies of any card
  - at most 8 upgraded (`+`) cards
  - no patches, Drivers or macros in this ticket

  Every one of those numbers is Henry's to change.
- **S2. The niches: one per party (species + firmware), per gym.** That's C(6,3) = 20 species trios × 2³ = 8 firmware choices = 160 parties, × 3 gyms. Each cell keeps its best deck.
- **S3. What a deck is scored on:** the gauntlet of the chosen gym, all three fights, with HP carried and the 30% repair between fights, from full HP. The score is mean fights won (0–3) plus the clear rate, over the same 10 seeds for every candidate. A whole run is out of scope; a run adds map and shop noise that would drown the deck signal.
- **S4. Which AI plays:** the search uses the cheap AI (177) on **both** sides, for speed. The best decks are then **re-verified with the real gym AI** (`ENEMY_LADDER.gauntlet`) on fresh seeds before anything is reported as a finding.

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Nothing under `src/engine`, `src/ui` or any game data JSON changes.** All new code goes in `src/debug/balance/deckSearch/`, as small single-purpose modules: genome, legality, mutation, archive, fitness, runner, report. If a row seems to need an engine change, stop and ask Henry.
4. **Deterministic:** one seed string drives the whole search. The same seed and budget give the same archive.
5. **Gate:** `npm run gate` green before each commit. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.**
6. **Search output is not committed** (`results/deck-search/`); the report under `docs/balance/` is.
7. **Report** in plain English at the end.

| Row | What |
|---|---|
| 178a | The genome, and the legality check (S1) |
| 178b | Mutation and crossover that always produce legal genomes |
| 178c | Fitness: a gauntlet from a genome (S3, S4) |
| 178d | The MAP-Elites archive and an overnight runner that can resume |
| 178e | Re-verify the best with the real gym AI, and write the report |

---

## 178a: The genome and the legality check

1. **`genome.ts`:** `DeckGenome = { party: [{ species, osId }] × 3, cards: Record<cardId, count> }`. Upgraded cards are their own ids (`scald+`), using `upgradeIdFor` to find them. Include a stable `genomeKey(g)` (sorted, so equal genomes have equal keys).
2. **`legality.ts`:** `legalCardPool(party)` (the set S1 allows) and `checkGenome(g): string[]` (empty when legal; otherwise every rule broken, in words).
3. **Tests:**
   - a hand-made legal genome passes
   - each S1 rule, broken alone, is reported
   - a card outside the party's elements and not neutral is refused
   - a kit card is allowed even if it isn't rewardable

## 178b: Mutation and crossover

1. **`mutate.ts`:** `mutate(g, rng)` applies one of:
   - swap a card for another legal one
   - add a card (if under 25)
   - remove a card (if over 20)
   - upgrade or un-upgrade one card (within the 8 limit)
   - swap one member's firmware
   - swap one member's species, then repair the deck: drop cards no longer legal and refill to 20 from the new legal pool

   Equal odds, seeded `rng`.
2. **`crossover.ts`:** `crossover(a, b, rng)` for two genomes **with the same party** only: each card count comes from one parent or the other, then the result is repaired to a legal size.
3. **Tests:** 10,000 random mutations and crossovers from a legal start are all legal (`checkGenome` empty); the same seed gives the same sequence.

## 178c: Fitness

1. **`fitness.ts`:** `scoreGenome(g, gymId, seeds): { fightsWon, cleared, perSeed[] }`.
   - Build a gym-gate snapshot from the genome: the party at full HP, the deck as given, no macros or Drivers. Then play the gauntlet with 170a's `playGauntlet`, at tier 0.
   - **Both sides' AI set to `cheap`** (177e's `playerAiTier` / `enemyAiTier`).
   - **HP carries and the 30% repair applies,** exactly as the game does (173).
   - Score: `fightsWon` = mean gauntlet fights won over the seeds; `cleared` = share of seeds that cleared all three.
   - Ranking key: `cleared` first, then `fightsWon`.
2. **Seeds are the same for every genome** (common random numbers), so differences are the deck's, not the dice's.
3. **Tests:** the same genome and seeds give the same score; a genome that can't legally be built is refused before any fight runs.

## 178d: The archive and the runner

1. **`archive.ts`:** a map from niche key `gymId|species+osId ×3 (sorted)` to `{ genome, score, evaluations }`. `tryInsert(candidate)` keeps the better one.
2. **`runDeckSearch.ts`** (CLI: `npx tsx src/debug/balance/deckSearch/runDeckSearch.ts --gym gym_emberfall --budget 20000 --seed ds1`):
   1. **Seed the archive:** for every party, a starting deck made of each member's start kit (`startKitIdsFor`) plus random legal cards up to 20.
   2. **Loop until the evaluation budget is spent:** pick a random filled niche, mutate (90%) or crossover with another deck of the same party (10%), score the result, and try to insert it into **the child's own niche**. A species swap moves the child to a different niche, which is how the search explores.
   3. **Checkpoint** to `results/deck-search/<gym>/archive.json` every 500 evaluations. Re-running with the same arguments resumes from the checkpoint.
   4. **Print progress:** evaluations done, niches filled, best `cleared` per gym, evaluations per minute.
3. **Default budget:** sized so one gym finishes overnight on Henry's PC. Measure evaluations per minute on a 200-evaluation run first, and put the measured number in the commit message.
4. **Tests:** on a stub fitness (a fake score function), the archive fills, a better genome replaces a worse one in its niche, and a resumed run continues to exactly the archive an uninterrupted run reaches.

## 178e: Re-verify and report

1. **Re-verification:** for each gym, take the 10 best niches. Re-score each with the **real gym AI on the enemy side** (`ENEMY_LADDER.gauntlet`, as `rollGauntletFight` sets it), the cheap AI still playing the player, on **30 fresh seeds**. Report both the search score and the verified score; a big drop means the cheap enemy was exploitable, and that's a finding for ticket 177.
2. **`docs/balance/deck-search-178.md`** (LF), per gym, in plain English:
   - **The best teams:** the 10 verified best (party, firmware, the decklist, clear rate).
   - **Overpowered suspects:** cards in the most top-decile decks, with the share of top decks that run them.
   - **Dead cards:** legal cards in no top-half deck in any niche.
   - **Team strength:** clear rate per species and per firmware, averaged over the niches that include it.
   - **Against the authored EA kits:** how the best deck for each starter's own party compares with what the walker builds.
3. **Do not change any card, kit or number.** End with a short "suspects for Henry" list, each with the numbers behind it.

---

## Done when

- `runDeckSearch` runs overnight per gym, resumes after an interruption, and is deterministic.
- `docs/balance/deck-search-178.md` lists, per gym, the best verified teams and decks, the overpowered suspects and the dead cards, with the numbers.
- No game code or data changed.

## Resolution

_(parked, not closed)_
