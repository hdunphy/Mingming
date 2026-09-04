# Ticket 133 — `dawns_respite` heals more than the blood toll it pays, and always has

**Status:** CLOSED 2026-09-04 — RULED by Henry: option 3, leave it. See the Resolution.

## The finding

`hel_v2`'s UNDERWORLD_GATEWAY charges **6% of max HP per printed Energy** at action start.
`dawns_respite` is a 1-energy Dark card with a power-25 heal, so on any frame:

```
toll = maxHp x 0.06 x 1        heal = maxHp x 25 / 400  =  maxHp x 0.0625
```

**The heal is 6.25% and the toll is 6%.** The card has always been a net +0.25% of a health bar,
every cast.

## Why nobody noticed

On the old 200 HP test frame the toll was **12** and the heal was **12.5**, and `Math.floor` cut the
heal to 12. `StanceSystem.test.ts` asserted the net was "exactly zero" and passed. On the ×10 frame
it is 125 against 120 and the difference is visible.

## Why it matters

Ticket 81's whole argument for removing hel_v2's old +50% healing bonus was that **a heal which
out-earns the blood price turns the cost into a loan**:

> Henry: the healing bonus is what stopped HP-as-a-cost working - a heal that OUT-EARNS the blood
> price turns the cost into a loan. Heals are meant to alleviate the self-damage, not erase it.

The bonus went, and the card kept being a small loan anyway — 4% more back than it pays, unbounded
by anything except her energy.

## The options, none of them taken

All three are one number, and all three are Henry's call:

1. **Heal power 25 → 24** — `maxHp x 24/400` is exactly 6%, so the card breaks even to the point.
   Smallest possible change and it makes the printed intent literally true.
2. **Blood price 6% → 7%** (`OS_KNOBS.hel.pctPerEnergy`) — makes every Dark card cost more, not just
   this one, so it is a nerf to the whole firmware rather than a fix to one card.
3. **Leave it.** 0.25% of a health bar per cast is small, and hel_v2 is not currently flagged as
   over-strong. Recorded so it is a decision rather than an oversight.

**Recommendation: (1).** It is the only one that changes just the thing that is wrong.

---

# Resolution — CLOSED 2026-09-04. Option 3: leave it.

Henry: *"leave hel as is. One card that overheals is fine. Before it was all the cards overhealing
and hel was staying at 100% HP."*

**No code changed.** `dawns_respite` keeps its power-25 heal and `OS_KNOBS.hel.pctPerEnergy` keeps
whatever the balance work has set it to.

## Why option 3 rather than the recommendation

The ticket recommended option 1 (heal power 25 → 24) on the grounds that the card contradicts
ticket 81's principle. **That reading conflated two different problems, and the ruling separates
them.**

What ticket 81 killed was UNDERWORLD_GATEWAY's **+50% healing bonus**, which applied to *every heal
she cast*. That is what let her sit at full health indefinitely: not one card netting a little, but
the entire heal side of her deck out-earning the toll at once, so the blood price never actually
cost her anything. **The failure was systemic, and the fix was systemic.**

A single 1-energy card returning 0.25% of a health bar more than it pays is not that. It cannot
hold her at 100% on its own, it competes with every other card for the same energy and the same
turn, and a heal that slightly beats its own price is a reasonable thing for a heal to be. The
principle ticket 81 wrote down — *"heals are meant to alleviate the self-damage, not erase it"* —
is satisfied by one card at +0.25%; it was violated by a firmware-wide multiplier.

## What this also settles

`crimson_draw` and `ember_mend` — the two remaining cards flagged in ticket 138 for printing a
percentage of max HP over a power-based heal — **stay as they are** by the same ruling. Their
entries in `descriptionData.test.ts`'s allowlist are updated to say they are ruled rather than
deferred.

Note the arithmetic in this ticket predates ticket 136k, which took the blood price from 6% to 5%.
At 5% the toll on a 1-energy Dark card is 5% of max HP against the same 6.25% heal, so the margin
is **+1.25% per cast rather than +0.25%** — five times what the ticket measured. That is recorded
here rather than treated as a reason to reopen: the ruling is about the SHAPE (one card, not the
whole heal side), and the shape did not change. If hel_v2 ever reads over-strong, the blood price
is the knob and 136k's measured curve is the map — 4% = 83, 5% = 60, 6% = 25 field.
