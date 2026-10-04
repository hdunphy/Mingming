/**
 * TICKET 185e — **THE CURRENCIES A PARTY'S FIRMWARE RUN ON.**
 *
 * Ticket 158-r1 put each firmware's currency in the registry (`OS_GRAMMAR`: fenrir_v1 is
 * `Strength · HP`, skoll_v1 is `Strength`, kraken_v1 banks `cards` and pays in `Dazed`). A party's
 * currencies are the union over its members. A member with no firmware, or one the grammar table
 * does not cover (a post-launch species), contributes nothing rather than guessing.
 *
 * One job: a party in, a set of currency names out.
 */
import { grammarFor } from '../data/osGrammar';

export function partyCurrencies(party: ReadonlyArray<{ readonly activeOS?: string }>): ReadonlySet<string> {
    const currencies = new Set<string>();
    for (const member of party) {
        if (!member.activeOS) continue;
        for (const currency of grammarFor(member.activeOS)?.currency ?? []) currencies.add(currency);
    }
    return currencies;
}
