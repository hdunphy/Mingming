# Audhumbla_v2 rebuild - REGEN AS AMMO (ticket 101, design concept - Henry-picked 2026-08-19 car session)

- Type: wayfinder:design - NOT implementation-ready; numbers session (Henry + designer) at
  keyboard, AFTER ticket 95's status shape ships. Branch archetype-web.
- Status: **CLOSED 2026-08-20** - shipped, measured, reported. 862 tests, tsc + build clean.

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

---

# Resolution

Report: [research/regen-as-ammo.md](../research/regen-as-ammo.md). ONE commit.

**Header note for whoever reads this next: the "NOT implementation-ready / numbers pending" line at
the top was superseded by the NUMBERS RULED section below it.** Everything was specced.

## Shipped

- **`PRIMORDIAL_MILK`** replaces NOURISH_ROUTINE: *"Every heal card Audhumbla casts also grants her
  **3** Regen."* (ruled 2, shipped at the ruled knob value 3 - see the arm table.)
- **`morning_dew`** - **2e** Light Skill, *"Gain 5 Regen."* (ruled 1e/4; 1e is IMPOSSIBLE - see
  pricing.)
- **`drink_deep`** - 2e Light Attack, *"Consume all your Regen and deal 15 Light damage per stack."*
  `sun_devourer`'s machinery pointed at Regen, at the ruled 15/stack.
- **Deck (A4, nine cards, four dealers):** `pale_mercy`, `healing_light`, `sacred_spring`,
  `morning_dew`, `drink_deep`, `smite`, `radiant_spark`, `dawnstrike` x2. **`purify` leaves.**

## THE HEADLINE: ROSTER-WIDE NEUTRAL ABSOLUTES 30 -> 15

| | before | after |
|---|---|---|
| **her blowouts** | **8** | **0** |
| **ROSTER-WIDE neutral absolutes** | **30** | **15** |
| field | 39.9% | 47.1% |
| her game length | 8.67 turns | 7.04 |
| dead cards | 6.5% | 18.9% |

**The roster's absolute count HALVED off one deck.** She owned eight outright and each was also a
100% row on someone else's line, so removing her eight removed fifteen. Ticket 94 measured her as
owning 13 of the roster's 20 absolutes and diagnosed "no clock"; she has one now. **This is the
single biggest improvement to roster health in the arc.**

## The arm, chosen on the criterion Henry named

*"Ship the one that lands the band with the LEAST drink-dependence."* That needs a number, so
`scratch/drinkcensus.ts` measures `drink_deep`'s share of her damage in real games.

| arm + knob | field | drink-dependence | blowouts |
|---|---|---|---|
| A3 + OS 3 | 56.2% | 77.2% | 1 |
| A3 + drink 20 | 54.9% | 78.1% | 0 |
| **A4 + OS 3 (SHIPPED)** | **50.4%** | **67.9%** | 2 |
| A4 + drink 20 | 50.4% | 69.9% | 1 |

**The A4 arms are TEN POINTS less drink-dependent for the same field rate.** And raising the
BATTERY (the OS grant) rather than the PAYOFF (the drink's power) is the less drink-centric knob in
principle as well as in measurement - more Regen pays even in games where she never draws the drink.
Final measured dependence **67.6%**. Still high in absolute terms, and recorded as such: **she is a
one-big-turn deck by construction now.** If that plays badly the fix is a fifth dealer, not a knob.

## Scorer: the seed, and a card the pricer cannot see

**`ASSUMED_CONSUMED_STACKS[Regen] = 10`, MEASURED** (mean 9.73, median 9, p90 16, max 22 over 60
games). The ticket expected ~6; the battery fills faster because the OS grants 3 per heal card
against Regen's 1/turn decay. **Before seeding, the pricer had NO Regen entry and fell back to ONE
stack - it read `drink_deep` at 1.3 against a 5.2-6.5 band, a card it could not see at all.**

With the seed it reads **4.2 - still under band, and shipped anyway.** Under-budget is not a
redline, and **the sim disagrees with the pricer while carrying 68% of her damage**. A card the
scorer calls under-costed while it does two-thirds of a deck's offence is a card the scorer is
under-reading. Raising it to 20/stack would price in band AND raise drink-dependence, which is the
thing the ticket says to minimise. Per the ticket's own instruction - *"do not chase its ledger
row."*

**`morning_dew` had to move to 2e.** At 1 Energy **even 3 Regen prices at 3.2 against a 3.0
ceiling** - the pricer values Regen as healing and 3% of a max-HP pool per turn is not cheap. At 2e
the band is 5.2-6.5 and 5 Regen lands at **5.4, in band**.

## Verified as the ticket asked: Regen decays 1/turn

Confirmed in `RegenBehavior.endTurn` - no engine change needed. **And a Regen stack is a TURN, not
an intensity** (ticket 34: flat 3% maxHP/turn, stacks = duration), so the pile is a DURATION being
hoarded and drinking trades "N more turns of 3%" for "15N power now". That also puts the OS grant on
a knife edge: **3/heal accumulates, 1/heal would exactly cancel the decay and bank nothing** - the
same edge ticket 34 found on huldra_v1 (2/play won 79%, 1/play won 1%).

## Gates

| gate | required | measured |
|---|---|---|
| band standard | 35-80 | **47.1%** (grid) |
| neutral blowouts | down | **8 -> 0 hers; 30 -> 15 roster-wide** |
| control | >=0.60 | **1.00** |
| FTK | 0 | 0 |
| dead cards | <=0.35 both sides | 18.9% |
| game length | down from ~11 | **7.04** |

Two `OSGapClosures.test.ts` tests re-pinned. **What they protect now matters MORE than before: the
OS must fire on a heal CARD and must NOT fire on an engine flat heal - because Regen's own
end-of-turn tick IS an engine heal, and if the OS read it the pile would feed itself forever.** The
`last_heal_power > 0` discriminator ticket 56 added for an unrelated reason is what makes this
rebuild loop-safe for free; the tests now pin that explicitly.

## Loose end for Henry

**`purify` is now unused by any deck.** Ticket 103 reworked it into her shed card; the rebuild
removes it. It sits in the registry carrying its +0.3 overage for nobody - revert it to printed, or
slot it back over a `pale_mercy`. Neither is urgent.
