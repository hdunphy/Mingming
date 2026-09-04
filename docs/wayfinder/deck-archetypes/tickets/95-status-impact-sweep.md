# Status re-denomination grid (ticket 95) - measured, STOP for Henry's pick

- Type: wayfinder:research. Branch `archetype-web`. **Nothing shipped** - `STATUS_MODEL` ships at
  the live values, 851 tests unchanged.

Report: [research/status-grid.md](../research/status-grid.md).

Both shapes are now one switchable model (`STATUS_MODEL` in `core/Hooks.ts`): PERCENT multiplies
damage per stack against a cap, POWER adds power per stack before the divisor - the ticket-26 law,
so it rides STAB and resistances and the scorer can price it. Eleven arms: percent {2,4,6}% x cap
{25,40,60}%, and power {+1,+2}.

## The three findings

1. **POWER is the only thing that has ever moved the wall.** `gullinbursti_v1` beats `fafnir_v2`
   **100% in every percent arm** and **70.0% at POWER+1, 62.5% at +2**. Ticket 94 called that cell
   untunable and earned it - a 62% shield cut moved it to 98.3%. Fafnir's uncapped Strengthened
   count finally buys power that punches through a wall a +25% multiplier could never scratch.
   **The re-denomination gives a beaten deck a second lever, which is the 0-TWO-LEVERS law.**
2. **Uncapped power makes stack ENGINES runaway.** `sleipnir_v1` 43.3% -> **85.5%** at +1 (88.8% at
   +2): his OS grants 2 Strengthened per 0-cost card and his deck is all 0-cost cards. The duality
   cancel only valves a deck that faces another status deck; against one that applies none there is
   nothing eating the stacks. **Bound the GENERATION, not the effect** - capping the effect is what
   made statuses invisible in the first place.
3. **Every arm makes the draugr/huldra tug-of-war worse** - 15.0% live, 2.5-7.5% everywhere else,
   including both power arms. When statuses matter more, the side that applies more of them wins
   harder. That cell needs the cancel rule or a second lever for draugr, not a denomination change.

## Recommendation

**POWER +1**, conditional on bounding stack generation first. The feared raw-stack double-dip did
not appear at +1 (`skoll_v2` -3.2, `gullinbursti_v2` -2.9). Raising the percentages instead is
strictly worse: PCT6/cap60 inflates `huldra_v1` to 86.3%, leaves the wall at 100.0% and drops the
tug-of-war to 2.5%.

**Henry picks.** Blast radius when he does: `powerscale` status prices, cleanse/removal premiums
derived from them, and `TacticalAI.statusValue` all encode 2%-per-stack arithmetic.
