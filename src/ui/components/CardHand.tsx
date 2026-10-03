import React, { useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import type { IBattleEntity, ProgramAction, ProgramConstraint } from '../../engine/types';
import { selectCard, endTurn, nudgeEndTurn } from '../store/battleSlice';
import { decideEndTurn, nudgeIsLive } from '../utils/endTurnNudge';
import {
    FAN_SELECTED_LIFT, FAN_TRANSFORM_ORIGIN, fanCard, fanCardSize, fanOverlapFor,
} from './fanGeometry';
import { stageScale } from './stageGeometry';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import { useViewportSize } from '../hooks/useStageAnchors';

/**
 * The width one pile column occupies at scale 1 — the card back (58) plus its slack.
 *
 * Stated here rather than measured: `useStageAnchors` publishes rects for the STAGE and the console
 * owns its own layout, so the fan's share of the row is arithmetic on a known column rather than a
 * DOM read that would move the moment a count grew a digit.
 */
const PILE_COLUMN_PX = 96;

/** The right column is the End Turn button's width (183d: 200px), not the card back's. */
const END_TURN_COLUMN_PX = 200;
import { GetProgramData } from '../../engine/data/programRegistry';
import { getEffectiveCardCost } from '../../engine/battleReducer';
import { executeCostCalculated } from '../../engine/resolutionEngine';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { instinctName } from '../labels/labels';
import { isUnaffordableCost, blockedCostReason } from '../../engine/core/CustomFirmware';
import { computeHandPreviews, pickPreviewTarget } from '../utils/handPreview';
import { describeLegalTargets } from '../utils/targeting';
import { describeDraw, drawTooltipLines } from '../utils/drawFormula';
import { keybindLegend } from '../keybinds';
import HandCardFace from './HandCardFace';
import { EndTurnButton } from './console/EndTurnButton';
import { PileBacks } from './console/PileBacks';
import DiscardPileViewer from './DiscardPileViewer';
import DrawPileViewer from './DrawPileViewer';
import { describeConditional, readCardConditionals } from '../utils/cardConditionals';
import { litClauses } from '../utils/conditionalClauses';
import { KEYWORD_INFO, appliedStacks, getAppliedStatuses, getCardKeywords } from './cardKeywords';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import { stabTitle } from './stabText';
import { StatusIcon } from '../theme/kit/StatusIcon';
import { colorFor } from '../screens/runShell';
import { playSfx } from '../audio/AudioEngine';
// The fight draws ticket 66's ruled chassis now — same stylesheet as the shop and the editor.
import '../screens/runShell.css';

/**
 * One line per action, in the player's terms.
 *
 * # IT NAMES THE PRINTED POWER AGAIN — THE LAW IS RETIRED (Henry, 2026-09-11)
 *
 * This helper was the counter-example tickets 13 and 15 cited by name: it printed `action.power`
 * straight out of the data, so `fire_punch_v2` read `⚔️ 30 Fire dmg` in every caster's hand alike.
 * Ticket 22 stripped the figure and left the SHAPE (`⚔️ Damage ×2 hits`).
 *
 * Henry has now retired the law that required that: *"without it players can't compare cards ...
 * We still need to understand power on each card."* The original objection is still true — one
 * `power` in front of three casters produces three different HP swings — but it was an argument
 * for labelling the number honestly, not for hiding it. So the line says **power**, in those
 * words, and the card face's readout beside it says what this caster actually does to that
 * target. Two numbers that never claimed to be the same one.
 */
/*
 * TICKET 160-e1 — an ally card's actions say "an ally", not "the target".
 *
 * `formatAction` reads the ACTION, which only knows `SELF` or `TARGET`; whether a target is a
 * friend is a property of the CARD. So the card's flag is threaded in rather than inferred, and
 * the word changes for every action on it at once — a card that says "an ally gains 3 Sharp" and
 * a tooltip that says "→ the target" is the tooltip the flag exists to fix.
 */
const formatAction = (action: ProgramAction, allyTarget = false): string => {
    /*
     * ── TICKET 155g — WRITTEN AGAINST THE REAL UNION ────────────────────────────────────────
     *
     * Henry, 2026-09-19: *"tooltips are not very helpful"*, with a screenshot reading
     * "STATUS STATUS STATUS".
     *
     * This switched on `APPLY_STATUS`, `REMOVE_STATUS` and `ADD_ENERGY` — three names that are not
     * in `ActionType` and never have been. The real ones are `STATUS`, `CLEANSE` and `ENERGY`, so
     * every status card fell through to `default: return action.type` and printed the enum. The
     * `as string` cast above the switch is what hid it: it widened the discriminant so TypeScript
     * could not tell anyone the cases were unreachable. It is gone, and the `never` check at the
     * bottom means a new `ActionType` is a compile error here rather than a card that explains
     * itself as "TAUNT".
     */
    switch (action.type) {
        case 'ATTACK': {
            const hits = Math.max(1, action.count ?? 1);
            const p = typeof action.power === 'number' ? `${action.power} power` : 'Damage';
            if (action.target === 'SELF') return `⚔️ Recoil onto the caster — ${p}${hits > 1 ? ` ×${hits}` : ''}`;
            return `⚔️ ${p}${hits > 1 ? ` ×${hits} hits` : ''}`;
        }
        case 'HEAL': {
            const who = action.target === 'SELF' ? '' : allyTarget ? ' an ally' : '';
            return typeof action.power === 'number'
                ? `💚 Heals${who} with ${action.power} power`
                : `💚 Restores${who ? who + "'s" : ''} HP`;
        }
        case 'STATUS': {
            // The headline case, and the one that printed "STATUS". Says what lands, how much of
            // it, and on whom — the three things a player is asking.
            const stacks = action.stacks ?? 1;
            const where = action.target === 'SELF' ? 'the caster'
                : action.target === 'Side' || action.target === 'SIDE' ? (allyTarget ? 'your whole side' : 'their whole side')
                : action.target === 'All' || action.target === 'ALL' ? 'everyone'
                : allyTarget ? 'the chosen ally'
                : 'the target';
            return `✦ ${stacks}× ${action.status} → ${where}`;
        }
        case 'CLEANSE':
            return `✖ Clears ${action.status ? String(action.status) : 'every status'}`;
        case 'ENERGY':
            return `⚡ ${(action.amount ?? 0) >= 0 ? '+' : ''}${action.amount ?? 0} Energy`;
        case 'MAX_ENERGY':
            return `⚡ +${action.amount ?? 0} max Energy for the battle`;
        case 'DRAW':
            return `🃏 Draw ${action.count ?? 1}`;
        case 'DISCARD':
            return `🗑 Discard ${action.count ?? 1}`;
        case 'FORCE_DISCARD':
            return `🗑 The target discards ${action.count ?? 1}`;
        case 'EXHAUST':
            return `🔥 Exhausts ${action.count ?? 1} — gone for the fight`;
        case 'RETURN':
            return `↩ Returns ${action.count ?? 1} from the discard`;
        case 'SEARCH':
            return `🔍 Search the deck for a card`;
        case 'GENERATE_CARD':
            return `✨ Adds a card to your hand`;
        case 'MULTIPLY_STATUS':
            return `✦✦ Doubles ${action.status ? String(action.status) : 'a status'} on the target`;
        case 'TRIGGER_STATUS':
            return `⏱ Makes ${action.status ? String(action.status) : 'a status'} tick now`;
        case 'PLAY_LAST_CARD':
            return `↻ Replays the last card you cast`;
        case 'TAUNT':
            return `🛡 Forces the target to attack the caster`;
        case 'BUFF_NEXT_PROGRAM':
            return `⬆ Strengthens the next card you play`;
        case 'REDIRECT_TARGET':
            return `↪ Redirects the incoming attack`;
        case 'SHIFT_STANCE':
            return `🌗 Shifts stance`;
        case 'REVIVE':
            return `♻️ Revives a fallen ally`;
        default: {
            /*
             * EXHAUSTIVE. `never` here means adding an `ActionType` breaks this build rather than
             * shipping a card whose tooltip reads as its own enum — which is exactly what the
             * `as string` cast let happen for three action types.
             */
            const unreachable: never = action.type;
            return String(unreachable);
        }
    }
};

/**
 * TICKET 155g — a constraint, as a sentence the player can act on.
 *
 * `BASE` is the energy check, and it returned `''` so the row would not render — but the section
 * above still opened for it, which is the empty "⚠ REQUIREMENTS" header in Henry's screenshot.
 * It now SAYS the thing, because "Needs 2 EP (have 1)" is the single most actionable line a blocked
 * card can carry, and the caller filters the remaining empties rather than counting them.
 */
const formatConstraint = (
    c: ProgramConstraint,
    effectiveCost: number,
    source: IBattleEntity | null | undefined,
): string => {
    switch (c.type) {
        case 'HAS_STATUS':
            return `Needs ${c.target === 'SELF' ? 'the caster' : 'the target'} to have ${c.value}`;
        case 'HEALTH_THRESHOLD':
            return `Needs HP ${c.value}`;
        case 'BASE':
            return source
                ? `Needs ${effectiveCost} EP (have ${source.currentEnergy})`
                : `Needs ${effectiveCost} EP`;
        case 'NOT_STATUS':
            return `Blocked while ${c.target === 'SELF' ? 'the caster has' : 'the target has'} ${c.value}`;
        default:
            return c.type;
    }
};

const CardHand: React.FC<{
    hoveredEntityId?: string | null;
    onTargetingStart?: (point: { x: number, y: number }, pointer?: { clientX: number, clientY: number }) => void;
    /*
     * `onTargetingEnd` was here and is gone (155, deep dive 7). It was declared, passed by
     * `BattleArena`, and never destructured — so it never fired. The drop is an `onPointerUp` on
     * the StageSlot and on `.battle-screen`, which is where the reset belongs and now happens.
     * A prop that exists, is wired, and does nothing is worse than no prop: it reads as coverage.
     */
}> = ({ hoveredEntityId, onTargetingStart }) => {
    const dispatch = useDispatch();
    const battleState = useSelector((state: RootState) => state.battle.battle);
    const hand = battleState?.playerDeck.hand || [];
    const playerParty = battleState?.playerParty || [];
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const isOurTurn = battleState?.activeSide === 'PLAYER';
    /*
     * TICKET 171h — END TURN with Energy still on the table flashes the button and lights the cards
     * that could still spend it; the second press ends the turn. See `endTurnNudge.ts`.
     */
    const endTurnNudge = useSelector((state: RootState) => state.battle.endTurnNudge);
    const liveNudge = nudgeIsLive(battleState, endTurnNudge) ? endTurnNudge : null;
    const onEndTurn = (): void => {
        playSfx('uiClick');
        const decision = decideEndTurn(battleState, endTurnNudge);
        if (decision.kind === 'nudge') dispatch(nudgeEndTurn(decision.cardIds));
        else dispatch(endTurn());
    };
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

    /*
     * ── TICKET 155b — THE CARD TAKES THE STAGE'S SCALE ──────────────────────────────────────
     *
     * The card was a fixed 180x255 in every window, which is a 1920 card shown at 1280 — and at
     * 1280 it grew the console band to ~390px and pushed the third row of each party off-screen.
     * Scaled and capped at 1.2, a wide screen gets a bigger card and both get the same SHARE of
     * the window.
     *
     * The overlap is solved against the row's real width past eight cards (`fanOverlapFor`), so an
     * eleven-card hand tightens to fit instead of drawing 1,590px wide and clipping the cards at
     * both ends — which were cards the player could not click.
     */
    const viewport = useViewportSize();
    const scale = stageScale(viewport.width, viewport.height);
    // Read once per mount: the settings screen is a route away from a fight, and `loadSettings`
    // is a storage read plus a JSON parse — the cost 155a found in `PlayedCardReveal`.
    const [animate] = useState(() => resolveVfxGates(loadSettings()).animations);
    const cardSize = fanCardSize(scale);
    // The fan's share of the row: the console minus the two piles and the row's own padding.
    const fanRoom = Math.max(320, viewport.width - (PILE_COLUMN_PX + END_TURN_COLUMN_PX) * scale - 80);
    const rowOverlap = fanOverlapFor(hand.length, cardSize.width, fanRoom);

    /*
     * ── TICKET 155b / 155f — THE PILES, LIFTED OUT OF THE FOOTER ────────────────────────────
     *
     * Declared here and placed into the hand row, because §2c draws `draw | fan | discard` on one
     * line and the second row they used to live in was most of the height the console had taken
     * from the board.
     *
     * 155f falls out of the move. `.pile-count` is `position: absolute` and was anchoring to
     * `.pile-indicator` — the whole COLUMN, which contained the End Turn button — so the discard
     * count sat on the button and the draw count sat on "+N/turn". Each count is now inside a
     * `.pile-stack` that wraps only the card it counts, which is the element it was always
     * describing.
     */
    const drawPile = (
        <div className="pile-indicator draw-pile hand-piles">
            <span className="pile-label">DRAW</span>
            {/*
              * TICKET 145d — the pile IS a card, face down, with its count on its corner. A draw
              * pile drawn as a card back says "these are cards" without a label, and the count
              * belongs ON the thing it counts rather than in a row of numbers at the top of the
              * screen — which is where §1 cut it from. Two stacked shadows, because a pile of one
              * and a pile of thirty should not look identical.
              */}
            {/* TICKET 184a: the pile opens onto its cards, sorted and stacked, like the discard. The
                draw formula that was the column's tooltip is now the button's, so it still reads
                on hover. */}
            <DrawPileViewer
                drawpile={battleState?.playerDeck.drawpile ?? []}
                toggleTitle={drawTooltipLines(draw).join('\n')}
            >
                <PileBacks kind="draw" count={drawPileCount} />
            </DrawPileViewer>
        </div>
    );

    const discardPile = (
        <div className="pile-indicator discard-pile hand-piles">
            <span className="pile-label">DISCARD</span>
            {/*
              * The discard is a SINGLE card back, not a stack — §2c draws it that way and the
              * distinction is honest: the draw pile is what you will get and the discard is what
              * is spent, so only one of the two is worth reading a depth off.
              */}
            {/* 2026-09-25: the pile opens onto its cards - "what did the last card do". */}
            <DiscardPileViewer discard={battleState?.playerDeck.discard ?? []}>
                <PileBacks kind="discard" count={discardPileCount} />
            </DiscardPileViewer>
            {/*
              * END TURN sits DIRECTLY UNDER THE DISCARD (§2c): the button and the pile it feeds
              * are one column rather than two things at opposite ends of the console.
              */}
            <EndTurnButton
                disabled={!isOurTurn}
                onPress={onEndTurn}
                nudgeCount={liveNudge ? liveNudge.cardIds.length : null}
            />
        </div>
    );

    return (
        <div className="hand-container">
            {/*
              * TICKET 155b — `draw | fan | discard` ON ONE ROW, which is what 145 §2c drew.
              *
              * The piles used to sit in a `.hand-footer` UNDER the fan, and that second row was
              * most of the 150px the console had quietly taken from the board. On one line they
              * bracket the hand they feed, and the console gives the stage its height back.
              */}
            <div className="hand-row">
                {drawPile}
                <div className="hand-fan">
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
                            .map((c) => formatConstraint(c, effectiveCost, source))
                            /*
                             * TICKET 155g — drop the empties BEFORE the section decides whether to
                             * open. `formatConstraint` returns `''` for BASE (the energy check has
                             * its own readout), and the section only counted rows — so a card whose
                             * single unmet constraint was BASE rendered an "⚠ REQUIREMENTS" header
                             * with nothing under it. That is Henry's empty header.
                             */
                            .filter((line) => line.length > 0);
                        if (isBlocked) constraints.push(blockReason ?? 'Cannot be paid for right now');
                        // Per-unit OS card limit (e.g. YMIR v2 GLACIAL_PACE_OS: 2 cards/turn).
                        // The reducer rejects the play silently, so the tooltip carries the reason.
                        const sourceOS = source?.activeOS ? getOSBehavior(source.activeOS) : undefined;
                        if (source && sourceOS?.maxCardsPerTurn !== undefined &&
                            (source.playsThisTurn ?? 0) >= sourceOS.maxCardsPerTurn) {
                            const osLabel = instinctName(sourceOS.name);
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

                        /*
                         * THE CARD'S "IF", ANSWERED — Henry, 2026-09-25: *"We also need an
                         * indicator if a conditional is true. Like 'if dazed draw one card'."*
                         *
                         * Read for the same (caster, target) pair the numbers above are quoted
                         * for, so a card that says `96 DMG vs SKOLL` lights its rider against
                         * SKOLL and nobody else. `lit` is the clause of the description to paint
                         * green; `conditionalMet` is the same answer per action for the tooltip.
                         */
                        const conditionals = readCardConditionals(battleState, source, previewTarget, data);
                        const lit = litClauses(data, conditionals);
                        const conditionalMet = new Map(conditionals.map((r) => [r.actionIndex, r]));
                        const cardKeywords = getCardKeywords(data);
                        const appliedStatuses = getAppliedStatuses(data);

                        return (
                            <motion.div
                                key={card.id}
                                /*
                                 * TICKET 155, DEEP DIVE 8 — the fan reads the switch too.
                                 *
                                 * These transitions ignored both `prefers-reduced-motion` and
                                 * 146a's new `animations` switch: `resolveVfxGates` was never
                                 * consulted in this file, so a player who turned animations off
                                 * still had cards springing in and out of the hand — which is the
                                 * most-moving thing on the screen.
                                 *
                                 * Off means the card is simply THERE, at its place in the arch.
                                 * The arch itself stays: it is layout, not motion.
                                 */
                                initial={animate ? { opacity: 0, y: 40, scale: 0.9 } : false}
                                animate={{
                                    opacity: isUnplayable ? 0.6 : 1,
                                    y: isSelected || isHovered ? -(fan.lift + FAN_SELECTED_LIFT + 20) : -fan.lift,
                                    scale: isSelected ? 1.08 : (isHovered ? 1.05 : 1),
                                    rotate: isSelected || isHovered ? 0 : fan.rotation,
                                }}
                                exit={animate ? { opacity: 0, scale: 0.8 } : { opacity: 0 }}
                                transition={animate ? { duration: 0.2 } : { duration: 0 }}
                                /*
                                 * `face-open` is GONE (Henry, 2026-09-25: *"I don't like that the
                                 * descriptions are hidden while in hand"*). It hid the description
                                 * until a card was lifted, which was his own 09-20 call for wide
                                 * hands; he has reversed it, so the description always shows.
                                 */
                                className={`rs-card hand-card ${isSelected ? 'selected' : ''} ${isUnplayable ? 'grayscale' : ''} ${liveNudge?.cardIds.includes(card.id) ? 'nudge-playable' : ''}`}
                                /*
                                 * TICKET 155, DEEP DIVE 8 — a card is a control.
                                 *
                                 * These were `div`s with a click handler: no role, no tab stop, no
                                 * keyboard path, and nothing for a screen reader to announce. The
                                 * hotkey strip says `1-9 SELECT CARD`, so the keyboard path exists
                                 * — it just was not on the cards themselves, which means Tab
                                 * skipped the entire hand.
                                 *
                                 * `role`/`tabIndex` rather than a real `<button>`: framer-motion is
                                 * driving transforms on this element, and `motion.button` inside a
                                 * flex row reintroduces the browser's own button metrics that the
                                 * fan's geometry would then have to fight.
                                 */
                                /*
                                 * TICKET 183c — the two states the stylesheet paints on the card:
                                 * STAB turns the frame the element's colour (and the hover says
                                 * why), selected is the yellow ring. Attributes rather than
                                 * classes so every other surface that shows a card can set the same
                                 * two words.
                                 */
                                data-stab={isStabMatch ? 'true' : undefined}
                                data-selected={isSelected ? 'true' : undefined}
                                role="button"
                                tabIndex={0}
                                aria-pressed={isSelected}
                                aria-disabled={isUnplayable}
                                aria-label={`${data.name}, ${displayCost} energy`}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                    e.preventDefault();
                                    playSfx(isUnplayable ? 'uiError' : 'uiClick');
                                    dispatch(selectCard(isSelected ? null : card.id));
                                }}
                                /*
                                 * Ticket 22: the refusal also rides the card frame, not only the
                                 * hover tooltip below. The tooltip needs a deliberate hover on a
                                 * card the player has already written off as "greyed out", which is
                                 * the one interaction they will not perform — so the reason it is
                                 * greyed out was, in practice, invisible. Same convention as
                                 * `MacroRack`'s disabled slots: never inert without a sentence.
                                 */
                                title={[...constraints, ...(isStabMatch ? [stabTitle()] : [])].join(' · ') || undefined}
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
                                    /*
                                     * TICKET 155c. `preventDefault` FIRST, before anything that
                                     * could return early: the browser's default for a pointerdown
                                     * on text is to begin a selection, and Henry's *"any time I
                                     * drag a card all the text gets highlighted"* is that default
                                     * running. `user-select: none` on `.battle-screen` handles the
                                     * painting; this stops the drag being a selection gesture at
                                     * all.
                                     *
                                     * NOT `setPointerCapture`. The drop is an `onPointerUp` on the
                                     * StageSlot, and capturing here would keep every subsequent
                                     * pointer event on the card — so the slot would never see the
                                     * release and no card could ever be played.
                                     */
                                    e.preventDefault();
                                    // Grayed-out cards still open for reading, but buzz to
                                    // signal the play itself is blocked.
                                    playSfx(isUnplayable ? 'uiError' : 'uiClick');
                                    justSelectedRef.current = !isSelected;
                                    dispatch(selectCard(card.id));
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onTargetingStart?.({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2
                                    }, {
                                        clientX: e.clientX,
                                        clientY: e.clientY
                                    });
                                }}
                                onMouseEnter={() => setHoveredCardId(card.id)}
                                onMouseLeave={() => setHoveredCardId(null)}
                                style={{
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    // §2c: below the card, so a rotation swings the top rather than the foot.
                                    transformOrigin: FAN_TRANSFORM_ORIGIN,
                                    marginLeft: index === 0 ? 0 : rowOverlap,
                                    width: cardSize.width,
                                    height: cardSize.height,
                                    /*
                                     * The SAME pair, handed to the face. `.rs-card` sizes itself
                                     * from `--cw/--ch`, so setting only the wrapper left the two
                                     * disagreeing and the face won — which is how the card stayed
                                     * 180px wide after the fan was changed to 140.
                                     */
                                    ['--cw' as string]: `${cardSize.width}px`,
                                    ['--ch' as string]: `${cardSize.height}px`,
                                    ['--ah' as string]: `${Math.round(36 * Math.min(Math.max(scale, 0.75), 1.2))}px`,
                                    zIndex: isSelected ? 100 : (isHovered ? 99 : index),
                                    /*
                                     * TICKET 155e — the one-line defect.
                                     *
                                     * `--el` is what the shared card shell paints with, and the
                                     * hand was the only caller in the game that never set it.
                                     * Undefined, it does not fall back — it invalidates: the
                                     * energy pips are transparent (`runShell.css:193`), the art
                                     * gradient is an invalid value so the band renders blank, and
                                     * the element foot bar disappears. Henry's *"energy pips don't
                                     * appear"* and *"cards don't look like the shop cards"* are
                                     * both this, and both are this line.
                                     *
                                     * `colorFor` rather than `getElementAccent` because that is
                                     * what every other `--el` caller uses (shop, editor, boundary
                                     * alert) — the point of the row is that the hand joins them.
                                     */
                                    ['--el' as string]: colorFor(data.element),
                                }}
                            >
                                <HandCardFace
                                    data={data}
                                    displayCost={displayCost}
                                    originalCost={card.currentCost}
                                    isDiscounted={isDiscounted}
                                    isBlocked={isBlocked}
                                    blockReason={blockReason ?? undefined}
                                    preview={preview}
                                    replayTargetName={replayTargetName}
                                    showReplay={!!data.actions?.some((a) => a.type === 'PLAY_LAST_CARD')}
                                    lit={lit}
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
                                                {data.actions.map((action, i) => {
                                                    /*
                                                     * A conditional effect says its condition and
                                                     * whether it holds — the same answer that lights
                                                     * the clause on the face. `null` (no caster, or
                                                     * nobody to aim at) prints the condition with no
                                                     * verdict, because unknown is not "not met".
                                                     */
                                                    const reading = conditionalMet.get(i);
                                                    const cls = reading?.met === true ? 'tooltip-action is-met'
                                                        : reading?.met === false ? 'tooltip-action is-unmet'
                                                        : 'tooltip-action';
                                                    return (
                                                        <div key={i} className={cls}>
                                                            {formatAction(action, data.allyTarget)}
                                                            {reading && (
                                                                <span className="tooltip-cond">
                                                                    {' '}{reading.constraints.map(describeConditional).join(' and ')}
                                                                    {reading.met === true && ' ✓'}
                                                                    {reading.met === false && ' (not met)'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/*
                                              * THE CHIPS' NEW HOME — Henry, 2026-09-25: *"The
                                              * statuses that show on the bottom should just be in
                                              * the tooltip."* The face lost the row; the tooltip
                                              * gains the label (with its stacks) and the glossary
                                              * line the chip used to hide behind a second hover.
                                              */}
                                            {(cardKeywords.length > 0 || appliedStatuses.length > 0) && (
                                                <div className="tooltip-section">
                                                    <div className="tooltip-label">Statuses &amp; keywords</div>
                                                    {cardKeywords.map((k) => (
                                                        <div key={k} className="tooltip-glossary">
                                                            <span className="tooltip-glossary-name" style={{ color: KEYWORD_INFO[k].color }}>{KEYWORD_INFO[k].label}</span>
                                                            {' '}{KEYWORD_INFO[k].description}
                                                        </div>
                                                    ))}
                                                    {appliedStatuses.map((st) => {
                                                        const stacks = appliedStacks(data, st);
                                                        const g = statusGlossary[st];
                                                        return (
                                                            <div key={st} className="tooltip-glossary">
                                                                <span className="tooltip-glossary-name" style={{ color: STATUS_COLORS[st] }}>
                                                                    <StatusIcon status={st} size={11} />{` ${stacks > 1 ? `${stacks} ` : ''}${g.name}`}
                                                                </span>
                                                                {' '}{g.description}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
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
                {discardPile}
            </div>

            {/*
              * ONE line under the fan, not two rows beside the piles. The caster banner and the
              * hotkey strip were a `.hand-console-center` column between the piles, colliding with
              * the arch; the hotkeys were 8px type nobody could read. See `.hand-underline`.
              */}
            {/*
              * TICKET 182a — "NO CASTER — PRESS W / E / R" and the "?" are cut. The keys still work;
              * their map is the hover on this strip. The "READING FOR" line stays only where it
              * answers a question: with one monster there is nothing to tell apart, and 182a picks
              * that monster for the player.
              */}
            <div className="hand-underline" title={keybindLegend()}>
                {caster && playerParty.length > 1 && (
                    <span data-testid="hand-caster-banner">
                        READING FOR <strong>{caster.name.toUpperCase()}</strong>
                    </span>
                )}
            </div>
        </div>
    );
};

export default CardHand;
