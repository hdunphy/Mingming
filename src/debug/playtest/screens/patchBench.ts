/**
 * TICKET 180b — THE PATCH BENCH: a firmware patch for one body.
 *
 * The market stocks the one boring patch for a price; the gym gate (180c) offers each body the two
 * that change the most about its own firmware, free, once per gate. Eligibility is `PatchBench`'s:
 * a body with every slot full is not listed, a used gate bench is spent, and the offers come from
 * `gatePatchChoices` / `offerablePatchIds`. The price is `SHOP_PATCH_PRICE` through `shopPrice`.
 */
import { PATCH_SLOTS } from '../../../engine/data/patchRegistry';
import { gatePatchChoices, offerablePatchIds, SHOP_STOCK_PATCH } from '../../../engine/data/patchRanking';
import { effectiveOS } from '../../../engine/run/effectiveOS';
import { shopPrice } from '../../../engine/run/modifiers/shopPrice';
import { SHOP_PATCH_PRICE } from '../../../ui/screens/PatchBench';
import { fitPatch } from '../../../ui/store/runSlice';
import { memberName, patchLine, patchName } from '../gameText';
import { dispatchChecked, priceNote } from '../stalls';
import type { Move, Section, World } from '../types';
import { runOf } from '../types';

export interface PatchBenchOptions {
    readonly venue: 'gate' | 'shop';
    /** The gate bench's key, so one gate offers one patch. */
    readonly benchKey?: string;
}

export function patchSection(world: World, options: PatchBenchOptions): Section {
    const run = runOf(world);
    const { roster } = world.store.getState().game;
    const free = options.venue === 'gate';
    const price = free ? 0 : shopPrice(run, SHOP_PATCH_PRICE);
    const title = free ? 'PATCH BENCH (free, one patch at the gate):' : `PATCH BENCH (${price} scrap):`;

    if (free && options.benchKey && (run.patchBenchesUsed ?? []).includes(options.benchKey)) {
        return { lines: [title, '  a patch is already fitted here'], moves: [] };
    }

    const lines = [title];
    const moves: Move[] = [];
    for (const memberId of run.partyIds) {
        const member = roster.find((m) => m.id === memberId);
        if (!member) continue;
        const held = run.patches?.[memberId] ?? [];
        if (held.length >= PATCH_SLOTS) continue;
        const os = effectiveOS(run, member);
        const offers = free
            ? gatePatchChoices(os, held)
            : offerablePatchIds(os).filter((id) => id === SHOP_STOCK_PATCH);
        for (const patchId of offers) {
            lines.push(`  ${memberName(member)}: ${patchLine(os, patchId)} [${free ? 'free' : priceNote(world, price)}]`);
            if (!free && run.scrap < price) continue;
            moves.push({
                key: `patch:${options.venue}:${memberId}:${patchId}`,
                label: `Fit ${patchName(patchId)} on ${memberName(member)} (${free ? 'free' : `${price} scrap`})`,
                apply: (w) => {
                    const action = fitPatch({ memberId, patchId, price, benchKey: free ? options.benchKey : undefined });
                    if (dispatchChecked(w, action, 'fit patch')) w.view.news.push(`Fitted ${patchName(patchId)} on ${memberName(member)}.`);
                },
            });
        }
    }
    if (lines.length === 1) lines.push('  every body already runs a patch');
    return { lines, moves };
}
