import { describe, expect, it } from 'vitest';

import { COMMISSIONED_ART, monsterArtShown } from './monsterArtShown';

/**
 * Henry (2026-10-06): "I uploaded Fenrir to be in the game, but I don't see him." The art switch is off
 * for every species (the rest of the art is AI-generated and must not show), so the one piece Henry
 * commissioned has its own way past it: a list of art files that may be drawn.
 */
describe('monsterArtShown', () => {
    it('shows Fenrir, whose art Henry commissioned, with the global switch off', () => {
        expect(monsterArtShown('Fenrir.png')).toBe(true);
    });

    it('does not show any other species while the switch is off', () => {
        expect(monsterArtShown('Kraken.png')).toBe(false);
        expect(monsterArtShown('Ratatoskr.png')).toBe(false);
        expect(monsterArtShown('Skoll.svg')).toBe(false);
    });

    it('shows nothing for a unit with no art reference', () => {
        expect(monsterArtShown(undefined)).toBe(false);
        expect(monsterArtShown('')).toBe(false);
    });

    it('lists only the commissioned art', () => {
        expect([...COMMISSIONED_ART]).toEqual(['Fenrir.png']);
    });
});
