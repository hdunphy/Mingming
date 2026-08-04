/**
 * The debug panel registry.
 *
 * ADDING A PANEL — two steps, no edits to `DebugRoot.tsx`:
 *
 *   1. Write `src/debug/panels/MyPanel.tsx` exporting a default component. It may take
 *      `DebugPanelProps` (`{ presentation }`) or no props at all, and may call `useDebugUI()`
 *      from `../debugUI` for shared debug state.
 *   2. Import it below and add one entry to `DEBUG_PANELS`.
 *
 * Array order is display order in the panel selector strip. `DebugPanelId` is derived from
 * the array, so every `id` here is automatically a valid `DebugUIState.activePanel` value and
 * a typo is a compile error rather than a panel that silently never renders.
 *
 * Panels are eagerly imported: the whole registry ships inside the single lazy `DebugRoot`
 * chunk, which only exists in a dev build, so there is nothing to code-split further.
 */

import BalanceTester from './BalanceTester';
import GodToolsPanel from './GodToolsPanel';
import SaveEditorPanel from './SaveEditorPanel';
import SaveSlotsPanel from './SaveSlotsPanel';
import SnapshotPanel from './SnapshotPanel';
import CardStudio from './CardStudio';
import type { DebugPanel } from './types';

export type { DebugPanel, DebugPanelProps } from './types';

export const DEBUG_PANELS = [
    { id: 'balance', label: 'Balance', Component: BalanceTester },
    { id: 'studio', label: 'Studio', Component: CardStudio },
    { id: 'godtools', label: 'God Tools', Component: GodToolsPanel },
    { id: 'snapshot', label: 'Snapshot', Component: SnapshotPanel },
    { id: 'save', label: 'Save', Component: SaveEditorPanel },
    { id: 'slots', label: 'Slots', Component: SaveSlotsPanel },
] as const satisfies readonly DebugPanel[];

/** Union of every registered panel id — derived, so the registry stays the single source. */
export type DebugPanelId = (typeof DEBUG_PANELS)[number]['id'];

/** Resolve the panel to show: the selected one, or the first registered panel. */
export function resolveActivePanel(activePanel: DebugPanelId | null): DebugPanel | undefined {
    if (activePanel !== null) {
        const match = DEBUG_PANELS.find((panel) => panel.id === activePanel);
        if (match) return match;
    }
    return DEBUG_PANELS[0];
}
