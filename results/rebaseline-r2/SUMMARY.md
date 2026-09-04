# 1v1 grid re-baseline (ticket 114) — post ticket-111

Decks: 32/32. Iterations 30, seed base `grid`, lanes 2.

The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.

| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |
|---|---|---|---|---|---|---|
| `sleipnir_v2` | 65.0% | 30.6% | +34.4 | 27/30 | 2 | 1 |
| `fenrir_v1` | 58.2% | 24.7% | +33.5 | 24/30 | 1 | 4 |
| `hel_v2` | 54.7% | 24.5% | +30.3 | 26/30 | 0 | 1 |
| `hraesvelgr_v2` | 46.4% | 26.1% | +20.3 | 27/30 | 0 | 1 |
| `fafnir_v2` | 46.4% | 34.4% | +12.0 | 20/30 | 2 | 4 |
| `nidhoggr_v2` | 39.9% | 28.6% | +11.2 | 25/30 | 3 | 1 |
| `skoll_v2` | 55.5% | 49.6% | +5.9 | 23/30 | 4 | 1 |
| `huldra_v2` | 57.8% | 60.0% | -2.2 | 5/30 | 4 | 2 |
| `jormungandr_v1` | 72.8% | 75.0% | -2.2 | 4/30 | 0 | 4 |
| `ymir_v1` | 44.2% | 47.0% | -2.8 | 3/30 | 1 | 2 |
| `ymir_v2` **OUT OF BAND** | 34.9% | 38.1% | -3.2 | 5/30 | 3 | 0 |
| `fafnir_v1` | 50.6% | 54.1% | -3.5 | 4/30 | 0 | 3 |
| `sleipnir_v1` | 54.3% | 58.1% | -3.8 | 5/30 | 1 | 0 |
| `hraesvelgr_v1` | 57.0% | 61.0% | -4.0 | 6/30 | 1 | 0 |
| `draugr_v1` | 48.3% | 52.5% | -4.2 | 6/30 | 1 | 0 |
| `kraken_v1` | 49.1% | 53.6% | -4.4 | 6/30 | 1 | 2 |
| `fenrir_v2` | 61.4% | 65.9% | -4.5 | 5/30 | 2 | 4 |
| `draugr_v2` | 60.4% | 65.0% | -4.7 | 6/30 | 0 | 2 |
| `kraken_v2` | 60.1% | 64.9% | -4.7 | 7/30 | 0 | 2 |
| `nidhoggr_v1` | 71.4% | 76.8% | -5.4 | 6/30 | 0 | 3 |
| `ratatoskr_v1` | 54.6% | 60.2% | -5.6 | 6/30 | 4 | 3 |
| `gullinbursti_v2` **OUT OF BAND** | 34.1% | 40.4% | -6.3 | 6/30 | 8 | 2 |
| `hel_v1` **OUT OF BAND** | 31.6% | 38.5% | -7.0 | 6/30 | 4 | 0 |
| `skoll_v1` **OUT OF BAND** | 29.5% | 36.5% | -7.0 | 5/30 | 8 | 2 |
| `gullinbursti_v1` | 47.5% | 54.6% | -7.1 | 5/30 | 4 | 7 |
| `audhumbla_v1` | 59.1% | 66.4% | -7.3 | 7/30 | 0 | 0 |
| `audhumbla_v2` **OUT OF BAND** | 28.5% | 36.6% | -8.1 | 7/30 | 3 | 0 |
| `ratatoskr_v2` | 44.9% | 53.7% | -8.8 | 7/30 | 2 | 2 |
| `jormungandr_v2` | 53.1% | 62.1% | -9.0 | 6/30 | 1 | 4 |
| `valkyrie_v1` | 43.5% | 52.9% | -9.4 | 7/30 | 2 | 3 |
| `huldra_v1` | 58.6% | 68.7% | -10.1 | 6/30 | 4 | 7 |
| `valkyrie_v2` **OUT OF BAND** | 23.7% | 36.1% | -12.4 | 7/30 | 4 | 0 |

**Roster mean:** 49.9% (was 49.9%). **Out of the 35-80 band:** 6. **Cells moving 5+:** 315 of 960.

This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.
