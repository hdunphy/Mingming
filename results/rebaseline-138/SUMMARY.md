# 1v1 grid re-baseline (ticket 114) — post ticket-111

Decks: 32/32. Iterations 30, seed base `grid`, lanes 2.

The `was` column is `docs/balance/deck_grid.json`, i.e. PRE-fix. A cell counts as moved at 5+ points.

| deck | field | was | delta | cells moved 5+ | zero cells | 100% cells |
|---|---|---|---|---|---|---|
| `jormungandr_v2` | 62.7% | 62.1% | +0.6 | 1/30 | 0 | 5 |
| `draugr_v1` | 52.9% | 52.5% | +0.4 | 1/30 | 0 | 2 |
| `audhumbla_v1` | 66.7% | 66.4% | +0.3 | 1/30 | 0 | 0 |
| `sleipnir_v2` **OUT OF BAND** | 30.9% | 30.6% | +0.3 | 1/30 | 4 | 0 |
| `nidhoggr_v1` | 77.1% | 76.8% | +0.3 | 1/30 | 0 | 3 |
| `audhumbla_v2` | 36.9% | 36.6% | +0.3 | 1/30 | 3 | 0 |
| `fenrir_v2` | 66.2% | 65.9% | +0.3 | 1/30 | 1 | 4 |
| `ymir_v2` | 38.4% | 38.1% | +0.3 | 1/30 | 2 | 0 |
| `valkyrie_v2` | 36.3% | 36.1% | +0.3 | 1/30 | 4 | 0 |
| `fenrir_v1` **OUT OF BAND** | 24.9% | 24.7% | +0.2 | 1/30 | 6 | 0 |
| `sleipnir_v1` | 58.4% | 58.1% | +0.2 | 1/30 | 1 | 1 |
| `huldra_v1` | 68.9% | 68.7% | +0.2 | 1/30 | 4 | 9 |
| `hraesvelgr_v2` **OUT OF BAND** | 26.2% | 26.1% | +0.2 | 1/30 | 2 | 0 |
| `hel_v1` | 38.7% | 38.5% | +0.2 | 1/30 | 4 | 0 |
| `ymir_v1` | 47.1% | 47.0% | +0.1 | 0/30 | 0 | 3 |
| `ratatoskr_v1` | 60.3% | 60.2% | +0.1 | 0/30 | 4 | 4 |
| `draugr_v2` | 65.1% | 65.0% | +0.1 | 0/30 | 0 | 2 |
| `nidhoggr_v2` **OUT OF BAND** | 28.7% | 28.6% | +0.1 | 0/30 | 8 | 0 |
| `gullinbursti_v1` | 54.6% | 54.6% | +0.0 | 0/30 | 4 | 7 |
| `kraken_v1` | 53.6% | 53.6% | +0.0 | 0/30 | 1 | 3 |
| `fafnir_v1` | 54.1% | 54.1% | +0.0 | 0/30 | 0 | 6 |
| `fafnir_v2` **OUT OF BAND** | 34.4% | 34.4% | +0.0 | 0/30 | 3 | 4 |
| `skoll_v1` | 36.5% | 36.5% | +0.0 | 0/30 | 7 | 2 |
| `jormungandr_v1` | 75.0% | 75.0% | +0.0 | 0/30 | 0 | 4 |
| `huldra_v2` | 59.9% | 60.0% | -0.0 | 0/30 | 1 | 5 |
| `ratatoskr_v2` | 53.7% | 53.7% | -0.1 | 0/30 | 1 | 3 |
| `kraken_v2` | 64.8% | 64.9% | -0.1 | 0/30 | 0 | 3 |
| `gullinbursti_v2` | 40.3% | 40.4% | -0.1 | 0/30 | 8 | 2 |
| `hraesvelgr_v1` | 60.9% | 61.0% | -0.1 | 0/30 | 1 | 0 |
| `valkyrie_v1` | 52.7% | 52.9% | -0.2 | 0/30 | 2 | 3 |
| `hel_v2` **OUT OF BAND** | 24.2% | 24.5% | -0.2 | 1/30 | 2 | 0 |
| `skoll_v2` | 43.7% | 49.6% | -5.9 | 14/30 | 3 | 0 |

**Roster mean:** 49.8% (was 49.9%). **Out of the 35-80 band:** 6. **Cells moving 5+:** 29 of 960.

This file does NOT replace `docs/balance/deck_grid.json`. Compare, then decide whether to promote it.
