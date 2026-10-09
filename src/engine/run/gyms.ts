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
import { MingmingRegistry } from '../data/mingmingRegistry';
import { authoredBossFor } from './bosses';

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
    /*
     * TICKET 28a (Henry, 2026-09-24) — `leaderComp` IS GONE FROM THIS INTERFACE.
     *
     * 142b put three firmware ids here as an explicit placeholder and said so: *"ticket 28 should
     * overwrite these with the authored teams."* It never did, so the game carried TWO gym comp
     * tables that disagreed at every gym — `bosses.AUTHORED_BOSSES` is what the gauntlet fields, and
     * this is what the scout previewed. A free look at a team the gym does not field is worse than
     * no free look: the player has no reason to distrust it.
     *
     * The authored table is the only one now. `gymCompElementPlan` below reads it, and so does
     * `encounter.scoutFirmwareFor`.
     */
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
export const COUNTERED_BY: Readonly<Record<string, string>> = {
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
 * stays a 1-or-2 list because ticket 05 defers friendly pairs rather than cancelling them. Two
 * callers now spend that headroom: the approach biome (142 §7) and, since ticket 209 (Henry,
 * 2026-10-08), the middle biome of every road — see `walkOrderFor`.
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
 * TICKET 142a — THE PATH ELEMENTS: what beats the gym, then the gym's own. Rootfall: Fire, Nature.
 *
 * These are the elements the ROAD fields at a `rival` node, and the ticket-141 gym check is why
 * they are this pair: Fire×2 + Nature beats the Nature gym 75% of the time, so a Rootfall run needs
 * one more Fire body and one Nature body off the road. The biome the player is standing in decides
 * what they can recruit, so without rivals the map dictates the order — Nature bridge first, then
 * carry it through the Fire biome at a disadvantage, or bench it. That is the complaint.
 *
 * **A FUNCTION, NOT A STORED FIELD, and this is a deliberate deviation from the ticket.** §3 asks
 * for `pathElements` on `IGymOffer` and reads `run.pathElements` in `encounterSpeciesPool`. Both
 * are fully determined by the gym, so storing them means two copies that can disagree with
 * `gymId` — and on the run state it means a save field, which save v4 has no migration path for
 * (ticket 06): a pre-142 run would resume with the field absent and need a default that is either
 * wrong or this derivation anyway. Deriving costs one call at each site, keeps one source of truth,
 * and makes rivals work in a run that was saved before this shipped. The offer screen calls it with
 * `offer.gym.element`; `encounterSpeciesPool` calls it with the run's gym.
 */
export function pathElementsFor(gymElement: string): ReadonlyArray<string> {
    return [COUNTERED_BY[gymElement], gymElement];
}

/**
 * THE WALK ORDER — ticket 209 (Henry, 2026-10-08): **the beaten element first, then the starter's
 * own element with it, then the gym's ground.**
 *
 * Each entry is one biome's elements; the third leg (the approach) is built from the leader's comp
 * by `gymBiomeElements` and is not part of this list. With `G` the gym's element and `C` the element
 * that beats it (`COUNTERED_BY[G]`, the starter the offer invites):
 *
 * | | biome 1 | biome 2 | biome 3 (approach) |
 * | --- | --- | --- | --- |
 * | **Rootfall** (Nature), a Fire starter | Nature — *you win* | Fire + Nature | Nature + Water |
 * | **Emberfall** (Fire), a Water starter | Fire — *you win* | Water + Fire | Fire + Nature |
 * | **Tidewrack** (Water), a Nature starter | Water — *you win* | Nature + Water | Water + Fire |
 *
 * # WHY, IN HENRY'S WORDS
 *
 * > *"if you choose fire, you start going against grass, which should also help those other v1
 * > decks losing in biome 1. Then biome 2 would be your element plus where you're starting
 * > against, so fire and nature. Then the last matches the gym, so nature and water. That might
 * > smooth out the difficulty curve."* … *"I think the biome order makes the most sense. Just make
 * > this the default but gate closing the ticket on a play test."*
 *
 * Measured before the ruling (the 2026-10-07 run gate, bare start kits, 1v1): wild fights in the
 * first biome went from 89.3% to 99.5% across the twelve starters, and the first elite from 51.9%
 * to 77.5%. Every starter clears the 85% wild rule; jormungandr_v1 went from 29.7% to 97.2%.
 *
 * # WHAT IT REPLACES, AND THE COST KEPT IN VIEW
 *
 * The 2026-09-11 road (142 §7) was `[C, G, approach]`: the starter's own element first (mirror
 * fights), then the gym's. Henry chose that so a recruit made in biome 1 was not wiped by a biome 2
 * of the starter's own element (*"you're a fire starter and you go against grass first. [You]
 * recruit a rat going to biome 2. You face all fire and that wipes out your rat"*). The compromise
 * halves that risk rather than removing it: biome 2 is now half the starter's element, not all of
 * it. Ticket 209b measures how often a biome 1 recruit is downed in biome 2, and 209 stays open
 * until a playtest signs the road off.
 *
 * Still fully determined by the gym, so nothing is rolled, and rule 2 (three different openings)
 * still holds by identity: each offer opens on its own gym's element.
 */
function walkOrderFor(gymElement: string): ReadonlyArray<ReadonlyArray<string>> {
    return [[gymElement], [COUNTERED_BY[gymElement], gymElement]];
}

/**
 * THE GYM BIOME — the third leg, and the only one that is not an element.
 *
 * Ticket 142 §7 (Henry, 2026-09-11), off the 09-10 playtest: *"the current road is not fun"*, and
 * the fix is the alternative he recorded in §5 — *"Fire starter vs Fire biome, you recruit Sköll;
 * then go to Nature biome where you recruit Rat; finally you go to the Gym biome which is NNW
 * encounters but weaker until you face the final gym."*
 *
 * So the last biome is built from the LEADER'S COMP rather than from the counter chain. Its
 * elements are the distinct elements that comp fields — Rootfall's `[kraken, ratatoskr, huldra]`
 * is Water + Nature — which is what `IBiome.elements`' 1-or-2 shape was left open for (ticket 05
 * deferred friendly pairs rather than cancelling them, and this is the first caller to need one).
 *
 * **The triangle is no longer walked, and that is the ruling, not an oversight.** The old rule 3
 * guaranteed every run saw all three launch elements; Rootfall now goes Fire → Nature → Nature+
 * Water and never stands in a Water biome, so kraken and jormungandr are not recruitable on that
 * route. Henry accepted that cost explicitly: *"It's fine if there are no Water mingmings in
 * there."* What is bought with it is a road that reads as a road — you meet what beats the gym,
 * then the gym's own element, then the fight itself in miniature.
 */
/**
 * The species behind one `leaderComp` entry.
 *
 * **`leaderComp` holds FIRMWARE ids, not species ids** - `kraken_v1` is kraken running its v1 OS,
 * and `MingmingRegistry['kraken_v1']` is not a thing. That is the trap this function closes.
 *
 * `GetMingmingData` does NOT return undefined for a bad id: it logs `Mingming ID not found` and
 * returns the **Missing Mingming sentinel**, whose `primaryElement` is `'None'`. So the first
 * version of `gymBiomeElements` did not get nothing - it got a perfectly well-formed `'None'`,
 * built a biome advertising an element no pool contains, and the failure surfaced three files away
 * as a run reading the wall clock. The warning WAS printed, nine times, in the test output; it
 * read as noise next to a failing assertion about a clock.
 *
 * That is the shape worth remembering: the sentinel keeps a bad id from throwing, which means a
 * bad id TRAVELS. Resolve firmware ids here, where the lookup can return undefined and a caller
 * has to decide what that means.
 */
/**
 * TICKET 28a — **the firmware a gym's leader actually fields**, from the authored table.
 *
 * One accessor rather than three reads of `AUTHORED_BOSSES.members`, because the three consumers —
 * the biome element plan below, the scout's preview, and 157's walker when it recruits toward the
 * gym — have to agree, and the way two tables came to disagree in the first place was that each
 * consumer read whichever one was nearest.
 *
 * Returns `[]` for a gym with no authored boss, which is ticket 18's formula-boss case: the biome
 * plan then falls back to the gym's own element and the scout shows nothing, both of which are what
 * they did before an authored table existed.
 */
export function gymLeaderFirmware(gymId: string): ReadonlyArray<string> {
    return authoredBossFor(gymId)?.members.map((member) => member.os) ?? [];
}

export function speciesOwningFirmware(firmwareId: string): string | undefined {
    return Object.values(MingmingRegistry)
        .find((definition) => definition.availableOS.includes(firmwareId))?.id;
}

/**
 * The comp's elements ONE PER BODY, gym element first.
 *
 * RULED by Henry, 2026-09-11: *"it should be NNW decks so the last spot is a water mingming
 * (either jorm or kraken). So you only see the water in 3v3s — the first two are one of the four
 * nature decks. If it's a 1v1 or 2v2 it would be a single N then two N's respectively."*
 *
 * So this keeps MULTIPLICITY and ORDER, and both carry meaning. Rootfall's comp is stored
 * `[kraken(W), ratatoskr(N), huldra(N)]`; sorted gym-element-first it is **N, N, W**, and slicing
 * that to the party size gives exactly the three cases he named. The off-element body is last
 * because it is the one a smaller party never meets - put it first and a solo run would fight the
 * Water one and never see the gym's own element on the gym's own approach.
 *
 * **Elements, not the comp's own species.** The bodies are *"one of the four nature decks"*, not
 * ratatoskr and huldra specifically: the approach biome is the gym's SHAPE, and a biome that only
 * ever fielded the three exact bodies would be the gym fight three times over rather than a
 * region that reads like it.
 */
export function gymCompElementPlan(gym: IGym): ReadonlyArray<string> {
    const perBody: string[] = [];
    // TICKET 28a: the ONE comp table. This used to read `gym.leaderComp`, a 142b placeholder that
    // disagreed with what the gauntlet fields at every gym.
    for (const firmware of gymLeaderFirmware(gym.id)) {
        const speciesId = speciesOwningFirmware(firmware);
        const element = speciesId ? MingmingRegistry[speciesId]?.primaryElement : undefined;
        if (element) perBody.push(element);
    }
    return perBody.sort((a, b) => Number(b === gym.element) - Number(a === gym.element));
}

/** The distinct elements of the above — what `IBiome.elements` advertises for the approach. */
function gymBiomeElements(gym: IGym): ReadonlyArray<string> {
    const elements: string[] = [];
    for (const element of gymCompElementPlan(gym)) {
        if (!elements.includes(element)) elements.push(element);
    }
    return elements;
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
 * 4. **The road is the gym's element, then the starter's element with it, then the approach.**
 *    Ticket 209 (Henry, 2026-10-08) — see `walkOrderFor` for the reasoning and for what it costs.
 *    It replaces 142 §7's `[counter, gym, approach]`, which opened on the starter's own element.
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
            biomes: [
                ...walkOrder.map((elements): IBiome => {
                    // Named from the biome's FIRST element: biome 1 is the gym's ground, and biome 2
                    // leads with the starter's element, the one the road has not shown yet. One draw
                    // per biome either way, as before.
                    const candidates = BIOME_POOL[elements[0]];
                    const template = candidates[stream.nextInt(0, candidates.length - 1)];
                    return { id: template.id, name: template.name, elements: [...elements] };
                }),
                // 142 §7: the third leg is the leader's own ground - see `gymBiomeElements`. It
                // draws its NAME from the gym's element pool like any other biome, so the place
                // still reads as somewhere you go rather than as `Gym Biome`.
                ((): IBiome => {
                    const candidates = BIOME_POOL[gym.element];
                    const template = candidates[stream.nextInt(0, candidates.length - 1)];
                    return {
                        id: `${template.id}_approach`,
                        name: `${template.name} Approach`,
                        elements: [...gymBiomeElements(gym)],
                    };
                })(),
            ],
        };
    });
}
