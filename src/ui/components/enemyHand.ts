/**
 * What the enemy is about to play, as a list — ticket 159b's arithmetic, kept out of the component.
 *
 * Two questions with exact answers ("what will it be holding" and "could any of it be cast"), split
 * out so they can be checked without rendering a stage — the same argument `battleCues.ts` and
 * `limiters.ts` make. It is also what `EnemyHandPanel` needs to stay a component file: exporting
 * helpers beside a component breaks fast refresh.
 *
 * # WHY THIS READS THE DRAWPILE AND NOT THE HAND
 *
 * 159b first shipped against `enemyDeck.hand`, which required 159a — a reducer change that moved
 * every side's refill to the end of its own turn so the enemy's hand existed while the player
 * decided. Henry, 2026-09-21: *"Instead of making the enemy draw should we just show a preview of
 * the next x (where x is the card draw) cards in the deck. This way we don't mess up any hooks that
 * happen on turn start."*
 *
 * He was right on the hook, and right for a second reason he did not name:
 *
 *   - `fertile_ground_daemon` carries an `onTurnStart` hook whose action is a literal `DRAW`. Hooks
 *     run BEFORE the refill in `processPreTurn`, so moving the refill moves that card's timing
 *     relative to it. One card is enough; that is the kind of break that surfaces in a playtest
 *     rather than in a suite.
 *   - 159a reordered PRNG consumption, which re-rolls the drawpile of most fights in the game and
 *     costs a full balance re-baseline. Reading the drawpile costs nothing, because it changes no
 *     engine code at all.
 *
 * And it gives up nothing. Under the restored timing the enemy discards its hand at the end of its
 * turn and redraws at the start of its next, so during the player's turn it holds nothing: the top
 * X of its drawpile IS the hand it is about to play. Same information, no engine risk.
 *
 * # THE RESHUFFLE IS SHOWN AS A GAP, NOT GUESSED
 *
 * When the drawpile holds fewer than X, `drawCards` shuffles the discard back in and keeps going.
 * That shuffle is seeded, so it *could* be simulated — and must not be. The seed advances on every
 * card the player casts, so a simulated tail would rewrite itself between one play and the next: a
 * preview that silently changes its mind is worse than one that admits a gap. `unknown` is that
 * gap, and it is clamped to the discard because a reshuffle cannot produce cards that do not exist.
 */

import { GetProgramData } from '../../engine/data/programRegistry';
import { numericBaseCost } from '../../engine/types';
import type { IBattleState, ProgramEntity } from '../../engine/types';
import { describeDraw } from '../utils/drawFormula';
import { bannerFor } from '../screens/runShell';
import type { Banner } from '../screens/runShell';
import { plain } from '../labels/labels';

/** One unique card, with however many copies of it are in the list. */
export interface HandStack {
    readonly dataId: string;
    readonly count: number;
    readonly name: string;
    readonly description: string;
    readonly element: string;
    readonly cost: number;
    readonly banner: Banner;
    /** True when no living enemy could pay for it on the turn this list is about. */
    readonly unaffordable: boolean;
}

/** What the panel is looking at: cards they hold now, or cards they are about to draw. */
export type HandSource = 'HAND' | 'PREVIEW';

export interface EnemyHandView {
    readonly source: HandSource;
    /** The cards themselves, in drawpile order when previewing. */
    readonly cards: ReadonlyArray<ProgramEntity>;
    /**
     * Cards that WILL be drawn but come from a reshuffle of the discard, so their identity is not
     * knowable yet. Zero whenever the drawpile covers the whole draw.
     */
    readonly unknown: number;
    /** The Energy the greyed rows are measured against — see `highestEnemyEnergy`. */
    readonly energy: number;
}

/**
 * The most Energy any living enemy has, or will have, depending on which list is being shown.
 *
 * The *most*, not the sum and not per-unit: the question a greyed row answers is "could this be
 * cast at all", and one caster with four Energy makes a four-cost card castable however poor the
 * other two are. Summing would promise combinations that no single unit can pay for.
 *
 * `mode` is the half that is easy to get wrong. Against a hand they are holding RIGHT NOW,
 * `currentEnergy` is the truth. Against a PREVIEW of next turn it is not even close: by the end of
 * their turn they have usually spent down to nothing, so every row would grey out and the panel
 * would read as broken at exactly the moment the player is deciding. `processPreTurn` refills a
 * living unit to `maxEnergy + Energized stacks`, so that is what the preview measures against —
 * a rule about their own resource, not a guess about their choices.
 *
 * Dead units are excluded in both modes because they cannot act, which is the same rule the energy
 * refill itself uses.
 */
export function highestEnemyEnergy(state: IBattleState | null, mode: HandSource = 'HAND'): number {
    if (!state) return 0;
    let highest = 0;
    for (const entity of state.enemyParty) {
        if (entity.currentHp <= 0) continue;
        const energized = entity.statusEffects.find(s => s.type === 'Energized');
        const energy = mode === 'PREVIEW'
            ? entity.maxEnergy + (energized ? energized.stacks : 0)
            : entity.currentEnergy;
        if (energy > highest) highest = energy;
    }
    return highest;
}

/**
 * What to show: the hand if they are holding one, otherwise the next X off the drawpile.
 *
 * The branch is not a mode switch, it is the same question answered from whichever source can
 * answer it. On the enemy's own turn they hold real cards and those are the truth; on the player's
 * turn the hand is empty by construction and the drawpile top is the truth. Both are "what this
 * enemy has to play with", which is why they share a panel.
 *
 * X comes from `describeDraw(state, 'ENEMY')` rather than a second copy of the formula, so a member
 * dying or a `cardDraw` buff lands here for free — the two cases Henry named — and there is one
 * place for the arithmetic to be wrong instead of two.
 */
export function enemyHandView(state: IBattleState | null): EnemyHandView {
    if (!state || (state.enemyMode ?? 'MOVES') !== 'CARDS') {
        return { source: 'PREVIEW', cards: [], unknown: 0, energy: 0 };
    }

    const deck = state.enemyDeck;
    if (deck.hand.length > 0) {
        return {
            source: 'HAND',
            cards: deck.hand,
            unknown: 0,
            energy: highestEnemyEnergy(state, 'HAND'),
        };
    }

    const want = describeDraw(state, 'ENEMY').total;
    const known = Math.min(want, deck.drawpile.length);
    return {
        source: 'PREVIEW',
        cards: deck.drawpile.slice(0, known),
        // Clamped to the discard: a reshuffle cannot deal cards that are not in the fight.
        unknown: Math.min(want - known, deck.discard.length),
        energy: highestEnemyEnergy(state, 'PREVIEW'),
    };
}

/**
 * The list as unique cards, in cost then name order — §5's ordering.
 *
 * Cost first because that is the axis the player is deciding against (what can it afford), name
 * second so the list is stable between renders rather than reshuffling as cards move.
 *
 * Stacking loses drawpile order, and that is deliberate: order is the one thing a preview must not
 * promise, because a mid-turn draw effect or a status kill changes which of those cards actually
 * arrive first. Cost order says what it means — here is the set, priced.
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
         * registry has since dropped is skipped: the COUNT on the tab still includes it, which is
         * honest, and an unreadable row is worse than a list one shorter than the count.
         */
        if (!data || data.id === 'missing') continue;
        const cost = numericBaseCost(data.baseCost);
        stacks.push({
            dataId,
            count,
            name: data.name,
            description: plain(data.description ?? ''),
            element: data.element ?? 'None',
            cost,
            banner: bannerFor(data.category),
            unaffordable: cost > energy,
        });
    }
    return stacks.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}
