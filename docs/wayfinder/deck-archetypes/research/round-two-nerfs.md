# Round two of nerfs (ticket 81): hel's healing, and the next three

Henry's call on hel plus the three decks that rose to the top after ticket 80. Diagnosed and
shipped together. Baseline `c0a372b`, measured on the full 960-cell grid at 30 iterations.

| deck | before | after | change |
|---|---|---|---|
| `hel_v2` | 71.0% | **55.9%** | **healing bonus +50% removed** |
| `hraesvelgr_v2` | 75.2% | **64.7%** | UPDRAFT_KERNEL waits for the **2nd** deck cycle, not the 1st |
| `ymir_v1` | 77.1% | **69.6%** | GLACIER_HEART gives **4** Bark Shield a turn, not 5 |
| `valkyrie_v2` | 70.3% | **63.8%** | REBIRTH_CYCLE hits and heals for **12**, not 15 |

**Every change is an OS change. No card, deck list or stat was touched.**

## 0. Hel's healing bonus - you were right, and it was worse than a bonus

Yes, UNDERWORLD_GATEWAY's third clause was *"Her healing is increased by 50%."* Your read was
exactly right: **it is what stopped HP-as-a-cost working.** A heal that out-earns the blood price
turns the cost into a loan, and ticket 80 measured the consequence directly - removing her turn cap
made her *stronger*, because uncapped she could borrow faster than the price could charge.

Removed entirely (1.5 -> 1.0). Her heals now alleviate the self-damage instead of erasing it:
`dawns_respite` costs 12 HP in blood and heals 12, for a net of exactly zero.

**71.0% -> 55.9%**, a bigger drop than the -12.7 the isolated arm predicted, because the other
three nerfs landed at the same time. She is now 12th of 32 with **zero 0% cells, one 100% cell and
five out-of-band matchups** - one of the cleanest profiles on the roster.

The softer option measured 58.3% (bonus reduced to 1.25 rather than removed) if you want her back
up a little.

### Your note, saved for next time

> *"we don't want cards that are healing and end up doing nothing because she takes more damage
> than it heals, so the heals would have to all be riders... that change might allow us to lift the
> cap."*

Recorded in `METHOD.md` and `HANDOFF`. Her three standalone heals today are `pale_mercy` (0e, heal
14), `dawnstrike` (1e, 15 power + heal 20) and `leech_strike` (2e, 40 power + heal 30) - so two of
the three are **already riders**; `pale_mercy` is the pure heal. Converting that one and re-testing
with the cap lifted is a clean follow-up, and the cap machinery is still in place for exactly that.

## 1. `hraesvelgr_v2` - the OS was worth +64 points

**UPDRAFT_KERNEL:** the first time you cycle your deck, permanently gain +1 max Energy.

**OS off: 74.6% -> 10.2%.** That is the largest OS contribution measured anywhere on the roster.
The reason is `thermal_lance`, which scales on **Energy spent SQUARED** - so a third Energy point
is not 50% more, it is 2.25x. Her payoff card goes from a median 20% of a health bar to 27%, and
`firestorm_talon` from 0.09 casts a game to 0.48.

**How easy was it?** An 8-card deck carrying four draw cards (`tailwind`, `slipstream`,
`zephyr_strike`, plus `sun_eaters_plunge`) cycles almost immediately - the permanent upgrade landed
around turn 2.

**Fix: it now waits for the second cycle.** Exactly the "add a condition so it triggers less" shape -
the OS is unchanged in kind, it just has to be earned twice over. **-10.4 points**, and her
100%-cells go 1 -> 2 while her out-of-band count drops to 6, the third-cleanest deck in the game.
(Three cycles measured 55.2%, which overshot.)

## 2. `ymir_v1` - the OS is the engine that feeds the uncapped scaler

**GLACIER_HEART_SYS:** +5 Bark Shield at the start of every turn, unconditionally.

This is the third instance of the shape we keep finding, and the worst version of it: `avalanche`
is **9 power per Bark Shield stack, explicitly uncapped**, and the OS hands her the stacks for free
forever. `frost_ward` x2 (0e, +3) and `rimeguard` x2 (1e, +5) are on top of that.

**Measured: she holds a mean 9.9 Bark Shield when she casts `avalanche`** - and only 5.1 with the
OS off. The OS roughly doubles the pile, which doubles the payoff.

| | with OS | OS off |
|---|---|---|
| field | 77.8% | **22.1%** |
| `avalanche` casts a game | 2.62 | 1.50 |
| first cast | turn 3.0 | turn 5.0 |
| damage, median / max | 30% / **81%** | 13% / 56% |

**Fix: 5 -> 4 Bark Shield a turn.** Since caps are off the table, the lever is the engine's rate,
and it is the gentlest possible version - the OS still does exactly what it says. **-7.5 points.**
3 a turn measured 54.8%, which overshot badly; cutting `avalanche` to 7 power measured 65.9% but
that is a card change and this is not.

**She is still the deck with the most 100% cells (5).** The uncapped scaler is untouched and it is
still the roster's most extreme magnitude - `avalanche` can take 81% of a health bar in one card.
If she needs another pass, that rate is where it should go.

## 3. `valkyrie_v2` - free damage and free sustain, every turn

**REBIRTH_CYCLE_OS:** whenever her discard shuffles back, hit a random enemy for 15 and heal 15.
Once per turn.

**OS off: 70.5% -> 36.0%**, and - unusually - **her payoff cards barely move** (`starfall` 14% ->
13% median). The OS is not enabling anything; it is simply **free damage plus free sustain on a
thin 8-card deck that reshuffles nearly every turn**. The once-per-turn guard added in ticket 53
was already flagged in HANDOFF as awaiting review; it is the only thing keeping this bounded.

**Fix: 15 -> 12 on both halves.** -6.5 points. Dropping the heal entirely measured 56.0% and 8
measured 51.7%; both overshot, and dropping the heal changes what the OS *is*.

## 4. Roster effect

| | before | after |
|---|---|---|
| absolute 0% cells | 71 | **64** |
| absolute 100% cells | 70 | **63** |
| NEUTRAL absolutes (0 / 100) | 26 / 26 | **21 / 20** |
| band violations | 369 (38.4%) | **357 (37.2%)** |
| FTK | 2 | 2 |
| redlines | 55 | **53** |

Two section-2.3 redlines cleared: `os:hel` 32% -> 44% (gap 18 -> 6, now inside the 15% threshold)
and `os:hraesvelgr` 34% -> 43% (16 -> 7).

**The top of the ladder is now flat.** Six decks sit between 64.7% and 70.3% where two tickets ago
the leader was 81.4%:

| | |
|---|---|
| nidhoggr_v1 | 70.3% |
| audhumbla_v1 | 70.1% |
| ymir_v2 | 69.9% |
| nidhoggr_v2 | 69.7% |
| ymir_v1 | 69.6% |
| hraesvelgr_v2 | 64.7% |

8-DIFF: 7 of 67 rows, all in the four affected species. Unit suite **843/843**.

## 5. What is left

1. **`fenrir_v1` at 24.9% with 12 zero cells and 22 of 31 out of band** is now by far the worst
   deck in the game and the biggest single source of blowout cells. It has never had a pass and it
   is the obvious next job - the roster's remaining band violations are concentrated at the bottom
   now, not the top.
2. **`audhumbla_v1` has risen to 70.1%** without being touched, purely from everything around it
   being cut. Worth a look before it becomes the next offender.
3. **`avalanche`'s uncapped rate** survives this pass. 81% of a health bar from one card is still
   the largest single hit measured anywhere.
4. **`ymir_v1` still carries 5 cells at 100% and 15 out of band** - the most of any deck in the top
   six. Her field number is fine now; her *spread* is not.
