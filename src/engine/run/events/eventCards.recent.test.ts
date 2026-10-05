/**
 * TICKET 185e — an event's card pick draws with the SAME weights and the SAME memory as a fight's
 * reward: it leaves out the last two picks' shown cards and leans toward the party's currencies.
 */
import { describe, expect, it } from 'vitest';

import { SeedStream } from '../../core/SeedStream';
import { ProgramRegistry } from '../../data/programRegistry';
import { offerTasteForRun, rewardCardPool } from '../../RewardSystem';
import { rollCardChoices } from './eventCards';

const FENRIR = [{ definitionId: 'fenrir', activeOS: 'fenrir_v1' }];
const POOL = rewardCardPool(FENRIR);
const RARITIES = ['Common', 'Uncommon', 'Rare'] as const;

describe('ticket 185e — event card picks', () => {
    it('leave out the cards the last two picks showed', () => {
        const allowed = POOL.filter((id) => (RARITIES as ReadonlyArray<string>).includes(ProgramRegistry[id].rarity));
        const recent = [allowed.slice(0, 5), allowed.slice(5, 10)];
        const taste = offerTasteForRun(FENRIR, [], recent);
        for (let i = 0; i < 100; i += 1) {
            const offered = rollCardChoices(POOL, [...RARITIES], 3, new SeedStream(`recent-${i}`), taste);
            expect(offered).toHaveLength(3);
            for (const id of offered) expect(recent.flat(), `${id} was shown on a recent pick`).not.toContain(id);
        }
    });

    it('let the shown cards back in, oldest first, when the allowed pool is too small', () => {
        const rares = POOL.filter((id) => ProgramRegistry[id].rarity === 'Rare');
        expect(rares.length).toBeGreaterThanOrEqual(4);
        // Leave exactly one Rare un-shown: the other cards must come back, the OLDEST pick's first.
        const shown = rares.slice(1);
        const recent = [shown.slice(0, Math.ceil(shown.length / 2)), shown.slice(Math.ceil(shown.length / 2))];
        const taste = offerTasteForRun(FENRIR, [], recent);
        const offered = rollCardChoices(POOL, ['Rare'], 3, new SeedStream('starved'), taste);
        expect(offered).toHaveLength(3);
        expect(offered).toContain(rares[0]);
        // The oldest pick's first card was the next to come back.
        expect(offered).toContain(recent[0][0]);
    });

    it('lean toward the party\'s currency: more Strength payoffs while the run holds none', () => {
        const strengthPayoffs = new Set(POOL.filter((id) => ProgramRegistry[id].cur === 'Strength'
            && ['scalar', 'consume'].includes(ProgramRegistry[id].shape ?? '')));
        const count = (owned: string[], party: Array<{ definitionId: string; activeOS?: string }>): number => {
            const taste = offerTasteForRun(party, owned, []);
            let shown = 0;
            for (let i = 0; i < 1000; i += 1) {
                shown += rollCardChoices(POOL, [...RARITIES], 3, new SeedStream(`lean-${i}`), taste).filter((id) => strengthPayoffs.has(id)).length;
            }
            return shown;
        };
        const missing = count([], FENRIR);
        const holding = count(['sun_devourer'], FENRIR);
        const plain = count([], [{ definitionId: 'fenrir' }]);
        expect(missing).toBeGreaterThan(holding);
        expect(holding).toBeGreaterThan(plain);
    });

    it('with no taste, offers what a plain draw would, deterministically', () => {
        const first = rollCardChoices(POOL, [...RARITIES], 3, new SeedStream('plain'));
        expect(rollCardChoices(POOL, [...RARITIES], 3, new SeedStream('plain'))).toEqual(first);
    });
});
