# Full balance pass and state-of-the-roster report (ticket 85)

- Type: wayfinder:research - Henry-directed, 2026-08-18. **Report only, nothing shipped.**
- Status: **closed** (2026-08-18)

Henry: *"Can you do a full pass and generate a comprehensive balance report of where we stand
today."*

Report: [research/state-of-the-roster.md](../research/state-of-the-roster.md).
Dashboard: `docs/balance/roster_dashboard.html` - field rates, the full 32x32 heatmap, type and
role views, card health, gates.

## What was re-measured

- **960-cell deck grid**, 30 iterations per turn order, 57,600 games (`scratch/deckgrid.ts`).
- **Deck report over all 32 subjects at 60 iterations** - play rates, dead rates, static vs
  measured card scores, control floor. The previous one was from 2026-08-12 and predated 18 tickets.
- `npm run balance` - card budget, OS variance, archetype gauntlet, field census.

## Headline

**32/32 decks inside the 35-80 band, spread 36.1 - 68.7, and the three aggregate gates all pass.**
Against pre-79: absolute 0% cells 80 -> 50, 100% cells 78 -> 48, NEUTRAL absolutes 34/33 -> 13/12,
out-of-band cells 411 -> 297, FTK 43 -> 2 (both accepted), spread 56.7 -> 32.6 points.

## The three findings that matter

1. **`audhumbla_v2` is one side of 18 of the 25 remaining neutral absolutes.** 43.0% field, 16
   out-of-band cells all neutral, the longest games on the roster at 11.2 turns, and `os:audhumbla`
   is a 100.0% wipe against her own sibling - the strongest deck in the game. One deck is half the
   remaining bug list.
2. **The archetype wheel does not turn - it is a ladder, and the roles are uneven in size** (BURST
   13 decks, RAMP 9, CONTROL 7, ZOO 3). Not one leg of ZOO > RAMP > CONTROL > ZOO holds. This is a
   design call for Henry: rebalance the role counts, or retire the wheel and let the type chart
   carry the strategy layer alone.
3. **The type chart needs nothing.** 84.1 / 50.1 / 16.0 across advantaged / neutral / disadvantaged,
   one-directional, and no 0% cell exists anywhere in an advantaged matchup.

## Also recorded

- **Long games are where the absolutes live.** `audhumbla_v2` 11.2, `valkyrie_v1` 8.0, `draugr_v2`
  7.8, `huldra_v1` 7.7 against a 5.2 median - and all four carry double-digit out-of-band counts.
- **32 of 211 card rows are at or above 35% dead**, worst `hoardbreaker` 89%, `barrow_king` 86%,
  `ash_communion` 83%, `all_in` 82%. Two caveats on the metric: it cannot see discard value
  (`war_molt` reads 62% and is working), and it punishes `ymir_v2` for `maxCardsPerTurn: 1`.
- **28 of the 42 card-budget redlines are 0.1-0.4 over and are noise.** The real ones are scorer
  blind spots: `hexbloom` static 16.5 vs measured 63.0, `wither_feast` -10.8 vs 12.8.

## Next, in order

1. `audhumbla_v2` 2. the long-game cluster (`valkyrie_v1`, `draugr_v2`, `huldra_v1`) 3. `ymir_v1`'s
five 100% cells 4. the dead-card sweep 5. the archetype-role design call 6. the scorer's blind spots.
