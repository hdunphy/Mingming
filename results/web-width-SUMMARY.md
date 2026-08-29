# Ticket 110 — web-width probe, screening pass

Screening tier `AI_LITE=1 AI_BEAM=8`, identical at every width. 30 iterations per pairing,
both orders (60 games), two seed bases. Deck population fixed; only body count varies.
ZOO = jormungandr_v1 + sleipnir_v1 + hraesvelgr_v1. CONTROL = kraken_v1 + huldra_v1 + draugr_v2.

## The curve — ZOO's win rate

| width | pairings/base | base A | base B | pooled |
|---|---|---|---|---|
| 1 | 9 | 35.6% | 38.3% | **36.9%** |
| 2 | 9 | 59.3% | 57.8% | **58.5%** |
| 3 | 1 | 90.0% | — | **90.0%** |

1v1 anchor from the existing 960-cell grid: 38.0% over all cells, 59.4% over neutral cells only.

## Mechanism fingerprint — status stacks landed per game

| quantity | w1 | w2 | w3 | w1→w3 |
|---|---|---|---|---|
| control debuff output, total | 19.82 | 27.41 | 25.40 | ×1.28 |
| ...per attacker | 19.82 | 13.71 | 8.47 | ×0.43 |
| zoo Strengthened, total | 4.57 | 10.15 | 20.08 | ×4.40 |
| Weakened per body | 9.36 | 6.25 | 3.46 | ×0.37 |
| Sharp per body | 5.01 | 3.22 | 1.80 | ×0.36 |
| Poison per body | 5.74 | 3.15 | 1.51 | ×0.26 |

Control's total answer output rises 28% while facing three times the attackers, so coverage per
attacker falls to 43%. Zoo's Strengthened mint more than triples. Answers divide; the plan
multiplies. Ticket 109's proposed mechanism, measured.

Hard gates across every pairing at every width: **FTK 0, truncated 0.**

---

## CORRECTION (2026-08-21) — composition-controlled mechanism numbers

The first cut of the table above averaged over all pairings at each width, and at width 1 only
2 of 9 pairings contain the minter (`sleipnir_v1`) or the wall (`huldra_v1`). That inflated the
Strengthened figure badly. Restricted to pairings where BOTH are present at every width:

| width | pairings | ZOO win | Strengthened/game | control debuff/game | debuff per attacker |
|---|---|---|---|---|---|
| 1 | 2 | 6.7% | 14.22 | 29.93 | 29.93 |
| 2 | 8 | 65.2% | 14.75 | 25.80 | 12.90 |
| 3 | 2 | 92.5% | 20.17 | 25.77 | 8.59 |

**Corrected reading.** Zoo's Strengthened mint grows ×1.42 across the three widths, NOT the
×4.40 first reported — that was a composition artifact. Control's TOTAL debuff output *falls*
slightly (29.93 → 25.77, ×0.86) while it faces three times the attackers, so coverage per
attacker collapses to ×0.29. **The inversion is almost entirely the answers side.** Zoo's plan
barely multiplies; control's answers are simply blind to how many targets there are.
