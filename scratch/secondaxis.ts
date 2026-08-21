/**
 * Ticket 102's last gate: did making statuses real hand the 24 single-resource decks a second
 * resource for free?
 *
 * Ticket 99 found that Henry's three favourite decks all have a SECOND thing to spend besides
 * Energy, and the four he called boring have none - and that 24 of 32 decks are single-resource.
 * The thesis behind shipping POWER is that a duality pile you can build, hold and cash IS a second
 * resource, so most of that backlog gets fixed without a design pass.
 *
 * This is a structural read, not a sim: for every deck, how much of it touches the four duality
 * statuses, and how many stacks a full turn of it can mint. A deck with no duality cards did not
 * get a second resource out of this change, whatever its win rate did.
 */
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import type { ProgramData } from '../src/engine/types';

const DUALITY = new Set(['Strengthened', 'Weakened', 'Sharp', 'Dazed']);

/** Ticket 99's list: the eight decks that already had a second resource before this change. */
const HAD_SECOND_AXIS = new Set([
    'hel_v2', 'ymir_v2', 'fafnir_v1', 'hraesvelgr_v2',
    'audhumbla_v1', 'draugr_v1', 'hraesvelgr_v1', 'sleipnir_v2',
]);

function dualityStacks(card: ProgramData): number {
    let n = 0;
    for (const a of (card.actions ?? []) as Array<Record<string, unknown>>) {
        if (a.type === 'STATUS' && DUALITY.has(String(a.status))) n += Number(a.stacks ?? 0);
        // Riders and follow-ups hang off the same action shape.
        for (const key of ['then', 'rider', 'onHit']) {
            const sub = a[key] as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(sub))
                for (const s of sub)
                    if (s.type === 'STATUS' && DUALITY.has(String(s.status))) n += Number(s.stacks ?? 0);
        }
    }
    return n;
}

interface Row { deck: string; cards: number; dualityCards: number; stacks: number; had: boolean }
const rows: Row[] = [];
for (const species of BALANCE_SPECIES) {
    const entry = MingmingRegistry[species];
    for (const deck of entry.availableOS) {
        const list: string[] = (entry.decks as Record<string, string[]>)[deck] ?? [];
        let dualityCards = 0;
        let stacks = 0;
        for (const id of list) {
            const card = (ProgramRegistry as Record<string, ProgramData>)[id];
            if (!card) continue;
            const s = dualityStacks(card);
            if (s > 0) { dualityCards++; stacks += s; }
        }
        rows.push({ deck, cards: list.length, dualityCards, stacks, had: HAD_SECOND_AXIS.has(deck) });
    }
}

const backlog = rows.filter(r => !r.had);
const gained = backlog.filter(r => r.dualityCards > 0);
const stranded = backlog.filter(r => r.dualityCards === 0);

console.error(`\nSECOND-AXIS READ   ${rows.length} decks, ${backlog.length} in the single-resource backlog\n`);
console.error(`  backlog decks that touch a duality pile   ${gained.length} of ${backlog.length}` +
    `  (${((gained.length / backlog.length) * 100).toFixed(0)}%)`);
console.error(`  backlog decks with NO duality card at all  ${stranded.length}\n`);
console.error('STILL SINGLE-RESOURCE (the change did nothing for these):');
for (const r of stranded.sort((a, b) => a.deck.localeCompare(b.deck)))
    console.error(`  ${r.deck}`);
console.error('\nGAINED A PILE (cards granting duality stacks / deck size, total stacks per full deck):');
for (const r of gained.sort((a, b) => b.stacks - a.stacks))
    console.error(`  ${r.deck.padEnd(20)}${String(r.dualityCards).padStart(2)}/${r.cards}  ${String(r.stacks).padStart(3)} stacks`);
