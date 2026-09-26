import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { ProgramEntity } from '../../engine/types';
import { ElementMark } from '../screens/CardChassis';
import { colorFor } from '../screens/runShell';
import { playSfx } from '../audio/AudioEngine';
import { discardRows } from './discardPile';

/**
 * The discard pile, clickable — Henry, 2026-09-25: *"You should be able to see your cards when you
 * click on discard if you need to see what the last card did."*
 *
 * The pile's card back becomes a button; the list opens above it, newest first (see
 * `discardPile.ts`). It closes on a second click, on Escape, and on a click anywhere else, so it
 * never has to be dismissed before the player can act on the board. An empty discard is still a
 * button and says so, rather than a control that silently does nothing on turn 1.
 */
interface Props {
    readonly discard: ReadonlyArray<ProgramEntity>;
    /** The pile face and its count, rendered by the hand exactly as before — this only wraps it. */
    readonly children: React.ReactNode;
}

const DiscardPileViewer: React.FC<Props> = ({ discard, children }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const rows = useMemo(() => discardRows(discard), [discard]);

    useEffect(() => {
        if (!open) return undefined;
        /*
         * CAPTURE PHASE, and the Escape is CONSUMED. The battle's own key handler also listens on
         * `window` and reads Escape with nothing selected as "open Settings" - so an Escape that
         * closed this list used to open Settings behind it (caught by the 09-26 review). A
         * window-capture listener runs before any bubbling one, and stopping it there means the
         * battle never sees the key that was ours.
         */
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            e.preventDefault();
            setOpen(false);
        };
        const onPointer = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('pointerdown', onPointer);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('pointerdown', onPointer);
        };
    }, [open]);

    return (
        <div className="dpv" ref={rootRef}>
            <button
                type="button"
                className="dpv-toggle"
                aria-expanded={open}
                aria-controls="discard-pile-list"
                title="See the discard pile"
                onClick={(e) => {
                    playSfx('uiClick');
                    setOpen(!open);
                    // A MOUSE click must not leave the pile holding focus: Enter is the battle's
                    // cast key, and a focused button would also "click" on it and reopen the list.
                    // `detail` is 0 for a keyboard activation, which keeps its focus where it is.
                    if (e.detail > 0) e.currentTarget.blur();
                }}
            >
                {children}
            </button>
            {open && (
                <div className="rs-panel dpv-list" id="discard-pile-list" role="dialog" aria-label="Discard pile">
                    <h2>DISCARD · {rows.length}</h2>
                    {rows.length === 0 ? (
                        <p className="dpv-empty">Nothing played yet this shuffle.</p>
                    ) : (
                        <ol className="dpv-rows">
                            {rows.map((row, index) => (
                                <li
                                    key={row.id}
                                    className={`rs-row dpv-row ${index === 0 ? 'dpv-latest' : ''}`}
                                    style={{ ['--el' as string]: colorFor(row.element) }}
                                >
                                    <span className="rs-g">{row.cost}</span>
                                    <ElementMark element={row.element} compact />
                                    <span className="dpv-text">
                                        <b className="dpv-name">{row.name}</b>
                                        {index === 0 && <span className="dpv-tag">last in</span>}
                                        <span className="dpv-desc">{row.description}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}
        </div>
    );
};

export default DiscardPileViewer;
