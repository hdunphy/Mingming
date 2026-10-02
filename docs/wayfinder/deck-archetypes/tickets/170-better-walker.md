# Ticket 170: A better walker, so Tier 3 can be measured

> **2026-10-02: built except 170d.** 170a, 170b, 170c and 170e are built (`510efbc..398439e`). **170d waits on Henry naming the fixes** from 170c's ranked list (`docs/balance/`, "where the walker dies"). Stays open on this map. **2026-10-02 (later):** Henry wants a picture-led deep dive on why the walker fails before he names the fixes: [ticket 187](187-walker-deep-dive.md), parked, saved for later. 170d waits on it.

**Type:** balance tooling (walker and balance checks only). **Status:** OPEN, **do not start until Henry says go.** Henry asked for this on 2026-09-29, after the report on ticket 169j.

**Why.** Ticket 169j added a balance check (`src/debug/balance/tierLadder.balance.ts`) that walks every EA starter at each tier and asserts that the mean number of fights won never goes up as the tier goes up. It passes, but it cannot say anything about Tier 3. The measured numbers (`docs/balance/tier-ladder-169.md`, 4 seeds per starter, 48 walks per tier):

| Tier | Fights won | Reach the gym | Clear the gym |
|---|---|---|---|
| 0 | 4.25 | 14.6% | 6.3% |
| 1 | 3.10 | 4.2% | 2.1% |
| 2 | 2.94 | 2.1% | 2.1% |
| 3 | 2.94 | 2.1% | 2.1% |

- **Tier 3 only changes the three gauntlet fights** (the leader's Driver, row 169c). The walker reaches the gym in about 15% of Tier 0 runs and about 2% of Tier 2 and Tier 3 runs, so on 47 of 48 seeds the Tier 3 walk is the very same walk as Tier 2. The two rows match to the last digit. That is the walker's reach, not a fault in Tier 3, but it means **nobody has measured whether Tier 3 is harder than Tier 2.**
- **The walker dies early and we do not know why.** It wins about 89% of wild fights at Tier 0, yet only about 1 run in 7 reaches the gym. A human reaches the gym far more often than that. Until we know where the walker dies, we cannot tell "the game is hard" from "the walker plays badly", and every number in the balance reports is a mix of the two.
- **The Draft Start drafter is a stand-in.** In 169j it takes the cards the game would have dealt anyway whenever the offers allow, so the Draft Start report shows nothing about what a good human drafter gains.

**The standing law still holds:** a tier never scales a stat. This ticket changes **no game code and no game data**. It only changes what is under `src/debug/balance/` and adds reports under `docs/balance/`. If a row seems to need a change to anything under `src/engine`, `src/ui` or a JSON data file, **stop and ask Henry.**

Five rows, one commit each, **failing test first**. Build them in order.

| Row | What |
|---|---|
| 170a | A walk that gets to the gym every time (the "ghost walk"), split into two halves so tiers can share one deck |
| 170b | The tier ladder gets a gauntlet table and a Tier 3 check that can actually fail |
| 170c | Where does the walker die? A report, and no policy change |
| 170d | Fix the walker's worst mistakes, one per commit, each measured (rows chosen by Henry after 170c) |
| 170e | A drafter for Draft Start that picks the best card, not the dealt card |

---

## How to work this ticket (read before any row)

1. **Read the whole row first.** Search for the names quoted in the row; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
4. **Defaults must reproduce today's walks exactly.** Every new option on `WalkInput` is optional, and leaving it out gives byte-for-byte the walk 169j produces. Row 170a includes a test for that; every later row keeps it green.
5. **Numbers move in 5s and nothing is tuned.** This ticket measures. If a measurement looks wrong for the game (a tier too easy, a modifier too strong), report it to Henry with the numbers and change nothing.
6. **Small single-purpose modules.** New logic goes in its own file under `src/debug/balance/` (for example `ghostWalk.ts`, `walkerDeaths.ts`, `draftPolicy.ts`), not into the 1,400-line `runWalker.ts`. `runWalker.ts` may gain a hook or an option, not a new subsystem.
7. **Engine purity.** No React, Redux, `Math.random` or `Date.now` anywhere a walk depends on. Every random draw goes through the seeded streams the walker already uses.
8. **Run the gate before every commit** (`npm run gate` must be green). The commit message ends with `HANDOFF: <one sentence>`.
9. **Commits are authored by Henry and carry no Co-Authored-By line. Do not push.**
10. **Files:** CRLF under `docs/wayfinder`, LF for new `src/` and `docs/balance` files.

---

## 170a: A walk that gets to the gym every time

The gauntlet is three fights with no healing between them. To measure it we need many parties standing at the gym gate, and today only 1 walk in 7 gets there.

**The idea (the "ghost walk").** Walk the map as today, but when a fight **before the gym** is lost, count it as a win for the run's purposes: the party is fully healed as it is after any won fight, the rewards are rolled as for a win, and the walk carries on. The result is a party with the kind of deck a run that kept winning would have, standing at the gym. Each ghost fight is counted (`ghostFights`), so a report can say how much of the deck came from fights the walker really won.

**Two halves, so tiers can share a deck.**

1. `walkToGym(input)`: does the ghost walk at the tier 0 rules and returns a **snapshot** of the run at the gym gate (the `IRunState`, the party, the scrap, the deck, `ghostFights`, and the number of fights really won).
2. `playGauntlet(snapshot, tier, modifiers?)`: starts from a snapshot with the tier set, does the gym gate steps the walker already does (free upgrade, patch), plays the three gauntlet fights, and returns the result of each (won or lost, HP carried, turns).

The snapshot is built once per seed and **every tier plays the gauntlet from the same snapshot**. That is the point: the deck, the party and the HP are identical, and only the tier differs. It is also cheap. A map walk costs minutes; a gauntlet is three fights. So 12 starters x 30 seeds is 360 map walks once, plus 1,440 gauntlets.

**What this deliberately does not measure.** Tiers 1 and 2 also change the fights *before* the gym (firmware, lite AI, the extra elite). Under a shared snapshot those changes are invisible, so this measures **the gauntlet alone**. The existing ladder (fights won per run) keeps measuring the whole run. The two tables answer different questions and both go in the report.

**Open question for Henry (my recommendation is written first).** The ghost walk gives the party a deck it may not have earned. The other option is a fixed **reference deck** per starter (the median deck of the real walks that did reach the gym), which is simpler and needs no ghost rule, but hides how much variation in decks matters. I recommend the ghost walk; if Henry prefers the reference deck, only this row changes.

### Tests (write first)

- With nothing set, `walkRun` returns the same result as 169j for a fixed seed (compare the whole result object for two seeds and two tiers).
- A ghost walk on a seed known to die early (pick one from the 169j sample) reaches the gym and reports `ghostFights >= 1`.
- Two calls to `playGauntlet` from one snapshot at the same tier give the same result (the snapshot is not mutated).
- The snapshot's deck at tier 3 is identical to the snapshot's deck at tier 0 (one snapshot, many tiers).
- A ghost walk never wins a fight it did not play: the fight log has the real result, and a ghost fight is marked `ghost: true`.

---

## 170b: The tier ladder gets a gauntlet table and a Tier 3 check

Edit `src/debug/balance/tierLadder.balance.ts` and `tierLadderTable.ts` (both from 169j).

1. Add a second table: for each tier 0 to 3, over the shared snapshots of row 170a, the share of parties that **clear the gauntlet**, and the **mean number of gauntlet fights won** (0 to 3), on the same 30 seeds per starter (label `tier-ladder-gym`).
2. **New assertion:** gauntlet fights won never goes up from one tier to the next. Deterministic, because the seeds and the snapshots are fixed. If it fails, **do not tune anything**: report the numbers to Henry. The existing "fights won per run never rises" assertion stays as it is.
3. Print the "gauntlet only" table under the existing one, and add both to a new report, `docs/balance/tier-ladder-170.md` (LF): the two tables, the commit hash and the run date. Leave the 169 report in place.
4. Add the knobs `TIER_LADDER_GYM_SEEDS` (default 30) beside the existing ones, so a smaller look is possible.

### Tests (write first)

- The table digest handles a tier with zero parties without dividing by zero.
- With a stubbed gauntlet that always loses at Tier 3, the check fails and names Tier 3.
- With a stubbed gauntlet that wins more at Tier 3 than at Tier 2, the check fails and names both numbers.

---

## 170c: Where does the walker die?

A report, not a fix. New `src/debug/balance/walkerDeaths.ts` (a pure digest of walk results) and `src/debug/balance/walkerDeaths.balance.ts` (runs it under `npm run balance`).

For the same 30 seeds per starter at tier 0, with no modifiers and **without** the ghost rule, report where the real walks end:

- **How many fights won before dying**, as a count for 0, 1, 2, ... up to the gym, and which node kind killed the walk (wild, rival, elite, gym).
- **The killing fight itself:** what it was up against (element, biome, an elite or not), the party's mean HP fraction at the start, and how many turns it lasted.
- **The deck at death:** size, `deckPower` (the walker's own score), number of Corrupted Data (junk) cards, and how much scrap was left unspent.
- **Whether the walker was wasting resources:** unspent scrap at death, upgrades and patches available but not taken, recruits available but not made.
- **Per starter:** the same first two lines, since some starters may simply be worse for this walker.

Write the result to `docs/balance/walker-deaths-170.md` (LF) in plain English, ending with **a ranked list of the three most likely causes**, each with the number that supports it. Then **stop**. The next row is chosen from this list by Henry.

### Tests (write first)

- The digest, given a hand-made list of results, counts deaths by fight index and node kind correctly, and puts a walk that reached the gym in its own bucket.
- A walk with no deaths (a full clear) contributes to no death bucket.
- The report never prints a `NaN` or `undefined` for a starter with no walks.

---

## 170d: Fix the walker's worst mistakes

**Rows are written after 170c, by Henry's choice from its ranked list.** Do not start this row until he has named the fixes. Each fix is one commit and follows these rules:

- **It is a walker policy change only** (what the walker buys, picks, upgrades or heads for), through the hooks the walker already has: `choosePick`, `chooseStep`, `chooseRecruit`, `chooseUpgrade`, `choosePatches`, the junk and macro policies. No engine change.
- **It is behind an option that is off by default**, so the 169j walks are unchanged (rule 4). A later cleanup can flip the default once Henry agrees.
- **It is measured on the same seeds** with the option off and on: reach-the-gym share, fights won, gauntlet clear share. The commit message quotes the four numbers.
- **It has to be a play any player could make.** The walker may not see the enemy's hidden rolls, peek at the deck order, or use information a human cannot see. A fix that only works because the walker cheats is rejected.
- **A fix that does not move reach-the-gym by at least 5 points on the 30-seed sample is not kept.** Say so in the report and drop it. A walker that is more complicated and not better is worse.

Examples of the sort of thing 170c might turn up (these are guesses, not rows): the walker spends too little scrap; it never removes junk; it takes the same route every time and skips rest nodes; it drafts a deck that is too big; it fights an elite at low HP. **Do not build any of these until 170c has shown it is real.**

---

## 170e: A drafter for Draft Start that picks the best card

Today's drafter (`chooseDraftPick` and `draftKitFor` in `runWalker.ts`) takes the first offered card that is in the member's normal starting kit, and only falls back to the card score if none is. On most offers that rebuilds the normal kit, so the Draft Start report cannot show what a good drafter gains or loses.

1. New `src/debug/balance/draftPolicy.ts` with a `chooseDraftPickBest` that takes the offer with the highest `scoreOf`, breaking ties toward the first offer, and prefers a card that adds an element or role the kit-so-far lacks when two offers are within 5 points of each other (the 5 is the same step every number in this game moves by, not a tuned value).
2. `WalkInput` gets `draftPolicy?: 'kit' | 'best'`. Left out is `'kit'`, which is today's drafter exactly.
3. The modifier report in `tierLadder.balance.ts` prints **two** Draft Start rows: `kit` and `best`, on the same seeds, and `docs/balance/tier-ladder-170.md` records both.
4. If `best` does worse than `kit`, that is a finding about the card score (`scoreOf`), not a bug in this row. Report it to Henry and change nothing.

### Tests (write first)

- On a hand-made offer where the second card scores highest, `'best'` takes the second card and `'kit'` takes the first kit card.
- On a tie, `'best'` takes the first offer.
- Five picks always yield five cards, all from the offers, with no card taken from an offer that was not made.
- Leaving `draftPolicy` out reproduces the 169j Draft Start walk exactly.

---

## Done when

- Rows 170a, 170b, 170c and 170e are committed, the gate is green, and `npm run balance` runs the new checks green (or a failure is reported to Henry with the numbers). Row 170d is done when Henry says it is.
- `docs/balance/tier-ladder-170.md` has the whole-run table, the gauntlet-only table and the Draft Start comparison, each from the full 30 seeds per starter, with the commit hash and the run date.
- **Henry can read one line and know whether Tier 3 is harder than Tier 2**, and that line comes from a gauntlet that all 360 parties (12 starters x 30 seeds) in each tier actually reached.
- `docs/balance/walker-deaths-170.md` says, in plain English, why the walker dies, so the next balance report can say how much of a result is the game and how much is the walker.
- No file under `src/engine`, `src/ui` or any game data JSON was changed by this ticket.

## Resolution

_(open: 170d only)_
