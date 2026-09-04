# The DETONATE deep sweep — cap 3-8 x D 6-16%, and the case for cap 4

- Type: wayfinder:research — **REPORT-ONLY. Nothing shipped, no engine or data file written.**
  Every arm mutated `BURN_CONFIG` in memory on the committed ticket-62 refactor.
- Ordered by **Henry in session, 2026-08-15**, as a deliberate superset of ticket 62
  amendment 2 (which approved DETONATE at **cap 3** x D {10,12,14,16}). §8 reconciles the two.
- Read at registry **`1:8b7b0ae9`**, branch `card-dev`. **36 arms + baseline at 10 iterations
  (33,300 games), eight arms re-read at 30, three of those on a second seed base** — ~46,000
  games total.
- Instrument per amendment 2's scope rulings: **fenrir_v2 is the primary**; skoll_v2 and
  hraesvelgr_v2 are reported as **telemetry, not constraints**; draugr_v2 sentinel at D16.
- Template and quality bar: `jormungandr-v1-attribution.md`. Predecessor: `burn-grid.md`.

---

## 1. The answer, in one row

**`DET-C4-D14` lands fenrir_v2 at 48.5%** — the closest arm to amendment 2's 0.50 target,
confirmed on two independent seed bases (49.4% / 47.5%, 900 decided games each).

**And it gets there without the collateral that cap 3 causes.** The comparison that matters:

| | fenrir_v2 | skoll_v2 | hraesvelgr_v2 |
|---|---|---|---|
| live baseline | 24.9% | 25.4% | 78.4% |
| **`DET-C3-D12`** (best cap-3 arm) | 47.6% | **19.0%** (−6.4) | **83.0%** (over ceiling) |
| **`DET-C4-D14`** | **48.5%** | **27.2%** (+1.8) | **77.7%** (under ceiling) |

Same fenrir_v2 number. At cap 3 it costs skoll_v2 six points and pushes hraesvelgr_v2 three
points past the ceiling; **at cap 4 skoll_v2 is left where she started and hraesvelgr_v2 comes
down.** Amendment 2 scoped both decks out as *constraints* — this says you may not need to
spend that concession at all.

**FTK: 0 across all ~46,000 games**, every arm, every deck, both mirrors. Amendment 2's headline
watch item — that a 12-16% max-HP burst is the first credible Burn FTK vector — is measured
clean. The largest single detonation observed anywhere in the sweep is **14 HP**.

---

## 2. The surfaces

All 10-iteration. Read as a shape, not as verdicts — `0-DECISION-GRADE` puts ±5 on any single
cell, which is why §3 re-reads the leaders at 30.

**fenrir_v2 field win rate (%), 10 iterations**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  30.0 |  34.6 |  46.2 |  43.8 |  57.9 |  62.1 |
| **4** |  33.3 |  38.3 |  39.4 |  44.0 |  49.7 |  49.7 |
| **5** |  29.0 |  30.3 |  37.3 |  36.0 |  40.3 |  48.3 |
| **6** |  29.7 |  28.7 |  31.7 |  32.0 |  41.3 |  39.0 |
| **7** |  30.7 |  33.7 |  31.0 |  31.3 |  36.0 |  33.3 |
| **8** |  27.3 |  29.0 |  29.3 |  29.7 |  32.1 |  39.0 |

**Total Burn HP delivered per game (detonation + tick), fenrir_v2**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  31.2 |  36.6 |  42.2 |  46.9 |  49.6 |  55.2 |
| **4** |  25.4 |  28.5 |  32.7 |  35.5 |  38.4 |  41.6 |
| **5** |  21.2 |  24.2 |  28.0 |  29.3 |  33.4 |  35.7 |
| **6** |  19.2 |  20.9 |  22.3 |  23.4 |  27.1 |  29.3 |
| **7** |  19.6 |  20.6 |  21.9 |  22.3 |  25.1 |  25.4 |
| **8** |  17.2 |  19.1 |  19.8 |  20.7 |  23.1 |  24.7 |

**Detonations per game, fenrir_v2**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  2.58 |  2.72 |  3.06 |  3.17 |  3.09 |  3.27 |
| **4** |  1.60 |  1.65 |  1.92 |  1.99 |  2.03 |  2.03 |
| **5** |  1.01 |  1.24 |  1.39 |  1.38 |  1.55 |  1.61 |
| **6** |  0.72 |  0.83 |  0.89 |  0.93 |  1.06 |  1.17 |
| **7** |  0.50 |  0.61 |  0.63 |  0.69 |  0.82 |  0.77 |
| **8** |  0.32 |  0.44 |  0.52 |  0.53 |  0.65 |  0.77 |

**Tick HP per game, fenrir_v2 (the DoT the detonation is spending)**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  20.2 |  20.3 |  18.6 |  17.8 |  15.9 |  14.6 |
| **4** |  18.6 |  18.6 |  17.9 |  17.2 |  16.3 |  16.5 |
| **5** |  16.9 |  16.8 |  17.2 |  16.5 |  16.4 |  15.7 |
| **6** |  16.2 |  15.9 |  15.4 |  14.9 |  15.5 |  14.8 |
| **7** |  17.5 |  17.0 |  17.0 |  16.0 |  16.1 |  15.9 |
| **8** |  15.8 |  16.5 |  15.8 |  15.8 |  15.9 |  15.2 |

**skoll_v2 field (%) — telemetry, not a constraint**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  19.0 |  17.0 |  18.0 |  17.3 |  22.3 |  23.7 |
| **4** |  26.0 |  25.0 |  25.3 |  29.7 |  28.3 |  31.3 |
| **5** |  22.7 |  25.7 |  26.7 |  28.3 |  27.1 |  26.7 |
| **6** |  24.0 |  27.7 |  27.3 |  24.7 |  26.4 |  23.0 |
| **7** |  20.0 |  22.0 |  20.7 |  25.3 |  26.0 |  24.7 |
| **8** |  23.0 |  17.7 |  22.0 |  22.0 |  22.7 |  19.7 |

**hraesvelgr_v2 field (%) — telemetry, not a constraint**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  76.7 |  78.7 |  80.7 |  86.7 |  80.7 |  85.0 |
| **4** |  71.0 |  73.7 |  77.0 |  75.0 |  80.0 |  80.0 |
| **5** |  79.3 |  79.3 |  79.0 |  78.7 |  76.7 |  78.3 |
| **6** |  74.0 |  74.3 |  78.0 |  73.3 |  75.0 |  78.7 |
| **7** |  71.3 |  73.0 |  70.3 |  70.3 |  77.7 |  71.7 |
| **8** |  67.3 |  73.0 |  71.7 |  72.7 |  71.0 |  74.7 |

**fenrir_v2 self-detonation HP per game (the symmetric rule's cost)**

| cap | D6% | D8% | D10% | D12% | D14% | D16% |
|---|---|---|---|---|---|---|
| **3** |  0.68 |  0.70 |  0.77 |  1.50 |  1.30 |  1.04 |
| **4** |  0.27 |  0.58 |  0.70 |  0.57 |  0.90 |  1.04 |
| **5** |  0.04 |  0.04 |  0.05 |  0.06 |  0.03 |  0.08 |
| **6** |  0.03 |  0.04 |  0.02 |  0.03 |  0.03 |  0.04 |
| **7** |  0.00 |  0.02 |  0.00 |  0.00 |  0.00 |  0.00 |
| **8** |  0.00 |  0.02 |  0.00 |  0.03 |  0.03 |  0.00 |


---

## 3. The 30-iteration confirms

900 decided games per deck per arm. "Base A" and "base B" are independent seed bases.

| arm | fenrir_v2 @10 | **@30 base A** | **@30 base B** | **mean @30** | skoll_v2 @30 | hraesvelgr_v2 @30 | detonations/g | overflow HP/g | max single burst | self HP/g | fenrir mirror | FTK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `baseline` | 21.0% | **24.2%** | **25.7%** | **24.9%** | 25.4% | 78.4% | 0.00 | 0.0 | 0 | 0.00 | 6.1t | 0 |
| `DET-C3-D10` | 46.2% | **45.1%** | — | **45.1%** | 18.0% | 79.3% | 2.96 | 22.8 | 9 | 1.03 | 4.7t | 0 |
| `DET-C3-D12` | 43.8% | **47.6%** | — | **47.6%** | 19.0% | 83.0% | 3.10 | 28.5 | 11 | 1.37 | 4.2t | 0 |
| `DET-C3-D14` | 57.9% | **55.6%** | **56.4%** | **56.0%** | 23.2% | 81.6% | 3.14 | 34.2 | 12 | 1.31 | 4.2t | 0 |
| `DET-C4-D12` | 44.0% | **44.6%** | — | **44.6%** | 27.6% | 74.8% | 1.96 | 18.0 | 11 | 0.56 | 5.2t | 0 |
| `DET-C4-D14` | 49.7% | **49.4%** | **47.5%** | **48.5%** | 27.2% | 77.7% | 2.00 | 21.7 | 12 | 0.89 | 5.0t | 0 |
| `DET-C4-D16` | 49.7% | **52.2%** | **54.1%** | **53.1%** | 27.3% | 77.2% | 2.02 | 25.1 | 14 | 0.95 | 4.7t | 0 |
| `DET-C5-D16` | 48.3% | **45.7%** | — | **45.7%** | 26.3% | 77.4% | 1.57 | 19.5 | 14 | 0.05 | 5.4t | 0 |

**Nearest 0.50 is `DET-C4-D14` at 48.5% mean.** Within amendment 2's cap-3 constraint the
answer is **`DET-C3-D12` at 47.6%**.

The two seed bases agree closely on every arm measured twice — `DET-C3-D14` 55.6/56.4,
`DET-C4-D14` 49.4/47.5, `DET-C4-D16` 52.2/54.1 — a **1.9-point mean spread**, much tighter than
ticket 61's 5.5. Worth recording for the seed-base law: **the spread is not a constant, and a
Burn arm is a quieter measurement than a firmware payoff arm.**

**One caution on the baseline.** The live configuration reads **24.2% / 25.7%** here against
**27.6%** in the ticket-62 grid and **29.0%** at 10 iterations there. Nothing about fenrir_v2
changed between those runs. That is a ~5-point band on an unchanged deck, and it means **every
"Δ vs baseline" in this report should be read against ~25, not against a precise number.**

---

## 4. Cap is a brake on the entire mechanic, not just on the overflow

This is the sweep's main structural finding and it answers Henry's original worry directly.

Going from cap 3 to cap 8 at a fixed D = 16%:

| | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|
| detonations / game | 3.27 | 2.03 | 1.61 | 1.17 | 0.77 | 0.77 |
| **total Burn HP / game** | **55.2** | 41.6 | 35.7 | 29.3 | 25.4 | **24.7** |
| fenrir_v2 field | 62.1% | 49.7% | 48.3% | 39.0% | 33.3% | 39.0% |

The worry was that cap 3 makes overflow *too easy to trigger*. It does — 3.27 detonations a
game against 0.77 at cap 8. **But raising the cap does not merely make the payout rarer; it
makes the whole status weaker**, because the spread tier tables lengthen the climb and the pile
spends more of its life on the low rungs. Tick damage falls from 23.3 HP/game live to 15.2 at
cap 8 *before any detonation is counted*. The two effects compound in the same direction rather
than trading off.

**By cap 7-8 the mechanic has largely stopped existing**: under one detonation per game, and
total Burn output back at roughly the live number despite a 16% burst attached. If the goal is
"make overflow harder to reach without making Burn worse," this grid says the spread-tier
construction cannot deliver it — that would need a cap raise with the *climb* held fixed, which
is a different tier table than the one amendment 1 specified.

---

## 5. D is a clean, near-linear dial — and it works harder at low caps

At cap 3, every 2pp of D buys roughly **2.6 HP/game** of overflow and about **3 field points**.
At cap 8 the same 2pp buys **1.4 HP/game** and under 2 field points. The reason is arithmetic:
D multiplies the event rate, and the event rate is what cap controls.

Practically, **cap and D are not independent knobs** — they multiply. `C3-D10` (46.2%),
`C4-D14` (49.7%) and `C5-D16` (48.3%) are three different routes to the same place, and they
differ in *texture* rather than in strength:

| | C3-D10 | C4-D14 | C5-D16 |
|---|---|---|---|
| detonations / game | 2.96 | 2.00 | 1.57 |
| HP per detonation | ~7.7 | ~10.9 | ~12.4 |
| fenrir mirror | 4.7 turns | 5.0 turns | 5.4 turns |

Cap 3 is many small pops; cap 5 is few large ones. **That is the actual choice in front of
you** — the field number is available at all three.

---

## 6. Symmetric self-burn is still cheap, and cap is what prices it

| cap | fenrir_v2 self-detonation HP/game (at D14-16) |
|---|---|
| 3 | **1.21 – 1.37** |
| 4 | 0.86 – 0.96 |
| 5 | 0.05 |
| 6-8 | 0.00 – 0.04 |

The grid's reading holds: **symmetric self-burn is not a balance cost anywhere in this sweep.**
Even the most expensive arm charges fenrir_v2 under 1.4 HP a game against ~50 HP of Burn
delivered. The cap-3 numbers are ~3x the ticket-62 grid's because the payout is 2x larger and
her own pile crosses a low cap more often — the rule is *starting* to bite at cap 3, and stops
existing entirely at cap 5+.

If the symmetric rule is meant to create felt risk, **cap 3 is the only part of this space where
it registers at all**, and even there it is under 3% of her Burn output.

---

## 7. Telemetry on the two scoped-out decks

Reported because amendment 2 asked for them as telemetry, and because §1 turns on them.

**skoll_v2** confirms the grid's ruling — Burn is not her lever. Across all 36 arms she spans
17.3% to 31.3% against a 25.4% baseline, and **no arm moves her more than ~6 points in either
direction**. What the sweep adds is that the direction depends on cap: **cap 3 costs her**
(17.3-23.7 in every cap-3 arm, because detonation eats the ticks she actually lives on) while
**cap 4-6 leaves her flat or slightly up** (24-31). Her own revamp pass is still the answer, but
**a cap-4 Burn direction hands that pass a deck in the state it is in today rather than one six
points worse.**

**hraesvelgr_v2** is the sharper telemetry. She sits at 78.4% live, and **cap 3 pushes her over
the 0.80 ceiling in every arm at D ≥ 12** (81.6-86.7), while **cap 4-8 pulls her down** to
71-79. She is scoped out as a constraint, so this does not block anything — but a cap-3
direction hands her pass a deck that is *further* over the ceiling than it is now, and a cap-4
direction hands it one that is under.

**draugr_v2 sentinel held exactly**: 31.7% baseline, 33.7% at `DET-C3-D16`, 30.7% at
`DET-C8-D16` — **0 detonation events and 0 clamped stacks in every arm.** Her 2-stack
applications never reach a cap of 3, let alone 8.

---

## 8. Reconciliation with amendment 2

Amendment 2 approved **DETONATE, cap 3, current tiers, D in {10,12,14,16}**, with "anything else
→ STOP", and a ship rule of "nearest 0.50, confirmed at 30 iterations."

This sweep is a superset ordered by Henry directly in session. **Nothing was shipped**, so the
STOP boundary was not crossed — the extra arms are measurement, and the amendment's own arms are
all present and confirmed. Where the two would disagree:

| | amendment 2's answer | this sweep's answer |
|---|---|---|
| best arm | `DET-C3-D12` @ **47.6%** | `DET-C4-D14` @ **48.5%** |
| skoll_v2 | 19.0% (−6.4 vs baseline) | 27.2% (+1.8) |
| hraesvelgr_v2 | 83.0% (over ceiling) | 77.7% (under) |
| detonations / game | 3.10 | 2.00 |
| self-burn cost | 1.37 HP/g | 0.89 HP/g |

**The cap-4 tier table is amendment 1's, verbatim** (1.5 / 3 / 5 / 8, shred 0 / 1 / 2.5 / 5), so
choosing it needs no new design surface — it is already an approved table.

**Two assumptions this sweep made, both stated rather than resolved:**

1. **D steps of 2pp** (6, 8, 10, 12, 14, 16). Amendment 2's four values are all included.
2. **Tick tables for caps 6-8 did not exist** and were generated from the curve amendment 1's
   C4/C5 tables already describe — damage `1.5 + 6.5·t^1.35`, shred `5·t^1.62`, `t = i/(cap−1)`,
   which reproduces C5 exactly and C4 within 0.3pp and keeps the 8% + 5%-shred top tier at every
   cap per Henry's rule. The generated tables are:

| cap | tick tiers (damage % / shred %) |
|---|---|
| 6 | 1.5/0 · 2.2/0.4 · 3.4/1.1 · 4.8/2.2 · 6.3/3.5 · 8/5 |
| 7 | 1.5/0 · 2.1/0.3 · 3.0/0.8 · 4.0/1.6 · 5.3/2.6 · 6.6/3.7 · 8/5 |
| 8 | 1.5/0 · 2.0/0.2 · 2.7/0.7 · 3.6/1.3 · 4.6/2.0 · 5.6/2.9 · 6.8/3.9 · 8/5 |

Caps 6-8 all read below the target anyway (§4), so these tables carry no candidate — but if the
cap question is reopened, **they are my construction and not Henry's, and should be reviewed
before anything is built on them.**

---

## 9. Questions for Henry

1. **Cap 3 or cap 4?** Both hit ~48% on fenrir_v2. Cap 4 costs nothing on the primary and is
   strictly kinder to both scoped-out decks; cap 3 is the amendment's approved constraint and
   gives the punchier texture (3 pops a game vs 2). This is the whole decision.
2. **If cap 4: `D14` (48.5%) or `D16` (53.1%)?** Both are mid-window. D16 is 2 field points past
   the midpoint with a 14 HP maximum burst; D14 is the nearest to 0.50 by the amendment's own
   rule.
3. **Does the skoll_v2 telemetry change her queue position?** A cap-4 direction hands her revamp
   pass a 27% deck; a cap-3 direction hands it a 19% one. The pass is coming either way, but the
   starting point differs by six points.
4. **The cap-6/7/8 tier tables are mine, not yours** (§8). No candidate depends on them, but if
   you ever want a *higher cap with the same climb* — the one thing this grid says the
   spread-tier construction cannot give you — that is a new tier table and a design call.
5. **Ship authority.** Amendment 2 has a full ship-and-gate section keyed to a cap-3 arm. If the
   answer is cap 4, that section needs an amendment before I run it — I have not shipped
   anything and am holding here.
