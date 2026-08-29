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
import type { IRanchMember, IRanchState, IRunState } from '../runTypes';
import type { IMingmingState } from '../types';

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
 * # WHAT A GAUNTLET STILL NEEDS FROM HERE, AFTER TICKET 18: ONE FIELD
 *
 * Ticket 11 passed a `gauntlet: { element, fightIndex }` down to the battle factory, because the
 * factory had a branch that built the gym's enemies out of it. **Ticket 18 deleted that branch** —
 * a gauntlet fight is rolled by `engine/run/gauntlet.rollGauntletFight` and arrives through
 * `encounter` like any other pre-rolled fight — so the field went with it. What is left is
 * `persistedHp`, and it carries the whole of the gauntlet's asymmetry:
 *
 * - **`run.gauntlet` null → `{}` → a full heal, by construction.** There is nowhere else in
 *   `IRunState` to put an HP number, so "FULL HEAL between regular nodes" (`exploration-map.md`) is
 *   not a rule anyone has to remember to apply; it is what happens when nothing carries.
 * - **A member at 0 is IN the map, not missing from it.** `persistedHp[id] === 0` builds that member
 *   into the fight at 0 HP — down, revivable, and still a legal target for the Revive macro's
 *   `DOWNED_ALLY` targeting. Dropping downed members from the map (or from the party) would make
 *   them gone-for-gauntlet, which `economy-session.md` forbids in those words.
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

    return {
        party,
        deck: run.deck.map((card) => card.dataId),
        drivers: [...run.drivers],
        // Copied rather than aliased: `IRunState` is deeply readonly and `IBattleSetup` is handed to
        // a factory that is free to read it however it likes. A zero in here is a downed member —
        // see the header, and `IBattleSetup.persistedHp`.
        persistedHp: run.gauntlet ? { ...run.gauntlet.persistedHp } : {},
        encounter: encounter ?? null,
        // Ticket 68: the enemy side's Drivers travel on the encounter, because the encounter is
        // where the fight was decided. They are lifted to the top level here for the same reason
        // `persistedHp` is not nested — `createBattleState` applies them to the enemy party exactly
        // as it applies `drivers` to the player's, and a factory should not have to reach into a
        // sub-object for one half of a symmetric pair.
        ...(encounter?.enemyDrivers?.length ? { enemyDrivers: [...encounter.enemyDrivers] } : {}),
    };
}
