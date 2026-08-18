# Skoll decks (ticket 64): the wolf finally gets her pass - devour or hoard

- Type: wayfinder:task - Henry-approved design (2026-08-15, skoll design session). This
  ticket IS the implementation brief; implementing session flips it closed + appends its
  Resolution.
- Status: **closed** (2026-08-15) — shipped, **one gate RED**: skoll_v2 dead cards
- Assignee: implementation agent
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


---

## Resolution (2026-08-15) — SHIPPED, with skoll_v2's dead-card gate RED

Registry `1:8b7b0ae9` → **`1:998a835e`**. Full write-up:
[research/skoll-rebuild.md](../research/skoll-rebuild.md).

**Both decks came off the floor.** Field, 30 iterations on two independent seed bases:

| deck | before | after | control | FTK | dead | mirror |
|---|---|---|---|---|---|---|
| skoll_v1 | 36.9% | **45.6 / 46.1%** | 100 / 100% | 0 | 30.2 / 30.6% | 3.6-3.7t, 100% dec |
| skoll_v2 | 27.2% | **51.0 / 50.1%** | 85.0 / 83.3% | 0 | **36.9 / 38.2%** ❌ | 2.5-2.7t, 93-97% dec |

**Part 1.** SOLAR_FLARE_OS retired; **SOLAR_OVERDRIVE_OS** ships in `CustomFirmware.ts` rather
than `hooks.json`, and the reason is the CAP: `HookFactory.resolveScaling` hard-caps
STRENGTH_STACKS at 8 and this OS is specified at 5, so a data hook would read **+120% at eight
stacks where the design says +75% at five**. A `scalingCap` schema field would mean zod plus the
TS unions twice over (8c2) for one consumer; hand-written firmware is the hel_v2/ymir_v2
precedent. **Pool watch-item recorded as directed: the OS and `core_overclock_daemon` COMPOUND
(8-COMPOUND)** — `1.15^n x 1.2^n` in a player build holding both. Not fixed. `liveness.ts`: zero
static findings, skoll_v2 LIVE (2,267 effects).

**Part 2.** `sun_devourer` shipped. **One engine addition was required: `STATUS_CONSUMED` did
not exist on ATTACK** (HEAL and STATUS only). Added POWER-side per the ticket-26 lesson, so it
rides the divisor/STAB/resistances and zero consumed means zero damage.

**The static-vs-measured note.** Scorer reads **3.2** against a 6.5 budget; measured over 239
casts it consumes **7.91 Strength per cast** (median 8, max 19) and deals **32.67 damage per
cast** (median 33, max 62) at 0.80 casts/game, with only **2 of 239** casts finding an empty
pile. The ticket predicted an under-read against TREACHERY's 4.8; the real figure is 7.91 — a
**2.6x** under-read, because v1's whole list feeds the pile. Against `fire_punch_v2`'s 10.5-13.5
vanilla benchmark that is ~2.5-3x a vanilla 1e card at 2e — honest in delivered terms. Its §1.3
row was not chased in either direction, per the ticket.

**Part 3.** Both lists shipped as authored (plus knob 1 below). Stale ticket-13 comment replaced.

**Knob rounds — one worked, one backfired.**
- **Round 1 (v2), `strength_burst` x2 -> x1 + `fury_strike`:** dead **40.5% -> 36.9%**, field
  43.9 -> **51.0**, control 81.7 -> **85.0**. Kept.
- **Round 2 (v2), OS 15% -> 10%: FAILED IN BOTH DIRECTIONS and was reverted.** The dead gate it
  targeted got WORSE (36.9 -> **37.6%**) because games barely lengthened (3.50 -> 3.63 turns),
  and it cost **12.7 field points and 20 control points**. The reason is recorded in the
  constant's comment so nobody re-runs it.

**THE RED GATE — returned as a finding.** skoll_v2's dead-card ratio is **36.9 / 38.2% against
0.35 on two seed bases** — not noise. The mechanism is the CURVE, not the power: she holds
**three 2-cost cards on a 2-Energy frame in a 3.5-turn game**. Round 2 proved power dials do not
move this number; both remaining authorized knobs are power dials. **The fix is one card swap —
drop an `overdrive` copy for a 1e/0e Fire attack — and it is outside the authorized list, so it
STOPPED here.** Predicted by analogy with round 1: dead ~33-34%, field down ~3-5 to the mid-40s,
still in band.

**First-mover re-read:** v1 **+18.3 / +3.3%**, v2 **-7.1 / -12.1%** — the +24.5% flag CLEARS on
every reading. Note the 15-point spread between v1's two bases: the self-mirror first-mover
figure is a noisy instrument at 30 iterations.

**8-DIFF: 7 rows of 67 moved, 60 bit-identical.** `os:skoll` 54.0 -> 20.0, control-vs-v2
48.0 -> 18.2, control-vs-v1 20.0 -> **0.0**, mirror 50.7 -> 49.0, plus the three
`control-overall` aggregates. **fenrir, hraesvelgr and draugr did not move by any amount.** New
§2.3 redline `os:skoll` 0.30 (diagnostic-only). Redlines 48 -> 49; §1.3 unchanged at 38.

Gates: `tsc -b` clean, **820 passed / 61 files** (suite AFTER the last content edit),
`vite build` clean.

**Four questions returned** (report §8); the load-bearing one is the dead-card card swap.

## Amendment 1 (Henry, 2026-08-15): close the dead-card gate with the curve swap

The ship left ONE gate failing: skoll_v2 dead cards 36.9/38.2 vs <=0.35 (both seed bases).
Diagnosis accepted: curve shape, not power - three 2-cost cards on a 2e frame in 3.5-turn
games; round 2 proved power dials do not reach this number.

**Approved change (one swap, nothing else):** `skoll_v2` deck: `overdrive` x2 -> x1,
`fury_strike` x1 -> x2. Rationale: fury_strike is the only 1e attack that FEEDS the OS
(+1 Str = +15% on subsequent hits), so the lost nuke copy partially returns as fuel.
Predicted: dead ~33-34%, field mid-40s.

**Gates:** scoped BALANCE_ONLY=skoll, two seed bases on the dead-card number (it is the
gate being closed): dead <=0.35 BOTH bases, field 0.35-0.80, control >=0.60, FTK 0,
mirror bands. NO knobs - if the swap does not close the gate, STOP and report; the next
move (second swap vs formal waiver) is Henry's. vitest AFTER the edit; full npm run
balance; ONE commit; results appended here; HANDOFF refresh.


### Amendment 1 results (2026-08-15) — THE GATE IS CLOSED, all bands green

Registry `1:998a835e` → **`1:b76809c9`**. The one approved swap was applied and nothing else;
no knobs, per the amendment.

**skoll_v2 dead cards: 36.9 / 38.2% → 32.5 / 32.8%.** Under 0.35 on BOTH seed bases, which is
the gate the amendment existed to close.

| metric | before A1 (A / B) | **after A1 (A / B)** | band |
|---|---|---|---|
| **dead cards** | 36.9 / 38.2% ❌ | **32.5 / 32.8%** | ≤0.35 ✅ |
| field | 51.0 / 50.1% | **44.9 / 41.5%** | 0.35-0.80 ✅ |
| control | 85.0 / 83.3% | **71.7 / 74.6%** | ≥0.60 ✅ |
| FTK | 0 | **0** | 0 ✅ |
| mirror | 2.5-2.7t, 93-97% dec | **2.6-2.7t, 92-93% dec** | ≥60% ≤30t ✅ |
| first-mover | −7.1 / −12.1% | **+1.8 / −10.0%** | \|edge\|<20 ✅ |

**skoll_v1 is untouched and confirms it** (nothing in the swap reaches her): field 47.7 / 48.1%,
control 100 / 100%, dead 29.7 / 29.6%, mirror 3.6-3.7t at 100% decided, FTK 0.

**The amendment's prediction was accurate.** It called dead ~33-34% and field mid-40s; measured
**32.5 / 32.8%** and **44.9 / 41.5%**. The cost of closing the gate was **~6-8 field points and
~10-13 control points** on v2, both of which it had to spare.

**8-DIFF: 4 rows of 67 moved, 63 bit-identical.** `control-vs-skoll_v2` 18.2 → 35.4 (the control
does better against a v2 that traded a nuke for fuel — expected), `os:skoll` 0.30 → **0.2778**,
plus the two `control-overall` aggregates at +1.0 and +0.5. **No other species moved by any
amount.** §1.3 unchanged at 38; redlines hold at 49.

Gates: scoped `BALANCE_ONLY=skoll` clean, `tsc -b` clean, **820 passed / 61 files** (suite AFTER
the edit), `vite build` clean, full `npm run balance` re-run.

**Ticket 64 now closes with every gate GREEN on both decks.**
