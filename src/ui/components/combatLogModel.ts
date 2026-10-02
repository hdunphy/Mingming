/**
 * THE COMBAT LOG'S TWO DECISIONS, as pure functions — ticket 143c.
 *
 * They live outside `CombatLog.tsx` for the reason `regionLayout.ts` already states about the map's
 * constants: *"a `.tsx` that exports constants alongside a component breaks fast refresh"*, and the
 * repo lints for it. That constraint is convenient here rather than merely obeyed — the render test
 * harness is `renderToStaticMarkup`, which runs no effects and has no layout, so a scroll rule
 * embedded in the component would be untestable. Pulled out, both rules are asserted directly.
 */

/**
 * ── THE EXPANDED PANEL KEEPS THE WHOLE FIGHT — Henry, 2026-09-22 ────────────────────
 *
 * *"the enemy played like 10 cards that I don't see in the log. Does it trim it?"*
 *
 * It did, to eight entries. Ten enemy card plays is upwards of twenty lines — a play line and a
 * damage line each, plus firmware and daemon procs — so the turn he was trying to read had been
 * thrown away before the panel opened.
 *
 * 143c asked for *"a handful and lets you scroll"* and the slice defeated the second half: with
 * eight entries in a scroll box there is nothing to scroll to. The cap was solving a problem the
 * CSS already solves — `.log-messages` is `max-height: clamp(90px, 16vh, 150px); overflow-y:
 * auto`, so the panel's SIZE never depended on the entry count. All the slice controlled was how
 * far back a reader could go, and the answer was: not as far as one enemy turn.
 *
 * So there is no cap. The bound is the fight: `state.logs` is what happened, the engine caps it
 * nowhere, and "how far back can I scroll" now has the only non-arbitrary answer — to the start.
 * The newest entry is still the one on screen (`isPinnedToBottom` below), so nothing changes for
 * a reader who is just watching.
 *
 * Mounting cost is real but small: the longest fight 156 measured is 376 lines, and
 * `AnimatePresence initial={false}` mounts an already-full list without animating any of it —
 * only entries that arrive while the panel is open animate in.
 *
 * The constant is GONE rather than raised to a big number. A cap of 500 would be the same
 * decision with a bigger arbitrary number in it, and Henry's standing rule is to find the
 * CONDITION instead of picking a ceiling. The condition is "the fight".
 */

/**
 * A pixel of slack on the at-the-bottom test. Smooth scrolling and sub-pixel layout mean
 * `scrollTop + clientHeight` lands a fraction short of `scrollHeight` even when the view is
 * visually pinned, and an exact comparison would read that as "the user scrolled up" and stop
 * following the fight.
 */
const BOTTOM_SLACK_PX = 24;

export interface LogEntry {
    readonly key: string;
    readonly text: string;
    readonly isOS: boolean;
}

/**
 * WHAT THE PANEL SHOWS. Collapsed, the strip carries the newest entry and nothing else; expanded,
 * the whole fight, oldest first so the newest sits at the bottom the way a chat log does.
 */
export function visibleEntries(entries: ReadonlyArray<LogEntry>, isCollapsed: boolean): LogEntry[] {
    if (entries.length === 0) return [];
    if (isCollapsed) return [entries[entries.length - 1]];
    return [...entries];
}

/**
 * THE CHAT-LOG RULE: follow the newest entry, unless the reader has deliberately scrolled back to
 * look at something. Yanking them to the bottom mid-read is the failure this guards.
 */
export function isPinnedToBottom(
    el: { scrollTop: number; clientHeight: number; scrollHeight: number } | null,
): boolean {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK_PX;
}
