# Deck balance report v2 — instrumentation & build

- Type: wayfinder:task
- Status: closed
- Assignee:
- Blocked by: [Deck balance report v2 — design & mockup](25-deck-balance-report-v2-design.md)

## Question

Build what [ticket 25](25-deck-balance-report-v2-design.md) designed: real per-card/per-status
telemetry in the batch runner, the `DeckReport` v2 writer, and a real HTML viewer (the
mockup is the visual spec — see
[prototypes/25-deck-balance-report-mockup.html](../prototypes/25-deck-balance-report-mockup.html)).

Checklist:

- Extend `RunResult`/`runOne` (`src/debug/balance/runBatch.ts`) to record, per run: which
  card ids were played (already tracked as a `Set`, needs to become counts), the HP-delta
  attributed to each `PLAY_PROGRAM` dispatch (direct damage), and status-stack deltas
  applied by each play. Aggregate across a batch into per-card
  `timesSeen`/`timesPlayed`/`directDamageDealt`/`statusesApplied`.
- Track total damage taken per side per game (already implicit in HP loss) so
  `residualDamageShare` = total − sum(direct) can be apportioned pro-rata to DoT-applying
  cards by stacks applied, per the design doc §3. Keep it nullable/approximate, never
  presented as exact.
- Implement `measuredScore`: static powerscale minus its damage/status terms, plus the
  measured equivalents (design doc §3 formula).
- Write the `DeckReport` v2 JSON matching the schema in
  [research/25-deck-balance-report-v2-design.md](../research/25-deck-balance-report-v2-design.md)
  — subjects, cards, statuses, matchups (superset of v1's matchup shape so old rows load
  unchanged), redlines, `notes.instrumentationPending` (should be empty once this ticket
  lands).
- New npm script (`npm run balance:deck` or similar) taking `--subjects`/`--control`/`--suites`
  and writing to a **committed** path (proposed `docs/balance/deck_report.json` — confirm/
  adjust with Henry if a fixed overwritten path turns out to be wrong once he's using it day
  to day). Verify `npm test`/`npm run build` are unaffected, same requirement as ticket 20.
- Calibrate `DEAD_CARD_HIGH`/`POWER_DIVERGENCE`/`LOW_SAMPLE` thresholds against a real run
  (kraken_v1 vs control/gauntlet is the natural first subject — the mockup already used it)
  instead of shipping the design doc's placeholder numbers unchanged.
- Turn the mockup into the real viewer: swap the embedded sample JSON for a real generated
  `deck_report.json`, keep the file-loader for pointing it at a different run. Confirm the
  layout still holds once every column is real (mock badges should disappear).
- `osFirmwareDescription` pulled from `firmwareRegistry.json` at generation time;
  `archetypeSummary` stays authored (design intent, not derivable) — flag in the generator
  if a subject has no authored summary rather than shipping a blank appendix.

Done when: `npm run balance:deck` writes a committed, real (no mock badges) deck report for
at least one subject vs. control, the HTML viewer renders it, and `npx vitest run` +
`npx tsc -b` + `npm run build` stay green and unaffected in duration (same bar as ticket 20).

## Resolution

**Built and shipped.** `npm run balance:deck` writes a real, no-mock deck report and a
self-contained HTML viewer; `npx vitest run`, `npx tsc -b` and `npm run build` are green and
unchanged in duration.

### What landed

| piece | where |
|---|---|
| Opt-in batch telemetry | `runBatch.ts` - `BatchOptions.telemetry`, `SideTelemetry`, `RunTelemetry` |
| powerscale damage/status split | `powerscale.ts` - `damagePortion` / `statusPortion` on `PowerscaleResult` |
| Report builder + `measuredScore` | `deckReport.ts` |
| CLI | `runDeckReport.ts`, `npm run balance:deck` |
| Viewer template | `deckReportViewer.html` (derived from ticket 25's mockup) |
| Output | `docs/balance/deck_report.json` **and** `docs/balance/deck_report.html` |
| Tests | `deckReport.test.ts`, 6 tests |

### The commit gate does not pay for any of this

`telemetry` is **off by default** and `npm run balance` never sets it. That is a deliberate
structural choice rather than a measurement: it means the gate's runtime cannot regress no
matter how far the deck report grows. There is a test asserting `run.telemetry` is `undefined`
without the flag, because "we'll remember not to turn it on" is not a guarantee.

### Two denominators, because there are two questions

The first implementation had `playRate` above 1.0 and every card reading 50% dead, which is
what happens when one counter serves both questions. They are now separate:

- **`deadRate`** is per card INSTANCE - did this copy ever get played before the game ended -
  the same convention as the deck-level `deadCardRatio`, so the two are comparable.
- **`playRate`** is per HAND ENTRY - when this card was available, was it cast. A 2-energy card
  on a 2-energy frame can sit in hand three turns and only be castable once a turn; that is a
  curve fact, not a dead card.

Both invariants are pinned by tests, since the DEAD_CARD_HIGH redline is only worth having if
its denominator means what the column header says.

### `measuredScore` moves exactly two terms

`staticScore − damagePortion − statusPortion + measuredDamage + measuredStatus`. Every
deterministic term is left alone: a card that draws 2 always draws 2, and re-measuring it just
re-derives the constant. `powerscale` now reports the two portions rather than the deck report
recomputing them, so the two cannot drift apart. A card the search never played lands exactly
on its static score - also a test.

The DoT trap is handled as the design doc specified: `residualDamageShare` is apportioned
pro-rata to DoT stacks applied and is **nullable**, so "no DoT applied" and "measured zero" stay
distinguishable and the approximation can never be read as exact.

### Thresholds calibrated, not inherited

Run against 12 subjects x 160 games:

| threshold | design doc | shipped | why |
|---|---|---|---|
| `deadRate` | 0.50 | **0.50** | Real distribution: median 0.09, p75 0.23, p90 0.39, **p95 0.52**, max 0.87. The proposal lands on the 95th percentile - confirmed rather than inherited. Fires on 4 of 79 rows. |
| `powerDivergence` | 0.50 | **1.00** | The proposal was too tight: p75 is 0.50, so half of what it flagged was ordinary. At 1.00 it fires on 10 of 76 rows and names the per-stack scalers whose static score is a documented FLOOR. |
| `cardPlays` | 20 | 20 | Below ~20 plays a damage mean is dominated by which target it hit. |
| `matchupIterations` | 150 | 150 | The HANDOFF's +-4pt-at-150-seeds noise figure. Produced zero LOW_SAMPLE rows at 80 seeds x 2 orders, which is the floor working rather than spamming. |

### It found something on its first real run

**`barrow_king` in draugr_v1: reached hand 480 times, played 5.3% of them, dead rate 0.856.**
Ticket 48 §11 listed exactly that as a STOP-and-report condition - *"barrow_king reads as a dead
card above 0.35 on its own: the Energized is not arriving, or StableOS is not forcing the awake
turn"* - and the deck-level ratio (draugr_v1 pooled at 0.09) cannot name a card, so nothing
caught it. This is the gap the DEAD_CARD_HIGH redline exists to close, demonstrated rather than
argued. Also flagged: `squirrel_away` 0.87 and `forage` 0.58 in hel_v2, and `wither_feast` 0.52
in nidhoggr_v1.

The POWER_DIVERGENCE list reads exactly as designed - `wither_feast` 8.0x, `shadow_claw` 2.2x,
`slander` 1.9x, `avalanche` 1.6x. Those are the scalers whose static price is a floor, and
surfacing them is the point rather than a defect.

### The viewer is self-contained on purpose

The generator embeds the run's JSON into the HTML rather than fetching a sibling file: a
`file://` page cannot fetch its neighbour, and a viewer that broke when you double-clicked it
would be broken in exactly the way this tool is meant to be used. The file-input loader from the
mockup survives, so the same page still opens any other generated report.

Rendered and inspected with a headless browser rather than assumed: 79 card rows, 44 status
rows, 36 matchups, 12 subject blocks, no `undefined`, no `NaN`, no console errors. Every mock
badge, the mock banner and all placeholder copy are gone, and `notes.instrumentationPending` is
empty - asserted by a test, so a stale viewer cannot silently start trusting placeholder data.

### Left open

- **`archetypeSummary` is authored** in `ARCHETYPE_SUMMARIES` and covers the 12 subjects run so
  far. A subject with no entry is warned about at generation time rather than shipping blank;
  the remaining roster needs entries as those decks get built.
- **`--suites gauntlet` works but is slow** - it is every species, so a full-roster gauntlet
  report is a much longer run than the `vs-control/mirror/os-variance` default.
- **The committed report is 12 of 24 subjects.** Regenerating for the whole roster is one flag;
  it was scoped here to keep the artifact reviewable.
- **`residualDamageShare` is an approximation** and always will be. It is nullable and captioned;
  it should never be quoted as a measured number.
