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

/** `beats[e]` is the element `e` is strong against. Fire > Nature > Water > Fire. */
const BEATS: Readonly<Record<string, string>> = {
    Fire: 'Nature',
    Nature: 'Water',
    Water: 'Fire',
};

/** `COUNTERED_BY[e]` is the element that beats `e` — the inverse of `BEATS`. */
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
    /** Exactly three, in walk order: `biomes[0]` is where the run starts, `biomes[2]` holds the gym. */
    readonly biomes: ReadonlyArray<IBiome>;
}

/**
 * The two orderings an offer's biomes can take, and **the only two**.
 *
 * Rule 4 (see `offerGyms`) puts the gym's own element last, so an offer's opening biome is one of
 * the other two elements — never the gym's own. Rule 2 says the three offers must open on three
 * *different* elements. An assignment of "opening element" to "gym element" that is both a bijection
 * over the three elements and never maps an element to itself is exactly a **derangement of three
 * items**, and there are precisely two of those: the two 3-cycles. In counter-cycle terms they are
 * "the gym opens on what it beats" and "the gym opens on what beats it".
 *
 * That is why the direction is rolled **once per offer screen and applied to all three offers**,
 * rather than rolled per offer. Rolling per offer would produce a valid screen only sometimes (six
 * of the eight combinations collide on an opening element), and the alternatives — reroll until it
 * passes, or patch up a collision — are both a hidden rule of the kind ticket 05 was trying to
 * avoid. One shared direction makes rule 2 true by construction.
 */
type OfferDirection = 'opens-on-prey' | 'opens-on-predator';

const OFFER_DIRECTIONS: ReadonlyArray<OfferDirection> = ['opens-on-prey', 'opens-on-predator'];

function openingElementFor(gymElement: string, direction: OfferDirection): string {
    return direction === 'opens-on-prey' ? BEATS[gymElement] : COUNTERED_BY[gymElement];
}

/**
 * Generate the three gyms offered at run start, with the region each one fronts.
 *
 * Deterministic in `seed` alone. The rules the result satisfies, and where each comes from:
 *
 * 1. **Exactly three offers** — ticket 05 ships three leaders, and all three are always on the
 *    table at launch because there is nothing yet to unlock.
 * 2. **The three offers open on three DIFFERENT biome elements.** This is the one generator
 *    guarantee ticket 07's resolution adds, and it is load-bearing: the party is chosen *after* the
 *    gym, so the player can always answer the opening biome with a starter that counters it — but
 *    only if the three offers actually present three different openings. Ticket 05's worry about
 *    unwinnable first-biome matchups is therefore solved by **ordering**, in the open, rather than
 *    by a hidden rule that quietly reshuffles a bad draw.
 * 3. **Each offer walks all three launch elements**, in some order. A run is three biomes
 *    (`exploration-map.md`) and Early Access has three elements, so a region is a permutation of
 *    the launch set rather than a sample from it — every run sees the whole triangle, which is what
 *    makes a two- or three-member party a real construction problem instead of a mono-element pick.
 * 4. **The gym's own element is the LAST biome.** *This is a reading, not a ruling — no ticket says
 *    it in so many words, and it should be confirmed.* The argument: the gym is the biome-3 exit
 *    node (ticket 07) and `runTypes.ts` calls the biome elements "the final exam's syllabus" whose
 *    gym "draws one member per biome". A Fire leader standing at the end of a Water biome would be
 *    a leader fought in someone else's region — incoherent both narratively and for a player
 *    reading the map to plan a team. Putting it last also means the element you are being tested on
 *    hardest is the one you have had the longest to prepare for.
 * 5. **Deterministic in `seed`** — same seed, same screen, which is what lets an offer be shown,
 *    saved, and shown again after an app close.
 */
export function offerGyms(seed: string): ReadonlyArray<IGymOffer> {
    // Fork rather than consuming the run seed directly, matching `generateRegionGraph`: other
    // subsystems draw from this same `seed`, and an unlabelled draw would hand two of them the
    // identical number sequence.
    const stream = new SeedStream(new SeedStream(seed).fork('gym-offers'));

    // One direction for the whole screen — see `OfferDirection` for why this cannot be per offer.
    const direction = OFFER_DIRECTIONS[stream.nextInt(0, OFFER_DIRECTIONS.length - 1)];

    // Presentation order only. All three leaders are always offered (rule 1), so this shuffles
    // which one sits leftmost rather than which ones appear.
    const gyms = stream.shuffle(Object.values(GYM_REGISTRY));

    return gyms.map((gym): IGymOffer => {
        const opening = openingElementFor(gym.element, direction);
        // With the opening and the last pinned, the middle biome is whatever element is left —
        // there is no choice to roll here, which is a consequence of rules 3 and 4 rather than a
        // decision this function makes.
        const middle = LAUNCH_ELEMENTS.find((e) => e !== opening && e !== gym.element)!;
        const walkOrder = [opening, middle, gym.element];

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
