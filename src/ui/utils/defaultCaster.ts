/**
 * WHO CASTS WHEN THE PLAYER HAS NOT PICKED — ticket 194g.
 *
 * Henry, 2026-10-04: *"First mingming UI shows as selected at battle start, but it isn't really
 * selected."* The stage lit the first living body as the active one whenever the store had no
 * caster, so the screen showed a selection that the hand did not use. The fix is one source of
 * truth: the store always holds a living caster, and the stage's look follows it.
 *
 * This answers the only question the arena needs: given the party and the current pick, which body
 * (if any) should the store pick now? It is the same body the stage used to light by default, the
 * first one standing, so nothing moves on screen; it simply becomes true.
 */

interface Caster {
    readonly id: string;
    readonly currentHp: number;
}

/** The id to select, or null when the current pick is a living body already (or nobody is left). */
export function defaultCasterId(party: ReadonlyArray<Caster>, selectedId: string | null): string | null {
    if (selectedId && party.some((member) => member.id === selectedId && member.currentHp > 0)) return null;
    return party.find((member) => member.currentHp > 0)?.id ?? null;
}
