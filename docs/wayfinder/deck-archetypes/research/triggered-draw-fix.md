# The refund that was never a condition

- Type: wayfinder:research — implementation record for **ticket 68**. Designed and implemented
  in one session (Henry's answer 4 to ticket 67).
- Registry `1:b76809c9` → **`1:4dc861f2`**, branch `card-dev`.

---

## 1. The answer, in one row

**`surge_protection`'s "if you drew a card this turn" was never evaluated as a draw check.** It
inflated to a `BASE` energy check against cost 0 — trivially true — so the refund fired
unconditionally, and two independent defects were hiding behind each other.

| | before | after |
|---|---|---|
| refund uptake | **100%** (3,371 / 3,371 in ticket 65) | **29.4%**, tracking triggered draws at 28.9% |
| casts / sample | 497 | **350** — the AI stopped over-valuing it |
| `control-vs-kraken_v2` | 15.0% | **46.0%** |
| `control-vs-kraken_v1` | 24.0% | **39.0%** |

---

## 2. Two defects, stacked — and the first one hid the second

**Defect A — the card overrode its own library definition.** `programs.json` carried the
conditional as:

```json
{ "id": "card_drawn_check", "type": "BASE", "target": "SELF", "value": "" }
```

`inflateConstraint` (programRegistry.ts:63) does `{ ...LIB[id], ...inline }` — **the inline
object is spread LAST, so it wins.** The library's draw check was overwritten by `type: "BASE"`,
which is `source.currentEnergy >= cost`, evaluated with `cost: 0`. Always true.

**Defect B — the state was never passed to the validator.** Both action-level conditional call
sites in `battleReducer.ts` (lines ~396 and ~609) called
`validateSingleConstraint(constraint, sourceEntity, subject, 0)` — **four arguments, no state**
— so any state-dependent constraint hit `ConditionValidator`'s `if (!state) return true`
fail-safe and passed regardless.

**Either one alone makes the refund unconditional. Fixing only one changes nothing**, which is
exactly what happened: the first full-balance run after fixing the counter showed **0 of 67 rows
moved**. That null result is what exposed defect A.

**This is the `0-TARGETLESS` family**: a guard that is silently always-true because an argument
was not threaded. It is the third occurrence of that shape in this project.

---

## 3. A correction to ticket 67

**Ticket 67 §5 traced the wrong mechanism and should be read with this note.** It concluded the
refund fired because `cardsDrawnThisTurn` counts the draw-phase refill. That chain is real and
the counter does behave that way — but **it is never reached**, because the constraint had been
overridden to `BASE` before it got there.

The *outcome* reported there (100% uptake over 3,371 casts) was correct and the recommendation
was correct. The causal story was not. The measured 8.8–9.6% "zero-draw turns" in that report
describe a counter that nothing was reading.

---

## 4. What shipped

- **`nonNaturalCardsDrawnThisTurn`** on `IBattleState` — optional, per this codebase's
  convention for later-added state (`cardsDiscardedThisTurn`, `lastStatusConsumed`), read with
  `?? 0`. Incremented in `executeDraw` only when `isNatural` is false; reset with its sibling.
  **`isNatural` was already threaded here for hook dispatch and simply never consulted for a
  counter** — this is that flag finally doing the second job it implies.
- **`CARDS_DRAWN_TRIGGERED`** constraint type. `CARDS_DRAWN` is untouched, so anything wanting
  "any draw" keeps it.
- **`card_drawn_check` retyped** in the library; **the card's inline override deleted**, so it
  now references the library entry by id alone.
- **Both `battleReducer` call sites now pass `finalState`.**
- Card text: *"40 power. If a card, OS or daemon drew you a card this turn, refund 1 Energy."*
- `ConstraintBehavior.ts` gains a matching UI-preview behaviour. That registry is stateless and
  returns `true` for both draw constraints; the real check is the reducer path. Noted, unchanged.

---

## 5. The regression guard

`triggeredDraw.test.ts` (6 tests). The one that matters most is not about draws at all:

> **"NO card inline-overrides a library constraint type"** — walks every card's constraints and
> action conditionals and fails if any inline `type` differs from the library entry it names.

`inflateConstraint`'s spread order makes that override silent, and it cost this project a live
condition for an unknown number of tickets. **The sweep found exactly one occurrence** — the one
fixed here — so the guard starts green and fails the moment a second appears.

---

## 6. 8-DIFF — the three decks that carry the card, and nothing else

| row | before | after | Δ |
|---|---|---|---|
| `gauntlet:control-vs-kraken:kraken_v2` | 15.0% | **46.0%** | **+31.0** |
| `gauntlet:control-vs-kraken:kraken_v1` | 24.0% | **39.0%** | **+15.0** |
| `mirror:kraken` | 48.0% | 51.2% | +3.2 |
| `os:jormungandr` | 94.0% | 91.0% | −3.0 |
| `os:kraken` | 54.0% | 57.0% | +3.0 |
| `control-overall` (3 aggregate rows) | — | — | +0.9 to +1.9 |

**57 of 67 rows bit-identical.** `surge_protection` appears in exactly three decks —
`kraken_v1`, `kraken_v2`, `jormungandr_v1` — and exactly those decks moved. §1.3 unchanged at
42; the only §2–3 change is `os:jormungandr` 0.44 → 0.41.

Gates: `tsc -b` clean, **826 passed / 62 files**, `vite build` clean.

---

## 7. What this does to kraken — and it matters for ticket 70

**Kraken just got measurably worse, because she was living on a refund that should not have
existed.** The control now beats kraken_v2 46% of the time, up from 15%.

Ticket 67 measured her neutral-bucket net at **−1.49 damage/turn**. That number was taken in a
world where `surge_protection` was a net-1-Energy 40-power attack for her, twice a game.
**Ticket 70's stat sweep should re-baseline it before choosing a lane** — the deficit it needs
to close is now larger, and by an amount nobody has measured yet.

---

## 8. Deliberately not changed

**The `CARDS_DRAWN` *scaling*** — `ink_stream` ("12 power per card drawn") and `starfall` ("10
power for each card drawn this turn") read `state.cardsDrawnThisTurn`, which does include the
draw-phase refill. Those cards were *balanced* against that count. Changing it is a damage nerf
to jormungandr_v1, kraken_v1 and valkyrie_v2, not a defect fix, so it is flagged rather than
taken.

**Question for Henry:** is "per card drawn" meant to include the hand you are dealt? If not,
that is a second ticket and a real nerf to three decks.
