# Post-fight rewards refit: scrap, 1-of-3 card pick, consumable blueprint drops, no XP (ticket 12)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [11](11-encounter-flow.md)
- Phase: Vertical Slice

## Deliverable

`engine/RewardSystem.ts` + `BattleReport.tsx` already do scrap + pick-1-of-3 + blueprint roll + XP. Refit: drop XP entirely; blueprints are consumable COUNTS (a species you already own can drop again — that is the re-roll grind); scrap amounts become run-economy numbers (Henry supplies — see Questions); the card pick draws from the **reward-pool source Henry rules** (pre-seeded open question — default to the designer's recommendation, the current party's species pools, behind a single function so the rule can change); picked cards go into the shared run deck. Gym-clear draft rounds move to ticket 18.

Drop-rate numbers to propose (Henry picks): blueprint 15–25% per defeated wild, 100% from alphas.

## Done when

A won fight pays scrap + one pick + possible blueprint; the blueprint persists to the ranch immediately (dead runs still pay forward). Tests updated.

## Resolution

**Closed 2026-08-22.** Suite **1077 → 1107**, `tsc -b` clean, `npm run build` green.

A won fight now pays exactly three things — scrap, one pick-1-of-3 per defeated enemy, and possibly
a blueprint — and every number in that sentence lives in one of two exported tables keyed by node
kind. `IRewardBundle.totalXP` is gone from the type, so there is no longer a slot XP can reappear
in.

### AWAITING HENRY — every number below is a proposal

`BLUEPRINT_DROP_RATE`, **per defeated enemy** (not per fight — the blueprint is the species you
killed, so a 3v3 wild rolls three times and yields at least one ~49% of the time; if 20% was meant
per *fight*, the first three rows become ~0.07 / 0.07 / 0.09 and nothing else changes):

| kind | rate | why |
|---|---|---|
| `wild` | 0.20 | midpoint of the ticket's own 15–25% band |
| `ambush` | 0.20 | same per-body rate: the extra enemy already IS the extra roll |
| `elite` | 0.25 | top of the wild band; the **Driver** is an elite's headline prize (ticket 16), not the blueprint |
| `alpha` | **1.00 — RULED** | ticket 07: "guards a guaranteed blueprint" |
| `gym` | 0.50 | placeholder; ticket 18 will likely replace a per-body roll with one authored award |

`SCRAP_PER_ENEMY`, inclusive band per defeated enemy. **Ticket 13 calibrates against these and may
move them** — a full 8–10 fight run with a 3-member party lands near **450–500 scrap** before card
sales:

| kind | band | per 3-body fight | why |
|---|---|---|---|
| `wild` | 8–14 | ~33 | the baseline everything is quoted against |
| `ambush` | 10–16 | ~39 | pays the extra enemy twice: by having one, and by a higher band |
| `elite` | 18–26 | ~66 | "pays like the biome's exam" — roughly two wilds, so rushing the exit is a real route choice |
| `alpha` | 30–40 | ~35 (one body) | must beat the wild you skipped *plus* the pocket backtrack |
| `gym` | 20–30 | ~75 | provisional; gauntlet scrap is unspendable unless ticket 18 adds a mid-gauntlet shop |

Non-fight kinds are 0 in both tables rather than absent, so a future event-fight cannot silently
inherit a wild's payout.

**And the standing open question:** `rewardCardPool` implements the designer's recommendation from
`economy-session.md` — picks draw from the **current party's species pools** — which is still
"Henry deciding". The alternatives (biome/enemy element, global, hybrid wild-card) are named in that
function's doc comment with what each would cost; changing the rule means changing that one
function.

### `getBlueprintRate(rosterSize)` is deleted, not kept as a multiplier

It scaled the drop by how many mingmings you owned (0.75 / 0.50 / 0.15). It was written when a
blueprint was a permanent *permission* to build a species, deduplicated on arrival — a third one was
worthless, so throttling to 15% was mercy. Blueprints are **consumable** now and Henry has blessed
the re-roll grind, which inverts the curve's meaning: roster size is a record of blueprints already
*spent*, so the curve throttles hardest on the player deepest into the loop it is supposed to feed.
It would also falsify the table above — an alpha's ruled 100% would arrive as 15% for anyone with
three mingmings. Early-game generosity has a better home in the first run's authored difficulty
(tickets 09/24); if the curve comes back it should be an explicit flag on `BLUEPRINT_DROP_RATE`, not
a silent function of roster length.

### The blueprint is banked when it DROPS, not when the reward is claimed

`addBlueprint` fired in `handleContinue` — the CONTINUE button — and the bundle it read from was
component state. A player who won a fight and closed the app on the reward screen lost the blueprint
outright: nothing had written it anywhere. It now fires from a `useEffect` the moment the bundle is
rolled, idempotent per battle seed via a ref (a state guard would double-credit under `StrictMode`).

Scrap, cards and the driver still land on claim, and the asymmetry is the point: those are
run-scoped, and an app closed here resumes at `phase: 'encounter'` and re-rolls the identical fight
from the identical seed, so the player is paid when they win it again — paying twice would be the
bug. The blueprint is the one persistent reward, and "dead runs still pay forward" only means
something if the payment does not wait on a button.

Known consequence, flagged rather than fixed: closing the app on the reward screen resumes into the
same unfinished encounter, so re-winning it banks the same blueprint again. It is bounded by what is
already ruled — re-entering the node pays full rewards too, so the "exploit" costs one won fight per
blueprint, the same price as the sanctioned farm with extra steps. Closing it would need either a
third persisted save shape for 30 seconds of pending-bundle state, or resolving the node before the
player claims (which loses the fight entirely if the app dies a moment later).

### Repeat fights pay full rewards, and there is nowhere to put a falloff

Per Henry's amendment (2026-08-21). `rollDropTable` cannot see a visit count, a node id or a run —
its whole input is (defeated, nodeKind, party, seed) — so a re-entry falloff cannot be added by
accident, only on purpose. Ticket 06 lists "node re-entry payout falloff" as owned by this ticket;
this is the answer: **no falloff.** Four tests assert it, including flat mean scrap across visits
1/2/3/6/12 and an unchanged blueprint rate on visit 7.

### The gym-clear draft left the battle path

`rollDraftRounds` is no longer called. The branch was reachable only through a gauntlet state
nothing produces (nothing advances `IRunState.gauntlet` until ticket 18), and **ticket 18 owns the
gauntlet refit**. The function, `IRewardBundle.draftRounds` and `BattleReport`'s draft panel are the
three halves of one parked feature, kept together and still tested so 18 re-wires rather than
rewrites.

### Smaller calls worth knowing about

- **Options within one pick are now distinct.** The party pool can be as small as seven unique ids,
  where the old registry-wide element pool made a collision rare; a 1-of-3 showing the same card
  twice is a 1-of-2. Distinct *within* a triplet only — nothing is filtered against the run deck,
  because a second `ignite` is often the correct reward.
- **Bundles are deterministic down to card instance ids** (a labelled `SeedStream` fork instead of
  `createOwnedProgram`'s wall-clock default), so a resumed run hands the player the same card it
  showed them.
- `getScrapYield` (the sell-side price list) has **no callers**; it is flagged in place for ticket
  13 rather than deleted, and should be calibrated in the same pass as `SCRAP_PER_ENEMY` — selling
  an Epic for 100 when a whole elite pays ~66 would make selling the dominant income.
- `IDropTableEntry` (`gameTypes.ts`) is inert — nothing constructs or reads it. Left for repo
  hygiene (ticket 02) rather than deleted here.
- `BattleReport`'s blueprint line said "NEW BLUEPRINT DETECTED"; it now reads "BLUEPRINT RECOVERED
  … +1", because with counts a repeat drop is the grind rather than a mistake.


## Amendments from tickets 07/08 (Henry, 2026-08-21)

Repeat fights on a re-entered node pay FULL rewards (Henry: 'farming is fine') — record repeat counts in the run clock telemetry (ticket 19) and do not pre-patch. A recruit's untagged kit cards are in the pick pool while it is in the party (ticket 08).
