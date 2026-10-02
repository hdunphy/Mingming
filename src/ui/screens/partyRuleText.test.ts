/**
 * TICKET 171d — the party text says what the party rules are.
 *
 * Henry, 2026-09-29 playtest: *"The intro text doesn't make sense anymore."* RunStart told a new
 * player every member brings 8 cards and that the party is one per species; neither is true.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { partyBlockFor } from '../../engine/party';
import { START_KIT_SIZE, STARTER_GENERICS, minimumActiveDeck } from '../../engine/run/createRun';
import { RANCH_PARTY_CLAUSE, RUN_START_PARTY_TEXT, WORKSHOP_DUPLICATE_CLAUSE } from './partyRuleText';

describe('the party text matches the party rules (ticket 171d)', () => {
    it('says only the first member brings the generics', () => {
        expect(RUN_START_PARTY_TEXT).toContain(`${START_KIT_SIZE}-card kit`);
        expect(RUN_START_PARTY_TEXT).toContain(`the first also brings ${STARTER_GENERICS}`);
        // The arithmetic the old line got wrong: three members is 18, not 3 x 8.
        expect(minimumActiveDeck(3)).toBe(STARTER_GENERICS + 3 * START_KIT_SIZE);
    });

    it('says the duplicate rule is species AND firmware, which is what partyBlockFor enforces', () => {
        const a = { id: 'a', definitionId: 'kraken', activeOS: 'kraken_v1' };
        expect(partyBlockFor({ id: 'b', definitionId: 'kraken', activeOS: 'kraken_v2' }, [a])).toBeNull();
        expect(partyBlockFor({ id: 'c', definitionId: 'kraken', activeOS: 'kraken_v1' }, [a])).toBe('duplicate-build');
        for (const text of [RUN_START_PARTY_TEXT, RANCH_PARTY_CLAUSE, WORKSHOP_DUPLICATE_CLAUSE]) {
            expect(text).toMatch(/firmware/);
        }
    });

    it('no screen still prints the old wording', () => {
        for (const file of ['RunStart.tsx', 'RanchScreen.tsx', 'WorkshopNode.tsx']) {
            const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
            expect(source, file).not.toMatch(/one per species|Species clause|5 from its kit and 3/);
        }
    });
});
