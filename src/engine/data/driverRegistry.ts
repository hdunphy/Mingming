/**
 * DRIVERS — side-level passives, for either side. Ticket 68.
 *
 * # THE NAMING IS THE RULING, NOT A PREFERENCE
 *
 * Henry, 2026-08-27/28 (ticket 68 ruling 1): *"`boss_relic_*` is RETIRED as a concept and a naming.
 * Enemy passives are DRIVERS — the same concept and the same side-level machinery as the player's
 * Drivers, never 'relics', never 'protocols'."* The standing law in the map's Notes already said
 * never "potions"/"relics" for the player's; this extends it to the enemy's, and makes ticket 60's
 * gauntlet rung — *"kit + OS + **Driver**"* — literal rather than aspirational.
 *
 * The three `boss_relic_*` entries in `lib/hooks.json` are NOT deleted here. Ruling 6 keeps
 * Tidewrack and Rootfall exactly as ticket 18 built them until their own authoring session, so
 * exactly one gym migrates at a time and the diffs stay readable. Emberfall is the one that moved.
 *
 * # WHAT A DRIVER IS, MECHANICALLY
 *
 * Two kinds share the word, because the player already had one of them:
 *
 * - **A STAT Driver** is an entry in `relicRegistry.RelicRegistry` with an `effect` this module
 *   applies at battle creation (`DRAW_BONUS`, `ENERGY_CAP_BONUS`, `ATTACK_MULTIPLIER`). This is the
 *   Milestone 8.4 system, unchanged; only its call site moved here.
 * - **A HOOK Driver** is an entry in `lib/hooks.json` whose id starts with `driver_`. Its hooks are
 *   registered by `firmwareRegistry` like any firmware's, and this module attaches their **ids** to
 *   every member's `IBattleEntity.hooks`.
 *
 * **Attaching ids to `hooks` rather than setting `activeOS` is the whole of ruling 2's "additive,
 * not an OS replacement".** `Hooks.ts` collects a unit's hooks from three sources — `e.hooks`,
 * `e.activeOS`, `e.daemons` — and unions them, so a boss member under WAR FOOTING keeps running
 * UNBOUND_KERNEL and gains the Driver on top. The old boss did the opposite: `gauntlet.buildEnemy`
 * overwrote `activeOS` with a `boss_relic_*` id, which silently cost the boss its real firmware and
 * left `getDeckForOS` resolving its deck through a documented fallback. A boss that runs its species'
 * actual OS is the point of hand-authoring the trio.
 *
 * # WHY ONE FUNCTION FOR BOTH SIDES
 *
 * Ticket 68 build step 1 asks for the enemy list to be *"the same side-level machinery"* as the
 * player's, and the cheapest way to be sure of that is for there to be one function and two call
 * sites. `createBattleState` now applies this to the player party from `setup.drivers` and to the
 * enemy party from `setup.enemyDrivers`; a Driver that works on one side therefore works on the
 * other by construction, which is what ticket 16 will want when elites start dropping them.
 *
 * # WHY UNKNOWN IDS ARE SURVIVABLE HERE AND NOT IN `GetRelic`
 *
 * `GetRelic` throws on an unknown id, which is right for a lookup: a caller asking for a specific
 * relic wants to know it does not exist. It is wrong for an *application loop* over a list that may
 * legitimately mix the two kinds — the first `driver_*` id handed to the old loop would have thrown
 * mid-battle-creation. So the dispatch below asks which kind an id is before it asks the registry
 * anything, and an id that is neither is warned about once and skipped rather than killing the
 * fight it was supposed to decorate.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()`.
 */

import type { IBattleEntity } from '../types';
import { RelicRegistry } from './relicRegistry';
import { getOSBehavior, type OSDefinition } from './firmwareRegistry';

/** Every hook-bearing Driver's id carries this prefix. Ruling 1: never `boss_relic_*`. */
export const DRIVER_ID_PREFIX = 'driver_';

/** WAR FOOTING — Emberfall's leader Driver (ticket 68 ruling 5). */
export const DRIVER_WAR_FOOTING = 'driver_war_footing';

/**
 * Every hook-bearing Driver that ships, in a stable order.
 *
 * One entry today. It is a list rather than a constant because the authoring sessions for Tidewrack
 * and Rootfall (ruling 6) each add one, and because `driverRegistry.test.ts` sweeps it — a Driver
 * added to `hooks.json` and forgotten here is a Driver nothing checks.
 */
export const DRIVER_IDS: ReadonlyArray<string> = [DRIVER_WAR_FOOTING];

/** Is this a hook-bearing Driver id (as opposed to a stat Driver from `RelicRegistry`)? */
export function isHookDriver(id: string): boolean {
    return id.startsWith(DRIVER_ID_PREFIX);
}

/**
 * A hook Driver's definition — its name, its rule text and its hooks.
 *
 * Reads through `getOSBehavior` because `firmwareRegistry` is what loads and registers every
 * hooks.json entry, Drivers included; see the comment on its key filter for why there is one loader
 * rather than two. The return type is `OSDefinition` for the same reason and it is a slight lie in
 * the name only: a Driver is not an OS and is never assigned as one.
 */
export function getDriver(id: string): OSDefinition | undefined {
    if (!isHookDriver(id)) return undefined;
    return getOSBehavior(id);
}

/** The name and rule text to print for a Driver, for the offer screen's telegraph (ruling 4). */
export function describeDriver(id: string): { readonly name: string; readonly description: string } {
    const driver = getDriver(id);
    if (driver) return { name: driver.name, description: driver.description };
    const relic = RelicRegistry[id];
    if (relic) return { name: relic.name, description: relic.description };
    return { name: id, description: '' };
}

const warnedUnknown = new Set<string>();

/**
 * Apply one Driver to one entity, returning the modified entity.
 *
 * Pure: never mutates, and never touches `activeOS`.
 */
export function applyDriver(entity: IBattleEntity, driverId: string): IBattleEntity {
    if (isHookDriver(driverId)) {
        const driver = getDriver(driverId);
        if (!driver) {
            if (!warnedUnknown.has(driverId)) {
                warnedUnknown.add(driverId);
                console.warn(`[driverRegistry] No hooks.json entry for Driver "${driverId}"; skipping it.`);
            }
            return entity;
        }
        // De-duplicated by id: a hook applied twice fires twice, and WAR FOOTING applied twice
        // would be an aura at double rate rather than a no-op. `Hooks.ts` already dedupes when it
        // collects, but the entity's own list is what a UI and a save would read.
        const held = new Set(entity.hooks ?? []);
        for (const hook of driver.hooks) held.add(hook.id);
        return { ...entity, hooks: [...held] };
    }

    const relic = RelicRegistry[driverId];
    if (!relic) {
        if (!warnedUnknown.has(driverId)) {
            warnedUnknown.add(driverId);
            console.warn(`[driverRegistry] Unknown Driver "${driverId}"; skipping it.`);
        }
        return entity;
    }

    // Milestone 8.4's three stat effects, moved here verbatim from `createBattleState`.
    // `DEATH_PREVENT` (buffer_cache) is deliberately absent: it is read off
    // `IBattleState.activeRelics` by `resolutionEngine`, not off an entity, and moving it would be
    // a behaviour change inside a ticket that is not about the player's Drivers.
    if (relic.effect === 'ENERGY_CAP_BONUS') {
        return { ...entity, maxEnergy: entity.maxEnergy + 1, currentEnergy: entity.currentEnergy + 1 };
    }
    if (relic.effect === 'DRAW_BONUS') {
        return { ...entity, cardDraw: entity.cardDraw + 1 };
    }
    if (relic.effect === 'ATTACK_MULTIPLIER') {
        return {
            ...entity,
            relicBonuses: {
                ...entity.relicBonuses!,
                attackMod: entity.relicBonuses!.attackMod * 1.1,
            },
        };
    }
    return entity;
}

/** Apply a whole side's Drivers to one member of that side, in list order. */
export function applyDrivers(entity: IBattleEntity, driverIds: ReadonlyArray<string>): IBattleEntity {
    return driverIds.reduce(applyDriver, entity);
}
