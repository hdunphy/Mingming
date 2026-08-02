# Debug gating architecture

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: — ([Engine readiness audit](01-engine-readiness-audit.md) closed)

## Question

How the dev-only gate concretely works and where debug surfaces mount — the structural decision every build ticket sits on.

To decide:

- **Gate pattern.** `import.meta.env.DEV` static guards + `React.lazy` dynamic import of a single `DebugRoot`, so `vite build` tree-shakes the whole toolkit. Confirm the pattern and the single choke point.
- **Debug tab mounting.** `App.tsx` touch points: `Tab` union (`:19`), `TAB_CONFIG` (`:21-30`, filtered by DEV), render chain (`:90-97`). And the two early returns the audit flagged: battle mode replaces all nav (`:68-70`) — so god tools must be an overlay mounted inside/above `BattleArena` — and empty roster short-circuits to `MainMenuView` (`:64-66`), which locks out the launcher exactly when you want a from-scratch scenario. How does the Debug tab stay reachable in both states?
- **Fate of the existing ungated surfaces.** Balance tab, Studio tab, and `window.runSim` (`main.tsx:5` → `SimRunner.ts:102-105`) ship to players today. Move under the Debug gate, or leave any public?
- **Dispatch surface.** Standardize battle injection on `battleSlice.setBattleState` vs wiring the dead `INITIALIZE_BATTLE` (audit gap #10 — having both is ambiguous). New `debugSlice` for debug-only actions vs adding DEV-guarded actions to existing slices? Should debug mutations be visible in the battle log?
