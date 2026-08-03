# Battle snapshot export

- Type: wayfinder:grilling
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: — ([Scenario schema v1](02-scenario-schema.md) closed)

## Question

How does "hit a bug, press export, get a replayable JSON" work?

To decide:

- **Fidelity.** Snapshotting `IBattleState` + `seed` is architecturally free (audit: pure JSON, string seed). Is a state snapshot alone enough for repro, or do we also want an **action tape** — the sequence of dispatched `BattleAction`s since battle start — so a bug can be replayed from its beginning, not just from the moment of export? (Audit gap #12: nothing records actions today; `state.logs` is human-readable strings.) Tape recording implies a small always-on-in-DEV middleware.
- **UX.** Where the export button lives (battle overlay from [Live-manipulation command set](05-live-manipulation-command-set.md)? always-visible corner chip in DEV?); filename convention; auto-attach registry stamp per the schema decision.
- **Import.** Loading a snapshot mid-battle vs only from the launcher. (Stamp-mismatch behaviour is already settled by [Scenario schema v1](02-scenario-schema.md): warn loudly, load anyway.)

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Implementation graduates as
[Snapshot export & import](16-snapshot-export-import.md) and [Action tape](17-action-tape.md).
Additively amends [Scenario schema v1](02-scenario-schema.md) — see section 1.

### 1. Fidelity — snapshot plus an always-on DEV action tape

Export writes `kind: 'snapshot'` (the board as of the keystroke — the primary requirement) **plus an
optional `tape` field**. `tape` is *added to schema v1 as optional*, so no `CURRENT_SCENARIO_VERSION`
bump: older files simply lack it and still validate.

**The tape needs middleware**, because `store.subscribe` observes state but not actions. Importing a
debug module into `store.ts` would break ticket 03's single-import-edge invariant, so it uses the
same move ticket 05 used for the reducer — **a general-purpose extension point in production code
that the debug layer consumes**:

```ts
// store.ts — general-purpose, ~15 lines, nothing debug-shaped
let actionTap: ((action: unknown) => void) | null = null;
export const setActionTap = (fn: typeof actionTap) => { actionTap = fn; };
const tapMiddleware = () => (next: any) => (action: any) => { actionTap?.(action); return next(action); };
```

`DebugRoot` calls `setActionTap` on mount and clears it on unmount. No second import edge, nothing
debug-specific ships, and the tap is inert when nothing installs itself.

Two limits recorded deliberately:

- **Replay from battle start is gated on [Determinism groundwork](09-determinism-groundwork.md).**
  A tape reconstructs nothing without a deterministic initial state, and creation still uses
  `Date.now`/`Math.random`/`randomUUID`. Until 09 lands the tape is a *readable record* of what
  happened, not a re-runnable script. It becomes re-runnable for free when 09 ships.
- **Ticket 05's god-tool verbs appear opaque in the tape.** They dispatch
  `setBattleState(verb(...))`, so the tape records a state replacement rather than
  `setHp kraken 1`. Accepted for v1; [Battle debug overlay](15-battle-debug-overlay.md) can stamp
  verb labels later if it grates.

Always-on in DEV rather than armed-on-demand, because a bug is noticed *after* it happens and an
unarmed recorder is worth exactly as much as no recorder.

### 2. Export UX — zero prompts

- A button in the `DebugRoot` overlay **plus a dedicated hotkey (Ctrl+Shift+E)** that exports
  instantly without opening the layer. The moment you notice a bug is the worst possible moment to
  be asked a question: capture first, name later.
- **Auto-named, no dialog:** `snapshot-t<turn>-<seed prefix>.scenario.json`, e.g.
  `snapshot-t14-a3f9c02b.scenario.json`. The name only has to be unique and greppable — the file is
  renamed by hand on its way into `repro/` regardless.
- Mechanism is a Blob download (a browser page cannot write into `src/debug/scenarios/`); reuse the
  `downloadCSV` pattern at `BalanceTester.tsx:96-111`. Henry moves the file into the repo.
- `registryHash` attaches automatically — ticket 02 made it required, so it was never a choice.
- Export runs the state through `normalizeBattleState()` before serializing, per ticket 02 section 3.

### 3. Import — everywhere

Snapshots load from the `DebugRoot` overlay **at any time, including mid-battle** (replacing the
battle in progress), and from the launcher panel. Architecturally free: it is the same
`setBattleState` call. No confirm step — a confirm you always accept just trains you to stop reading
it, and this is the loop that runs most often: hit a bug, export, hand-edit the JSON, load it back
without leaving the battle.

v1 imports the **state only**; an imported `tape` is carried and displayed but not replayed until
[Determinism groundwork](09-determinism-groundwork.md) and the regression suite exist.

Stamp mismatch warns loudly and loads anyway, per [Scenario schema v1](02-scenario-schema.md).
