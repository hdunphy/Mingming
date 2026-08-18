# hel_v1 fixes (ticket 78): AI end-of-turn awareness, stance bonus, purify cut

- Type: wayfinder:task - Henry approved all four of ticket 77's recommendations, 2026-08-17.
- Status: **closed** (2026-08-17)

## Shipped

1. **`TacticalAI.statusValue` now prices the stances.** They fell through to `default: return 0` -
   **stances were worth ZERO to the search**, so the AI could not see any reason to end a turn
   holding one. Not a sequencing heuristic: two cases in the same table that prices every other
   status. `LightStance` = one opponent turn of throughput x the reduction (one turn, not the
   status horizon - a stance lasts until its holder casts the other element); `DarkStance` = the
   same halved, because Light pays on the opponent's certain next turn while Dark pays only on
   your own, only if you attack first, and same-turn Dark damage is already visible to the search.
2. **`STANCE_BONUS` 0.30 -> 0.35** (not the 0.50 Henry first picked - see below).
3. **`hel_v1`: `purify` -> a second `eclipse`.**

Left alone per Henry: `eclipse` and `shadow_claw` stats.

## Result

**`hel_v1` 24.7% -> 59.8% field, five 0% cells -> none, eight band violations -> four**, on the
full 31-deck grid. Report: [research/hel-v1-fixes.md](../research/hel-v1-fixes.md).

**The real AI fix beat ticket 77's hand-written `reserve` policy** - 31.4% against 29.2% - because
it weighs the stance against everything else instead of blindly reserving a card. Turns ending out
of Light while holding a castable Light card: 5.5% -> 0.7%.

**Two corrections to ticket 77 that changed what shipped:**

- Its +7.2-point `purify` arm swapped in a THIRD `nights_bite`, which the deck rulebook forbids
  (max 2 copies). Re-swept legally: a second `eclipse` 46.7%, `dawnstrike` 42.5%, `lumen_surge`
  36.4%, `hamstring` 34.7%, keep `purify` 31.4%.
- Its 0.50 stance bonus was measured on the BROKEN AI with `purify` still in. All three changes
  stack: with the other two shipped, 0.50 gives **74.0% field and eight cells above 90%** - second
  worst deck to fourth best, trading low-end blowouts for high-end ones. Re-swept: 0.40 -> 64.9%,
  **0.35 -> 59.8% and the only arm with no absolute in either direction**, 0.30 -> 53.1%. Henry
  picked 0.35.

0.50 would have cleared the `os:hel` section-2.3 redline and 0.35 does not (2.0% -> 17.0%). That
is the deliberate trade: §2.3 is a demoted diagnostic, field win rate is a primary instrument.

## Gates

8-DIFF **3 of 67 rows, all hel** (`os:hel` 2->17%, `mirror:hel` 46->50.5%, control-vs-hel_v1
4->0% i.e. she now beats control 100%). Redlines 54 -> 54, no card-budget change. 842/842 unit
tests.

**Full 960-cell grid: the roster got healthier, not just her.** Absolute 0% cells 84 -> 80,
absolute 100% 83 -> 78, NEUTRAL absolutes 38/38 -> 34/33, band violations 420 -> 411, FTK 2 -> 2.
Every other deck moved -1.0 to -2.0 points, which is the arithmetic of one deck getting stronger.

## Open

`os:hel` is still a 2.3 redline at 17%, and **`hel_v2` (81.4% field, four 100% cells) is untouched**
- she is the remaining half of this species. `shadow_claw` is still 1,611 casts at 0.9 damage.
