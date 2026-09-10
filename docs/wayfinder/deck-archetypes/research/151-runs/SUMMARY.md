# 1v1 grid re-baseline (ticket 114) — post ticket-111

Decks: 12/32. Iterations 30, seed base `grid`, lanes 2.

The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.

| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |
|---|---|---|---|---|---|---|
| `ratatoskr_v1` | 63.6% | 54.1% | +9.5 | 19/30 | 0 | 3 |
| `huldra_v1` | 60.3% | 51.9% | +8.4 | 18/30 | 2 | 4 |
| `jormungandr_v2` | 55.6% | 50.0% | +5.6 | 20/30 | 0 | 3 |
| `ratatoskr_v2` | 53.3% | 52.7% | +0.6 | 3/30 | 1 | 3 |
| `jormungandr_v1` | 70.3% | 69.9% | +0.3 | 1/30 | 0 | 2 |
| `skoll_v2` | 55.6% | 55.6% | -0.1 | 2/30 | 2 | 1 |
| `skoll_v1` | 46.3% | 46.6% | -0.3 | 1/30 | 3 | 4 |
| `kraken_v1` | 49.1% | 49.5% | -0.4 | 2/30 | 0 | 0 |
| `kraken_v2` | 57.8% | 58.2% | -0.4 | 4/30 | 0 | 1 |
| `fenrir_v2` | 57.8% | 58.3% | -0.5 | 1/30 | 2 | 1 |
| `fenrir_v1` | 51.8% | 53.2% | -1.4 | 2/30 | 2 | 2 |
| `huldra_v2` | 37.1% | 52.5% | -15.4 | 22/30 | 5 | 0 |

**Roster mean:** 54.9% (was 54.4%). **Out of the 35-80 band:** 0. **Cells moving 5+:** 95 of 360.

This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.
