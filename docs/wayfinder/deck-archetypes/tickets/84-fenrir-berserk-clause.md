# Fenrir's berserker clause + sleipnir's discard payoff (ticket 84)

- Type: wayfinder:task - Henry-directed, 2026-08-18.
- Status: **closed** (2026-08-18)

Henry's pick off ticket 83's two reports: *"Let's go with A for fenrir and war_molt for sleipnir."*

| deck | before | after | change |
|---|---|---|---|
| `fenrir_v1` | 35.5% | **38.9%** | UNBOUND_KERNEL's original text restored (**1 Strengthened + 2% recoil**) plus *"Fire attacks deal up to 50% more damage, scaled by how much of your max HP is missing"* |
| `sleipnir_v2` | 42.4% | **57.0%** | `tailwind` -> `war_molt` |

Full 960-cell grid at 30 iterations. Roster: absolute **100% cells 54 -> 48**, out-of-band cells
**306 -> 297**, 0% cells unchanged at 50, NEUTRAL absolutes unchanged at 13/12, FTK 2 (both
accepted). **All 32 decks stay inside the 35-80 band**, and the roster now spans 36.1 to 68.7 - the
tightest spread measured. Redlines **52 -> 51**. 8-DIFF 5 of 67 rows, all fenrir or sleipnir.
844/844 tests (one new).

## fenrir_v1 - the recoil is back, and now something pays for it

UNBOUND_KERNEL reads: *"Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage. Fire
attacks deal up to 50% more damage, scaled by how much of your max HP is missing."*

Ticket 82 had deleted the recoil because nothing it bought could be found; ticket 83 found that the
recoil was never the problem, it was **unpaid** - 1 HP an attack for +5.6 power on `ragnarok_edge`,
and `berserk_rush` (which needs 50% missing) never switched on at all. Option A restores the
original text word for word and adds the clause that makes the price an investment.

**The bonus had to be scaled, not flat.** Same +20% ceiling, measured both ways: flat read 34.8%
field - *below* the recoil-less build - and scaled read 40.1% with the recoil restored, halving her
0% cells. A flat bonus is a power increase that prices in against everyone equally; one keyed to
the state the deck is trying to reach pays where she was actually losing. Her zero cells went
**4 -> 3** and her 100% cells **4 -> 2** - she is winning more *and* blowing out less.

Implemented as firmware, not data: `HookFactory`'s `MISSING_HP` scaling key resolves the TARGET's
missing HP, and this keys off the owner's. `OS_KNOBS.fenrir.berserkPct` is the dial. New unit test
in `OSGapClosures.test.ts` pins the ordering (full health = no bonus, hurt = more) rather than an
exact product, because the bonus floors per hit.

**Recorded in the firmware comment so nobody re-tries it: do not raise the recoil.** 8% (5 HP an
attack, enough to actually reach the berserk threshold) measured **20.2%** with 19 zero cells.

## sleipnir_v2 - the discard deck finally has a discard payoff

`tailwind` was **47% dead, 34% played, zero damage** - a draw card on a deck whose OS already fills
the hand. `war_molt` (1e Air, 15 power, **when discarded: gain 2 Strengthened**) is the first card
in her list that rewards the thing `lance` and `cavalry_charge` do for a living.

**It stacked with ticket 83's token buff far beyond the single-arm read.** `war_molt` measured 45.9%
alone against the pre-83 build; with `hoof_strike` at 15 it lands **57.0%**. Henry's call, asked and
answered mid-ticket: **keep both.** She goes from the roster's worst deck to its upper third in two
tickets, with **zero 0% cells** and one 100% cell.

## Next

1. **`kraken_v2` is the floor at 36.1%**, then `draugr_v2` 36.7 and `sleipnir_v1` 36.8 - all inside
   the band, so the floor work is done for now and the next pass is a spread pass, not a floor one.
2. **`sleipnir_v1` is now 20 points behind her sibling** (36.8 vs 57.0) and `os:sleipnir` sits at
   15% - the widest OS-variance gap on the roster. Diagnostic-only per policy, but worth a look.
3. The three Air discard payoffs still unused (`feather_cache`, `sky_burial`, `carrion_swoop`) are
   a ready-made buff lever for `sleipnir_v1` if she needs one.
4. Still open from earlier: `hoardbreaker`, `ember_mend`, `blood_rite`'s backwards branches,
   `avalanche`'s uncapped rate.
