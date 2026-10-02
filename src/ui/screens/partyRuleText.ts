/**
 * TICKET 171d — **the party rules, in one place, in the words the screens print.**
 *
 * Three screens described the party, and all three had drifted from the code:
 *
 * - RunStart said *"one per species. Each brings 8 cards — 5 from its kit and 3 generics"*. Only the
 *   FIRST member brings the generics (`STARTER_GENERICS`, Henry 2026-08-26: *"a RECRUIT brings ONLY
 *   its 5 engine cards"*), so a party of three starts at 18, not 24.
 * - RunStart, RanchScreen and the Workshop hint all said one per SPECIES. The rule is one per
 *   species AND firmware (`partyBlockFor`, Henry 2026-09-05): a second Kraken on another OS is legal.
 *
 * Henry flagged the RunStart line in the 2026-09-29 playtest (*"The intro text doesn't make sense
 * anymore"*). Built from the same constants the rules are, so the next change to either moves both.
 */

import { START_KIT_SIZE, STARTER_GENERICS } from '../../engine/run/createRun';
import { PARTY_SIZE } from '../../engine/party';

/** The duplicate rule, as a clause. */
export const DUPLICATE_RULE = 'the same species twice only on different firmware';

/** RunStart's line under the roster. */
export const RUN_START_PARTY_TEXT =
    `Up to ${PARTY_SIZE} members — ${DUPLICATE_RULE}. Each brings its ${START_KIT_SIZE}-card kit, `
    + `the first also brings ${STARTER_GENERICS} generic hits, and the whole party's cards form one shared deck.`;

/** RanchScreen's clause about choosing the party. */
export const RANCH_PARTY_CLAUSE = `up to ${PARTY_SIZE}, ${DUPLICATE_RULE}`;

/** The Workshop foot hint's clause. */
export const WORKSHOP_DUPLICATE_CLAUSE = `No two members of the same species on the same firmware, across party and bench.`;
