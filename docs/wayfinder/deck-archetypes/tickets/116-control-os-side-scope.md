# Ticket 116 — side-wide firmware for kraken and huldra

**Status:** **KRAKEN SHIPPED 2026-08-26** (*"I'm good with the Kraken OS change"*). Huldra NOT taken.
Opened 2026-08-24 on Henry's request: *"I'd be curious about adding some side debuffs to kraken and
huldra before we look to change the deck. so do some OS testing then try swapping some cards"*.

## What shipped

`kraken_v1`'s `ABYSSAL_INK_SYS` hook: `"target": "RANDOM_ENEMY"` → `"ENEMIES"`. Its description and
its log line both named a single enemy and now name the side — the log template was `{target} is
blinded by Abyssal Ink!`, and under `ENEMIES` the resolver returns an *array* of ids, so the
placeholder no longer resolved. It now reads `Abyssal Ink blinds the enemy side!`, and
`OSSystem.test.ts` was updated to match. 872/872 green.

**`huldra_v1`'s `ALLURE_PROXY` is unchanged** and should stay that way unless it gains a condition —
see the recommendation below.

**Measured after both this and the `hexbloom` revert:** `panel-control` vs `panel-zoo` at 3v3 sits at
**40.0%**, up from 10.0% before ticket 115.

---

## What was tested

Ticket 115's census found the answer package lives entirely in `draugr_v2`. What kraken and huldra
have instead is firmware — and **both pieces apply their debuff to a RANDOM enemy**, which is ticket
110's coverage collapse written straight into the OS layer:

| firmware | trigger | effect today |
|---|---|---|
| `ABYSSAL_INK_SYS` (`kraken_v1`) | an ally draws a card outside the draw phase | 1 Dazed to **a random enemy** |
| `ALLURE_PROXY` (`huldra_v1`) | she puts a buff on her own side | 1 Weakened to **a random enemy** |

At 3v3 the proc fires just as often but lands on one of three bodies. The arms change one field per
hook — `RANDOM_ENEMY` → `ENEMIES` — which the engine already supports (`HookTypes.ts`,
`HookFactory.ts`). No engine work, no deck change, same shape as ticket 115.

## Results — 3v3, full tier, beam 8, 20 games, post-115

| arm | control wins | W/D stacks landed per game | per enemy body per turn |
|---|---|---|---|
| shipped | **35.0%** | 38.5 | 2.35 |
| kraken firmware side-wide | **55.0%** | 46.6 | 2.93 |
| huldra firmware side-wide | **75.0%** | 77.8 | 5.70 |
| both | **80.0%** | 80.0 | 5.92 |

**Kraken is the moderate, well-behaved one.** +20 points, stacks up a fifth. It gives the deck that
currently has *zero* answers a real one, at the OS layer, without touching its card list.

**Huldra overshoots badly, and the stacks column says why.** `ALLURE_PROXY` fires on *every* buff she
puts on her own side, which is often — so side-scoping it does not add a third more coverage, it
roughly **doubles total debuff output** (38.5 → 77.8 stacks a game) and takes density to **5.7
Weakened/Dazed per enemy body per turn**. `scratch/hitmath.ts` established that 2 Weakened halves a
spam deck's output and 5 zeroes it. At 5.7 per body per turn the arm is not debuffing zoo, it is
switching zoo off.

**Both together is 80%, which just inverts the original problem.** Control beating zoo 80% is not a
fix, it is the same imbalance pointing the other way.

## The 1v1 bill: none, but not bit-identical, and the difference matters

Measured with the lead set to the mingming whose firmware actually changed — the mistake that
invalidated an earlier set of 1v1 rows in this arc:

| 1v1 | shipped | side-wide |
|---|---|---|
| `kraken_v1` vs `jormungandr_v1`, 30 games | 60.0% | 53.3% |
| `huldra_v1` vs `jormungandr_v1`, 30 games | 96.7% | 100.0% |

Facing one enemy, "all enemies" and "a random enemy" are the same body, so there is **no mechanical
change** at width 1. The movements are in opposite directions (−6.7 and +3.3) and are seed noise, not
a bill — **but note these are not bit-identical the way ticket 115's card flip was**, because
`RANDOM_ENEMY` consumes PRNG and `ENEMIES` does not, so the two arms play out different games from
the same seed. Any 1v1 re-baseline after a change here cannot be skipped on an identity argument.

## Recommendation

- **Take kraken.** +20, no deck change, and it fixes the specific hole the ticket-115 census found.
- **Do not take huldra as a straight flip.** The trigger fires too often for its effect to be
  tripled. If the coverage is wanted there, it needs a CONDITION that makes the mirror fire less
  often rather than a cap — `0-NO-CAPS` — for example mirroring only her *own* buffs rather than
  every buff on her side, or only the first mirror each turn.
- **Do not take both.**

## Caveat that applies to ticket 115 as well

This baseline sits at **35.0%** on seed base `osarms:kraken:w3`, where ticket 115's post-change
measurement read **55.0%** on seed base `weakarms:w3` — same build, same decks. That is a 20-point
seed-base spread on 20-game samples, wider than the MAD 6–13 this repo usually sees. **Ticket 115's
headline should be read as "a large gain of uncertain size", not as 55%.** A second seed base on the
115 grid is owed before any number from it is tuned against.
