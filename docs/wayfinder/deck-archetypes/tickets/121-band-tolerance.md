# Ticket 121 — the cost band needs a tolerance, and the pool says what it should be

**Status:** OPEN, proposal ready for a ruling. Opened 2026-08-26.

Henry, on `frost_bite` scoring 3.3 against a 3.0 ceiling: *"3.3 vs 3 is not a problem. 3 is not a
hard cut off but a general target we can be +/- some percentage. If it would make you feel better add
a metric here. Like +/- 15% or maybe use Standard deviation or something."*

He is right, and the current reporting is the problem. Every audit in this repo prints **IN BAND** or
**OVER** with no sense of distance, so a card 1% over and a card 397% over produce the same word —
and then get treated the same way in the follow-up. That is how `frost_bite` at +10% ended up on a
list next to `umbral_feast` at +397%.

## What the pool actually looks like

`scratch/bandspread.ts` scores all **208** costed, non-token cards and expresses each as a percentage
of its own cost band's ceiling, so cards at different costs are comparable:

```
  mean -12.3%    median -3.3%    standard deviation 67.5%
  median ABSOLUTE deviation 10.0%
```

**The median card sits 10% away from its band ceiling.** That is the pool's own working noise, and it
is what a tolerance should be built on.

| tolerance | cards still over | share of pool |
|---|---|---|
| +5% | 37 | 17.8% |
| **+15%** | **25** | **12.0%** |
| +25% | 20 | 9.6% |
| +50% | 9 | 4.3% |

## Proposal

**Adopt ±15%**, which is 1.5× the pool's median absolute deviation — wide enough to stop flagging
ordinary rounding, tight enough that it still catches 25 cards worth looking at. Henry's instinct was
within 5 points of what the data supports.

Reported as three states rather than two:

- **IN BAND** — within the existing `under`–`over` window.
- **WITHIN TOLERANCE** — outside it but within ±15% of the ceiling. Printed with the actual
  percentage, not waved through silently.
- **OUT OF BAND** — beyond that.

And **always print the percentage**, in all three states. The distance is the useful number; the
label is a convenience.

## Do NOT use standard deviation, and this is why

The pool's sd is **67.5%**, which would put "1 sd" at a +67% tolerance and wave through `contagion`
(+214%) only at 2 sd. The distribution is not normal: drawback cards score *negative*, so
`desperate_strike` and `dark_pact` sit at **−410%** and drag the sd far beyond anything meaningful.
**Median absolute deviation is the robust statistic here** — it ignores the outliers instead of being
defined by them.

## What this does not fix

The five ticket-115 cards are 87–143% over and stay out of band under any tolerance worth having.
That is ticket 119, and it needs a different answer.
