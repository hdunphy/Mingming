/**
 * TICKET 182c — WHICH BIOME THE INTRO PLAYS IN.
 *
 * The biome whose element the starter's element BEATS: the biome element `B` where
 * `COUNTERED_BY[B]` is the starter's element (Fire > Nature > Water > Fire). Kraken (Water) plays in
 * the Fire biome, Fenrir (Fire) in Nature, Ratatoskr (Nature) in Water. It is the "new players
 * usually win" lever, and it changes no number.
 *
 * The biome is taken from the ordinary gym offer for that element (`offerGyms`), so the intro's name
 * and species pool are the real ones and nothing here is invented data. The run's `gymId` is that
 * gym's, which keeps every lookup that wants a gym (the summary's title, the gate's header) working.
 */

import type { IBiome } from '../../runTypes';
import { COUNTERED_BY, offerGyms } from '../gyms';
import type { IGymOffer } from '../gyms';

/** The element of the biome a starter of `starterElement` plays its intro in. */
export function introBiomeElement(starterElement: string): string {
    const found = Object.keys(COUNTERED_BY).find((element) => COUNTERED_BY[element] === starterElement);
    if (!found) throw new Error(`introBiomeElement: no biome element is beaten by "${starterElement}"`);
    return found;
}

/**
 * The offer the intro run is built from: the gym of the intro biome's element, with that biome
 * FIRST. The run schema wants three biomes; only the first is walked, and the other two are the
 * same offer's own, so nothing in them is made up.
 */
export function introOffer(seed: string, starterElement: string): IGymOffer {
    const element = introBiomeElement(starterElement);
    const offer = offerGyms(`${seed}:gyms`).find((candidate) => candidate.gym.element === element);
    if (!offer) throw new Error(`introOffer: no gym has the element "${element}"`);
    // `offerGyms` walks [the biome the gym's element loses to, the gym's own biome, the approach].
    // The gym's own biome is the one whose element is `element`.
    const own = offer.biomes.find((biome) => biome.elements.length === 1 && biome.elements[0] === element);
    if (!own) throw new Error(`introOffer: the "${element}" gym has no "${element}" biome`);
    const rest: IBiome[] = offer.biomes.filter((biome) => biome !== own);
    return { gym: offer.gym, biomes: [own, ...rest] };
}
