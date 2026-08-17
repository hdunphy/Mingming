# hel_v1 follow-up (ticket 77): Henry was right - it is the AI, and the bonus is too low

Henry, 2026-08-17: *"I'm thinking the hel issue is an AI problem. The idea of the deck is to
prioritize your cards and play damage dealers in a group then end with a light card to give you
extra defense. I don't think the AI is thinking about that... I'm not convinced it is an OS
problem yet. Maybe she needs a higher bonus, but I still like the mechanics."*

**He is right on both counts, and ticket 75's headline was wrong.** Instrument
`scratch/helturn.ts`, 12 iterations x both turn orders x 15 opponents, ~1,900 of her turns per arm.

## Retraction first

Ticket 75 concluded the OS was *"structurally inverted"* - that she cannot hold the right stance
for both phases of a round. **That is false.** The measured "66.3% of damage taken in Dark stance"
was equally consistent with a fine OS and an AI that never closes on Light, and I did not separate
the two before drawing a conclusion. Henry's line - group the damage, end on a Light card - is
exactly what the end-of-action rule enables. His point about the alternative is also right:
setting stance on CAST would give Dark attacks a flat bonus and make the defensive half
unreachable, because you are never being attacked during your own cast.

## The arms

Every arm except the first uses `reserve` - a policy that plays Henry's line: don't spend your
last castable Light card while a non-Light play is available, and close the turn on it.

| arm | field win | ends turn in Light | damage taken in Light |
|---|---|---|---|
| **1. live (the real AI)** | **23.9%** | 34.6% | 25.1% |
| 2. correct play (`reserve`) | **29.2%** | 60.5% | **48.3%** |
| 3. + Dark bonus 30% -> 50% | 39.7% | 61.6% | 49.1% |
| 4. + Light bonus 30% -> 50% | 45.8% | 60.8% | 40.1% |
| 5. + **both** 30% -> 50% | **56.4%** | 61.7% | 40.2% |
| 6. correct play, **purify removed** | **36.4%** | 59.7% | 46.4% |
| 7. correct play, eclipse at 1e / 20 power | 28.1% | 64.8% | 51.6% |

## 1. It IS the AI, and the miss is a specific one

Correct play moves her **23.9% -> 29.2%** and **nearly doubles the damage she absorbs in Light
stance, 25.1% -> 48.3%**. The symptom ticket 75 called an inverted OS disappears once the deck is
played the way it was designed. The OS is fine.

**Where the AI actually loses it is worth knowing before anyone fixes it.** She ends her turn out
of Light stance *while holding a castable Light card* on only **5.5%** of her turns - forcing just
that is worth about +1.7 points. The other ~60% of her turns end in Dark because **she has already
spent her Light cards earlier in the turn.** The AI's fault is not "declines to close on Light",
it is **"has no concept of end-of-turn state, so it spends its closer"**. A fix that only reorders
the last play recovers a third of the value; one that reserves the closer recovers all of it.

That is a `TacticalAI` change touching every deck, so it is **not shipped here** - see the
recommendations.

## 2. The bonus is too low, and the LIGHT half matters more

With correct play in place, raising the stance percentages from 30%:

- Dark alone to 50%: **+10.5 points**
- Light alone to 50%: **+16.6 points**
- Both to 50%: **+27.2 points, taking her to 56.4%**

**The defensive half is worth more than the offensive half**, which follows directly from correct
play: once she is closing on Light, roughly half her incoming damage is taken with the shield up,
so every point of that shield is being used. At 30% and the AI's current line it was a quarter.

`STANCE_BONUS` is now a knob in `core/Hooks.ts` (shipped in this ticket) instead of two literals
buried in `applyDamageModifiers`. It stays at 0.30 / 0.30 until Henry picks a number - 50/50 lifts
a deck from 24% to 56%, which wants his eye rather than mine.

## 3. `purify`: proven unnecessary, and it is actively costing her

Henry: *"I do think she might need purify for defense against poison/burn but lets prove it."*

**Proven, and the answer is no.** Swapping `purify` for a second `nights_bite`, everything else
held constant, is worth **+7.2 points (29.2% -> 36.4%)** - the biggest change in this ticket short
of the stance percentages.

The premise does not survive either. Against decks that actually apply Poison or Burn:

| | vs DoT decks | vs non-DoT decks |
|---|---|---|
| with `purify` | 30.8% | 28.3% |
| **without `purify`** | **36.7%** | 36.3% |

**She does better against the decks purify is meant to answer when purify is not in the deck.**
Ticket 75 already measured that it is not being held as an answer - 93 casts into DoT decks
against 102 into decks with no DoT at all. It is a blank occupying a slot and a card draw.

## 4. `eclipse`: correctly priced, and it is her best card

Henry: *"make sure it is accurately priced and is doing enough damage to be a 2e card. See what
happens if we make it 1e and price it accordingly. Why isn't it priced correctly - is the
conditional not living up to the extra damage?"*

**It IS priced correctly, and the conditional over-delivers.** Static score **6.10 against a
2-energy budget of 6.50** - slightly under. The scorer discounts a conditional action to 70% ("you
get the effect about 70% of the time"); measured, **the Light-stance bonus lands on 82.9% of
casts.** The conditional beats the assumption, so if anything eclipse is marginally *under*-priced
on paper.

Its 19 damage a cast looks poor in isolation. It is not poor in context - it is **her best card by
damage per energy by a factor of 1.5**:

| card | cost | plays | damage/cast | **damage/energy** |
|---|---|---|---|---|
| **eclipse** | 2 | 703 | 18.8 | **9.4** |
| nights_bite | 1 | 1,279 | 6.2 | 6.2 |
| hamstring | 1 | 483 | 3.5 | 3.5 |
| shadow_claw | 0 | 1,611 | 0.9 | 0.9 |
| pale_mercy / lumen_surge / purify | - | - | 0.0 | - |

The correctly-priced 1-Energy version (20 power, +15 in Light stance - score 3.05 against a 3.00
budget) measured **28.1%, worse than the 2-Energy card at 29.2%.**

**So eclipse is not the problem. `shadow_claw` is** - her most-played card, 1,611 casts, 0.9
damage each. That is where a card pass should start.

## Recommendations

1. **Fix the AI's end-of-turn blindness.** Worth +5.3 points to hel_v1 alone, and it is a general
   defect - no deck currently gets any credit for the board state it hands the opponent. This is
   the real finding and the one I would take next.
2. **Raise the stance bonus, Light before Dark.** The knob is in.
3. **Cut `purify`.** +7.2 points and its premise is disproved.
4. **Leave `eclipse` at 2e.** Look at `shadow_claw` instead.
5. Stacked, correct play + a purify cut + a bonus raise puts her comfortably mid-field **without
   touching TWILIGHT_CADENCE**, which is what Henry wanted. The mechanics are fine.

## Method note

`reserve` is a simulation policy wrapped around `getBestAction`, not an AI change - it intercepts
the chosen action and substitutes one. It measures what correct play is WORTH; it is not a
shippable fix. Arms 3-7 all include it so the knob effects read against correct play rather than
against the AI's current line, which would understate every one of them.
