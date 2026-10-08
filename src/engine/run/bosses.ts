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

import { DRIVER_ROOT_ROT, DRIVER_SURTALOGI, DRIVER_TIDAL_SURGE } from '../data/driverRegistry';

export interface IAuthoredBossMember {
    /** A `MingmingRegistry` species id. */
    readonly species: string;
    /** The OS it actually runs — one of that species' own `availableOS`, never a `boss_relic_*`. */
    readonly os: string;
    /**
     * TICKET 207 — **the leader's own deck list**, authored rather than read from `getDeckForOS`, so
     * a change to a species' tuned deck no longer moves the gym. Henry reviewed every list
     * (2026-10-08). The leader card below is NOT in this list; `leaderDeckFor` adds it.
     */
    readonly deck: ReadonlyArray<string>;
    /**
     * TICKET 207 — **this Instinct's leader card**, one per member, picked by Henry 2026-10-08. The
     * leader holds one; an enemy running this Instinct in gym fights 1 and 2 holds one too, added to
     * its usual deck (Henry: *"Add some of the leader cards so you get to see them before the fight"*).
     * Leader cards are outside the run pool, so no reward, shop or codex can offer them.
     */
    readonly leaderCard: string;
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
 * **TICKET 207 replaced every team, deck and Driver below** (see its block above the table). The
 * 28a/28b notes are kept as the record of what was tried; the teams they describe no longer ship.
 *
 * ══ TICKET 28a (Henry, 2026-09-24) — **THIS IS THE ONE GYM COMP TABLE NOW.** ══
 *
 * `gyms.ts` carried a second one, `IGym.leaderComp`, put there by 142b as an explicit placeholder
 * (*"ticket 28 should overwrite these with the authored teams"*). It never was, and the two
 * disagreed at every gym — so **the scout previewed a team the gauntlet does not field**, which is
 * the worst shape a free look can take: not missing information, but wrong information the player
 * has no reason to distrust. `leaderComp` is deleted; `gymCompElementPlan` and `scoutFirmwareFor`
 * read this table, and so does 157's walker when it recruits toward the gym.
 *
 * **The trios also changed**, on Henry's ruling: *"bosses, but whichever trio has the better
 * synergies (zoo / control / ramp)"*. Each gym fields **two own-element bodies plus one guest** and
 * a single readable plan, drawn from 158's partner tags — which is the same authored web the recruit
 * policy reads, so a gym is now a party built by the rules the player builds under.
 *
 * Kept from the old entries, exactly: the **Driver** at each gym, and the design notes below, which
 * are the intent the measurement is read against.
 *
 * **EMBERFALL** — **fenrir_v2 (CINDER_WALL) + skoll_v2 (EMBER_FUSE) + kraken_v2 (TIDAL_CRUSH)**,
 * under **WAR FOOTING**. 28a, on Henry's "better synergies" ruling.
 *
 * The plan is DETONATION, and it is one plan rather than three bodies: skoll_v2 pushes Burn piles
 * past the cap, kraken_v2's steam pre-loads them, and every Burn either applies is a Sharp for
 * fenrir_v2 — which is `osGrammar`'s authored partner line for that pair, word for word (*"Steam
 * Burns pre-load the pile Sköll detonates"*, *"Every Burn Sköll adds is Sharp for Fenrir"*). Two
 * Fire bodies, one Water guest.
 *
 * Henry's note on the OLD trio is kept, because the thing it wanted is still true of this one:
 * *"skoll_v1 punishes wide chip (zoo feeds it) — deliberate; the first fight in the game that pushes
 * back on the dominant zoo comp."* Burn on every body punishes width the same way, without the v1
 * kit. The intended counter for the gate's record is unchanged: control-leaning 2 Water + 1 Fire.
 */
/*
 * ══ TICKET 207 (Henry, 2026-10-08) — **THE AUTHORED GYM TEAMS: members, decks, leader cards.** ══
 *
 * Henry picked the three teams, each a plan with two bodies of the gym's element and one guest from
 * the element the gym beats (28b's rule, kept), and reviewed every deck list:
 *
 * - **Emberfall, control (SURTALOGI):** fenrir_v2 + skoll_v2 + huldra_v2. Burn is the whole team's
 *   damage; Muspel Wall turns it into Sharp for Fenrir, Sunscorch's multi-hits push piles past the
 *   cap, and Huldra walls with Bark Shield.
 * - **Tidewrack, ramp (ÉLIVÁGAR):** kraken_v2 + jormungandr_v2 + fenrir_v1. Energized and Poison
 *   early; Venomfang scales on the Poison; multi-hit payoffs late.
 * - **Rootfall, zoo (YGGDRASIL'S WRATH):** ratatoskr_v1 + huldra_v1 + kraken_v1. Dazed from every
 *   direction, payoffs that read Dazed and cards played.
 *
 * Every deck card is from the run pool except the leader cards and `eitr_surge` (Henry: *"New card
 * and add 4 poison then fill with damage"*, in place of Boiling Surge for the gym's Kraken, so the
 * player's kraken_v2 kit keeps its Burn payoff). The teams the earlier tickets fielded (68, 71, 72,
 * 74, 28a, 28b) and their reasons are in git history and ticket 207.
 */
export const AUTHORED_BOSSES: Readonly<Record<string, IAuthoredBoss>> = {
    gym_emberfall: {
        members: [
            {
                species: 'fenrir', os: 'fenrir_v2', leaderCard: 'flame_wave',
                deck: ['ignite', 'ignite', 'ember_jab', 'snarl', 'slag_strike', 'molten_core', 'ember_ward', 'cinder_lance', 'cinder_lance', 'flashover'],
            },
            {
                species: 'skoll', os: 'skoll_v2', leaderCard: 'chase_the_sun',
                deck: ['ember_jab', 'ember_jab', 'scald', 'brand', 'brand', 'flare_burst', 'pack_tactics', 'inferno', 'heat_wave', 'thermal_overload'],
            },
            {
                species: 'huldra', os: 'huldra_v2', leaderCard: 'smoldering_bark',
                deck: ['heartwood', 'heartwood', 'shell_share', 'shell_share', 'iron_bark', 'molten_core', 'inferno', 'cinder_armor', 'bark_lash', 'bark_smash'],
            },
        ],
        driver: DRIVER_SURTALOGI,
    },
    gym_tidewrack: {
        members: [
            {
                species: 'kraken', os: 'kraken_v2', leaderCard: 'pressure_front',
                deck: ['tide_pool', 'tide_pool', 'surge_protection', 'spreading_rot', 'capacitor', 'tidal_battery', 'contagion', 'eitr_surge', 'hydro_blast', 'tidal_wave'],
            },
            {
                species: 'jormungandr', os: 'jormungandr_v2', leaderCard: 'coil_and_strike',
                deck: ['poison_injection', 'poison_injection', 'corrosive_leak', 'corrosive_bolt', 'corrosive_bolt', 'tide_pool', 'serpent_flurry', 'serpent_flurry', 'venom_fang', 'contagion'],
            },
            {
                species: 'fenrir', os: 'fenrir_v1', leaderCard: 'gleipnir_breaks',
                deck: ['war_pact', 'desperate_strike', 'fury_strike', 'flare_burst', 'flare_burst', 'glass_cannon', 'ragnarok_edge', 'unbound_fang', 'pack_tactics', 'pack_tactics'],
            },
        ],
        driver: DRIVER_ROOT_ROT,
    },
    gym_rootfall: {
        members: [
            {
                species: 'ratatoskr', os: 'ratatoskr_v1', leaderCard: 'rumor',
                deck: ['acorn_toss', 'acorn_toss', 'heckle', 'heckle', 'forage', 'forage', 'nagging_bite', 'hoofbeat', 'seed_bomb', 'seed_bomb'],
            },
            {
                species: 'huldra', os: 'huldra_v1', leaderCard: 'bewitch',
                deck: ['tend', 'tend', 'pollen_cloud', 'bolster', 'thorn_whip', 'nagging_bite', 'verdant_ward', 'pile_on', 'slander', 'slander'],
            },
            {
                species: 'kraken', os: 'kraken_v1', leaderCard: 'deep_current',
                deck: ['undertow', 'undertow', 'blind_spot', 'blind_spot', 'whirlpool', 'whirlpool', 'pressure_point', 'deep_scan', 'serpents_coil', 'crushing_depths'],
            },
        ],
        driver: DRIVER_TIDAL_SURGE,
    },
};

/** The authored boss for a gym, or undefined where ticket 18's formula still stands (ruling 6). */
export function authoredBossFor(gymId: string): IAuthoredBoss | undefined {
    return AUTHORED_BOSSES[gymId];
}

/** TICKET 207: the deck a leader member fights with — its authored list plus its leader card. */
export function leaderDeckFor(member: IAuthoredBossMember): string[] {
    return [...member.deck, member.leaderCard];
}

/**
 * TICKET 207: the leader member running this Instinct at this gym, if any. Fights 1 and 2 ask it to
 * hand an enemy of that Instinct its leader card.
 */
export function leaderMemberFor(gymId: string, os: string): IAuthoredBossMember | undefined {
    return authoredBossFor(gymId)?.members.find((member) => member.os === os);
}
