/**
 * TICKET 182c — THE INTRO'S LEADER: one fight, two monsters.
 *
 * Not the three-fight gauntlet. Two enemies from the intro biome's own species pool, on their v1
 * firmware, with no driver, at the shallowest kit depth. The pair is picked by hand from existing
 * data and **no card is added or changed**. The only things tuned are the species pair and the
 * IVs, below, measured with the walker (`docs/balance/intro-run-182.md`).
 *
 * Keyed by the intro biome's element, because that is what the player's starter decides
 * (`introBiomeElement`): Fire for Kraken, Nature for Fenrir, Water for Ratatoskr.
 */

import { SeedStream } from '../../core/SeedStream';
import { GetMingmingData, getDeckForOS } from '../../data/mingmingRegistry';
import { initializeBattleEntity } from '../../types';
import type { IBattleEntity, IMingmingState } from '../../types';
import type { IRegionNode, IRunState } from '../../runTypes';
import { ENEMY_LADDER } from '../encounter';
import type { IRunEncounter } from '../encounter';
import { GYM_REGISTRY } from '../gyms';

export interface IIntroLeaderMember {
    readonly species: string;
    /** Always a `_v1` firmware: the intro never shows the second firmware of anything. */
    readonly os: string;
    readonly hpIV: number;
    readonly attackIV: number;
    readonly defenseIV: number;
}

/** The leader pairs, by intro-biome element. Species come from that biome's own pool. */
export const INTRO_LEADERS: Readonly<Record<string, ReadonlyArray<IIntroLeaderMember>>> = {
    Fire: [
        { species: 'skoll', os: 'skoll_v1', hpIV: 10, attackIV: 10, defenseIV: 10 },
        { species: 'fenrir', os: 'fenrir_v1', hpIV: 10, attackIV: 10, defenseIV: 10 },
    ],
    Nature: [
        { species: 'huldra', os: 'huldra_v1', hpIV: 10, attackIV: 10, defenseIV: 10 },
        { species: 'ratatoskr', os: 'ratatoskr_v1', hpIV: 10, attackIV: 10, defenseIV: 10 },
    ],
    Water: [
        { species: 'jormungandr', os: 'jormungandr_v1', hpIV: 10, attackIV: 10, defenseIV: 10 },
        { species: 'kraken', os: 'kraken_v1', hpIV: 10, attackIV: 10, defenseIV: 10 },
    ],
};

export function rollIntroLeader(run: IRunState, _node: IRegionNode, seed: string): IRunEncounter {
    const element = run.biomes[0]?.elements[0] ?? '';
    const plan = INTRO_LEADERS[element];
    if (!plan) throw new Error(`rollIntroLeader: no leader pair for the "${element}" biome`);

    const stream = new SeedStream(new SeedStream(seed).fork('intro-leader'));
    const gymName = GYM_REGISTRY[run.gymId]?.name ?? 'Gym';

    const enemyParty: IBattleEntity[] = [];
    const enemyDeckIds: string[] = [];
    for (const member of plan) {
        const definition = GetMingmingData(member.species);
        const state: IMingmingState = {
            id: stream.nextId(`intro_${member.species}`),
            definitionId: member.species,
            nickname: `${gymName} Leader ${definition.name}`,
            activeOS: member.os,
            blueprintsCollected: 0,
            hpIV: member.hpIV,
            attackIV: member.attackIV,
            defenseIV: member.defenseIV,
        };
        enemyParty.push(initializeBattleEntity(state, definition));
        enemyDeckIds.push(...getDeckForOS(member.species, member.os));
    }

    return {
        enemyParty,
        enemyDeckIds,
        seed,
        enemyAiTier: ENEMY_LADDER.gauntlet.ai,
        aiBeam: ENEMY_LADDER.gauntlet.beam,
    };
}
