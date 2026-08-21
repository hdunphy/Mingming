# Resource conversion: what a card does when its resource is meaningless

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: [36-hel-decks](36-hel-decks.md) (closed - this is its follow-up)

## Question

hel_v2's UNDERWORLD_GATEWAY zeroes her card costs and charges HP instead, which makes Energy a
dead stat for her. Two classes of card then have no meaning in her deck: cards that **grant**
Energy, and **X-cost** cards that price themselves off Energy spent. Neither is in either Hel
deck, so the first-pass gate never sees them - but the collection is shared across all 16
species, so both can reach her as run drops. What should they do?

## The design law (Henry, 2026-08-07)

**A card that does nothing for an OS should do something ELSE, never nothing.**

A card that is dead in one OS is not a neutral non-choice - it is a trap the player learns by
wasting a pick. Conversions are a discovery; blanks are a bug. **Any future OS that changes or
removes a resource inherits this obligation: name what the orphaned resource becomes.** This is
now principle (4) in the map's design-principles note.

## Decision 1 - Energized converts to healing

**Cheaper than expected: no new trigger.** The pool's energy cards do not use the `ENERGY`
action at all - they apply the **`Energized` status**: `capacitor` (2 stacks), `lumen_surge`
(1), `photosynthesis_v2` (1). So the conversion hangs off `onStatusApplied`, which already
exists. One hook:

    { "trigger": "onStatusApplied", "priority": 40,
      "when": { "source": "SELF", "target": "SELF", "statusApplied": "Energized" },
      "do": [ { "type": "HP", "target": "SELF", "percentMaxHP": 7.5 } ] }

**Rate.** The true inverse of her toll is +5% maxHP per Energy point. But `capacitor` applies 2
stacks in a SINGLE application event and there is no stacks-applied scaling key, so a per-event
heal pays the same for a 1e and a 2e card - the CINDER_WALL per-event-vs-per-stack problem
again. Two ways to resolve it:

- **Flat +7.5% per event** (6 HP either way at her 80 maxHP): slightly generous to
  `photosynthesis_v2`, slightly stingy to `capacitor`, zero engine work. Recommended.
- **Add a stacks-applied scaling key** so the heal is the exact inverse at 5%/point. Correct,
  but it is a new scaling key for one card's worth of precision.

## Decision 2 - X-cost

### Correction to the ticket-22 note

`thermal_lance` ships as **`35 power x ENERGY_SPENT`** - LINEAR. Henry's ticket-22 override of
`20 x X^2` is not what is in the card data. `firestorm_talon` is `15 x BURN_TIMES_ENERGY`, also
linear in Energy. This matters because the quadratic form was the only reason to fear a
player-chosen X.

### Because it is linear, player-chosen X is safe

At 5% maxHP per point on an 80 maxHP frame, 35 power of card costs 15 power of HP:

| X | damage | HP paid | power paid | ratio |
|---|---|---|---|---|
| 2 | 70 | 8 | 30 | 2.3x |
| 3 | 105 | 12 | 45 | 2.3x |
| 5 | 175 | 20 | 75 | 2.3x |

Flat at every X, against 2.0x for her ordinary cards. **It self-limits on life** and needs no
cap.

### But the live failure is silent, and worse than a crash

X-cost power scales off `ENERGY_SPENT`, and under UNDERWORLD_GATEWAY Hel spends **no** Energy.
`thermal_lance` therefore resolves to **zero damage** - a card that plays, costs life, and does
nothing. Not a crash, not visibly dead: exactly the trap the design law above exists to prevent.

Separately, `BASE_COST` scaling returns the raw `programData.baseCost`, which for an X-cost card
is the **string `'X'`** - so the HP toll computes `NaN`. `numericBaseCost()` (ticket 22) is the
fix.

### Two options

- **X = her `maxEnergy`** (2). One line, safe, predictable. Henry's "set it to a 2 or 3 cost
  card".
- **X = player-chosen HP.** Viable now that the scaling is linear, and much the more
  interesting mechanic - but it needs a real interaction (a prompt for how much life to spend)
  plus an AI policy for choosing X. A deliberate feature, not a patch.

## Found while checking - unrelated to the above

**hel_v2's HP toll and its description disagree.** The shipped hook is
`"percentMaxHP": -10` while the OS description still reads *"drains 5% of her max HP per
point"*. The balancer's knob-4 range was -2.5 to -10, so 10% looks like a deliberate tune with
the description string left behind - the same stale-text class as the ticket-24 sweep. **Double
the intended cost is also a very different card economy** (a 2.7x advantage becomes 1.3x), so
confirm which number is intended before anything else is built on it.

## Not in scope

Neither conversion is needed for any shipped deck. This ticket exists so the decision is
recorded before a future OS hits the same question - fafnir_v1 (HOARD_PROTOCOL banks unspent
Energy) and gullinbursti_v1 (UNSTOPPABLE_MASS discounts costs) are the next two that touch the
Energy economy, and both settle in the Earth pass.
