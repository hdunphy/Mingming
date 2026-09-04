# Preview parity (ticket 104): the preview must run the executor's math - P0 playability

- Type: wayfinder:task - P0 from playtest round 3 (2026-08-20). Three independent reports
  in one night: blood_rite previewed 4, dealt 5+5 (the above-50% conditional branch is
  invisible to the preview); fafnir's deep_vein previewed 9, dealt 36 (hoard/Energized
  scaling invisible); Henry: 'previews are broken almost everywhere... hard to play when
  you don't have the right information.' Branch archetype-web.
- Status: **CLOSED 2026-08-20** - suite green, 0 mismatches. 856 tests, tsc + build clean.

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

---

# Resolution

Report: [research/preview-parity.md](../research/preview-parity.md). ONE commit.

## The suite found the worklist, then the fix made it obsolete

`src/ui/utils/previewParity.test.ts` sweeps every attack card in every species' decks across EIGHT
sampled battle states and asserts `preview === HP the target loses`. First run: **52 mismatches
across 13 cards**, in five classes:

| class | example | previewed -> dealt |
|---|---|---|
| multi-hit (`count: 3` on one action) | `stone_flurry`, `crag_barrage` | 2 -> 6, 3 -> 9 |
| consume-scaling | `sun_devourer`, `momentum_crash` | 4 -> 0 empty / **25** full |
| self-aimed ATTACK previewed as enemy damage | `forage`, `desperate_strike` | 1 -> **0** |
| conditional branches | `blood_rite` (Henry's report), `berserk_rush` | 3 -> **8** (5+5) |
| firmware bonuses | `ragnarok_edge`, `cinder_lance`, `deep_vein` (Henry's report) | 21 -> 23, 9 -> 36 |

**The fix is not five patches.** Ticket 90 had already taught the preview about ONE class (the
turn-history scalings), which is precisely why teaching it about four more was the wrong move -
that leaves five places to drift instead of one. `computeDamagePreview` now plays the card through
the REAL reducer on a throwaway state and reports the target's HP delta:

```ts
const after = globalBattleEventBus.runMuted(() => battleReducer(state, {
    type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId: cardId },
}));
const damage = pool(state, targetId) - pool(after, targetId);
```

Precedent: `TacticalAI.getBestAction` already runs whole candidate SEQUENCES through the reducer
under a muted bus, dozens of times a turn. One card for a hover is the small version of that.

## Three details that make it safe rather than clever

1. **`BattleEventBus.runMuted()` (new).** `mute`/`unmute` were a plain boolean, so a preview
   computed from inside an AI simulation would have un-muted the AI's remaining candidates and
   leaked real events into the UI. `runMuted` saves and restores. Use it for any new muted section.
2. **Purity is ASSERTED.** The suite snapshots the caller's state before all 914 previews and
   compares after. A hover silently mutating the real game would be worse than the bug being fixed.
3. **The cheap playability gate stays in front** of the simulation, so hovering an uncastable card
   still costs nothing.

## The two definitions the ticket asked to pick and document

- **The number is HP LOST, not raw damage.** Lethal shows remaining HP and sets `lethal` -> a red
  **LETHAL** chip. This is also what makes the parity assertion meaningful: both sides of the
  comparison are the same quantity.
- **Multi-hit shows the TOTAL plus an `xN HITS` chip.** `blood_rite` reads 8, not 4-then-surprise-4.
  `hitCount` reads the `count` field, not the action count - `stone_flurry` is ONE action with
  `count: 3`, so counting actions would read "1" on the very cards the chip exists for.

## Gates

- **856 tests green** (3 new), `tsc` clean, `npm run build` clean.
- Parity suite: **914 checks, 0 mismatches, 0 state leaks.**
- **Coverage floors asserted** (>600 checks, >40 distinct cards) so the suite cannot pass by
  skipping. **Failure verified**: sabotaging the preview by one point produced 605 mismatches with
  a readable per-card report.
- The eight sampled states each switch on a previously-invisible class: `fresh`, `hurt` (below-50%
  branches + missing-HP firmware), `piles` (duality), `midturn`, `hoard` (`deep_vein`'s read),
  `counters` (triggered draw / discard), `loaded` (target statuses), `shielded` (BarkShield).

## Not covered, recorded

- **Only the hovered target.** Correct for 1v1; revisit with 3v3 (ticket 98).
- **A card that deals the target no damage shows NO preview**, which is the pre-existing
  `damage: 0` contract. An explicit "0" for an empty `sun_devourer` would read better than no chip
  at all - small, separate.
- **Randomness** resolves once for the preview and again for real. Nothing to disagree about in
  1v1; not a guarantee in 3v3.
