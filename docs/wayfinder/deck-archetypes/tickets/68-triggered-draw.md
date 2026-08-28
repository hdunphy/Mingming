# Triggered-draw fix (ticket 68): "if you drew a card" should mean you MADE it happen

- Type: wayfinder:task - Henry-approved design (2026-08-16, answer 4 to ticket 67's questions:
  *"Surge protection should only fire if there is a non-natural card drawn either an OS, daemon
  or card that triggered the card draw. This effect is broken if it triggers when you get a new
  hand."*). Designed and implemented in the same session - the design agent is out of tokens.
- Status: **closed** (2026-08-16)
- Assignee: implementation agent
- Blocked by: none. Runs BEFORE ticket 69's census, because it changes battle behaviour and a
  census taken before it would measure a world we are about to change.

## Why

Ticket 67 traced the defect: `executeDraw` increments `cardsDrawnThisTurn` for EVERY draw and
the `isNatural` flag - already threaded through for hook dispatch - was never consulted for the
counter. The draw phase calls the same function, so "if you drew a card this turn" is satisfied
for every species on every turn that draws at all. Measured: **`surge_protection`'s refund fired
on 3,371 of 3,371 casts**, making a 2-Energy card a net-1-Energy card unconditionally.

## Change

- **New state field `nonNaturalCardsDrawnThisTurn`** - optional, per this codebase's convention
  for later-added state (`cardsDiscardedThisTurn`, `lastStatusConsumed`), read with `?? 0`.
  Incremented in `executeDraw` only when `isNatural` is false; reset with its sibling.
- **New constraint type `CARDS_DRAWN_TRIGGERED`.** `CARDS_DRAWN` is left exactly as it was, so
  nothing that wants "any draw" loses it.
- **`card_drawn_check` retyped** to the new constraint. It has exactly one consumer,
  `surge_protection`, so the blast radius is that card.
- **Card text**: *"40 power. If a card, OS or daemon drew you a card this turn, refund 1 Energy."*
- `ConstraintBehavior.ts` gets a matching UI-preview behaviour. That registry is stateless and
  returns `true` for both draw constraints - the real check is
  `ConditionValidator.evaluateCardConstraint` via `battleReducer:115`. Noted, not changed.

## Deliberately NOT changed

**The `CARDS_DRAWN` *scaling*** (`ink_stream` "12 power per card drawn", `starfall` "10 power
per card drawn") reads the same natural-inclusive counter and would move if it were fixed
alongside. It is a different question: those cards were BALANCED against a count that includes
the refill, and changing it is a damage nerf to jormungandr_v1, kraken_v1 and valkyrie_v2 rather
than a defect fix. Flagged for Henry, not taken.

## Deliverable

Commit hash, the 8-DIFF (kraken_v1/v2 and jormungandr_v1 carry `surge_protection`; nothing else
should move), gate numbers.


---

## Resolution (2026-08-16) — shipped, and the ticket's own premise was half wrong

Registry `1:b76809c9` -> **`1:4dc861f2`**.
[research/triggered-draw-fix.md](../research/triggered-draw-fix.md).

**TWO defects were stacked, and the first hid the second.**

**A - the card overrode its own library definition.** `programs.json` carried the conditional as
`{"id": "card_drawn_check", "type": "BASE", "target": "SELF", "value": ""}`, and
`inflateConstraint` does `{ ...LIB[id], ...inline }` - **inline is spread LAST and wins**. The
draw check was overwritten by `BASE` (`currentEnergy >= cost`, with cost 0). **Always true. It
had never been a draw condition at all.**

**B - the state was never passed.** Both action-conditional call sites in `battleReducer` called
`validateSingleConstraint(c, source, subject, 0)` - four args, no state - so any state-dependent
constraint hit `ConditionValidator`'s `if (!state) return true` fail-safe.

**Either alone makes the refund unconditional**, which is why fixing the counter first produced
a full-balance run with **0 of 67 rows moved**. That null result is what exposed defect A.
Third occurrence of the `0-TARGETLESS` shape.

**Result:** refund uptake **100% -> 29.4%** against triggered draws at 28.9%; casts 497 -> 350
as the AI stopped over-valuing it.

**8-DIFF: 10 of 67 moved, 57 bit-identical** - `surge_protection` sits in exactly three decks
and exactly those moved. `control-vs-kraken_v2` **15.0 -> 46.0**, `control-vs-kraken_v1`
24.0 -> 39.0, `mirror:kraken` 48.0 -> 51.2, `os:jormungandr` 94.0 -> 91.0, `os:kraken`
54.0 -> 57.0, plus three control aggregates. §1.3 unchanged at 42.

**Regression guard:** `triggeredDraw.test.ts` (6 tests), including one that walks every card and
fails if any inline conditional `type` differs from the library entry it names. The sweep found
exactly one occurrence - this one - so it starts green.

**CORRECTION TO TICKET 67 §5**, recorded there too: that report traced the natural-draw counter
as the cause. The chain is real but never reached. Outcome and recommendation were right; the
causal story was not.

**Kraken got measurably worse** - she was living on a refund that should not have existed. Ticket
70 must re-baseline the -1.49 net before choosing a stat lane.

**Not changed, flagged:** the `CARDS_DRAWN` *scaling* (`ink_stream`, `starfall`) also counts the
draw-phase refill, but those cards were BALANCED against it - changing it is a nerf to three
decks, not a defect fix.

Gates: `tsc -b` clean, **826 passed / 62 files**, `vite build` clean.
