# hel_v1 diagnostic (ticket 75): the stances are up at the wrong time

Report-only. Baseline `2c09625` (post ticket 74). Instrument: `scratch/helstance.ts` - nothing
recorded which stance she was in, so the tracker was the build. 12 iterations x both turn orders
x 15 opponents; **6,618 of her actions** sampled. `hel_v2` run identically as a control.

## Headline

**Her OS works. It is just pointed the wrong way round.**

TWILIGHT_CADENCE gives **+30% damage DEALT in Dark stance** and **-30% damage TAKEN in Light
stance.** Measured:

| | Dark stance | Light stance | neither |
|---|---|---|---|
| damage she **DEALS** | **43.3%** | 54.2% | 2.5% |
| damage she **TAKES** | **66.3%** | 25.1% | 8.6% |

She deals the majority of her damage from **Light** stance, which has no offensive effect, and
takes two-thirds of her damage in **Dark** stance, which has no defensive one. **Both halves of
the OS are up at the wrong moment, and that is structural, not bad luck.**

The mechanism is the end-of-action rule. Stance is set by the element of the card she just cast,
*after* it resolves:

- She casts a **Dark** attack -> she is now in **Dark** -> **the opponent's turn happens** -> she
  eats it with the offensive stance up and the defensive one down.
- She casts **`pale_mercy`** (0e Light heal, her second-most-played card at 33.1%) -> she is now
  in **Light** -> her next action is an attack -> she swings with the defensive stance up.

The rhythm that pays is Light-then-attack for defence and Dark-then-attack for offence, and those
two are mutually exclusive on a single card sequence. **She cannot hold the right stance for both
phases of the same round.**

## Things that are NOT wrong, and the ticket said to check them

**The stance genuinely toggles.** Dark 58.6% of her actions, Light 35.3%, neither 6.1%, and the
stance CHANGED between consecutive actions **42.5%** of the time. The OS is live and the AI is
alternating - it is not sitting in one stance.

**`eclipse`'s +30 lands, and my prediction in the ticket was wrong.** I flagged it as likely
self-defeating: a Dark card whose bonus requires Light stance. Measured, **582 of 702 casts
(82.9%) were made in Light stance.** The AI sequences it correctly and the bonus is earned.

It is a bad card anyway: **19.0 average damage** for 2 Energy off 70 power, against
`shadow_claw`'s 0 Energy. Her most expensive card is her worst rate. That is a card-pricing
finding, not the OS finding I expected.

**Dead cards are not her problem** (the brief's premise, corrected in the ticket). Her play rates:

| card | x | cost | played / seen |
|---|---|---|---|
| shadow_claw | 2 | 0e | 36.7% |
| water_slap | 1 | 0e | 36.1% |
| pale_mercy | 2 | 0e | 33.1% |
| eclipse | 1 | 2e | 32.2% |
| nights_bite | 2 | 1e | 24.8% |
| lumen_surge | 1 | 1e | 16.4% |
| hamstring | 1 | 1e | 14.9% |
| **purify** | 1 | 1e | **6.3%** |

One dead card, `purify`, and it is dead in a specific way: played **93** times against decks that
apply Poison or Burn and **102** times against decks that apply neither. It is not being held as
an answer - it is being played at random when nothing better is castable. An answer card that
does not read the question is a blank.

## What is actually killing her: throughput, not efficiency

Net damage per turn against all 15 opponents, worst first:

| opponent | win | dealt/turn | taken/turn | NET |
|---|---|---|---|---|
| gullinbursti | 0% | 5.73 | 10.33 | **-4.61** |
| ymir | 0% | 5.22 | 11.94 | **-6.72** |
| nidhoggr | 0% | 12.09 | 17.78 | -5.69 |
| huldra | 4% | 8.13 | 11.77 | -3.63 |
| kraken | 8% | 11.84 | 18.61 | **-6.77** |
| audhumbla | 17% | 18.29 | 16.87 | +1.41 |
| skoll | 21% | 16.61 | 19.60 | -2.99 |
| draugr | 21% | 13.30 | 13.95 | -0.66 |
| fafnir | 25% | 11.66 | 14.41 | -2.75 |
| valkyrie | 25% | 17.51 | 16.01 | +1.50 |
| jormungandr | 33% | 14.53 | 16.27 | -1.74 |
| sleipnir | 38% | 12.90 | 15.43 | -2.53 |
| hraesvelgr | 50% | 13.39 | 14.70 | -1.31 |
| fenrir | 58% | 15.37 | 14.36 | +1.02 |
| ratatoskr | 58% | 15.56 | 12.26 | +3.30 |

Negative against 11 of 15. But **net per turn is the wrong lens here, and the `hel_v2` control
proves it.**

`hel_v2` is the same species on the same 80 HP frame. She is **net-NEGATIVE against 9 of her 15
opponents** - including **-4.57 against kraken, whom she beats 92%** - and she is the roster's
joint-strongest deck at 81.4%. What separates them is raw throughput:

| | dealt/turn range | median |
|---|---|---|
| hel_v1 | 5.2 - 18.3 | ~13 |
| hel_v2 | 17.2 - 31.1 | ~25 |

**`hel_v1` puts out roughly half the damage per turn that `hel_v2` does from the same body.**
`hel_v2`'s UNDERWORLD_GATEWAY charges HP instead of Energy, so she casts freely; `hel_v1` is
capped at 2 Energy and spends most turns on 0-cost chip - `shadow_claw` is **5 power**. The
efficiency gap is second-order. The volume gap is the deck.

## Verdict

**hel_v1 is an OS problem first and a throughput problem second. It is not a dead-card problem
and it is not `eclipse`.**

1. **The stance rhythm is inverted** and no amount of tuning the percentages fixes it - +30/-30
   applied at the wrong phase is still applied at the wrong phase. This wants a mechanism change.
2. **Her 2-Energy pool on a 11-card deck cannot generate pressure.** Her top three cards by play
   rate are all 0-cost and two of them do 5 and 12 power.
3. `purify` is a blank and `eclipse` is overpriced for what it delivers.

## Questions for Henry

1. **Do you want the stance to set on CAST rather than at end of action?** Then a Dark card hits
   with +30% and a Light card raises the shield before the opponent swings - each card pays for
   its own stance. It inverts the current rhythm to the one the OS reads like it wants. It is
   also a real buff, so it wants measuring before shipping.
2. **Or should the stance persist through the opponent's turn and flip at end of ROUND?** Keeps
   the "commit to a stance" feel and fixes the defensive half only.
3. **`purify` -> something with pressure?** It is a 1-Energy blank in a deck that has no
   1-Energy pressure. Same slot could carry a Dark attack that feeds the rhythm.
4. **Is `eclipse` worth 2 Energy?** 19.0 average damage. If the answer is no, the 2-Energy slot
   may be better spent than fixed.
5. **hel_v2 at 81.4% with four neutral 100% cells is the worse gate failure** and is untouched by
   any of this. Do you want her paired into the same design session, given they share cards?

## Method notes

- 12 iterations x 2 turn orders per opponent. Stance sampled at the start of each of her actions
  (what the card she is casting benefits from) and again when damage lands (what was actually up).
- `appliesDoT` reads the opponent's real deck list for Poison/Burn actions, so the `purify` split
  is against decks that genuinely could be answered, not a guess.
- Win rates here are from a 12-iteration sample and are rankings, not verdicts (`0-DECISION-GRADE`).
  The stance and play-rate numbers are pooled over thousands of events and are solid.
