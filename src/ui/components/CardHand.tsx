import React, { useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import type { ProgramAction, ProgramConstraint } from '../../engine/types';
import { selectCard, endTurn } from '../store/battleSlice';
import {
    FAN_CARD_H, FAN_CARD_W, FAN_SELECTED_LIFT, FAN_TRANSFORM_ORIGIN, fanCard,
} from './fanGeometry';
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
import HandCardFace from './HandCardFace';
import ElementMatchupHover from './ElementMatchupTooltip';
import { formatMultiplier } from './elementMatchups';
import { getElementAccent } from '../utils/contrastText';
import { playSfx } from '../audio/AudioEngine';
// The fight draws ticket 66's ruled chassis now — same stylesheet as the shop and the editor.
import '../screens/runShell.css';

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
const formatAction = (action: ProgramAction): string => {
    // Widened for the switch only: three of the cases below name action types that are not in
    // `ActionType` but can still turn up in hand-authored JSON, and dropping them would change
    // what those rows render.
    switch (action.type as string) {
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

const formatConstraint = (c: ProgramConstraint): string => {
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
    /**
     * The card a `PLAY_LAST_CARD` card would replay — YOUR side's last card (2026-09-05).
     *
     * Null before your first play of the fight, which is a real state the hand has to say out loud:
     * Reprogram cast then is a wasted Energy and a log line.
     */
    const replayTargetName: string | null = useMemo(() => {
        const id = battleState?.lastProgramBySide?.PLAYER ?? null;
        return id ? (GetProgramData(id)?.name ?? id) : null;
    }, [battleState?.lastProgramBySide?.PLAYER]);
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

                        /*
                         * TICKET 145d: the arch comes from `fanGeometry`, which is the mock's own
                         * numbers. What was here was `rotation = offset * 5` and a DIP of
                         * `|offset| * 12` — a fan that widened without limit as the hand grew, so a
                         * seven-card hand ran into the draw and discard piles. The new one flattens
                         * and tightens instead, and the cards never shrink: the card face is where
                         * the numbers are.
                         */
                        const fan = fanCard(index, hand.length);

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
                                    y: isSelected || isHovered ? -(fan.lift + FAN_SELECTED_LIFT + 20) : -fan.lift,
                                    scale: isSelected ? 1.08 : (isHovered ? 1.05 : 1),
                                    rotate: isSelected || isHovered ? 0 : fan.rotation,
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className={`rs-card hand-card ${isSelected ? 'selected' : ''} ${isUnplayable ? 'grayscale' : ''} ${isStabMatch ? 'stab-match' : ''}`}
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
                                    // §2c: below the card, so a rotation swings the top rather than the foot.
                                    transformOrigin: FAN_TRANSFORM_ORIGIN,
                                    marginLeft: fan.overlap,
                                    width: FAN_CARD_W,
                                    height: FAN_CARD_H,
                                    zIndex: isSelected ? 100 : (isHovered ? 99 : index),
                                    filter: isUnplayable ? 'grayscale(0.6)' : 'none',
                                    ...(stabAccent ? {
                                        '--stab-color': stabAccent,
                                        '--stab-glow': `${stabAccent}88`
                                    } as React.CSSProperties : {}),
                                }}
                            >
                                <HandCardFace
                                    data={data}
                                    displayCost={displayCost}
                                    originalCost={card.currentCost}
                                    isDiscounted={isDiscounted}
                                    isBlocked={isBlocked}
                                    blockReason={blockReason ?? undefined}
                                    isStabMatch={isStabMatch && !!source}
                                    stabTitle={source ? `${data.element} matches ${source.name} — ×1.5 STAB` : undefined}
                                    preview={preview}
                                    replayTargetName={replayTargetName}
                                    showReplay={!!data.actions?.some((a) => a.type === 'PLAY_LAST_CARD')}
                                />

                                {/*
                                  * Ticket 22: this printed the raw `TargetType` enum ("Single"),
                                  * which is a word out of the schema rather than a statement about
                                  * where the card may land. `describeLegalTargets` derives the
                                  * phrase from the very predicate the drop handler validates
                                  * against, so the legend cannot promise a target the game refuses.
                                  */}

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
                    {/*
                      * TICKET 145d — the pile IS a card, face down, with its count on its corner.
                      * The emoji went with ticket 34's guard (an emoji ignores `color`), but the
                      * real reason is §2c: a draw pile drawn as a card back says "these are cards"
                      * without a label, and the count belongs ON the thing it counts rather than in
                      * a row of numbers at the top of the screen — which is where §1 cut it from.
                      * Two stacked shadows, because a pile of one and a pile of thirty should not
                      * look identical; the number carries the precision, the stack carries the
                      * glance.
                      */}
                    <span className="pile-label">DRAW</span>
                    <span className="pile-card pile-card-stacked" aria-hidden="true" />
                    <span className="pile-count">{drawPileCount}</span>
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

                {/*
                  * The discard is a SINGLE card back, not a stack — §2c draws it that way and the
                  * distinction is honest: the draw pile is what you will get and the discard is
                  * what is spent, so only one of the two is worth reading a depth off.
                  */}
                <div className="pile-indicator discard-pile">
                    <span className="pile-label">DISCARD</span>
                    <span className="pile-card" aria-hidden="true" />
                    <span className="pile-count">{discardPileCount}</span>
                    {/*
                      * END TURN sits DIRECTLY UNDER THE DISCARD (§2c), which is where the turn
                      * ends up: the button and the pile it feeds are one column now instead of two
                      * things at opposite ends of the console.
                      */}
                    <button
                        disabled={!isOurTurn}
                        onClick={() => { playSfx('uiClick'); dispatch(endTurn()); }}
                        className="action-button end-turn"
                    >
                        END TURN
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CardHand;
