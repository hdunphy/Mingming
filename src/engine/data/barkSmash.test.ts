import { describe, it, expect } from 'vitest';
import { GetProgramData } from './programRegistry';

/**
 * Ticket 195a: Bark Smash is slightly nerfed (Henry, 2026-10-05: "Nerf is good").
 * 6 -> 5 power a point for the base card, 10 -> 8 for the upgrade. The upgrade stays about 1.6x
 * the base. The power and the printed description move together, so a card can never print one
 * number and deal another.
 */
describe('Bark Smash (ticket 195a)', () => {
    const consumeAttack = (id: string) => {
        const card = GetProgramData(id);
        const attack = card?.actions.find(a => a.type === 'ATTACK' && a.scaling === 'STATUS_CONSUMED');
        return { card, attack };
    };

    it('bark_smash deals 5 a point', () => {
        const { attack } = consumeAttack('bark_smash');
        expect(attack?.power).toBe(5);
    });

    it('bark_smash+ deals 8 a point', () => {
        const { attack } = consumeAttack('bark_smash+');
        expect(attack?.power).toBe(8);
    });

    it.each(['bark_smash', 'bark_smash+'])('%s description matches its power', id => {
        const { card, attack } = consumeAttack(id);
        expect(card?.description).toContain(`${attack?.power} power per point consumed`);
    });
});
