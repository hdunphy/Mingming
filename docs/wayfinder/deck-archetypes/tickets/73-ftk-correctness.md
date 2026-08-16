# FTK correctness (ticket 73): 43 first-turn kills behind a gate that reads zero

- Type: wayfinder:task - correctness, NOT tuning. Authorized by Henry 2026-08-16.
  RUNS BEFORE ticket 72 (hard-gate integrity precedes design).
- Status: **open**
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
