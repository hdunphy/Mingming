# The status pile census — what a card actually finds when it reads a pile

- Type: wayfinder:research — **report-only measurement**, plus the one scorer change Henry
  authorised (the 1.5 consumed-stack assumption, now scoped to Burn alone).
- Henry, 2026-08-15: *"haven't we pulled average statuses per match?"* **We had not.** Ticket 58
  measured Burn's consumed pile and nothing else; the "~10 Dazed" and "3 distinct debuffs"
  figures in `powerscale.ts` comments are hand-derived notes, never measured. This is the
  measurement.
- **3,840 real battles**, every species × both OSes × the whole field, both turn orders.
  Sampling happens outside `getBestAction` per `0-AI-SIM-COUNTS` — the AI's lookahead pushes
  candidate plays through the reducer and would inflate every count.
- Registry `1:8b7b0ae9`, branch `card-dev`.

---

## 1. The answer, in one row

**`ASSUMED_STATUS_COUNT = 3` is wrong for almost everything it is used for, in both
directions.** It is close for exactly one path, and badly off for four.

| what the scorer assumes | measured | verdict |
|---|---|---|
| consume **Burn** = 1.5 | **1.50** | **correct — Henry's change is confirmed** |
| consume **Poison** = 3 | **11.47** | **under by 3.8×** |
| `DISTINCT_STATUS` = 3 | **0.70** | **over by 4.3×** |
| `DAZED_STACKS` = 3 (comment claims ~10) | **3.62** | **3 is right; the ~10 note is wrong** |
| `WEAKENED_STACKS` = 3 | **5.04** | under by 1.7× |
| `BARKSHIELD_STACKS` = 3 | **7.70** | under by 2.6× |

---

## 2. Board piles — how big a pile is, given one exists, at the moment a card is played

| status | observations | mean | median | p75 | p90 | max |
|---|---|---|---|---|---|---|
| **BarkShield** | 20,461 | **7.70** | 5.8 | 8.9 | 14 | 56 |
| **Sharp** | 51,387 | **7.61** | 4 | 11 | 18 | 74 |
| **Poison** | 40,745 | **6.57** | 4 | 9 | 16 | 99 |
| **Strengthened** | 66,850 | **5.90** | 4 | 8 | 12 | 50 |
| **Weakened** | 50,133 | **5.04** | 4 | 7 | 11 | 42 |
| **Dazed** | 38,012 | **3.62** | 2 | 4 | 8 | 34 |
| **Burn** | 7,639 | **2.27** | 2 | 3 | 4 | 4 |
| **Regen** | 10,188 | **2.25** | 2 | 3 | 4 | 8 |
| **Asleep** | 7,455 | **2.01** | 2 | 2 | 3 | 3 |
| **Energized** | 6,749 | **1.22** | 1 | 1 | 2 | 4 |
| **Stunned** | 112 | **1.00** | 1 | 1 | 1 | 1 |
| **StableOS** | 2,228 | **1.00** | 1 | 1 | 1 | 1 |
| **DarkStance** | 7,071 | **1.00** | 1 | 1 | 1 | 1 |
| **LightStance** | 4,136 | **1.00** | 1 | 1 | 1 | 1 |

Read this as an upper bound for the scaling paths: it is conditional on the pile existing, and
a card that reads a pile it does not find scores zero from that term. The one unconditional
number below is the honest counter-weight.

**Distinct debuff TYPES on the entity a card is aimed at, counting zeros: mean 0.70, median 1,
p75 1, p90 2, max 4** (109,524 observations).

That is the number `DISTINCT_STATUS` actually multiplies, and it is **0.70 against an assumed
3.** `rimebreaker` — "25 power for each different debuff on the target" — is priced as if it
reliably finds three and typically finds one or none.

---

## 3. Consumed piles — what a consume action actually takes

The exact measurement: the pile size on the holder at the moment the consume resolves.

| status | observations | mean | median | p75 | p90 | max | took nothing |
|---|---|---|---|---|---|---|---|
| **Poison** | 321 | **11.47** | 12 | 15 | 19 | 79 | 0.0% |
| **Burn** | 22 | **1.50** | 2 | 2 | 2 | 3 | 22.7% |

| card | status | observations | mean | median | p90 | max |
|---|---|---|---|---|---|---|
| `wither_feast` | Poison | 208 | **13.58** | 13 | 19 | 24 |
| `ash_communion` | Burn | 22 | **1.50** | 2 | 2 | 3 |
| `umbral_feast` | Poison | 113 | **7.58** | 3 | 19 | 79 |

**Burn's 1.50 lands exactly on ticket 58's estimate**, and note the 22.7% of casts that consume
*nothing at all* — Burn's 4-stack cap and 1/turn decay keep the pile small and short-lived in a
way no other status's is.

**Poison is the opposite animal.** It has no cap, so `wither_feast` averages **13.58** stacks
and `umbral_feast` runs to a maximum of **79**. Both are priced against 3.

`umbral_feast`'s median is 3 against a mean of 7.58 — a long right tail rather than a typical
big pile, which matters if the number is ever set: the mean and the median tell different
stories and the mean is dragged by a handful of huge piles.

---

## 4. What changed in the scorer, and what did not

**Changed — the one thing Henry authorised.** `ASSUMED_STATUS_COUNT` is back to **3**. A new
`ASSUMED_CONSUMED_STACKS` table holds **Burn: 1.5** and nothing else; anything absent falls back
to 3. A `STATUS_CONSUMED` heal names no status of its own, so it now resolves the status from
its card's consume action — `ash_communion` consumes Burn and prices at 1.5, `umbral_feast`
consumes Poison and prices at 3.

**Section 1.3: 40 → 38.** Only the two Burn-consume cards moved.

| card | original | after the global 1.5 | **after scoping to Burn** |
|---|---|---|---|
| `ash_communion` | 9.3 (over) | 4.1 | **4.1 — off the list** |
| `ash_reclamation` | 3.2 (over) | 2.1 | **2.1 — off the list** |
| `rimebreaker` | 7.5 (over) | 3.8 (off) | **7.5 — back on, correctly** |
| `hexbloom` | 6.3 | 1.8 | **6.3 — restored** |
| `umbral_feast`, `wither_feast`, `slander`, `heat_wave`, `contagion`, `avalanche` | — | moved | **all restored** |

Sections 2–3 byte-identical throughout.

**NOT changed — every number in §1 that the census says is wrong.** Those are design calls.
The measurement is here; the decision is Henry's.

---

## 5. Recommendations, with the measurement behind each

| path | now | measured | suggested | why |
|---|---|---|---|---|
| consume Burn | **1.5** | 1.50 | keep | shipped, confirmed |
| consume Poison | 3 | 11.47 | **~8–12** | biggest single mis-pricing in the file; median 12, and `wither_feast` alone averages 13.6 |
| `DISTINCT_STATUS` | 3 | **0.70** | **~1** | unconditional, so this one needs no caveat; `rimebreaker`'s redline is largely an artifact |
| `DAZED_STACKS` | 3 | 3.62 | keep 3 | and **delete the "~10" comment**, which is measurably wrong |
| `WEAKENED_STACKS` | 3 | 5.04 | ~4–5 | `hexbloom`'s hand-price of ~6.3 implies ~6; the census says 5.0 conditional |
| `BARKSHIELD_STACKS` | 3 | 7.70 | ~5–8 | `avalanche` reads its own shield, which is the most reliable pile on the board |
| `STATUS_COUNT`, `MULTIPLY_STATUS` | 3 | per-status | per-status | `heat_wave` doubles **Burn** (board mean 2.27); `contagion` doubles **Poison** (6.57) |

The last row is the structural point: **`MULTIPLY_STATUS` should read the pile of the status it
doubles**, not one shared constant. Doubling Burn and doubling Poison are not the same card.

---

## 6. Caveats worth stating

1. **Board numbers are conditional on the pile existing.** A card that reads a pile it does not
   find scores nothing from that term, and this census does not measure how often that happens
   per card. `DISTINCT_STATUS` is the exception — 0.70 already counts the zeros.
2. **Burn's consume sample is small** (n=22) because `ash_communion` and `ash_reclamation` are
   rarely cast. It agrees with ticket 58's independent estimate, which is why it is trustworthy
   despite the size, but it should be re-read after any Fire deck change.
3. **These are AI-driven battles**, so they measure what `TacticalAI` builds up to, not what a
   skilled player would. Every balance number on this project carries that caveat.

---

## 7. Questions for Henry

1. **Poison's consumed count** (§3) is the biggest miss on the board — 11.47 against 3. Set it,
   or hand-price `wither_feast` and `umbral_feast`?
2. **`DISTINCT_STATUS` at 0.70** makes `rimebreaker`'s redline mostly artificial. Fix the
   constant, or is 3 a deliberate aspiration for how debuff-dense fights should get?
3. **Split `MULTIPLY_STATUS` per status** (§5)? It is the one path where a single constant is
   clearly wrong by construction rather than by measurement.
4. **The "~10 Dazed" note in `powerscale.ts` is measurably wrong** (3.62). Delete it?
