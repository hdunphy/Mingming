/**
 * TICKET 180b — THE WORKSHOP'S REFLASH.
 *
 * For each member (party and bench) with a blueprint of their species and a second firmware: swap
 * the firmware and the five-card engine in the deck. The old engine goes to the collection, the new
 * one to the deck. Legality is `reflashBlockFor` and `planReflash`; the dispatches are the bay's:
 * `swapOS` (spends the blueprint) then `reflashEngine` (spends the scrap, swaps the cards).
 */
import { shopPrice } from '../../../../engine/run/modifiers/shopPrice';
import {
    WORKSHOP_REFLASH_SCRAP, engineIdsFor, engineIdsForSpecies, planReflash, reflashBlockFor, reflashOptionsFor,
} from '../../../../engine/run/workshop';
import type { IRanchMember } from '../../../../engine/runTypes';
import { swapOS } from '../../../../ui/store/gameSlice';
import { reflashEngine } from '../../../../ui/store/runSlice';
import { cardName, firmwareName, firmwareText, memberName } from '../../gameText';
import { hereNode, priceNote, shortBy } from '../../stalls';
import type { Move, Section, World } from '../../types';
import { runOf } from '../../types';

const namesOf = (ids: ReadonlyArray<string>): string => ids.map(cardName).join(', ');

function reflash(world: World, memberId: string, targetOS: string): void {
    const ranch = world.store.getState().game;
    const run = runOf(world);
    const member = ranch.roster.find((m) => m.id === memberId);
    const plan = member ? planReflash({ ranch, run, node: hereNode(world), member, targetOS }) : null;
    const before = member ? (ranch.blueprints[member.definitionId] ?? 0) : 0;
    if (!member || !plan || run.scrap < plan.scrap || before < 1) { world.view.news.push('Nothing happened (reflash).'); return; }

    world.store.dispatch(swapOS({ id: member.id, targetOS }));
    if ((world.store.getState().game.blueprints[member.definitionId] ?? 0) >= before) {
        world.view.news.push('Nothing happened (reflash).');
        return;
    }
    world.store.dispatch(reflashEngine({ memberId: member.id, retireIds: plan.retireIds, cards: plan.cards, price: plan.scrap }));
    world.view.news.push(`Reflashed ${memberName(member)} to ${firmwareName(targetOS)}.`);
}

export function reflashSection(world: World): Section {
    const run = runOf(world);
    const ranch = world.store.getState().game;
    const price = shopPrice(run, WORKSHOP_REFLASH_SCRAP);
    const lines = [`REFLASH (${price} scrap and one blueprint of that species; swaps the firmware and its engine):`];
    const moves: Move[] = [];

    const everyone = [...run.partyIds, ...(run.bench ?? [])]
        .map((id) => ranch.roster.find((m) => m.id === id))
        .filter((m): m is IRanchMember => m !== undefined);
    for (const member of everyone) {
        const block = reflashBlockFor(member, ranch);
        const here = `${memberName(member)} (${firmwareName(run.osOverrides?.[member.id] ?? member.activeOS)})`;
        if (block !== null) { lines.push(`  ${here}: ${block === 'no-blueprint' ? 'no blueprint' : 'no other firmware'}`); continue; }
        for (const targetOS of reflashOptionsFor(member)) {
            const plan = planReflash({ ranch, run, node: hereNode(world), member, targetOS });
            lines.push(`  ${here} -> ${firmwareName(targetOS)}: ${firmwareText(targetOS)}`);
            lines.push(`    engine out: ${namesOf(engineIdsFor(member))}`);
            lines.push(`    engine in: ${namesOf(engineIdsForSpecies(member.definitionId, targetOS))} [${priceNote(world, price)}]`);
            if (!plan || shortBy(world, price) > 0) continue;
            moves.push({
                key: `workshop:reflash:${member.id}:${targetOS}`,
                label: `Reflash ${memberName(member)} to ${firmwareName(targetOS)} (${price} scrap)`,
                apply: (w) => reflash(w, member.id, targetOS),
            });
        }
    }
    if (lines.length === 1) lines.push('  nobody to reflash');
    return { lines, moves };
}
