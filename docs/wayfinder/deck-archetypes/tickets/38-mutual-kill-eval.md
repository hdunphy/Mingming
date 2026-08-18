# A mutual kill evaluated as a win

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [36-hel-decks](36-hel-decks.md) (closed)

## Question

Ticket 36 shipped hel_v2 with **61% of her section 2.3 games ending as mutual kills**. Henry asked
the right question: is that the deck, or is the AI choosing to die?

It was the AI, and the defect is one line wide.

## The defect

`evaluateState` ended with `+ (oppDead * 50)` and **had no counterpart for your own dead units**.
A dead unit scores `0` (`getEntityScore`'s early return), and ticket 27's concave HP curve is
deliberately shaped so the top of a health bar is cheap to spend — which together mean a nearly-dead
unit is worth very little *before* it dies, so dying costs almost nothing more.

Concretely, Hel at 15 of 80 HP scores about **63 points**. A line that kills the opponent and also
kills her is worth `oppScore + 50` and costs 63. That is always positive arithmetic. **But the
result is a draw, not a win.**

It went unnoticed for the entire roster because nothing before Hel routinely killed itself: she is
the first Mingming who pays HP for her cards, so she is the first to have the option.

Fixed symmetrically and at the same magnitude — `- (myDead * 50)`. Deliberately conservative: a
*truer* fix would make losing your last unit near-terminal rather than a fixed −50, since in 1v1 it
is a loss rather than a neutral event. That is a much larger change to every matchup's instincts
than the evidence here supports, and it is not made.

## The self-target duplicate, folded in

Ticket 36 found that `applyDamageModifiers` collects hooks from `[source, target]`, which is the
**same entity** on a self-damage card — so every hook the caster owns applied **twice**, but only
against itself. `core_overclock_daemon`'s 1.2x became 1.44x; `thermal_overload`'s 1.25x became
1.5625x. It affects `forage`, `dark_pact`, and fenrir's recoil line.

It was left open in 36 precisely because it needs a full re-gate of every tuned species, which is
this ticket. Now deduped by id, matching `applyHealModifiers`.

## Measured effect

Full committed run, registry `1:d7238b5d` (unchanged — no data moved). **Redlines 45 -> 45, nothing
added or removed.** 765/765 tests.

| matchup | before | after |
|---|---|---|
| **os:hel** | 0.590 / 2.16 turns / 0.304 dead | **0.508 / 2.66 / 0.267** |
| os:ratatoskr | 0.590 / 5.89 / 0.012 | 0.610 / 5.91 / 0.010 |
| os:fenrir | 0.394 / 4.78 / 0.271 | 0.394 / 4.78 / 0.272 |
| mirror:fenrir | 0.493 / 5.20 / 0.254 | 0.493 / 5.20 / 0.255 |
| **every other tuned matchup** | | **byte-identical** |

**hel's mutual kills 61% -> 35%**, her section 2.3 lands at **0.508 (a 0.8% gap)**, her games slow
from 2.16 to 2.66 turns, and her dead cards improve. Nothing else on the roster moved by more than
noise: ratatoskr's +0.02 is inside the documented +/-4 points at this seed count, and fenrir's
0.271 -> 0.272 is the self-damage dedupe touching its recoil line.

All nine tuned species remain in band on section 2.3 — 0.310 (hraesvelgr) to 0.660 (huldra) — and
on dead cards, with FTK 0.

**That is the blast radius an eval change should have**: the death term only binds when a unit
actually dies while acting, and today only Hel does that on purpose.

## Left open

- **The truer death term.** Losing your last unit in 1v1 is a loss, not −50. If a future species
  makes self-sacrifice a real strategy, revisit — with a full re-baseline, because unlike this
  change it would move every matchup.
- **hel_v2 still plays a ~2.7-turn game** against a roster tuned to 5–6 (ticket 25). The death
  penalty treats a symptom of that pace, not the pace. Her section 2.3 and dead cards are in band
  either way; the open question is whether a burst deck that fast belongs next to the others.
- **The AI still does not price the toll when choosing what to cast first.** It front-loads
  `soul_tithe` at the base rate (ticket 36), which is correct play and exactly why an escalating
  cost cannot brake an opener.
