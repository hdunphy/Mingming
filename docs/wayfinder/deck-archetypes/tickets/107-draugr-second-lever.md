# Draugr second lever (ticket 107): rimebreaker reads everything, and the nightmares seep in

- Type: wayfinder:task - Henry-ruled 2026-08-20 off his own draugr-vs-huldra playtest
  (the tug-of-war cell, felt by hand: 'she can't out-daze huldra's sharp stacks').
  Branch archetype-web. Runs after tickets 104/105 (P0s first).
- Status: **open**

## Change 1 - rimebreaker rework

Old: 25 power per different DEBUFF on the target (measured reality: 0.70 average, ~1-2 vs
huldra, ~4 damage - Henry's hands confirmed the census). New: **"20 power for each
different STATUS on the target - buffs, debuffs, DoTs, Regen, anyone's."** The inversion
is the point: huldra's own Sharp pile FEEDS it - their win condition becomes draugr's
ammunition. Polarized by design (big vs status decks, ~0 vs clean) = legal counter-texture
under the web; it is tech, not the plan. Scorer: the DISTINCT_STATUS path needs an
any-status variant constant - measure the board reality and set it; document.

## Change 2 - the Poison rider (the second lever)

OS clause on draugr's debuff engine: **"Statuses draugr applies to an enemy also apply
1 Poison."** Quadratic, defense-ignoring clock from her EXISTING gameplan; lives outside
the Sharp/Dazed cancel war, so the counter matchup becomes heavily-unfavorable-not-
impossible (0-TWO-LEVERS satisfied). **IMPLEMENTATION GUARD: the rider's own Poison
applications must NOT re-trigger the rider** - non-recursive, or it loops. Unit test this
explicitly. Liveness after the hooks edit.

## Gates

THE cell: draugr_v2 vs huldra re-read at 30 iterations x two seed bases - target off the
floor into 15-35% (predator-band per the web; it is still her counter). Band standard
across her row, FTK 0, dead <=0.35, control >=0.60. Knobs (max 2 rounds): rimebreaker
20 -> 15 or 25; rider Poison 1 -> 2. ONE commit + Henry replays the huldra game.
