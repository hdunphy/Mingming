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
export const AUTHORED_BOSSES: Readonly<Record<string, IAuthoredBoss>> = {
    /*
     * ══ TICKET 28b (Henry, 2026-09-25) — **THE GUEST IS THE ELEMENT THE GYM BEATS.** ══
     *
     * 28a picked each third slot for synergy, and at Emberfall that chose `kraken_v2` — WATER, the
     * element that beats Fire. The heuristic it was reaching for was "counter the player's expected
     * counter", and the ruling replaces it with a simpler one that reads the same way from the
     * player's chair: **a gym's guest is a body from the element the gym's own element defeats.**
     *
     * Fire beats Nature, so Emberfall's guest is Nature: `huldra_v1`. What that changes for the
     * player is the shape of the exam — the trio no longer carries the answer to itself, and the
     * Water counter the gate expects has nothing on the field already resisting it.
     *
     * Intended counter, for the gate's record: **Water**.
     */
    gym_emberfall: {
        members: [
            { species: 'fenrir', os: 'fenrir_v2' },
            { species: 'skoll', os: 'skoll_v2' },
            { species: 'huldra', os: 'huldra_v1' },
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
    /*
     * TICKET 28a supersedes the composition above, and does it by going BACK to the shape ticket 74
     * moved away from — so the reason is stated rather than buried.
     *
     * 74 swapped `kraken_v1` out because the trio was "two card-count engines plus a closer" and the
     * FLOW was the multiplier. That was measured against the V1 COLLECTION. Collection v2 re-cut
     * every card the argument was about: `ink_stream`, `whirlpool_v2` and `pressure_point` are not
     * in kraken_v1's kit any more, and `undertow` now costs the caster a Weakened (152). The engine
     * 74 pulled apart is not the engine that ships.
     *
     * What ships instead is the WATER ENGINE as `osGrammar` authors it: jormungandr_v1 and kraken_v1
     * are listed partners in both directions (*"Both engines eat Undertow; ABYSSAL_INK turns Jorm's
     * draws into Dazed"*), and ratatoskr_v1's GOSSIP heals through it. Two Water bodies, one Nature
     * guest, under TIDAL SURGE — whose 10-card threshold charges off two engines again rather than
     * one.
     *
     * 74's intended counter stands: **Nature**, the only launch element with Weakened, plus ticket
     * 69's toolbox.
     */
    /*
     * ══ TICKET 28b (Henry, 2026-09-25) — **BACK TO THE AUTHORED TIDAL SURGE TRIO.** ══
     *
     * `jormungandr_v1 + kraken_v2 + skoll_v2`, which is the composition the long docblock at the
     * head of this entry describes and ticket 74 ruled. 28a's `kraken_v1 + ratatoskr_v1` is
     * withdrawn on the same ruling that moved Emberfall: Water beats Fire, so the guest is Fire —
     * `skoll_v2` — and `ratatoskr_v1` was Nature, the element that beats Water.
     *
     * **This drops the two-engine pair for the second time, and this time deliberately rather than
     * as a side effect.** 74 removed `kraken_v1` because the trio was two card-count-and-draw
     * engines plus a closer and research/73 measured that at 30.0% against a ~84.3% guide; 28a put
     * it back on a synergy argument and the canary immediately read the boss at 33% → 100% against
     * its own named counter party. The test that asserted the RETURN of that shape goes with it.
     *
     * **`skoll_v2` IS FIELDED AT TWO GYMS, AND HENRY RULED THAT ALLOWED (2026-09-25):** *"Skoll can
     * be at two gyms."* Ticket 74's docblock above says the opposite in as many words — *"Skoll
     * fields v1 at Emberfall and v2 here on purpose; leaders build differently, and the same OS at
     * two gyms would make the roster read as a pool"* — and 28a settled Rootfall's third slot
     * partly on that principle. **74's line is superseded for this case.** There is no second Fire
     * firmware the element rule allows at Tidewrack, and the element rule is the one that decides
     * the guest. `pathAndScout.test.ts` pins it as exactly one duplicate, named, so the ruling
     * cannot quietly widen into a roster that repeats itself.
     *
     * Intended counter, for the gate's record: **Nature**.
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
    /*
     * TICKET 28a changes ONE body — `ratatoskr_v1` (GOSSIP_NODE) becomes `ratatoskr_v2`
     * (INSTIGATOR_OS) — which tightens the fight around the poison rather than re-composing it.
     *
     * The old third slot was party-wide 0-cost sustain: a different plan bolted to the poison one.
     * `ratatoskr_v2` banks Dazed off the same 0-cost casts, and Dazed is +power on every one of
     * jormungandr_v2's three flurry hits — `osGrammar`'s own line (*"Dazed on the target adds to
     * every one of the flurry's hits"*) — while huldra_v2's Bark→Poison feeds TOXIN_FANG from the
     * other side. One plan, three bodies. It also settles the note 72 left: GOSSIP_NODE now appears
     * at no gym, so no OS is fielded twice across the three.
     *
     * 72's intended counter stands: **Fire** by type, plus ticket 69's cleanse toolbox.
     */
    /*
     * TICKET 28b leaves Rootfall exactly as 28a composed it, and that is the ruling agreeing with
     * the table rather than the table escaping the ruling: Nature beats Water, and the guest is
     * `jormungandr_v2` — Water. It was already the shape the new heuristic asks for.
     *
     * 72's intended counter stands: **Fire**.
     */
    gym_rootfall: {
        members: [
            { species: 'huldra', os: 'huldra_v2' },
            { species: 'ratatoskr', os: 'ratatoskr_v2' },
            { species: 'jormungandr', os: 'jormungandr_v2' },
        ],
        driver: DRIVER_ROOT_ROT,
    },
};

/** The authored boss for a gym, or undefined where ticket 18's formula still stands (ruling 6). */
export function authoredBossFor(gymId: string): IAuthoredBoss | undefined {
    return AUTHORED_BOSSES[gymId];
}
