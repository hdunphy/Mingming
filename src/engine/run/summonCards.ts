/**
 * TICKET 195d — THE SUMMON OPTION SAYS HOW MANY CARDS IT ADDS.
 *
 * Three of the five runs that summoned a second body were caught off guard when the deck jumped (14 to 24
 * for two bodies): the engine a body brings is minted into the deck, and nothing on the Den's screen said
 * so. A careful player may refuse to summon to protect a lean deck, so the option now says it.
 *
 * The count is the length of `engineIdsForSpecies`, the same list the Den prints as "its engine" and the
 * same `startKitIdsFor` read that `planRecruit` mints the cards from, so the line and the delivery cannot
 * drift (`summonCards.test.ts` holds that by assembling and counting). A body summoned into the party
 * brings its cards to the deck; summoned onto the bench they go to the run's collection.
 */
import { engineIdsForSpecies } from './workshop';

/** Where the cards of a summon land: the deck (a body in the party) or the collection (a body on the bench). */
export type SummonCardsDestination = 'deck' | 'collection';

/** How many cards summoning this species on this firmware adds. */
export const summonCardCount = (speciesId: string, osId?: string): number => engineIdsForSpecies(speciesId, osId).length;

/** The line the Den prints: "+5 cards to your deck". */
export const summonCardsText = (count: number, to: SummonCardsDestination = 'deck'): string =>
    `+${count} ${count === 1 ? 'card' : 'cards'} to your ${to}`;
