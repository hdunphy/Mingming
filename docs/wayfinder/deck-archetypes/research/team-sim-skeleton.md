# The team sim already existed. What blocks it is one measured bottleneck

- Type: wayfinder:implementation. **Ticket 98** (team-sim skeleton + canary + caster-allocation AI).
  Branch `archetype-web`.
- **868 tests green**, `tsc` clean, build clean. **No balance numbers changed** — no engine
  behaviour was touched, deliberately.
- **3v3 battles run, resolve, and never stalled.** They are also ~170x too expensive to grid, for a
  reason that is now measured rather than guessed.

---

## 0. The short version

I expected to build a team simulator. **Most of it was already shipped**, spread across pieces that
were each built for a 1v1 reason:

| ruled 3v3 design (HANDOFF) | status |
|---|---|
| simultaneous 3-active, no switching | **already live** — state carries *parties*, not frames; there is no active slot |
| SHARED deck + hand | **already live** — deck and hand are per-SIDE |
| per-mingming energy | **already live** |
| any member casts, STAB by caster | **already live** — `PLAY_PROGRAM` takes an explicit `sourceId` |
| **caster-allocation AI** | **already live** — `TacticalAI` enumerates every living member as a candidate caster |
| draw = sum(members' cardDraw) − (N−1) | **already live**, in `battleReducer`'s pre-turn draw |

So the "caster-allocation AI" the ticket asks for is not a component to write. It is a search the AI
has been running all along; in 1v1 the caster set has one member, so nobody noticed.

What was missing is a **harness**: a way to compose a team matchup, and something to watch it.
That's `teamScenario()` and the canary, and they're what this ticket ships.

Two findings came out of running it, and the second one is the important one.

---

## 1. The canary: team battles work

`scratch/teamcanary.ts`, 4 team pairs x 2 iterations x 2 orders = **16 games**, three distinct
species a side, shared 27-card pile:

```
stalls    0/16 (0.0%)
FTK       0/16
turns     mean 11.88   worst pair 27.50
```

| pair | teams | win rate | turns | dead cards (P/E) | first-mover edge |
|---|---|---|---|---|---|
| 0 | fenrir_v1+skoll_v2+sleipnir_v1 vs ratatoskr_v2+valkyrie_v1+nidhoggr_v2 | 100.0% | 5.75 | 12.1 / 21.3 | 0.000 |
| 1 | kraken_v2+gullinbursti_v1+ratatoskr_v2 vs ymir_v1+audhumbla_v2+kraken_v1 | 75.0% | **27.50** | 3.9 / 10.2 | 0.250 |
| 2 | skoll_v1+hraesvelgr_v2+ymir_v1 vs draugr_v2+nidhoggr_v1+fafnir_v2 | 50.0% | 8.50 | 26.9 / 15.0 | **0.500** |
| 3 | jormungandr_v2+ratatoskr_v1+draugr_v2 vs audhumbla_v1+fenrir_v2+jormungandr_v1 | 75.0% | 5.75 | 10.6 / 16.3 | 0.250 |

**Nothing hung, nothing stalled, nothing first-turn-killed, and dead cards stayed under the 35%
policy line on both sides in every pair.** Given that a shipped 1v1 deck can already loop forever
(the `glimmer` bug, ticket 100) and a 27-card pile with three energy pools is a strictly friendlier
home for that, this was not a foregone result.

Two caveats I'd rather state than let anyone read past. This ran at the **greedy** tier, which
ticket 108 just demoted for balance work — legitimately, because liveness is not a balance number
and greedy distorts card *value*, not whether a battle resolves. And 2 iterations is a **ranking,
not a verdict** (0-DECISION-GRADE): read "nothing stalled" as real, and the win rates as noise.

---

## 2. The finding that matters: 3v3 games are 4–10x longer, so no 1v1 price transfers

1v1 battles in this engine last **2–3 turns**. The team canary averaged **11.88**, and one pair ran
**27.5**.

That is not a performance note, it is a balance one. **Every damage-over-time card in the registry
is a different card at 27 turns than at 3.** Poison compounds over a game an order of magnitude
longer; Regen's 3%-maxHP-per-turn tick (ticket 34) accumulates across ten times as many ticks; Burn
permanence (ticket 92) means something else entirely. The scorer constants that price them —
`ASSUMED_CONSUMED_STACKS` at Poison 8, Regen 10 — were measured on 3-turn games.

This is guardrail 4 from the 3v3 ruling ("the 1v1 window is a health PROXY not a mandate") now
carrying a number instead of a caution. **A deck's 1v1 field rate does not predict its team value,
and a status card's 1v1 price is not its team price.**

The first-mover edge is worth flagging too: it ran **0.000 to 0.500** across four pairs where 1v1
runs ±0.12. 0.500 is the maximum the metric can take. At two iterations that's a ranking, not a
verdict — but it says the paired-orientation harness is *more* necessary in 3v3, not less.

---

## 3. Why a team grid is not affordable yet — measured, not guessed

The first canary run timed out: **72 games, over 10 minutes**, against 600 1v1 games in 30 seconds.
So I measured the growth curve on one squad (`scratch/teamcost.ts`, `scratch/teamdecisions.ts`):

| | decisions per battle | **cost per decision** | battle |
|---|---|---|---|
| 1v1 | 25 | 11ms | 0.3s |
| 2v2 | 39 | 98ms | 3.8s |
| **3v3** | **55** | **923ms** | **52.3s** |

**Decisions grow 2.2x. Cost per decision grows 84x.** So it is a *branching* problem, not a
game-length one — and the p95 decision takes **4.6 seconds**, with a worst case of 6.0.

The AI tier does not fix it, and that is the diagnostic:

| tier | 3v3 battle |
|---|---|
| full | 52.3s |
| lite | 40.6s |
| **greedy (no lookahead at all)** | **34.4s** |

**Removing the lookahead entirely buys 1.5x.** So at least two thirds of the cost is the *same-turn
candidate enumeration* that every tier does: `casters x hand x targets`, each candidate a full
`battleReducer` simulation, re-enumerated after every play in the turn. In 1v1 that is roughly
1 x 4 x 1; in 3v3 it is 3 x 7 x 3.

**The fix is candidate pruning, not more cores and not a shallower search.** Ticket 108's pool would
turn 170x into ~20x on an 8-core box, which is still not a grid. Some shapes worth trying, in the
order I'd try them:

1. **Target pruning first** — three targets multiply *everything*, and for most attack cards the
   choice of which enemy to hit is a much smaller decision than which card to play. Score targets
   once per card rather than simulating each.
2. **Caster pruning** — for cards with no caster-dependent effect (no STAB difference, no self
   status, no cost interaction), casting is often equivalent across members; collapse those.
3. **Dominance pruning already exists** (`LOOKAHEAD_DOMINANCE_MARGIN`) but applies *after* the
   enumeration. It would have to move inside it to help.

Each of those is a change to the AI's search, which means each one needs the 1v1 grid re-run to
prove it did not change 1v1 play. That is a ticket of its own, and it is the thing standing between
here and a team grid.

---

## 4. What shipped

| file | what it is |
|---|---|
| `balanceScenarios.ts` → `teamScenario()` | composes an N-v-N matchup from the same registry the 1v1 grid uses; shared pile = concatenated member decks |
| `scratch/teamcanary.ts` | the liveness suite — stalls, FTK, turns, dead cards, first-mover edge |
| `scratch/teamcost.ts` | the 1v1 → 2v2 → 3v3 growth curve |
| `scratch/teamdecisions.ts` | per-decision timing — the count-vs-cost decomposition |

`teamScenario` deliberately adds **no engine machinery**. A team sim on a parallel code path would
answer a different question than the 1v1 grid does; keeping it on the same reducer, AI and scorer is
what makes the two comparable at all.

**The canary is not yet a standing gate.** The ticket wants it joining the standing suite, and it
can't until §3 is fixed — at 34s a battle it would add half an hour to every commit. It runs on
demand today.

---

## 5. What I'd want from you

- **Nothing is blocked and no numbers moved.** This is a skeleton plus two measurements.
- **The interesting decision is §3**: the branching fix is a real ticket, it touches the AI's search,
  and it needs the 1v1 grid re-run as its gate. Worth opening before any team balance work is
  planned, because none of it is affordable until then.
- **The §2 finding argues for reading team results as their own thing rather than as a correction to
  1v1 numbers** — a 27-turn game is a different game, not a longer one.

---

## 9. Addendum (2026-08-20): what this ticket did NOT deliver

Written after reading `tickets/98-team-sim.md` itself. The work above was built from a relayed
summary of the ticket, and the ticket has **four** deliverables, not two. Recording the gap rather
than letting "BUILT" stand for all of it:

| deliverable | status |
|---|---|
| 1. 3v3 runner, caster allocation exposed to the AI | **done** (§0 - it already existed) |
| 2. Owner rule for draw-triggered firmware — *propose, Henry ratifies* | **proposed below, unbuilt** |
| 3. Canary: ~6 comps (mono-element / spread / support-heavy), FTK, loops, **wasted energy**, entity-count tags | **partial** — 4 untyped comps; wasted energy now done; entity-count tags not reported |
| 4. The two audit tag lists written into the registry as annotations | **not started** |

### Wasted energy — measured, and it is a non-finding

The ruling makes this a measured metric with no pre-patch, on the theory that three energy pools
feeding one shared hand would leave members flush with nothing to cast. `scratch/wastedenergy.ts`,
sampling at the moment a side ends its turn:

| | pool left unspent at end of turn | living member-turns that spent NOTHING |
|---|---|---|
| 1v1 (baseline) | 12.5% | 0.0% |
| **3v3** | **11.5%** | **0.0%** |

**3v3 wastes no more energy than 1v1 does, and no member ever sat out a turn entirely.** The
predicted failure does not appear. Small sample (2 battles, 14 sampled turns) so read it as a
ranking, not a verdict — but it is the right shape of answer, and it argues against spending any
design effort on an energy-sharing patch.

### Deliverable 2: the owner rule, proposed

**The question.** Firmware that triggers on *drawing* — kraken_v1's ink-on-draw, and anything else
keyed to the draw phase — has an unambiguous owner in 1v1. In 3v3 the deck and the draw are
per-SIDE: the pre-turn draw is one event of `sum(cardDraw) - (N-1)` cards for the whole team. If two
members both run draw-triggered firmware, whose fires, and how many times?

**Proposed rule: the draw is one event per SIDE, and every living member's draw-triggered firmware
fires once against it — not once per card.**

The reasoning, and the two alternatives it beats:

- *Per card drawn* multiplies with team size **and** with `cardDraw`, which is the entity-count trap
  guardrail 2 exists to catch — it is the TREACHERY 3x feed in another costume.
- *First member only* makes the third slot's firmware silently dead, which violates the standing
  principle that a card or hook doing nothing for an OS should do something **else**, never nothing.
- *Once per member per side-draw* keeps each member's hook alive, scales linearly with how many
  members actually invested in it, and costs a team that stacks three draw-triggered OSes exactly
  what it paid for.

**This is a proposal, not a decision** — the ticket says Henry ratifies. It is unbuilt, and nothing
currently depends on it, because no team battle in the canary ran two draw-triggered OSes at once.

### Deliverable 4, still open

The entity-count and deck-size audit tag lists (TREACHERY's 3x feed, riptide, side-wide effects,
`RANDOM_ENEMY` dilution; valkyrie's reshuffle OS in a 27-card pile) are named in the ruling but not
yet written into the registry as annotations. That wants its own pass — it is a registry schema
question, not a measurement.
