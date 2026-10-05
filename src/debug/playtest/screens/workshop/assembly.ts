/**
 * TICKET 180b — THE WORKSHOP'S ASSEMBLY BAY.
 *
 * Blueprints held, and for each species every firmware it can be built on, the five-card engine
 * that firmware brings, and the price. The legality is the bay's own: `workshopBlockFor` (no
 * blueprint, this build already on the team) and `planRecruit`, which is null for anything illegal.
 * With a full party the way in is a swap, exactly as the bay asks "who steps off the field".
 *
 * Moves: `workshop:assemble:<species>:<os>:<party|bench|swap-<memberId>>`. The dispatch order is the
 * bay's: bench the one stepping off, `assembleMingming` (spends the blueprint, adds to the roster),
 * then `recruitIntoParty` or `recruitToBench` (spends the scrap, mints the cards).
 */
import { GetMingmingData } from '../../../../engine/data/mingmingRegistry';
import { PARTY_SIZE } from '../../../../engine/party';
import { recruitingBlocked } from '../../../../engine/run/modifiers/noRecruits';
import { shopPrice } from '../../../../engine/run/modifiers/shopPrice';
import {
    WORKSHOP_ASSEMBLY_SCRAP, engineIdsForSpecies, planRecruit, workshopBlockFor, workshopSpecies,
} from '../../../../engine/run/workshop';
import { summonCardCount, summonCardsText } from '../../../../engine/run/summonCards';
import { assembleMingming } from '../../../../ui/store/gameSlice';
import { benchPartyMember, recruitIntoParty, recruitToBench } from '../../../../ui/store/runSlice';
import { cardName, firmwareName, firmwareText, memberName, speciesName } from '../../gameText';
import { hereNode, priceNote, shortBy } from '../../stalls';
import type { Move, Section, World } from '../../types';
import { runOf } from '../../types';

type Destination = 'party' | 'bench' | { readonly swapOut: string };

const engineLine = (speciesId: string, osId: string): string => {
    const counted = new Map<string, number>();
    for (const id of engineIdsForSpecies(speciesId, osId)) counted.set(id, (counted.get(id) ?? 0) + 1);
    return [...counted.entries()].map(([id, n]) => `${cardName(id)}${n > 1 ? ` x${n}` : ''}`).join(', ');
};

/** Build one individual. Mirrors `WorkshopNode`'s `assemble`, plan check and all. */
function assemble(world: World, speciesId: string, osId: string, destination: Destination): void {
    const ranch = world.store.getState().game;
    const run = runOf(world);
    const swapOut = typeof destination === 'object' ? destination.swapOut : undefined;
    const runForPlan = swapOut ? { ...run, partyIds: run.partyIds.filter((id) => id !== swapOut) } : run;
    const plan = planRecruit({ ranch, run: runForPlan, node: hereNode(world), speciesId, osId });
    if (!plan || run.scrap < plan.scrap) { world.view.news.push('Nothing happened (summon).'); return; }

    if (swapOut) world.store.dispatch(benchPartyMember(swapOut));
    world.store.dispatch(assembleMingming(plan.member));
    if (!world.store.getState().game.roster.some((m) => m.id === plan.member.id)) {
        world.view.news.push('Nothing happened (summon).');
        return;
    }
    const recruit = { memberId: plan.member.id, cards: plan.cards, price: plan.scrap };
    world.store.dispatch(destination === 'bench' ? recruitToBench(recruit) : recruitIntoParty(recruit));
    world.view.news.push(`Summoned ${speciesName(speciesId)} on ${firmwareName(osId)}${destination === 'bench' ? ' (bench)' : ''}.`);
}

export function assemblySection(world: World): Section {
    const run = runOf(world);
    const ranch = world.store.getState().game;
    if (recruitingBlocked(run)) return { lines: ['TRACES: recruiting is switched off for this run.'], moves: [] };

    const price = shopPrice(run, WORKSHOP_ASSEMBLY_SCRAP);
    const partyFull = run.partyIds.length >= PARTY_SIZE;
    const lines = [`TRACES (a summon costs ${price} amber and one trace; party ${run.partyIds.length}/${PARTY_SIZE}):`];
    const moves: Move[] = [];

    for (const entry of workshopSpecies(ranch, run)) {
        lines.push(`  ${speciesName(entry.speciesId)} x${entry.blueprints}${entry.blueprints < 1 ? ' (none left)' : ''}`);
        if (entry.blueprints < 1) continue;
        for (const osId of GetMingmingData(entry.speciesId).availableOS) {
            const block = workshopBlockFor(entry.speciesId, ranch, run, osId);
            const base = `${speciesName(entry.speciesId)} on ${firmwareName(osId)}`;
            lines.push(`    ${firmwareName(osId)}: ${firmwareText(osId)}`);
            lines.push(`      engine: ${engineLine(entry.speciesId, osId)}${block === 'duplicate-build' ? ' [this build is already on the team]' : ''}`);
            // TICKET 195d: the deck grows by the engine's cards when a body joins the party; the line the game prints.
            const cards = summonCardCount(entry.speciesId, osId);
            if (block !== 'duplicate-build') lines.push(`      ${summonCardsText(cards)} (${summonCardsText(cards, 'collection')} if benched)`);
            if (block === 'duplicate-build') continue;
            if (shortBy(world, price) > 0) { lines.push(`      [${priceNote(world, price)}]`); continue; }

            const key = `workshop:assemble:${entry.speciesId}:${osId}`;
            const add = (suffix: string, label: string, destination: Destination): void => {
                const plan = planRecruit({
                    ranch,
                    run: typeof destination === 'object' ? { ...run, partyIds: run.partyIds.filter((id) => id !== destination.swapOut) } : run,
                    node: hereNode(world), speciesId: entry.speciesId, osId,
                });
                if (!plan) return;
                moves.push({ key: `${key}:${suffix}`, label, apply: (w) => assemble(w, entry.speciesId, osId, destination) });
            };
            const toDeck = summonCardsText(summonCardCount(entry.speciesId, osId));
            const toCollection = summonCardsText(summonCardCount(entry.speciesId, osId), 'collection');
            if (!partyFull) add('party', `Summon ${base} into the party (${toDeck})`, 'party');
            add('bench', `Summon ${base} onto the bench (${toCollection})`, 'bench');
            if (partyFull) {
                for (const id of run.partyIds) {
                    const out = ranch.roster.find((m) => m.id === id);
                    if (out) add(`swap-${id}`, `Summon ${base} and bench ${memberName(out)} (${toDeck})`, { swapOut: id });
                }
            }
        }
    }
    if (lines.length === 1) lines.push('  none held');
    return { lines, moves };
}
