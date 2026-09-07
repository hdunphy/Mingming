/**
 * THE COMBAT LOG'S TWO DECISIONS, as pure functions — ticket 143c.
 *
 * They live outside `CombatLog.tsx` for the reason `regionLayout.ts` already states about the map's
 * constants: *"a `.tsx` that exports constants alongside a component breaks fast refresh"*, and the
 * repo lints for it. That constraint is convenient here rather than merely obeyed — the render test
 * harness is `renderToStaticMarkup`, which runs no effects and has no layout, so a scroll rule
 * embedded in the component would be untestable. Pulled out, both rules are asserted directly.
 */

/** How many entries the expanded panel keeps. Ticket 143c: "a handful", specified as 8. */
export const EXPANDED_ENTRY_COUNT = 8;

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
 * the last `EXPANDED_ENTRY_COUNT`, oldest first so the newest sits at the bottom the way a chat log
 * does.
 */
export function visibleEntries(entries: ReadonlyArray<LogEntry>, isCollapsed: boolean): LogEntry[] {
    if (entries.length === 0) return [];
    if (isCollapsed) return [entries[entries.length - 1]];
    return entries.slice(-EXPANDED_ENTRY_COUNT);
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
