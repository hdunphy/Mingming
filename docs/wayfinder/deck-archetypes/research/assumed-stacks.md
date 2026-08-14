# ASSUMED_STATUS_COUNT 3 → 1.5 — one constant, seven jobs, one measurement

- Type: wayfinder:research — Henry in session, 2026-08-15: *"move assumed stacks to 1.5, leave
  everything else as is."* **Scorer constant only.** No card, deck, hook, engine value or other
  scorer constant changed.
- Read at registry `1:8b7b0ae9`. Branch `card-dev`.

---

## 1. The answer, in one row

**Section 1.3 drops 40 → 37 redlines. Three cards came off; none went on. §2–3 byte-identical.**

| card | before | after | budget | |
|---|---|---|---|---|
| `ash_communion` | 9.3 (over by 2.8) | **4.1** | 6.5 | **OFF — the target of the change** |
| `rimebreaker` | 7.5 (over by 1.0) | **3.8** | 6.5 | **OFF** |
| `ash_reclamation` | 3.2 (over by 0.2) | **2.1** | 3.0 | **OFF** |

`ash_communion` is fixed and the fix is the right one — ticket 58 measured it consuming ~1.5
stacks against the 3 it was charged for, and that gap was its entire redline.

**But the constant feeds seven code paths and 1.5 was measured from one of them.** Two of the
other three cards that came off, and the largest single move in the set, are collateral.

---

## 2. Everything that moved

Ten cards changed score. Nine went down; one went up (a negative-scoring card whose penalty
shrank).

| card | cost | scaling path | old | new | Δ | budget | |
|---|---|---|---|---|---|---|---|
| Ash Communion | 2 | consume + STATUS_CONSUMED | 9.3 | **4.1** | −5.2 | 6.5 | **OFF list** |
| **Hexbloom** | 2 | WEAKENED_STACKS | 6.3 | **1.8** | **−4.5** | 6.5 | see §3 |
| Rimebreaker | 2 | DISTINCT_STATUS | 7.5 | **3.8** | −3.7 | 6.5 | **OFF list** |
| Umbral Feast | 1 | consume + STATUS_CONSUMED | 3.0 | 1.1 | −1.9 | 3.0 | |
| Heat Wave | 2 | MULTIPLY_STATUS | 3.0 | 1.5 | −1.5 | 6.5 | |
| Avalanche | 2 | BARKSHIELD_STACKS | 2.7 | 1.4 | −1.3 | 6.5 | |
| Ash Reclamation | 1 | consume + STATUS_CONSUMED | 3.2 | 2.1 | −1.1 | 3.0 | **OFF list** |
| Contagion | 2 | MULTIPLY_STATUS | 1.4 | 0.7 | −0.7 | 6.5 | |
| Slander | 2 | DAZED_STACKS | 1.5 | 0.8 | −0.7 | 6.5 | |
| Wither Feast | 2 | consume | −1.8 | −0.6 | +1.2 | 6.5 | |

Cards that consume a **named** number of stacks (`purify`, `slag_shed`, `baseline_purge`, all
at `stacks: -2`) did not move — they never read the constant.

---

## 3. The finding: the error did not shrink, it changed sign

`ASSUMED_STATUS_COUNT` stands in for seven different unknowables, and only one of them has
ever been measured:

| path | what it stands for | realistic count | on record |
|---|---|---|---|
| consume / `STATUS_CONSUMED` | stacks your own pile holds when you cash it | **~1.5** | **measured, ticket 58** |
| `DAZED_STACKS` | the target's Dazed pile | **~10** | ratatoskr_v2, ticket 32 |
| `DISTINCT_STATUS` | distinct debuff types on the target | **3** | draugr_v2, ticket 48 |
| `WEAKENED_STACKS` | the target's Weakened pile | **~6** | hexbloom hand-price, ticket 33 |
| `STATUS_COUNT`, `MULTIPLY_STATUS`, `BARKSHIELD_STACKS` | various board piles | unmeasured | — |

At 3 the constant over-priced the paths that read a **consumed** pile. At 1.5 it under-prices
the paths that read a **board** pile — by more, because those counts are larger.

**`hexbloom` is the clean example.** `powerscale.ts` carries a comment saying it "hand-prices to
6.3 against a 6.5 band" at its realistic 6 consumed stacks. At `ASSUMED = 3` it scored 6.3 —
accidentally exactly right. At 1.5 it scores **1.8**, roughly a quarter of its hand-price, and
it is now the most under-priced card in the roster.

`rimebreaker` and `slander` are the same shape: `DISTINCT_STATUS` realistically sees 3 and
`DAZED_STACKS` realistically sees ~10, so both are now scored against assumptions well below
what they meet in play. **`rimebreaker` came off the redline list for a reason unrelated to why
it was on it.**

None of this makes the change wrong. These were always FLOORS — a static pass cannot see the
board — and the ticket-58 measurement is the only real datum any of them has. It moves the
error, and it is worth knowing which direction it now points.

**The real fix is to split the constant per scaling path**, so each carries its own measured or
hand-set count. That is a design call, not a knob, so it was not taken.

---

## 4. One bug this surfaced — a silent NaN, not a wrong number

`burnPower` indexed `BURN_TIER_POWER[stacks - 1]` directly. A fractional stack count reads a
fractional array index, so **`burnPower(1.5)` returned `undefined` and propagated NaN into the
card score.** Nothing else in the scorer indexes by stack count — `poisonPower`, `regenPower`
and `streamStacks` are all formulas — so Burn was the only path that broke, and it broke into a
blank cell rather than a bad number.

Fixed by interpolating between rungs, which is also the honest reading of the constant: if a
pile is 1.5 on average then half the time it is 1 (4.5 power) and half the time 2 (13.5), so
the expected price is **9.0**. Clamped at both ends. Four regression tests pin it, including a
NaN guard across 0.5 … 4.5 and a monotonicity check below the cap.

This is the only change made beyond the constant itself, and it was forced — without it the
requested value produces no score at all.

---

## 5. Gates

`tsc -b` clean · **818 passed / 61 files** · `vite build` clean · full balance re-run.
Section 1.3 **40 → 37**; sections 2–3 **byte-identical** (a scorer constant cannot move a
simulation). Registry unchanged at `1:8b7b0ae9`.

---

## 6. Questions for Henry

1. **Split the constant?** Seven paths, one measurement (§3). Each could carry its own count —
   `CONSUMED_STACKS = 1.5`, `DAZED_STACKS ≈ 10`, `DISTINCT_STATUS = 3`, `WEAKENED_STACKS ≈ 6` —
   and three of those numbers are already on record in comments in this file.
2. **`hexbloom` at 1.8 against a 6.5 band** is now the roster's most under-priced card, and the
   file's own comment says its honest price is ~6.3. Leave, or hand-price it?
3. **`rimebreaker` left the redline list as collateral**, not because anything about it was
   re-measured. Does it stay off?
4. **The interpolation choice (§4)** — linear between rungs. Worth a look, since it now decides
   what every consume-Burn card is worth.
