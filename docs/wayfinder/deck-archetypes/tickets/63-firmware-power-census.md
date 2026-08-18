# Firmware payoff power-rate census (ticket 63): what a printed power is actually worth, per frame

- Type: wayfinder:research - REPORT-ONLY. No changes of any kind.
- Status: **open** - authorized by Henry 2026-08-14 (ticket-61 review, Q3: "might be worth
  a sweep to see if there are any major offenders").
- Assignee: - (suitable for a lower-tier model; the instrument exists)
- Blocked by: run when the tree is free; read-only otherwise.

## Why

Ticket 61 measured ~0.19 HP per printed power on valkyrie's frame against the 0.30 folklore
rate - the raw-HP REBIRTH proc was worth 42-45 power, not 33. Every power-denominated
firmware payoff in the registry was priced without its frame's real rate.

## Task

For EVERY OS payoff denominated in power or %-maxHp (REBIRTH N=15, NOURISH 50%, hel Gateway
costs, hel_v2_lifeblood +50% healing, GALE_FORCE 10, UPDRAFT, GENESIS maxEnergy, TOXIN_FANG
+1/stack, TIDAL_CRUSH 1.2x, OUROBOROS, TREACHERY grants, plus any missed - grep hooks.json +
CustomFirmware.ts): measure delivered HP (or HP-equivalent) per proc and per game on its own
frame at 60 iterations, using the 0-AI-SIM-COUNTS-safe wrapper. One table: OS | payoff text |
printed value | delivered/proc | procs/game | delivered/game | implied power-rate | flag.
Flag anything whose delivered value diverges >2x from what its printed number suggests at the
0.19-0.30 rate range. Scaling-card companion table (starfall, stampede, serpents_coil,
carrion_swoop, momentum_crash + peers): measured damage/cast vs the vanilla benchmark
(fire_punch_v2 10.5-13.5) - this is the comparison Henry asked for on starfall.

## Deliverable

research/firmware-power-census.md (CRLF), ranked by |divergence|, questions-for-Henry list,
card appendix. ONE commit (research file + ticket closed). No recommendations executed -
offenders go to Henry.
