# Ymir_v2 status-turn economics (ticket 106): protect a favorite - it regressed

- Type: wayfinder:task - from playtest round 3's regression gate: ymir_v2 (a Henry
  favorite) got LESS fun under POWER+1. Branch archetype-web. Runs after 103 (bounds
  reshape the status math it tunes against).
- Status: **open**

Henry's diagnosis, verbatim intent: 'Early build str + weaken enemy and then slam in the
last few turns' - but under one-card-per-turn scarcity, a status turn costs a whole
GLACIAL-boosted 2e nuke turn, and at +1/stack a 2-stack card needs ~3+ remaining turns to
repay it. The fun choice loses to arithmetic.

Fix within standing policy (the sanctioned buff lever: RAISE PRINTED STATUS COUNTS,
enabler-first): sweep his status cards' stack counts (e.g. 2 -> 3/4) until the
build-early-slam-late line is within ~10% EV of the nuke-every-turn line by turn 6 - then
Henry playtests the feel. Do NOT touch GLACIAL_PACE or the 2e nukes (the slam is the
payoff; the build-up is what needs to compete). Gates: band standard, FTK 0, §2.3
diagnostic; deliverable includes the EV math table both lines. ONE commit.
