/**
 * THE HAND CARD FACE — the shop's chassis, carrying the fight's numbers.
 *
 * Henry, 2026-09-11: *"I want them to use the same style as the card shop ... Add the targeting to
 * the cards (side/self/ally/enemy) but in the battle scene replace the {element} {benched/pick}
 * with the damage and status preview."*
 *
 * # ONE CHASSIS, A DIFFERENT FOOT
 *
 * `CardFace` is the one card face (ticket 155e; redrawn in the Slant kit by 183c). The fight changes
 * exactly one thing about it: the foot. A collection card ends in a 5px element bar; a card in a
 * fight, once there is a caster and a target, ends in the READOUT STRIP — the true figure big, the
 * target's name small, and a chip for each thing that moved it (SUPER, RESIST, hits, absorbed,
 * lethal). A card that neither damages nor heals has no figure, so it keeps the bar.
 *
 * **`power` never appears here.** Standing law (map § Notes): *"previews show true damage
 * everywhere, power remains the pricing currency."* The figure comes from `handPreview.ts`, scoped
 * to (caster, card, target); the printed description above it is the card's own text and the only
 * place a printed number is allowed to show.
 *
 * STAB and selection are not drawn here. `CardHand` sets `data-stab` and `data-selected` on the
 * element holding this face and the stylesheet paints the frame and the ring.
 */

import React from 'react';

import type { ProgramData } from '../../engine/types';
import { CardFace } from '../screens/CardChassis';
import { shortTargetLabel } from '../utils/targeting';
import type { TextRange } from '../utils/conditionalClauses';
import { ReadoutStrip } from '../theme/kit/ReadoutStrip';
import { plain } from '../labels/labels';

/** The fight's numbers for one card, already scoped to a caster and a target. */
export interface HandCardPreviewFace {
    readonly damage: number;
    readonly healing: number;
    readonly absorbed: number;
    readonly lethal: boolean;
    readonly hitCount: number;
    readonly effectiveness: number;
    readonly measuredOn: string | null;
}

export interface HandCardFaceProps {
    readonly data: ProgramData;
    /** What the player pays right now — discounts and primes already applied. */
    readonly displayCost: number;
    /** The printed cost, shown struck through when a discount is live. */
    readonly originalCost?: number;
    readonly isDiscounted?: boolean;
    readonly isBlocked?: boolean;
    readonly blockReason?: string;
    /**
     * The fight's readout. Absent in collection contexts, where the foot is the element bar and
     * this component is not what draws it.
     */
    readonly preview?: HandCardPreviewFace;
    /** Reprogram's live answer — the card it would replay, named. */
    readonly replayTargetName?: string | null;
    readonly showReplay?: boolean;
    /** Description ranges whose condition is TRUE for this caster and target — lit in the selection yellow. */
    readonly lit?: ReadonlyArray<TextRange>;
}

const HandCardFace: React.FC<HandCardFaceProps> = ({
    data,
    displayCost,
    originalCost,
    isDiscounted = false,
    isBlocked = false,
    blockReason,
    preview,
    replayTargetName,
    showReplay = false,
    lit,
}) => {
    /*
     * THE CARD WE WERE HANDED, NOT A REGISTRY LOOKUP. `cardFace(id)` re-reads ProgramRegistry and
     * returns the SHIPPED text, which is a different card from the one the caller passed whenever
     * the two differ - a scenario fixture, a stripped test card, or any future per-run card edit.
     * It also reintroduced printed power into the fight by the back door, which is the one thing
     * `power dies at the surface` forbids here.
     */
    const trueDamage = preview?.damage ?? 0;
    const trueHealing = preview?.healing ?? 0;
    const hasReadout = trueDamage > 0 || trueHealing > 0;

    // The foot of the card: the strip when there is a figure to read, else `CardFace` draws the bar.
    const readout = hasReadout && preview
        ? <ReadoutStrip preview={preview} element={data.element ?? 'None'} />
        : undefined;

    /*
     * Hung off the energy hexagon rather than given rows. A discount and a cannot-pay are facts
     * ABOUT the cost, so they belong at the cost; `showReplay` is Reprogram's live answer and rides
     * the same corner. None of the three is common enough to reserve a row for.
     *
     * STAB is no text at all (ticket 66; 183 restates it): the frame turns the element's colour.
     */
    const extras = (
        <>
            {isDiscounted && originalCost !== undefined && (
                <span className="hc-cost-was" title={`Discounted from ${originalCost}`}>{originalCost}</span>
            )}
            {isBlocked && (
                <span className="hc-cost-blocked" title={blockReason ?? 'Cannot be paid for right now'}>NO PAY</span>
            )}
            {showReplay && (
                <span className="hc-replay">
                    {replayTargetName ? `↻ ${replayTargetName}` : '↻ none yet'}
                </span>
            )}
        </>
    );

    return (
        <CardFace
            face={{
                name: data.name,
                description: plain(data.description ?? ''),
                element: data.element ?? 'None',
                cost: displayCost,
            }}
            target={shortTargetLabel(data)}
            readout={readout}
            /*
             * NO KEYWORD CHIPS IN THE HAND — Henry, 2026-09-25: *"The statuses that show on the
             * bottom should just be in the tooltip."* The chip row was one more fixed row taken
             * out of the description, which is the row the player actually reads; the statuses
             * and keywords it carried now open with the hover tooltip in `CardHand`, each with
             * its glossary line. The shop, editor and codex keep their chips — this is the fight.
             */
            extras={extras}
            lit={lit}
        />
    );
};

export default HandCardFace;
