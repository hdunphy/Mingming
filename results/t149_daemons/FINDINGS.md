# Ticket 149 — 3b: DAEMONS and DRAW ("the scorer prices what it can measure")

Instrument-only. No card, deck, engine or `powerscale.ts` number was changed. Scripts: `scratch/t149_daemon_score.ts`
(static: inventory, pricing, DRAW, guard), `scratch/t149_daemon_procs.ts` (battles + proc counting),
`scratch/t149_daemon_report.ts` (fold to tables + `rates.json`), `scratch/t149_whirlpool.ts` (the in-memory
whirlpool_v2 arm), `scratch/t149_daemon_findings.py` (this file). Raw rows: `results/t149_daemons/w1_*.jsonl`
(4600 1v1 games), `results/t149_daemons/w3*.jsonl` (27 3v3 games), `results/t149_daemons/whirlpool.jsonl`.

## Headline

- **Only 3 of 14 daemons are in a shipped deck**: `echo_chamber_v2` (ratatoskr_v1, ratatoskr_v2) and `hoofbeat_daemon` (sleipnir_v1). `core_overclock_daemon`, `feedback_loop_daemon` and `fertile_ground_daemon` appear only in `battleFactories.ts` archetype (encounter) decks; the other eight are in no deck at all.
- **`EXPECTED_DAEMON_PROCS = 4` is wrong in both directions, by trigger.** Measured procs per unit-turn (the rate the daemon SEES, `source: SELF` respected) at 1v1 on the 30-deck field: `onTurnStart`/`onTurnEnd` 0.79-0.80 (one per own turn, ~3.9 per game = 4 is right by accident of game length); 0-cost plays (`echo_chamber_v2`, `hoofbeat_daemon`) 1.0 on an average deck but **2.3-3.3 on the decks that ship them** (10-23 procs per game from turn 1; installed and measured: 21.8 procs per cast on ratatoskr_v1, 9.5 on sleipnir_v1 = 5.4x and 2.4x the constant); non-natural self-draw (`feedback_loop_daemon`) 0.33 on the field, zero for 67% of units (1.4 on kraken_v1); `onStatusApplied Burn` 0.14 (zero for 84% of units); `einherjar_standard` 0.000 (no Light attacker in any shipped deck); `riptide` (`onActionEnd` OPPONENT) 4.2 per round = 20 procs a game, 5x the constant.
- **At 3v3 the same daemon is a different card**: `echo_chamber_v2` in the zoo/control comps was cast in 16 of 27 games, by whichever unit drew it (ratatoskr_v1 4, huldra_v1 4, jormungandr_v2 4, others 4), on turn 2.6 mean, and made 4.75 procs per cast (2.05 per turn alive, 2.3 turns alive) - the constant 4 is about right there, for the wrong reason: the SELF gate (ticket 128) and the caster's short life cancel the deck's 0-cost density. ratatoskr_v2 units at 3v3 made a 0-cost non-token play on only 37% of unit-games.
- **The play-turn table**: priced at rate x (len - castTurn), no daemon in the pool is "in band (0.8-1.0x) when cast on turn 3" on the field rate; `echo_chamber_v2`/`hoofbeat_daemon` on ratatoskr_v1 are 2-2.5x OVER the ceiling even at t3 and `riptide` is over at t3 on the field; everything else is under. The AI casts the shipped daemons on turn 1.9 mean (median 2), and skips the 2e `echo_chamber_v2` in 63% of ratatoskr_v2 games.
- **DRAW: the flat 15 power (1.5 score) buys a card whose mean powerscale score across the 33 shipped decks is 3.39 (2.26x the charge)**; range 1.39 (nidhoggr_v1) to 7.09 (ymir_v2). The ticket-131 whirlpool_v2 field number: **"draw 2, 1 Dazed, no power" wins 73.9% vs shipped 47.1%** for kraken_v1 at 1v1 over 1200 games each - the scorer has them 2.8 vs 3.2 the other way. Deck context the scorer cannot see: kraken_v1's OS turns every non-natural draw into 2 Dazed.
- **The `score === 0` guard is confirmed**: an in-memory `feedback_loop_daemon` given an on-cast ATTACK 10 scores 1.2 instead of 3.2 - its hook branch is skipped entirely (powerscale.ts L959). No shipped daemon trips it today (`battery_pack` has an action but no hook; every hooked daemon has empty `actions`).
- Bonus scorer reads from the inventory: `scrubber` scores **-1.6** (removing Poison from allies is priced as a downside), `core_overclock_daemon` and `einherjar_standard` score 0.0 (modifier hooks with no `do`).

## Method

- **1v1**: each of ratatoskr_v1, ratatoskr_v2, sleipnir_v1 (the daemon decks), kraken_v1 and fenrir_v1 (the `battleFactories` daemon archetypes) on its own species frame vs every other species x every OS (26-27 opponents), 20 seeds x both turn orders = 40 games per opponent, beamless, IV jitter as `runOne`. 4600 games.
- **3v3**: ticket-140 panel comps, beamless, 5 seeds x both orders = 10 games a cell; cells done in the budget: zoo vs fire_pair (10), control vs ref_solo_a (10), zoo vs control and control vs fire_pair (partial; still appending to w3c/w3d.jsonl when this was written - re-run report -> score --rates -> findings.py to refresh). 27 games. A zoo/control 3v3 game costs 4-6 minutes on this shared box with the probes attached.
- **Counting**: for each of the 14 daemon hooks in `hooks.json` a probe twin (`probe_<id>`, same trigger + `when`, empty `do` / multiplier 1) is registered and put on every unit's `hooks` on both sides. Its wrapper counts each condition pass outside AI lookahead (`isSimulating()` false). That is "would this daemon have fired here, on this unit", i.e. `source: SELF` gating and the `isToken`/`baseCost`/`isNaturalDraw` filters are exactly the daemon's. The real daemon hooks are wrapped the same way, so installed daemons report casts, cast turn and actual procs. Probes verified not to change outcomes (identical win rates and turn counts with `--noprobe 1`; ~30% slower at 1v1).
- **Unit-turn** = one living unit during one round (`state.turn`). Rates are procs / unit-turns; "implied procs from t1" = rate x mean game length.

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

Notes on the inventory: `reactive_plating` carries a second hook (`reactive_plating_reset`) that is bookkeeping, not value. `drip_feed`'s Poison gate (`targetHasStatus`) sits on the `do` action, not the `when`, so its probe counts every own turn-end; the real value is that times the share of turns an ally is poisoned (not measured here). `scrubber` is the same shape.

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

Reading the rates: the 1v1 "pool" is weighted toward the five owner decks (each is the PLAYER in every game of its file); the **FIELD** table (ENEMY side only = the standard opponent set, one game each) is the clean "average shipped deck" rate. Would-be damage for the two modifier daemons is the damage the multiplier WOULD have added, summed per unit-game, as a fraction of that unit's maxHp — `core_overclock_daemon` on the field would add ~0.5 of a health bar per unit-game averaged over ALL units, i.e. ~1.1 health bars for the 46% of units that ever carry Strengthened and 0 for the rest.

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

How to read: `per-proc` is what the scorer already prices one `do` at (score / (4 x 1.5 x 0.9)); the columns t1/t2/t3 replace the constant 4 with rate x (mean game length - castTurn) and re-apply the 1.5 daemon premium and 0.9 exhaust discount. "band at t3" is Henry's bar (0.8-1.0x of the ceiling when cast on turn 3). Modifier daemons and `scrubber` have per-proc 0 in the scorer, so they stay 0 at any rate - the rate for them is in the table above (they DO fire; the scorer has no price for a multiplier or a removal on allies).

Direct check against the installed measurement (procs the real daemon actually made, cast turn inclusive): echo_chamber_v2 on ratatoskr_v1 4.04 procs per turn alive x 5.4 turns = 21.8 per cast (the table's rate x (len - 2) = 3.34 x 4.98 = 16.6 is the same order); hoofbeat on sleipnir_v1 3.34 x 2.85 = 9.5 per cast. Both are far above 4, and both are the deck-built case ticket 32 flagged.

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

Reading: "mean score" is gross card value. Ticket 129 measured the hand emptying and energy left over at 3v3, so at width 3 a drawn card is close to worth its whole score; at 1v1 the energy cap binds more and the 0e column ("mean 0e-card score") is the floor of what a draw is worth there. The flat 1.5 is under the mean in 31 of 33 decks; it is only right for hraesvelgr_v1 (1.51) and nidhoggr_v1 (1.39).

### The ticket-131 whirlpool_v2 case, in the field

| arm | printing | score | field win (kraken_v1, 1v1, 30 opps) | n games | casts/game | direct dmg/cast (HP) | Dazed landed/cast | mean turns |
|---|---|---|---|---|---|---|---|---|
| SHIPPED | 8 power, draw 1, 2 Dazed | 3.2 | 47.1% | 1200 | 1.51 | 26.2 | 3.27 | 4.56 |
| DRAW2 | draw 2, 1 Dazed, no power | 2.8 | 73.9% | 1200 | 2.01 | 0.0 | 4.65 | 4.08 |

DRAW2 minus SHIPPED per opponent (win-rate points, n 40 each): min +3, median +26, max +60; positive against 30 of 30 opponents.

`fenrir_v1:+3 fenrir_v2:+15 fafnir_v1:+12 fafnir_v2:+3 skoll_v1:+5 skoll_v2:+3 jormungandr_v1:+8 jormungandr_v2:+25 gullinbursti_v1:+12 gullinbursti_v2:+3 hraesvelgr_v1:+22 hraesvelgr_v2:+35 sleipnir_v1:+27 sleipnir_v2:+55 ratatoskr_v1:+42 ratatoskr_v2:+32 huldra_v1:+42 huldra_v2:+60 ymir_v1:+40 ymir_v2:+25 draugr_v1:+22 draugr_v2:+28 valkyrie_v1:+40 valkyrie_v2:+40 audhumbla_v1:+60 audhumbla_v2:+52 hel_v1:+30 hel_v2:+12 nidhoggr_v1:+20 nidhoggr_v2:+28`

Method: `scratch/t149_whirlpool.ts`, kraken_v1 on kraken vs the standard 1v1 set (30 opponents), 20 seeds x both orders = 40 games per opponent, `runPairedBatch` with telemetry; the arm patches `ProgramRegistry.whirlpool_v2.actions` in memory + `clearProgramDataCache()` and asserts it took. "Dazed landed/cast" includes the 2 Dazed per non-natural draw that kraken_v1's ABYSSAL_INK OS adds, which is why the shipped card (printed 2 Dazed) lands 3.3 and the arm (printed 1) lands 4.7: on this frame each draw is also 2 Dazed, and the arm draws two.

## 5. `score === 0` guard (powerscale.ts L959)

feedback_loop_daemon as shipped (hook only): 3.20
same daemon + an on-cast ATTACK 10: 1.20
the on-cast ATTACK alone, no hook: 1.20
=> CONFIRMED: adding an on-cast action DROPS the score by 2.00 - the hook value is lost because score !== 0 skips the hook branch.
battery_pack (own ENERGY action, no hooks): 4.90 - unaffected today because it has no hook, but it is the shape the guard would break.

Code path: `calculatePowerscale` scores `card.actions` first; the daemon branch at L959 is `if (card.category === 'Daemon' && score === 0)`, so any daemon whose own actions score non-zero (positive OR negative) never reaches `daemonHookActions`. A daemon with a self-debuff on cast (negative score) would ALSO skip its hook value. `battery_pack` (ENERGY +1, no hook) scores 4.9 through the ordinary path and is unaffected.

## Caveats

- 3v3 coverage is thin: 27 games over three cells (zoo vs fire_pair complete; control vs ref_solo_a and zoo vs control as far as they got in the budget - each game is 4-6 min on this box with the probes and another agent on the same two cores). The 3v3 pool rates are usable for the always-on triggers (turn start/end, opponent card plays, damage taken) and directional for the rest; the installed-daemon rows at 3v3 are n = 10 casts. ink_loop and the remaining round-robin pairs were not run.
- At 3v3 the deck is shared, so `echo_chamber_v2` is cast by whichever unit draws it (huldra_v1 cast it more often than ratatoskr_v1 in the zoo games) and then sees only that caster's 0-cost plays: the `source: SELF` cost ticket 128 described, visible in the "caster deck" column.
- `reactive_plating` probe: its `counter LT 3` gate reads a counter only the real daemon increments, so the raw probe is uncapped; the table applies min(3, hits) per owner-turn after the fact (`platingCapped`), which is what the real card would do on a single-daemon side.
- Probe would-be damage for `core_overclock_daemon` uses the hook's own `multiplier`/`scaling` on the pre-hook damage; it does not model the (unpriced) interaction with the 8-stack cap beyond what `resolveScaling` applies.
- The play-turn table uses the ticket's `len - castTurn` (cast turn's own procs excluded); the installed table uses cast-turn-inclusive turns alive. The two differ by one turn's procs.
- DRAW value is the scorer's own number for the drawn card; it says nothing about whether the scorer is right about that card.
