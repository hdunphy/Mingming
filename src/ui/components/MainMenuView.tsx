import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addBlueprint, setIntroDone } from '../store/gameSlice';
import type { RootState } from '../store/store';
import { loadSettings, saveSettings } from '../settings/settings';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import {
    SHOW_ADVANCED_HOVER, SHOW_ADVANCED_LABEL, SKIP_INTRO_HOVER, SKIP_INTRO_LABEL,
} from '../settings/switches';
import { startIntroRun } from '../intro/startIntroRun';
import BuildLabel from './BuildLabel';
import { StarterCard } from './starter/StarterCard';

/**
 * TICKET 182d — the two switches, one line each, small, under the three starters. They are labels
 * (not paragraphs), so the screen's one sentence is still the line under the title.
 *
 * "Skip intro" is this save's `introDone`; "Show advanced content" is the person's setting. A pick
 * reads them at click time, so changing either before choosing is all it takes.
 */
const Switches: React.FC = () => {
    const dispatch = useDispatch();
    const skipIntro = useSelector((state: RootState) => state.game.introDone ?? true);
    const advanced = useAdvancedContent();
    return (
        <div className="starter-switches k-display" data-testid="starter-switches">
            <label className="starter-switch" title={SKIP_INTRO_HOVER}>
                <input
                    type="checkbox"
                    checked={skipIntro}
                    onChange={(event) => dispatch(setIntroDone(event.target.checked))}
                />
                {SKIP_INTRO_LABEL}
            </label>
            <label className="starter-switch" title={SHOW_ADVANCED_HOVER}>
                <input
                    type="checkbox"
                    checked={advanced}
                    onChange={(event) => saveSettings({ ...loadSettings(), showAdvancedContent: event.target.checked })}
                />
                {SHOW_ADVANCED_LABEL}
            </label>
        </div>
    );
};

const MainMenuView: React.FC = () => {
    const dispatch = useDispatch();
    const introDone = useSelector((state: RootState) => state.game.introDone ?? true);

    /**
     * TICKET 182c: with the intro on, a pick builds the starter on v1 and starts the intro at once
     * (no ranch visit). With "Skip intro" on, it is the old path: the blueprint, then the ranch.
     */
    const choose = (speciesId: 'kraken' | 'fenrir' | 'ratatoskr'): void => {
        if (introDone) dispatch(addBlueprint(speciesId));
        else startIntroRun(dispatch, speciesId);
    };

    return (
        <div className="main-menu starter-screen">
            <div className="starter-title">
                {/* TICKET 182a: the game's name. The drawn logo comes with the art pass. */}
                <h1 className="k-display">Mingming</h1>
                <p className="starter-line k-slant k-display">Choose your starter</p>
            </div>

            <div className="starter-row">
                <StarterCard id="kraken" name="Kraken" element="Water" onSelect={() => choose('kraken')} />
                <StarterCard id="fenrir" name="Fenrir" element="Fire" onSelect={() => choose('fenrir')} />
                <StarterCard id="ratatoskr" name="Ratatoskr" element="Nature" onSelect={() => choose('ratatoskr')} />
            </div>

            {/* TICKET 182d: the two switches, under the starters. */}
            <Switches />

            {/* TICKET 181a: the build, so a bug report can name it. 182a: small, in a corner. */}
            <BuildLabel />
        </div>
    );
};

export default MainMenuView;
