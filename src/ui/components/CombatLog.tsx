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
const CombatLog: React.FC = () => {
    const logs = useSelector((state: RootState) => state.battle.battle?.logs || []);
    const osLogs = useSelector((state: RootState) => state.battle.battle?.osLogs || []);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef(true);
    // Per session, deliberately not persisted (ticket 143c). Collapsed is the opening state.
    const [isCollapsed, setIsCollapsed] = useState(true);

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
    const newest = entries.length > 0 ? entries[entries.length - 1] : null;

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

    return (
        <div className={`combat-log-container ${isCollapsed ? 'is-collapsed' : ''}`}>
            <div
                className="log-header"
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <span>COMBAT LOG</span>
                <span style={{ float: 'right' }}>{isCollapsed ? '▼' : '▲'}</span>
            </div>

            {isCollapsed && (
                <div
                    className="log-strip"
                    onClick={() => setIsCollapsed(false)}
                    style={{ cursor: 'pointer' }}
                    title={newest?.text ?? ''}
                >
                    {newest
                        ? (
                            <>
                                <span className="log-timestamp">{'>>'}</span>{' '}
                                {newest.isOS && <span className="log-os-chip">OS</span>}
                                {newest.text}
                            </>
                        )
                        : <span className="log-strip-empty">awaiting first action…</span>}
                </div>
            )}

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
