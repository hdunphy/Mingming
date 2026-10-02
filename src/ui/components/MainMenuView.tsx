import React from 'react';
import { motion } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { addBlueprint } from '../store/gameSlice';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { BUILD_INFO, buildText } from '../buildInfo';

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

    let borderColor = '#0088ff';
    if (isFire) borderColor = '#ff4400';
    if (isNature) borderColor = '#00ffaa';

    let glowColor = 'rgba(0,136,255,0.2)';
    if (isFire) glowColor = 'rgba(255,68,0,0.2)';
    if (isNature) glowColor = 'rgba(0,255,170,0.2)';

    let titleColor = '#00ccff';
    if (isFire) titleColor = '#ff8800';
    if (isNature) titleColor = '#00ffa3';

    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.95 }}
            style={{
                width: '300px',
                background: '#1a1a1a',
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
            <div style={{ color: '#666', fontSize: '0.7rem', letterSpacing: '1px', margin: '8px 0 4px' }}>
                FIRMWARE — YOU PICK ONE WHEN YOU ASSEMBLE IT
            </div>
            {firmwareOf(id).map((os) => (
                <div
                    key={os.id}
                    style={{ textAlign: 'left', marginTop: '8px', padding: '10px', background: '#222', borderRadius: '8px' }}
                >
                    <div style={{ color: titleColor, fontSize: '0.85rem', fontWeight: 'bold' }}>{os.name}</div>
                    <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '4px', lineHeight: 1.4 }}>{os.description}</div>
                </div>
            ))}
        </motion.div>
    );
};

const MainMenuView: React.FC = () => {
    const dispatch = useDispatch();

    return (
        <div className="main-menu" style={{
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(circle at center, #111 0%, #000 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            overflowY: 'auto'
        }}>
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '28px' }}
            >
                <h1 style={{ fontSize: '3rem', fontWeight: '900', letterSpacing: '10px', margin: 0, background: 'linear-gradient(to bottom, #fff, #333)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    TERMINAL
                </h1>
                <h1 style={{ fontSize: '3rem', fontWeight: '900', letterSpacing: '10px', margin: 0, marginTop: '-10px', color: '#00ffaa' }}>
                    GAUNTLET
                </h1>
                <p style={{ color: '#555', marginTop: '10px', fontSize: '1.1rem' }}>CHOOSE YOUR FIRST MINGMING</p>
                <p style={{ color: '#444', marginTop: '6px', fontSize: '0.8rem', maxWidth: '46ch' }}>
                    You are granted its blueprint. Assemble it at the ranch — that is how every mingming
                    you will ever own comes into existence.
                </p>
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
                    onSelect={() => dispatch(addBlueprint('kraken'))}
                />
                <StarterCard
                    id="fenrir"
                    name="FENRIR"
                    element="Fire"
                    onSelect={() => dispatch(addBlueprint('fenrir'))}
                />
                <StarterCard
                    id="ratatoskr"
                    name="RATATOSKR"
                    element="Nature"
                    onSelect={() => dispatch(addBlueprint('ratatoskr'))}
                />
            </motion.div>

            <div style={{ position: 'fixed', bottom: '10px', color: '#333', fontSize: '0.8rem' }}>
                {/* TICKET 181a: the build, so a bug report can name it. Was a hard-coded `ALPHA v0.3.5`. */}
                {buildText(BUILD_INFO)}
            </div>
        </div>
    );
};

export default MainMenuView;
