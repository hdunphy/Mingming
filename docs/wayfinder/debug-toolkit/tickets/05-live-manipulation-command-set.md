# Live-manipulation command set

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: — ([Debug gating architecture](03-debug-gating-architecture.md) closed)

## Question

Which god-tool verbs does the mid-battle overlay expose, and how do they mutate state safely?

To decide:

- **Verb list v1.** Candidates: set HP/energy on any unit; apply/clear statuses (with stacks); add a specific card to hand / force next draw; stack the deck; force an enemy's next intent; skip turn; insta-win/lose; toggle "enemy AI paused". Which make v1, which wait?
- **Mutation path.** The *mechanism* is settled by [Debug gating architecture](03-debug-gating-architecture.md) section 4: every verb is a pure `(state, args) => IBattleState` function under `src/debug/`, applied via `setBattleState`. What remains open is the per-verb question — which verbs edit state directly (bypassing constraints) vs which re-dispatch real battle actions so the repro exercises production code paths. Card-play probably stays through real actions; confirm verb by verb.
- **Hook interaction.** Do debug mutations fire hooks (e.g. does debug-applied Burn trigger onStatusApplied)? Note the audit's warning: the `triggerDepth > 5` recursion guard is effectively untested (`SnapshotPattern.test.ts:132-157` is a stub), and mid-resolution injections are exactly what would trip it.
- **Overlay UX.** Hotkey choice (`` ` `` or F9) — the only part still open. Mount point is already settled: the overlay is `DebugRoot` in floating mode, hoisted above App.tsx's early returns, *not* a component inside `BattleArena`. Logging is settled too: every verb appends a `[DEBUG]` line to `state.logs`.
