/**
 * TICKET 177a — EVERY SINGLE PLAY AVAILABLE RIGHT NOW, IN THE ORDER THE SEARCH WALKS THEM.
 *
 * This is the enumeration that used to live inside `findBestSequence` (`TacticalAI.ts`), moved out
 * UNCHANGED so a second consumer can read the same list: the cheap policy (177b) looks at each play
 * once instead of searching sequences of them. Nothing about the order, the copy dedupe or the
 * target choice differs from what the search did before; `aiDeterminism.test.ts` proves that on
 * twenty fixed fights.
 *
 * WHAT IS NOT HERE. The enumeration lists plays the engine's own cost and constraint checks allow
 * (affordable, not Stunned, not Asleep, a legal target). It does not run the reducer, so a play the
 * reducer would still reject as a no-op is listed; the search drops those (`nextState === state`)
 * and so does the cheap policy. Keeping the reducer out of here is what lets the search keep its
 * one simulation per play and the census its `simulated` counter.
 *
 * Engine module: no React, no Redux, no `Math.random`, no `Date.now()`.
 */

import { validateProgramConstraints, getEffectiveCardCost, type BattleAction } from '../battleReducer';
import { GetProgramData } from '../data/programRegistry';
import { executeCostCalculated } from '../resolutionEngine';
import type { IBattleState, IBattleEntity } from '../types';

/** The three census counters the enumeration owns (`TacticalAI.census` has the rest). */
export interface EnumerationTally {
    enumerated: number;
    duplicate: number;
    deduped: number;
}

/**
 * Every PLAY_PROGRAM available to `side` right now: each distinct card in hand, by each living
 * caster that can pay for it, at each valid target. No `END_TURN`.
 *
 * `tally`, when given, is incremented exactly as `findBestSequence` incremented `census` under
 * `AI_CENSUS=1`, so the census report is the same number it always was. Left out, nothing is
 * counted and no set is built.
 *
 * Empty when either side has no one standing: there is nothing left to play.
 */
export function legalPlays(
    state: IBattleState,
    side: 'PLAYER' | 'ENEMY',
    tally?: EnumerationTally,
): BattleAction[] {
    const activeDeckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const activePartyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const oppPartyKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';

    const hand = state[activeDeckKey].hand;
    const myParty = state[activePartyKey].filter(e => e.currentHp > 0);
    const oppParty = state[oppPartyKey].filter(e => e.currentHp > 0);

    if (myParty.length === 0 || oppParty.length === 0) return [];

    const plays: BattleAction[] = [];
    const siblings = tally ? new Set<string>() : null;

    /*
     * TICKET 144a — THE AI CONSIDERS A HAND IN A CANONICAL ORDER, NOT IN DRAW ORDER.
     *
     * WHAT THIS CHANGES, IN ONE SENTENCE: the order the SEARCH walks the hand in. Nothing writes
     * back to `state`, so the hand a player is holding — in the UI, in the reducer, in the save —
     * is still in draw order, and the card a player clicks is still the card they clicked.
     *
     * WHY. The search used to walk the hand in draw order, and `bestScore` improves on a strict
     * `>`, so among equal-scoring lines the first one VISITED wins. That made the AI's decision a
     * function of where a card happened to land when it was drawn — which is an artifact of the
     * shuffle, not information about the board. `scratch/probe144a.ts` caught it: playing the FIRST
     * copy of a pair versus the SECOND leaves the same cards in hand in a different order (removing
     * index 0 leaves a different remainder than removing index 1), and 23 of 37 interchangeable
     * groups across three matchups diverged on the first ply because of it. The engine already knew
     * the shape of this bug — the beam's own comment says restoring enumeration order is "what
     * stops the beam changing anything it did not prune… that bug cost a measurement".
     *
     * WHAT IT BUYS. Once order is a function of the hand's CONTENTS rather than its history, the
     * two copies of a card really are interchangeable: they sort adjacently, the remainder after
     * playing either is identical key-for-key, and the subtree beneath the second is provably the
     * same search as beneath the first. So it can be skipped — which is the whole point, because a
     * hand is full of pairs and branching compounds at MAX_DEPTH = 3.
     *
     * THE SORT KEY is total and deterministic: `dataId`, then cost, then banked growth, then the
     * instance id as the final tie-break (assigned once by `instantiateDeck`, stable across
     * reshuffles). The first three are the fields that make two copies genuinely the same card; the
     * fourth only exists so the order can never depend on array position.
     *
     * THIS MOVES NUMBERS, ON PURPOSE, ONCE. Every measurement before it was taken against an AI
     * that read its own draw order. That is the rebaseline this row costs, and it is the reason it
     * is not gated on bit-identity like 144b/c/d.
     */
    const growthOf = (id: string): number => state.counters?.[`card_growth:${id}`] ?? 0;
    const orderedHand = [...hand].sort((a, b) => (
        a.dataId < b.dataId ? -1 : a.dataId > b.dataId ? 1
            : a.currentCost - b.currentCost
            || growthOf(a.id) - growthOf(b.id)
            || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    ));

    let previousKey: string | null = null;

    for (const card of orderedHand) {
        // Copies sort adjacently, so one comparison against the previous card is the whole dedupe.
        const key = `${card.dataId}|${card.currentCost}|${growthOf(card.id)}`;
        if (key === previousKey) {
            if (tally) tally.deduped++;
            continue;
        }
        previousKey = key;

        const programData = GetProgramData(card.dataId);

        // Determine valid targets based on card target type
        let potentialTargets: IBattleEntity[] = [];

        if (programData.allyTarget) {
            /*
             * TICKET 160-e1 — FIRST, ahead of every heuristic below it.
             *
             * The branches after this one INFER a card's side from its payload: "it heals and does
             * not attack, so it is for an ally". That inference is what `allyTarget` replaces, and
             * it gets three of the eight new cards wrong — `bolster` (3 Sharp), `shell_share`
             * (6 Bark Shield) and `howl` (1 Strength to the side) carry no HEAL at all, so the AI
             * would have enumerated them against the enemy party and then scored handing the
             * opponent a buff.
             *
             * A `Side` ally card still enumerates every friendly body: `actionTargetIds` widens it
             * to the caster's whole side regardless, so the choice is free, but the search must see
             * at least one legal target or the card is never considered.
             */
            potentialTargets = [...myParty];
        } else if (programData.target === 'Self') {
            potentialTargets = [...myParty]; // Self cards target own units
            // A lifesteal card (ATTACK on TARGET plus HEAL on SELF) is an attack, not a
            // heal: its payload target is consumed by the ATTACK, and the HEAL resolves
            // against the source regardless. Bucketing it with heals aimed the attack at
            // the caster, so crimson_draw/blood_rite/leech_strike/drain_life hit their own
            // Mingming and dealt zero to the opponent. Only cards with no TARGET-scoped
            // ATTACK are ally-targeting.
        } else if (
            programData.actions.some(a => a.type === 'HEAL') &&
            !programData.actions.some(a => a.type === 'ATTACK' && a.target === 'TARGET') &&
            programData.target !== 'Side'
        ) {
            potentialTargets = [...myParty]; // Heal cards target allies
        } else if (programData.target === 'Side' || programData.target === 'All') {
            // Side/All can target either side; try both
            potentialTargets = [...oppParty, ...myParty];
        } else {
            potentialTargets = [...oppParty]; // Single attacks target enemies
        }

        for (const source of myParty) {
            // Per-source, per-candidate: an X-cost card prices itself at this source's
            // current Energy, so the search sees its real cost without special-casing.
            const printedCost = getEffectiveCardCost(source, programData, card.currentCost);
            // Ticket 36: onCostCalculated can zero a card's cost (hel_v2 UNDERWORLD_GATEWAY).
            // getEffectiveCardCost does NOT run that hook - the reducer applies it separately
            // in handlePlayProgram - so the AI must price the card the same way or it will skip
            // cards it can actually afford. Without this, Hel never considers soul_tithe (3e on
            // a 2-Energy frame) and it measures as a 100% dead card for a reason that looks
            // nothing like balance.
            //
            // The returned state is DISCARDED on purpose: the search must not leak state, and
            // cost hooks are modifiers, not mutators. Target is `undefined` here because the
            // candidate target is not chosen until the loop below - the signature allows it,
            // and inventing one would silently mis-price target-conditional cost hooks.
            const effectiveCost = executeCostCalculated(state, source, undefined, programData, printedCost).cost;
            if (source.currentEnergy < effectiveCost) continue;

            // A Self card ignores the loop variable - `effectiveTargetId` below is the CASTER - so
            // iterating every potential target emits the IDENTICAL action once per target and
            // simulates it from scratch each time, then recurses into an identical subtree. In 1v1
            // there is one target and it costs nothing; in 3v3 `AI_CENSUS=1` measured it at 18.1%
            // of all simulations. Collapsing it is exact: the removed actions are byte-identical to
            // the one kept.
            //
            // It is exact per candidate but NOT a no-op on the decision, and that is a fix rather
            // than a regression: `getBestAction` takes the top `LOOKAHEAD_TOP_N` candidates, and
            // those slots were being filled with three copies of one action, so the lookahead was
            // examining one distinct line where it believed it was examining three.
            const targetsForSource = programData.target === 'Self' ? [source] : potentialTargets;

            for (const target of targetsForSource) {
                // Validate constraints BEFORE simulating
                if (!validateProgramConstraints(state, source, target, programData, effectiveCost)) {
                    continue; // Skip this card/target combo — constraints not met
                }

                // For Self cards, the effective target is always the source
                const effectiveTargetId = programData.target === 'Self' ? source.id : target.id;

                const action: BattleAction = {
                    type: 'PLAY_PROGRAM',
                    payload: {
                        sourceId: source.id,
                        targetId: effectiveTargetId,
                        programId: card.id
                    }
                };

                if (siblings && tally) {
                    tally.enumerated++;
                    const k = `${source.id}|${effectiveTargetId}|${card.id}`;
                    if (siblings.has(k)) tally.duplicate++; else siblings.add(k);
                }

                plays.push(action);
            }
        }
    }

    return plays;
}

/**
 * Every single action available to `side` right now: `legalPlays`, then `END_TURN` last.
 *
 * `END_TURN` is always legal, including with an empty hand or nobody left to fight, so the list is
 * never empty. It is LAST on purpose: a tie goes to the earlier action, so a play that scores
 * exactly what ending the turn scores is preferred to ending it.
 */
export function legalActions(state: IBattleState, side: 'PLAYER' | 'ENEMY'): BattleAction[] {
    return [...legalPlays(state, side), { type: 'END_TURN' }];
}
