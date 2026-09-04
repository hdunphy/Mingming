# +1 energy to the nine underperforming decks — full grid

Decks 32/32. Iterations 30, seed base `grid`, beamless.
`was` is the promoted post-131 `docs/balance/deck_grid.json`.

| deck | field | was | delta | |
|---|---|---|---|---|
| `huldra_v1` | 85.2 | 91.8 | -6.7 | OUT |
| `kraken_v1` | 79.3 | 29.4 | +49.9 | **+1e** |
| `kraken_v2` | 74.5 | 29.1 | +45.4 | **+1e** |
| `jormungandr_v1` | 71.1 | 74.6 | -3.6 |  |
| `nidhoggr_v1` | 68.6 | 78.5 | -9.9 |  |
| `ratatoskr_v2` | 68.3 | 78.2 | -9.9 |  |
| `ratatoskr_v1` | 67.1 | 75.4 | -8.2 |  |
| `draugr_v1` | 66.0 | 29.3 | +36.6 | **+1e** |
| `fenrir_v1` | 63.0 | 26.8 | +36.1 | **+1e** |
| `sleipnir_v1` | 61.3 | 72.4 | -11.1 |  |
| `fenrir_v2` | 59.4 | 70.0 | -10.6 |  |
| `audhumbla_v1` | 56.0 | 67.0 | -10.9 |  |
| `hraesvelgr_v1` | 55.1 | 63.9 | -8.7 |  |
| `jormungandr_v2` | 54.2 | 33.0 | +21.2 | **+1e** |
| `huldra_v2` | 52.0 | 61.2 | -9.2 |  |
| `gullinbursti_v1` | 50.9 | 63.6 | -12.7 |  |
| `fafnir_v1` | 50.2 | 19.0 | +31.2 | **+1e** |
| `gullinbursti_v2` | 47.9 | 27.3 | +20.6 | **+1e** |
| `valkyrie_v1` | 43.9 | 62.0 | -18.1 |  |
| `draugr_v2` | 43.9 | 54.0 | -10.1 |  |
| `skoll_v2` | 42.5 | 51.9 | -9.3 |  |
| `hel_v2` | 38.8 | 31.7 | +7.1 | **+1e** |
| `ymir_v1` | 37.1 | 48.7 | -11.7 |  |
| `skoll_v1` | 33.6 | 40.7 | -7.1 | OUT |
| `hel_v1` | 33.6 | 49.3 | -15.7 | OUT |
| `audhumbla_v2` | 33.3 | 47.7 | -14.4 | OUT |
| `ymir_v2` | 31.8 | 42.1 | -10.4 | OUT |
| `fafnir_v2` | 30.7 | 17.8 | +12.9 | **+1e** OUT |
| `valkyrie_v2` | 28.5 | 46.8 | -18.3 | OUT |
| `sleipnir_v2` | 24.0 | 41.4 | -17.4 | OUT |
| `nidhoggr_v2` | 23.7 | 35.3 | -11.6 | OUT |
| `hraesvelgr_v2` | 19.0 | 37.8 | -18.8 | OUT |

**Before:** mean 49.9, sd 19.4, in band 22/32.
**After:**  mean 49.8, sd 17.3, in band 22/32.

**Of the nine buffed decks, 8 came into band:** `fenrir_v1` 63.0, `kraken_v1` 79.3, `kraken_v2` 74.5, `fafnir_v1` 50.2, `jormungandr_v2` 54.2, `gullinbursti_v2` 47.9, `draugr_v1` 66.0, `hel_v2` 38.8
**Unbuffed decks knocked OUT of band by the change:** `skoll_v1` 40.7 -> 33.6, `hraesvelgr_v2` 37.8 -> 19.0, `sleipnir_v2` 41.4 -> 24.0, `ymir_v2` 42.1 -> 31.8, `valkyrie_v2` 46.8 -> 28.5, `audhumbla_v2` 47.7 -> 33.3, `hel_v1` 49.3 -> 33.6, `nidhoggr_v2` 35.3 -> 23.7
