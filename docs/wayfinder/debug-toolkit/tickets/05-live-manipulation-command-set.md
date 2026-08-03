# Live-manipulation command set

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: [Debug gating architecture](03-debug-gating-architecture.md)

## Question

Which god-tool verbs does the mid-battle overlay expose, and how do they mutate state safely?

To decide:

- **Verb list v1.** Candidates: set HP/energy on any unit; apply/clear statuses (with stacks); add a specific card to hand / force next draw; stack the deck; force an enemy's next intent; skip turn; insta-win/lose; toggle "enemy AI paused". Which make v1, which wait?
- **Mutation path.** Dedicated debug actions in the reducer (clean, explicit, can bypass constraints) vs re-dispatching existing battle actions (exercises real code paths — better for bug repro, but constrained). Probably: state-editing verbs get debug actions; card-play stays through real actions. Confirm.
- **Hook interaction.** Do debug mutations fire hooks (e.g. does debug-applied Burn trigger onStatusApplied)? Note the audit's warning: the `triggerDepth > 5` recursion guard is effectively untested (`SnapshotPattern.test.ts:132-157` is a stub), and mid-resolution injections are exactly what would trip it.
- **Overlay UX.** Hotkey (` or F9), mount point inside `BattleArena` (nav is hidden during battle), and whether debug mutations write a distinguishable line into the battle log.
