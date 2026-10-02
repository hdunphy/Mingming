import { useSyncExternalStore } from 'react';

import { loadSettings, subscribeSettings } from './settings';

/**
 * TICKET 183d — "Show tips", read in one place (the twin of `useAdvancedContent`).
 *
 * `Callout` is the only reader: with the switch off it draws nothing and marks nothing seen.
 */
export function useShowTips(): boolean {
    return useSyncExternalStore(
        subscribeSettings,
        () => loadSettings().showTips,
        () => loadSettings().showTips,
    );
}
