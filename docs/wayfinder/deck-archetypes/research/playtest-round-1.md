# Playtest round 1 - what one match found (ticket 90)

Henry played **A1 (`sleipnir_v1` vs the control)** and stopped there, because the match was hard to
read. Result: a win, *"too slow"*, distinct 3/5, choices **2/5**, and:

> *"I was doing 2-4 damage every turn. It took many turns. The damage calculations felt wrong."*

Six bugs came out of that one match. Four were real defects, two were UI gaps, and the last piece
is not a bug at all - it is the deck working as designed, invisibly.

## 1. The status tooltips were wrong by 10x

`statusGlossary.ts` promised **20% per stack** for Strengthened, Weakened, Dazed and Sharp. The
engine applies **2% per stack, capped at +-25%** (`Hooks.ts`, `STATUS_PCT_PER_STACK = 0.02`,
`STATUS_PCT_CAP = 0.25`) - the rev-3 status pricing, which the glossary never followed. So a player
stacking Strengthened was told to expect ten times the damage he got. **This alone would make any
damage number feel wrong**, and it had been wrong in the UI since rev 3.

Fixed: all four now read *"2% more damage per stack, up to +25% at 13 stacks"*.

## 2. The damage preview could not see per-card scaling

`AttackExecutor` computes damage in two halves: the POWER-side scalings (Sharp, missing HP,
Strength) via `getEffectiveAttackPower`, and then a POST-damage multiplier for the scalings that
read the turn's history - cards played, cards drawn, Energy spent, cards discarded. The preview
called the first half and stopped.

**`stampede` is `sleipnir_v1`'s payoff and it scales on cards played this turn.** Hovering it showed
its printed 11 power - about 2 damage - no matter how wide the turn had been. The card that is the
entire point of the deck previewed as the worst card in the deck.

Fixed by extracting `getDamageScalingMultiplier`, now the single source of truth for both the
executor and the preview - the same shape as `getEffectiveAttackPower`, and for the same reason.

## 3. ...and it was off by one

`handlePlayProgram` increments `cardsPlayedThisTurn` **before** the actions resolve, so a per-card
scaler counts the card being cast. The preview ran before any of that, so even once it could see the
multiplier it under-read by exactly one play. Pinned with a test that plays the card through the
real reducer and asserts the preview matched to the point.

## 4. No turn counter, no cards-played counter

Both now sit top-left. The cards-played chip lights up cyan once the count is above zero, because on
this deck **that number IS the damage** - `stampede` multiplies by it directly.

## 5. The snapshot needed you to predict the end of the game

Exporting required a live battle, so the moment the killing blow landed the evidence was gone.
Ctrl+Shift+E now falls back to the final state of the last battle, so it works on the victory screen
and afterwards.

## 6. What is NOT a bug: 2-4 damage a card is real

Measured on Henry's exact scenario - Sleipnir level 15, attack 38, against the control's defense 39
and 87 HP:

| card | printed power | damage |
|---|---|---|
| `water_slap` | 12 | **2** |
| `zephyr_strike` | 15 | **3** |
| `adrenaline` | 18 | **3** |
| `stampede` | 11 per card played | **2** at one card, **6** at three, **10** at five |
| `momentum_crash` | 8 per Strengthened stack | **0** with no stacks |

The formula is `floor(levelBase x power x atk/def) / 45`, and at level 15 `levelBase` is 8, so a
15-power card lands at 2-3 damage into an 87 HP bar. **The sim runs at the same level 15 and gets
the same numbers** - `BALANCE_LEVEL = 15` - so this is not a playtest-only artifact.

**Where `sleipnir_v1`'s damage is actually supposed to come from is not her cards at all:**

- **`hoofbeat_daemon`** - *"whenever you play a 0-cost card, deal 10 damage to a random enemy."*
  Flat 10, no divisor. On a deck with five 0-cost cards that is up to 50 damage in a turn, five
  times what her actual cards do.
- **`momentum_crash`** - 8 power per Strengthened stack, and MOMENTUM_DRIVE is a Strengthened
  engine. At the 8-stack cap that is 64 power, her single biggest hit.
- **`stampede`** - the per-card scaler that previewed as worthless.

So the deck's whole plan was invisible while piloting it: one payoff previewed wrong, one reads 0
until the engine spins up, and the third is a daemon that does its damage without ever appearing in
a hover preview. **Choices 2/5 is the correct score for that experience, and it is a readability
failure rather than a balance one.**

## What this says about the archetype question

The wide deck felt slow to play, and the reason is instructive: **width only pays through payoffs,
and every one of this deck's payoffs was unreadable.** That is worth knowing before we spend a
ticket on ticket 88's draw experiment - if a wide deck's damage arrives through counters the player
cannot see, adding a card a turn will make it *more* opaque, not more fun.

Worth a re-run of A1 now that the preview tells the truth.

## Still open

- **Extra energy display (`4/3`).** The over-energy branch exists in `MingmingUnit` and renders
  `currentEnergy` in cyan when it exceeds `maxEnergy`. If it still reads `3/3` when Ratatoskr banks
  a point, the defect is in when Energized converts into Energy, not in the display.
- No balance numbers moved: the refactor is arithmetically identical (`floor(d + d*k)` equals
  `d + floor(d*k)` for integer `d`), and a re-measure agrees - `jormungandr_v1` 49.6% before and
  after, `sleipnir_v1` inside noise.
