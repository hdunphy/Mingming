/**
 * TICKET 195h — each member's HP across a gauntlet, under the party's own ids and the screen's own max.
 *
 * The balance harness makes up the battle's entity ids, so a battle entity's id is not the id of the
 * ranch member it stands for. The two line up by position instead: the battle is built from
 * `partyOf(world)`, one entity per member, in order. `advanceGauntlet` only takes the run's own ids.
 *
 * The harness also rolls a small per-fight stat jitter (balance's), so a fight's max HP can differ by
 * a few points from the plain max the gauntlet screen prints. HP is carried as a share of the fight's
 * max and written against the plain max, so "1125/1125" stays full and nothing reads above its max.
 */
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { initializeBattleEntity, type IBattleState, type IMingmingState } from '../../engine/types';
import { partyOf } from './party';
import type { RewardFlow, World } from './types';

/** The max HP a member shows on the gauntlet screen: its stats with no jitter. */
export const plainMaxHp = (member: IMingmingState): number => initializeBattleEntity(member, GetMingmingData(member.definitionId)).maxHp;

export function carriedFrom(world: World, battle: IBattleState): NonNullable<RewardFlow['carried']> {
    const party = partyOf(world);
    return battle.playerParty.flatMap((entity, i) => {
        const member = party[i];
        if (!member) return [];
        const maxHp = plainMaxHp(member);
        const hp = entity.currentHp <= 0 ? 0 : Math.min(maxHp, Math.max(1, Math.round((entity.currentHp * maxHp) / entity.maxHp)));
        return [{ memberId: member.id, hp, maxHp }];
    });
}

/** What the next fight is told: a member at full health is left out (so a jittered max can never sit below it). */
export function carriedForFight(world: World, carried: Readonly<Record<string, number>> | undefined): Readonly<Record<string, number>> | undefined {
    if (!carried) return carried;
    const out: Record<string, number> = {};
    for (const member of partyOf(world)) {
        const hp = carried[member.id];
        if (hp !== undefined && hp < plainMaxHp(member)) out[member.id] = hp;
    }
    return out;
}
