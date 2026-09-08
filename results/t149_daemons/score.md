## 1. Daemon inventory (programs.json, category Daemon)

| id | cost | ceiling | score | per-proc | hook id | trigger | when | shipped decks | shape |
|---|---|---|---|---|---|---|---|---|---|
| harden_daemon | 1e | 3 | 1.6 | 0.30 | defensive_daemon_hook | onTurnStart | {"source":"SELF"} | — | hook `do` |
| core_overclock_daemon | 2e | 6.5 | 0.0 | 0.00 | daemon_double_strength | onDamageCalculated | {"source":"SELF"} | — | modifier (no `do`) - scores 0 |
| cinder_armor_daemon | 2e | 6.5 | 1.6 | 0.30 | daemon_burn_sharp_synergy | onStatusApplied | {"source":"SELF","statusApplied":"Burn"} | — | hook `do` |
| battery_pack | 4e | 10.5 | 4.9 | 0.00 | — (no hooks) | — | own actions: ENERGY |
| feedback_loop_daemon | 1e | 3 | 3.2 | 0.59 | daemon_draw_damage_proc | onCardDraw | {"source":"SELF","isNaturalDraw":false} | — | hook `do` |
| echo_chamber_v2 | 2e | 6.5 | 4.9 | 0.91 | echo_chamber_daemon_hook | onActionStart | {"source":"SELF","baseCost":0,"isToken":false} | ratatoskr_v1, ratatoskr_v2 | hook `do` |
| fertile_ground_daemon | 2e | 6.5 | 7.6 | 1.41 | daemon_extra_draw | onTurnStart | {"source":"SELF"} | — | hook `do` |
| hoofbeat_daemon | 2e | 6.5 | 3.8 | 0.70 | hoofbeat_daemon_hook | onActionStart | {"source":"SELF","baseCost":0,"isToken":false} | sleipnir_v1 | hook `do` |
| einherjar_standard | 2e | 6.5 | 0.0 | 0.00 | einherjar_standard_hook | onDamageCalculated | {"source":"SELF","actionType":"ATTACK","programElement":"Light"} | — | modifier (no `do`) - scores 0 |
| riptide | 2e | 6.5 | 3.8 | 0.70 | riptide_undertow | onActionEnd | {"source":"OPPONENT"} | — | hook `do` |
| short_circuit | 2e | 6.5 | 7.6 | 1.41 | short_circuit_discharge | onCardDraw | {"source":"OPPONENT","isNaturalDraw":false} | — | hook `do` |
| reactive_plating | 2e | 6.5 | 1.6 | 0.30 | reactive_plating_proc | onPostDamage | {"source":"OPPONENT","target":"ALLY","counter":{"key":"reactive_plating_grants","operator":"LT","value":3,"scope":"SIDE"}}<br>reactive_plating_reset | onTurnStart | {"source":"SELF"} | — | hook `do` |
| scrubber | 2e | 6.5 | -1.6 | 0.00 | scrubber_purge | onTurnEnd | {"source":"SELF"} | — | hook `do` |
| drip_feed | 2e | 6.5 | 5.9 | 1.09 | drip_feed_tick | onTurnEnd | {"source":"SELF"} | — | hook `do` |

Score = perProc x 4 (EXPECTED_DAEMON_PROCS) x 1.5 (Daemon premium) x 0.9 (exhaust); ceiling = BUDGET_BANDS[cost].over.

## 3. Play-turn pricing: perProc x rate x (gameLen - castTurn) x 1.5 x 0.9

| daemon | width | rate/turn-alive (n unit-turns) | game len | per-proc | t1 | t2 | t3 | ceiling | band (0.8-1.0x) at t3? | shipped |
|---|---|---|---|---|---|---|---|---|---|---|
| harden_daemon | 1v1 | 0.785 (22780) | 4.95 | 0.30 | 1.24 | 0.93 | 0.61 | 3 | under (0.20x) | 1.6 (field) |
| harden_daemon | 3v3 | 0.710 (575) | 5.00 | 0.30 | 1.14 | 0.85 | 0.57 | 3 | under (0.19x) | 1.6 (pool) |
| core_overclock_daemon | 1v1 | 0.797 (22780) | 4.95 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 0.0 (field) |
| core_overclock_daemon | 3v3 | 0.863 (575) | 5.00 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 0.0 (pool) |
| core_overclock_daemon | 1v1 | 1.963 (3786) | 3.53 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 0.0 (fenrir_v1 units) |
| core_overclock_daemon | 3v3 | 1.744 (39) | 4.54 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 0.0 (fenrir_v1 units) |
| cinder_armor_daemon | 1v1 | 0.135 (22780) | 4.95 | 0.30 | 0.21 | 0.16 | 0.11 | 6.5 | under (0.02x) | 1.6 (field) |
| cinder_armor_daemon | 3v3 | 0.000 (575) | 5.00 | 0.30 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 1.6 (pool) |
| cinder_armor_daemon | 1v1 | 0.000 (3786) | 3.53 | 0.30 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 1.6 (fenrir_v1 units) |
| cinder_armor_daemon | 3v3 | 0.000 (39) | 4.54 | 0.30 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 1.6 (fenrir_v1 units) |
| feedback_loop_daemon | 1v1 | 0.325 (22780) | 4.95 | 0.59 | 1.03 | 0.77 | 0.51 | 3 | under (0.17x) | 3.2 (field) |
| feedback_loop_daemon | 3v3 | 0.351 (575) | 5.00 | 0.59 | 1.12 | 0.84 | 0.56 | 3 | under (0.19x) | 3.2 (pool) |
| feedback_loop_daemon | 1v1 | 1.417 (4669) | 4.37 | 0.59 | 3.82 | 2.69 | 1.55 | 3 | under (0.52x) | 3.2 (kraken_v1 units) |
| feedback_loop_daemon | 3v3 | 1.064 (110) | 5.25 | 0.59 | 3.62 | 2.77 | 1.91 | 3 | under (0.64x) | 3.2 (kraken_v1 units) |
| echo_chamber_v2 | 1v1 | 1.015 (22780) | 4.95 | 0.91 | 4.92 | 3.67 | 2.43 | 6.5 | under (0.37x) | 4.9 (field) |
| echo_chamber_v2 | 3v3 | 1.117 (575) | 5.00 | 0.91 | 5.47 | 4.10 | 2.74 | 6.5 | under (0.42x) | 4.9 (pool) |
| echo_chamber_v2 | 1v1 | 3.341 (7175) | 6.98 | 0.91 | 24.46 | 20.37 | 16.28 | 6.5 | over (2.50x) | 4.9 (ratatoskr_v1 units) |
| echo_chamber_v2 | 3v3 | 1.930 (43) | 5.14 | 0.91 | 9.80 | 7.43 | 5.07 | 6.5 | under (0.78x) | 4.9 (ratatoskr_v1 units) |
| echo_chamber_v2 | 1v1 | 1.998 (4593) | 4.46 | 0.91 | 8.47 | 6.02 | 3.57 | 6.5 | under (0.55x) | 4.9 (ratatoskr_v2 units) |
| echo_chamber_v2 | 3v3 | 0.158 (57) | 5.00 | 0.91 | 0.77 | 0.58 | 0.39 | 6.5 | under (0.06x) | 4.9 (ratatoskr_v2 units) |
| echo_chamber_v2 | 1v1 | 2.278 (4924) | 4.62 | 0.91 | 10.11 | 7.31 | 4.52 | 6.5 | under (0.70x) | 4.9 (sleipnir_v1 units) |
| fertile_ground_daemon | 1v1 | 0.785 (22780) | 4.95 | 1.41 | 5.89 | 4.40 | 2.91 | 6.5 | under (0.45x) | 7.6 (field) |
| fertile_ground_daemon | 3v3 | 0.710 (575) | 5.00 | 1.41 | 5.39 | 4.04 | 2.70 | 6.5 | under (0.41x) | 7.6 (pool) |
| hoofbeat_daemon | 1v1 | 1.015 (22780) | 4.95 | 0.70 | 3.81 | 2.85 | 1.88 | 6.5 | under (0.29x) | 3.8 (field) |
| hoofbeat_daemon | 3v3 | 1.117 (575) | 5.00 | 0.70 | 4.24 | 3.18 | 2.12 | 6.5 | under (0.33x) | 3.8 (pool) |
| hoofbeat_daemon | 1v1 | 3.341 (7175) | 6.98 | 0.70 | 18.97 | 15.80 | 12.62 | 6.5 | over (1.94x) | 3.8 (ratatoskr_v1 units) |
| hoofbeat_daemon | 3v3 | 1.930 (43) | 5.14 | 0.70 | 7.60 | 5.76 | 3.93 | 6.5 | under (0.60x) | 3.8 (ratatoskr_v1 units) |
| hoofbeat_daemon | 1v1 | 2.278 (4924) | 4.62 | 0.70 | 7.84 | 5.67 | 3.51 | 6.5 | under (0.54x) | 3.8 (sleipnir_v1 units) |
| einherjar_standard | 1v1 | 0.000 (22780) | 4.95 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 0.0 (field) |
| einherjar_standard | 3v3 | 0.000 (575) | 5.00 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | 0.0 (pool) |
| riptide | 1v1 | 4.153 (22780) | 4.95 | 0.70 | 15.59 | 11.65 | 7.70 | 6.5 | over (1.19x) | 3.8 (field) |
| riptide | 3v3 | 5.896 (575) | 5.00 | 0.70 | 22.40 | 16.80 | 11.20 | 6.5 | over (1.72x) | 3.8 (pool) |
| short_circuit | 1v1 | 0.835 (22780) | 4.95 | 1.41 | 6.27 | 4.69 | 3.10 | 6.5 | under (0.48x) | 7.6 (field) |
| short_circuit | 3v3 | 0.795 (575) | 5.00 | 1.41 | 6.04 | 4.53 | 3.02 | 6.5 | under (0.46x) | 7.6 (pool) |
| reactive_plating | 1v1 | 2.198 (22780) | 4.95 | 0.30 | 3.48 | 2.60 | 1.72 | 6.5 | under (0.26x) | 1.6 (field, capped 3/turn) |
| reactive_plating | 3v3 | 2.527 (575) | 5.00 | 0.30 | 4.04 | 3.03 | 2.02 | 6.5 | under (0.31x) | 1.6 (pool, capped 3/turn) |
| scrubber | 1v1 | 0.798 (22780) | 4.95 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | -1.6 (field) |
| scrubber | 3v3 | 0.763 (575) | 5.00 | 0.00 | 0.00 | 0.00 | 0.00 | 6.5 | under (0.00x) | -1.6 (pool) |
| drip_feed | 1v1 | 0.798 (22780) | 4.95 | 1.09 | 4.65 | 3.48 | 2.30 | 6.5 | under (0.35x) | 5.9 (field) |
| drip_feed | 3v3 | 0.763 (575) | 5.00 | 1.09 | 4.50 | 3.38 | 2.25 | 6.5 | under (0.35x) | 5.9 (pool) |

## 4. DRAW: what a card in each shipped deck scores (= what one draw is worth there) vs the flat 1.5

| deck | cards | mean score | median | mean 0e-card score | mean cost | draw-1 charge | ratio (mean/1.5) |
|---|---|---|---|---|---|---|---|
| audhumbla_v1 | 9 | 3.57 | 2.90 | 0.95 (4) | 1.00 | 1.5 | 2.38 |
| audhumbla_v2 | 9 | 3.23 | 2.90 | 0.95 (2) | 1.11 | 1.5 | 2.16 |
| control_v1 | 10 | 2.85 | 3.00 | 1.00 (4) | 0.80 | 1.5 | 1.90 |
| draugr_v1 | 11 | 3.81 | 3.20 | 0.33 (3) | 1.09 | 1.5 | 2.54 |
| draugr_v2 | 10 | 4.61 | 5.60 | 1.67 (3) | 1.00 | 1.5 | 3.07 |
| fafnir_v1 | 11 | 3.68 | 3.00 | 1.85 (6) | 0.82 | 1.5 | 2.45 |
| fafnir_v2 | 10 | 2.58 | 2.90 | 0.73 (3) | 0.90 | 1.5 | 1.72 |
| fenrir_v1 | 9 | 2.19 | 3.10 | 0.70 (2) | 0.78 | 1.5 | 1.46 |
| fenrir_v2 | 9 | 3.06 | 3.40 | 1.00 (3) | 1.00 | 1.5 | 2.04 |
| gullinbursti_v1 | 10 | 3.41 | 2.90 | 1.20 (1) | 1.10 | 1.5 | 2.27 |
| gullinbursti_v2 | 10 | 3.24 | 3.00 | 0.80 (2) | 1.00 | 1.5 | 2.16 |
| hel_v1 | 11 | 2.75 | 2.70 | 0.96 (5) | 0.73 | 1.5 | 1.83 |
| hel_v2 | 10 | 2.98 | 2.90 | 0.45 (4) | 0.90 | 1.5 | 1.99 |
| hraesvelgr_v1 | 12 | 1.51 | 1.50 | 0.80 (3) | 0.75 | 1.5 | 1.01 |
| hraesvelgr_v2 | 8 | 3.11 | 2.50 | 2.45 (2) | 1.00 | 1.5 | 2.07 |
| huldra_v1 | 9 | 2.43 | 3.10 | 1.00 (4) | 0.67 | 1.5 | 1.62 |
| huldra_v2 | 9 | 2.64 | 2.50 | 1.07 (3) | 0.78 | 1.5 | 1.76 |
| jormungandr_v1 | 9 | 2.88 | 2.50 | 1.55 (4) | 0.67 | 1.5 | 1.92 |
| jormungandr_v2 | 8 | 3.96 | 1.80 | 1.20 (2) | 0.88 | 1.5 | 2.64 |
| kraken_v1 | 8 | 3.15 | 3.20 | 1.40 (1) | 1.00 | 1.5 | 2.10 |
| kraken_v2 | 8 | 6.45 | 9.50 | 0.50 (2) | 1.75 | 1.5 | 4.30 |
| nidhoggr_v1 | 10 | 1.39 | 3.00 | 0.98 (4) | 0.90 | 1.5 | 0.93 |
| nidhoggr_v2 | 10 | 6.63 | 6.00 | 1.55 (4) | 1.00 | 1.5 | 4.42 |
| ratatoskr_v1 | 11 | 1.99 | 1.20 | 0.73 (6) | 0.73 | 1.5 | 1.33 |
| ratatoskr_v2 | 9 | 2.76 | 2.90 | 1.15 (4) | 0.89 | 1.5 | 1.84 |
| skoll_v1 | 9 | 6.93 | 3.10 | 1.20 (1) | 1.11 | 1.5 | 4.62 |
| skoll_v2 | 9 | 2.39 | 3.00 | 0.13 (3) | 0.89 | 1.5 | 1.59 |
| sleipnir_v1 | 12 | 2.18 | 2.70 | 1.20 (5) | 0.67 | 1.5 | 1.45 |
| sleipnir_v2 | 8 | 2.56 | 2.80 | 0.50 (2) | 0.88 | 1.5 | 1.71 |
| valkyrie_v1 | 10 | 2.53 | 2.70 | 0.95 (2) | 0.90 | 1.5 | 1.69 |
| valkyrie_v2 | 8 | 3.10 | 2.30 | 1.20 (2) | 0.88 | 1.5 | 2.07 |
| ymir_v1 | 10 | 4.16 | 5.60 | 1.10 (2) | 1.10 | 1.5 | 2.77 |
| ymir_v2 | 8 | 7.09 | 6.50 | — | 2.00 | 1.5 | 4.73 |
| **all decks** | 33 | 3.39 | | | | 1.5 | 2.26 |

Cards drawing more than one (whole pool):

| card | cost | draw | score | ceiling | decks |
|---|---|---|---|---|---|
| scry | 2e | 2 | 2.9 | 6.5 | — |
| tempest | 1e | 2 | 2.3 | 3 | hraesvelgr_v1 |
| tailwind | 1e | 2 | 2.3 | 3 | hraesvelgr_v2, sleipnir_v1 |
| creeping_dread | 2e | 2 | 5.9 | 6.5 | — |
| squirrel_away | 1e | 2 | 2.3 | 3 | hel_v2 |
| dread_tidings | 1e | 3 | 3.2 | 3 | draugr_v1 |
| morning_light | 1e | 2 | 2.3 | 3 | valkyrie_v2 |
| tide_reading | 1e | 2 | 2.3 | 3 | — |

whirlpool_v2 shipped (8 power, draw 1, 2 Dazed): score 3.20; arm "draw 2, 1 Dazed, no power": 2.80; ceiling 3

## 5. `score === 0` guard (powerscale.ts L959)

feedback_loop_daemon as shipped (hook only): 3.20
same daemon + an on-cast ATTACK 10: 1.20
the on-cast ATTACK alone, no hook: 1.20
=> CONFIRMED: adding an on-cast action DROPS the score by 2.00 - the hook value is lost because score !== 0 skips the hook branch.
battery_pack (own ENERGY action, no hooks): 4.90 - unaffected today because it has no hook, but it is the shape the guard would break.
