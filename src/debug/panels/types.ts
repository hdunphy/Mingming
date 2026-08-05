/**
 * The debug panel contract.
 *
 * Kept separate from `panels/index.ts` so a panel module can import the type without
 * importing the registry that imports it back.
 */

import type { ComponentType } from 'react';
import type { DebugPresentation } from '../debugUI';

/** Every panel receives the presentation it is being rendered in, and nothing else. */
export interface DebugPanelProps {
    /** `'floating'` = the narrow fixed layer; `'docked'` = the full-width Debug tab. */
    presentation: DebugPresentation;
}

export interface DebugPanel {
    /** Stable identifier. Also the value stored in `DebugUIState.activePanel`. */
    id: string;
    /** Text on the panel's selector button. Keep it short — the strip is one row. */
    label: string;
    /** Panel body. Components that ignore `DebugPanelProps` are fine. */
    Component: ComponentType<DebugPanelProps>;
}
