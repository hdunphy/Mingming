# hel_v1 diagnostic (ticket 75): measure first - where does she lose?

- Type: wayfinder:research - REPORT-ONLY, no changes executed. Same shape as ticket 65 (kraken).
- Status: **open**
- Requested by: Henry 2026-08-17, from the design agent's floor queue ("she's next after kraken").
- Blocked by: nothing. Runs on any free agent. Baseline is `1a084c7` (post ticket 74).

## Correction to the brief before anyone starts

The queue note reads: *"her stance-dance OS (Dark +30% dealt / Light -30% taken) plus two of the
roster's deadest cards (venom_shade 53%, last_rites 45% - both hers)."*

**`venom_shade` and `last_rites` are in `hel_v2`, not `hel_v1`.** They are the species' cards, not
this deck's. The dead-card numbers say the same thing: `hel_v2` runs a **0.241** dead-card ratio
against the control deck and **`hel_v1` runs 0.091** - one of the cleaner decks in the roster.
**Dead cards are not hel_v1's problem.** A ticket written on that premise measures the wrong deck.

`hel_v2` is a separate and arguably more urgent case (80.3% field, 9 band violations, four cells
at 100%) but it is not this one.

## What is actually wrong with hel_v1

Ticket 69's census, at `198ac2c` - **re-baseline before trusting these, ticket 74 moved the field:**

- **Field 23.5%**, second-worst deck in the roster after kraken.
- **Four outright 0% cells and every one of them NEUTRAL**: `jormungandr`, `gullinbursti`,
  `ymir`, `nidhoggr`. Under Henry's bucket-band standard a neutral absolute is *the* hard gate,
  so this deck is four separate gate failures.
- **All 15 of her matchups are NEUTRAL.** She is dual-type Dark/Light and the matrix gives her no
  advantaged and no disadvantaged cells at all - so unlike kraken there is no type confound here
  and nothing to blame. Whatever is wrong is deck or OS.
- **`os:hel` is 2.0%** - `hel_v1` wins 2 of 100 decided games against `hel_v2`. That is the widest
  variant gap in the roster and it is the number the design session will be judged on.
- She clears the control floor (beats control 96%), so the floor is not the instrument that finds
  this.

## The deck and the OS

Stats: **hp 80, attack 95, defense 60, energy 2, cardDraw 4.** Attack is top-tier and **defence
60 is the lowest on the roster.** Dual Dark/Light, so both halves of her deck get STAB.

**TWILIGHT_CADENCE:** *"The element Hel casts sets her stance at the END of the action. Dark
Stance: +30% damage dealt. Light Stance: -30% damage taken."* None-element cards set no stance.

11 cards (three over the 8-card base):

| card | x | cost | element | text |
|---|---|---|---|---|
| Shadow Claw | 2 | 0e | Dark | 5 power. Apply 1 Weakened. |
| Pale Mercy | 2 | 0e | Light | Heal with 14 power. |
| Night's Bite | 2 | 1e | Dark | 20 power. Apply 2 Dazed. |
| Tackle | 1 | 0e | None | 12 power. |
| Purify | 1 | 1e | Light | Remove 2 Poison and 2 Burn from yourself. |
| Lumen Surge | 1 | 1e | Light | Gain 1 Energy next turn. Draw a card. |
| Hamstring | 1 | 1e | None | 20 power. Apply 2 Weakened. |
| Eclipse | 1 | 2e | Dark | 40 power. **+30 power if you are in Light Stance.** |

## The questions to measure

1. **Does the stance actually toggle?** Over real battles: what share of her turns end in Dark
   stance, Light stance, and neither? The end-of-action rule means the card that sets a stance
   never benefits from it - only the next one does - so the OS only pays if she alternates
   deliberately. **Does the AI alternate, or does it settle into one stance?**
2. **Is the Light stance ever load-bearing?** The -30% only helps on the turns she is hit while
   holding it. Measure: what fraction of damage she TAKES arrives while she is in Light stance?
   On a 60-defence frame this is the difference between the OS being a defensive identity and
   being decorative.
3. **`eclipse` looks self-defeating and needs checking first.** It is a **Dark** card whose bonus
   requires **Light** stance, so it can only be earned by casting a Light card immediately before
   it, and casting it then flips her to Dark. **How often does the +30 actually land?** If the
   answer is near zero, that is a one-card finding worth more than the rest of the ticket.
4. **Where does her damage come from?** Split her output into raw attack (95 is high) versus the
   Dark-stance +30%. If the stance contributes little, the OS is not an offensive identity
   either, and she is a vanilla beater with the roster's worst defence.
5. **What kills her in the four neutral 0% cells?** Same decomposition ticket 67 ran on kraken:
   damage dealt per turn, damage taken per turn, and the **net**. Say explicitly whether the
   deficit is offence or defence - ticket 67's answer for kraken was net, not offence, and that
   changed the whole design session.
6. **Is `purify` dead?** "Remove 2 Poison and 2 Burn from yourself" is an answer card. Report its
   play rate split by whether the opponent actually applies a DoT. Same for `hamstring` and
   `tackle`, her two None cards - they are the only way to act without committing to a stance,
   which may be a feature or may just be two off-identity cards.
7. **Is the 11-card deck itself the problem?** She is three cards over base with `cardDraw` 4.
   Report her dead-card ratio and whether the extra cards dilute the stance rhythm.

## Instruments

`scratch/bandcensus.ts` for the field row, `runPairedBatch` with telemetry for per-card play and
damage attribution, and a stance tracker to be written - nothing existing records which stance
she is in, and questions 1-3 all need it. That tracker is the main build in this ticket.

## Deliverable

`research/hel-v1-diagnostic.md` (CRLF): the stance census, the eclipse answer, the net/turn
decomposition on the four zero cells, the dead-card table with the DoT split, and a verdict on
whether hel_v1 is a deck problem, an OS problem or a stat problem - with the number behind it.
Questions for Henry at the end. **ONE commit. No changes executed.**

Note for whoever runs it: `hel_v2` at 80.3% field with four 100% cells is the other half of this
species and is a worse gate failure in the opposite direction. Out of scope here, but do not let
the two get conflated in the report the way the brief conflated their card lists.
