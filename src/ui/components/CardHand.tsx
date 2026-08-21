import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { selectCard, playProgram, endTurn } from '../store/battleSlice';
import { GetProgramData } from '../../engine/data/programRegistry';
import type { IBattleState } from '../../engine/types';
import { validateSingleConstraint, getEffectiveCardCost } from '../../engine/battleReducer';
import { executeCostCalculated } from '../../engine/resolutionEngine';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { isUnaffordableCost, blockedCostReason } from '../../engine/core/CustomFirmware';
import { computeDamagePreview } from '../utils/damagePreview';
import CardKeywordChips from './CardKeywordChips';
import ElementMatchupHover from './ElementMatchupTooltip';
import { getElementAccent } from '../utils/contrastText';
import { playSfx } from '../audio/AudioEngine';

// Helper to format an action for display
const formatAction = (action: any): string => {
    switch (action.type) {
        case 'ATTACK':
            return `⚔️ ${action.power} ${action.element || ''} dmg`;
        case 'HEAL':
            return `💚 Heal ${action.power}`;
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
    const enemyParty = battleState?.enemyParty || [];
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const isOurTurn = battleState?.activeSide === 'PLAYER';
    const drawPileCount = battleState?.playerDeck.drawpile.length || 0;
    const discardPileCount = battleState?.playerDeck.discard.length || 0;
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
    // Tracks whether the pointerdown that precedes a click just selected this card,
    // so the click handler doesn't immediately toggle the selection back off.
    const justSelectedRef = useRef(false);

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

                        const source = playerParty.find(u => u.id === selectedSourceId);
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
                        const isUnplayable = !source || source.currentHp <= 0 || constraints.length > 0;

                        // ×1.5 STAB signal: the selected source's primary/secondary element
                        // matches this card's element. None is excluded — every unit carries a
                        // 'None' secondary, so it is not a differential signal. Absence of glow
                        // is the signal for unmatched cards (never dimmed).
                        const isStabMatch = !!source && data.element !== 'None' &&
                            (source.primaryElement === data.element || source.secondaryElement === data.element);
                        const stabAccent = isStabMatch ? getElementAccent(data.element) : null;

                        // Damage Preview on Card logic
                        // TICKET 105: this was a THIRD implementation of the damage preview - it
                        // called `calculateDamage` on the card's first ATTACK action, which is the
                        // exact shape ticket 104 replaced on the unit face. So the number on the CARD
                        // and the number on the TARGET disagreed on every card 104 fixed: multi-hit,
                        // consume-scaling, conditional branches, firmware bonuses. Same helper now, so
                        // there is one preview in the game and `previewParity.test.ts` covers it.
                        let cardPreviewDamage = 0;
                        if (isSelected && hoveredEntityId && battleState) {
                            cardPreviewDamage = computeDamagePreview(
                                battleState, source?.id, card.id, hoveredEntityId).damage;
                        }

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
                                    {cardPreviewDamage > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            style={{ color: '#ff4444', fontWeight: 'bold', marginTop: '10px', fontSize: '0.8rem' }}
                                        >
                                            PREVIEW: {cardPreviewDamage} DMG
                                        </motion.div>
                                    )}
                                </div>

                                {/* Keyword + applied-status chips */}
                                <CardKeywordChips data={data} />

                                {/* Target type */}
                                <div className="card-target">{data.target}</div>

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
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <div className="hand-footer">
                <div className="pile-indicator draw-pile">
                    <span className="pile-icon">🃏</span>
                    <span className="pile-count">{drawPileCount}</span>
                    <span className="pile-label">DRAW</span>
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

