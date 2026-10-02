/**
 * THE SETTINGS BUTTON — ticket 183b (182 R5: no pause menu). A slant panel with the gear, far right
 * of the bar. It was a gear in a rounded box; it is a button now in the kit's shape.
 */
import React from 'react';

import { Icon } from '../../theme/Icon';
import { SlantPanel } from '../../theme/kit/SlantPanel';

export function SettingsGear({ onOpen }: { readonly onOpen?: () => void }): React.ReactElement {
    return (
        <SlantPanel cut={8} className="battle-topbar-gear-panel">
            <button
                type="button"
                className="battle-topbar-gear"
                title="Settings"
                aria-label="Settings"
                onClick={onOpen}
            >
                <Icon name="settings" size={20} />
            </button>
        </SlantPanel>
    );
}
