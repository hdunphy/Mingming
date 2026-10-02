import React from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { addBlueprint, setIntroDone } from '../store/gameSlice';
import type { RootState } from '../store/store';
import { loadSettings, saveSettings } from '../settings/settings';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import {
    SHOW_ADVANCED_HOVER, SHOW_ADVANCED_LABEL, SKIP_INTRO_HOVER, SKIP_INTRO_LABEL,
} from '../settings/switches';
import { startIntroRun } from '../intro/startIntroRun';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import BuildLabel from './BuildLabel';
import { STARTER_FLAVOUR } from './starterFlavour';

/**
 * TICKET 172 — the starter card says what the assembly bay will ask you, not what the alpha did.
 *
 * Henry, 2026-09-30, on this screen: *"The text here like starter card and the descriptions don't
 * make sense. Either remove them or replace them with better info. Something closer to our current
 * assemble UI."* The card printed a "starter card" (Squirt, Spicy Breath, Quick Leaf) from a deck
 * system that no longer exists and a flavour line that described neither firmware. The assembly
 * bay's firmware picker shows each OS's name and its one-line rule, read from the registry; the card
 * now shows exactly that, for both of the species' firmware, so the first choice the game asks for
 * is made knowing what the second one will be.
 */
function firmwareOf(speciesId: string): Array<{ id: string; name: string; description: string }> {
    return GetMingmingData(speciesId).availableOS.map((id) => ({
        id,
        name: getOSBehavior(id)?.name ?? id,
        description: getOSBehavior(id)?.description ?? '',
    }));
}

const StarterCard: React.FC<{
    id: 'kraken' | 'fenrir' | 'ratatoskr';
    name: string;
    element: string;
    onSelect: () => void;
}> = ({ id, name, element, onSelect }) => {
    const isFire = id === 'fenrir';
    const isNature = id === 'ratatoskr';

    let borderColor = 'var(--el-water)';
    if (isFire) borderColor = 'var(--el-fire)';
    if (isNature) borderColor = 'var(--hp)';

    let glowColor = 'rgba(0,136,255,0.2)';
    if (isFire) glowColor = 'rgba(255,68,0,0.2)';
    if (isNature) glowColor = 'rgba(0,255,170,0.2)';

    let titleColor = 'var(--panel-edge)';
    if (isFire) titleColor = 'var(--amber)';
    if (isNature) titleColor = 'var(--hp)';

    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.95 }}
            style={{
                width: '300px',
                background: 'var(--panel)',
                borderRadius: '15px',
                padding: '20px 22px',
                border: `2px solid ${borderColor}`,
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${glowColor}`
            }}
            onClick={onSelect}
            /*
             * ══ TICKET 38 — THE FIRST CLICK IN THE GAME WAS NOT A KEYPRESS. ══
             *
             * A keyboard-only run measured in Chromium got no further than this card. The Tab ring
             * REACHED it — framer-motion's `whileTap` adds a `tabindex` of its own — and Enter did
             * nothing, because a `div` with an `onClick` has no keyboard semantics. That is the
             * worst of the three possible states: not reachable is at least honest, whereas
             * reachable-but-inert puts a focus ring on something that refuses to answer.
             *
             * **axe could not have caught this.** It checks an element's properties, and the
             * element had a tabindex; whether Enter actually does anything is behaviour, which is
             * why the Done-when asks for a keyboard RUN and not only a scan.
             *
             * Not converted to a `<button>`: the card is 280px of layout with an `h2` inside it,
             * and a button would bring a user-agent stylesheet and nested-heading semantics with
             * it. `role="button"` plus a key handler is the same contract without that.
             */
            role="button"
            tabIndex={0}
            aria-label={`Choose ${name}, the ${element} starter`}
            data-testid={`starter-${id}`}
            onKeyDown={(event) => {
                // Enter AND Space, because that is what a real button answers to and a player who
                // has tabbed to a card will try whichever one they habitually use.
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
        >
            <div style={{ fontSize: '1rem', color: titleColor, fontWeight: 'bold', marginBottom: '4px' }}>
                {element.toUpperCase()} UNIT
            </div>
            <h2 style={{ fontSize: '2rem', margin: '4px 0', letterSpacing: '2px' }}>{name}</h2>
            {/* TICKET 182a: one short line of flavour. A div, not a paragraph: it is a label on a card. */}
            <div style={{ color: 'var(--text-mute)', fontSize: '0.85rem', fontStyle: 'italic', margin: '2px 0 6px' }}>
                {STARTER_FLAVOUR[id]}
            </div>
            <div style={{ color: 'var(--text-faint)', fontSize: '0.7rem', letterSpacing: '1px', margin: '8px 0 4px' }}>
                FIRMWARE — YOU PICK ONE WHEN YOU ASSEMBLE IT
            </div>
            {firmwareOf(id).map((os) => (
                <div
                    key={os.id}
                    style={{ textAlign: 'left', marginTop: '8px', padding: '10px', background: 'var(--panel)', borderRadius: '8px' }}
                >
                    <div style={{ color: titleColor, fontSize: '0.85rem', fontWeight: 'bold' }}>{os.name}</div>
                    <div style={{ color: 'var(--text-mute)', fontSize: '0.8rem', marginTop: '4px', lineHeight: 1.4 }}>{os.description}</div>
                </div>
            ))}
        </motion.div>
    );
};

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
    const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' };
    return (
        <div
            style={{ display: 'flex', gap: '28px', marginTop: '22px', color: 'var(--text-faint)', fontSize: '0.78rem' }}
            data-testid="starter-switches"
        >
            <label style={row} title={SKIP_INTRO_HOVER}>
                <input
                    type="checkbox"
                    checked={skipIntro}
                    onChange={(event) => dispatch(setIntroDone(event.target.checked))}
                />
                {SKIP_INTRO_LABEL}
            </label>
            <label style={row} title={SHOW_ADVANCED_HOVER}>
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
        <div className="main-menu" style={{
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(circle at center, var(--page) 0%, var(--page) 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text)',
            overflowY: 'auto'
        }}>
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '28px' }}
            >
                {/* TICKET 182a: the game's name. The drawn logo comes with 183. */}
                <h1 style={{ fontSize: '3.4rem', fontWeight: '900', letterSpacing: '10px', margin: 0, color: 'var(--hp)' }}>Mingming</h1>
                <p style={{ color: 'var(--text-faint)', marginTop: '10px', fontSize: '1.1rem' }}>Choose your starter</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ display: 'flex', gap: '28px', alignItems: 'stretch' }}
            >
                <StarterCard
                    id="kraken"
                    name="KRAKEN"
                    element="Water"
                    onSelect={() => choose('kraken')}
                />
                <StarterCard
                    id="fenrir"
                    name="FENRIR"
                    element="Fire"
                    onSelect={() => choose('fenrir')}
                />
                <StarterCard
                    id="ratatoskr"
                    name="RATATOSKR"
                    element="Nature"
                    onSelect={() => choose('ratatoskr')}
                />
            </motion.div>

            {/* TICKET 182d: the two switches, under the starters. */}
            <Switches />

            {/* TICKET 181a: the build, so a bug report can name it. 182a: small, in a corner. */}
            <BuildLabel />
        </div>
    );
};

export default MainMenuView;
