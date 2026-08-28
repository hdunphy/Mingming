# A loss is not worth minus fifty, and Burn had Poison's shape

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [43-healoverride-and-consume-pricing](43-healoverride-and-consume-pricing.md) (closed)

## 1. The terminal term

Ticket 38 gave `evaluateState` a symmetric `- (myDead * 50)` because a mutual kill was evaluating as
a win, and deliberately stopped short of the truer statement: **losing your last unit in 1v1 is not
"a unit worth 50 points died", it is the game.** As a constant, a board with enough upside could
still outrank being alive.

Now terminal, at ±10000 — far above any reachable board score, so winning dominates every positional
consideration and losing is worse than any board rather than competing with them:

```ts
if (!myAlive || !oppAlive) {
    return (oppAlive ? 0 : TERMINAL_SCORE) - (myAlive ? 0 : TERMINAL_SCORE);
}
```

**The symmetry falls out for free and is the point**: a win is `+TERMINAL`, a loss `-TERMINAL`, and a
**mutual kill lands at exactly 0 — between the two, which is what a draw is worth.** The per-unit
±50 still governs multi-unit parties where some but not all are down.

## 2. Burn had the same shape problem ticket 40 found in Poison

`burnTotalPercent` summed the decay ladder with no horizon. That is the right *total* — but only if
the battle lasts `stacks` more turns, and battles run 5–6. Burn's top tier is 8%/turn, so it runs
away faster than Poison did:

| stacks | uncapped | capped |
|---|---|---|
| 1–3 | 1.5 / 5.0 / 13.0% | **unchanged** |
| 4 | 21.0% | 20.0% |
| 5 | 29.0% | 20.0% |
| 10 | **69.0%** | 20.0% |
| 15 | **109.0%** | 20.0% |

At 15 stacks the eval valued a Burn pile at **more than the target's entire health bar**. Capped at
the per-turn rate over `STATUS_HORIZON_TURNS`, the same horizon every other future-scaling status
uses. Below ~3 stacks the decay sum still binds, because Burn genuinely does decay away inside the
horizon — so low-stack Burn is untouched.

## Gate

Full committed run, registry `1:cb7f0ab5` (unchanged — no data moved). **Redlines 45 → 45, nothing
added or removed.** 766/766 tests, `tsc -b` and `vite build` clean. Control-gauntlet overall
0.40 → 0.41, so absolute power across the roster did not shift.

**`mirror:huldra` 11.65 → 7.26 turns** is the standout: the terminal term makes the search actually
close games out instead of accumulating position.

## Two band breaches, and one of them is mine from the previous ticket

**These are the honest consequence of two correct fixes, not regressions to revert** — but both
species now need a pass.

| | §2.3 | note |
|---|---|---|
| **os:ratatoskr** | 0.330 → 0.180 → **0.200** | broke in **ticket 43**, not here |
| **os:jormungandr** | 0.310 → **0.240** | broke here |

**I missed the ratatoskr drop when I reviewed ticket 43, because I diffed only the redline set and
not the per-matchup numbers.** `OS_GAP os:ratatoskr` was already a redline before and after, so the
15-point fall produced no delta and passed unnoticed. `healing_mist` is in ratatoskr_v1 and went
from a flat 5 HP to a power-15 heal. **Lesson: diff the matchup table, not just the redline list —
a redline that was already lit hides any amount of movement underneath it.**

jormungandr fell here because it is the roster's most heal-and-attrition-dependent deck and the
terminal term rewards closing rather than grinding. It was already the weakest deck in the game
(91% control win rate); this makes the diagnosis sharper, not new.

**`valkyrie` also collapsed in ticket 43** — control win rate 0.53 → **1.00** — because both her
decks run `healing_light`, which stopped being a flat 20 HP. She is an untuned placeholder so no
band applies, but her deck pass now starts from a much weaker base than the ticket-42 reading
suggested. `audhumbla` runs the same card and did not move.

## Left open

- **ratatoskr (0.200) and jormungandr (0.240) need tuning passes**, both now measurable against the
  control rather than against §2.3 alone.
- **valkyrie's base is weaker than it looks** in any pre-ticket-43 number.
- The ±50 per-unit term is now only meaningful in team battles; when ticket 05's team scenarios land,
  check whether it is still the right magnitude next to a ±10000 terminal.
