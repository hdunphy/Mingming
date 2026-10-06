import { MONSTER_ART_ENABLED } from './monsterArtPolicy';

/**
 * The art files that may be drawn even while `MONSTER_ART_ENABLED` is off. Only art Henry made or
 * commissioned goes here: the rest of the monster art is AI-generated and must not show.
 *
 * Fenrir.png is the commissioned Fenrir (Henry, 2026-10-06). Add a file name here when the next
 * commissioned sprite lands.
 */
export const COMMISSIONED_ART: ReadonlySet<string> = new Set(['Fenrir.png']);

/** May this art file be drawn? Used by every place that would draw a Mingming's sprite. */
export function monsterArtShown(artReference: string | undefined): boolean {
    if (!artReference) return false;
    return MONSTER_ART_ENABLED || COMMISSIONED_ART.has(artReference);
}
