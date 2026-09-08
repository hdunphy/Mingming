## Scorer: Side vs Single

| card | cost | ceiling | score Side | score Single | scorer ratio | Side vs ceiling | Single vs ceiling |
|---|---|---|---|---|---|---|---|
| frost_bite | 1e | 3 | 7.3 | 3.3 | 2.21 | 143% | 10% |
| numbing_gale | 1e | 3 | 6.6 | 3.0 | 2.20 | 120% | 0% |
| killing_frost | 1e | 3 | 6.6 | 3.0 | 2.20 | 120% | 0% |
| rimefrost | 0e | 1 | 1.9 | 0.9 | 2.11 | 90% | -10% |
| ice_spear | 1e | 3 | 5.6 | 2.6 | 2.15 | 87% | -13% |
| ink_cloud | 2e | 6.5 | 6.2 | 2.8 | 2.21 | -5% | -57% |
| spreading_rot | 1e | 3 | 2.0 | 0.9 | 2.22 | -33% | -70% |
| tidal_battery | 2e | 6.5 | 7.7 | 3.5 | 2.20 | 18% | -46% |

## 1v1 (draugr_v2 vs 30-opponent field)

| arm | cells | games | decisive | field win (mean of cells) | pooled win | ±95% | turns |
|---|---|---|---|---|---|---|---|
| SHIPPED | 30 | 1200 | 1200 | 54.8% | 54.8% | ±2.8% | 7.03 |
| SINGLE_ALL | 30 | 1200 | 1200 | 51.5% | 51.5% | ±2.8% | 6.91 |
| SINGLE:frost_bite | 30 | 1200 | 1200 | 54.6% | 54.6% | ±2.8% | 7.03 |
| SINGLE:numbing_gale | 30 | 1200 | 1200 | 54.3% | 54.3% | ±2.8% | 7.02 |
| SINGLE:killing_frost | 30 | 1200 | 1200 | 54.4% | 54.4% | ±2.8% | 7.03 |
| SINGLE:rimefrost | 30 | 1200 | 1200 | 53.2% | 53.2% | ±2.8% | 6.95 |
| SINGLE:ice_spear | 30 | 1200 | 1200 | 54.9% | 54.9% | ±2.8% | 7.03 |

| card | arm | casts | dmg/cast | stacks/cast | cast rate (played/handEntries) |
|---|---|---|---|---|---|
| frost_bite | SHIPPED | 2418 | 58.7 | 1.91 | 96.2% |
| frost_bite | SINGLE_ALL | 2386 | 57.5 | 1.92 | 96.2% |
| frost_bite | SINGLE:frost_bite | 2418 | 58.6 | 1.91 | 96.2% |
| frost_bite | SINGLE:numbing_gale | 2417 | 58.5 | 1.91 | 96.2% |
| frost_bite | SINGLE:killing_frost | 2419 | 58.4 | 1.91 | 96.2% |
| frost_bite | SINGLE:rimefrost | 2404 | 58.7 | 1.91 | 96.3% |
| frost_bite | SINGLE:ice_spear | 2411 | 58.2 | 1.92 | 96.2% |
| numbing_gale | SHIPPED | 2091 | 61.4 | 1.75 | 82.3% |
| numbing_gale | SINGLE_ALL | 2069 | 61.3 | 1.75 | 82.9% |
| numbing_gale | SINGLE:frost_bite | 2092 | 61.3 | 1.75 | 82.3% |
| numbing_gale | SINGLE:numbing_gale | 2083 | 61.7 | 1.75 | 82.2% |
| numbing_gale | SINGLE:killing_frost | 2087 | 61.2 | 1.75 | 82.2% |
| numbing_gale | SINGLE:rimefrost | 2077 | 61.5 | 1.76 | 82.8% |
| numbing_gale | SINGLE:ice_spear | 2091 | 61.1 | 1.75 | 82.4% |
| killing_frost | SHIPPED | 1999 | 41.6 | 3.44 | 80.0% |
| killing_frost | SINGLE_ALL | 1948 | 41.5 | 3.44 | 80.0% |
| killing_frost | SINGLE:frost_bite | 1995 | 41.5 | 3.44 | 80.1% |
| killing_frost | SINGLE:numbing_gale | 1995 | 41.5 | 3.44 | 80.1% |
| killing_frost | SINGLE:killing_frost | 1991 | 41.6 | 3.45 | 79.9% |
| killing_frost | SINGLE:rimefrost | 1971 | 41.7 | 3.44 | 80.2% |
| killing_frost | SINGLE:ice_spear | 1997 | 41.5 | 3.44 | 80.1% |
| rimefrost | SHIPPED | 4607 | 0.0 | 1.72 | 92.7% |
| rimefrost | SINGLE_ALL | 4539 | 0.0 | 1.71 | 92.8% |
| rimefrost | SINGLE:frost_bite | 4603 | 0.0 | 1.72 | 92.7% |
| rimefrost | SINGLE:numbing_gale | 4596 | 0.0 | 1.72 | 92.8% |
| rimefrost | SINGLE:killing_frost | 4608 | 0.0 | 1.72 | 92.7% |
| rimefrost | SINGLE:rimefrost | 4559 | 0.0 | 1.71 | 92.7% |
| rimefrost | SINGLE:ice_spear | 4597 | 0.0 | 1.72 | 92.6% |
| ice_spear | SHIPPED | 1840 | 71.5 | 0.85 | 72.9% |
| ice_spear | SINGLE_ALL | 1794 | 71.4 | 0.84 | 73.0% |
| ice_spear | SINGLE:frost_bite | 1832 | 71.3 | 0.85 | 72.6% |
| ice_spear | SINGLE:numbing_gale | 1833 | 71.4 | 0.85 | 72.9% |
| ice_spear | SINGLE:killing_frost | 1834 | 71.4 | 0.85 | 72.8% |
| ice_spear | SINGLE:rimefrost | 1827 | 71.7 | 0.85 | 73.6% |
| ice_spear | SINGLE:ice_spear | 1829 | 71.5 | 0.85 | 72.6% |

| card | field Side (SHIPPED) | field Single (SINGLE:card) | Δ pts | ratio Side/Single | field Single (SINGLE_ALL) | dmg/cast Side | dmg/cast Single | dmg ratio | stacks/cast Side | stacks/cast Single | stacks ratio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| frost_bite | 54.8% | 54.6% | 0.2 | 1.00 | 51.5% | 58.7 | 58.6 | 1.00 | 1.91 | 1.91 | 1.00 |
| numbing_gale | 54.8% | 54.3% | 0.6 | 1.01 | 51.5% | 61.4 | 61.7 | 0.99 | 1.75 | 1.75 | 1.00 |
| killing_frost | 54.8% | 54.4% | 0.4 | 1.01 | 51.5% | 41.6 | 41.6 | 1.00 | 3.44 | 3.45 | 1.00 |
| rimefrost | 54.8% | 53.2% | 1.7 | 1.03 | 51.5% | 0.0 | 0.0 | n/a | 1.72 | 1.71 | 1.00 |
| ice_spear | 54.8% | 54.9% | -0.1 | 1.00 | 51.5% | 71.5 | 71.5 | 1.00 | 0.85 | 0.85 | 1.00 |

## 1v1 (ymir_v1 vs field, ice_spear only)

| arm | cells | games | decisive | field win (mean of cells) | pooled win | ±95% | turns |
|---|---|---|---|---|---|---|---|
| SHIPPED | 30 | 1200 | 1200 | 41.0% | 41.0% | ±2.8% | 9.06 |
| SINGLE:ice_spear | 30 | 1200 | 1200 | 41.0% | 41.0% | ±2.8% | 9.07 |

| card | arm | casts | dmg/cast | stacks/cast | cast rate (played/handEntries) |
|---|---|---|---|---|---|
| frost_bite | SHIPPED | 0 | n/a | n/a | n/a |
| frost_bite | SINGLE:ice_spear | 0 | n/a | n/a | n/a |
| numbing_gale | SHIPPED | 0 | n/a | n/a | n/a |
| numbing_gale | SINGLE:ice_spear | 0 | n/a | n/a | n/a |
| killing_frost | SHIPPED | 0 | n/a | n/a | n/a |
| killing_frost | SINGLE:ice_spear | 0 | n/a | n/a | n/a |
| rimefrost | SHIPPED | 0 | n/a | n/a | n/a |
| rimefrost | SINGLE:ice_spear | 0 | n/a | n/a | n/a |
| ice_spear | SHIPPED | 2312 | 70.0 | 0.65 | 27.1% |
| ice_spear | SINGLE:ice_spear | 2311 | 70.0 | 0.65 | 27.1% |

| card | field Side (SHIPPED) | field Single (SINGLE:card) | Δ pts | ratio Side/Single | field Single (SINGLE_ALL) | dmg/cast Side | dmg/cast Single | dmg ratio | stacks/cast Side | stacks/cast Single | stacks ratio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ice_spear | 41.0% | 41.0% | 0.0 | 1.00 | n/a | 70.0 | 70.0 | 1.00 | 0.65 | 0.65 | 1.00 |

## 3v3 (control_d = huldra_v2+draugr_v2+jormungandr_v2 vs panel)

| arm | cells | games | decisive | field win (mean of cells) | pooled win | ±95% | turns |
|---|---|---|---|---|---|---|---|
| SINGLE_ALL | 5 | 50 | 50 | 42.0% | 42.0% | ±13.7% | 7.10 |
| SHIPPED | 5 | 50 | 50 | 70.0% | 70.0% | ±12.7% | 6.18 |

| card | arm | casts | dmg/cast | stacks/cast | cast rate (played/handEntries) |
|---|---|---|---|---|---|
| frost_bite | SINGLE_ALL | 74 | 74.1 | 2.38 | 86.0% |
| frost_bite | SHIPPED | 83 | 109.3 | 5.81 | 100.0% |
| numbing_gale | SINGLE_ALL | 55 | 61.5 | 1.96 | 71.4% |
| numbing_gale | SHIPPED | 72 | 116.6 | 5.53 | 91.1% |
| killing_frost | SINGLE_ALL | 64 | 47.3 | 3.67 | 71.1% |
| killing_frost | SHIPPED | 74 | 83.3 | 9.46 | 91.4% |
| rimefrost | SINGLE_ALL | 171 | 0.0 | 1.96 | 98.8% |
| rimefrost | SHIPPED | 153 | 0.0 | 5.12 | 96.2% |
| ice_spear | SINGLE_ALL | 41 | 77.5 | 1.10 | 47.1% |
| ice_spear | SHIPPED | 62 | 138.7 | 2.76 | 83.8% |

| card | field Side (SHIPPED) | field Single (SINGLE:card) | Δ pts | ratio Side/Single | field Single (SINGLE_ALL) | dmg/cast Side | dmg/cast Single | dmg ratio | stacks/cast Side | stacks/cast Single | stacks ratio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| frost_bite | 70.0% | 42.0% (from SINGLE_ALL) | 28.0 | 1.67 | 42.0% | 109.3 | 74.1 | 1.47 | 5.81 | 2.38 | 2.44 |
| numbing_gale | 70.0% | 42.0% (from SINGLE_ALL) | 28.0 | 1.67 | 42.0% | 116.6 | 61.5 | 1.90 | 5.53 | 1.96 | 2.82 |
| killing_frost | 70.0% | 42.0% (from SINGLE_ALL) | 28.0 | 1.67 | 42.0% | 83.3 | 47.3 | 1.76 | 9.46 | 3.67 | 2.58 |
| rimefrost | 70.0% | 42.0% (from SINGLE_ALL) | 28.0 | 1.67 | 42.0% | 0.0 | 0.0 | n/a | 5.12 | 1.96 | 2.61 |
| ice_spear | 70.0% | 42.0% (from SINGLE_ALL) | 28.0 | 1.67 | 42.0% | 138.7 | 77.5 | 1.79 | 2.76 | 1.10 | 2.51 |

## 3v3 per-card arms — ink_loop cell only (control_d vs kraken_v1+jormungandr_v1+huldra_v2)

| arm | games | win | ±95% | turns | flipped card casts | dmg/cast | stacks/cast |
|---|---|---|---|---|---|---|---|
| SINGLE_ALL | 10 | 60.0% | ±30.4% | 8.5 | - | - | - |
| SHIPPED | 10 | 100.0% | ±0.0% | 6.8 | - | - | - |
| SINGLE:frost_bite | 10 | 100.0% | ±0.0% | 7.3 | 17 | 63.4 | 2.00 |
| SINGLE:numbing_gale | 10 | 90.0% | ±18.6% | 6.7 | 9 | 70.8 | 2.00 |
| SINGLE:killing_frost | 10 | 90.0% | ±18.6% | 6.9 | 13 | 46.9 | 4.00 |
| SINGLE:rimefrost | 10 | 100.0% | ±0.0% | 7.0 | 35 | 0.0 | 1.94 |
| SINGLE:ice_spear | 10 | 90.0% | ±18.6% | 7.2 | 10 | 83.6 | 0.90 |

## Implied multiplier per card

| card | scorer split ATTACK:STATUS (Single) | 3v3 dmg ratio | 3v3 stacks ratio | implied m (3v3, effect-weighted) | 3v3 field win ratio (all five flipped) | 1v1 field ratio | 3v3 Side casts / 1v1 Side casts (effect per cast: dmg, stacks) |
|---|---|---|---|---|---|---|---|
| frost_bite | 1.5:1.8 | 1.47 | 2.44 | 2.00 | 1.67 | 1.00 | 1.86, 3.04 |
| numbing_gale | 2.0:1.0 | 1.90 | 2.82 | 2.20 | 1.67 | 1.01 | 1.90, 3.15 |
| killing_frost | 1.3:1.7 | 1.76 | 2.58 | 2.22 | 1.67 | 1.01 | 2.00, 2.75 |
| rimefrost | 0.0:0.9 | n/a | 2.61 | 2.61 | 1.67 | 1.03 | n/a, 2.98 |
| ice_spear | 2.2:0.4 | 1.79 | 2.51 | 1.90 | 1.67 | 1.00 | 1.94, 3.26 |
