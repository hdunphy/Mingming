# Skoll decks (ticket 64): the wolf finally gets her pass - devour or hoard

- Type: wayfinder:task - Henry-approved design (2026-08-15, skoll design session). This
  ticket IS the implementation brief; implementing session flips it closed + appends its
  Resolution.
- Status: **open**
- Assignee: -
- Blocked by: ticket 62 SHIPPED (7a39275, DET-C4-D14) - run against that baseline.
  DEEP-PHASE POLICY binds; branch card-dev; author Henry Dunphy <hdunphy15@gmail.com>;
  line-ending law; locks -> _to_delete/git-locks/.

## Context

Skoll never had a deck pass - both slots run the ticket-13 legacy shared lists (the registry
comment still says so; replace it). Ticket 58 measured the rot: adrenaline 57.8% dead,
core_overclock_daemon 42.5% dead with its 8-cap overfed in 57.5% of games, vanilla
fire_punch_v2 the top damage source in BOTH decks. The Burn grid proved Burn is not her
lever. Species identity (Henry): ONE resource, TWO appetites - **v1 EATS her Strength, v2
HOARDS it.** Frame 70/95/55/2e, draw 3, +24.5% first-mover (diagnostic flag - re-report it).

## Part 1 - skoll_v2 OS rework (hooks/daemon machinery; liveness after)

SOLAR_FLARE_OS is retired (its 3+-Burn refund window collapses under detonation resets -
measured dead end). Keep id `skoll_v2`, new name **SOLAR_OVERDRIVE_OS**:
*"Skoll's attacks deal +15% damage per stack of Strength she holds (max 5 stacks)."*
Clone core_overclock_daemon's mechanism (the +%/stack damage hook) into the OS at 15%/cap 5.
**Pool watch-item, document in the Resolution: OS + core_overclock_daemon COMPOUND (8-COMPOUND)
in player builds** - the daemon leaves her deck but stays in the registry; do not fix, record.

## Part 2 - new card (programs.json, LF)

`sun_devourer` | Sun Devourer | 2e Fire Attack Rare | Single |
consume ALL of the caster's Strengthened stacks; ATTACK 15 power per stack consumed |
*"Devour the light: consume all your Strength and deal 15 power per stack consumed."*
Implementation: ash_communion's consume machinery (STATUS_CONSUMED) pointed at Strengthened,
paying damage instead of heal. NOT momentum_crash's read-only scaler - the consume IS the
differentiation from sleipnir_v1's payoff (rulebook: no shared archetype at payoff level).
**Pricing flag: the scorer's ASSUMED_STATUS_COUNT=3 under-reads this card - TREACHERY's
measured feed is 4.8 stacks. Do not chase its redline row in either direction; the sim gate
decides.**

## Part 3 - decks (mingmingRegistry.ts, CRLF; replace the stale ticket-13 comment)

```
"skoll_v1": ["sun_devourer", "sun_devourer", "fury_strike", "fury_strike", "brute_force", "battle_rhythm", "crimson_draw", "crimson_draw", "water_slap"],
"skoll_v2": ["strength_burst", "strength_burst", "all_in", "desperate_strike", "reckless_charge", "overdrive", "overdrive", "glass_cannon", "water_slap"],
```

v1 archetype: "TREACHERY consume-cycle - get hit, grow the pile, DEVOUR it; crimson_draw
extends the feeding window." adrenaline x2 and the daemon leave (both stay in registry).
v2 archetype: "solar ignition - strength_burst lights the core, overdrive/glass_cannon nuke
under +75%; all_in's 3 self-Burn is the first card that expresses symmetric detonation risk
(cap 4: one stray stack from self-detonation)." No sustain by design - the clock is built in.

## Part 4 - gates, knobs, docs

Deep-phase gates: field 0.35-0.80 BOTH decks (from 36.9 / 27.2), control >=0.60, FTK 0 hard,
dead <=0.35 both sides, mirror >=60% <=30 turns; SS2.3 diagnostic-only. Re-report skoll's
first-mover edge (was +24.5%; flag if |edge| still >20). **Pre-authorized knobs, max 2 rounds
per species, ONE change per sim:** v1: sun_devourer 15 -> 10 or -> 20 /stack; TREACHERY
1 -> 2 Str per hit (enabler knob); crimson_draw -> glass_cannon swap. v2: OS 15% -> 10 or
-> 20; OS cap 5 -> 4 or 6; strength_burst -> x1 + fury_strike in. Anything else -> STOP.
liveness.ts (hooks edited) - tsc - vitest (suite AFTER last edit) - build - scoped
BALANCE_ONLY=skoll - full npm run balance + 8-DIFF (skoll rows move; fenrir/hraesvelgr/draugr
only via noise; control frozen). ONE commit: Resolution + map line + HANDOFF refresh (queue
next: kraken -> hel_v1 -> hraesvelgr pass; ticket 63 census in any gap).

## Deliverable

Commit hash, both decks' gate numbers vs bands, knob rounds, first-mover re-read, the
sun_devourer static-vs-measured note, deviations - or findings if STOPPED.
