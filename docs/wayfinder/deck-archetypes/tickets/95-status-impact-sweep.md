# Status shape grid (ticket 95): percent-capped vs power-uncapped - make the rider half of every card real

- Type: wayfinder:research - REPORT-ONLY grid, then Henry picks the shape. Authorized
  2026-08-19 (car session), REWRITTEN same day to Henry's power-denomination proposal.
  Branch archetype-web.
- Status: **open**

## Why

Playtest: card choices are fake because statuses do not scale - 2%/stack capped +-25%
(~2 damage from a 12-stack pile) while the scorer charges 15/10 power/stack and tooltips
claimed 20%. Henry's proposal: POWER-DENOMINATE the four combat statuses - Strengthened/
Weakened add/remove 1 power per stack on YOUR attacks; Sharp/Dazed become the INCOMING
pair, moving enemy attack power against you by 1 per stack (name-to-axis mapping to be
confirmed by Henry) - UNCAPPED, with sheds/counters as the control valve instead of a cap.
Power is the game's universal currency (level-proof by construction - the same law that
fixed REBIRTH and hel's Gateway).

## Grid - two shapes, Burn-grid style

PERCENT arms (live shape): rate {2 (live), 4, 6} x cap {25 (live), 40, 60}.
POWER arms (Henry's shape): {+1, +2} power per stack, UNCAPPED, two-axis split as above.
In-memory arms; instrument per arm: 30-iter field for ALL 32 decks (global engine change -
control drift is telemetry), band-violation count vs the census, FTK (hard 0), mirror
lengths, and named exhibits: (a) the status-heavy decks (gullinbursti, ratatoskr, draugr,
sleipnir_v1, skoll_v1) whose riders finally matter, (b) **the TUG-OF-WAR cell:
draugr-vs-Sharp-appliers under the duality cancel** - uncapped makes contested axes
winner-take-all, which is what killed draugr in playtest; measure how bad it gets,
(c) raw-stack scalers (momentum_crash, sun_devourer, TREACHERY/CORE_OVERCLOCK) -
double-dip check under power shapes.

## Blast radius, stated up front

Whichever shape ships: scorer per-stack prices, cleanse/removal premium (tickets 46/51),
the duality note, and TacticalAI's statusValue() all re-derive - follow-up ticket, priced
in. STOP after the grid; Henry picks; nothing ships from this ticket.

## Paired law (Henry, 2026-08-19): TWO LEVERS

Uncapped contested statuses REQUIRE it: **every deck needs two independent win levers** -
a counter matchup should be heavily unfavorable, never impossible (draugr's single-lever
Dazed plan had a hard OFF switch). Audit column added to ticket 94's census: independent
paths to lethal, per deck. Single-lever decks get flagged for their next pass.
