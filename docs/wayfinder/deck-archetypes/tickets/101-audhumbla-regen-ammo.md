# Audhumbla_v2 rebuild - REGEN AS AMMO (ticket 101, design concept - Henry-picked 2026-08-19 car session)

- Type: wayfinder:design - NOT implementation-ready; numbers session (Henry + designer) at
  keyboard, AFTER ticket 95's status shape ships. Branch archetype-web.
- Status: **open (concept ruled, numbers pending)**

## The concept (Henry's pick over triage-mode and overheal-banking)

The cow drinks her own milk. **OS: Audhumbla's heals OVERFLOW into Regen** - every heal she
casts also grants Regen stacks (rate TBD, ~1 per 25 printed heal power) - so healing is
never wasted at full HP. **The decision lives in CARDS per Henry's ruling** (cards carry
choices, the OS tilts rates): a payoff card consumes ALL her Regen at ~15-20 power per
stack (ash_communion/sun_devourer machinery, pointed at Regen). Hold = sustain ticks;
drink = the kill window. State-dependent by construction - the fafnir hold-or-cash shape.
NOURISH_ROUTINE's passive 50% conversion RETIRES with the rebuild.

## Checks

- Two-lever law: Regen burst (lever 1) + plain Light damage suite (lever 2). PASS.
- Statuses-as-resource per Henry's correction: Regen IS the second axis, already in the
  engine, owned by no other deck. Sibling separation from v1 GENESIS (overheal->energy):
  this is heal->Regen->damage, different trigger, different payoff.
- Fixes ticket 94's finding (she has no clock - 13 of 20 remaining absolutes) AND Henry's
  playtest (no choices).

## Numbers session agenda (keyboard, post-95)

Regen-per-heal-power rate; drink rate/stack; Regen cap (lean UNCAPPED per the new status
philosophy - aggression is her natural counter, forcing the milk into survival); deck list
(which heals stay, the payoff card x1 or x2); scorer note (STATUS_CONSUMED Regen constant
needs a measured seed); gates per band standard.

## NUMBERS RULED (Henry, 2026-08-20) - IMPLEMENTATION-READY

- **OS** (replaces NOURISH_ROUTINE, keep id audhumbla_v2): *"Audhumbla's heal cards also
  grant her 2 Regen."* Regen decays 1/turn (verify the engine does this; if not, add it -
  the decay IS the drink-window pressure).
- **New card** `morning_dew` | 1e Light Skill | *"Gain 4 Regen."* (the battery)
- **New card** `drink_deep` | 2e Light Attack | *"Drink deep: consume all your Regen and
  deal 15 power per stack."* (ash_communion/sun_devourer consume machinery -> Regen;
  15/stack matches sun_devourer for consume-price consistency)
- **Deck**: her heal suite + morning_dew + drink_deep + PLAIN LIGHT ATTACKS - and the
  attack COUNT is a composition ARM per Henry ('it felt hard to deal damage last time'):
  run arms at 2 / 3 / 4 damage dealers (smite / radiant_spark / dawnstrike pool) and ship
  the one that lands the band with the least drink-dependence.
- **Knobs (max 2 rounds, one change per sim):** OS grant 2 -> 1 or 3; morning_dew 4 -> 3
  or 5; drink_deep 15 -> 10 or 20.
- **Scorer**: seed ASSUMED_CONSUMED_STACKS[Regen] from the measured drink pile (expect ~6);
  report static vs measured for drink_deep, do not chase its ledger row.
- **Gates**: band standard (neutral cells), control >=0.60, FTK 0, dead <=0.35 both sides,
  game length DOWN from ~11 turns (the clock existing at all is the headline), two seed
  bases near any line. SS2.3 vs v1 diagnostic-only. ONE commit + Henry playtests the feel.
