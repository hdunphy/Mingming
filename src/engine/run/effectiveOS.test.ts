/**
 * TICKET 168f — Well of Urd switches a body's OS for the RUN, never for the ranch.
 *
 * What would fail silently: the override being written but the next battle still built from the
 * ranch OS (the player pays for a reflash that does nothing), the ranch member being changed (the
 * switch outliving the run), and a party screen showing one firmware while the fight runs another.
 */

import { describe, expect, it } from 'vitest';

import { createBattleState } from '../data/battleFactories';
import { rewardCardPool } from '../RewardSystem';
import { getOSBehavior } from '../data/firmwareRegistry';
import { entityHooksFor } from '../core/entityHooks';
import { buildBattleSetup, toMingmingState } from './battleSetup';
import { createRun } from './createRun';
import { effectiveOS, withEffectiveOS } from './effectiveOS';
import { offerGyms } from './gyms';
import { RunStateSchema } from '../runTypes';
import type { IBattleEntity, IMingmingState } from '../types';
import type { IRanchMember, IRanchState, IRunState } from '../runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const RANCH_MEMBER: IRanchMember = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 };
const ranch = (): IRanchState => ({ roster: [RANCH_MEMBER] } as unknown as IRanchState);
const baseRun = (): IRunState => createRun({ seed: 'reflash-run', offer: offerGyms('reflash-offer')[0], party: [KRAKEN], startedAt: 1 });
const reflashed = (): IRunState => ({ ...baseRun(), osOverrides: { mm1: 'kraken_v2' } });

/** The phase a firmware's first hook fires in, and whether the entity runs that hook. */
function runsFirmware(entity: IBattleEntity, osId: string): boolean {
    const hook = getOSBehavior(osId)!.hooks[0];
    const phase = Object.keys(hook).find((key) => key.startsWith('on'))!;
    return entityHooksFor(entity, phase).some((candidate) => candidate.id === hook.id);
}

describe('effectiveOS', () => {
    it('is the override when the run has one for that body, and the member’s own OS otherwise', () => {
        expect(effectiveOS(baseRun(), RANCH_MEMBER)).toBe('kraken_v1');
        expect(effectiveOS(reflashed(), RANCH_MEMBER)).toBe('kraken_v2');
        expect(effectiveOS(reflashed(), { id: 'someone-else', activeOS: 'fenrir_v1' })).toBe('fenrir_v1');
    });

    it('withEffectiveOS returns the same object when nothing is overridden, and a copy when it is', () => {
        expect(withEffectiveOS(baseRun(), RANCH_MEMBER)).toBe(RANCH_MEMBER);
        const copy = withEffectiveOS(reflashed(), RANCH_MEMBER);
        expect(copy.activeOS).toBe('kraken_v2');
        expect(RANCH_MEMBER.activeOS).toBe('kraken_v1');
    });

    it('a run saved before the field parses to no overrides', () => {
        const { osOverrides: _dropped, ...older } = baseRun();
        expect(RunStateSchema.parse(older).osOverrides).toEqual({});
    });
});

describe('after a reflash, the next battle', () => {
    it('builds the party member on the new OS, and the entity runs the new OS hooks instead of the old', () => {
        const setup = buildBattleSetup(ranch(), reflashed());
        expect(setup.party[0].activeOS).toBe('kraken_v2');

        const state = createBattleState(setup, ['fenrir'], undefined, { seed: 'reflash-fight', enemyMode: 'CARDS' });
        const entity = state.playerParty[0];
        expect(entity.activeOS).toBe('kraken_v2');
        expect(runsFirmware(entity, 'kraken_v2')).toBe(true);
        expect(runsFirmware(entity, 'kraken_v1')).toBe(false);
    });

    it('the reward roll’s party (the battle’s own player party) carries the new OS into `rewardCardPool`', () => {
        const fight = (run: IRunState) => createBattleState(
            buildBattleSetup(ranch(), run), ['fenrir'], undefined, { seed: 'reward-party', enemyMode: 'CARDS' },
        ).playerParty;
        const party = fight(reflashed());
        expect(party.map((unit) => unit.activeOS)).toEqual(['kraken_v2']);
        expect(rewardCardPool(party)).toEqual(rewardCardPool([{ definitionId: 'kraken', activeOS: 'kraken_v2' }]));
    });

    it('control: a run with no override still builds the ranch OS', () => {
        const setup = buildBattleSetup(ranch(), baseRun());
        const entity = createBattleState(setup, ['fenrir'], undefined, { seed: 'reflash-fight', enemyMode: 'CARDS' }).playerParty[0];
        expect(runsFirmware(entity, 'kraken_v1')).toBe(true);
        expect(runsFirmware(entity, 'kraken_v2')).toBe(false);
    });

    it('leaves the ranch member’s activeOS exactly as it was', () => {
        const before = JSON.stringify(ranch());
        const theRanch = ranch();
        buildBattleSetup(theRanch, reflashed());
        expect(JSON.stringify(theRanch)).toBe(before);
        expect(theRanch.roster[0].activeOS).toBe('kraken_v1');
    });

    it('toMingmingState of a member with the run’s OS applied is the reflashed body; of the bare member, the ranch’s', () => {
        expect(toMingmingState(RANCH_MEMBER).activeOS).toBe('kraken_v1');
        expect(toMingmingState(withEffectiveOS(reflashed(), RANCH_MEMBER)).activeOS).toBe('kraken_v2');
    });
});
