| card | owner deck | games | casts | casts/game | scaler read at cast (mean) | dmg raw / cast (HP) | % target maxHp / cast | 0-dmg casts | shipped score (band) | dmg ratio vs fire_punch_v2 | score ratio vs fire_punch_v2 | divergence (dmg/score ratio) | dmg ratio vs baseline_strike |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| carrion_swoop | hraesvelgr_v1 | 1200 | 1951 | 1.63 | 5.03 CARDS_DISCARDED (NO scorer branch: priced at printed 11) | 201.5 (applied 192.7) | 16.57% | 14% | 1.1 (3) | 2.20 | 0.37 | 6.00 | 2.85 |
| stampede | sleipnir_v1 | 600 | 1582 | 2.64 | 4.31 CARDS_PLAYED (const 2.5) | 234.3 (applied 220.4) | 19.17% | 3% | 2.8 (3) | 2.54 | 0.93 | 2.73 | 3.30 |
| momentum_crash | sleipnir_v1 | 600 | 322 | 0.54 | 8.63 STATUS_CONSUMED Strengthened (const 8) | 205.9 (applied 180.7) | 16.80% | 7% | 2.8 (3) | 2.23 | 0.93 | 2.39 | 2.89 |
| starfall | valkyrie_v2 | 1200 | 2024 | 1.69 | 3.00 CARDS_DRAWN_TRIGGERED (const 1.25) | 148.4 (applied 141.2) | 12.27% | 3% | 2.3 (3) | 1.63 | 0.77 | 2.12 | 2.11 |
| stampede | sleipnir_v2 | 600 | 909 | 1.51 | 4.34 CARDS_PLAYED (const 2.5) | 152.9 (applied 143.9) | 12.59% | 4% | 2.8 (3) | 1.67 | 0.93 | 1.79 | 2.17 |
| serpents_coil | jormungandr_v1 | 1200 | 1951 | 1.63 | 4.06 CARDS_PLAYED (const 2.5) | 115.5 (applied 107.8) | 9.54% | 4% | 2.5 (3) | 1.27 | 0.83 | 1.52 | 1.64 |
| baseline_strike | control_v1 | 640 | 1418 | 2.22 | 1.00 - | 70.9 (applied 65.8) | 5.82% | 0% | 3 (3) | 0.77 | 1.00 | 0.77 | 1.00 |
| carrion_swoop | sleipnir_v2 | 600 | 601 | 1.00 | 1.01 CARDS_DISCARDED (NO scorer branch: priced at printed 11) | 34.1 (applied 32.8) | 2.78% | 28% | 1.1 (3) | 0.37 | 0.37 | 1.01 | 0.48 |
| fire_punch_v2 | fenrir_v2 | 580 | 330 | 0.57 | 1.00 - | 88.5 (applied 80.0) | 7.54% | 0% | 3 (3) | 1.00 | 1.00 | 1.00 | 1.30 |

Method: damage is the action's damageLedger raw sum (all hits of the cast, before shields and the 0 floor); the 30-power benchmark is fire_punch_v2 swapped in-memory for water_slap in fenrir_v2 (Fire STAB, CINDER_WALL Sharp) and baseline_strike on the control frame (no STAB, no firmware). Divergence = (measured damage ratio) / (scorer score ratio); 1.00 = the scorer prices the card exactly as it delivers relative to the benchmark.
