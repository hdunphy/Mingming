/**
 * TICKET 190c — which cards dash all the way in. Henry (2026-10-02, *"Yes good call"*): every
 * single-target Attack card with element None. The list is pinned here so that a new card joining
 * it is a decision somebody sees, and so the commit can show Henry the names.
 *
 * 185 follow-up: `adrenaline` and `hamstring` joined (13) when Henry's ruling made them Attack cards;
 * both are single-target, element None, so by 190c's own rule they run in and hit.
 */
import { describe, expect, it } from 'vitest';

import { ProgramRegistry } from '../../../engine/data/programRegistry';
import { CONTACT_EXEMPT, isContactCard } from './contactCards';

const ids = (): string[] =>
    Object.values(ProgramRegistry).filter((card) => isContactCard(card)).map((card) => card.id).sort();

describe('190c — contact cards', () => {
    it('are exactly these thirteen (tell Henry about any change)', () => {
        expect(ids()).toEqual([
            'adrenaline', 'baseline_jab', 'baseline_purge', 'baseline_scuff', 'baseline_slam', 'baseline_snare',
            'baseline_strike', 'feedback_token', 'genesis_surge', 'hamstring', 'tackle', 'tackle+', 'zealots_edge',
        ]);
    });

    it('needs an Attack, a single target and no element', () => {
        const card = { id: 'x', category: 'Attack', target: 'Single', element: 'None' } as const;
        expect(isContactCard(card)).toBe(true);
        expect(isContactCard({ ...card, category: 'Skill' })).toBe(false);
        expect(isContactCard({ ...card, target: 'Side' })).toBe(false);
        expect(isContactCard({ ...card, target: 'Self' })).toBe(false);
        expect(isContactCard({ ...card, element: 'Fire' })).toBe(false);
    });

    it('lets Henry exempt a card by id', () => {
        expect(CONTACT_EXEMPT.size).toBe(0);
        expect(isContactCard({ id: 'tackle', category: 'Attack', target: 'Single', element: 'None' }, new Set(['tackle']))).toBe(false);
    });
});
