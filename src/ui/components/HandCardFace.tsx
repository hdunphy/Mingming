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
import { EnergyPips, TypeMark } from '../screens/CardChassis';
import { bannerFor } from '../screens/runShell';
import { describeLegalTargets } from '../utils/targeting';
import CardKeywordChips from './CardKeywordChips';
import { formatMultiplier } from './elementMatchups';

/**
 * What this card PUTS ON something, for the cards whose readout is not a number.
 *
 * Henry, 2026-09-11: the last row is *"the damage and status preview"*, so a card that moves no HP
 * still owes the row an answer. `ignite` applies 1 Burn and `strength_burst` grants 5 Strengthened;
 * before this they fell through to the chassis' element word, which is the exact thing being
 * replaced. Stacks come from the action, never from the printed text, for the same reason the
 * figure does.
 */
function statusSummary(data: ProgramData): ReadonlyArray<{ label: string; self: boolean }> {
    return (data.actions ?? [])
        .filter((a) => a.type === 'STATUS' && a.status)
        .map((a) => ({
            label: `${a.stacks && a.stacks !== 1 ? `${a.stacks} ` : ''}${String(a.status).toUpperCase()}`,
            self: a.target === 'SELF',
        }));
}

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
    /** ×1.5 — this card's element matches the selected caster's. */
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
}

const HandCardFace: React.FC<HandCardFaceProps> = ({
    data,
    displayCost,
    originalCost,
    isDiscounted = false,
    isBlocked = false,
    blockReason,
    isStabMatch = false,
    stabTitle,
    preview,
    replayTargetName,
    showReplay = false,
}) => {
    /*
     * THE CARD WE WERE HANDED, NOT A REGISTRY LOOKUP. `cardFace(id)` re-reads ProgramRegistry and
     * returns the SHIPPED text, which is a different card from the one the caller passed whenever
     * the two differ - a scenario fixture, a stripped test card, or any future per-run card edit.
     * It also reintroduced printed power into the fight by the back door, which is the one thing
     * `power dies at the surface` forbids here.
     */
    const face = {
        name: data.name,
        description: data.description ?? '',
        banner: bannerFor(data.category),
    };
    const trueDamage = preview?.damage ?? 0;
    const trueHealing = preview?.healing ?? 0;
    const effectiveness = preview?.effectiveness ?? 1;
    const hasReadout = trueDamage > 0 || trueHealing > 0;
    const statuses = hasReadout ? [] : statusSummary(data);

    return (
        <>
            {/*
              * The pips carry the LIVE cost, not the printed one: a primed discount is a fact about
              * this card in this hand, and a rack of pips that disagreed with what the play charges
              * would be worse than the numeral it replaced. The printed cost survives beside it,
              * struck through, so the discount is visible as a change rather than as a smaller number.
              */}
            <EnergyPips cost={displayCost} />
            {isDiscounted && originalCost !== undefined && (
                <span className="hc-cost-was" title={`Discounted from ${originalCost}`}>{originalCost}</span>
            )}
            {isBlocked && (
                <span className="hc-cost-blocked" title={blockReason ?? 'Cannot be paid for right now'}>NO PAY</span>
            )}
            <TypeMark banner={face.banner} />

            {isStabMatch && (
                <span className="hc-stab card-stab-pip" title={stabTitle ?? '×1.5 same-element bonus'}>×1.5</span>
            )}

            <span className="rs-art" />
            <span className="rs-cnm">{face.name}</span>

            {/* Under the name in both modes — see the header. */}
            <span className="hc-target">{describeLegalTargets(data)}</span>

            <span className="rs-desc">{face.description}</span>

            {showReplay && (
                <span className="hc-replay">
                    {replayTargetName ? `↻ ${replayTargetName}` : '↻ nothing of yours played yet'}
                </span>
            )}

            <CardKeywordChips data={data} />

            {/*
              * THE ROW THE SHOP SPENDS ON `FIRE · pick`. In a fight it is the readout, and when
              * there is no readout to give — no caster picked, or a card that neither damages nor
              * heals — it falls back to the chassis' own element line rather than collapsing, so
              * the tile never loses its last row and change height in the fan.
              */}
            <span className={`rs-tags hc-readout ${preview?.lethal ? 'is-lethal' : ''}`}>
                {hasReadout ? (
                    <>
                        <span className="hc-figure">
                            {trueDamage > 0 ? `${trueDamage} DMG` : `+${trueHealing} HP`}
                        </span>
                        {preview?.measuredOn && (
                            <span className="hc-vs">{trueDamage > 0 ? 'vs' : 'to'} {preview.measuredOn}</span>
                        )}
                        {preview && preview.hitCount > 1 && (
                            <span className="hc-chip">×{preview.hitCount} HITS</span>
                        )}
                        {preview && preview.absorbed > 0 && (
                            <span className="hc-chip is-shielded">ABS {preview.absorbed}</span>
                        )}
                        {effectiveness > 1 && (
                            <span className="hc-chip is-super">SUPER ×{formatMultiplier(effectiveness)}</span>
                        )}
                        {effectiveness < 1 && (
                            <span className="hc-chip is-weak">RESISTED ×{formatMultiplier(effectiveness)}</span>
                        )}
                        {preview?.lethal && <span className="hc-chip is-lethal">LETHAL</span>}
                    </>
                ) : (
                    statuses.map((st, i) => (
                        <span key={`${st.label}-${i}`} className={`hc-chip is-status ${st.self ? 'is-self' : ''}`}>
                            {st.self ? '↺' : '→'} {st.label}
                        </span>
                    ))
                )}
            </span>

            <span className="rs-elbar" />
        </>
    );
};

export default HandCardFace;
