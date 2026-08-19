# Decision-density census (ticket 94): measure where the fun lives

- Type: wayfinder:research - REPORT-ONLY. Authorized by Henry 2026-08-19 off his playtest
  finding: most decks have one optimal line and play themselves; the fun decks (hel_v2
  Gateway, ymir_v2 GLACIAL_PACE, fafnir_v1 HOARD) made each hand a choice.
- Status: **open**. Branch archetype-web.
- Assignee: -

## Instrument - four proxies for "this deck asks questions", all 32 decks

1. **Greedy gap**: win rate of the 1-turn-lookahead AI minus the greedy AI, same deck,
   same mixed field (~120 games each). Big gap = thinking is worth something. Zero gap =
   the deck plays itself. (Both AI modes exist - the ticket-19 eval work; exclude
   lookahead sims from all counters per 0-AI-SIM-COUNTS.)
2. **Close-call rate**: share of turns where the top-2 candidate plays sit within epsilon
   of each other in eval AND diverge in rollout outcome (close + divergent = a real
   decision; close + convergent = an irrelevant one - report both, only the first counts).
3. **Order-sensitivity**: within a turn, permute the chosen cards' play order - outcome
   delta. High sensitivity + one fixed best permutation = Henry's "optimal order"
   boredom (solvable once, rote forever). Distinguish from decks where the best ORDER
   changes with board state.
4. **Policy-flip rate**: how often the best play for the same hand changes across
   matchup/own-HP-band/enemy-HP-band. A constant best line = the deck ignores the game
   it is in.

## Validation - the instrument is judged against Henry's hands

hel_v2, ymir_v2, fafnir_v1 MUST rank in the top tier; the decks Henry called
self-playing should rank bottom. If the ranking disagrees with the playtest, the
INSTRUMENT is wrong (playtest is ground truth for feel) - report the disagreement, do
not rationalize it.

## Added column (Henry, 2026-08-19): the lever audit

Per deck, count INDEPENDENT paths to lethal (0-TWO-LEVERS law). A lever an opponent can
switch off with one status axis (the duality cancel) counts as half. Single-lever decks
are flagged for their next pass regardless of their fun ranking.

## Deliverable

research/decision-density.md (CRLF): the 32-deck ranking with all four columns, the
validation verdict, per-deck one-line diagnosis of WHERE the decisions live (or don't),
and the correlation against ticket 87's economy finding (prediction on record: decks
with an alternate resource - HP-casting, hoard, forced scarcity, growing energy - top
the table; identical-economy decks bottom it). Questions for Henry. ONE commit.
No design changes - the taxonomy discussion (HANDOFF) precedes any law.
