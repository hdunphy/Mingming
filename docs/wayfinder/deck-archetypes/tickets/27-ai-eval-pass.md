# AI eval pass: concave HP, card advantage, daemon value

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Commit: `0792ec3`

## Question

`TacticalAI.evaluateState` scored HP and statuses only. Five candidate additions were
measured independently before combining.

## Resolution

Three landed, two did not.

**A. Concave HP** — `sqrt(hpFraction)`, damped 15% toward linear at `concavity = 0.85`.
Linear HP told the AI the last 10 HP were worth what the first 10 were, so it traded evenly
into lethal. Undamped sqrt overcorrected into refusing any trade; 0.85 is Henry's call.

**C. Cards in hand carry value.** A card was worth ZERO, so draw payoffs were invisible and
discarding cost nothing. The limiting resource is ENERGY, not cards: a side casts about
`maxEnergy` cards a turn however many it holds, so the first `maxEnergy` carry real value and
the rest is overdraw worth a tenth as much — deliberately kind to discard archetypes, which
is the trade a windmill deck is making. **This term shipped with a double-charge bug; see
ticket 28.**

**D. Daemon installs** valued at half a turn of damage. Daemon play rates **18% -> ~60%**.

**Not shipped — E, OS-synergy bonuses.** Measured at roughly zero effect. The search already
simulates the plays, so OS synergy is priced by construction. Do not re-add it.

**Not shipped — resizing fenrir_v1's brake.** The brake (`crimson_draw`) turned out to be
mis-targeted rather than undersized; see ticket 28.

C was known at merge time to move kraken 0.57 -> 0.68 and was accepted as the more truthful
reading. After ticket 28 fixed the double-charge, kraken settled at **0.54** — the term was
never over-rating kraken, it was penalising every deck that plays cheap cards.
