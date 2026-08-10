# Deck balance report v2 — design & mockup

- Type: wayfinder:prototype
- Status: closed
- Assignee: cowork-2026-08-10-sonnet5
- Blocked by: — ([Balance auditor & report](21-balance-auditor-report.md) closed; this extends it)

## Question

Henry wants a richer balance report than the committed gate artifact
(`docs/balance/balance_report.json`) can hold: win rates plus most/least-used card,
highest-damage card, average damage/turn, average statuses applied, most-used status, dead
cards, and an *estimated* (measured, not just static) card power — flexible enough to cover
one deck vs. control or several decks at once, with matchup drill-down.

To decide:

- New artifact, or does it replace the gate report?
- Which requested metrics are already measurable vs. need new instrumentation in `runBatch.ts`?
- Schema shape, and how "measured card power" gets computed given the engine's existing
  per-play damage-attribution gap (DoT ticks aren't attributed — see the deck-archetypes
  HANDOFF's Measurement Facts section).
- Report layout / display.
- Where it's generated from and whether it's committed.
- Redline thresholds for the new per-card/per-status findings.

## Resolution

Decided 2026-08-10 with Henry (session `cowork-2026-08-10-sonnet5`).

### 1. New, separate artifact

`docs/balance/balance_report.json` (the `npm run balance` commit gate) is untouched — still
the diffable, no-timestamp CI artifact. This is a different report, for interactive
drill-down on one or more decks, typically vs. the control deck.

### 2. Real today vs. new instrumentation

Win rate, pace (avg turns), dead-card ratio, FTK, first-mover edge/side bias and the static
powerscale score are already measured by `runBatch.ts`/`powerscale.ts` — reused as-is.
Most/least-used card, highest-damage card, avg damage/turn, avg statuses applied,
most-used status and measured card power all require new per-card/per-status telemetry
that does not exist anywhere in the pipeline today (`runOne` tracks a `played:
Set<programId>` per run but never aggregates it, and no damage or status totals are
recorded at all). **Design the full schema now; instrument in
[ticket 26](26-deck-balance-report-v2-build.md).**

### 3. Schema (v2) and the measured-power formula

Full `DeckReport` / `SubjectDeck` / `CardTelemetry` / `StatusTelemetry` / `MatchupRecord` /
`RedlineRecord` TS shape in
[research/25-deck-balance-report-v2-design.md](../research/25-deck-balance-report-v2-design.md).
Measured card power only re-prices the two things that vary with real play — damage and
status stacks that actually land — and keeps every deterministic term (draw, energy, flat
effects) at its static powerscale value, so `scoreDelta` means "performs differently than
its text implies," not formula drift. DoT/residual damage (Burn/Poison ticks resolve at
end of turn and attribute to nothing under a naive per-play harness — the same trap the
deck-archetypes HANDOFF already flagged) is tracked as a separate, explicitly-approximate
`residualDamageShare`, never folded silently into a card's direct number.

### 4. Generation: npm script, committed

`npm run balance:deck -- --subjects=<ids> --control=<id>` (exact flags TBD in the build),
same family as `npm run balance`. **Output is committed, not gitignored** — same
diffable-report philosophy as v1: change a deck, rerun, `git diff` is the answer. Proposed
fixed path `docs/balance/deck_report.json`, overwritten each run (mirrors v1's convention);
revisit if Henry wants named per-run snapshots instead once this is in daily use.

### 5. Redline thresholds — approved shape, not yet calibrated

Two new kinds (`DEAD_CARD_HIGH` per-card dead rate, `POWER_DIVERGENCE` measured-vs-static
drift) plus a `LOW_SAMPLE` confidence flag, on top of the existing
`CARD_OVER_BUDGET`/`TURN_COUNT`/`OS_GAP`/`FTK`. **Henry likes the shape but the specific
numbers (50% dead rate, 50% divergence, 150-iteration/20-play sample floor) are
placeholders** — they get set from real measured data once
[ticket 26](26-deck-balance-report-v2-build.md) lands, not shipped as guesses.

### 6. Mockup

[prototypes/25-deck-balance-report-mockup.html](../prototypes/25-deck-balance-report-mockup.html)
— interactive, sortable/filterable card and matchup tables, hover card-appendix, expandable
matchup drill-down, static-vs-measured bar chart, grouped redlines panel. Built with real
kraken_v1 gauntlet matchups and real card static scores pulled from the committed
`balance_report.json`/CSVs; every field that needs new telemetry is visibly badged MOCK so
nothing reads as a finding before it's real. Henry reviewed and approved the shape —
graduates to [ticket 26](26-deck-balance-report-v2-build.md).
