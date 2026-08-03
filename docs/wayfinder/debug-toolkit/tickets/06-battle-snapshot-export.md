# Battle snapshot export

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: — ([Scenario schema v1](02-scenario-schema.md) closed)

## Question

How does "hit a bug, press export, get a replayable JSON" work?

To decide:

- **Fidelity.** Snapshotting `IBattleState` + `seed` is architecturally free (audit: pure JSON, string seed). Is a state snapshot alone enough for repro, or do we also want an **action tape** — the sequence of dispatched `BattleAction`s since battle start — so a bug can be replayed from its beginning, not just from the moment of export? (Audit gap #12: nothing records actions today; `state.logs` is human-readable strings.) Tape recording implies a small always-on-in-DEV middleware.
- **UX.** Where the export button lives (battle overlay from [Live-manipulation command set](05-live-manipulation-command-set.md)? always-visible corner chip in DEV?); filename convention; auto-attach registry stamp per the schema decision.
- **Import.** Loading a snapshot mid-battle vs only from the launcher. (Stamp-mismatch behaviour is already settled by [Scenario schema v1](02-scenario-schema.md): warn loudly, load anyway.)
