# Matchup band census (ticket 69): how much of the roster breaks the 10-90% rule?

- Type: wayfinder:research - REPORT-ONLY. Henry-approved standard (2026-08-16, answer 5 to
  ticket 67: *"I think we target 10%-90% single deck matchup bands. I.e. no single matchup
  should win >90% of matches"*).
- Status: **open**
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
