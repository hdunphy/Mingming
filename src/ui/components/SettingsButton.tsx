import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { playSfx } from '../audio/AudioEngine';
import { openSettings } from '../store/uiSlice';
import { Icon } from '../theme/Icon';

/**
 * TICKET 182a (R5) — a small Settings button for the run screens.
 *
 * There is no pause menu: volume, theme and "Abandon run" all live in Settings. The ranch nav and the
 * battle already open it; the map had no way in, so this is the map's.
 */
export default function SettingsButton(): ReactNode {
    const dispatch = useDispatch();
    return (
        <button
            type="button"
            className="ranch-button subtle"
            aria-label="Settings"
            title="Settings"
            onClick={() => { playSfx('uiClick'); dispatch(openSettings()); }}
        >
            <Icon name="settings" size={16} />
        </button>
    );
}
