# Ticket 120 — hexbloom and the over-band tail: is the scorer double-counting consumed stacks?

**Status:** OPEN. Opened 2026-08-26 at Henry's request — *"Leave hexbloom for now, add a ticket to
investigate later. We might just be scoring it wrong, it does consume stacks."*

## Henry's hypothesis, and why it looks right

`hexbloom` reads *"Apply 2 Poison per stack of Weakened on the target. The Weakened remains."* It
scores **16.5** against a 2e ceiling of 6.5 — **+154%**, the third most over-band card in the pool.

The scorer prices scaling status actions against `ASSUMED_WEAKENED_STACKS = 5`, so it charges the
card as though it reliably converts five Weakened into ten Poison. Two reasons that is probably too
generous:

1. **Five Weakened on a target is an optimistic board**, not a typical one. The constant was derived
   from a measurement (5.04), but a mean across all boards is not the board this card is cast on.
2. **The consume question Henry raised.** `powerscale.ts` carries `ASSUMED_CONSUMED_STACKS` for cards
   that spend the pile they read. `hexbloom` says *"The Weakened remains"* — so it does **not**
   consume, which is *more* value, not less. **Worth checking whether the scorer has this backwards
   for the family**: if the non-consuming case is priced as though it also cashes the stacks, the
   scaling term is being counted twice.

The investigation is: score the whole `scaling` family — `WEAKENED_STACKS`, `STATUS_CONSUMED`,
`DAZED_STACKS` — against what those cards actually convert in real games, the way ticket 64 did for
Strengthened, rather than against a board assumption.

## This is not just hexbloom — there is a pre-existing over-band tail

Measured across all 208 costed non-token cards (`scratch/bandspread.ts`), the worst offenders that
have **nothing to do with any recent change**:

| card | cost | score | ceiling | over by |
|---|---|---|---|---|
| `umbral_feast` | 1e | 14.9 | 3.0 | **+397%** |
| `contagion` | 2e | 20.4 | 6.5 | **+214%** |
| `hexbloom` | 2e | 16.5 | 6.5 | **+154%** |
| `corrosive_leak` | 0e | 2.3 | 1.0 | +130% |

`umbral_feast` and `contagion` are both scaling/consume cards too. **That is four cards in the same
family at the top of the list, which is the tell that this is a scorer problem and not four
independent card problems.**

The same run found the opposite tail — `desperate_strike` and `dark_pact` at −410%, `wither_feast` at
−266% — all drawback cards, where the scorer subtracts self-harm at full price. Probably also worth a
look, and it is why standard deviation is the wrong statistic for band tolerance (see ticket 121).

## Do not act on this before the design question

If the scoring is wrong, `hexbloom` may already be a fair 2e card and the ticket-115 revert was
correct on its own terms. If the scoring is right, `hexbloom` is a genuinely overtuned card that has
been in the pool the whole time. **Those lead to opposite actions**, so measure first.

**Cross-reference:** side-scoping `hexbloom` was worth ~15 points to `panel-control` at 3v3 (ticket
115). It is the largest single lever still on the table if control needs more — but it should not be
pulled until this pricing question is settled.
