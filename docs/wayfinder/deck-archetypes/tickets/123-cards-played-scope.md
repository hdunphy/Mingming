# Ticket 123 — `CARDS_PLAYED` scalers count the CASTER's plays, not the whole side's

**Status:** SHIPPED 2026-08-28, from Henry's ticket-118 playtest.
Henry: *"Stampede did 78 damage. This card needs to be nerfed."* and *"it scales based on the number
of cards played on your side. I think we need to scope these to the source mingming."*

---

## This is a text/code disagreement, not a nerf

Three cards use `CARDS_PLAYED`, and **all three already promised caster-scope in their own text**:

| card | deck | text |
|---|---|---|
| `stampede` | `sleipnir_v1` ×2 | "deal 11 Air damage for every card **you** played this turn" |
| `serpents_coil` | `jormungandr_v1` ×2 | "deal 10 Water damage for every card **you** played this turn" |
| `seed_bomb_v2` | `ratatoskr_v1` ×2 | "Deal 15 power per card played **by host** this turn" |

The code read `state.cardsPlayedThisTurn` — **one counter for the whole active side.**

**At 1v1 the caster IS the side**, so the two numbers were always equal and the disagreement could
not be observed. The comment above the function says reading side history is deliberate per ticket
26 — and it was written when the distinction could not have meant anything. 3v3 with a **shared
hand** made it mean something, and nobody revisited it: every ally's cast pumped your scaler. On a
three-body side that is up to a **3× multiplier the card never claimed**.

Henry saw it as 42 damage in one game and **78 in a stacked comp, off an 11-power card**.

## The change

`getDamageScalingMultiplier` (`src/engine/actions/ActionExecutors.ts`) takes the caster and returns
`source.playsThisTurn` for `CARDS_PLAYED`. That function is **shared with the UI hover preview**, so
the previewed number and the real damage cannot drift — the ticket-90 property is preserved.
`playsThisTurn` is incremented in the same reducer snapshot as `cardsPlayedThisTurn`, so the
resolving card still counts itself and the off-by-one is unchanged.

**At width 1 the two values are identical, so no 1v1 cell can move.** There is a test asserting
exactly that.

> **A mistake worth recording.** The first version of this fix edited `effectHandlers.ts`, which has
> a `CARDS_PLAYED` branch that is never reached for card damage. It typechecked, the suite stayed
> green, and the stacked-comp arms came back **bit-identical** — which reads exactly like a real
> "this lever does nothing" result. It was caught by measuring the damage directly on a built board
> instead of inferring it from win rates. That is the fourth dead arm in this arc, and the reason
> `cardsPlayedScaling.test.ts` exists.

## What it is worth (lite screen, beam 4, 30 games)

| comp | vs | before | after |
|---|---|---|---|
| `triple-sleipnir` | `panel-control` | 93.3% | **76.7%** |
| `triple-sleipnir` | `panel-zoo` | 66.7% | 66.7% |
| `triple-jormungandr` | `panel-control` | 66.7% | 66.7% |
| `triple-jormungandr` | `panel-zoo` | 90.0% | **96.7%** |

**The stacked comp's best matchup came down 17 points.** That is the intended effect.

**`triple-jormungandr` vs `panel-zoo` went UP, and the reason matters:** `panel-zoo` itself contains
`jormungandr_v1` *and* `sleipnir_v1`, so it runs both scalers and **loses more from this fix than the
stacked comp does.** This change is therefore a general nerf to zoo panels at 3v3, which means it
also indirectly helps control — the opposite side of the exact problem tickets 115/116 were fixing.

**Owed:** `panel-control` vs `panel-zoo` at full tier has NOT been re-measured since this landed. The
last reading was 40.0%; it should now be higher. Every attempt exceeded the run budget, so it is
recorded as unmeasured rather than guessed at.

## Not changed, deliberately

The sibling scalers — `CARDS_DRAWN`, `CARDS_DISCARDED`, `ENERGY_SPENT`, `ELEMENT_PLAYED` — still read
side-wide state and have the **same shape of problem at 3v3**. They were left alone because Henry's
ruling named the card-played scalers specifically, and because each needs its own read of whether its
card text implies caster or side. Worth a sweep, not a silent extension of this fix.

## Gates

940/940 tests green, including three new ones in `src/engine/cardsPlayedScaling.test.ts`: an ally's
casts must not pump the caster, the caster's own second cast must still scale it (or the fix has
broken the card), and caster count must equal side count at 1v1. `damagePreview.test.ts` needed its
CARDS_PLAYED case updated to set the caster's `playsThisTurn` alongside the side counter — the
assertion itself is unchanged.
