import { describe, it, expect } from 'vitest';
import { MingmingRegistry } from './mingmingRegistry';
import { GetProgramData } from './programRegistry';

describe('Species base decks', () => {
    const species = Object.values(MingmingRegistry);

    it('registry contains all 16 species', () => {
        expect(species).toHaveLength(16);
    });

    it('every species has a baseDeck of exactly 10 entries', () => {
        for (const def of species) {
            expect(def.baseDeck, `${def.id} baseDeck`).toBeDefined();
            expect(def.baseDeck, `${def.id} baseDeck length`).toHaveLength(10);
        }
    });

    it('every baseDeck id resolves to a real program (no Missing Program stubs)', () => {
        for (const def of species) {
            for (const cardId of def.baseDeck) {
                const data = GetProgramData(cardId);
                // The registry's missing-data stub is identifiable by id 'missing' / name 'Missing Program'
                expect(data.id, `${def.id} -> ${cardId}`).not.toBe('missing');
                expect(data.name, `${def.id} -> ${cardId}`).not.toBe('Missing Program');
            }
        }
    });

    it("every baseDeck card's element matches the species' primaryElement (or is None)", () => {
        for (const def of species) {
            for (const cardId of def.baseDeck) {
                const data = GetProgramData(cardId);
                const ok = data.element === def.primaryElement || data.element === 'None';
                expect(ok, `${def.id} -> ${cardId} element ${data.element} vs ${def.primaryElement}`).toBe(true);
            }
        }
    });

    it('no baseDeck card is a token', () => {
        for (const def of species) {
            for (const cardId of def.baseDeck) {
                const data = GetProgramData(cardId);
                expect(data.isToken ?? false, `${def.id} -> ${cardId} isToken`).toBe(false);
                expect(data.rarity, `${def.id} -> ${cardId} rarity`).not.toBe('Token');
            }
        }
    });
});
