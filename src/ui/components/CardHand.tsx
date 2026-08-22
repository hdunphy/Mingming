import React, { useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { selectCard, endTurn } from '../store/battleSlice';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getEffectiveCardCost } from '../../engine/battleReducer';
import { executeCostCalculated } from '../../engine/resolutionEngine';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { isUnaffordableCost, blockedCostReason } from '../../engine/core/CustomFirmware';
import { computeHandPreviews, pickPreviewTarget } from '../utils/handPreview';
import { describeLegalTargets } from '../utils/targeting';
import { describeDraw, drawTooltipLines } from '../utils/drawFormula';
import { keybindLegend } from '../keybinds';
import CardKeywordChips from './CardKeywordChips';
import ElementMatchupHover from './ElementMatchupTooltip';
import { formatMultiplier } from './elementMatchups';
import { getElementAccent } from '../utils/contrastText';
import { playSfx } from '../audio/AudioEngine';

/**
 * One line per action, in the player's terms.
 *
 * # `power` NEVER — TICKET 22 CLOSED THE LAST LEAK
 *
 * Standing law (map § Notes), tested on the marketplace by ticket 13 and on the macro rack by ticket
 * 15: *"previews show true damage everywhere, power remains the pricing currency."* This helper was
 * the counter-example both of those tickets cite by name — `MacroRack`'s own docblock warns that
 * *"the cheapest way to break it here would be a well-meant reuse of `CardHand.formatAction`, which
 * prints `action.power` straight out of the data."* It printed `⚔️ 18 Fire dmg` and `💚 Heal 12`.
 *
 * That was already wrong at 1v1. At 3v3 it is worse than wrong: `power` is a property of the CARD,
 * and the HP that moves is a property of the (caster, card, target) triple, so the same "18" sat in
 * front of three units who would each produce a different number from it. The tooltip now names the
 * SHAPE of each action and the card face carries the true figure for the selected caster — see
 * `handPreview.ts`. `CardHand.test.tsx` asserts the rendered hand contains no "power" at all.
 */
const formatAction = (action: any): string => {
    switch (action.type) {
        case 'ATTACK': {
            const hits = Math.max(1, action.count ?? 1);
            if (action.target === 'SELF') return `⚔️ Recoil onto the caster${hits > 1 ? ` ×${hits}` : ''}`;
            return `⚔️ Damage${hits > 1 ? ` ×${hits} hits` : ''}`;
        }
        case 'HEAL':
            return '💚 Restores HP';
        case 'APPLY_STATUS':
            return `✦ ${action.status} ×${action.stacks || 1}`;
        case 'DRAW':
            return `🃏 Draw ${action.count || 1}`;
        case 'REMOVE_STATUS':
            return `✖ Remove ${action.status || 'all'}`;
        case 'ADD_ENERGY':
            return `⚡ +${action.amount} Energy`;
        case 'REVIVE':
            return `♻️ Revive`;
        default:
            return action.type;
    }
};

const formatConstraint = (c: any): string => {
    switch (c.type) {
        case 'HAS_STATUS':
            return `Requires: ${c.target === 'SELF' ? 'Self' : 'Target'} has ${c.value}`;
        case 'HEALTH_THRESHOLD':
            return `Requires: HP ${c.value}`;
        case 'BASE':
            return ''; // Don't display base energy check
        case 'NOT_STATUS':
            return `Requires: ${c.target === 'SELF' ? 'Self' : 'Target'} does not have ${c.value}`;
        default:
            return c.type;
    }
};

const CardHand: React.FC<{
    hoveredEntityId?: string | null;
    onTargetingStart?: (point: { x: number, y: number }) => void;
    onTargetingEnd?: () => void;
}> = ({ hoveredEntityId, onTargetingStart }) => {
    const dispatch = useDispatch();
    const battleState = useSelector((state: RootState) => state.battle.battle);
    const hand = battleState?.playerDeck.hand || [];
    const playerParty = battleState?.playerParty || [];
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const isOurTurn = battleState?.activeSide === 'PLAYER';
    const drawPileCount = battleState?.playerDeck.drawpile.length || 0;
    const discardPileCount = battleState?.playerDeck.discard.length || 0;
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
    // Tracks whether the pointerdown that precedes a click just selected this card,
    // so the click handler doesn't immediately toggle the selection back off.
    const justSelectedRef = useRef(false);

    /*
     * TICKET 22 — THE HAND RE-READS FOR THE SELECTED CASTER.
     *
     * Everything below this line is (caster, target)-scoped rather than card-scoped, which is the
     * whole of the ticket's preview-parity clause: in 3v3 the deck and the hand are shared, so a
     * card's true damage is not a fact about the card. It changes with whose Attack stat and whose
     * elements are behind it, and switching caster with W/E/R must therefore repaint every number in
     * the fan, not just the one under the pointer.
     *
     * The simulations are memoised on `(state, caster, target, card)` inside `handPreview.ts`; the
     * `useMemo` here only stops the map being rebuilt on hover-driven re-renders. The cost argument
     * for both is spelled out in that file's header.
     */
    const previewTarget = useMemo(
        () => pickPreviewTarget(battleState, hoveredEntityId, selectedTargetId),
        [battleState, hoveredEntityId, selectedTargetId],
    );
    const previews = useMemo(
        () => computeHandPreviews(battleState, selectedSourceId, previewTarget),
        [battleState, selectedSourceId, previewTarget],
    );
    const caster = playerParty.find(u => u.id === selectedSourceId);
    const draw = describeDraw(battleState);

    return (
        <div className="hand-container">
            <div className="hand-row">
                <AnimatePresence>
                    {hand.map((card, index) => {
                        const data = GetProgramData(card.dataId);
                        const isSelected = selectedCardId === card.id;
                        const isHovered = hoveredCardId === card.id;

                        const centerOffset = index - (hand.length - 1) / 2;
                        const rotation = centerOffset * 5;
                        const arcDip = Math.abs(centerOffset) * 12;

                        const source = caster;
                        // The cost the selected unit would ACTUALLY pay — includes primed
                        // discounts like Gullinbursti's UNSTOPPABLE_MASS (nextProgramModifier).
                        // Ticket 36: run onCostCalculated too, exactly as the reducer does.
                        // getEffectiveCardCost alone stops at the printed/primed cost, so hel_v2's
                        // UNDERWORLD_GATEWAY (which zeroes her Energy cost outright) would render
                        // soul_tithe as a 3-pip card AND fail the energy_base check below on her
                        // 2-Energy frame - i.e. greyed out as unplayable while the reducer happily
                        // plays it. The returned state is discarded; cost hooks are modifiers.
                        const printedCost = source ? getEffectiveCardCost(source, data, card.currentCost) : card.currentCost;
                        const effectiveCost = source && battleState
                            ? executeCostCalculated(battleState, source, undefined, data, printedCost).cost
                            : printedCost;
                        // TICKET 105: a cost hook can return an UNAFFORDABLE sentinel rather than a
                        // price - hel_v2 refuses a Dark cast that would be lethal or over her blood
                        // budget. That sentinel used to render as the literal "999" on the card face.
                        // Show the real printed cost, grey the card, and put the reason in the tooltip.
                        const isBlocked = isUnaffordableCost(effectiveCost);
                        const blockReason = isBlocked && source && battleState
                            ? blockedCostReason(battleState, source, data)
                            : null;
                        const displayCost = isBlocked ? printedCost : effectiveCost;
                        const isDiscounted = !isBlocked && effectiveCost < card.currentCost;
                        const constraints = (data.constraints || [])
                            .filter(c => c.target === 'SELF' && source && !getConstraintBehavior(c.type).validate(c, { source, cost: effectiveCost }))
                            .map(formatConstraint);
                        if (isBlocked) constraints.push(blockReason ?? 'Cannot be paid for right now');
                        // Per-unit OS card limit (e.g. YMIR v2 GLACIAL_PACE_OS: 2 cards/turn).
                        // The reducer rejects the play silently, so the tooltip carries the reason.
                        const sourceOS = source?.activeOS ? getOSBehavior(source.activeOS) : undefined;
                        if (source && sourceOS?.maxCardsPerTurn !== undefined &&
                            (source.playsThisTurn ?? 0) >= sourceOS.maxCardsPerTurn) {
                            const osLabel = sourceOS.name.replace(/_OS$/, '').replace(/_/g, ' ');
                            constraints.push(`${osLabel}: card limit reached (${sourceOS.maxCardsPerTurn}/turn)`);
                        }
                        // Ticket 22: "no caster picked" is now a stated reason rather than a silent
                        // grey, matching the convention tickets 13/14/20 set for every other refusal.
                        if (!source) constraints.push('Pick a caster first — W, E or R, or click one of your units.');
                        else if (source.currentHp <= 0) constraints.push(`${source.name} is terminated and cannot cast.`);
                        const isUnplayable = !source || source.currentHp <= 0 || constraints.length > 0;

                        // ×1.5 STAB signal and the true numbers both come from the caster-scoped
                        // preview now, so the glow and the figure can never disagree about who is
                        // casting. Absence of glow is the signal for unmatched cards (never dimmed).
                        const preview = previews.get(card.id);
                        const isStabMatch = !!preview?.stab;
                        const stabAccent = isStabMatch ? getElementAccent(data.element) : null;
                        const trueDamage = preview?.damage ?? 0;
                        const trueHealing = preview?.healing ?? 0;
                        const effectiveness = preview?.effectiveness ?? 1;

                        return (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                                animate={{
                                    opacity: isUnplayable ? 0.6 : 1,
                                    y: isSelected ? -30 : (isHovered ? -30 : arcDip),
                                    scale: isSelected ? 1.08 : (isHovered ? 1.05 : 1),
                                    rotate: isSelected ? 0 : (isHovered ? 0 : rotation),
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className={`program-card ${isSelected ? 'selected' : ''} ${isUnplayable ? 'grayscale' : ''} ${isStabMatch ? 'stab-match' : ''}`}
                                /*
                                 * Ticket 22: the refusal also rides the card frame, not only the
                                 * hover tooltip below. The tooltip needs a deliberate hover on a
                                 * card the player has already written off as "greyed out", which is
                                 * the one interaction they will not perform — so the reason it is
                                 * greyed out was, in practice, invisible. Same convention as
                                 * `MacroRack`'s disabled slots: never inert without a sentence.
                                 */
                                title={constraints.length > 0 ? constraints.join(' · ') : undefined}
                                onClick={() => {
                                    // If the preceding pointerdown just selected this card,
                                    // skip the toggle so a single click leaves it selected.
                                    if (justSelectedRef.current) {
                                        justSelectedRef.current = false;
                                        return;
                                    }
                                    dispatch(selectCard(isSelected ? null : card.id));
                                }}
                                onPointerDown={(e) => {
                                    // Grayed-out cards still open for reading, but buzz to
                                    // signal the play itself is blocked.
                                    playSfx(isUnplayable ? 'uiError' : 'uiClick');
                                    justSelectedRef.current = !isSelected;
                                    dispatch(selectCard(card.id));
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onTargetingStart?.({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2
                                    });
                                }}
                                onMouseEnter={() => setHoveredCardId(card.id)}
                                onMouseLeave={() => setHoveredCardId(null)}
                                style={{
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transformOrigin: 'center bottom',
                                    zIndex: isSelected ? 100 : (isHovered ? 99 : index),
                                    filter: isUnplayable ? 'grayscale(0.6)' : 'none',
                                    ...(stabAccent ? {
                                        '--stab-color': stabAccent,
                                        '--stab-glow': `${stabAccent}88`
                                    } as React.CSSProperties : {}),
                                }}
                            >
                                {/* Cost badge */}
                                <div
                                    className={`card-cost ${isDiscounted ? 'card-cost-discounted' : ''}${isBlocked ? ' card-cost-blocked' : ''}`}
                                    title={isBlocked
                                        ? (blockReason ?? 'Cannot be paid for right now')
                                        : (isDiscounted ? `Discounted from ${card.currentCost} (primed effect)` : undefined)}
                                >
                                    {displayCost}
                                    {isDiscounted && <span className="card-cost-original">{card.currentCost}</span>}
                                </div>
                                {isStabMatch && source && (
                                    <div
                                        className="card-stab-pip"
                                        title={`${data.element} matches ${source.name} — ×1.5 STAB`}
                                    >
                                        ×1.5
                                    </div>
                                )}

                                {/* Header: element + name */}
                                <div className="card-header">
                                    <ElementMatchupHover element={data.element}>
                                        <span className={`element-badge ${data.element.toLowerCase()}`}>
                                            {data.element[0]}
                                        </span>
                                    </ElementMatchupHover>
                                    <div className="card-name">{data.name}</div>
                                </div>

                                {/* Description */}
                                <div className="card-description">
                                    {data.description}
                                </div>

                                {/*
                                  * THE TRUE READOUT — ticket 22.
                                  *
                                  * Always on, not hover-gated. The previous build only computed a
                                  * number while a card was selected AND an entity was hovered, which
                                  * meant the hand was blank at the exact moment the player was
                                  * choosing between cards. It also names WHO the number is measured
                                  * against, because a figure quoted against an enemy the player did
                                  * not pick is a hidden assumption even when the number is right.
                                  */}
                                {(trueDamage > 0 || trueHealing > 0) && (
                                    <div className={`card-true-readout ${preview?.lethal ? 'lethal' : ''}`}>
                                        <span className="card-true-number">
                                            {trueDamage > 0 ? `${trueDamage} DMG` : `+${trueHealing} HP`}
                                        </span>
                                        {preview?.measuredOn && (
                                            <span className="card-true-target">
                                                {trueDamage > 0 ? 'vs' : 'to'} {preview.measuredOn}
                                            </span>
                                        )}
                                        {preview && preview.hitCount > 1 && (
                                            <span className="card-true-chip">×{preview.hitCount} HITS</span>
                                        )}
                                        {effectiveness > 1 && (
                                            <span className="card-true-chip super">
                                                SUPER ×{formatMultiplier(effectiveness)}
                                            </span>
                                        )}
                                        {effectiveness < 1 && (
                                            <span className="card-true-chip weak">
                                                RESISTED ×{formatMultiplier(effectiveness)}
                                            </span>
                                        )}
                                        {preview?.lethal && <span className="card-true-chip lethal">LETHAL</span>}
                                    </div>
                                )}

                                {/* Keyword + applied-status chips */}
                                <CardKeywordChips data={data} />

                                {/*
                                  * Ticket 22: this printed the raw `TargetType` enum ("Single"),
                                  * which is a word out of the schema rather than a statement about
                                  * where the card may land. `describeLegalTargets` derives the
                                  * phrase from the very predicate the drop handler validates
                                  * against, so the legend cannot promise a target the game refuses.
                                  */}
                                <div className="card-target" title={`Legal targets: ${describeLegalTargets(data)}`}>
                                    {describeLegalTargets(data)}
                                </div>

                                {/* Hover tooltip: actions & constraints */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            className="card-tooltip"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            {constraints.length > 0 && (
                                                <div className="tooltip-section">
                                                    <div className="tooltip-label">⚠️ Requirements</div>
                                                    {constraints.map((c, i) => (
                                                        <div key={i} className="tooltip-constraint">{c}</div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="tooltip-section">
                                                <div className="tooltip-label">Effects</div>
                                                {data.actions.map((action, i) => (
                                                    <div key={i} className="tooltip-action">{formatAction(action)}</div>
                                                ))}
                                            </div>
                                            <div className="tooltip-section">
                                                <div className="tooltip-label">Targets</div>
                                                <div className="tooltip-action">{describeLegalTargets(data)}</div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <div className="hand-footer">
                {/*
                  * THE DRAW TOOLTIP — ticket 22.
                  *
                  * Hung on the draw pile because that is where the player already looks to ask "how
                  * many am I getting". It prints the arithmetic for THIS party rather than the
                  * formula, because `sum(cardDraw) − (N − 1)` is the expression ticket 08's
                  * start-deck ruling was derived from and "7" with no working shown is precisely the
                  * number a player cannot plan a third party member around. See `drawFormula.ts`.
                  */}
                <div
                    className="pile-indicator draw-pile"
                    title={drawTooltipLines(draw).join('\n')}
                >
                    <span className="pile-icon">🃏</span>
                    <span className="pile-count">{drawPileCount}</span>
                    <span className="pile-label">DRAW</span>
                    <span className="pile-formula">+{draw.total}/turn</span>
                </div>
                <div className="hand-console-center">
                    {/*
                      * WHOSE NUMBERS THESE ARE. With one caster this was implicit and safe to leave
                      * unsaid; with three it is the single most load-bearing piece of state on the
                      * screen, because every figure in the fan above is quoted for this unit.
                      */}
                    <div className="hand-caster-banner" data-testid="hand-caster-banner">
                        {caster
                            ? <>READING FOR <strong>{caster.name.toUpperCase()}</strong></>
                            : <>NO CASTER — PRESS W / E / R</>}
                    </div>
                    {/*
                      * Ticket 22's Done-when is that the fight is playable by keyboard as well as
                      * mouse. A keyboard path nobody can discover is not a keyboard path, so the map
                      * lives on the console beside the hand it drives.
                      *
                      * It used to be a hardcoded string, and the comment here used to justify that
                      * with "a fight has no options screen to hide a key list behind". Ticket 36
                      * built that screen, so this line and the settings table are now generated from
                      * one `KEYBINDS` array — three hand-written copies of the same fact was the
                      * point at which drift stopped being hypothetical.
                      */}
                    <div className="hand-hotkeys">
                        {keybindLegend()}
                    </div>
                </div>
                <div className="battle-controls">
                    <button
                        disabled={!isOurTurn}
                        onClick={() => { playSfx('uiClick'); dispatch(endTurn()); }}
                        className="action-button end-turn"
                    >
                        END TURN
                    </button>
                </div>
                <div className="pile-indicator discard-pile">
                    <span className="pile-icon">🗑️</span>
                    <span className="pile-count">{discardPileCount}</span>
                    <span className="pile-label">DISCARD</span>
                </div>
            </div>
        </div>
    );
};

export default CardHand;
