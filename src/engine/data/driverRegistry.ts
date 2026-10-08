/**
 * DRIVERS — side-level passives, for either side. Ticket 68 built the machinery; ticket 16 built
 * the player's eight and deleted the relics.
 *
 * # THE NAMING IS THE RULING, NOT A PREFERENCE
 *
 * Henry, 2026-08-27/28 (ticket 68 ruling 1): *"`boss_relic_*` is RETIRED as a concept and a naming.
 * Enemy passives are DRIVERS — the same concept and the same side-level machinery as the player's
 * Drivers, never 'relics', never 'protocols'."* The standing law in the map's Notes already said
 * never "potions"/"relics" for the player's; this extends it to the enemy's, and makes ticket 60's
 * gauntlet rung — *"kit + OS + **Driver**"* — literal rather than aspirational.
 *
 * # WHAT A DRIVER IS, MECHANICALLY (ticket 16: there is one kind now)
 *
 * A Driver is an entry in `lib/hooks.json` whose id starts with `driver_`. Its hooks are registered
 * by `firmwareRegistry` like any firmware's, and this module attaches their **ids** to every
 * member's `IBattleEntity.hooks`. That is the whole mechanism — a Driver is *"a weaker OS for the
 * whole party"* (`economy-session.md`), and it is built out of exactly the parts an OS is.
 *
 * The other kind — the Milestone 8.4 STAT relics (`expansion_slot`, `heatsink`, `buffer_cache`,
 * `overclock_module`), applied as a draw bonus, an energy cap, a death-prevent and a flat 1.1x —
 * is DELETED in ticket 16. Two reasons, both rulings rather than tidiness: the player-facing law
 * says never call them relics, and the Driver law says PROC-VISIBLE — *"flat percents rejected as
 * INVISIBLE (the 2%-status disease)"* — which three of the four stat relics were by construction.
 * `RelicRegistry`, `GetRelic`, `IRelic`, `relicBonuses` and `IBattleState.activeRelics` (now
 * `activeDrivers`) are gone with them.
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
 * sites. `createBattleState` applies this to the player party from `setup.drivers` and to the enemy
 * party from `setup.enemyDrivers`; a Driver that works on one side therefore works on the other by
 * construction. Ticket 16 leaned on exactly that: every player Driver below is written with
 * `source: SELF` / `target: OPPONENT` relative to its OWNER, so handing `driver_first_blood` to a
 * boss makes the boss's first attack the boosted one.
 *
 * # THE PLAYER'S EIGHT (ticket 16; shapes ruled in `macros-and-drivers.md`, numbers by Henry 2026-09-11)
 *
 * | Driver | proc moment | v1 |
 * |---|---|---|
 * | TENTH STRIKE | every 10th ATTACK card this side plays | that card 1.5x |
 * | STATIC FIELD | every card this side plays | 6 power to a random enemy (Henry 2026-09-12: 2 -> 6, "it should be felt") |
 * | ANTIVENOM | end of this side's turn, each poisoned member | -1 extra Poison |
 * | OVERKILL RECOVERY | an enemy faints | each living member heals 8% max HP |
 * | FIRST BLOOD | the first ATTACK card this side plays each turn | 1.2x |
 * | <ELEMENT> DRIVER (x8) | an attack card of that element | 1.1x |
 * | BULWARK REFLEX | a member drops below 50%, once per fight per member | +15 Bark Shield |
 * | DEEP CACHE | this side's first bonus draw each turn | the drawer gains 1 Strengthened |
 *
 * TENTH STRIKE was ruled as "Third Strike" and re-cadenced the same day — *"third strike is too
 * often, it should be like every 10 attacks"* — then renamed by Henry on 2026-09-12 so the name says
 * the number. The `proc: true` flag on each payoff hook is what makes them PROC-VISIBLE (see `HookTypes`).
 *
 * # WHY UNKNOWN IDS ARE SURVIVABLE HERE
 *
 * This is an *application loop* over a list that comes from a save. An id that is not in
 * `hooks.json` — a Driver renamed after a run was saved, a typo in a scenario file — is warned
 * about once and skipped rather than killing the fight it was supposed to decorate.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()`.
 */

import type { IBattleEntity, Element } from '../types';
import { ELEMENTS } from '../types';
import { getOSBehavior, type OSDefinition } from './firmwareRegistry';

/** Every Driver's id carries this prefix. Ruling 1: never `boss_relic_*`. */
export const DRIVER_ID_PREFIX = 'driver_';

/**
 * WAR FOOTING — Emberfall's leader Driver from ticket 68 ruling 5 until ticket 207, which gave
 * Emberfall SURTALOGI (Henry, 2026-10-08: *"Change this totem to give more damage on overflow for
 * burn"*). Kept defined: the experiment harness and the Driver tests still name it. No gym fields it.
 */
export const DRIVER_WAR_FOOTING = 'driver_war_footing';

/**
 * TICKET 207 — **SURTALOGI**, Emberfall's leader Driver: each Burn detonation this side causes on an
 * enemy deals 5% more of that enemy's max HP (14% → 19%). Henry ruled the 5% on 2026-10-08.
 */
export const DRIVER_SURTALOGI = 'driver_surtalogi';

/**
 * Shown as **YGGDRASIL'S WRATH** since ticket 207 (the id keeps its old name, ticket 183's rule).
 * Tidewrack's Driver from ticket 71; **Rootfall's** since ticket 207 (Henry: *"Switch the
 * totems"*), with its blast made Nature. The first user of the SIDE counter scope.
 */
export const DRIVER_TIDAL_SURGE = 'driver_tidal_surge';

/**
 * Shown as **ÉLIVÁGAR** since ticket 207 (the id keeps its old name). Rootfall's Driver from ticket
 * 72; **Tidewrack's** since ticket 207, where the Poison team is.
 */
export const DRIVER_ROOT_ROT = 'driver_root_rot';

/**
 * The three gym leaders' signature Drivers. Ticket 68 ruling 4 puts these explicitly out of the
 * player's reach (*"enemy signature Drivers never enter the pool"*); `codex.ts` relies on that.
 * WAR FOOTING stays listed so it stays out of the player's pool too.
 */
export const GYM_DRIVER_IDS: ReadonlyArray<string> = [DRIVER_SURTALOGI, DRIVER_TIDAL_SURGE, DRIVER_ROOT_ROT, DRIVER_WAR_FOOTING];

export const DRIVER_TENTH_STRIKE = 'driver_tenth_strike';
export const DRIVER_STATIC_FIELD = 'driver_static_field';
export const DRIVER_ANTIVENOM = 'driver_antivenom';
export const DRIVER_OVERKILL_RECOVERY = 'driver_overkill_recovery';
export const DRIVER_FIRST_BLOOD = 'driver_first_blood';
export const DRIVER_BULWARK_REFLEX = 'driver_bulwark_reflex';
export const DRIVER_DEEP_CACHE = 'driver_deep_cache';

/** TICKET 168b — the two Drivers an event's bad outcome gives for the next fight only. */
export const DRIVER_FRAYED_SIGNAL = 'driver_frayed_signal';
export const DRIVER_STATIC_HAZE = 'driver_static_haze';

/**
 * Drivers that exist only as an event's penalty (ticket 168b): FRAYED SIGNAL and STATIC HAZE.
 *
 * Deliberately in NONE of `PLAYER_DRIVER_IDS`, `DRIVER_IDS`, the elite stake pool or
 * `playerDriverOptions()` — nothing may offer them as a reward. This list is how `describeDriver`
 * and the UI still know they exist and what to call them.
 */
export const TEMPORARY_DRIVER_IDS: ReadonlyArray<string> = [DRIVER_FRAYED_SIGNAL, DRIVER_STATIC_HAZE];

/** Whether a Driver is one of the temporary ones. */
export function isTemporaryDriver(id: string): boolean {
    return TEMPORARY_DRIVER_IDS.includes(id);
}

/** The Element Driver for one element. `None` has no Driver — there is no such thing as a None deck. */
export function elementDriverId(element: Exclude<Element, 'None'>): string {
    return `driver_element_${element.toLowerCase()}`;
}

/** One Element Driver per real element, in `ELEMENTS` order. */
export const ELEMENT_DRIVER_IDS: ReadonlyArray<string> = ELEMENTS
    .filter((e): e is Exclude<Element, 'None'> => e !== 'None')
    .map(elementDriverId);

/**
 * The player's Drivers — the ruled eight, with the Element Drivers expanded. This is the pool an
 * elite pays out of (ticket 17); the gym Drivers are deliberately NOT in it.
 */
export const PLAYER_DRIVER_IDS: ReadonlyArray<string> = [
    DRIVER_TENTH_STRIKE,
    DRIVER_STATIC_FIELD,
    DRIVER_ANTIVENOM,
    DRIVER_OVERKILL_RECOVERY,
    DRIVER_FIRST_BLOOD,
    ...ELEMENT_DRIVER_IDS,
    DRIVER_BULWARK_REFLEX,
    DRIVER_DEEP_CACHE,
];

/**
 * Every Driver that ships, in a stable order.
 *
 * It is a list rather than a constant because `driverRegistry.test.ts` sweeps it — a Driver added
 * to `hooks.json` and forgotten here is a Driver nothing checks.
 */
export const DRIVER_IDS: ReadonlyArray<string> = [...GYM_DRIVER_IDS, ...PLAYER_DRIVER_IDS];

/** Is this a Driver id? */
export function isDriverId(id: string): boolean {
    return id.startsWith(DRIVER_ID_PREFIX);
}

/**
 * A Driver's definition — its name, its rule text and its hooks.
 *
 * Reads through `getOSBehavior` because `firmwareRegistry` is what loads and registers every
 * hooks.json entry, Drivers included; see the comment on its key filter for why there is one loader
 * rather than two. The return type is `OSDefinition` for the same reason and it is a slight lie in
 * the name only: a Driver is not an OS and is never assigned as one.
 */
export function getDriver(id: string): OSDefinition | undefined {
    if (!isDriverId(id)) return undefined;
    return getOSBehavior(id);
}

/** The name and rule text to print for a Driver — the chip, its tooltip, the offer screen's telegraph. */
export function describeDriver(id: string): { readonly name: string; readonly description: string } {
    const driver = getDriver(id);
    if (driver) return { name: driver.name, description: driver.description };
    return { name: id, description: '' };
}

/**
 * Every Driver's name, rule text and id, for a picker (the debug scenario launcher today; ticket
 * 17's elite stakes tomorrow). Player Drivers only — a gym's signature is not on offer.
 */
export function playerDriverOptions(): ReadonlyArray<{ id: string; name: string; description: string }> {
    return PLAYER_DRIVER_IDS.map((id) => ({ id, ...describeDriver(id) }));
}

const warnedUnknown = new Set<string>();

/**
 * Apply one Driver to one entity, returning the modified entity.
 *
 * Pure: never mutates, and never touches `activeOS`.
 */
export function applyDriver(entity: IBattleEntity, driverId: string): IBattleEntity {
    const driver = getDriver(driverId);
    if (!driver) {
        if (!warnedUnknown.has(driverId)) {
            warnedUnknown.add(driverId);
            console.warn(`[driverRegistry] Unknown Driver "${driverId}"; skipping it.`);
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

/** Apply a whole side's Drivers to one member of that side, in list order. */
export function applyDrivers(entity: IBattleEntity, driverIds: ReadonlyArray<string>): IBattleEntity {
    return driverIds.reduce(applyDriver, entity);
}
