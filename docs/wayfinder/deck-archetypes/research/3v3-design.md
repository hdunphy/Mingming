# 3v3 design (Henry + designer, 2026-08-19 car session) - fight shape, sim, GA, speed

## Fight shape (Henry-ruled)

- Simultaneous 3-active per side, NO switching (standing decision).
- **SHARED deck and shared hand per side** - the merged pile is what makes team-building
  real: any member may cast any card, **STAB by CASTER** - mono-element teams cast
  everything at full power, spread teams pay STAB for coverage.
- **Energy: per-mingming pools** (2e each, own stat) - a card is cast by a member from its
  pool. Keeps hoard/Gateway/capacitor working unchanged; 'who casts this' is a decision.
- **Draw: sum of members' cardDraw stat minus (N-1)** - draw stays a species identity;
  high-draw species are team enablers. Reshuffle law unchanged.
- 'Wasted energy per turn' is a MEASURED sim metric before any relief valve is designed
  (Henry's run-dry-with-energy concern - measure, don't pre-patch).

## Audits feeding the team pass (tag now, retune later)

1. ENTITY-COUNT scaling (guardrail 2): TREACHERY, riptide, whole-side effects,
   RANDOM_ENEMY dilution.
2. **DECK-SIZE scaling (new)**: reshuffle-triggered firmware (valkyrie REBIRTH ~never
   fires in a ~27-card shared pile), draw-triggered firmware needs an OWNER rule when
   the team draws (ABYSSAL_INK, surge_protection refunds).

## Sim architecture

Team runner over the existing side machinery; 3v3 CANARY SUITE (fixed comps, degeneracy +
FTK + loop checks) joins standing gates once the skeleton exists. Two-tier AI fidelity:
greedy for screening, lookahead for finals/verification.

## GA harness - the RED TEAM, not the balancer

Population of teams (species triple x OS choices; card lists later). Fitness vs a
HALL-OF-FAME opponent pool (coevolution - no overfitting one meta). Mutations: swap
member / OS / card. Outputs: (1) dominant comps = balance bugs by definition;
(2) diversity of the near-optimal population = meta-health score; (3) NEVER-PICKED decks
- a duel-weak deck that evolved teams still pick is a good teammate (guardrail 4 answered
with data); absent from both = dead weight.

## Speed program (ticket 97 - pays back on 1v1 immediately)

1. **Incremental cell cache**: sims are deterministic - key every cell on hash(deckA,
   deckB, engine constants, seeds); a pass re-runs only changed cells (57 of 67 rows were
   bit-identical across a typical ship and we recompute them every time).
2. Worker-thread parallelism (single-threaded today on a many-core box).
3. Adaptive sampling: stop a cell when its CI clears the band; spend iterations only near
   lines (formalizes 0-DECISION-GRADE).
Expected: 10-30x combined; hour-long passes -> minutes.

## Sequencing

Status shape grid (95) ships first (engine-global). Then ticket 97 (speed), then ticket 98
(team-sim skeleton + canary), then the GA harness. From 98 onward no ship tunes blind to
the shipped game.
