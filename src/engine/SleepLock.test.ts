import { describe, it, expect } from 'vitest';

import { getStatusBehavior } from './StatusBehaviors';
import type { IBattleEntity, StatusEffectInstance } from './types';

/**
 * Ticket 91 - the sleep lock.
 *
 * Henry, playtesting the published branch: huldra's Debuff intent applies `Asleep`, and because
 * re-applying used to RESET the timer to 3, an enemy casting it every other turn kept the player
 * asleep permanently. The anti-lock machinery already existed - waking grants a turn of `StableOS`
 * and `StableOS` blocks Asleep at the apply layer - but the timer never expired, so it never fired.
 *
 * These tests pin the guarantee rather than the implementation: **sleep always ends.**
 */

const entity = (statusEffects: StatusEffectInstance[] = []): IBattleEntity => ({
    id: 'p1', name: 'Sleeper', 
    maxHp: 100, currentHp: 100, tempHp: 0, attack: 10, defense: 10,
    maxEnergy: 3, currentEnergy: 3, cardDraw: 3, speed: 10,
    primaryElement: 'None', secondaryElement: 'None',
    statusEffects, hooks: [], daemons: [], definitionId: 'huldra',
    blueprintsCollected: 0, attackIV: 0, defenseIV: 0, hpIV: 0,
} as unknown as IBattleEntity);

const asleep = getStatusBehavior('Asleep');

describe('sleep cannot be re-upped while it is running (ticket 91)', () => {
    it('a second application does not reset the timer', () => {
        const first = asleep.onApply([], 1, entity());
        const running = first.updatedEffects.map(s => (s.type === 'Asleep' ? { ...s, stacks: 1 } : s));

        const second = asleep.onApply(running, 1, entity(running));

        expect(second.updatedEffects.find(s => s.type === 'Asleep')?.stacks).toBe(1);
        expect(second.updatedEffects.filter(s => s.type === 'Asleep')).toHaveLength(1);
    });

    it('sleep always ends, even when re-applied every single turn', () => {
        let effects = asleep.onApply([], 1, entity()).updatedEffects;
        const initial = effects.find(s => s.type === 'Asleep')!.stacks;

        // The enemy spams Asleep once per turn; the timer still runs down to a wake-up.
        let turns = 0;
        while (effects.some(s => s.type === 'Asleep')) {
            effects = asleep.onApply(effects, 1, entity(effects)).updatedEffects;
            const instance = effects.find(s => s.type === 'Asleep')!;
            const ticked = asleep.endTurn(instance, entity(effects));
            effects = ticked.updatedInstance
                ? effects.map(s => (s.type === 'Asleep' ? ticked.updatedInstance! : s))
                : effects.filter(s => s.type !== 'Asleep');
            turns++;
            expect(turns).toBeLessThanOrEqual(initial); // never longer than one full sleep
        }
        expect(turns).toBe(initial);
    });

    it('StableOS still refuses the application outright', () => {
        const immune = entity([{ id: 's1', type: 'StableOS', stacks: 1 } as StatusEffectInstance]);
        const result = asleep.onApply([...immune.statusEffects], 1, immune);
        expect(result.updatedEffects.some(s => s.type === 'Asleep')).toBe(false);
    });
});
