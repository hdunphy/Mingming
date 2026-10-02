/**
 * TICKET 180c — THE LOADOUT EDITOR, over the screen that opened it.
 *
 * Every verb is `LoadoutEditor`'s own reducer: a card from the deck to the collection and back
 * (`moveCardToCollection`, which keeps the deck floor; `moveCardToDeck`), a member to the bench
 * (`benchPartyMember`, never the last one), a benched member picked up and swapped for a party
 * member (`swapBenchMember`) or into an empty slot (`unbenchMember`). `readDeckFloor` is the floor's
 * one reading, so the deck rows it shuts here are the ones the editor greys out. Confirming while a
 * member is still picked up warns once, as the editor does, and the second confirm closes it.
 *
 * Open and close are moves (`loadout:open`, `loadout:confirm`), so a session replays through them.
 */
import { PARTY_SIZE } from '../../../engine/party';
import { isJunkCard } from '../../../engine/run/junk';
import type { IRanchMember } from '../../../engine/runTypes';
import { readDeckFloor } from '../../../ui/screens/deckFloor';
import { benchPartyMember, moveCardToCollection, moveCardToDeck, swapBenchMember, unbenchMember } from '../../../ui/store/runSlice';
import { cardCost, cardLine, cardName, firmwareName, memberName } from '../gameText';
import { dispatchChecked, groupByData } from '../stalls';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';

export const openLoadout: Move = {
    key: 'loadout:open',
    label: 'Edit the loadout (party, bench, deck and collection)',
    apply: (w) => { w.view.editor = { swapping: null, confirmWarned: false }; },
};

export function loadoutScreen(world: World): Screen {
    const run = runOf(world);
    const editor = world.view.editor!;
    const ranch = world.store.getState().game;
    const reading = readDeckFloor(run);
    const bench = run.bench ?? [];
    const swapping = editor.swapping;
    const find = (id: string): IRanchMember | undefined => ranch.roster.find((m) => m.id === id);
    const set = (patch: Partial<NonNullable<typeof world.view.editor>>) => (w: World): void => { w.view.editor = { ...w.view.editor!, ...patch }; };

    const lines: string[] = [`LOADOUT. Deck ${reading.counted}, floor ${reading.floor}${reading.atFloor ? ' (at the floor: deck cards cannot leave)' : ''}.`];
    const moves: Move[] = [];

    lines.push(swapping ? 'PARTY (a benched member is picked up: choose who steps off):' : 'PARTY:');
    for (const id of run.partyIds) {
        const member = find(id);
        if (!member) continue;
        const mine = run.deck.filter((c) => c.ownerId === id).length;
        lines.push(`  ${memberName(member)} on ${firmwareName(run.osOverrides?.[id] ?? member.activeOS)}, ${mine} engine cards in the deck`);
        if (swapping) {
            moves.push({ key: `loadout:swap-in:${id}`, label: `Swap ${memberName(find(swapping) ?? member)} in for ${memberName(member)}`,
                apply: (w) => { if (dispatchChecked(w, swapBenchMember({ outId: id, inId: swapping }), 'swap')) { w.view.editor = { swapping: null, confirmWarned: false }; } } });
        } else if (run.partyIds.length > 1) {
            moves.push({ key: `loadout:bench:${id}`, label: `Bench ${memberName(member)} (the engine goes to the collection)`,
                apply: (w) => { dispatchChecked(w, benchPartyMember(id), 'bench'); } });
        }
    }
    const open = Math.max(0, PARTY_SIZE - run.partyIds.length);
    if (swapping && open > 0) {
        moves.push({ key: 'loadout:unbench', label: `Bring ${memberName(find(swapping)!)} into an empty slot`,
            apply: (w) => { if (dispatchChecked(w, unbenchMember(swapping), 'unbench')) w.view.editor = { swapping: null, confirmWarned: false }; } });
    }
    if (bench.length > 0) lines.push('BENCH:');
    for (const id of bench) {
        const member = find(id);
        if (!member) continue;
        lines.push(`  ${memberName(member)} on ${firmwareName(run.osOverrides?.[id] ?? member.activeOS)}${swapping === id ? ' [picked up]' : ''}`);
        moves.push({ key: `loadout:pick:${id}`, label: swapping === id ? `Put ${memberName(member)} back down` : `Pick up ${memberName(member)} to bring in`, apply: set({ swapping: swapping === id ? null : id, confirmWarned: false }) });
    }

    lines.push('DECK:');
    for (const { dataId, instances } of groupByData(run.deck)) {
        const blocked = !isJunkCard(dataId) && reading.atFloor;
        lines.push(`  ${cardName(dataId)} (${cardCost(dataId)}e)${instances.length > 1 ? ` x${instances.length}` : ''}${blocked ? ' [stays]' : ''}`);
        if (!blocked) moves.push({ key: `loadout:send:${instances[0].instanceId}`, label: `Send ${cardName(dataId)} to the collection`, apply: (w) => { dispatchChecked(w, moveCardToCollection(instances[0].instanceId), 'send'); } });
    }
    const collection = run.collection ?? [];
    lines.push(collection.length === 0 ? 'COLLECTION: empty.' : 'COLLECTION:');
    for (const { dataId, instances } of groupByData(collection)) {
        lines.push(`  ${cardLine(dataId)}${instances.length > 1 ? ` x${instances.length}` : ''}`);
        moves.push({ key: `loadout:add:${instances[0].instanceId}`, label: `Add ${cardName(dataId)} to the deck`, apply: (w) => { dispatchChecked(w, moveCardToDeck(instances[0].instanceId), 'add'); } });
    }

    moves.push({
        key: 'loadout:confirm',
        label: swapping && !editor.confirmWarned ? 'Confirm (a benched member is still picked up: this warns once)' : 'Confirm and close the editor',
        apply: (w) => { if (swapping && !editor.confirmWarned) w.view.editor = { ...editor, confirmWarned: true }; else w.view.editor = null; },
    });
    return { id: 'loadout', body: lines, moves };
}
