# Preview parity (ticket 104): the preview must run the executor's math - P0 playability

- Type: wayfinder:task - P0 from playtest round 3 (2026-08-20). Three independent reports
  in one night: blood_rite previewed 4, dealt 5+5 (the above-50% conditional branch is
  invisible to the preview); fafnir's deep_vein previewed 9, dealt 36 (hoard/Energized
  scaling invisible); Henry: 'previews are broken almost everywhere... hard to play when
  you don't have the right information.' Branch archetype-web.
- Status: **open**

## The systemic fix, not whack-a-mole

Ticket 90 fixed SCALING previews by extracting getDamageScalingMultiplier - but
conditionals (+X if HP/status), multi-action cards, and state multipliers (hoard,
GLACIAL +25%, statuses at +1/stack) each have their own drift. The fix is a **PARITY
TEST SUITE**: a property test that, for every card in the registry across sampled battle
states (HP bands, status piles, hoard levels, both stances), asserts preview total ==
executed total on the same state. Every mismatch the suite finds this first run is the
repair worklist; the suite then joins the standing gates so preview drift can never ship
again (same move as the band census closing the FTK blindness).

Repro material: playtest-results/round-3/*.scenario.json (t2/t4 snapshots likely hold the
blood_rite and deep_vein states). Multi-hit rendering (5+5) should display as its parts
or its total consistently - pick one, document it. Gates: suite green with zero
mismatches, tsc/vitest/build. ONE commit.
