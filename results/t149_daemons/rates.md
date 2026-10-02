## 2. Per-trigger proc rates (probe twins on every unit, condition-gated exactly as the daemon is)

### 1v1 (owner decks vs the standard opponent set, both sides pooled): 4600 games, mean length 4.95 turns, 45288 unit-turns (all units, both sides), truncated 0

| daemon | hook | trigger / when | procs per unit-turn (pool) | zero-proc unit share | per unit-game | implied procs from t1 (rate x len) | vs 4 | would-be dmg per unit-game (% of a maxHp) |
|---|---|---|---|---|---|---|---|---|
| harden_daemon | defensive_daemon_hook | onTurnStart {"source":"SELF"} | 0.790 | 1% | 3.89 | 3.91 | 0.98x | — |
| core_overclock_daemon | daemon_double_strength | onDamageCalculated {"source":"SELF"} | 0.829 | 57% | 4.08 | 4.11 | 1.03x | 48.3% |
| cinder_armor_daemon | daemon_burn_sharp_synergy | onStatusApplied {"source":"SELF","statusApplied":"Burn"} | 0.068 | 92% | 0.33 | 0.34 | 0.08x | — |
| feedback_loop_daemon | daemon_draw_damage_proc | onCardDraw {"source":"SELF","isNaturalDraw":false} | 0.585 | 54% | 2.88 | 2.90 | 0.72x | — |
| echo_chamber_v2 | echo_chamber_daemon_hook | onActionStart {"source":"SELF","baseCost":0,"isToken":false} | 1.514 | 3% | 7.45 | 7.50 | 1.87x | — |
| fertile_ground_daemon | daemon_extra_draw | onTurnStart {"source":"SELF"} | 0.790 | 1% | 3.89 | 3.91 | 0.98x | — |
| hoofbeat_daemon | hoofbeat_daemon_hook | onActionStart {"source":"SELF","baseCost":0,"isToken":false} | 1.514 | 3% | 7.45 | 7.50 | 1.87x | — |
| einherjar_standard | einherjar_standard_hook | onDamageCalculated {"source":"SELF","actionType":"ATTACK","programElement":"Light"} | 0.000 | 100% | 0.00 | 0.00 | 0.00x | — |
| riptide | riptide_undertow | onActionEnd {"source":"OPPONENT"} | 3.363 | 0% | 16.55 | 16.65 | 4.16x | — |
| short_circuit | short_circuit_discharge | onCardDraw {"source":"OPPONENT","isNaturalDraw":false} | 0.583 | 54% | 2.87 | 2.89 | 0.72x | — |
| reactive_plating | reactive_plating_proc | onPostDamage {"source":"OPPONENT","target":"ALLY","counter":{"key":"reactive_plating_grants","operator":"LT","value":3,"scope":"SIDE"}} | 2.060 | 0% | 10.14 | 10.20 | 2.55x | — |
| reactive_plating | reactive_plating_reset | onTurnStart {"source":"SELF"} | 0.790 | 1% | 3.89 | 3.91 | 0.98x | — |
| scrubber | scrubber_purge | onTurnEnd {"source":"SELF"} | 0.800 | 1% | 3.94 | 3.96 | 0.99x | — |
| drip_feed | drip_feed_tick | onTurnEnd {"source":"SELF"} | 0.800 | 1% | 3.94 | 3.96 | 0.99x | — |

### 1v1 FIELD: the ENEMY side only = the standard 30-deck opponent set, i.e. an average shipped deck: 4600 games, mean length 4.95 turns, 22780 unit-turns (all units, both sides), truncated 0

| daemon | hook | trigger / when | procs per unit-turn (pool) | zero-proc unit share | per unit-game | implied procs from t1 (rate x len) | vs 4 | would-be dmg per unit-game (% of a maxHp) |
|---|---|---|---|---|---|---|---|---|
| harden_daemon | defensive_daemon_hook | onTurnStart {"source":"SELF"} | 0.785 | 0% | 3.89 | 3.89 | 0.97x | — |
| core_overclock_daemon | daemon_double_strength | onDamageCalculated {"source":"SELF"} | 0.797 | 54% | 3.95 | 3.95 | 0.99x | 49.8% |
| cinder_armor_daemon | daemon_burn_sharp_synergy | onStatusApplied {"source":"SELF","statusApplied":"Burn"} | 0.135 | 84% | 0.67 | 0.67 | 0.17x | — |
| feedback_loop_daemon | daemon_draw_damage_proc | onCardDraw {"source":"SELF","isNaturalDraw":false} | 0.325 | 67% | 1.61 | 1.61 | 0.40x | — |
| echo_chamber_v2 | echo_chamber_daemon_hook | onActionStart {"source":"SELF","baseCost":0,"isToken":false} | 1.015 | 6% | 5.03 | 5.03 | 1.26x | — |
| fertile_ground_daemon | daemon_extra_draw | onTurnStart {"source":"SELF"} | 0.785 | 0% | 3.89 | 3.89 | 0.97x | — |
| hoofbeat_daemon | hoofbeat_daemon_hook | onActionStart {"source":"SELF","baseCost":0,"isToken":false} | 1.015 | 6% | 5.03 | 5.03 | 1.26x | — |
| einherjar_standard | einherjar_standard_hook | onDamageCalculated {"source":"SELF","actionType":"ATTACK","programElement":"Light"} | 0.000 | 100% | 0.00 | 0.00 | 0.00x | — |
| riptide | riptide_undertow | onActionEnd {"source":"OPPONENT"} | 4.153 | 0% | 20.57 | 20.57 | 5.14x | — |
| short_circuit | short_circuit_discharge | onCardDraw {"source":"OPPONENT","isNaturalDraw":false} | 0.835 | 41% | 4.14 | 4.14 | 1.03x | — |
| reactive_plating | reactive_plating_proc | onPostDamage {"source":"OPPONENT","target":"ALLY","counter":{"key":"reactive_plating_grants","operator":"LT","value":3,"scope":"SIDE"}} | 2.198 | 0% | 10.89 | 10.89 | 2.72x | — |
| reactive_plating | reactive_plating_reset | onTurnStart {"source":"SELF"} | 0.785 | 0% | 3.89 | 3.89 | 0.97x | — |
| scrubber | scrubber_purge | onTurnEnd {"source":"SELF"} | 0.798 | 3% | 3.95 | 3.95 | 0.99x | — |
| drip_feed | drip_feed_tick | onTurnEnd {"source":"SELF"} | 0.798 | 3% | 3.95 | 3.95 | 0.99x | — |

### 3v3 (ticket-140 panel comps, round-robin, both sides pooled): 27 games, mean length 5.00 turns, 575 unit-turns (all units, both sides), truncated 0

| daemon | hook | trigger / when | procs per unit-turn (pool) | zero-proc unit share | per unit-game | implied procs from t1 (rate x len) | vs 4 | would-be dmg per unit-game (% of a maxHp) |
|---|---|---|---|---|---|---|---|---|
| harden_daemon | defensive_daemon_hook | onTurnStart {"source":"SELF"} | 0.710 | 13% | 2.52 | 3.55 | 0.89x | — |
| core_overclock_daemon | daemon_double_strength | onDamageCalculated {"source":"SELF"} | 0.863 | 54% | 3.06 | 4.31 | 1.08x | 26.0% |
| cinder_armor_daemon | daemon_burn_sharp_synergy | onStatusApplied {"source":"SELF","statusApplied":"Burn"} | 0.000 | 100% | 0.00 | 0.00 | 0.00x | — |
| feedback_loop_daemon | daemon_draw_damage_proc | onCardDraw {"source":"SELF","isNaturalDraw":false} | 0.351 | 58% | 1.25 | 1.76 | 0.44x | — |
| echo_chamber_v2 | echo_chamber_daemon_hook | onActionStart {"source":"SELF","baseCost":0,"isToken":false} | 1.117 | 21% | 3.96 | 5.58 | 1.40x | — |
| fertile_ground_daemon | daemon_extra_draw | onTurnStart {"source":"SELF"} | 0.710 | 13% | 2.52 | 3.55 | 0.89x | — |
| hoofbeat_daemon | hoofbeat_daemon_hook | onActionStart {"source":"SELF","baseCost":0,"isToken":false} | 1.117 | 21% | 3.96 | 5.58 | 1.40x | — |
| einherjar_standard | einherjar_standard_hook | onDamageCalculated {"source":"SELF","actionType":"ATTACK","programElement":"Light"} | 0.000 | 100% | 0.00 | 0.00 | 0.00x | — |
| riptide | riptide_undertow | onActionEnd {"source":"OPPONENT"} | 5.896 | 1% | 20.93 | 29.48 | 7.37x | — |
| short_circuit | short_circuit_discharge | onCardDraw {"source":"OPPONENT","isNaturalDraw":false} | 0.795 | 39% | 2.82 | 3.97 | 0.99x | — |
| reactive_plating | reactive_plating_proc | onPostDamage {"source":"OPPONENT","target":"ALLY","counter":{"key":"reactive_plating_grants","operator":"LT","value":3,"scope":"SIDE"}} | 2.527 | 1% | 8.97 | 12.63 | 3.16x | — |
| reactive_plating | reactive_plating_reset | onTurnStart {"source":"SELF"} | 0.710 | 13% | 2.52 | 3.55 | 0.89x | — |
| scrubber | scrubber_purge | onTurnEnd {"source":"SELF"} | 0.763 | 4% | 2.71 | 3.82 | 0.95x | — |
| drip_feed | drip_feed_tick | onTurnEnd {"source":"SELF"} | 0.763 | 4% | 2.71 | 3.82 | 0.95x | — |

### Probe rates restricted to the deck that would run the daemon

| daemon | deck | width | games | unit-turns | procs per unit-turn | zero-proc unit share | game len | implied procs from t1 | vs 4 |
|---|---|---|---|---|---|---|---|---|---|
| echo_chamber_v2 | ratatoskr_v1 | 1v1 | 1040 | 7175 | 3.341 | 0% | 6.98 | 23.31 | 5.83x |
| echo_chamber_v2 | ratatoskr_v1 | 3v3 | 14 | 43 | 1.930 | 0% | 5.14 | 9.93 | 2.48x |
| echo_chamber_v2 | ratatoskr_v2 | 1v1 | 1040 | 4593 | 1.998 | 0% | 4.46 | 8.91 | 2.23x |
| echo_chamber_v2 | ratatoskr_v2 | 3v3 | 17 | 57 | 0.158 | 59% | 5.00 | 0.79 | 0.20x |
| hoofbeat_daemon | sleipnir_v1 | 1v1 | 1080 | 4924 | 2.278 | 0% | 4.62 | 10.53 | 2.63x |
| feedback_loop_daemon | kraken_v1 | 1v1 | 1080 | 4669 | 1.417 | 0% | 4.37 | 6.19 | 1.55x |
| feedback_loop_daemon | kraken_v1 | 3v3 | 24 | 110 | 1.064 | 0% | 5.25 | 5.58 | 1.40x |
| core_overclock_daemon | fenrir_v1 | 1v1 | 1080 | 3786 | 1.963 | 0% | 3.53 | 6.93 | 1.73x |
| core_overclock_daemon | fenrir_v1 | 3v3 | 13 | 39 | 1.744 | 0% | 4.54 | 7.91 | 1.98x |
| cinder_armor_daemon | fenrir_v1 | 1v1 | 1080 | 3786 | 0.000 | 100% | 3.53 | 0.00 | 0.00x |
| cinder_armor_daemon | fenrir_v1 | 3v3 | 13 | 39 | 0.000 | 100% | 4.54 | 0.00 | 0.00x |
| hoofbeat_daemon | ratatoskr_v1 | 1v1 | 1040 | 7175 | 3.341 | 0% | 6.98 | 23.31 | 5.83x |
| hoofbeat_daemon | ratatoskr_v1 | 3v3 | 14 | 43 | 1.930 | 0% | 5.14 | 9.93 | 2.48x |
| echo_chamber_v2 | sleipnir_v1 | 1v1 | 1080 | 4924 | 2.278 | 0% | 4.62 | 10.53 | 2.63x |

### Installed daemons at 1v1 (real hook firings after the cast)

| daemon | caster deck | games with deck | casts | casts/game | cast turn mean / median | procs/cast | procs per turn-alive (cast turn inclusive) | turns alive from cast (mean, inclusive) | game len | implied EXPECTED procs (per cast) | vs 4 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hoofbeat_daemon | sleipnir_v1 | 1080 | 920 | 0.85 | 1.89 / 2 | 9.52 | 2.474 | 3.85 | 4.62 | 9.52 | 2.38x |
| echo_chamber_v2 | ratatoskr_v1 | 1040 | 963 | 0.93 | 1.84 / 2 | 21.81 | 3.408 | 6.40 | 6.98 | 21.81 | 5.45x |
| echo_chamber_v2 | ratatoskr_v2 | 1040 | 381 | 0.37 | 2.50 / 2 | 7.57 | 2.050 | 3.69 | 4.46 | 7.57 | 1.89x |

### Installed daemons at 3v3 (real hook firings after the cast)

| daemon | caster deck | games with deck | casts | casts/game | cast turn mean / median | procs/cast | procs per turn-alive (cast turn inclusive) | turns alive from cast (mean, inclusive) | game len | implied EXPECTED procs (per cast) | vs 4 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| echo_chamber_v2 | ratatoskr_v1 | 14 | 4 | 0.29 | 1.75 / 2 | 8.00 | 2.462 | 3.25 | 5.14 | 8.00 | 2.00x |
| echo_chamber_v2 | huldra_v1 | 13 | 4 | 0.31 | 1.75 / 2 | 3.50 | 2.800 | 1.25 | 5.23 | 3.50 | 0.88x |
| echo_chamber_v2 | kraken_v1 | 18 | 1 | 0.06 | 4.00 / 4 | 1.00 | 0.500 | 2.00 | 5.11 | 1.00 | 0.25x |
| echo_chamber_v2 | ratatoskr_v2 | 17 | 1 | 0.06 | 2.00 / 2 | 1.00 | 0.500 | 2.00 | 5.00 | 1.00 | 0.25x |
| echo_chamber_v2 | huldra_v2 | 16 | 2 | 0.13 | 6.00 / 7 | 5.00 | 1.667 | 3.00 | 5.06 | 5.00 | 1.25x |
| echo_chamber_v2 | jormungandr_v2 | 12 | 4 | 0.33 | 2.25 / 3 | 4.50 | 2.000 | 2.25 | 4.83 | 4.50 | 1.13x |
| echo_chamber_v2 | (any caster, games where a side ships it) | 27 | 16 | 0.59 | 2.56 / 2 | 4.75 | 2.054 | 2.31 | 5.00 | 4.75 | 1.19x |

### Cast-turn distribution of the installed daemons

| daemon | deck | width | casts | t1 | t2 | t3 | t4+ | never cast (games with deck, no cast) |
|---|---|---|---|---|---|---|---|---|
| echo_chamber_v2 | ratatoskr_v1 | 1v1 | 963 | 332 | 523 | 53 | 55 | 77 / 1040 |
| echo_chamber_v2 | ratatoskr_v2 | 1v1 | 381 | 154 | 61 | 62 | 104 | 659 / 1040 |
| hoofbeat_daemon | sleipnir_v1 | 1v1 | 920 | 287 | 486 | 115 | 32 | 160 / 1080 |
| echo_chamber_v2 | ratatoskr_v1 | 3v3 | 4 | 2 | 1 | 1 | 0 | 10 / 14 |
| echo_chamber_v2 | ratatoskr_v2 | 3v3 | 1 | 0 | 1 | 0 | 0 | 16 / 17 |

