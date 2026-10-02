import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { visibleEntries, type LogEntry } from './combatLogModel';
import { isPinnedToBottom } from './combatLogModel';

/**
 * THE COMBAT LOG — collapsed by default, latest line always visible (ticket 143c).
 *
 * Henry, playtest 2026-09-05: *"Log should start untoggled but show latest message still. Toggling
 * it shows a handful and lets you scroll."* The old version opened expanded and rendered EVERY
 * entry of the fight, so by turn four it was a wall over the top of the board — and collapsing it
 * hid the fight entirely, which is why it was left open.
 *
 * The collapsed strip is a real reading surface, not an affordance: one line, the newest entry,
 * ellipsised rather than wrapped so it cannot grow. It does not move anything when it toggles
 * because `.combat-log-container` is `position: absolute` against the stage — the ticket asks for
 * the strip's height to be reserved in the arena layout, and it already is, by not being in the
 * flow at all.
 *
 * NOTE ON `osLogs`, worth knowing before anyone extends this: the second stream is DEAD. Every
 * initialiser in the codebase sets `osLogs: []` and nothing ever appends to it — firmware lines
 * ("Abyssal Ink blinds an enemy!") go through `addLog` into `logs` like everything else. The merge
 * below is kept because it costs nothing and is correct if the stream is ever filled, but the [OS]
 * chip has never once rendered in a real fight.
 */
/**
 * TICKET 145c: the collapsed state moved OUT of this component.
 *
 * 143c gave the log a collapsed/expanded model and owned the toggle itself. The top bar now shows
 * the latest line with the chevron that opens the panel, so the two would be two sources of truth
 * for one piece of state — and the bar's chevron would be unable to open a log that had closed
 * itself. Controlled from `BattleArena`, which owns every other piece of battle-screen state for
 * the same reason.
 */
const CombatLog: React.FC<{ isOpen?: boolean; onOpenChange?: (open: boolean) => void }> = ({
    isOpen,
    onOpenChange,
}) => {
    const logs = useSelector((state: RootState) => state.battle.battle?.logs || []);
    const osLogs = useSelector((state: RootState) => state.battle.battle?.osLogs || []);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef(true);
    // Per session, deliberately not persisted (ticket 143c). Collapsed is the opening state.
    const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(true);
    // Controlled when the parent passes `isOpen` (the battle screen); self-owned otherwise, so a
    // debug scenario that renders the log alone still gets a working toggle.
    const isCollapsed = isOpen === undefined ? uncontrolledCollapsed : !isOpen;
    const setIsCollapsed = (collapsed: boolean) => {
        if (onOpenChange) onOpenChange(!collapsed);
        else setUncontrolledCollapsed(collapsed);
    };

    // Both streams are append-only, so an entry's index WITHIN its own stream is
    // a stable identity ('log-17' / 'os-3'). Indexes into the combined array are
    // not: every new combat log used to shift all OS keys, re-triggering their
    // enter animation. The engine records no interleaving info between the two
    // streams (true chronological merging needs an engine-side sequence number —
    // out of scope), so OS proc entries are tagged with an [OS] chip and kept
    // appended after the combat stream.
    const entries: LogEntry[] = [
        ...logs.map((text, i) => ({ key: `log-${i}`, text, isOS: false })),
        ...osLogs.map((text, i) => ({ key: `os-${i}`, text, isOS: true })),
    ];
    const shown = visibleEntries(entries, isCollapsed);
    // (`newest` lived here for the collapsed strip; the top bar owns that line now.)

    const onScroll = useCallback(() => {
        pinnedRef.current = isPinnedToBottom(scrollRef.current);
    }, []);

    useEffect(() => {
        if (isCollapsed) return;
        const el = scrollRef.current;
        // Only follow if the reader has not scrolled back. `scrollTop` is set directly rather than
        // through `scrollIntoView`, which walks up to every scrollable ancestor and can move the
        // page behind the arena.
        if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
    }, [logs.length, osLogs.length, isCollapsed]);

    // Re-opening the panel always lands on the newest entry, whatever the reader was looking at
    // before they closed it.
    useEffect(() => {
        if (!isCollapsed) pinnedRef.current = true;
    }, [isCollapsed]);

    /*
     * COLLAPSED DRAWS NOTHING — Henry, 2026-09-10: *"The combat log is duplicated."*
     *
     * It was. 145c moved the collapsed surface to the top bar (see the docblock above) but left
     * this component still rendering its own: the `COMBAT LOG` header and a `.log-strip` holding
     * the newest line. `.combat-log-container` is `position: absolute; top: 0` centred, which is
     * exactly where the bar's own latest-line button sits, so the two drew over each other and
     * the newest line appeared twice - once in the bar, once again underneath it.
     *
     * The bar IS the collapsed state now, so there is nothing left for this to draw until it is
     * open. Half a move finished: 145c wrote the rule in a comment and moved only the state.
     */
    if (isCollapsed) return null;

    return (
        <div className="combat-log-container">
            <div
                className="log-header"
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <span>COMBAT LOG</span>
                <span style={{ float: 'right' }}>▲</span>
            </div>


            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        className="log-messages"
                        ref={scrollRef}
                        onScroll={onScroll}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <AnimatePresence initial={false}>
                            {shown.map(entry => (
                                <motion.div
                                    key={entry.key}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`log-entry ${entry.isOS ? 'os-proc' : ''}`}
                                >
                                    <span className="log-timestamp">{'>>'}</span>{' '}
                                    {entry.isOS && <span className="log-os-chip">OS</span>}
                                    {entry.text}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CombatLog;
