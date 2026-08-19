# Fenrir berserk range (ticket 96): entering the red is a choice

- Type: wayfinder:task - Henry-approved 2026-08-19: BOTH the threshold move and a
  self-damage enabler. Branch archetype-web. Runs AFTER ticket 95's grid (a status-rate
  change moves fenrir's numbers; do not tune against a moving engine).
- Status: **open**

## Why

Playtest: fenrir's below-50%-HP berserk suite is a place that happens TO you, not one
you choose - hard to get into range, harder to stay. Fix shape: raise the threshold so
the range is livable AND add a recoil enabler so entering it is push-your-luck.

## Arms (in-memory; fenrir_v1)

a. Threshold only: every 50%-HP conditional in his berserk suite (berserk_rush,
   blood_rite, battle_rhythm, bloodlust/ragnarok_edge if thresholded) -> 60%.
b. Enabler only: ember_mend -> desperate_strike (0e: 1 Str + 10 self-damage).
c. Enabler only: ember_mend -> glass_cannon (1e: 45 power, 20 recoil).
d. Threshold 60 + the better enabler from b/c.

NOTE the tension to report: ember_mend is his only heal and a wounded-range deck may
want it to STAY in range - if cutting it hurts, the alternate cut is a berserk_rush copy
(46% dead at last read). Ship arm d (Henry's 'both') unless the numbers say the
combination overshoots - gates: field 0.35-0.80, control >=0.60, FTK 0, dead <=0.35,
no new neutral 0/100 cells. Knobs: threshold 60 -> 55 or 65. One commit, Resolution,
HANDOFF refresh.
