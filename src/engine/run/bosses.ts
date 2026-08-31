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

import { DRIVER_ROOT_ROT, DRIVER_TIDAL_SURGE, DRIVER_WAR_FOOTING } from '../data/driverRegistry';

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
    /*
     * TIDEWRACK (ticket 71, recomposed by ticket 74): jormungandr_v1 (OUROBOROS_LOOP) +
     * **kraken_v2 (TIDAL_CRUSH)** + skoll_v2 (SOLAR_OVERDRIVE), under TIDAL SURGE.
     *
     * # WHY THE THIRD SLOT CHANGED (ticket 74, Henry 2026-08-31)
     *
     * The original trio was TWO card-count-and-draw engines plus a closer, and research/73 measured
     * what that actually cost. Against Henry's own playtest party the fight sat at **30.0%** against
     * a ~84.3% per-fight guide, and the arms found the reason was not the payoff card's printed
     * power — a 64% cut to `ink_stream` bought 13 points and did not clear (p = 0.22). It was the
     * FLOW: `CARDS_DRAWN_TRIGGERED` is per-Mingming, so the cantrips feeding each engine were the
     * multiplier, and pulling them moved the fight 30 to 93 points depending on dose.
     *
     * Ticket 74's ruling takes the composition route rather than the card route, and it is the
     * cleaner one: `kraken_v1` (ABYSSAL_INK_SYS) IS the second engine. Swapping it for `kraken_v2`
     * removes `ink_stream` x2, `whirlpool_v2` x2, `pressure_point` x2 and the third `undertow` from
     * the pile in a single authored change — no `hooks.json` edit and no boss-only card printing,
     * both of which the ticket rules out. What replaces them is TIDAL_CRUSH's ramp-into-3e shape
     * (`maelstrom`, `hydro_blast`, `capacitor` x2), which is a different kind of pressure rather
     * than less of it.
     *
     * The consequence worth stating: the fight keeps ONE engine (jormungandr_v1) instead of two, so
     * TIDAL SURGE's 10-card threshold now charges off a narrower base. Whether the Driver still
     * earns its slot is a question for the measurement, not an assumption here.
     *
     * **skoll_v2 rather than a Nature third, deliberately** (Henry, 2026-08-29): a Nature member
     * would give the Nature counter-team nothing to fear, and the heuristic's third slot exists to
     * counter the player's expected counter. Skoll fields v1 at Emberfall and v2 here on purpose —
     * leaders build differently, and the same OS at two gyms would make the roster read as a pool.
     *
     * Intended counter, for the gate's record: **Nature** — the only launch element with Weakened,
     * which is maximally efficient against many small hits — plus ticket 69's toolbox (riptide,
     * Short Circuit).
     */
    gym_tidewrack: {
        members: [
            { species: 'jormungandr', os: 'jormungandr_v1' },
            { species: 'kraken', os: 'kraken_v2' },
            { species: 'skoll', os: 'skoll_v2' },
        ],
        driver: DRIVER_TIDAL_SURGE,
    },
    /*
     * ROOTFALL (ticket 72): huldra_v2 (BARK_SHIELD_OS) + ratatoskr_v1 (GOSSIP_NODE) +
     * jormungandr_v2 (TOXIN_FANG_OS), under ROOT ROT — the strangler.
     *
     * Shield-poison, party-wide 0-cost sustain with nettle chip, and a poison execute. Three
     * distinct species, 2 Nature + 1 Water on ruling 3's heuristic. Rejected and recorded (Henry,
     * 2026-08-29): twin-huldra builds (they read as a species-clause violation even where legal),
     * reusing ratatoskr_v2 (the same OS at two gyms makes the roster read as a pool), and a
     * kraken_v2 control-burst sketch (it drops the poison identity the fight is about).
     *
     * Intended counter, for the gate's record: **Fire** by type — fenrir_v1's missing-HP scaling
     * converts poison pressure into damage — plus ticket 69's cleanse toolbox. The landscape fact
     * that motivated the toolbox: `soothe` (0e, 1 stack) loses the race, and `purify` is Light and
     * so off-EA.
     */
    gym_rootfall: {
        members: [
            { species: 'huldra', os: 'huldra_v2' },
            { species: 'ratatoskr', os: 'ratatoskr_v1' },
            { species: 'jormungandr', os: 'jormungandr_v2' },
        ],
        driver: DRIVER_ROOT_ROT,
    },
};

/** The authored boss for a gym, or undefined where ticket 18's formula still stands (ruling 6). */
export function authoredBossFor(gymId: string): IAuthoredBoss | undefined {
    return AUTHORED_BOSSES[gymId];
}
