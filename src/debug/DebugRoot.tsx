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
 * This file owns the *chrome* only: the toggle chip, the hotkey, the two presentations and
 * the panel selector strip. It owns no panel content. Panels register themselves in
 * `./panels/index.ts` — see the "ADDING A PANEL" note there; adding one never touches this
 * file. Shared debug UI state lives in `./debugUI.ts` so panels can read it without importing
 * back into this module.
 *
 * There is deliberately no `debugSlice`, because registering one would require editing the
 * production `src/ui/store/store.ts`. Redux stays readable via `useSelector` and writable via
 * `useDispatch` from inside this tree.
 */

import { useEffect, useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

import { getActionTape, useActionTape } from './actionTape';
import { useSnapshotExportHotkey } from './snapshotIO';

import {
    DebugUIContext,
    getSnapshot,
    setActivePanel,
    setLastScenarioName,
    setOpen,
    subscribe,
    toggleOpen,
    useDebugUI,
    type DebugPresentation,
    type DebugUIContextValue,
} from './debugUI';
import { DEBUG_PANELS, resolveActivePanel } from './panels';

/**
 * Build-gate marker. `scripts/assert-no-debug.mjs` fails the build if this string
 * survives into `dist/`. Do not remove, rename, or split this literal.
 */
export const __DEBUG_TOOLKIT__ = '__DEBUG_TOOLKIT__';

// Type re-exports only: the canonical runtime imports for panels are `../debugUI` (state)
// and `./panels/types` (the panel contract).
export type {
    DebugPresentation,
    DebugUIState,
    DebugUIContextValue,
} from './debugUI';
export type { DebugPanel, DebugPanelId, DebugPanelProps } from './panels';

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
    // Wider than a tooltip because the relocated Balance/Studio surfaces are real screens.
    width: 'min(720px, calc(100vw - 24px))',
    maxHeight: 'min(70vh, 640px)',
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
    height: '100%',
    overflow: 'auto',
    color: '#e6e0ff',
    font: '13px/1.6 monospace',
};

const stripStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginBottom: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(122, 92, 255, 0.4)',
};

function tabStyle(isActive: boolean): CSSProperties {
    return {
        padding: '4px 10px',
        borderRadius: '4px',
        border: `1px solid ${isActive ? '#7a5cff' : 'rgba(122, 92, 255, 0.35)'}`,
        background: isActive ? 'rgba(122, 92, 255, 0.25)' : 'transparent',
        color: isActive ? '#e6e0ff' : '#a79ccc',
        font: '600 11px/1.4 monospace',
        letterSpacing: '0.06em',
        cursor: 'pointer',
    };
}

/** Panel selector strip. Reads the registry directly, so a new panel appears with no edit here. */
function PanelStrip({ activeId }: { activeId: string | undefined }): ReactNode {
    return (
        <div style={stripStyle} role="tablist" aria-label="Debug panels">
            {DEBUG_PANELS.map((panel) => (
                <button
                    key={panel.id}
                    type="button"
                    role="tab"
                    aria-selected={panel.id === activeId}
                    style={tabStyle(panel.id === activeId)}
                    onClick={() => setActivePanel(panel.id)}
                >
                    {panel.label}
                </button>
            ))}
        </div>
    );
}

/** Body shared by both presentations: header, strip, active panel — or the empty state. */
function DebugBody(): ReactNode {
    const { presentation, activePanel, lastScenarioName } = useDebugUI();
    const panel = resolveActivePanel(activePanel);

    return (
        <div>
            <div style={{ fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>
                DEBUG TOOLKIT
                {presentation === 'floating' && (
                    <span style={{ float: 'right', opacity: 0.5, fontWeight: 400 }}>{HOTKEY_LABEL}</span>
                )}
            </div>
            <PanelStrip activeId={panel?.id} />
            {panel ? (
                <panel.Component presentation={presentation} />
            ) : (
                <p style={{ margin: 0, opacity: 0.6 }}>
                    No panels registered. Add one in <code>src/debug/panels/index.ts</code>.
                </p>
            )}
            {lastScenarioName && (
                <div style={{ marginTop: '10px', opacity: 0.5 }}>last scenario: {lastScenarioName}</div>
            )}
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
                    <DebugBody />
                </div>
            )}
        </>
    );
}

/** Docked presentation: the DEV-only Debug tab in App.tsx's render chain. */
function DockedPanel(): ReactNode {
    return (
        <div style={dockedPanelStyle}>
            <DebugBody />
        </div>
    );
}

// --- Root ---

export interface DebugRootProps {
    /** `'floating'` (default) mounts the fixed layer; `'docked'` mounts the Debug tab body. */
    mode?: DebugPresentation;
}

export default function DebugRoot({ mode = 'floating' }: DebugRootProps): ReactNode {
    // Ticket 17: install the store action tap for as long as the debug layer is mounted.
    // Refcounted inside, because App renders DebugRoot twice (floating layer + docked tab).
    useActionTape();
    // Ticket 16: Ctrl+Shift+E exports a snapshot without the layer being open. Passing the
    // tape getter rather than a snapshot array so the export reads the tape at keypress time,
    // not at render time.
    useSnapshotExportHotkey({ getTape: getActionTape });

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
