/**
 * THE AUTHORED GYM BOSSES — ticket 68.
 *
 * A hand-authored boss team: three real species running their REAL tuned OSes, behind one
 * side-level Driver.
 *
 * # WHAT THIS REPLACES, AND WHY
 *
 * Ticket 18's boss was a *formula*: draw one species per biome, overwrite its `activeOS` with a
 * `boss_relic_*` id, and let the deck resolve through `getDeckForOS`'s documented fallback. Ticket
 * 67 §12 measured what that cost — **halving `BOSS_IVS` bought 1.7 points and switching the relic
 * hooks off bought 58.3.** The relic stack was the wall, and it was a wall nobody had designed: the
 * three relics were placeholders shipped so the rung would not be empty.
 *
 * Henry reviewed the system in session on 2026-08-27/28 and redesigned the fight from first
 * principles (ticket 68, rulings 1-5). Two changes matter here:
 *
 * 1. **The members keep their own firmware.** A boss is a real team of real mingmings — the same
 *    tuned decks the player can build, played well — not three bodies wearing a bespoke passive.
 *    `data/driverRegistry` is what makes that possible: a Driver attaches hooks and leaves
 *    `activeOS` alone, where a relic overwrote it.
 * 2. **One Driver for the SIDE, not one per member.** Three relics on three bodies was three
 *    simultaneous effects with no shared idea. One Driver is a rule the whole fight is *about*, and
 *    it is a rule the player can be told in advance — ruling 4's telegraph, which only means
 *    anything if there is a single thing to tell them.
 *
 * # THE COMPOSITION IS AUTHORED, NOT DERIVED
 *
 * Ruling 3 gives the heuristic — *"two decks of the leader's own element plus one member countering
 * the player's expected counter-team"* — as an **authoring guide, explicitly not a formula**. It is
 * deliberately not written as code: the moment it is a function, every gym fields the same shape and
 * the hand-authoring has bought nothing. Emberfall satisfies it (Fire, Fire, and Nature — the prey
 * element of the Water team a prepared player brings to a Fire gym); the next gym is free not to.
 *
 * # ONE GYM PER SESSION
 *
 * Ruling 6: **Tidewrack and Rootfall are NOT authored** and keep ticket 18's formula boss exactly as
 * built until their own design sessions. That is why this is a partial table and why
 * `rollGauntletFight` branches on its presence rather than being rewritten around it — one gym
 * migrates at a time and each diff stays readable.
 *
 * # WHY THIS IS ITS OWN MODULE
 *
 * `gauntlet.ts` builds the boss fight and `encounter.ts` gives the region's final elites the gym's
 * Driver (ruling 4, the second half of the telegraph). `gauntlet.ts` already imports `encounter.ts`
 * for the ladder and the species pools, so putting the table in either of them would make the other
 * one import backwards. The table is data both need and neither owns.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()`.
 */

import { DRIVER_WAR_FOOTING } from '../data/driverRegistry';

export interface IAuthoredBossMember {
    /** A `MingmingRegistry` species id. */
    readonly species: string;
    /** The OS it actually runs — one of that species' own `availableOS`, never a `boss_relic_*`. */
    readonly os: string;
}

export interface IAuthoredBoss {
    /** The members, in line-up order. `GAUNTLET_ENEMY_COUNT` long. */
    readonly members: ReadonlyArray<IAuthoredBossMember>;
    /** The one side-level Driver this fight is about (`data/driverRegistry`). */
    readonly driver: string;
}

/**
 * The authored gym bosses, by gym id. A gym absent from this table fields ticket 18's formula boss.
 *
 * **EMBERFALL** (ruling 5): fenrir_v1 (UNBOUND_KERNEL) + skoll_v1 (TREACHERY_KERNEL) + ratatoskr_v2
 * (INSTIGATOR_OS), under **WAR FOOTING**. Henry's design note, kept because it is the intent the
 * measurement should be read against: *"skoll_v1 punishes wide chip (zoo feeds it) — deliberate; the
 * first fight in the game that pushes back on the dominant zoo comp."* The intended counter, for the
 * sim gate's record, is a control-leaning 2 Water + 1 Fire.
 */
export const AUTHORED_BOSSES: Readonly<Record<string, IAuthoredBoss>> = {
    gym_emberfall: {
        members: [
            { species: 'fenrir', os: 'fenrir_v1' },
            { species: 'skoll', os: 'skoll_v1' },
            { species: 'ratatoskr', os: 'ratatoskr_v2' },
        ],
        driver: DRIVER_WAR_FOOTING,
    },
};

/** The authored boss for a gym, or undefined where ticket 18's formula still stands (ruling 6). */
export function authoredBossFor(gymId: string): IAuthoredBoss | undefined {
    return AUTHORED_BOSSES[gymId];
}
