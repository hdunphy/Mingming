import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { GetProgramData } from './programRegistry';
import { MingmingRegistry, LAUNCH_SPECIES, getDeckForOS } from './mingmingRegistry';
import { RUN_ONLY_CARDS } from './speciesPools';

/**
 * TICKET 167 follow-up (Henry, 2026-09-29: "Please update the stale text").
 *
 * `collection-v2/collection.json` is the DESIGN record, and it lags: the card rows of 167b and 167d
 * changed the game and left the record saying the old thing (Acorn Toss "6 power, twice", Slander
 * as Kraken's Water card). This pins the parts of it that state a FACT the game also holds, so the
 * next card change that forgets the record fails here instead of sitting wrong for a week.
 *
 * Deliberately narrow: card text is checked for the cards 167 touched, not for all of them, because
 * the record's wording is Henry's design prose and only these three claims are checkable facts.
 */
type DesignCard = { id: string; el?: string; text?: string; why?: string };
type DesignOS = { id: string; kit: Array<[string, number, string, number]>; builds: Array<[string, string]> };

const design = JSON.parse(
    fs.readFileSync(path.join('docs', 'wayfinder', 'deck-archetypes', 'collection-v2', 'collection.json'), 'utf8'),
) as { cards: DesignCard[]; os: DesignOS[]; run_only: string[] };
const card = (id: string): DesignCard => design.cards.find((c) => c.id === id)!;

describe('the design record agrees with the game on what 167 changed', () => {
    it('Acorn Toss says what the card says', () => {
        expect(card('acorn_toss').text).toBe(GetProgramData('acorn_toss').description);
        expect(card('acorn_toss').why ?? '').not.toMatch(/\btwo\b/i);
    });

    it('Slander has the game\'s element, and its note no longer says it was Nature "before"', () => {
        expect(card('slander').el).toBe(GetProgramData('slander').element);
        expect(card('slander').why ?? '').not.toMatch(/^Was Nature/);
    });

    it('every kit in the record is the game\'s deck for that OS (Kraken v1 runs two Crushing Depths, no Slander)', () => {
        for (const species of LAUNCH_SPECIES) {
            for (const osId of MingmingRegistry[species].availableOS ?? []) {
                const entry = design.os.find((o) => o.id === osId);
                expect(entry, `${osId} is missing from the record`).toBeDefined();
                const recorded = entry!.kit.flatMap(([id, count]) => Array<string>(count).fill(id)).sort();
                expect(recorded, osId).toEqual([...getDeckForOS(species, osId)].sort());
            }
        }
    });

    it('no build of Kraken v1 spends a card the deck cannot hold, except the Rat v2 pairing', () => {
        const kraken = design.os.find((o) => o.id === 'kraken_v1')!;
        const solo = kraken.builds.filter(([name]) => !name.startsWith('With '));
        for (const [name, list] of solo) expect(list.split(' '), name).not.toContain('slander');
    });

    it('the record\'s run-only list is the game\'s', () => {
        expect([...design.run_only].sort()).toEqual([...RUN_ONLY_CARDS].sort());
    });
});
