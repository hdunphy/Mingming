# Fenrir's berserker diagnostic + sleipnir_v2's buff (ticket 83)

- Type: wayfinder:task - Henry-directed, 2026-08-18.
- Status: **closed** (2026-08-18). One change shipped, one report returned for Henry's pick.

## Shipped: `sleipnir_v2` 33.7% -> **42.4%**

`hoof_strike`, the 0-cost token WAR_STEED_OS generates, **12 -> 15 power**. Nothing else touched -
the token exists only as the OS's payload and is in no deck list.

Roster: absolute 0% cells **51 -> 50**, NEUTRAL 0% **14 -> 13**, out-of-band cells **317 -> 306**,
100% cells unchanged at 54, FTK unchanged at 2. **All 32 decks are now inside the 35-80 field band
for the first time.** `sleipnir_v2` herself: 1 zero cell -> **0**, out-of-band 10 -> **5**, one new
100% cell. 8-DIFF **one row of 67** - `os:sleipnir`, the intended one. 843/843 tests.

### Why the token, and what else was on the table

OS-off costs her **12.5 points** (32.4% -> 19.9%) and **0.74 cards a turn** (2.31 -> 1.57), so
WAR_STEED is her card economy. What it was not was damage: her payoffs land for a **median 13%**
(`lance`) and **22%** (`cavalry_charge`) of a health bar, the smallest payoffs measured in any of
these passes, and the token itself was 12 power. Raising the token raises the OS's whole output
without touching a card in the deck list.

Measured, at 15 iterations unless noted:

| arm | field | 0% cells |
|---|---|---|
| live | 32.4% | 9 |
| OS off | 19.9% | 12 |
| `anyair` - the OS pays on any Air card, not just attacks | 34.0% | 8 |
| swap `tailwind` -> `carrion_swoop` | 32.8% | 8 |
| swap `tailwind` -> `trample` / `gale_slash` | 36.3 / 36.4% | 7 |
| swap `tailwind` -> `dust_devil` | 40.2% | 2 |
| **`hoof_strike` 12 -> 15** (shipped; 30 iters) | **42.4%** | 2 |
| swap `tailwind` -> `war_molt` (30 iters) | 45.9% | 1 |
| `hoof_strike` 12 -> 20 | 57.5% | 1 |
| swap `tailwind` -> `feather_cache` | 59.0% | 0 |
| two tokens per trigger | 69.4% | 0 |
| swap `tailwind` -> `sky_burial` | 70.0% | 0 (**8 cells >90%**) |

### The finding underneath it, held for Henry

**`sleipnir_v2` is a discard deck with no discard payoffs.** `lance` discards 1 and
`cavalry_charge` discards 2, at random - and not one card in her list rewards being discarded,
while the Air pool has four that do: `war_molt` (+2 Strengthened), `feather_cache` (+1 Energy),
`sky_burial` (rises 15 -> 30 -> 45), `carrion_swoop` (11 power per card discarded). Wiring even one
in is worth **+13 to +38 points** - `sky_burial` alone took her from worst-deck to 70%.

`tailwind` is the card that does not fit: **47% dead, 34% played, zero damage** - a draw card on a
deck whose OS already fills the hand. Swapping it for `war_molt` measured 45.9% and one zero cell.
**Not shipped: deck-list changes are Henry's review**, and `war_molt` borrows the Strengthened
package that is `sleipnir_v1`'s identity. The token buff needed neither.

## Reported, not shipped: fenrir_v1 is a berserker whose price was never paid

Full write-up: [research/fenrir-berserker.md](../research/fenrir-berserker.md). Henry's question was
whether the deck failed to reward the recoil. It did, and two other things did too.

1. **Half the deck fights the plan.** Four of nine cards pay for being hurt (`ragnarok_edge` x2,
   `berserk_rush` x2); four pay for being healthy or heal you back over the threshold - including
   **`blood_rite` x2, which below 50% HP loses half its damage and heals you**, the payoff running
   in reverse on her most common card.
2. **The recoil is one HP and always was.** `max(1, floor(66 * 0.02))` = 1, and 1% floors to the
   same 1. Across a game it supplies ~8% missing HP, worth **+5.6 power** on `ragnarok_edge` -
   **the OS sold ~5.5 HP of her health for ~1.9 HP of damage**, and `berserk_rush` needs 50%
   missing, so the OS never switched that card on at all.
3. **The AI is built to leave the state she wants.** `getEntityScore` prices HP concave (85%
   sqrt, ticket 27) *because of this deck* - the comment names it. Below half health the pilot is
   most desperate to heal, and this deck hands it three ways to do it.

**The fix Henry guessed at works, in exactly one shape.** A *flat* "+20% to Fire attacks" measured
**34.8%**, below the shipped build. The *same bonus scaled by missing HP* measured **40.1%** with
the original recoil and Strengthened restored, and halved her zero cells:

| arm | field | 0% cells |
|---|---|---|
| shipped (ticket 82: no recoil, 3 Strengthened) | 36.2% | 11 |
| original OS + **flat** +20% Fire | 34.8% | 12 |
| **original OS + Fire bonus scaled by missing HP (50%)** | **40.1%** | 6 |
| same at 60% / with 2 Strengthened / at 75% | 44.7 / 46.9 / 52.4% | 5 / 4 / 3 |
| ticket-82 OS + scaled bonus 50% | 56.0% | 3 |
| original OS + recoil raised to 8% | **20.2%** | 19 |
| `blood_rite` branches flipped | 35.2% | 10 |
| swap `ember_mend` -> `bloodlust` / a new `feral_bite` | 35.9 / 36.5% | 11 / 12 |

**Three things worth keeping:** the price cannot grow (8% recoil collapses her to 20.2% - on the
smallest frame in the game the self-damage has to stay near zero and the missing HP has to come
from the enemy); card changes do nothing alone (the `blood_rite` flip behaves exactly as designed -
more payoff casts, longer games - and moves the field -1.0); and a **new 0e card that spends HP on
purpose was a dud**, because the concave HP scorer will not pay for it. **A voluntary HP cost needs
an AI change, not a card.**

Henry picks the dial; my recommendation is the faithful one at 40.1%, which restores
UNBOUND_KERNEL's original text word for word and adds the clause that pays for it.

## Next

1. **`fenrir_v1` is the floor again at 35.5%** - the ladder above is ready to ship on his word.
2. `tailwind` -> a discard payoff for `sleipnir_v2`, if he wants the deck-list version (+3.5 over
   what shipped).
3. `hoardbreaker`, `ember_mend`, `avalanche`'s uncapped rate all still open from tickets 81-82.
