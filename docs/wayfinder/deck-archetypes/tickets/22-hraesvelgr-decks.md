# Hraesvelgr per-OS decks (Air, second half)

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [21-sleipnir-decks](21-sleipnir-decks.md) (closed), [25-pace-completion](25-pace-completion.md) (closed - this deck could not pass under the old pace)

## Question

Hraesvelgr §2.3 was 0.09 on a legacy shared deck. v1 GALE_FORCE_OS (every voluntary discard
deals Air damage to a random enemy) becomes the discard WINDMILL; v2 UPDRAFT_KERNEL (first
full deck cycle grants +1 max Energy) becomes burn-X ramp. 70 HP / 85 attack glass cannon.

## Resolution

Landed 2026-08-07. Gates: 757 vitest, tsc, build, full committed balance.

### Why this took three attempts

The first implementation stopped: §2.3 stayed at 0.00 through a full knob round, and the real
blocker was **deadCardRatio 0.47-0.53 against a 0.35 band**. Two things had to change before
the archetype could work at all, and neither was a card number.

**1. The windmill's engine paid 3 damage a proc.** GALE_FORCE's hook is `power: 10`, which
after the rev-3.1 divisor is 3 damage against a 76 HP pool. Tempest discarded 2.93 cards for
**8.8 damage** - a whole 2-Energy turn for 12% of a health pool. And **Carrion Swoop was live
on 3.8% of decisions** (9 of 235): Tempest cost 2, which is the entire turn, so the enabler
and its payoff could never be cast together.

**2. The AI cannot see card advantage.** `evaluateState` scores HP and statuses only - a card
in hand, a draw and a point of unspent Energy are all worth exactly zero. Feather Cache's
original "when discarded: draw a card" was therefore worth *nothing* to the AI. **In this
engine a discard payoff must pay in damage, status or Energy - never cards.**

### The deck

**v1 GALE_FORCE_OS - discard windmill (12 cards).** Tempest dropped to **1e** so it can be
cast alongside a payoff; Feather Cache's on-discard reward became **+1 Energy** (visible to
the AI, unlike draw); and **Sky Burial** is the Apocalypse card Henry asked for - discard it
and a stronger copy rises in hand, three tiers deep, with zero engine work (each tier's
`discardEffect` generates the next).

    feather_cache x2, war_molt x2, sky_burial x2, tempest x2, carrion_swoop x2,
    zephyr_strike, slipstream

**v2 UPDRAFT_KERNEL - burn-X ramp (8 cards).** Unchanged in shape. **Thermal Lance is LINEAR,
35 x X, per Henry's call** - at X=3 that is 105 power, exactly the 3e budget. The quadratic it
replaced (20 x X^2 = 180 at X=3) is the same ramp-is-fastest problem the exponential power
curves showed at registry scale (power_curve_spec rev 3.2, finding 1).

    sun_eaters_plunge, thermal_lance, firestorm_talon, cinder_gust x2,
    tailwind, slipstream, zephyr_strike

### Engine work

- **`DISCARD` cost form** (built in ticket 21, extended here) and **X-cost** (`"baseCost": "X"`
  costs all current Energy, minimum 1, resolved in `getEffectiveCardCost` - which the reducer,
  the TacticalAI search and the UI cost pip all already call, so none of them needed
  special-casing).
- New scalings: `CARDS_DISCARDED`, `ENERGY_SPENT`, `ENERGY_SPENT_SQUARED`, `BURN_TIMES_ENERGY`.
- **`gust_jab` retired** into Tackle. Its one non-doc reference was the ticket-07 WAR_STEED
  token-guard fixture, swapped to `dust_devil` (same trigger, same intent).

### The dead-card metric was wrong, and this ticket fixes it

`runOne`'s own comment said it: *"A card discarded or exhausted by an effect stays in `seen`
and out of `played` - it sat in hand unplayed, which is the metric."* **A discard archetype
throws cards away on purpose, so every discard read as a dead card.** Same deck, same
everything: one Tempest read 17-22% dead, two read 36%.

The DISCARD mutation now tags what it sheds (`IBattleState.discardedByEffect`, entries
`SIDE:entityId`) and the harness excludes those from the dead-card count. **hraesvelgr v1 went
from 36.2% to 3.1%** - the deck was never the problem. This also corrects sleipnir v2,
whose WAR_STEED tokens were being counted the same way.

The first attempt at this fix - treating any card that reached the discard pile as shed - read
~0% for every species, because unplayed cards also reach the discard pile through normal
cycling. The tag is what makes it correct.

### Tempest variants tested

All four measured on the same deck, corrected metric:

| Tempest | §2.3 | mirror turns | deadCards |
|---|---|---|---|
| **discard hand, draw 2 (shipped)** | **0.32** | 3.3 | 3.7% |
| discard hand, draw 1 | 0.11 | 4.3 | 2.9% |
| discard 2, draw 2 | 0.15 | 3.8 | 9.4% |
| 30 power attack + discard 2 | 0.19 | 3.7 | 8.8% |

**The refill is the card, not the discard.** Cutting the draw from 2 to 1 costs 21 points of
§2.3; capping the discard at 2 costs 17. Every variant bought 0.4-1.0 turns of pace and paid
more than it was worth. The original stands.

### Numbers

| | §2.3 | mirror turns | mirror decided | deadCards v1/v2 | ftk |
|---|---|---|---|---|---|
| band | 0.30-0.70 | <=30 | >=60% | <=0.35 | 0 |
| **shipped** | **0.320** | 3.26 | 400/400 | 0.031 / 0.527 | **0** |

Known deviation: **the mirror runs 3.26 turns against a registry floor of 3.8** - v1 is the
fastest deck in the game. Trimming Sky Burial Ascended 45 -> 30 buys 0.2 turns but costs 12
points of §2.3, and dropping to one Tempest buys 1.1 turns for 22 points. Left fast
deliberately: it is a glass-cannon combo deck and the alternatives all fail §2.3.

Also left open: v2's strength is no longer Thermal Lance. Cutting it 35 -> 24, a 31% cut,
moved §2.3 by 3 points - the damage has spread to Sun-Eater's Plunge and Burn. If v2 needs a
nerf in the deep pass, that is where to look.

### Open breach: v2's dead-card ratio is 0.527

v1 is now **0.031** - the metric fix resolved it entirely. v2 is not fixed and is not a
metric artifact: it is an **8-card deck at `cardDraw: 4` on 2 Energy** that wins in ~3 turns,
so it draws its whole list and casts about six cards. This is the species-level mismatch
flagged since the first attempt - **hraesvelgr sees roughly twice what it can ever pay for**,
and no deck built for that frame will pass a per-side dead-card band.

Shipped with the breach documented rather than papered over. The honest fixes are a species
change (`cardDraw` 4 -> 3) or a band that accounts for draw rate, both out of scope here.

### Registry-wide

Registry `1:fc966db1`, 132 cards audited (was 122 - the 10 new Air cards). Card redlines
28 -> 34, matchup 20. **FTK 0 registry-wide.** Sleipnir also improved from the metric fix:
its v2 dead-card ratio fell 0.264 -> 0.153 once WAR_STEED's discarded tokens stopped counting.
