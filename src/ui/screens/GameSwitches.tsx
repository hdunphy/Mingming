import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { playSfx } from '../audio/AudioEngine';
import { loadSettings, saveSettings } from '../settings/settings';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import { useShowTips } from '../settings/useShowTips';
import {
    SHOW_ADVANCED_HOVER, SHOW_ADVANCED_LABEL, SHOW_TIPS_HOVER, SHOW_TIPS_LABEL,
    SKIP_INTRO_HOVER, SKIP_INTRO_LABEL,
} from '../settings/switches';
import { setIntroDone } from '../store/gameSlice';
import type { RootState } from '../store/store';

/**
 * TICKET 182d — the switches, in Settings (Show tips joined in 183d) (the starter screen of a new save has them too).
 *
 * **Skip intro** is about this save, so it is the ranch's `introDone`: shown only while the intro
 * has not been done, and turning it on sets it. **Show advanced content** is about the person, so
 * it is in `mingming_settings` and follows them to a new save slot. Neither implies the other, and
 * neither adds macros or patches to the intro. No note under either: the hover line is the help.
 */
export default function GameSwitches(): ReactNode {
    const dispatch = useDispatch();
    const introDone = useSelector((state: RootState) => state.game.introDone ?? true);
    const advanced = useAdvancedContent();
    const tips = useShowTips();

    const choices = (value: boolean, set: (next: boolean) => void): ReactNode => (
        <div className="settings-control settings-choices">
            {([false, true] as const).map((choice) => (
                <button
                    key={String(choice)}
                    type="button"
                    className={`settings-choice ${value === choice ? 'active' : ''}`}
                    aria-pressed={value === choice}
                    onClick={() => { playSfx('uiClick'); set(choice); }}
                >
                    {choice ? 'On' : 'Off'}
                </button>
            ))}
        </div>
    );

    return (
        <section className="settings-group">
            <h3>Game</h3>
            {!introDone && (
                <div className="settings-row" title={SKIP_INTRO_HOVER}>
                    <span className="settings-label">{SKIP_INTRO_LABEL}</span>
                    {choices(false, (next) => { if (next) dispatch(setIntroDone(true)); })}
                </div>
            )}
            <div className="settings-row" title={SHOW_ADVANCED_HOVER}>
                <span className="settings-label">{SHOW_ADVANCED_LABEL}</span>
                {choices(advanced, (next) => saveSettings({ ...loadSettings(), showAdvancedContent: next }))}
            </div>
            <div className="settings-row" title={SHOW_TIPS_HOVER}>
                <span className="settings-label">{SHOW_TIPS_LABEL}</span>
                {choices(tips, (next) => saveSettings({ ...loadSettings(), showTips: next }))}
            </div>
        </section>
    );
}
