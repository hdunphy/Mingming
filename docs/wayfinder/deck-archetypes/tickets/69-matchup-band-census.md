# Matchup band census (ticket 69): how much of the roster breaks the 10-90% rule?

- Type: wayfinder:research - REPORT-ONLY. Henry-approved standard (2026-08-16, answer 5 to
  ticket 67: *"I think we target 10%-90% single deck matchup bands. I.e. no single matchup
  should win >90% of matches"*).
- Status: **closed** (2026-08-16)
- Blocked by: ticket 68 (behaviour change - census must measure the post-fix world).

## Why

**This is a NEW roster-wide standard and nothing has ever been measured against it.** Every
gate to date is an aggregate - field win rate, control floor, mirror - and an aggregate cannot
see a 100% matchup. Ticket 67 found kraken winning 100% into fenrir and 0% into eight species;
Henry's answer 2 says neither end is acceptable identity.

Before anything is designed - and specifically before deciding whether the ELEMENTAL SYSTEM
needs a shape change (ticket 35's own note says shaving 1.5 does not work and the fix would be
a change of mechanism) - size the problem: is >90%/<10% a kraken problem or a roster problem?

## Task

All 32 decks x 15 opponents, 30 iterations x both turn orders. For each deck-vs-species cell,
the decisive win rate. Report:

1. **Violation count and rate** - cells >90% and <10%, per deck and roster-wide.
2. **Type correlation** - what share of violations sit in an ADVANTAGED or DISADVANTAGED
   bucket (per `ElementalMatrix`) versus NEUTRAL. This is the number that decides whether the
   type system is the cause.
3. **The worst offenders** - decks with the most violations, and the cells at 100%/0%.
4. **Distribution shape** - how many cells sit inside 10-90 today; what the roster would look
   like if only type-driven violations were fixed.

## Deliverable

research/matchup-band-census.md (CRLF), the verdict on kraken-problem vs roster-problem with
the numbers behind it, a recommendation on whether the elemental shape change is warranted,
questions for Henry. ONE commit. No changes executed.

## Resolution (2026-08-16)

Report: [research/matchup-band-census.md](../research/matchup-band-census.md). Data:
`docs/balance/matchup_band_census.json`. Instrument: `scratch/bandcensus.ts`. Measured at
`198ac2c`, i.e. after tickets 68 and 71.

**46.5% of 480 cells break the band** (110 above 90%, 113 below 10%, 52 at an absolute 100% and
56 at an absolute 0%). **No deck of the 32 is clean.** Removing kraken entirely leaves 45.1% —
**a roster problem, not a kraken problem**, which answers the ticket's question.

Three findings beyond the brief:

1. **The distribution is bimodal.** 231 of 480 cells sit in the two extreme deciles and 19 sit
   in the 50-60% one. Every existing gate is an aggregate and none can see this shape.
2. **Type is an amplifier, not the cause.** The within-deck swing is **61.5 points** (ADV 80.9%
   / NEU 46.2% / DIS 19.3%) - far more than a x1.5 no-resistance multiplier reads like on paper -
   but **57.4% of violations are NEUTRAL**, so a perfect elemental fix still leaves 26.7% of the
   roster out of band.
3. **43 FTKs in 14 cells, against a gate that has read 0 for months.** `jormungandr` is one side
   of 13 of the 14. The balance suite is structurally blind to them because it does not run
   these matchups. Flagged as its own ticket in the report's questions.

Ticket 70's premise **survives**: kraken is still the weakest species at 25.4%, `kraken_v1` 33.1%
and `kraken_v2` 17.7%. Ticket 71's `undertow` swap fixed her control floor, not her field.
