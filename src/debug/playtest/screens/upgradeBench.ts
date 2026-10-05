/**
 * TICKET 180b — THE UPGRADE BENCH, as a section of whichever screen has one.
 *
 * The market and the workshop allow `UPGRADES_PER_VISIT` upgrades a visit, paid; the gym gate allows
 * one, free (180c). A row is a unique card in the deck that has an upgrade; it shows the card now and
 * after (the `+` text) and the price. One move per affordable row, none once the bench's allowance
 * is spent. The eligibility is the bench's own (`upgradeIdFor`, `upgradePrice`, the `benchKey` count
 * in `run.upgradesTaken`), and the reducer enforces the allowance as well.
 */
import { upgradeIdFor } from '../../../engine/data/plusRegistry';
import { upgradePrice } from '../../../engine/run/marketplace';
import { shopPrice } from '../../../engine/run/modifiers/shopPrice';
import { upgradeDeckCard } from '../../../ui/store/runSlice';
import { cardLine, cardName } from '../gameText';
import { dispatchChecked, groupByData, priceNote } from '../stalls';
import type { Section, World } from '../types';
import { runOf } from '../types';

export interface BenchOptions {
    readonly benchKey: string;
    readonly allowance: number;
    readonly free: boolean;
    /** What a move's key starts with, so one screen can host two benches without a clash. */
    readonly keyPrefix: string;
}

export function upgradeSection(world: World, options: BenchOptions): Section {
    const run = runOf(world);
    const { benchKey, allowance, free, keyPrefix } = options;
    const used = (run.upgradesTaken ?? []).filter((key) => key === benchKey).length;
    const spent = used >= allowance;

    const rows = groupByData(run.deck)
        .map((stack) => ({ stack, to: upgradeIdFor(stack.dataId) }))
        .filter((row): row is { stack: typeof row.stack; to: string } => row.to !== undefined);

    const lines: string[] = [];
    const moves: Section['moves'][number][] = [];
    if (rows.length === 0) {
        lines.push('UPGRADE BENCH: nothing in the deck has an upgrade.');
        return { lines, moves };
    }
    lines.push(`UPGRADE BENCH (${free ? 'free' : 'paid'}, ${allowance} per visit, ${used} used${spent ? ', none left' : ''}):`);
    for (const { stack, to } of rows) {
        const price = free ? 0 : shopPrice(run, upgradePrice(stack.dataId));
        const copies = stack.instances.length > 1 ? ` x${stack.instances.length}` : '';
        lines.push(`  ${cardLine(stack.dataId)}${copies}`);
        lines.push(`    becomes ${cardLine(to)} [${price === 0 ? 'free' : priceNote(world, price)}]`);
        if (spent || run.scrap < price) continue;
        moves.push({
            key: `${keyPrefix}:upgrade:${stack.instances[0].instanceId}`,
            label: `Upgrade ${cardName(stack.dataId)} to ${cardName(to)} (${price === 0 ? 'free' : `${price} amber`})`,
            about: { verb: 'upgrade', items: [cardName(stack.dataId)] },
            apply: (w) => {
                dispatchChecked(w, upgradeDeckCard({ instanceId: stack.instances[0].instanceId, benchKey, free, allowance }), 'upgrade');
                w.view.news.push(`Upgraded ${cardName(stack.dataId)}.`);
            },
        });
    }
    return { lines, moves };
}
