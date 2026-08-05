/**
 * Shared debug-layer UI state.
 *
 * Lives in its own module rather than in `DebugRoot.tsx` so that panel components can call
 * `useDebugUI()` without importing `DebugRoot` — which would create an import cycle
 * (`DebugRoot` -> `panels/index` -> panel -> `DebugRoot`).
 *
 * Module-scoped, not React-scoped, because the floating layer and the docked Debug tab mount
 * as two separate React subtrees in `App.tsx` and must agree on the active panel and the last
 * loaded scenario. Plain subscribe/emit; deliberately no `debugSlice`, because registering one
 * would mean editing the production `src/ui/store/store.ts`. Redux stays readable via
 * `useSelector` and writable via `useDispatch` from inside the debug tree.
 */

import { createContext, useContext } from 'react';
import type { DebugPanelId } from './panels';

export type DebugPresentation = 'floating' | 'docked';

export interface DebugUIState {
    /** Whether the floating layer's panel is expanded. The docked panel ignores this. */
    isOpen: boolean;
    /** Which panel is showing, in either presentation. `null` = fall back to the first panel. */
    activePanel: DebugPanelId | null;
    /** `name` of the most recently loaded scenario, for "reload last" affordances. */
    lastScenarioName: string | null;
}

export interface DebugUIContextValue extends DebugUIState {
    /** How this subtree is mounted: the fixed-position layer, or the Debug tab. */
    presentation: DebugPresentation;
    setOpen: (open: boolean) => void;
    toggleOpen: () => void;
    setActivePanel: (panel: DebugPanelId | null) => void;
    setLastScenarioName: (name: string | null) => void;
}

const initialState: DebugUIState = {
    isOpen: false,
    activePanel: null,
    lastScenarioName: null,
};

let uiState: DebugUIState = initialState;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getSnapshot(): DebugUIState {
    return uiState;
}

function patchUIState(patch: Partial<DebugUIState>): void {
    uiState = { ...uiState, ...patch };
    for (const listener of listeners) listener();
}

export const setOpen = (open: boolean) => patchUIState({ isOpen: open });
export const toggleOpen = () => patchUIState({ isOpen: !uiState.isOpen });
export const setActivePanel = (panel: DebugPanelId | null) => patchUIState({ activePanel: panel });
export const setLastScenarioName = (name: string | null) => patchUIState({ lastScenarioName: name });

export const DebugUIContext = createContext<DebugUIContextValue | null>(null);

/** Read the debug UI state from inside `src/debug/`. Throws if used outside `DebugRoot`. */
export function useDebugUI(): DebugUIContextValue {
    const ctx = useContext(DebugUIContext);
    if (!ctx) {
        throw new Error('useDebugUI() must be called inside <DebugRoot>.');
    }
    return ctx;
}
