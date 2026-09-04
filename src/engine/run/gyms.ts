/**
 * GYM REGISTRY AND THE RUN-START OFFER — ticket 09's half of run creation.
 *
 * `exploration-map.md` opens a run by offering the player a choice of gyms, each one fronting a
 * three-biome region you walk to reach its leader. This module owns both halves of that screen: the
 * (placeholder) leaders themselves, and the seeded generator that turns three leaders into three
 * offers the player picks between.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()` — everything procedural threads through `SeedStream` so an offer screen replays
 * identically from its seed.
 */

import { SeedStream } from '../core/SeedStream';
import type { IBiome } from '../runTypes';

// ---------------------------------------------------------------------------------------------
// The leaders
// ---------------------------------------------------------------------------------------------

export interface IGym {
    readonly id: string;
    readonly name: string;
    /** 'Fire' | 'Water' | 'Nature' at Early Access — see `LAUNCH_ELEMENTS`. */
    readonly element: string;
    /** Difficulty, 0-based. `IRunState.tier` is copied from here at run start. */
    readonly tier: number;
}

/**
 * **THESE THREE ARE PLACEHOLDERS. [Ticket 28](../../../docs/wayfinder/steam-release/tickets/28-gym-leaders.md)
 * OWNS THE REAL ONES.**
 *
 * [Ticket 05](../../../docs/wayfinder/steam-release/tickets/05-release-shape.md) ruled that Early
 * Access ships **three authored gym leaders**, one per launch element, and ticket 28 is the ticket
 * that authors them — their teams, their dialogue, their names. Nothing here is a naming decision
 * anyone has made.
 *
 * What is real, and the reason this file exists ahead of ticket 28, is the **ids**. The run loop
 * (ticket 09's `createRun`, ticket 10's map screen, the ranch's `gymsCleared` list) needs a stable
 * `gymId` to key off long before anyone writes a leader's dialogue, and inventing those ids inside
 * the run loop would mean rewriting every consumer when ticket 28 lands. Ticket 28 should rewrite
 * `name` (and add whatever team/dialogue fields it needs) while leaving `id`, `element` and `tier`
 * alone.
 *
 * All three are `tier: 0`: ticket 05 ships one tier at launch, and
 * `exploration-map.md`'s "harder tiers unlock by beating gyms" is post-launch content.
 */
export const GYM_REGISTRY: Readonly<Record<string, IGym>> = {
    gym_emberfall: { id: 'gym_emberfall', name: 'Emberfall', element: 'Fire', tier: 0 },
    gym_tidewrack: { id: 'gym_tidewrack', name: 'Tidewrack', element: 'Water', tier: 0 },
    gym_rootfall: { id: 'gym_rootfall', name: 'Rootfall', element: 'Nature', tier: 0 },
};

/**
 * Ticket 05's Early Access element set, in the order the counter cycle runs: **Fire > Nature >
 * Water > Fire**. Three elements taken in pairs is a *pure* counter cycle — every element has
 * exactly one it beats and one that beats it, and nothing sits outside the triangle. `offerGyms`
 * leans on that property directly (see `COUNTERED_BY` below), so this is ordering information, not
 * just a list.
 */
export const LAUNCH_ELEMENTS: ReadonlyArray<string> = ['Fire', 'Water', 'Nature'];

/**
 * `COUNTERED_BY[e]` is the element that beats `e` — the inverse of the engine's `BEATS` cycle
 * (Fire > Nature > Water > Fire), which is where the *combat* multiplier lives.
 *
 * Only the inverse direction is needed here: `walkOrderFor` steps along it to build a region, and
 * a local forward table would be dead weight. If the triangle ever changes, this is the second
 * place it has to change.
 */
const COUNTERED_BY: Readonly<Record<string, string>> = {
    Nature: 'Fire',
    Water: 'Nature',
    Fire: 'Water',
};

// ---------------------------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------------------------

/**
 * **Mono-element at Early Access**, per ticket 05 (Henry, 2026-08-21), which amends
 * `exploration-map.md`'s "each biome mixes two elements". Inside a pure counter cycle every
 * possible pairing is a *counter* pair, so a Fire/Water biome is a biome your Fire starter is
 * simultaneously strong and weak in — noise rather than a routing decision. `IBiome.elements`
 * stays a 1-or-2 list because ticket 05 defers friendly pairs rather than cancelling them; this
 * module only ever emits length 1.
 *
 * **Why named places rather than "Fire Biome".** The elements are already carried in
 * `IBiome.elements` and ticket 10's map screen reads them from there, so the `name` field is free
 * to be flavour — and a region called the Slagfields reads like somewhere you go, which is the
 * whole pitch of `exploration-map.md`'s explorable region. Three candidates per element then buy
 * the offer screen its only remaining variance: once rule 4 below pins the *element ordering* of
 * an offer to one of two possibilities, two runs would otherwise show a literally identical set of
 * three offers. Different names on the same elements keep each seed's offer screen its own place
 * without touching a single mechanical property.
 *
 * Ids are stable and readable so a save can be eyeballed; they are not derived from the name at
 * runtime, because renaming a biome for flavour must not silently change a persisted id.
 */
interface IBiomeTemplate {
    readonly id: string;
    readonly name: string;
}

const BIOME_POOL: Readonly<Record<string, ReadonlyArray<IBiomeTemplate>>> = {
    Fire: [
        { id: 'biome_cinderreach', name: 'Cinderreach' },
        { id: 'biome_slagfields', name: 'The Slagfields' },
        { id: 'biome_emberglass', name: 'Emberglass Flats' },
    ],
    Water: [
        { id: 'biome_drowned_shelf', name: 'The Drowned Shelf' },
        { id: 'biome_brinehollow', name: 'Brinehollow' },
        { id: 'biome_saltmarch', name: 'The Saltmarch' },
    ],
    Nature: [
        { id: 'biome_thornwild', name: 'The Thornwild' },
        { id: 'biome_rootmire', name: 'Rootmire' },
        { id: 'biome_verdant_sprawl', name: 'Verdant Sprawl' },
    ],
};

// ---------------------------------------------------------------------------------------------
// The offer
// ---------------------------------------------------------------------------------------------

export interface IGymOffer {
    readonly gym: IGym;
    /**
     * Exactly three, in walk order: `biomes[0]` is where the run starts and `biomes[2]` is the last
     * one you cross before the leader.
     *
     * **`biomes[2]` is NOT the gym's element** — since Henry's 2026-08-30 ruling `biomes[0]` is.
     * Read the leader's element off `gym.element`; anything deriving it from a biome index is
     * reading the element the leader *beats*, and will do so silently.
     */
    readonly biomes: ReadonlyArray<IBiome>;
}

/**
 * THE WALK ORDER — Henry's ruling, 2026-08-30, and it inverts what rule 4 used to say.
 *
 * The order is **[the gym's own element, the element that beats it, the element that beats THAT]**
 * — three steps along `COUNTERED_BY` starting from the leader. It is fully determined by the gym,
 * so there is nothing to roll.
 *
 * # WHY, IN HENRY'S WORDS
 *
 * > *"you ideally come with the advantage starter type and want an easy start… it felt bad to go
 * > after the water boss with a nature mingming and get wiped in biome 1 by fire, or have to build
 * > up your blueprints in one boss just to lose them come to the boss you want to battle."*
 *
 * The party is chosen AFTER the gym, so a player picking Tidewrack picks Nature — the counter to
 * Water. That choice then has to survive three biomes, and under the old ordering it could meet its
 * own predator immediately. Walking the counter-chain makes the run a clean ramp for the team the
 * offer invites you to bring:
 *
 * | | biome 1 | biome 2 | biome 3 | the gym |
 * | --- | --- | --- | --- | --- |
 * | **Tidewrack** (Water) | Water — *you win* | Nature — neutral | Fire — *you lose* | Water — you win |
 * | **Emberfall** (Fire) | Fire — *you win* | Water — neutral | Nature — *you lose* | Fire — you win |
 * | **Rootfall** (Nature) | Nature — *you win* | Fire — neutral | Water — *you lose* | Nature — you win |
 *
 * Easy opening, neutral middle, hardest biome last — and the boss on the far side of it is the one
 * you built for. The difficulty curve now runs the right way round for the whole run instead of
 * being decided by which direction the offer screen happened to roll.
 *
 * # WHAT THIS COSTS, STATED PLAINLY
 *
 * **The gym no longer stands in a biome of its own element** — Tidewrack's Water leader is fought
 * at the end of a *Fire* biome. That was rule 4's entire argument, and rule 4 was explicitly *"a
 * reading, not a ruling — it should be confirmed"*. It has now been confirmed the other way. Henry:
 * *"it doesn't work thematically."* Ruled anyway, because the thing it fixes is a player losing a
 * run to the map's ordering rather than to a fight.
 *
 * # AND WHAT IT SIMPLIFIES
 *
 * The old `OfferDirection` roll is **gone**. It existed to satisfy rule 2 — the three offers must
 * open on three different elements — which needed a derangement, of which there are exactly two,
 * so one direction was rolled per screen and shared by all three offers. Opening each offer on its
 * own gym element satisfies rule 2 *by identity*: three gyms, three elements, three openings. One
 * less rolled quantity, and one less way for the screen to be subtly wrong.
 */
function walkOrderFor(gymElement: string): ReadonlyArray<string> {
    const counter = COUNTERED_BY[gymElement];
    return [gymElement, counter, COUNTERED_BY[counter]];
}

/**
 * Generate the three gyms offered at run start, with the region each one fronts.
 *
 * Deterministic in `seed` alone. The rules the result satisfies, and where each comes from:
 *
 * 1. **Exactly three offers** — ticket 05 ships three leaders, and all three are always on the
 *    table at launch because there is nothing yet to unlock.
 * 2. **The three offers open on three DIFFERENT biome elements.** Ticket 07's one generator
 *    guarantee, and it is load-bearing: the party is chosen *after* the gym, so the player can
 *    always answer the opening biome with a starter that counters it — but only if the three offers
 *    actually present three different openings. Since Henry's 2026-08-30 ruling each offer opens on
 *    its OWN gym element, so this holds by identity rather than by a shared rolled direction.
 * 3. **Each offer walks all three launch elements**, in some order. A run is three biomes
 *    (`exploration-map.md`) and Early Access has three elements, so a region is a permutation of
 *    the launch set rather than a sample from it — every run sees the whole triangle, which is what
 *    makes a two- or three-member party a real construction problem instead of a mono-element pick.
 * 4. **The gym's own element is the FIRST biome, and the walk follows the counter-chain.**
 *    Henry's ruling, 2026-08-30 — see `walkOrderFor` for the reasoning and for what it costs. This
 *    REPLACES the previous rule 4 (*"the gym's own element is the LAST biome"*), which that
 *    comment flagged as *"a reading, not a ruling — it should be confirmed"*. It was confirmed the
 *    other way.
 * 5. **Deterministic in `seed`** — same seed, same screen, which is what lets an offer be shown,
 *    saved, and shown again after an app close.
 */
export function offerGyms(seed: string): ReadonlyArray<IGymOffer> {
    // Fork rather than consuming the run seed directly, matching `generateRegionGraph`: other
    // subsystems draw from this same `seed`, and an unlabelled draw would hand two of them the
    // identical number sequence.
    const stream = new SeedStream(new SeedStream(seed).fork('gym-offers'));

    // Presentation order only. All three leaders are always offered (rule 1), so this shuffles
    // which one sits leftmost rather than which ones appear.
    const gyms = stream.shuffle(Object.values(GYM_REGISTRY));

    return gyms.map((gym): IGymOffer => {
        // Fully determined by the leader — see `walkOrderFor`. Nothing is rolled here.
        const walkOrder = walkOrderFor(gym.element);

        return {
            gym,
            biomes: walkOrder.map((element): IBiome => {
                const candidates = BIOME_POOL[element];
                const template = candidates[stream.nextInt(0, candidates.length - 1)];
                // Mono-element by ticket 05; the list shape is what lets friendly pairs return
                // later without a save migration (`runTypes.ts`, `IBiome`).
                return { id: template.id, name: template.name, elements: [element] };
            }),
        };
    });
}
