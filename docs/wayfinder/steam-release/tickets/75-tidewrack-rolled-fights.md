# The gauntlet's first two fights are the same fight at every gym — and the counter-party is what differs (ticket 75)

- Type: wayfinder:grilling
- Status: open
- Assignee: 
- Blocked by: nothing — the structural finding is verified (below); the comparison arm is not yet run
- Phase: Vertical Slice

## Why this exists

[Ticket 74](74-tidewrack-comp-swap.md) fixed Tidewrack's boss fight — 30.0% → 75.0%, now the best of
its three fights rather than the worst — **and the gauntlet still failed**, at 28.1% compound
(favourable) against a 60 ± 5 target. Closing 74 on its own terms was right; the number it left
behind is not 74's problem, and it is not a number to leave in a closed ticket.

**The old 30% boss was masking a gauntlet-wide shortfall rather than being it.** Three fights at
~65% multiply to 28%, not to 65%.

## The structural finding, verified 2026-08-31

Two facts from the code, both checked rather than reasoned:

1. **`rollGauntletFight` consults `authoredBossFor` for the BOSS SLOT ONLY.** Fights 1 and 2 draw
   from `regionSpeciesPool` and carry **no Driver** (`enemyDrivers` is set only when `authored` is
   defined, `gauntlet.ts:403`). No gym-authoring ticket has ever touched two of the three fights the
   gym is graded on.
2. **`regionSpeciesPool` is the UNION across all three biomes** — and since `walkOrderFor(G)` is
   three steps along a 3-cycle over `LAUNCH_ELEMENTS` (`[Fire, Water, Nature]`), every gym's region
   covers all three elements. So the union is the same set everywhere.

Confirmed empirically — twelve samples of `gauntlet:fight0` at each gym:

| gym | biome walk | rolled enemy pool (fights 1-2) | favourable player lineup |
| --- | --- | --- | --- |
| Emberfall | Fire → Water → Nature | **all 12 tuned OS ids** | `kraken_v1, jormungandr_v1, fenrir_v1` |
| Tidewrack | Water → Nature → Fire | **all 12 tuned OS ids** | `ratatoskr_v1, huldra_v1, kraken_v1` |
| Rootfall | Nature → Fire → Water | **all 12 tuned OS ids** | `fenrir_v1, skoll_v1, ratatoskr_v1` |

**The enemy side of fights 1 and 2 is IDENTICAL at all three gyms.** The only thing that differs is
the party the `favourable` arm brings, because `targetElementFor` picks it against the gym's element.

So the question is not *"why are Tidewrack's rolled fights badly authored"* — they are not authored
at all, and they are the same fight Emberfall's are. The question is **why the Nature-leaning
counter-party loses to a mixed pool that the Water-leaning one beats.**

## The numbers, with the caveat that matters

| arm | fight 1 | fight 2 | boss | compound |
| --- | --- | --- | --- | --- |
| Tidewrack, favourable (n=60, toolbox) | 61.7% | 66.7% | 68.3% | **28.1%** |
| Tidewrack, `tidewrack_playtest_v1` (n=60, toolbox) | 70.0% | 73.3% | 75.0% | **38.5%** |
| Emberfall, prepared **(ticket 68, DIFFERENT CONDITIONS)** | 83.3% | 90.0% | 80.0% | 60.0% |

**Do not rule off that third row.** Emberfall's fights 1 and 2 have not been re-measured at n=60 with
the toolbox on the current tree; 83.3/90.0 comes from ticket 68 under its own conditions. The gap
looks like 20+ points and it may be, but *the comparison has not actually been run*, and this ticket
should not repeat ticket 72's mistake of putting two differently-taken numbers in one table and
reading the difference.

One thing the two Tidewrack rows do support: the handbuilt party beats the generated one by ~8 points
per fight, using the same element. **Synergy is worth something but it is not worth twenty points**,
so party construction alone is unlikely to be the whole story.

## Questions for Henry

**Q1 — Is the target right for the fights it grades?** 60% compound needs ~84.3% per fight. Fights 1
and 2 are unauthored rolled teams from the full 12-OS pool, one of which will usually have the type
advantage over the player by construction. Is ~84% a reasonable thing to ask of a fight nobody
designed, or does the gauntlet want a target that grades the *boss* and treats the lead-ins as
attrition? This is a question about the gate, not about Tidewrack.

**Q2 — If the fights should get harder to lose, which lever?** Candidates, none of them costed yet:
authoring fights 1 and 2 per gym (expensive, three per gym); weighting the rolled pool toward the
gym's own element; giving the lead-ins a weaker AI tier or fewer IVs; or leaving them and moving the
target. Henry's call which is even worth measuring.

**Q3 — Is this really a Nature problem?** The Nature counter-party underperforms against an identical
pool. That may be the same phenomenon as
[ticket 73's launch triangle](73-launch-type-triangle.md) — 17.5% of EA matchups decided at character
select, driven by the 1.5× multiplier — surfacing in the gauntlet rather than in the deck grid. If so
this ticket and 73 share a lever and should be ruled together rather than separately.

## The first build step, whatever the rulings

**Re-measure Emberfall and Rootfall's gauntlets at n=60 with the toolbox on the current tree**, so
all three gyms are one comparable table. Roughly 3 hours per gym on a 2-core container; ~6 hours for
the two. Nothing above should be ruled on until that table exists — it is the difference between
"Tidewrack is 20 points behind" and "every gym's lead-ins are soft and Emberfall's old number was
taken differently".

## Done when

The three-gym per-fight table exists at matched conditions, Q1-Q3 are ruled, and either a lever is
applied and measured or the gauntlet target is restated with the reasoning recorded.

## Notes for whoever takes it

- **Do not touch `TYPE_CHART`** — 1.5/1.0 is deck-archetypes ticket 35's ruling with 1,440 games per
  variant behind it, and ticket 73 carries the same warning.
- `authoredBossFor` returning `undefined` for fights 1-2 is deliberate (ticket 68 ruling 6 authored
  gyms one at a time); it is not a bug to fix on the way past.
- The `favourable` arm builds all-v1 or all-v2 teams and deals the 18-card start deck. Henry has
  already said what that is worth: *"you just threw together all V1 decks and the v1s going against
  the water boss do not have any synergy."* `handbuiltParties.ts` exists for the other half.

## Resolution

_(open)_
