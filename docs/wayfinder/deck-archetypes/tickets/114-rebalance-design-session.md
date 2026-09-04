# Ticket 114 — rebalance design session: three questions, in the order they should be answered

**Status:** OPEN, awaiting the session. Opened 2026-08-22 at Henry's request.
**This ticket is written FOR Henry to read**, not as a findings log — every number below is here only
because a decision hangs on it. The evidence lives in tickets 110 and 112.

**Nothing in here needs the `osvalue` probe.** Ticket 112's census already answered the structural
question — firmware does not scale at width, five of six subjects fire *less* per turn at 3v3.
`osvalue` measures what each OS is *worth*, which is input for tuning an individual deck later, not
for setting direction here.

---

## The one sentence

**At 3v3, offence scales with bodies and answers do not.** Control's *total* debuff output is flat
when it goes from facing one attacker to three (×0.86), so coverage per attacker collapses to
**×0.29**. Everything below is a consequence of that, or a second problem it revealed.

---

## Question 1 — should a control answer's output scale with the number of enemies?

**What is measured.** `panel-zoo` beats `panel-control` **88.3%** at 3v3 (full lookahead, beamless,
60 games). Zoo's own resource barely grows with width (Strengthened ×1.42); control's answers divide —
Weakened ×0.37 per body, Sharp ×0.36, Poison ×0.26. **The problem is coverage, not damage.**

Type advantage does not rescue it: `triple-huldra`, which holds an elemental advantage against all
three zoo decks, still loses to them **73%** at width. At 1v1 that same advantage is worth 67 points
and decides the matchup. A damage multiplier cannot answer three attackers with one debuff.

**Coverage is the lever, and it is much bigger than this ticket first said.** See the correction and
the measurement below.

> **CORRECTION, 2026-08-24.** This section previously read "scope alone is worth about +11.7 points"
> on the strength of `scratch/coverage.ts`. That number should not have been stated as a measurement,
> for two reasons. It came from **adding** four side cards to control's pile and comparing them
> against the same four flipped to Single — which prices "are side cards better than single cards",
> not "what if control's shipped answers reached the side". And it ran at **AI_LITE and was never
> confirmed at full**, against the protocol's own rule that a band verdict is never read off lite.
> `scratch/sidescope.ts` re-measures it properly, at full tier, on the shipped decks. The real number
> is far larger.

### The measurement (`scratch/sidescope.ts`, full tier, beam 8, 20 games, 3v3)

Control is the player side; zoo is the enemy; every arm changes exactly one property and throws if
the mutation did not take. The SHIPPED arm reproduces `weakarms.ts` row for row on shared seeds,
which is the harness check.

| arm | what changed | control wins |
|---|---|---|
| SHIPPED | — | **10.0%** |
| SIDE | the 4 shipped Weakened/Dazed cards get card-level `target: 'Side'` | **40.0%** |
| SIDE_NOCC | the same, widened to every soft debuff (adds `hexbloom` Poison, `frost_bite` Burn) | **55.0%** |
| SIDE_ALL | the same, widened to hard CC as well (adds `glacial_slam` Stun) | 80.0% *(lite only)* |

**Scope is worth +30 to +45 points, not +11.7.** It is the only lever measured in this arc that moves
control from unplayable to competitive at width.

**It costs the 1v1 grid nothing, and that is now measured rather than argued.** At width 1 the SIDE
arm is **bit-identical** to SHIPPED — same win rate, same turn count, same stacks landed — because a
side-wide debuff facing one body *is* a single-target debuff. No re-baseline exposure, no 1v1 gate
risk, no 3v3-reserved tag needed to protect the early run.

**Do NOT take SIDE_ALL.** Its +70 is mostly one card: `glacial_slam` in Side form stuns all three
attackers simultaneously, worth ~+35 of the total by itself. Side-wide hard CC removes turns rather
than shrinking them, and it is a different and far more oppressive card than a side-wide Weakened.
The scope rule should be written to exclude Stunned and Asleep.

**The other four levers, screened at lite for comparison** (all 3v3, vs SHIPPED 10.0%): control at
+50% HP → 15.0%; control's debuff cards at 0 Energy → 30.0%; all control card power ×1.5 → 35.0%.
Those are deliberately unshippable magnitudes, included to find which axis has headroom. **A +50% HP
buff — an enormous number — buys five points.** Control is not losing because it dies too fast, and
it is not losing for want of damage. It is losing because its answers reach one body in three.

**Options.**
- **(a)** A scope rule for answer cards — soft debuffs on designated answer cards reach the whole
  enemy side. Now the best-supported option by a wide margin. Henry's ruling that side-target cards
  are rare elite rewards still applies to *how they are acquired*; the measurement says the effect
  size is there. Open question is whether the rule attaches to specific cards or to a card tag.
- **(b)** Accept the ladder. Ticket 76 already found the wheel does not turn at 1v1 either; the roster
  may simply not have a rock-paper-scissors structure and the design could stop claiming one.
- **(c)** Something else entirely — the measurement says what is missing, not what should fill it.

**What is NOT known:** whether coverage at this level is *fun*, or whether it makes control's turns
feel like chores; and whether 55% against the strongest zoo panel is the target or an overshoot.

### The finding underneath all of this: control barely runs answers

Censused before any arm ran, across the three `panel-control` decks:

| deck | cards aiming an enemy-facing debuff |
|---|---|
| `kraken_v1` | **0** |
| `huldra_v1` | 1 — `hexbloom`, and it is Poison. Her Weakened comes from ALLURE_PROXY firmware, not cards |
| `draugr_v2` | 6 — `ice_spear` `killing_frost` `numbing_gale` `rimefrost` `frost_bite` `glacial_slam` |

**"Control's debuffs" has meant draugr_v2's six cards for this entire arc.** Every stack-count and
scope arm — including ticket 110's coverage collapse and `weakarms.ts`'s NONE/DOUBLE — has been
applying its treatment to one third of the panel. This is a candidate answer to question 2 as well:
control may be the weakest role at 1v1 partly because two of its three decks do not actually control
anything.

## Question 2 — control is ALSO the weakest role at 1v1, and its hole is RAMP

**This is a separate problem and it is easy to miss underneath question 1.** Re-measured on a fresh
seed base, 98 neutral cells, both samples agreeing inside the noise band:

| CONTROL vs | cells | fresh sample |
|---|---|---|
| BURST | 30 | 49.8% |
| CONTROL | 24 | 49.0% |
| **RAMP** | **41** | **37.6%** |
| ZOO | 3 | 41.7% |
| **overall** | 98 | **44.2%** |

Once elemental advantage is removed, **control is the weakest role at 1v1**, and its worst matchup is
**RAMP on the largest sample here**, not zoo. So a fix that only addressed width would leave a role
six points under on neutral ground in the mode players meet first.

**The decision:** is control a role that should beat something, and if so what? Right now it beats
nothing on neutral ground. Answering question 1 without answering this ships a role that is fixed at
the gym and still weak for the first half of every run.

## Question 3 — stacked-scaler comps: feature, or does the scaler need a condition?

**Created by the 2026-08-21 ruling, not by the card pool.** With duplicate species legal and the copy
cap gone:

| stacked comp | vs `panel-zoo` | vs `panel-control` |
|---|---|---|
| `triple-jormungandr` | **86.7%** | 93.3% |
| `triple-sleipnir` | **80.0%** | **100%** |
| `triple-hel` | **70.0%** | 83.3% |

Ticket 109 tested twenty-five stress comps against `panel-zoo` and none beat it (best 50%, mean 14.1%)
— but none of them could stack a species. **Three of five tried here beat it.** FTK 0 and truncated 0
throughout, so the hard gates are clean; it is the ceiling that moved.

**The likely mechanism: the copy cap was what bounded scaler density in the shared pile.**
`jormungandr_v1` carries `ink_stream`, the uncapped per-card-played scaler that both
`0-SCALER-IS-SHARED` and `0-RATATOSKR-V1-UNCAPPED` flag. Stacking the deck three times puts three
copies into one 27-card pile.

**Options.** Accept it as build-around freedom, which is a real roguelike pleasure and may be exactly
what the ruling was for — or put a CONDITION on the per-card scalers, since `0-NO-CAPS` rules out a
ceiling. Not a cap: a condition that makes the scaler pay less often when the pile is dense.

**What is NOT known:** whether these comps are *reachable* in a real run. A player has to actually
catch three of one species, and the acquisition rules are not settled. If a triple is rare, this is a
reward; if it is easy, it is the default build.

---

## The blocker: CLEARED 2026-08-22 — the re-baseline is done

**Ran in ~20 minutes, not the five hours this ticket first claimed.** That estimate was extrapolated
from ticket 109's 3v3 battle costs (~13s each) when 1v1 battles are ~0.3s — wrong by an order of
magnitude. Measured: ~40s a deck row on 2 lanes.

**The roster is healthy after tickets 111 and 113: mean 50.4% (was 50.3%), and ZERO decks outside the
35-80 band.** 185 of 960 cells moved 5+ points, but only two decks moved meaningfully, and each traces
to one change:

| deck | field | was | delta | cells moved 5+ | cause |
|---|---|---|---|---|---|
| `valkyrie_v1` | 64.8% | 46.3% | **+18.6** | 26/30 | ticket 113 — `ascension` dropping exhaust |
| `hraesvelgr_v2` | 44.9% | 55.9% | **-10.9** | 21/30 | ticket 111 — the self-draw fix |
| `hraesvelgr_v1` | 48.5% | 51.7% | -3.2 | 11/30 | ticket 111, same family |

Everything else sits within ±2 points, which is inside the seed-base noise band.

**`valkyrie_v1` +18.6 was predicted** — the five-opponent sample said +17.2, the full row says +18.6.
The shared-card consequence Henry accepted is exactly the size it looked.

**`hraesvelgr_v2` -10.9 was NOT predicted, and is the more interesting one.** She holds `slipstream`,
a loop-class card, with a circulating pool of 8 — never enough to stall a game, which is why ticket
111 recorded her as only "theoretically" able to reach the loop. But 21 of her 30 cells moved: she was
quietly drawing `slipstream` back to herself often enough to be worth **eleven field points**, across
most of her matchups, without ever producing a single undecided game. **A bug can be worth a lot
without ever looking like one** — she read as a healthy 55.9% deck the whole time.

She lands at 44.9%, still comfortably in band, so nothing needs doing. But her number was inflated,
and anything the arc concluded about her before today rested on it.

**Caveat: one seed base**, the same as the old grid. The ±2 movers are noise either way; the -10.9
deserves a second base before anyone tunes on it.

**`results/rebaseline/` holds the new rows and does NOT overwrite `docs/balance/deck_grid.json`** —
promoting it is Henry's call.

## (superseded) the original blocker text: every field number on the roster is currently PRE-FIX

Ticket 111 changed what a mid-resolution reshuffle feeds the PRNG, and the grid gate measured 97 of
155 sampled cells bit-identical — so **58 moved.** `docs/balance/deck_grid.json` has not been
regenerated since.

**Rebalancing against it means tuning to a stale instrument, which is exactly the
`0-CACHE-FIRMWARE-BLIND` failure mode.** The re-baseline is 960 cells at 30 iterations, ~5 hours, and
per the HANDOFF's own rule that is a standalone-runner job rather than a sandbox run.

**Recommended sequencing: start the re-baseline now, hold the session whenever suits.** The two do not
block each other — the session decides direction, the re-baseline supplies the numbers any tuning will
be measured against. What should NOT happen is a numeric pass landing before the grid is current.
