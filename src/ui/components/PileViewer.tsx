import React, { useEffect, useRef, useState } from 'react';

import { ElementMark } from '../screens/CardChassis';
import { colorFor } from '../screens/runShell';
import { playSfx } from '../audio/AudioEngine';
import type { PileRow } from './pileRow';

/**
 * TICKET 184a — ONE CLICKABLE PILE, WHATEVER IS IN IT.
 *
 * Henry, 2026-10-01: *"You need to be able to see the draw cards like discard cards."* The discard
 * viewer (2026-09-25) was the only pile you could open. Its shell — the card back as a button, the
 * list above it, the ways it closes — is the same for any pile, so it lives here once and the two
 * piles are thin wrappers that only say which cards and in what order (`DiscardPileViewer`,
 * `DrawPileViewer`).
 *
 * It closes on a second click, on Escape, and on a pointer-down anywhere else. That last one is
 * also what keeps ONE list open at a time: pressing the other pile is a pointer-down outside this
 * one, so this list closes in the same gesture that opens the other.
 */
interface Props {
    /** The list's heading, e.g. `DRAW`. The row count is added to it. */
    readonly title: string;
    readonly rows: ReadonlyArray<PileRow>;
    /** What an empty pile says, rather than a control that silently does nothing. */
    readonly emptyText: string;
    /** The list's DOM id, which the toggle's `aria-controls` points at. Unique per pile. */
    readonly listId: string;
    /** The toggle's hover text. */
    readonly toggleTitle: string;
    /** Which edge of the pile the list hangs from — the side facing the middle of the screen. */
    readonly align: 'left' | 'right';
    /** The pile face and its count, rendered by the hand exactly as before — this only wraps it. */
    readonly children: React.ReactNode;
}

const PileViewer: React.FC<Props> = ({ title, rows, emptyText, listId, toggleTitle, align, children }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const total = rows.reduce((n, row) => n + (row.count ?? 1), 0);

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
                aria-controls={listId}
                title={toggleTitle}
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
                <div
                    className={`rs-panel dpv-list dpv-list-${align}`}
                    id={listId}
                    role="dialog"
                    aria-label={`${title.charAt(0)}${title.slice(1).toLowerCase()} pile`}
                >
                    <h2>{title} · {total}</h2>
                    {rows.length === 0 ? (
                        <p className="dpv-empty">{emptyText}</p>
                    ) : (
                        <ol className="dpv-rows">
                            {rows.map((row) => (
                                <li
                                    key={row.key}
                                    className={`rs-row dpv-row ${row.highlight ? 'dpv-latest' : ''}`}
                                    style={{ ['--el' as string]: colorFor(row.element) }}
                                >
                                    <span className="rs-g">{row.cost}</span>
                                    <ElementMark element={row.element} compact />
                                    <span className="dpv-text">
                                        <b className="dpv-name">
                                            {row.name}
                                            {(row.count ?? 1) > 1 && <span className="dpv-count"> ×{row.count}</span>}
                                        </b>
                                        {row.tag && <span className="dpv-tag">{row.tag}</span>}
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

export default PileViewer;
