# The sweep is 1.9x faster, not 10x — and one of the three tiers had to be demoted

- Type: wayfinder:implementation. **Ticket 108** (sim speed, pieces 2–3 + the three-tier AI).
  Branch `archetype-web`. Continues ticket 97.
- **868 tests green**, `tsc` clean, build clean. **No balance numbers changed** — this is
  instrument work, and the gate for all of it is that the numbers are identical.

---

## 0. The short version

The ticket promised a compound speedup big enough to turn *"a three-hour design test into fifteen
minutes."* **It isn't there.** The honest number on this box is **1.9x**, and the projection on your
machine is roughly **5–7x**, not 10–12x.

Three things came out of measuring it, and two of them matter more than the speed:

1. **The cheap AI tier is trustworthy for ranking arms, and untrustworthy for band verdicts.** It
   reproduces full's ordering exactly but reads only ~77% of the spread, biased *upward* on weak
   arms. So: screen with it, confirm the winner with full, never call a deck in-band off it.
2. **The greedy tier is worse than the ticket assumed, in the exact case the ticket said was safe.**
   It was blessed for "pure numeric-knob arms." A numeric knob is precisely what it misreads.
3. **The worker pool is unparked** — as processes, not threads — and it is bit-identical.
4. **Adaptive sampling is rejected as a speed lever.** Stopping early on a decided cell manufactures
   blowout matchups: 13 cells read as absolutes at 6 games when only 3 really are.

---

## 1. The control that changed the reading

The first three-tier run looked bad: lite disagreed with full by 3.7 field points on `draugr_v2`
while matching exactly on `hel_v2`. An instrument that disagrees on one deck and not another is
usually a broken instrument.

It wasn't. **I had no control.** At the arm-ranking grade the ticket specifies — 10 iterations x 2
orders, so 20 games a cell — a cell's granularity is 5 points and its standard error is about 11. So
I ran full against **full**, on two fresh seed bases, holding the tier fixed:

| pair | mean Δ | MAD | max |Δ| | cells ≥10pt |
|---|---|---|---|---|
| **CONTROL** `draugr_v2` full@grid vs full@altA | +0.00 | 6.00 | 30 | 12/30 |
| **CONTROL** `draugr_v2` full@grid vs full@altB | −1.33 | 9.67 | 25 | 17/30 |
| **TEST** `draugr_v2` full vs **lite** | +3.67 | **6.67** | 25 | 11/30 |
| **CONTROL** `hel_v2` full@grid vs full@altA | +3.00 | 13.00 | 30 | 20/30 |
| **CONTROL** `hel_v2` full@grid vs full@altB | +3.17 | 10.17 | 30 | 18/30 |
| **TEST** `hel_v2` full vs **lite** | +0.00 | **5.67** | 15 | 9/30 |

**Lite disagrees with full less than full disagrees with itself.** At this grade the tier is not the
dominant error term — the seed base is. That is the 0-DECISION-GRADE law pointed at the instrument
instead of at a deck, and without it I would have rejected a tier for being noisy when the noise was
the harness's own.

---

## 2. Does the cheap tier rank arms the same? Yes — but it flattens them

Cell agreement is the wrong test. A sweep doesn't ask *"what is this cell"*, it asks *"which arm is
better"*, and arms share a seed base so their noise is correlated. So I ran a real sweep — the
`rimebreaker` power knob on `draugr_v2`, the live card from ticket 107 — at both tiers:

| `rimebreaker` power | full | lite | Δ |
|---|---|---|---|
| 0 | 41.67% | 49.83% | **+8.2** |
| 10 | 44.48% | 54.17% | +9.7 |
| 15 | 54.33% | 60.17% | +5.8 |
| **20 (live)** | **61.50%** | **65.17%** | +3.7 |
| 25 | 70.83% | 73.33% | +2.5 |
| 30 | 76.00% | 76.33% | **+0.3** |

**Ordering: identical. Every arm, monotone in both.** That is the property a screen needs.

But look at the Δ column. Full spans 34.3 points across the sweep; lite spans 26.5 — **lite reads
77% of the slope**, and the error is systematically largest where the arm is *weakest*. That is a
shallower search finding fewer of the losing lines: lite reads the deck's floor, full reads its
ceiling.

**The rule that follows, and it is now written into `TacticalAI.ts` where nobody can miss it:**

> **Screen with lite. Confirm the winner with full. Never read a band verdict off lite.**

A ranking survives a uniform compression. A band call does not — 49.8 vs 41.7 is the difference
between "comfortable" and "flirting with the 35 floor", and that is exactly where a wrong number
does damage.

---

## 3. The greedy tier is demoted, and this is the finding I'd least have predicted

The ticket permits greedy for *"pure numeric-knob arms"*, on the theory that its bias is against
decision-heavy cards and a plain number isn't one.

I measured that directly. **Marginal card value** = deck field with the card at printed power, minus
deck field with its power zeroed — the card left in the deck either way, so its energy curve and
card count don't move and the delta is the card's *contribution*:

| card | what it is | full | lite | greedy |
|---|---|---|---|---|
| `momentum_crash` | consume-Strengthened payoff | **+5.25** | +4.67 | **+0.75** |
| `zephyr_strike` | flat 15 + draw | **+3.67** | +3.00 | **+0.67** |
| `stampede` | her biggest card | **+26.67** | — | +28.63 |
| `rimebreaker` | ANY_STATUS payoff | **+19.83** | +15.33 | +15.17 |

Greedy priced `stampede` and `rimebreaker` about right and **compressed the other two by five to
seven times.** And nothing in the card text tells you which it will do — `zephyr_strike` is a flat
attack, the least decision-heavy card in the test, and greedy read it at 18% of its value.

The mechanism is substitution, not sequencing. **A change the deck can play around is nearly free to
an AI that just plays something else.** Gutting `stampede` leaves it with nothing to substitute, so
greedy sees that fine. Shaving a mid-sized card, it doesn't. **A numeric knob is usually the
substitutable kind** — which makes the ticket's carve-out backwards.

Greedy stays as the decision-density probe it was built to be (ticket 99). It is not a screening
tier.

Lite, for contrast, read those same four at 89%, 82%, — and 77% of full. Consistently near, never
wildly off. That is the difference between a tier you can correct for and one you can't.

---

## 4. The worker pool: unparked, as processes

Ticket 97 parked this on the loader problem — `worker_threads` doesn't inherit the TypeScript
loader, and every workaround (a compiled `dist`, loader flags in `execArgv`, a bundling step) puts a
**build artifact between the source and the number.** That risk isn't hypothetical here: it is the
ticket-103 cell-cache bug again, a fast instrument reporting a stale build, in a form no test would
catch.

**A child process is a fresh interpreter with the same loader**, so it has none of that. It costs
~1s of startup per lane, which against a 30-second row is noise. `scratch/gridshard.ts` +
`scratch/pool.mjs`.

Sharding is legal because a cell is a pure function of `(setup, seed)`, the seed is derived from the
cell's own identity, and no cell reads another's result. **`--verify` proves it rather than
asserting it** — it runs the row serially and sharded and diffs cell by cell, non-zero exit on any
mismatch:

```
serial   1 lane   29.4s  field 61.50%
parallel 2 lanes  24.3s  field 61.50%
speedup  1.21x on 2 cores
BIT-IDENTICAL: every cell matches the serial run.
```

Also verified bit-identical at the lite tier. Work is handed out by **stride, not block** — cell cost
varies hugely by species (a stalling matchup runs to the 60-turn cap), and contiguous blocks make
lanes finish at wildly different times.

**This sandbox has 2 cores**, so 1.21x is all it can show, and 4 lanes on 2 cores was *slower*
(28.6s) — lanes should never exceed cores. The speedup is a function of your core count, so this is
the piece you'll see the real benefit from and I can't measure it for you.

---

## 5. Adaptive sampling: measured, and rejected as a speed lever

Piece 3's idea is that a cell already decided doesn't need its remaining games. It's true that it
doesn't — and it's the wrong trade **in this toolkit specifically**, because the absolutes count is
a roster-health metric you track (ticket 94's law; ticket 101 moved roster neutral absolutes 30→15).

`draugr_v2`, same row, counting cells that read 100% or 0%:

| games per cell | cells reading as absolutes | actually absolute at 20 games |
|---|---|---|
| 6 | **13** | 3 |
| 10 | **9** | 3 |
| 20 (baseline) | 3 | 3 |

**Ten of thirteen were false.** `nidhoggr_v1` — a real 15% cell, 85 points away from absolute — reads
as an unwinnable matchup at 6 games. And the error is entirely one-directional: no real absolute was
ever missed, only invented.

An early-stopping sweep would have reported draugr with **thirteen blowout matchups instead of
three**, and blowout count is a number this project makes decisions on.

**So adaptive sampling belongs here as a PRECISION lever, not a speed one** — spend *extra* samples
on uncertain cells rather than *fewer* on certain ones. That's a different ticket and it costs time
rather than saving it. I'd rather say that than ship a fast harness that invents blowouts.

---

## 6. What the speedup actually is

| configuration | `draugr_v2` row, 30 cells | vs full serial |
|---|---|---|
| full, serial | 29.4s | 1.00x |
| full, 2 lanes | 24.3s | 1.21x |
| lite, serial | 18.8s | 1.56x |
| **lite, 2 lanes** | **15.3s** | **1.92x** |
| greedy, serial | 9.5s | 3.09x *(not usable — §3)* |

**Compound available on this box: 1.92x.** The pool scales with cores and lite doesn't, so on an
8-core machine expect roughly 4–5x from the pool and 1.6x from lite: **~5–7x compound**.

That is a real improvement and it is **not** the ticket's 10–12x. The ticket's arithmetic assumed
4–6x from lite alone; lite delivers 1.6x, because the reply depth was deliberately left alone (it's
what makes a lookahead a lookahead) and there's fixed per-turn cost outside the search.

**The cache from ticket 97 remains by far the biggest lever we have** — 36x on a warm grid, versus
1.9x here. For a pass that touches one card, the cache is the speedup and this work is a rounding
error on top of it.

---

## 7. Instruments left behind

| file | what it answers |
|---|---|
| `scratch/tiercalibrate.ts` | run one deck row at a tier; per-cell CSV + timing. `SEEDBASE` runs the control. |
| `scratch/tierbias.ts` | marginal value of one card at one tier — the test that demoted greedy. `POWER` sweeps a knob. |
| `scratch/gridshard.ts` | one lane of a sharded row |
| `scratch/pool.mjs` | the pool + its `--verify` bit-identity gate |

---

## 8. What I'd want from you

Nothing blocking — no balance numbers moved. Two things worth knowing:

- **The sweep is ~2x faster here and probably 5–7x on your machine, not the 10x the ticket
  promised.** If any plan downstream was budgeted on 10x, it needs re-budgeting.
- **`git push -u origin archetype-web` is still yours to run.** I have no network from inside the
  sandbox, so every commit in this arc — `bec5b51` through this one — is sitting on your disk
  unpushed.
