/**
 * The enemy hand, as a list — ticket 159b's arithmetic, kept out of the component.
 *
 * Two questions with exact answers ("what is it holding" and "could any of it be cast"), split out
 * so they can be checked without rendering a stage — the same argument `battleCues.ts` and
 * `limiters.ts` make. It is also what `EnemyHandPanel` needs to stay a component file: exporting
 * helpers beside a component breaks fast refresh.
 */

import { GetProgramData } from '../../engine/data/programRegistry';
import { numericBaseCost } from '../../engine/types';
import type { IBattleState, ProgramEntity } from '../../engine/types';
import { bannerFor } from '../screens/runShell';
import type { Banner } from '../screens/runShell';

/** One unique card in the hand, with however many copies of it are held. */
export interface HandStack {
    readonly dataId: string;
    readonly count: number;
    readonly name: string;
    readonly description: string;
    readonly element: string;
    readonly cost: number;
    readonly banner: Banner;
    /** True when no living enemy could pay for it right now. */
    readonly unaffordable: boolean;
}

/**
 * The most Energy any living enemy has right now.
 *
 * The *most*, not the sum and not per-unit: the question a greyed row answers is "could this be
 * cast at all this turn", and one caster with four Energy makes a four-cost card castable however
 * poor the other two are. Summing would promise combinations that no single unit can pay for.
 *
 * Dead units are excluded because they cannot act — the same rule the energy refill already uses.
 */
export function highestEnemyEnergy(state: IBattleState | null): number {
    if (!state) return 0;
    let highest = 0;
    for (const entity of state.enemyParty) {
        if (entity.currentHp <= 0) continue;
        if (entity.currentEnergy > highest) highest = entity.currentEnergy;
    }
    return highest;
}

/**
 * The hand as unique cards, in cost then name order — §5's ordering.
 *
 * Cost first because that is the axis the player is deciding against (what can it afford), name
 * second so the list is stable between renders rather than reshuffling as cards are drawn.
 */
export function stackHand(hand: ReadonlyArray<ProgramEntity>, energy: number): HandStack[] {
    const byData = new Map<string, number>();
    for (const card of hand) byData.set(card.dataId, (byData.get(card.dataId) ?? 0) + 1);

    const stacks: HandStack[] = [];
    for (const [dataId, count] of byData) {
        const data = GetProgramData(dataId);
        /*
         * `GetProgramData` returns a STUB for an unknown id — `{ id: 'missing', name: 'Missing
         * Program', baseCost: 99 }` — rather than null, so a presence check passes and the panel
         * would list a row reading "Missing Program 99". The id is the discriminator. A card the
         * registry has since dropped is skipped: the hand COUNT on the tab still includes it,
         * which is honest, and an unreadable row is worse than a list one shorter than the count.
         */
        if (!data || data.id === 'missing') continue;
        const cost = numericBaseCost(data.baseCost);
        stacks.push({
            dataId,
            count,
            name: data.name,
            description: data.description ?? '',
            element: data.element ?? 'None',
            cost,
            banner: bannerFor(data.category),
            unaffordable: cost > energy,
        });
    }
    return stacks.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}
