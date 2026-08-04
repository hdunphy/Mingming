# Balance auditor & report

- Type: wayfinder:task
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: [Batch sim runner](20-batch-sim-runner.md)

## Question

Produce the report `docs/balance_testing.md` §4 specifies. Defined by
[Batch sim & auditor design](08-batch-sim-auditor-design.md) sections 4–5.

Checklist:

- Extract `calculatePowerscale` and `ACTION_WEIGHTS` from `CardStudio.tsx` (`:11-24+`) into a shared
  module. **One implementation**, consumed by both the Studio panel and the auditor. This is §1's
  static analysis and it is half of §4's report — it needs no simulation, so it is the fast half.
- Emit `docs/balance/balance_report.json`, **overwritten each run and committed**, listing redlines:
  cards over their §1.3 energy-cost threshold, and matchups breaching §2's win-rate / turn-count /
  OS-gap limits. The committed fixed path is deliberate — seeded sims make the file stable, so
  `git diff` after a card change is the balance answer.
- CSV alongside for spreadsheet work (`BalanceTester.tsx:96-111` is the precedent; write via node
  `fs` here).
- Label `BalanceTester` / `sim/Simulator.ts` in the UI as a **fast approximation, not balance truth**
  — closed-form TTK, zero-IV units, no statuses, hooks, cards or AI. Do **not** delete it: it is
  instant, which is the only reason live slider recompute works. The label is what stops the two
  tools disagreeing from reading as a bug.
- Do **not** implement stun-lock or energy-loop detection here — deferred by 08 section 3.

Done when: `npm run balance` writes a committed report, a deliberate card overbudget shows as a
redline, and all gates are green.


## Resolution

Implemented 2026-08-03. Verified: `npx vitest run` 53 files / 630 tests green, `npx tsc -b` clean,
`npm run build` clean including `assert-no-debug`, `npm run balance` writes the report.

Landed: `src/debug/balance/powerscale.ts` (the shared §1 formula), `balanceReport.ts` (thresholds,
redline evaluation, JSON+CSV writers), `reportGlobalSetup.ts`, and the committed artifacts
`docs/balance/balance_report.json` + `balance_redlines.csv` + `balance_matchups.csv`.

**Powerscale is now one implementation.** `CardStudio.tsx` imports `calculatePowerscale` and
`budgetBandFor` from the shared module; the local copy is gone. The §1.3 band table moved too, so
the panel's red/amber colouring and the report's redlines read the same numbers — which was the
point of the extraction. `ACTION_WEIGHTS` was **dead** in the original (declared, never referenced
by the formula); it moved verbatim, with the two entries equivalent to the inline literals wired up
and the other four documented as superseded by §1.2. Wiring those would have re-scored every card
in the registry — a balance change disguised as a refactor.

### The report

Shape: `schemaVersion`, `spec`, `command`, `registryHash`, `summary`, `cardBudget`, `matchups[]`,
`redlines[]`. **No timestamp, hostname or duration** — that omission is what makes `git diff` after
a card change readable as the balance answer. Sorting uses code-unit comparison rather than
`localeCompare`, because ICU data varies between node builds and a committed file must not reorder
itself on someone else's machine. **Determinism verified across four full runs, byte-identical.**

Current run: **21 redlines** over 111 cards and 48 matchup records — 5 `CARD_OVER_BUDGET`
(`glacier_wall` 27/7, `stone_bark` 27/7, `spiked_carapace` 21.6/13, `equilibrium` 7.6/7,
`slipstream` 3.6/3.5), 7 `TURN_COUNT`, 7 `OS_GAP`, 2 `FTK`. That is a **superset** of the 9 test
failures, not a different set: the single mirror-stalemate test expands to 7 subject-level
redlines, the OS tests map 1:1, and the FTK list gains one on an os-variance pairing no test
asserts on. Nothing suppressed, no threshold moved.

Acceptance criterion demonstrated: `fire_punch_v2` power 40 → 400 produced exactly one added
redline row, and reverting restored a byte-identical report.

### Judgement calls

- **The report is a vitest `globalSetup` teardown, not a fourth suite.** Vitest isolates each
  `*.balance.ts` in its own worker, so suites publish fragments to a gitignored cache and the main
  process merges them. A fourth suite would have doubled the ~135s runtime *and* produced a second
  set of numbers that could disagree with the assertions — the exact failure design §5 warns about.
  Teardown also runs after a red suite, which is precisely the run whose report you want.
- **Card redlines are over-budget only.** §1.3's stated lower bounds (2.0/5.0/10.0) do not match the
  Studio's long-standing amber thresholds (1.0/4.0/9.0). The panel's behaviour was preserved and the
  divergence documented rather than silently repainting the table.
- Two CSVs, not one — a single mixed-schema file (card rows plus matchup rows) is useless in a
  spreadsheet.
- Partial runs still overwrite the report (§4 says "overwritten each run") but announce themselves
  via `summary.suitesMissing` and a console warning, so a filtered run cannot masquerade as a clean
  bill of health.
- `BalanceTester` and `sim/Simulator.ts` are **labelled, not deleted** — an on-screen amber banner
  saying "fast approximation, not balance truth" pointing at the report. They stay because they are
  instant, which is the only reason live slider recompute works.
- `docs/balance_testing.md` §4 still read "Proposed Tool" while the report cited it as its spec; it
  now describes what exists.

### Gap, recorded honestly

**No unit tests for `powerscale.ts` or `balanceReport.ts`.** The extraction is behaviour-preserving
by construction and the report's card scores match what the Studio renders, but that equivalence is
not test-asserted. A regression test comparing pre/post scores is the natural follow-up.
