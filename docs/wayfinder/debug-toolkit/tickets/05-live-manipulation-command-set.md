# Live-manipulation command set

- Type: wayfinder:grilling
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: — ([Debug gating architecture](03-debug-gating-architecture.md) closed)

## Question

Which god-tool verbs does the mid-battle overlay expose, and how do they mutate state safely?

To decide:

- **Verb list v1.** Candidates: set HP/energy on any unit; apply/clear statuses (with stacks); add a specific card to hand / force next draw; stack the deck; force an enemy's next intent; skip turn; insta-win/lose; toggle "enemy AI paused". Which make v1, which wait?
- **Mutation path.** The *mechanism* is settled by [Debug gating architecture](03-debug-gating-architecture.md) section 4: every verb is a pure `(state, args) => IBattleState` function under `src/debug/`, applied via `setBattleState`. What remains open is the per-verb question — which verbs edit state directly (bypassing constraints) vs which re-dispatch real battle actions so the repro exercises production code paths. Card-play probably stays through real actions; confirm verb by verb.
- **Hook interaction.** Do debug mutations fire hooks (e.g. does debug-applied Burn trigger onStatusApplied)? Note the audit's warning: the `triggerDepth > 5` recursion guard is effectively untested (`SnapshotPattern.test.ts:132-157` is a stub), and mid-resolution injections are exactly what would trip it.
- **Overlay UX.** Hotkey choice (`` ` `` or F9) — the only part still open. Mount point is already settled: the overlay is `DebugRoot` in floating mode, hoisted above App.tsx's early returns, *not* a component inside `BattleArena`. Logging is settled too: every verb appends a `[DEBUG]` line to `state.logs`.

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Implementation graduates as
[Engine state actions](14-engine-state-actions.md) and [Battle debug overlay](15-battle-debug-overlay.md).
This resolution **amends [Debug gating architecture](03-debug-gating-architecture.md) section 4** —
see "Reconciliation" below.

### 1. Verb list v1 — board state plus what happens next

Ten verbs over eight distinct capabilities. Three ride existing engine actions; five need new ones.

| Verb | Action | New? |
|---|---|---|
| set HP / energy / tempHp | `SET_VITALS { entityId, hp?, energy?, tempHp?, sourceId }` | new |
| apply status (with stacks) | `APPLY_STATUS` | existing |
| clear status | `REMOVE_STATUS { entityId, status? }` (omit = clear all) | new |
| add card to hand | `ADD_CARD_TO_HAND { side, dataId }` | new |
| set an enemy's next intent | `SET_INTENT { entityId, move }` | new |
| make a unit act now | `EXECUTE_INTENT` | existing |
| skip turn | `END_TURN` | existing |
| insta-kill (covers win/lose) | `KILL_ENTITY { entityId, sourceId }` | new |

Deliberately **not** in v1: deck stacking / forced draw order (touches `IDeckState`'s three piles and
the seeded shuffle — more surface than the rest combined) and a "pause enemy AI" toggle (needs a flag
with no home in `IBattleState`). Because verbs are cheap to add under this architecture, these wait
for real use to pull them in rather than being speculatively built.

### 2. Mutation path — everything goes through the engine

No verb writes state fields directly. Where an engine action exists it is used; where one does not,
**a new general-purpose engine action is added** so the reducer stays the single source of truth for
state transitions.

### Reconciliation with ticket 03

Ticket 03 section 4 said "no debug code in the reducer". That is **narrowed to "no debug-*specific*
code"**. The five new actions belong to the engine on their own merit — `SET_VITALS`,
`REMOVE_STATUS`, `ADD_CARD_TO_HAND` and `KILL_ENTITY` are all things the game can plausibly want to
express, and `GENERATE_CARD` (`effectHandlers.ts:573`) and `CLEANSE` already do adjacent work. The
debug layer is merely their first consumer.

**Ticket 03's mechanism survives completely intact**, which is what makes the amendment safe rather
than a reversal. Verbs are still pure `(state, args) => IBattleState` functions under `src/debug/`,
still applied via `setBattleState`. They simply delegate instead of hand-editing:

```ts
const setHp = (state, {entityId, hp, sourceId}) =>
  withDebugLog(battleReducer(state, {type: 'SET_VITALS', payload: {entityId, hp, sourceId}}),
               `set ${entityId} HP to ${hp}`);
```

Calling `battleReducer` directly — it is a plain exported function, not a slice — means **no new
`battleSlice` action is needed**, the single import edge is untouched, nothing debug-shaped ships,
and the command set stays headlessly testable and reusable by the batch sim. `INITIALIZE_BATTLE`
still goes; `setBattleState` is still the only injection point.

### 3. Hook interaction — faithful

The new actions fire their real downstream processing, so a debug-staged board behaves
indistinguishably from one the game produced:

- `SET_VITALS` — an HP decrease fires damage-taken hooks, an increase fires heal hooks. Energy and
  tempHp changes fire nothing (no such trigger exists).
- `REMOVE_STATUS` — emits `STATUS_REMOVED` and runs the removal path, mirroring
  `battleReducer.ts:683-690`.
- `ADD_CARD_TO_HAND` — reuses `handleGenerateCard` (`effectHandlers.ts:573`) rather than
  reimplementing hand insertion.
- `SET_INTENT` — fires nothing. An intent is a plan, not an event.
- `KILL_ENTITY` — full death processing: on-death hooks, XP award and `levelUpQueue`
  (`battleReducer.ts:648`).

Safe to do because the recursion guard is real and load-bearing: `resolutionEngine.ts:257-277`
tracks actual synchronous nesting in `resolutionStackDepth` (cap 12, `try`/`finally`) independently
of context plumbing, so a debug-triggered hook cycle terminates. **This corrects audit gap #16** —
the guard exists and is sound; only its *test* is a stub.

Also grounded: death and victory are **derived** from `currentHp <= 0` at every site
(`battleReducer.ts:166-167,404`; `BattleArena.tsx:282-283,335-338`), so there is no `isDead` flag to
desync and no zombie-unit hazard.

### 4. Hook attribution — the caller picks the source

Every damage-ish action payload carries `sourceId`, and the overlay exposes a source picker, so
"enemy A killed player B" reproduces retaliation targeting and on-kill credit exactly.

**Default (refined 2026-08-03):** the picker is **pre-filled from live battle state** — the opposing
party's active unit relative to the target — and is directly overridable. Whichever is least
cumbersome in the moment: accept the sensible default, or pick. Explicitly *not* self-attribution:
retaliation and thorns-style hooks read source-vs-target to decide whether to fire, so a target-as-
its-own-source default would silently misfire exactly the reactive hooks most worth debugging.

Note `KILL_ENTITY` cannot default to nothing — `calculateDeathXp(defeatedUnit, receiver)`
(`effectHandlers.ts:44`) needs a real receiver to award XP, so a source is mandatory there.

### 5. Overlay UX

- Hotkey **Ctrl+Shift+D**. The handler must no-op when focus is in an `input`, `textarea` or
  contenteditable — CardForm and deck naming are real text fields.
- Mount point was already settled by ticket 03: the overlay is `DebugRoot` in floating mode, hoisted
  above App.tsx's early returns, **not** a component inside `BattleArena`.
- Logging was already settled too: every verb appends a `[DEBUG] ...` line to `state.logs` on top of
  whatever the engine wrote itself.
