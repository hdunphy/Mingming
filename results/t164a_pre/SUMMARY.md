# 1v1 grid re-baseline (ticket 114) — post ticket-111

Decks: 5/32. Iterations 10, seed base `grid`, lanes 11.

The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.

| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |
|---|---|---|---|---|---|---|
| `skoll_v2` **OUT OF BAND** | 90.7% | 55.4% | +35.2 | 30/30 | 0 | 21 |
| `fenrir_v2` **OUT OF BAND** | 89.3% | 57.6% | +31.8 | 27/30 | 0 | 21 |
| `hraesvelgr_v2` | 63.0% | 37.1% | +25.9 | 27/30 | 1 | 7 |
| `fenrir_v1` | 77.5% | 51.8% | +25.7 | 27/30 | 1 | 11 |
| `hraesvelgr_v1` | 69.2% | 51.4% | +17.7 | 28/30 | 0 | 0 |

**Roster mean:** 77.9% (was 50.7%). **Out of the 35-80 band:** 2. **Cells moving 5+:** 139 of 150.

This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.
