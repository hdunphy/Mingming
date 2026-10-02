/**
 * TICKET 180c — the gym gate and the gauntlet.
 *
 * Whether a particular fight is won depends on the seed and the party, so the bookkeeping that follows
 * a win is tested by handing the claim a won fight's carried HP, and the fight itself is tested for
 * what it must always do: end the run or open a claim that carries every member's HP.
 */
import { describe, it, expect } from 'vitest';

import runReducer, { advanceGauntlet } from '../../ui/store/runSlice';
import { claimRewards } from './rewards';
import { currentScreen } from './screen';
import { giveScrap, worldAt } from './walkKit';
import { applyMove } from './world';
import type { RewardFlow, World } from './types';
import { runOf } from './types';

const keysOf = (world: World): string[] => currentScreen(world).moves.map((m) => m.key);
const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });

const claimOf = (world: World, hp: number): RewardFlow => ({
    nodeId: runOf(world).currentNodeId, scraps: 0, blueprints: [], driver: null, cardChoices: [], patchOffers: [], macroOffers: [], answers: [],
    carried: runOf(world).partyIds.map((memberId) => ({ memberId, hp, maxHp: 100 })),
});

describe('180c — the gate', () => {
    it('stepping onto the gym starts the gauntlet and shows the gate', () => {
        const world = worldAt('gym');
        expect(runOf(world).phase).toBe('gauntlet');
        expect(runOf(world).gauntlet?.fightIndex).toBe(0);
        expect(currentScreen(world).id).toBe('gauntlet');
        expect(keysOf(world)).toContain('gauntlet:begin');
        expect(keysOf(world)).toContain('loadout:open');
    });

    it('offers a free upgrade and a free patch before the first fight, and not between fights', () => {
        const world = worldAt('gym');
        const gate = keysOf(world);
        expect(gate.some((k) => k.startsWith('patch:gate:'))).toBe(true);
        const patchKey = gate.find((k) => k.startsWith('patch:gate:'))!;
        const before = runOf(world).scrap;
        press(world, patchKey);
        expect(runOf(world).scrap).toBe(before);
        expect(keysOf(world).some((k) => k.startsWith('patch:gate:'))).toBe(false);

        world.store.dispatch(advanceGauntlet(runOf(world).partyIds.map((memberId) => ({ memberId, hp: 50, maxHp: 100 }))));
        const between = keysOf(world);
        expect(between.some((k) => k.startsWith('patch:gate:') || k.startsWith('gate:upgrade:') || k === 'loadout:open')).toBe(false);
        expect(between).toContain('gauntlet:begin');
    });

    it('has no begin move when every member is down', () => {
        const world = worldAt('gym');
        const downed = runOf(world).partyIds;
        world.store.dispatch(advanceGauntlet(downed.map((memberId) => ({ memberId, hp: 0, maxHp: 100 }))));
        expect(keysOf(world)).not.toContain('gauntlet:begin');
    });
});

describe('180c — a gauntlet fight', () => {
    it('ends the run, or opens a claim that carries every member\'s HP', () => {
        const world = worldAt('gym');
        press(world, 'gauntlet:begin');
        const run = runOf(world);
        if (run.phase === 'ended') {
            expect(run.outcome).toBe('defeat');
            return;
        }
        expect(world.view.reward?.carried?.length).toBe(run.partyIds.length);
        expect(world.view.fight?.won).toBe(true);
    });

    it('the claim after a won fight advances the gauntlet exactly as the reducer does', () => {
        const world = worldAt('gym');
        const carried = claimOf(world, 40).carried!;
        const expected = runReducer({ run: runOf(world) }, advanceGauntlet(carried)).run!.gauntlet;
        world.view.reward = claimOf(world, 40);
        claimRewards(world);
        expect(runOf(world).gauntlet).toEqual(expected);
        expect(runOf(world).gauntlet?.fightIndex).toBe(1);
        expect(world.view.reward).toBeNull();
        expect(runOf(world).phase).toBe('gauntlet');
    });

    it('winning the last fight finishes the run in victory and records the clear', () => {
        const world = worldAt('gym');
        for (let i = 0; i < 2; i += 1) {
            world.view.reward = claimOf(world, 40);
            claimRewards(world);
        }
        expect(runOf(world).gauntlet?.fightIndex).toBe(2);
        world.view.reward = claimOf(world, 40);
        claimRewards(world);
        const run = runOf(world);
        expect(run.phase).toBe('ended');
        expect(run.outcome).toBe('victory');
        expect(world.store.getState().game.gymsCleared).toContain(run.gymId);
        expect(currentScreen(world).id).toBe('end');
    });

    it('can be begun after a gate bought with spare scrap too', () => {
        const world = worldAt('gym');
        giveScrap(world, 100);
        expect(keysOf(world)).toContain('gauntlet:begin');
    });
});
