# Team-sim skeleton + canary suite (ticket 98): stop tuning blind to the shipped game

- Type: wayfinder:task - infrastructure. Authorized 2026-08-19. Runs AFTER tickets 95
  (status shape) and 97 (speed). Spec: research/3v3-design.md - fight shape is
  Henry-ruled there (shared deck/hand, per-mingming energy, STAB by caster,
  draw = sum(cardDraw) - (N-1)).
- Status: **open**. Branch archetype-web.

Deliverables: (1) 3v3 battle runner on the existing side machinery, with the caster-
allocation choice exposed to TacticalAI (teach the eval WHO casts, not just WHAT - the
ticket-19 lesson applies); (2) the owner rule for draw-triggered firmware (design
question - propose, Henry ratifies); (3) CANARY SUITE: ~6 fixed comps (mono-element,
spread, support-heavy) x a few opponents, gating FTK 0 / no loops / wasted-energy metric
/ entity-count-tagged mechanics reported; joins the standing gates. (4) the two audit
tag lists (entity-count, deck-size) written into the registry as annotations.
GA harness is a FOLLOW-UP ticket once the runner exists.
