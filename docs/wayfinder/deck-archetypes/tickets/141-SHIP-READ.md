# Ticket 141 — ship read (2026-09-05)

Arm B = 141 on HEAD, `scratch/top30.txt` × the ticket-140 panel, 10 battles a comp, panel at 10
paired iterations (`results/compgrid_armB`; 125 duplicate rows from a double launch, identical,
deduped). Baseline = the same 30 comps in the ticket-140 grid after round 2, 30 battles a comp.
Arm A (141a alone) was skipped: the gym check had already shown the package holds the turn floor,
and the baseline is free.

| | baseline | arm B |
|---|---|---|
| mean of the 30 | 73.7 | 56.7 |
| sd | 8.7 | 21.8 (a re-sort of a list picked on the old roster — expected) |
| kraken_v1 comps (27 of 30) | 75 | **53** |
| the other three (all fenrir_v1 + skoll_v1 + X) | 66 | **90** (100 / 100 / 70) |
| average turns | 4.9 | **5.22** |
| panel round robin | zoo 79 / refA 68 / ctrl 47 / ramp 36 / refB 20 | zoo 50 / refA 58 / **ctrl 62** / ramp 39 / refB 41 |

**Decision: 141 ships as the package (arm B), no trim.** The kraken_v1 gap closed (inverted, in a
sample that was 90% kraken comps), the panel's spread fell from 59 points to 23, control is now the
best archetype comp, and games got longer, not shorter. Per-firmware over the 30: every body fell
except fenrir_v1 (65 → 72) and skoll_v1 (65 → 73).

**The next outlier is the Fire Strength pair**, which Henry found in playtest before the grid did
(Unbound Fang at 19 stacks, 840 damage). Three things landed on it at once: skoll_v1's 1v1 lift
(sun_devourer 30), TREACHERY reading three bodies, and fenrir_v1's ally-Strength hook feeding an
uncapped reader that never spends. Trim order: **143b first** (Unbound Fang spends half its pile),
then 141b's ally hook if the pair is still on top, per the ticket-141 §4 order. skoll_v1 is not
touched — she is in band at 1v1 for the first time.

**Follow-up grid.** The ticket-140 panel is stale (its zoo is a coin flip now), so after 143 lands:
one fresh round-1 grid, all 144 comps, with the refreshed panel now in `compgrid.mjs` (zoo,
control, fenrir_v1 + skoll_v1 + jormungandr_v1, kraken_v1 + jormungandr_v1 + huldra_v2, ref a) —
`node scratch/compgrid.mjs --rounds 1 --panel-iters 10 --lanes 4`, ~1,440 battles, overnight.
That grid is the new baseline for the ticket-140 doc's comps.

Caveats: 10 battles a comp is ±15 on any row; the "100"s are 6/6 and 10/10. Read the aggregates.
