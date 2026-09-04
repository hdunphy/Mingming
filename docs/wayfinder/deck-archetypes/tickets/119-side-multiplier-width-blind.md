# Ticket 119 — the scorer's Side scope multiplier is width-blind

**Status:** OPEN. Opened 2026-08-26 at Henry's request — *"Add a ticket to address later."*
Created by ticket 115, which shipped five cards knowingly over band because of this.

## The problem in one line

`powerscale.ts` multiplies an enemy-facing action by **×2.2** when the card's scope is `Side` — one
constant for a quantity that is genuinely **1.0 at width 1 and 3.0 at width 3**.

## Why it matters now

Ticket 115 flipped five cards from `Single` to `Side`. Measured, those cards became **0% stronger at
1v1** — bit-identical results, because a side-wide effect facing one body hits one body — and roughly
**4.5× stronger at 3v3**. The scorer records both as "+120%, over band".

So five cards now sit permanently in the over-band list:

| card | cost | score | ceiling | over by |
|---|---|---|---|---|
| `frost_bite` | 1e | 7.3 | 3.0 | +143% |
| `numbing_gale` | 1e | 6.6 | 3.0 | +120% |
| `killing_frost` | 1e | 6.6 | 3.0 | +120% |
| `rimefrost` | 0e | 1.9 | 1.0 | +90% |
| `ice_spear` | 1e | 5.6 | 3.0 | +87% |

**The risk is not cosmetic.** A future numeric pass reading that list will "correct" these cards back
down, and every way of paying for the scope was already measured and defeats the purpose (ticket 115:
+1 Energy each gives back 35 of the 45 points at 3v3 and costs `draugr_v2` 18.4 points at 1v1). The
ledger is currently set up to undo a change that works.

## Options

- **(a) Make the multiplier width-aware.** The scorer would need to know which width a card is being
  priced for, which it currently does not — this is the honest fix and the largest one.
- **(b) Price Side at the blend the run arc actually sees.** The run meets 1v1 early and 3v3 at the
  gym, so the true average is somewhere between 1.0 and 3.0. ×2.2 may already be that blend — in
  which case the fix is not the number but the fact that it is applied to cards whose *1v1* profile
  did not change at all.
- **(c) Exempt these cards explicitly**, with the measurement attached, so the list stops reading as
  a backlog of mistakes. Cheapest, least principled.

## Related

Ticket 121 (band tolerance) is adjacent but does **not** solve this — these cards are 87–143% over,
far outside any sane tolerance. This needs its own answer.
