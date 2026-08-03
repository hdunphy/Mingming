/**
 * DebugRoot — the single import edge between the game and the debug toolkit.
 *
 * Standing invariant: nothing outside `src/debug/` may import anything inside it,
 * except the one DEV-gated lazy import in `src/App.tsx`:
 *
 *     const DebugRoot = import.meta.env.DEV ? lazy(() => import('./debug/DebugRoot')) : null;
 *
 * Vite substitutes `false` for `import.meta.env.DEV` in a production build, the ternary
 * folds to `null`, the dynamic import becomes unreachable, and Rollup never emits the chunk.
 * `scripts/assert-no-debug.mjs` proves it after the fact by grepping `dist/` for the
 * `__DEBUG_TOOLKIT__` marker exported below.
 *
 * Debug UI state lives here in React state/context — there is deliberately no `debugSlice`,
 * because registering one would require editing the production `src/ui/store/store.ts`.
 * Redux stays readable via `useSelector` and writable via `useDispatch` from inside this tree.
 *
 * This is the empty shell. Later tickets fill in the panels (scenario launcher, god tools,
 * the relocated Balance and Studio surfaces).
 */

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useSyncExternalStore,
    type CSSProperties,
    type ReactNode,
} from 'react';

/**
 * Build-gate marker. `scripts/assert-no-debug.mjs` fails the build if this string
 * survives into `dist/`. Do not remove, rename, or split this literal.
 */
export const __DEBUG_TOOLKIT__ = '__DEBUG_TOOLKIT__';

// --- Types ---

export type DebugPresentation = 'floating' | 'docked';

/** Panel identifiers are open-ended on purpose; later tickets register their own. */
export type DebugPanelId = string;

export interface DebugUIState {
    /** Whether the floating layer's panel is expanded. The docked panel ignores this. */
    isOpen: boolean;
    /** Which panel is showing, in either presentation. `null` = none selected yet. */
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

// --- Shared UI state ---
//
// Module-scoped so the floating layer and the docked tab — which mount as two separate
// React subtrees in App.tsx — agree on the active panel and the last loaded scenario.
// Plain subscribe/emit; no Redux, no store.ts edit.

const initialState: DebugUIState = {
    isOpen: false,
    activePanel: null,
    lastScenarioName: null,
};

let uiState: DebugUIState = initialState;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): DebugUIState {
    return uiState;
}

function patchUIState(patch: Partial<DebugUIState>): void {
    uiState = { ...uiState, ...patch };
    for (const listener of listeners) listener();
}

const setOpen = (open: boolean) => patchUIState({ isOpen: open });
const toggleOpen = () => patchUIState({ isOpen: !uiState.isOpen });
const setActivePanel = (panel: DebugPanelId | null) => patchUIState({ activePanel: panel });
const setLastScenarioName = (name: string | null) => patchUIState({ lastScenarioName: name });

const DebugUIContext = createContext<DebugUIContextValue | null>(null);

/** Read the debug UI state from inside `src/debug/`. Throws if used outside `DebugRoot`. */
export function useDebugUI(): DebugUIContextValue {
    const ctx = useContext(DebugUIContext);
    if (!ctx) {
        throw new Error('useDebugUI() must be called inside <DebugRoot>.');
    }
    return ctx;
}

// --- Hotkey ---

const HOTKEY_LABEL = 'Ctrl+Shift+D';

/**
 * The app has real text fields (CardForm, deck naming). Swallowing Ctrl+Shift+D while the
 * user is typing would be hostile, so the handler no-ops whenever focus is in a text entry.
 */
function isTextEntryTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
}

function useDebugHotkey(onToggle: () => void): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return;
            // `key` is 'D' with Shift held on most layouts; `code` covers the rest.
            if (event.code !== 'KeyD' && event.key.toLowerCase() !== 'd') return;
            if (isTextEntryTarget(event.target)) return;
            event.preventDefault();
            onToggle();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onToggle]);
}

// --- Presentation ---

const OVERLAY_Z = 9000;

const chipStyle: CSSProperties = {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: OVERLAY_Z + 1,
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid #7a5cff',
    background: 'rgba(18, 14, 34, 0.92)',
    color: '#cfc4ff',
    font: '600 11px/1 monospace',
    letterSpacing: '0.08em',
    cursor: 'pointer',
};

const floatingPanelStyle: CSSProperties = {
    position: 'fixed',
    right: '12px',
    bottom: '52px',
    zIndex: OVERLAY_Z,
    width: 'min(360px, calc(100vw - 24px))',
    maxHeight: 'min(60vh, 520px)',
    overflow: 'auto',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #7a5cff',
    background: 'rgba(12, 10, 24, 0.97)',
    color: '#e6e0ff',
    font: '12px/1.5 monospace',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
};

const dockedPanelStyle: CSSProperties = {
    padding: '16px',
    color: '#e6e0ff',
    font: '13px/1.6 monospace',
};

function PanelPlaceholder({ presentation }: { presentation: DebugPresentation }): ReactNode {
    const { activePanel, lastScenarioName } = useDebugUI();
    return (
        <div>
            <div style={{ fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>
                DEBUG TOOLKIT
            </div>
            <p style={{ margin: '0 0 8px' }}>
                No panels registered yet. Scenario launcher, god tools, Balance and Studio land here
                in later tickets.
            </p>
            <div style={{ opacity: 0.6 }}>
                <div>presentation: {presentation}</div>
                <div>active panel: {activePanel ?? '—'}</div>
                <div>last scenario: {lastScenarioName ?? '—'}</div>
                {presentation === 'floating' && <div>hotkey: {HOTKEY_LABEL}</div>}
            </div>
        </div>
    );
}

/** Fixed-position layer: works at roster 0, mid-battle and in the hub, because it never
 *  depends on the nav existing. */
function FloatingLayer(): ReactNode {
    const { isOpen } = useDebugUI();
    // `toggleOpen` is a stable module-level function, so the hotkey effect never re-binds.
    useDebugHotkey(toggleOpen);

    return (
        <>
            <button
                type="button"
                style={chipStyle}
                onClick={toggleOpen}
                title={`Toggle debug layer (${HOTKEY_LABEL})`}
                aria-expanded={isOpen}
            >
                DEBUG
            </button>
            {isOpen && (
                <div style={floatingPanelStyle} role="dialog" aria-label="Debug toolkit">
                    <PanelPlaceholder presentation="floating" />
                </div>
            )}
        </>
    );
}

/** Docked presentation: the DEV-only Debug tab in App.tsx's render chain. */
function DockedPanel(): ReactNode {
    return (
        <div style={dockedPanelStyle}>
            <PanelPlaceholder presentation="docked" />
        </div>
    );
}

// --- Root ---

export interface DebugRootProps {
    /** `'floating'` (default) mounts the fixed layer; `'docked'` mounts the Debug tab body. */
    mode?: DebugPresentation;
}

export default function DebugRoot({ mode = 'floating' }: DebugRootProps): ReactNode {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const value = useMemo<DebugUIContextValue>(
        () => ({
            ...state,
            presentation: mode,
            setOpen,
            toggleOpen,
            setActivePanel,
            setLastScenarioName,
        }),
        [state, mode],
    );

    return (
        <DebugUIContext.Provider value={value}>
            {mode === 'docked' ? <DockedPanel /> : <FloatingLayer />}
        </DebugUIContext.Provider>
    );
}
