# Balance auditor & report

- Type: wayfinder:task
- Status: open
- Assignee:
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
