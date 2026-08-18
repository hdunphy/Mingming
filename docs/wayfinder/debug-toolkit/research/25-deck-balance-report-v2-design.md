# Mingming Balance Report v2 — Design

Companion to the mockup `balance_report_v2_mockup.html`. Scoped against three decisions
made 2026-08-10:

1. **New, separate artifact.** `docs/balance/balance_report.json` (the `npm run balance`
   commit gate, diffable, no timestamp) is untouched. This is a different file, generated
   on demand, not part of CI.
2. **Design the full thing now, instrument later.** Every field below is either sourced
   from what `runBatch.ts` already measures (marked **REAL** — exists today) or requires
   new telemetry (marked **NEW** — needs a follow-up ticket). The mockup renders both, with
   NEW fields visually flagged so nobody mistakes a placeholder for a finding.
3. **One file, N subjects.** A single report can hold one deck vs. control, or several
   decks each vs. control/the field, side by side. No cross-file comparison in v1.

---

## 1. What's real today vs. what's new

| Metric (from your list) | Status | Source |
|---|---|---|
| Win rate (decisive + raw) | **REAL** | `BatchResult.winRate` / `decisiveWinRate` |
| Average pace (turns) | **REAL** | `BatchResult.averageTurns` |
| Dead cards (ratio) | **REAL** | `BatchResult.deadCardRatio` (pooled, per side) |
| FTK count | **REAL** | `BatchResult.ftkCount` |
| First-mover edge / side bias | **REAL** | `PairedBatchResult` |
| Static card power (powerscale) | **REAL** | `powerscale.ts`, already in `balance_report.json` |
| Most/least used card | **NEW** | `runOne` tracks `played` as a `Set<programId>` per run but never counts or aggregates it across a batch |
| Highest-damage card | **NEW** | no per-card damage attribution exists anywhere in the pipeline |
| Average damage per turn | **NEW** | same gap — no damage totals are recorded at all today, only win/lose/turns |
| Average statuses applied / most-used status | **NEW** | no status telemetry exists |
| Estimated (measured) card power | **NEW** | depends on the two gaps above |

So five of your ten asks are a genuinely new instrumentation lift, not a display problem.
That's fine — better to design the report Henry actually wants and back-fill the plumbing
than to let the plumbing gap shrink the report.

---

## 2. Schema (v2)

```ts
interface DeckReport {
  schemaVersion: 2;
  generatedAt: string;          // ISO timestamp — fine here, this file is not diff-gated
  command: string;               // e.g. "npm run balance:deck -- --subjects kraken_v1,kraken_v2 --vs control"
  registryHash: string;          // staleness check, same convention as v1
  config: {
    suites: Array<'mirror' | 'vs-control' | 'gauntlet' | 'os-variance' | 'custom'>;
    iterations: number;
    maxTurns: number;
    seedBase: string;
  };
  control: { species: string; os: string } | null;
  subjects: SubjectDeck[];
  cards: CardTelemetry[];
  statuses: StatusTelemetry[];
  matchups: MatchupRecord[];
  redlines: RedlineRecord[];
  notes: { instrumentationPending: string[] };  // which fields are placeholders, so a stale
                                                  // viewer doesn't silently start trusting them
}

interface SubjectDeck {
  id: string;                    // "kraken_v1"
  species: string;
  os: string;
  osFirmwareDescription: string; // pulled from firmwareRegistry.json at generation time
  archetypeSummary: string;      // AUTHORED — "what the deck is trying to do". Henry's
                                  // report-format rule, satisfied once per subject instead
                                  // of once per report.
  cardList: Array<{ id: string; count: number }>;
  summary: {
    decisiveWinRate: number; winRate: number; averageTurns: number;
    avgDamagePerTurnDealt: number; avgDamagePerTurnTaken: number;      // NEW
    avgStatusApplicationsPerGame: number; avgStatusStacksPerGame: number; // NEW
    mostUsedCard: string; leastUsedCard: string; highestDamageCard: string; // NEW (usage), NEW (damage)
    deadCardIds: string[]; deadCardRatio: number;                       // ids = NEW, ratio = REAL
    mostUsedStatus: string;                                             // NEW
    ftkCount: number; ftkRate: number; truncatedCount: number;          // REAL
    firstMoverEdge: number | null; sideBias: number | null;             // REAL
    sampleSize: number;
    confidence: 'ok' | 'low-sample';   // iterations < 150 → low-sample, per the ±4pt/150-seed
                                        // noise figure in the deck-archetypes HANDOFF
  };
}

interface CardTelemetry {
  cardId: string; name: string; cost: number; element: string; description: string; // appendix fields
  subjectId: string;              // same card can appear in multiple subjects
  timesSeen: number; timesPlayed: number; playRate: number;             // NEW
  timesDeadInHand: number; deadRate: number;                            // NEW (per-card; ratio already exists at deck level)
  directDamageDealt: number; avgDirectDamagePerPlay: number;            // NEW
  residualDamageShare: number | null;                                   // NEW, approximate — see §3
  damageShareOfSubject: number;                                         // NEW
  statusesApplied: Record<string, number>;                              // NEW — statusId -> stacks
  staticScore: number;            // REAL — powerscale, unchanged
  measuredScore: number;          // NEW — see §3 formula
  scoreDelta: number;             // measuredScore - staticScore
  sampleSize: number;             // = timesPlayed; low sample size caveats the delta
  isMocked: boolean;
}

interface StatusTelemetry {
  statusId: string; name: string; subjectId: string;
  totalStacksApplied: number; totalApplicationEvents: number;
  avgStacksPerGame: number; avgApplicationsPerGame: number;
  topSourceCards: string[];
  isMocked: boolean;
}

interface MatchupRecord {
  // Superset of today's balance_report.json matchup row — a v1 row can be loaded into
  // this viewer unchanged; the new columns just render as "—" until instrumented.
  id: string; suite: string; role: string; label: string;
  subject: string; subjectOS: string; opponent: string; opponentOS: string;
  iterations: number; playerWins: number; enemyWins: number; draws: number; decisive: number;
  decisiveWinRate: number; winRate: number; averageTurns: number;        // REAL
  deadCardRatio: number; enemyDeadCardRatio: number;                     // REAL
  ftkCount: number; truncatedCount: number;                              // REAL
  firstMoverEdge: number | null; sideBias: number | null;                // REAL
  avgDamagePerTurnDealt: number | null; avgDamagePerTurnTaken: number | null; // NEW
  topCardsThisMatchup: string[] | null;                                  // NEW — per HANDOFF
                                                                          // 8-COUNTER-b, usage
                                                                          // shifts by opponent
  topStatusesThisMatchup: string[] | null;                               // NEW
  redlineFlags: string[];
  confidence: 'ok' | 'low-sample';                                       // iterations < 150
  inconclusive: boolean;
}

interface RedlineRecord {
  section: string;
  kind: 'CARD_OVER_BUDGET' | 'TURN_COUNT' | 'OS_GAP' | 'FTK'             // existing v1 kinds
       | 'DEAD_CARD_HIGH' | 'POWER_DIVERGENCE' | 'LOW_SAMPLE';           // proposed new kinds
  subject: string; metric: string; value: number; threshold: number;
  comparison: 'above' | 'below'; detail: string;
}
```

---

## 3. The measured-power formula, and why it's the hard part

Powerscale prices a card once, from its text, assuming fixed averages (§1.2 of
`balance_testing.md`: 2.5 cards played, 50% HP, 8-card discard, etc.). "Estimated card
power based on played stats" means: stop assuming, measure what the card actually did
across N real games, and express it in the same units so the two numbers are comparable.

**Only re-measure the parts that vary with real play.** A card's DRAW/ENERGY/flat-heal
terms are deterministic from its text — a card that draws 2 always draws 2, measuring it
just re-derives the constant. The two terms that genuinely vary at runtime are:

- **Damage**, which depends on Strength/Weakened stacks in play, STAB, target selection —
  none of which powerscale's static pass can see.
- **Status stacks that actually land**, which depend on resistance, stacking caps (Burn
  caps at 3, status % caps at 25 net), and cleanse interactions.

So: `measuredScore = staticScore − staticDamagePortion − staticStatusPortion +
measuredDamagePortion + measuredStatusPortion`, keeping every deterministic term
untouched. A large `scoreDelta` means "this card performs differently than its text
implies," not "the formula disagrees with itself."

**The DoT attribution trap (already bit this project once — see HANDOFF's Measurement
Facts section).** The harness measures the HP delta on the single `PLAY_PROGRAM` dispatch,
so Burn/Poison ticks — which resolve at end of turn — attribute to nothing. A Burn card
reads `0.0 dmg/play` and looks dead while it's carrying the deck. The fix the HANDOFF
already recommends: track `directDamageDealt` (sum of per-play deltas) separately from
`totalDamageDealt` (HP loss over the whole game), and report the residual
(`total − direct`) as `residualDamageShare`, apportioned across DoT-applying cards
pro-rata to stacks applied. **This is explicitly an approximation** — the schema field is
nullable and the report always shows it as a range/footnote, never a bare number, so it
can't be misread as measured-exact.

**Sample-size discipline.** The HANDOFF is explicit that §2.3 noise runs ±4 points at 150
seeds, ±2.8 at 300. Any `measuredScore`, `CardTelemetry` row, or `MatchupRecord` built on
fewer than ~150 iterations (matchups) or ~20 plays (cards) gets `confidence: 'low-sample'`
and renders visually muted with a caption — never silently presented as equal-confidence
to a well-sampled row.

---

## 4. Redlines — two new kinds, proposed thresholds

Reuses the existing `CARD_OVER_BUDGET` / `TURN_COUNT` / `OS_GAP` / `FTK` kinds verbatim
(same thresholds as `balance_testing.md` §1.3/§2). Proposed additions:

| Kind | Trigger | Rationale |
|---|---|---|
| `DEAD_CARD_HIGH` | per-card `deadRate` > 50%, with `timesSeen` ≥ 20 | Deck-level `deadCardRatio` already exists but can't name the offending card — this closes that gap (HANDOFF's "trap card" language). |
| `POWER_DIVERGENCE` | `\|scoreDelta\| / staticScore` > 50%, with `timesPlayed` ≥ 20 | Flags cards whose real performance and static budget have drifted apart — either direction: underpriced sleeper or overpriced dud. |
| `LOW_SAMPLE` | matchup `iterations` < 150 or card `timesPlayed` < 20 | Not a balance finding — a confidence flag, so a thin sample never gets read as a redline. |

Numbers are proposals, not commitments — flag if any of these don't match your gut, they're
easy to move before instrumentation locks them in.

---

## 5. Report layout (what the mockup implements)

1. **Header** — subjects, control baseline, registry hash, suite/iteration config, and an
   always-visible banner naming which fields in this run are mocked/pending instrumentation.
2. **Summary comparison** — one stat-tile row per subject (vs. control where applicable):
   decisive win rate, pace, dmg/turn, dead-card %, FTK rate, plus named callouts (most-used
   card, highest-damage card, least-used card, most-used status).
3. **Card leaderboard** — sortable/filterable table (by subject, cost, element) + a
   static-vs-measured grouped bar for the top cards by sample size. Card names are
   hover/click targets that show the full appendix (id, cost, element, description) inline
   — this is Henry's standing "card appendix" report rule, satisfied automatically instead
   of hand-typed per report.
4. **Status leaderboard** — table + stack-distribution bar, one row per status per subject.
5. **Matchup drill-down** — filterable table (by suite/opponent/OS), click a row to expand
   turn distribution, side bias, per-matchup top cards/statuses, and any redline flags —
   without leaving the page.
6. **Redlines panel** — grouped by kind, status-colored (never color-alone — icon + label
   per kind), each entry links back to its card/matchup row.
7. **Archetype & card appendix** — one collapsible block per subject: OS firmware text +
   authored archetype summary + full deck list as mini cards. Satisfies Henry's "archetype
   framing" rule the same way — generated once per subject, not re-typed per report.
8. **Loader** — a file input to point the same static HTML at a different generated
   `*_deck_report.json` later, without rebuilding the page. Doesn't imply cross-file
   comparison (that was explicitly out of scope) — just lets the one viewer outlive any
   single run.

---

## 6. Decisions (2026-08-10)

1. **Generated via `npm run balance:deck` (exact flags TBD in the build ticket), same
   family as `npm run balance`.** Not a debug panel for v1 — a script, like the existing
   pipeline.
2. **Output is committed, not gitignored.** Same diffable-report philosophy as v1: change
   a deck, rerun, `git diff` is the answer. Proposed fixed path `docs/balance/deck_report.json`,
   overwritten each run (mirrors v1's convention) — revisit for named per-run snapshots if a
   fixed path turns out to be the wrong shape once this is in daily use.
3. **The `DEAD_CARD_HIGH` / `POWER_DIVERGENCE` / `LOW_SAMPLE` thresholds are approved in
   shape, not value.** Henry likes having them; the specific numbers (50% dead rate, 50%
   divergence, 150-iteration/20-play sample floor) are placeholders and get calibrated
   against a real run once instrumentation exists, not shipped as guesses.
4. **This is now [ticket 25](../tickets/25-deck-balance-report-v2-design.md) (this design,
   closed) and [ticket 26](../tickets/26-deck-balance-report-v2-build.md) (the
   instrumentation + build, open)** on the debug-toolkit wayfinder map, extending
   [ticket 21](../tickets/21-balance-auditor-report.md)'s lineage.

The mockup is built with real card scores and real kraken_v1 gauntlet matchups pulled from
the current committed report; every not-yet-real field is clearly badged MOCK. Henry
reviewed and approved the shape.
