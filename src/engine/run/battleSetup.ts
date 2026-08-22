/**
 * Ranch + run → `IBattleSetup` — ticket 11 (steam-release map).
 *
 * # WHY THIS IS A SEPARATE MODULE
 *
 * `createBattleState` used to take the whole `IPlayerSave` and answer six questions out of it:
 * who is fighting, what deck they hold, which relics apply, what HP they carried in. Ticket 06's
 * split means those six answers now live in two objects — the party ids and the deck are the
 * **run's**, the individuals they name are the **ranch's** — and joining them is a decision, not a
 * lookup. Putting the join inside the battle factory would give the engine's lowest layer a reason
 * to know what a ranch is; putting it in the component that starts a fight would duplicate it once
 * per caller. It lives here, once, between the two.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()`.
 */

import type { IBattleSetup } from '../data/battleFactories';
import { GYM_REGISTRY } from './gyms';
import type { IRanchMember, IRanchState, IRunState } from '../runTypes';
import type { Element, IMingmingState } from '../types';

/**
 * A ranch member, widened to the shape combat builds entities from.
 *
 * The only field `IMingmingState` has that `IRanchMember` does not is **`blueprintsCollected`, and
 * it is vestigial**: v3 kept a per-individual tally of "blueprints of this species seen", which
 * ticket 20 replaced with `IRanchState.blueprints` — a ranch-level count you spend. Nothing reads
 * the per-individual number and nothing writes it. It is zero here because the type still demands
 * it, not because zero means anything; when `IMingmingState` loses the field, this line goes with
 * it.
 */
export function toMingmingState(member: IRanchMember): IMingmingState {
    return {
        id: member.id,
        definitionId: member.definitionId,
        ...(member.nickname === undefined ? {} : { nickname: member.nickname }),
        activeOS: member.activeOS,
        blueprintsCollected: 0,
        attackIV: member.attackIV,
        defenseIV: member.defenseIV,
        hpIV: member.hpIV,
    };
}

/**
 * Everything a fight in this run needs, resolved.
 *
 * `partyIds` is resolved **in run order**, and an id that names nobody is skipped rather than
 * throwing. `reconcileLoadedState` already guarantees no dangling id survives a load, so the only
 * way to get one is a member removed from the roster mid-run, which is not a reachable action
 * today — silently fielding the members who do exist is a better answer than refusing to start the
 * fight over a state nothing can produce. `createBattleState` still throws on an empty party.
 *
 * The gauntlet's **element comes from the gym registry**, not from the run state. `IGauntletProgress`
 * deliberately carries no `type` and no `element` (ticket 06): in a run the gauntlet is always
 * `GYM_REGISTRY[run.gymId]`'s, so storing the element again would be a second copy of a fact that
 * can drift from the first. An unknown `gymId` yields a null gauntlet — the fight falls back to the
 * ordinary encounter path rather than picking an arbitrary element.
 *
 * `encounter` is ticket 11 part 2's addition: the enemies a region node rolled, passed straight
 * through. It is a parameter rather than something this function rolls itself because the roll
 * needs the node — and a node is a position on the map, not a property of the run as a whole. The
 * caller has just walked onto one; this function has no way to know which.
 */
export function buildBattleSetup(
    ranch: IRanchState,
    run: IRunState,
    encounter?: IBattleSetup['encounter'],
): IBattleSetup {
    const byId = new Map(ranch.roster.map((member) => [member.id, member]));

    const party: IMingmingState[] = [];
    for (const id of run.partyIds) {
        const member = byId.get(id);
        if (member) party.push(toMingmingState(member));
    }

    const gym = GYM_REGISTRY[run.gymId];

    return {
        party,
        deck: run.deck.map((card) => card.dataId),
        drivers: [...run.drivers],
        persistedHp: run.gauntlet ? { ...run.gauntlet.persistedHp } : {},
        gauntlet:
            run.gauntlet && gym
                ? { element: gym.element as Element, fightIndex: run.gauntlet.fightIndex }
                : null,
        encounter: encounter ?? null,
    };
}
