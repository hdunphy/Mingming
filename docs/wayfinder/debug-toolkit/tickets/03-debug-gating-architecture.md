# Debug gating architecture

- Type: wayfinder:grilling
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: — ([Engine readiness audit](01-engine-readiness-audit.md) closed)

## Question

How the dev-only gate concretely works and where debug surfaces mount — the structural decision every build ticket sits on.

To decide:

- **Gate pattern.** `import.meta.env.DEV` static guards + `React.lazy` dynamic import of a single `DebugRoot`, so `vite build` tree-shakes the whole toolkit. Confirm the pattern and the single choke point.
- **Debug tab mounting.** `App.tsx` touch points: `Tab` union (`:19`), `TAB_CONFIG` (`:21-30`, filtered by DEV), render chain (`:90-97`). And the two early returns the audit flagged: battle mode replaces all nav (`:68-70`) — so god tools must be an overlay mounted inside/above `BattleArena` — and empty roster short-circuits to `MainMenuView` (`:64-66`), which locks out the launcher exactly when you want a from-scratch scenario. How does the Debug tab stay reachable in both states?
- **Fate of the existing ungated surfaces.** Balance tab, Studio tab, and `window.runSim` (`main.tsx:5` → `SimRunner.ts:102-105`) ship to players today. Move under the Debug gate, or leave any public?
- **Dispatch surface.** Standardize battle injection on `battleSlice.setBattleState` vs wiring the dead `INITIALIZE_BATTLE` (audit gap #10 — having both is ambiguous). New `debugSlice` for debug-only actions vs adding DEV-guarded actions to existing slices? Should debug mutations be visible in the battle log?

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Implementation graduates as
[Debug gating scaffold](12-debug-gating-scaffold.md) and
[Retire the ungated surfaces](13-retire-ungated-surfaces.md).

**Line-number drift.** The audit's `App.tsx` references are stale as of `88b55a5`. Current truth:
`Tab` union `:21`, `TAB_CONFIG` `:23-32`, roster-0 early return `:72-74`, in-battle early return
`:76-78`, render chain `:98-107`. `battleSlice.setBattleState` is still `:64-66`, `main.tsx`'s
SimRunner side-effect import still `:5`.

### 1. Gate: a DEV guard wrapping one lazy `DebugRoot`

```tsx
const DebugRoot = import.meta.env.DEV
  ? lazy(() => import('./debug/DebugRoot'))
  : null;
```

Vite substitutes `false` for the flag at build, the ternary folds to `null`, the dynamic import
becomes unreachable, and Rollup never emits the chunk. **`src/debug/DebugRoot.tsx` is the single
import edge between the game and the toolkit** — nothing outside `src/debug/` may import anything
inside it, and that invariant is what makes the gate auditable.

Backed by a post-build assertion: `DebugRoot` exports a `__DEBUG_TOOLKIT__` marker string, and a
`scripts/assert-no-debug.mjs` greps `dist/` for it after `vite build`. **Note for the repo
conventions:** this only runs if the gate command becomes `npm run build` (= `vite build && node
scripts/assert-no-debug.mjs`); bare `npx vite build` skips it. Flagged rather than silently changed.

### 2. Mounting: one `DebugRoot`, hoisted above both early returns, two presentations

`<DebugRoot/>` renders in `App` **before** the `rosterSize === 0` and `isInBattle` early returns, as
a fixed-position layer (chip + hotkey). Because it never depends on the nav existing, it works
unchanged at roster 0, mid-battle, and in the hub — which is what makes the launcher usable from a
from-scratch state and the god tools usable mid-battle without an overlay living inside
`BattleArena`.

The Debug **tab** is the same component in `docked` mode: a `'debug'` entry appended to `TAB_CONFIG`
via `...(import.meta.env.DEV ? [debugTab] : [])`, plus `'debug'` in the `Tab` union.

App.tsx's early returns are **not** modified. They encode the gauntlet tab-reset behaviour at
`:59-70`; a debug concern has no business inside them.

### 3. Existing ungated surfaces

- **Balance and Studio tabs** are deleted from the `Tab` union, from `TAB_CONFIG`, from the render
  chain, and from App.tsx's imports. They reappear as panels inside `DebugRoot`. Net effect:
  App.tsx loses two imports and the toolkit keeps one gate edge.
- **`window.runSim`** survives, DEV-only: `main.tsx:5` becomes
  `if (import.meta.env.DEV) { import('./engine/SimRunner'); }`. Attaching it from `main.tsx` rather
  than from `DebugRoot` deliberately trades a second (trivial, one-line) gate edge for having the
  global available from boot instead of only after the lazy chunk loads.
- SimRunner's unconditional module-scope `console.log` goes while we're in there.

### 4. Dispatch: `setBattleState` only; god-tool verbs are pure functions

`battleSlice.setBattleState` is the one injection point. The unwired `INITIALIZE_BATTLE` case in
`battleReducer` (`:37,60-61`) is **deleted**, closing audit gap #10.

Every god-tool verb is a pure `(state: IBattleState, args) => IBattleState` function under
`src/debug/`; the UI dispatches `setBattleState(verb(current, args))`. Consequences that make this
the right shape:

- **No debug code enters `battleSlice` or `gameSlice`**, so the single-gate-edge property from §1
  survives contact with the god tools.
- The whole ticket-05 command set is **headlessly testable and reusable by the batch sim**, because
  the verbs never touch Redux.

**Refinement follow-through:** the same principle rules out a `debugSlice`, because registering one
would require editing the production `store.ts`. Debug UI state (layer open, floating vs docked,
active panel, last loaded scenario) lives in React state/context **inside `DebugRoot`**. Redux stays
readable via `useSelector` and writable via `useDispatch` from within the debug layer — nothing is
lost, and `store.ts` is never touched.

Accepted cost: Redux DevTools shows every god-tool mutation as a generic `battle/setBattleState`
rather than a named action. If that bites in practice, revisit — it is a debugging-ergonomics
regret, not a correctness one.

### 5. Debug mutations are logged

Every verb appends a `[DEBUG] ...` line to `state.logs` (e.g. `[DEBUG] set kraken HP to 1`). An
exported snapshot then carries the account of what was done to it, so a repro explains itself later.

Interaction with [Scenario schema v1](02-scenario-schema.md): `logs` is a compared field, so a
scenario recorded with god-tool use will not diff clean against a pristine replay. Accepted — those
runs genuinely are not clean, and the prefix makes it obvious why. No schema change needed.
