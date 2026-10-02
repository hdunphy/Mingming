/**
 * TICKET 177b — THE NAMED FEATURES A SINGLE ACTION IS SCORED ON.
 *
 * The cheap policy never searches. It applies each legal action once, asks "what did that do?" of
 * the two states either side of it, and adds up weight × feature. This file is the "what did that
 * do?" and nothing else: a pure function from (before, after, action, side) to a fixed list of
 * numbers. The weights that turn the numbers into a decision live in `weights.json`, so Henry can
 * read them, hand-edit them, or ask the fitter for new ones without touching this file.
 *
 * EVERY NUMBER IS FROM THE ACTING SIDE'S POINT OF VIEW: bigger is better for `side` unless the name
 * says it is a cost (`allyHpLost`, `allyDeaths`, `energySpent`). A cost still has a plain positive
 * value here; its weight is what makes it a cost.
 *
 * UNITS. HP is the engine's own (display HP × `NUMBER_SCALE`), so the HP features divide by 100 to
 * land near 1 for a hit that takes ten display HP. The status features are in the AI's eval
 * currency (`statusValue`) and divide by 100 for the same reason. `evalDelta` is the full AI's own
 * eval, raw, because it is the one feature whose job is to carry the full AI's opinion across.
 *
 * END_TURN. Its `after` is the state after the turn really ended, which includes the OTHER side's
 * pre-turn (their draw, their start-of-turn ticks) and the acting side's own end-of-turn refills.
 * Reading energy and hand size off that state would score a pass on the opponent's draw, so the
 * three resource features (`energySpent`, `energyLeft`, `cardsDrawn`) read an END_TURN off `before`
 * instead: spent 0, left = what was held, drawn 0. Everything else reads `after` for END_TURN as
 * for any other action, so a Burn that will tick at the end of the turn is seen.
 *
 * Engine module: no React, no Redux, no `Math.random`, no `Date.now()`.
 */

import type { BattleAction } from '../../battleReducer';
import type { IBattleEntity, IBattleState } from '../../types';
import { evaluateState, statusValue } from '../TacticalAI';

/** The feature list, in the order the weights table prints. Adding one is a schema change. */
export const FEATURE_NAMES = [
    'enemyHpRemoved',
    'allyHpLost',
    'enemyKills',
    'allyDeaths',
    'overkill',
    'shieldGained',
    'enemyStatusValue',
    'allyStatusValue',
    'energySpent',
    'energyLeft',
    'cardsDrawn',
    'lowestEnemyHpFraction',
    'isEndTurn',
    'evalDelta',
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];
export type FeatureVector = Record<FeatureName, number>;

/** HP and status value are divided by this so a typical play lands near 1. */
const SCALE = 100;

const living = (party: ReadonlyArray<IBattleEntity>): IBattleEntity[] => party.filter((e) => e.currentHp > 0);

/** Σ over the entities in `after`, each paired with its `before` self by id. */
function pairedSum(
    before: ReadonlyArray<IBattleEntity>,
    after: ReadonlyArray<IBattleEntity>,
    read: (b: IBattleEntity, a: IBattleEntity) => number,
): number {
    const byId = new Map(before.map((e) => [e.id, e]));
    let total = 0;
    for (const a of after) {
        const b = byId.get(a.id);
        if (b) total += read(b, a);
    }
    return total;
}

/** Absorb held in a Bark Shield status, in HP: `stacks`% of max HP, as the eval prices it. */
function barkShieldHp(entity: IBattleEntity): number {
    let total = 0;
    for (const status of entity.statusEffects) {
        if (status.type === 'BarkShield') total += (status.stacks / 100) * entity.maxHp;
    }
    return total;
}

/** Summed `statusValue` over every living entity of a party. Positive is good for its holders. */
function statusTotal(party: ReadonlyArray<IBattleEntity>): number {
    let total = 0;
    for (const entity of living(party)) {
        for (const status of entity.statusEffects) total += statusValue(status.type, status.stacks, entity);
    }
    return total;
}

/**
 * What `actionFeatures` reads off the BEFORE state, which is the same for every action of a
 * decision. Cached by the state object itself (states are immutable), so a decision with thirty
 * legal actions evaluates its starting position once rather than thirty times. A WeakMap: the entry
 * goes when the state does.
 */
interface BeforeReading {
    readonly evalScore: number;
    readonly allyStatus: number;
    readonly enemyStatus: number;
}

const beforeReadings = new WeakMap<IBattleState, Partial<Record<'PLAYER' | 'ENEMY', BeforeReading>>>();

function readBefore(before: IBattleState, side: 'PLAYER' | 'ENEMY'): BeforeReading {
    let bySide = beforeReadings.get(before);
    if (!bySide) {
        bySide = {};
        beforeReadings.set(before, bySide);
    }
    let reading = bySide[side];
    if (!reading) {
        const myKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
        const oppKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';
        reading = {
            evalScore: evaluateState(before, side),
            allyStatus: statusTotal(before[myKey]),
            enemyStatus: statusTotal(before[oppKey]),
        };
        bySide[side] = reading;
    }
    return reading;
}

export function actionFeatures(
    before: IBattleState,
    after: IBattleState,
    action: BattleAction,
    side: 'PLAYER' | 'ENEMY',
): FeatureVector {
    const myKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const oppKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';
    const deckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const isEndTurn = action.type === 'END_TURN';

    const enemyHpRemoved = pairedSum(before[oppKey], after[oppKey], (b, a) => Math.max(0, b.currentHp - a.currentHp)) / SCALE;
    const allyHpLost = pairedSum(before[myKey], after[myKey], (b, a) => Math.max(0, b.currentHp - a.currentHp)) / SCALE;

    const enemyKills = pairedSum(before[oppKey], after[oppKey], (b, a) => (b.currentHp > 0 && a.currentHp <= 0 ? 1 : 0));
    const allyDeaths = pairedSum(before[myKey], after[myKey], (b, a) => (b.currentHp > 0 && a.currentHp <= 0 ? 1 : 0));

    // Damage beyond zero HP. HP floors at 0, so two states cannot show it; the engine's own
    // per-action `damageLedger` (`IDamageRecord`: raw = absorbed + applied + overkill) can.
    const enemyIds = new Set(after[oppKey].map((e) => e.id));
    let overkill = 0;
    for (const hit of after.damageLedger ?? []) {
        if (enemyIds.has(hit.targetId)) overkill += Math.max(0, hit.raw - hit.absorbed - hit.applied);
    }
    overkill /= SCALE;

    // Absorbs on allies: temp HP plus Bark Shield, counted only when it GREW. A shield being shot
    // down is `allyHpLost`'s business (and the ledger's), not a negative here.
    const shieldGained = pairedSum(before[myKey], after[myKey], (b, a) => (
        Math.max(0, (a.tempHp - b.tempHp) + (barkShieldHp(a) - barkShieldHp(b)))
    )) / SCALE;

    // Debuffing an enemy makes the enemy's status total MORE negative, which is good for `side`.
    const reading = readBefore(before, side);
    const enemyStatusValue = (reading.enemyStatus - statusTotal(after[oppKey])) / SCALE;
    const allyStatusValue = (statusTotal(after[myKey]) - reading.allyStatus) / SCALE;

    // Resources: an END_TURN reads `before`, for the reason in the header.
    const energyAfter = isEndTurn ? before : after;
    const energySpent = isEndTurn ? 0 : pairedSum(before[myKey], after[myKey], (b, a) => Math.max(0, b.currentEnergy - a.currentEnergy));
    const energyLeft = living(energyAfter[myKey]).reduce((sum, e) => sum + e.currentEnergy, 0);
    // A play removes one card from hand; anything above "one fewer" was drawn by the card.
    const cardsDrawn = isEndTurn
        ? 0
        : Math.max(0, after[deckKey].hand.length - (before[deckKey].hand.length - 1));

    const stillStanding = living(after[oppKey]);
    const lowestEnemyHpFraction = stillStanding.length === 0
        ? 0
        : Math.min(...stillStanding.map((e) => e.currentHp / Math.max(1, e.maxHp)));

    return {
        enemyHpRemoved,
        allyHpLost,
        enemyKills,
        allyDeaths,
        overkill,
        shieldGained,
        enemyStatusValue,
        allyStatusValue,
        energySpent,
        energyLeft,
        cardsDrawn,
        lowestEnemyHpFraction,
        isEndTurn: isEndTurn ? 1 : 0,
        evalDelta: evaluateState(after, side) - reading.evalScore,
    };
}

/** Σ weight × feature. A feature a weights file leaves out counts as weight 0. */
export function scoreFeatures(
    features: Readonly<Record<FeatureName, number>>,
    weights: Readonly<Partial<Record<FeatureName, number>>>,
): number {
    let score = 0;
    for (const name of FEATURE_NAMES) score += (weights[name] ?? 0) * features[name];
    return score;
}
