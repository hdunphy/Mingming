# 1v1 grid re-baseline (ticket 114) — post ticket-111

Decks: 32/32. Iterations 30, seed base `grid`, lanes 2.

The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.

| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |
|---|---|---|---|---|---|---|
| `kraken_v2` | 64.9% | 29.1% | +35.8 | 29/30 | 0 | 3 |
| `fafnir_v1` | 54.1% | 19.0% | +35.1 | 24/30 | 0 | 6 |
| `jormungandr_v2` | 62.1% | 33.0% | +29.1 | 25/30 | 0 | 5 |
| `kraken_v1` | 53.6% | 29.4% | +24.2 | 26/30 | 1 | 3 |
| `draugr_v1` | 52.5% | 29.3% | +23.2 | 27/30 | 0 | 2 |
| `fafnir_v2` **OUT OF BAND** | 34.4% | 17.8% | +16.6 | 19/30 | 3 | 4 |
| `gullinbursti_v2` | 40.4% | 27.3% | +13.0 | 19/30 | 8 | 2 |
| `draugr_v2` | 65.0% | 54.0% | +11.1 | 20/30 | 0 | 2 |
| `jormungandr_v1` | 75.0% | 74.6% | +0.4 | 7/30 | 0 | 4 |
| `audhumbla_v1` | 66.4% | 67.0% | -0.6 | 12/30 | 0 | 0 |
| `huldra_v2` | 60.0% | 61.2% | -1.2 | 8/30 | 1 | 5 |
| `nidhoggr_v1` | 76.8% | 78.5% | -1.7 | 11/30 | 0 | 3 |
| `ymir_v1` | 47.0% | 48.7% | -1.7 | 11/30 | 0 | 3 |
| `fenrir_v1` **OUT OF BAND** | 24.7% | 26.8% | -2.2 | 8/30 | 6 | 0 |
| `skoll_v2` | 49.6% | 51.9% | -2.3 | 10/30 | 2 | 0 |
| `hraesvelgr_v1` | 61.0% | 63.9% | -2.9 | 12/30 | 1 | 0 |
| `ymir_v2` | 38.1% | 42.1% | -4.1 | 8/30 | 2 | 0 |
| `fenrir_v2` | 65.9% | 70.0% | -4.1 | 12/30 | 1 | 4 |
| `skoll_v1` | 36.5% | 40.7% | -4.2 | 7/30 | 7 | 2 |
| `nidhoggr_v2` **OUT OF BAND** | 28.6% | 35.3% | -6.7 | 8/30 | 8 | 0 |
| `hel_v2` **OUT OF BAND** | 24.5% | 31.7% | -7.3 | 11/30 | 2 | 0 |
| `gullinbursti_v1` | 54.6% | 63.6% | -8.9 | 8/30 | 4 | 7 |
| `valkyrie_v1` | 52.9% | 62.0% | -9.1 | 11/30 | 2 | 3 |
| `hel_v1` | 38.5% | 49.3% | -10.7 | 10/30 | 4 | 0 |
| `valkyrie_v2` | 36.1% | 46.8% | -10.8 | 11/30 | 4 | 0 |
| `sleipnir_v2` **OUT OF BAND** | 30.6% | 41.4% | -10.8 | 9/30 | 4 | 0 |
| `audhumbla_v2` | 36.6% | 47.7% | -11.1 | 16/30 | 3 | 0 |
| `hraesvelgr_v2` **OUT OF BAND** | 26.1% | 37.8% | -11.7 | 10/30 | 2 | 0 |
| `sleipnir_v1` | 58.1% | 72.4% | -14.3 | 24/30 | 1 | 1 |
| `ratatoskr_v1` | 60.2% | 75.4% | -15.2 | 22/30 | 4 | 4 |
| `huldra_v1` | 68.7% | 91.8% | -23.1 | 16/30 | 4 | 8 |
| `ratatoskr_v2` | 53.7% | 78.2% | -24.5 | 26/30 | 1 | 3 |

**Roster mean:** 49.9% (was 49.9%). **Out of the 35-80 band:** 6. **Cells moving 5+:** 477 of 960.

This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.
