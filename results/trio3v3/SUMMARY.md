# 3v3 round robin - six decks, each as a triple of itself

Beam 8 (GAME_BEAM_WIDTH), iter 2 (4 battles a cell), 15 unordered pairs.
Beamless 3v3 did not finish two paired iterations in ten minutes, so these are NOT
comparable cell-for-cell with the beamless 1v1 grid. Read ordering and spread.

| deck | 3v3 field | 1v1 field | avg cost |
|---|---|---|---|
| `sleipnir_v1` | 95.0 | 72.4 | 0.67 |
| `huldra_v1` | 75.0 | 91.8 | 0.67 |
| `ratatoskr_v1` | 65.0 | 75.3 | 0.73 |
| `ymir_v2` | 40.0 | 42.1 | 1.50 |
| `fafnir_v1` | 20.0 | 19.0 | 0.82 |
| `fafnir_v2` | 5.0 | 17.8 | 0.90 |

## cells

| a | b | a wins % | turns |
|---|---|---|---|
| `fafnir_v2` | `fafnir_v1` | 0.00 | 8.00 |
| `huldra_v1` | `fafnir_v1` | 100.00 | 10.25 |
| `huldra_v1` | `fafnir_v2` | 75.00 | 12.75 |
| `huldra_v1` | `sleipnir_v1` | 0.00 | 4.50 |
| `huldra_v1` | `ymir_v2` | 100.00 | 9.75 |
| `ratatoskr_v1` | `fafnir_v1` | 100.00 | 5.25 |
| `ratatoskr_v1` | `fafnir_v2` | 100.00 | 4.75 |
| `ratatoskr_v1` | `huldra_v1` | 0.00 | 9.00 |
| `ratatoskr_v1` | `sleipnir_v1` | 25.00 | 3.50 |
| `ratatoskr_v1` | `ymir_v2` | 100.00 | 7.00 |
| `sleipnir_v1` | `fafnir_v1` | 100.00 | 4.50 |
| `sleipnir_v1` | `fafnir_v2` | 100.00 | 3.75 |
| `sleipnir_v1` | `ymir_v2` | 100.00 | 4.50 |
| `ymir_v2` | `fafnir_v1` | 100.00 | 4.75 |
| `ymir_v2` | `fafnir_v2` | 100.00 | 4.50 |

**13 of 15 cells are absolute (0% or 100%).**
