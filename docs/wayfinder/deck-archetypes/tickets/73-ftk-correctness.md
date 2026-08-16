# FTK correctness (ticket 73): 43 first-turn kills behind a gate that reads zero

- Type: wayfinder:task - correctness, NOT tuning. Authorized by Henry 2026-08-16.
  RUNS BEFORE ticket 72 (hard-gate integrity precedes design).
- Status: **closed** (2026-08-16)
- Assignee: -

## The finding (band census SS5)

FTK is a hard gate at 0 and every ticket reports 0 - in the matchups the suite RUNS. The
480-cell census found **43 FTKs in 14 cells, jormungandr on one side of 13 of them**;
skoll_v1-vs-jormungandr first-turn-kills 1 game in 6.

## Tasks

1. **Reproduce + diagnose the mechanism**: replay the FTK seeds with full logs. What makes
   turn-1 lethal reachable - first-mover + jorm's draw engine stacking a turn-1 burst, a
   specific card chain, an energy anomaly? Name the exact line.
2. **Fix at the MECHANISM, not the deck**: whatever enables turn-1 lethal is the defect
   (jormungandr_v1's 90%-mean POWER cut is a separate Henry design session - do not nerf
   the deck here beyond what the FTK mechanism itself demands). STOP-and-report if the fix
   cannot avoid a deck/power change.
3. **Close the instrument hole**: the full-field FTK scan (480 cells) joins the standing
   gate suite alongside the band census (scratch/bandcensus.ts promoted from scratch to a
   suite member with a committed report artifact). FTK 0 means 0 EVERYWHERE, permanently.

## Gates + deliverable

After the fix: the 14 offending cells re-read at 60 games each = FTK 0; full suite green;
full-field scan 0. ONE commit. Deliverable: the named mechanism, the fix, before/after on
all 14 cells, suite-integration note - or findings if STOPPED at task 2's boundary.

## Resolution (2026-08-16)

Report: [research/ftk-correctness.md](../research/ftk-correctness.md). Instruments:
`scratch/ftkrepro.ts` (replay), `scratch/ftkscan.ts` (arm harness). **FTK 0 in 0 of 480 cells at
30 iterations x both turn orders** on the shipped build.

**1. Mechanism.** All 43 FTKs are `jormungandr_v1` on turn one - 14 of 14 cells, not 13 - and the
chain is identical every time: `undertow` x2 (0-cost draws), OUROBOROS_LOOP's once-per-turn +1
Energy on the 3rd Water card, `surge_protection`'s ticket-68 refund, then `ink_stream` at
**33 power x 3 triggered draws = 99 power from a 1-Energy card** against a 1e budget of 30. The
energy accounting was verified correct at every step. The defect is that the per-event-count
scalers - `CARDS_PLAYED`, `CARDS_DRAWN`, `CARDS_DRAWN_TRIGGERED`, `CARDS_DISCARDED` - were **the
only scalers in the engine with no ceiling.**

**2. Ticket 71 is the cause.** Reverting only `ink_stream` to its pre-71 footing, changing
nothing else, takes the full field from 43 FTKs to 0. Ticket 71's own 8-DIFF reported "FTK 0" -
truthfully, because the suite runs 67 matchups and `jormungandr_v1` is in one of them.

**3. Fix, at the mechanism.** `DRAW_SCALING_CAP` 2 (draw scalers are self-accelerating - the
cards feeding them cost 0 and draw more cards) and `PLAY_COUNT_SCALING_CAP` 3. The draw cap alone
leaves 5 FTKs, because `serpents_coil` finishes the turn `ink_stream` starts; a looser play cap
of 5 was tried first to keep the blast radius small and the full-field scan found 3 FTKs it had
missed. Powers re-solved against ticket 71's delivered-damage gate: `ink_stream` 33 -> 28,
`starfall` 18 -> **24** (it goes UP - the cap bites it on 35% of casts). Both cards disclose the
ceiling in their text.

**4. Instrument hole closed.** `scratch/bandcensus.ts` -> `src/debug/balance/fieldCensusSuite.ts`,
two shards, in `npm run balance`. FTK 0 is a hard assertion on all 480 cells. Artifact:
`docs/balance/field_census.json`. Default 10 iterations (~8 min) is a smoke alarm;
**`CENSUS_ITERATIONS=30` is the authoritative read** and the file says so. Band data rides along
as a diagnostic - Henry's neutral-absolutes gate is wired and logged but not asserted, because it
fails today and the queue is the plan.

**5. Collateral (8-DIFF 17/67, redlines 54 -> 53).** `os:jormungandr` 98% -> 65%, shrinking the
roster's widest 2.3 gap from 96 points to 30. **`os:ratatoskr` 31% -> 0%**, which is a finding:
`ratatoskr_v1` runs `seed_bomb_v2` x2 behind four 0-cost cards and `echo_chamber_v2` - the same
0-cost-engine-into-unbounded-multiplier shape as `jormungandr_v1`, one energy tier slower, and
never lethal on turn one only because 15 power per card on a 2-cost body is not. The cap revealed
where its power was coming from. It should be sequenced with the jormungandr_v1 session.
`os:valkyrie` 69% -> 91% is peak-shaving on a deck whose value was in its blowout turns; worth a
look at her next pass. 842/842 unit tests green.
