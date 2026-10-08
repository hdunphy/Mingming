/**
 * TICKET 202a — the Den's tag line: "N Traces held · summon here".
 *
 * One function, read by the town square's Den tile and by the playtest tool's town screen, so the two cannot
 * drift apart. `held` is `tracesHeld(ranch, run)`, passed in by the caller. Null when nothing is held, and the
 * caller then prints what it printed before.
 */
export function denTagLine(held: number): string | null {
    if (held <= 0) return null;
    return `${held} ${held === 1 ? 'Trace' : 'Traces'} held · summon here`;
}
