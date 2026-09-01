# Ticket 133 — `dawns_respite` heals more than the blood toll it pays, and always has

**Status:** OPEN, needs a balance ruling. Found by ticket 131c's ×10 scale, 2026-09-01.

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
