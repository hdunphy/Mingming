# 1v1 grid re-baseline (ticket 114) — post ticket-111

Decks: 5/32. Iterations 10, seed base `grid`, lanes 11.

The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.

| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |
|---|---|---|---|---|---|---|
| `gullinbursti_v2` **OUT OF BAND** | 89.3% | 47.6% | +41.7 | 26/30 | 0 | 16 |
| `ymir_v2` | 60.8% | 37.3% | +23.6 | 25/30 | 3 | 9 |
| `ymir_v1` | 59.8% | 37.5% | +22.3 | 23/30 | 2 | 8 |
| `gullinbursti_v1` | 63.8% | 45.3% | +18.5 | 18/30 | 6 | 12 |
| `fafnir_v2` | 57.3% | 39.4% | +17.9 | 22/30 | 1 | 7 |

**Roster mean:** 66.2% (was 41.4%). **Out of the 35-80 band:** 1. **Cells moving 5+:** 114 of 150.

This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.
