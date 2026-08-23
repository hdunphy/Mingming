# Apply ticket 56 to the built slice: scrap rescale, no selling, Relay, 3-vs-N check (ticket 57)

- Type: wayfinder:task
- Status: open
- Assignee: agent
- Blocked by: [56](56-economy-numbers.md)
- Phase: Vertical Slice

## Deliverable

Tickets 10–15/18–20/22/24 were built in parallel with the ticket 56 grilling; reconcile the code with its ruled numbers (the reconciliation section in 56 is the authority):

1. **Scrap tables** (`src/engine/run/marketplace.ts`, rewards tables from ticket 12, `workshop.ts`): income = 10 + 5 per enemy beyond the first, elite 30; buy prices 0e 15 / 1e 25 / 2e 35 / 3e 45; card removal 20 (market AND workshop); workshop assembly fee 25, reflash fee 15. Rescale, do not re-derive — ratios that ticket 13 established within a band survive only where they already match.
2. **Remove selling** entirely (marketplace UI + `sellPrice` + its tests). Removal is the only card sink.
3. **Macro prices stay at full-1e-value (commons 32, rares 48)** — no change if that is what is built. **Add RELAY** (rare, 48): move 1 energy from one party member to another this turn, on the existing `TRANSFER_ENERGY` reducer; no free transfer UI anywhere (ticket 22's rule).
4. **Blueprint drops:** confirm built = per defeated enemy, wild/ambush 0.20, elite 0.25, alpha 1.00; align the gym row with ticket 18's authored award.
5. **Verify the reward pick pool** draws from the current party's species pools weighted toward untagged kit cards (56 ruling 1), and **the gauntlet boss is always 3** (3 vs N — 56 ruling 4); fix if the build differs, report if it already complies.
6. Note in `docs/wayfinder/deck-archetypes/HANDOFF.md` (one line) that the startKit tag table in ticket 09 is ratified content touching their registry decks.

## Done when

Suite green, `tsc -b` and build clean, and the resolution lists each of the six items as changed / already-compliant, with the one-run income arithmetic re-measured (~150–180 scrap).

## Progress — four of six applied 2026-08-23; two are BLOCKED ON HENRY

`tsc -b` clean, **1585 tests passing**, build green, lint clean (blocking since ticket 55). Each of
the six items below is reported as **changed**, **already-compliant** or **blocked**.

---

### 1. Scrap tables — CHANGED, and the SHAPE changed, not just the numbers

Ticket 12 paid a rolled band **per defeated body** (`SCRAP_PER_ENEMY`: wild 8-14, elite 18-26, ...),
which is where the ~450-500 per run came from. Henry's table replaced that wholesale, and it is a
different model:

- **Per FIGHT, not per body.** A 3v3 pays 20 once, not 8-14 three times.
- **Flat, not rolled.** No band, no `prng` call. Scrap is now predictable before you swing, which is
  what makes a shop price a *plan* rather than a hope. One fewer draw per corpse — the reward seed
  chain moved, which is a reward-roll change and not a battle one.

`SCRAP_PER_ENEMY` is gone; `scrapForWin(nodeKind, defeatedCount)` replaces it —
`BASE_WIN_SCRAP` 10 + `SCRAP_PER_EXTRA_ENEMY` 5 per extra body, `ELITE_WIN_SCRAP` 30 flat.

**Buy prices are now ENERGY ALONE:** `CARD_PRICE_BY_ENERGY = [15, 25, 35, 45]`, clamped above 3.
`CARD_PRICE_BY_RARITY` and `ENERGY_PRICE_STEP` are deleted. That is a model change worth naming: a
2-energy Common and a 2-energy Rare now cost the same 35. Rarity in this game is a *drop-rate*
weight, not a power tier — the rev-3 curve prices power in energy — so a shop charging for rarity was
charging twice, on the wrong axis. **See the flag at the bottom: this removed the last rarity gate in
the market.**

**Removal 30 → 20**, market and workshop (the workshop re-exports the constant, so one edit moved
both). **Workshop assembly 75 → 25, reflash 40 → 15.**

**`REROLL_PRICE` 20 → 10, and this is the one number ticket 56 did not rule.** Ticket 13's law was
"priced below the cheapest card, close to it" — at a cheapest card of 15 the old 20 broke its own
rule. Rescaled by ratio (20/24 x 15 = 12.5, rounded onto the 5-grid) rather than re-derived, per this
ticket's instruction. **Flagged: if it is wrong it is wrong by 5.**

**Macro prices stay 32/48 — but they are LITERALS now, not a derivation.** Ticket 13 computed 32 as
`CARD_PRICE_BY_RARITY.Common + ENERGY_PRICE_STEP`, so that tuning the card table moved the macros
with it. Ticket 56's reconciliation ruled the macro numbers win over its own 25/40 — so the two
rulings genuinely disagree about what a 1-energy card is worth, and a live derivation would now
produce 25/37 and quietly overturn the ruling that won. The link is cut on purpose, with a test that
fails if anyone re-derives them.

### 2. Selling — REMOVED, end to end

`sellPrice`, `SELL_MULTIPLIER`, `runSlice.sellRunCard` and the shop's sell control are all gone, with
a tombstone comment at each site. The no-farm law used to be a `Math.min(..., buy - 1)` clamp holding
"sell < buy for every card"; it is **structural** now — there is no way to turn a card back into
scrap at all. `MarketplaceNode.test.tsx` asserts the markup contains no `/sell/i` across four
screen states, so the ruling is pinned rather than merely obeyed.

### 3. Relay macro — **BLOCKED. Three findings, and the middle one is a design conflict.**

Not built, deliberately. Ticket 56 rules Relay as *"move 1 energy from one party member to another"*
on the existing `TRANSFER_ENERGY` reducer. Three things stop that being a data entry:

1. **There is no path from a macro to `TRANSFER_ENERGY`.** A macro's effect is `ProgramAction[]`,
   resolved through `ActionExecutorRegistry`. `TRANSFER_ENERGY` is a top-level `BattleAction` with
   its own handler — it is not in the `ActionType` union and has no executor. Building the bridge
   means either a new `ActionType` + executor (which is arguably the second implementation the
   ticket says not to write) or a special-case on the macro id inside `handleFireMacro`, which the
   registry's own header explicitly forbids.
2. **THE BUILT REDUCER IS 2-FOR-1 AND THE RULING IS 1-FOR-1.** `TRANSFER_COST = 2`,
   `TRANSFER_GAIN = 1` — it *destroys* one energy. Shipping Relay on it as written would sell a
   48-scrap rare whose true effect is "pay 2 to give 1", and the standing law that a description
   prints the true number makes that non-optional. Retuning `TRANSFER_COST` to 1 changes the reducer
   the ruling wants *kept for future cards* and breaks four assertions in two other files.
3. **There is no "another ally" targeting mode.** `MacroTargeting` is
   `ENEMY | ALLY | SELF | DOWNED_ALLY | MAP`, and ALLY accepts the firer — `MacroRack` actively
   *defaults* an ALLY macro's target to the selected caster. A Relay built as ALLY would default to
   a self-transfer that burns 2 energy for 1 on a mis-click. It needs an `OTHER_ALLY` mode.

**What is needed from Henry:** is Relay 1-for-1 (retune `TRANSFER_COST`, accept the reducer change
and four test edits) or 2-for-1 (and the card says so)? And sign-off on an `OTHER_ALLY` targeting
mode plus one of the two bridges. Nothing else about Relay is a problem: source and target already
exist on `FIRE_MACRO`, and the price needs no work.

### 4. Blueprint drops — ALREADY COMPLIANT

`BLUEPRINT_DROP_RATE`: wild 0.20, ambush 0.20, elite 0.25, alpha 1.00 — verified, and verified to be
rolled **once per defeated body** (`rollDropTable` loops corpses, skips survivors, one `prng.next()`
each, and the blueprint is that corpse's own `definitionId`). The `gym` row stays at 0.50: it is
ticket 18's, and Henry held the gym's payout for the ticket 25 playtest on 2026-08-23 (*"leave it for
now. we will need to play test"*), so this ticket does not touch it. Note that the gym still pays
**3x a single 3v3** under the new table (3 fights x 20 against 20) — the ratio ticket 18 flagged is
preserved exactly; only the scale moved.

### 5a. The reward pick pool — **DIFFERS, and the gap is the whole weighting clause**

Ruling 1 is *"the current party's species pools, weighted toward untagged kit cards not yet in the
run deck"*. Measured against `rewardCardPool`:

- **Source: compliant.** Built from the live party's per-OS decks (`getDeckForOS` over
  `battleState.playerParty`).
- **Weighting: absent.** The pool is a flat de-duplicated `string[]`; every id has equal standing.
  The only weighting anywhere in the draw is by **rarity** (`RARITY_WEIGHTS` 50/30/15/5), which is
  not what the ruling asks for.
- **"Not yet in the run deck": absent, and it is an explicit refusal rather than an oversight.**
  Ticket 12 wrote *"a card already in the run deck is still offered... nothing filters against
  `IRunState.deck`"* in two places.

**Not fixed, because it needs a decision and a signature change.** `rollDropTable`'s input is
`{ defeated, nodeKind, party, seed }` — it cannot see the run deck at all, so implementing the clause
means threading `IRunState.deck` into the reward roll (touching `BattleArena`) *and* choosing how
strong the bias is, which is a number nobody has ruled. Both are small; neither is mine to invent.

### 5b. The gauntlet boss — ALREADY COMPLIANT

`GAUNTLET_ENEMY_COUNT = 3`, and `rollGauntletFight` never reads party size — it does not call
`enemyPartySize` at all. A short-handed player fights 1-vs-3 or 2-vs-3, and `GauntletNode` says so on
screen rather than hiding it (*"The gauntlet is always 3 strong, whatever you bring: you are fielding
{n}"*). The `FLAGGED FOR HENRY (reading, not ruling)` annotation in `gauntlet.ts` is now stale prose
— 56 ruling 4 ratified it.

Also verified: **no free energy-transfer UI exists.** `battleSlice.transferEnergy` has zero
dispatchers and no `.tsx` file references it. Ticket 22's deliberate gap is intact.

### 6. Deck-archetypes note — NOT DONE

Blocked with item 3 rather than forgotten; it goes in the same pass as Relay so their wayfinder gets
one interruption instead of two.

---

### The one-run income, re-measured (the Done-when)

Ticket 56 estimates ~150-180 for a 3-member run. **The ruled table pays more than that**, and the
measurement is pinned as a test rather than a comment (`RewardSystem.test.ts`, "MEASURES one run's
income"). Modelling `exploration-map.md`'s run with the party growing 1 -> 2 -> 3, so the early
fights are genuinely smaller:

| source | | |
|---|---|---|
| wilds (3 solo, 3 duo, 2 trio) | 30 + 45 + 40 | **115** |
| three biome exits (elite, flat 30) | | **90** |
| pocket alpha (one body) | | **10** |
| **spendable subtotal** | | **215** |
| the gauntlet (3 fights x 3 bodies) | | 60 |
| total | | 275 |

**215 spendable against an estimate of 150-180.** The gap is the three elites: at a flat 30 they are
90 of it — more than the eight wilds put together. Whether that is wrong depends on what ticket 56
was picturing, so it is reported rather than retuned. The gauntlet's 60 is excluded from "spendable"
because the run ends when it does and there is no shop after it.

### FLAG: ticket 56 removed the last rarity gate in the market

Rarity has left the price, and the stock was already drawn uniformly (`drawDistinct`). So a Rare and
a Common printed at the same energy now **cost the same and are equally likely to be stocked** —
there is no rarity gate anywhere in the shop. `drawDistinct`'s docblock had rested its case for a
uniform draw on the price gating rarity ("a Rare costs 2.5 Commons"), an argument propped on the half
of the design that 56 removed; it is rewritten to say what is true now. **If a Rare is meant to feel
rare at a stall, the gate has to be reinstated deliberately** — a weighted draw, a scarcity cap on
the stock, or a rarity term returning to `cardPrice`. That is a consequence of ticket 56 for Henry,
not something this ticket should settle.
