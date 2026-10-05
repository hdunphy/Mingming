/**
 * TICKET 195k — THE GYM A STARTER PLAYS: the one whose element the starter's element beats.
 *
 * Fire plays Rootfall (Nature), Water plays Emberfall (Fire), Nature plays Tidewrack (Water). The
 * starter's element is read from the species registry. Which gym is that on a given seed is an index
 * into that seed's own offer, because `offerGyms` orders its three leaders differently for every seed.
 */
import { MingmingRegistry } from '../../../engine/data/mingmingRegistry';
import { COUNTERED_BY, offerGyms, speciesOwningFirmware } from '../../../engine/run/gyms';
import { gymOfferSeed } from '../gymOfferSeed';

/** The gym element a starter's element beats: the one `COUNTERED_BY` says that element counters. */
function gymElementBeatenBy(starterElement: string): string {
    const found = Object.entries(COUNTERED_BY).find(([, counter]) => counter === starterElement)?.[0];
    if (found === undefined) throw new Error(`no launch gym has an element that ${starterElement} beats`);
    return found;
}

/** The index in `offerGyms(seed)` of the gym this starter's element beats. */
export function gymFor(seed: string, starter: string): number {
    const species = speciesOwningFirmware(starter);
    if (!species) throw new Error(`no species owns the instinct "${starter}"`);
    const element = gymElementBeatenBy(MingmingRegistry[species].primaryElement);
    const index = offerGyms(gymOfferSeed(seed)).findIndex((offer) => offer.gym.element === element);
    if (index < 0) throw new Error(`the gym offer for ${seed} has no ${element} gym`);
    return index;
}
