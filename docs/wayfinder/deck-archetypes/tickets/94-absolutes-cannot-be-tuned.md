# The 0/100 pass: they cannot be tuned (ticket 94)

- Type: wayfinder:task - Henry-directed, 2026-08-19. **Nothing shipped, deliberately.**
- Status: **closed** (2026-08-19). Branch `archetype-web`.

Reports: [research/absolutes-diagnosis.md](../research/absolutes-diagnosis.md) (the mechanisms),
[research/absolutes-cannot-be-tuned.md](../research/absolutes-cannot-be-tuned.md) (the measurement).

## Headline

**Every arm moved field win rate and not one moved a cell.**

- `audhumbla_v2` with NOURISH at 60% **and** her biggest heal swapped for a 108-power nuke: still
  **0 of 60** against `gullinbursti_v1`, `huldra_v1` and `valkyrie_v1`. Her field rose 42.2% ->
  56.7% on the way.
- `gullinbursti_v1` with Bark Shield **capped at 8% of maxHP** - against the 21% he reaches today -
  still beats `fafnir_v2` **98.3%** and `audhumbla_v2` **100%**.
- `fafnir_v2` at attack 74 (+6 over ticket 82's bump) gains 7 points of field and stays at 0 in both
  cells.

These are not near-misses. They are throughput mismatches of a different order: `audhumbla_v2` does
not need 20% more damage to beat a wall deck, she needs three or four times more, at which point she
is a different deck.

## The reusable part

`scratch/cells.ts` - measures the SPECIFIC matchups at 30 iterations instead of the field. **Field
win rate is the wrong instrument for an absolute**: it moved fifteen points across arms that changed
nothing at the rails, and `offenders`' `<10%`/`>90%` counts include type-advantaged cells, which the
bucket standard exempts. Any future work on an absolute starts here.

## Henry's decision

1. **Accept them as counter-texture**, on the same argument the bucket standard already makes for
   typed cells - the shipped game is 3v3 with simultaneous actives, so these decks never meet alone.
   A change to the STANDARD, not the decks; retires 16 of 20.
2. **Rebuild the two losing decks** when they come up for their own passes - `audhumbla_v2` needs a
   win condition that is not a fraction of her healing, `fafnir_v2` needs a shield-piercing payoff
   (which needs engine support that does not exist).

Recommended: (1) now, (2) later. The alternative available today is a fifteen-point power increase
to `audhumbla_v2` that fixes none of the cells it was aimed at.
