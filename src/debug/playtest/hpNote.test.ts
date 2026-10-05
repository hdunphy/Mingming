/**
 * TICKET 193d — the status line says why HP reads full.
 *
 * 2026-10-02 r08: a layer-4 elite ended `HP left: Kraken 39/1095` and the next screen's status line read
 * `HP full`. It is by design (the party is fully healed between ordinary fights; HP carries only inside
 * the gym gauntlet), but nothing said so, and agents spent real effort on healing they did not need
 * (Mend taken in at least five runs). Said once, in the status line, where the agent looks.
 */
import { describe, it, expect } from 'vitest';
import { hpNote } from './hpNote';
import { statusLine } from './render';
import { claimRewards } from './rewards';
import { freshWorld } from './testKit';
import { worldAt } from './walkKit';
import { runOf } from './types';
import type { RewardFlow, World } from './types';

const NOTE = 'the team is fully healed between fights; HP only carries inside the gym gauntlet';

const claimOf = (world: World, hp: number): RewardFlow => ({
    nodeId: runOf(world).currentNodeId, scraps: 0, blueprints: [], driver: null, cardChoices: [], patchOffers: [], macroOffers: [], answers: [],
    carried: runOf(world).partyIds.map((memberId) => ({ memberId, hp, maxHp: 100 })),
});

describe('193d — the full-heal note', () => {
    it('is in the status line of a run outside the gauntlet, once', () => {
        const line = statusLine(freshWorld());
        expect(line).toContain(`HP full (${NOTE})`);
        expect(line.split(NOTE)).toHaveLength(2);
    });

    it('is said once however many members the party has', () => {
        const world = freshWorld();
        expect(statusLine(world).split('HP full').length - 1).toBeGreaterThanOrEqual(1);
        expect(statusLine(world).split(NOTE).length - 1).toBe(1);
    });

    it('is not on the gate of the gauntlet, where HP is about to carry', () => {
        expect(statusLine(worldAt('gym'))).not.toContain(NOTE);
    });

    it('inside a gauntlet, after a fight, shows the carried numbers and no note', () => {
        const world = worldAt('gym');
        world.view.reward = claimOf(world, 40);
        claimRewards(world);
        const line = statusLine(world);
        expect(line).toMatch(/HP \d+/);   // 40 carried plus the 30% repair between gauntlet fights (ticket 173)
        expect(line).not.toContain('HP full');
        expect(line).not.toContain(NOTE);
    });

    it('hpNote is one function over the run, empty inside a gauntlet', () => {
        expect(hpNote(runOf(freshWorld()))).toContain(NOTE);
        expect(hpNote(runOf(worldAt('gym')))).toBe('');
    });
});
