/**
 * THE HAND CARD FACE — the shop's chassis, carrying the fight's numbers.
 *
 * Henry, 2026-09-11: *"I want them to use the same style as the card shop ... Add the targeting to
 * the cards (side/self/ally/enemy) but in the battle scene replace the {element} {benched/pick}
 * with the damage and status preview."*
 *
 * # WHY THIS IS THE `.rs-card` CHASSIS AND NOT A THIRD CARD
 *
 * The game drew a card three different ways: ticket 66's ruled chassis in the shop and the loadout
 * editor (`.rs-card` — pips top-left, type mark top-right, art, name, description, element footer),
 * a hand-rolled inline-styled face in the fight, and the reveal lane re-using the fight's. Two card
 * designs is a player noticing that the thing they bought is not the thing they are holding, which
 * is exactly what Henry is reporting. So the fight adopts the chassis rather than approximating it,
 * and every ruled decision behind it — pips as capacity, the four type marks, descriptions present
 * at both scales — arrives with it for free.
 *
 * # WHAT THE FIGHT CHANGES, AND WHY IT IS THE FOOTER
 *
 * The chassis' last row is metadata: `FIRE · pick`, `NATURE · benched`. That is a *collection*
 * question — which pile is this card in — and in a fight the answer is "in your hand, obviously".
 * The fight's question is what this card DOES right now, so the same row carries the preview
 * instead: the true figure against the selected caster and target, and the statuses it applies.
 *
 * That swap is why this is one component with a mode rather than two components. The row is the
 * only thing that differs, and a shared chassis whose last line is a prop cannot drift the way two
 * copies of a card face do.
 *
 * **`power` never appears here.** Standing law (map § Notes): *"previews show true damage
 * everywhere, power remains the pricing currency."* The figure below comes from `handPreview.ts`,
 * scoped to (caster, card, target) — the printed description above it is the card's own text and
 * the only place a printed number is allowed to show.
 *
 * # THE TARGET CHIP
 *
 * `describeLegalTargets` is the same predicate the drop handler refuses with, so the chip and the
 * refusal cannot disagree about where a card may be aimed. It sits under the name in BOTH modes —
 * Henry asked for it on the cards, not only in the fight, and "who can this hit" is as much a
 * shopping question as a casting one.
 */

import React from 'react';

import type { ProgramData } from '../../engine/types';
import { CardFace } from '../screens/CardChassis';
import { bannerFor } from '../screens/runShell';
import { shortTargetLabel } from '../utils/targeting';
import type { TextRange } from '../utils/conditionalClauses';
import { formatMultiplier } from './elementMatchups';

/*
 * `statusSummary` lived here and is gone with ticket 155e.
 *
 * It read the actions for STATUS entries and printed `→ 2 BURN` chips in the readout row — beside
 * `CardKeywordChips`, which was ALREADY printing the same card's keywords from the same actions.
 * Henry's second screenshot shows both rows at once, which is how a duplicate gets noticed.
 *
 * The chips carry the stacks now, so there is one row saying it.
 */

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
     * This card's element matches the selected caster's.
     *
     * Kept on the interface and no longer PRINTED: ticket 66 ruled there is no STAB text, 155e
     * restates it, and the caller still needs the flag — it is what lights the `--stab-*` glow on
     * the card's wrapper, which is the cue the ruling says carries it.
     */
    readonly isStabMatch?: boolean;
    readonly stabTitle?: string;
    /**
     * The fight's readout. Absent in collection contexts, where the chassis' own element/tag line
     * is the right last row and this component is not what draws it.
     */
    readonly preview?: HandCardPreviewFace;
    /** Reprogram's live answer — the card it would replay, named. */
    readonly replayTargetName?: string | null;
    readonly showReplay?: boolean;
    /** Description ranges whose condition is TRUE for this caster and target — painted green. */
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
    const effectiveness = preview?.effectiveness ?? 1;
    const hasReadout = trueDamage > 0 || trueHealing > 0;

    /*
     * THE READOUT, ON ONE LINE — ticket 155e.
     *
     * It used to be a row of its own under a row of keyword chips under a target chip, and those
     * three rows came out of the only flexing row on the tile: the description. Henry's screenshot
     * had `brute_force` clipped mid-sentence for exactly that reason.
     *
     * Now it rides in the tag line the shop already spends on `FIRE · pick`, after the element
     * word: `FIRE · 96 DMG vs SKOLL`. The element word stays rather than being replaced, because
     * four of the nine hues are blues and the word is what settles the colour (see `.rs-elw`) —
     * that was a ruled decision and the fight has no reason to overturn it.
     *
     * When there is no readout to give — no caster picked, or a card that neither damages nor heals
     * — this is empty and the line is just the element word, which is what the shop shows. The
     * statuses are not restated here: 155e moves those onto the keyword chips, which carry stacks.
     */
    const readout = hasReadout ? (
        <span className={`hc-readout ${preview?.lethal ? 'is-lethal' : ''}`}>
            <span className="hc-figure">
                {trueDamage > 0 ? `${trueDamage} DMG` : `+${trueHealing} HP`}
            </span>
            {preview?.measuredOn && (
                <span className="hc-vs">{trueDamage > 0 ? 'vs' : 'to'} {preview.measuredOn}</span>
            )}
            {preview && preview.hitCount > 1 && <span className="hc-chip">×{preview.hitCount} HITS</span>}
            {preview && preview.absorbed > 0 && (
                <span className="hc-chip is-shielded">ABS {preview.absorbed}</span>
            )}
            {/*
              * The WORD stays, not just the multiplier. Trimming these to a bare `×1.5` for the
              * one-line readout was a false economy: next to `×2 HITS` an unlabelled multiplier is
              * ambiguous, and the matchup is the one chip a player acts on.
              */}
            {effectiveness > 1 && (
                <span className="hc-chip is-super">SUPER ×{formatMultiplier(effectiveness)}</span>
            )}
            {effectiveness < 1 && (
                <span className="hc-chip is-weak">RESIST ×{formatMultiplier(effectiveness)}</span>
            )}
            {preview?.lethal && <span className="hc-chip is-lethal">LETHAL</span>}
        </span>
    ) : undefined;

    /*
     * Hung off the pips rather than given rows. A discount and a cannot-pay are facts ABOUT the
     * cost, so they belong at the cost; `showReplay` is Reprogram's live answer and rides the same
     * corner. None of the three is common enough to reserve a row for.
     *
     * The `×1.5` STAB pip that used to sit here is GONE — ticket 66 ruled no STAB text, 155e
     * restates it, and the `--el` glow (155e's other half) is the cue.
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
                description: data.description ?? '',
                element: data.element ?? 'None',
                cost: displayCost,
                banner: bannerFor(data.category),
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
