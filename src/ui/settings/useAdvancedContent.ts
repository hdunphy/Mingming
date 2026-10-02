import { useSyncExternalStore } from 'react';

import { loadSettings, subscribeSettings } from './settings';

/**
 * TICKET 182b — "Show advanced content", read in one place.
 *
 * Every hide-when-empty rule is `empty && !useAdvancedContent()`. A component never reads
 * `loadSettings()` for this itself, so moving where the switch lives is a one-file change.
 *
 * `useSyncExternalStore` so the Settings screen flipping the switch repaints a screen that is
 * already mounted underneath it. The snapshot is a boolean, so reading it on every render is cheap.
 */
export function useAdvancedContent(): boolean {
    return useSyncExternalStore(
        subscribeSettings,
        () => loadSettings().showAdvancedContent,
        // `renderToStaticMarkup` (every screen test) takes the server snapshot: same read, so a test
        // that switched the setting on sees it on.
        () => loadSettings().showAdvancedContent,
    );
}
