/**
 * Closed-form TTK matrix - a FAST APPROXIMATION, NOT BALANCE TRUTH.
 *
 * WHAT THIS MODEL IS
 * ------------------
 * One `calculateDamage` call per side against a zero-IV unit, then `ttk = ceil(maxHp /
 * damage)`. That is the whole model. It has no statuses, no daemon hooks, no cards, no
 * energy, no AI and no turn order - two units stand still and trade one fixed hit per turn
 * until one falls over. Real battles in this engine are decided by which cards the
 * `TacticalAI` finds and which statuses stick, none of which exists here.
 *
 * So a number out of this file is a stat-curve sanity check - does fenrir two-shot kraken -
 * and not a balance verdict. The balance verdict lives in
 * `src/debug/balance/`: seeded `battleReducer` battles with both sides played by the
 * `TacticalAI`, written to `docs/balance/balance_report.json` by `npm run balance`.
 *
 * WHY IT IS KEPT ANYWAY
 * ---------------------
 * It is instant. `BalanceTester` recomputes the whole matrix as the power slider drags, which
 * a real batch (seconds per matchup, minutes per suite) cannot do at any quality of
 * implementation. Deleting it would cost that interaction and buy nothing.
 *
 * The label is the point: the two tools *will* disagree, often loudly, and this notice is
 * what makes that expected rather than a bug report. See
 * `docs/wayfinder/debug-toolkit/tickets/08-batch-sim-auditor-design.md` section 5.
 */
import { calculateDamage } from '../combatUtils';
import { initializeBattleEntity } from '../types';
import type { IBattleEntity, ProgramData, IBattleState } from '../types';
import { MingmingRegistry } from '../data/mingmingRegistry';

export interface SIM_TTK_Result {
    attackerId: string;
    targetId: string;
    damage: number;
    hp: number;
    ttk: number;
}

export interface MatchupResult {
    sideA: SIM_TTK_Result;
    sideB: SIM_TTK_Result;
}

/**
 * Calculates Turn to Kill (TTK) for a 1v1 matchup.
 */
export function simulate1v1(
    idA: string,
    idB: string,
    power: number
): MatchupResult {
    const defA = MingmingRegistry[idA];
    const defB = MingmingRegistry[idB];

    if (!defA || !defB) throw new Error("Invalid Mingming ID");

    // Initialize as Persistent Instance. Ticket 21: no level — `initializeBattleEntity` builds
    // every unit at CALIBRATION_LEVEL, so there is no per-side level to pass in any more.
    const instanceA = { id: 'A', definitionId: idA };
    const instanceB = { id: 'B', definitionId: idB };

    // Initialize as Battle Entity
    const entityA = initializeBattleEntity(instanceA as any, defA);
    const entityB = initializeBattleEntity(instanceB as any, defB);

    // Mock State for calculateDamage
    const mockState: IBattleState = {
        sessionId: 'sim',
        seed: '0',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        logs: [],
        playerParty: [entityA],
        enemyParty: [entityB],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        nonNaturalCardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        osLogs: [],
        procs: []
    };

    // Assume attack element matches attacker's primary element
    const programA: ProgramData = {
        id: 'sim_atk_a',
        name: 'Simulated Attack',
        description: '',
        element: entityA.primaryElement,
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [],
        actions: [],
        rarity: 'Common'
    };

    const programB: ProgramData = {
        id: 'sim_atk_b',
        name: 'Simulated Attack',
        description: '',
        element: entityB.primaryElement,
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [],
        actions: [],
        rarity: 'Common'
    };

    const damageA = calculateDamage(entityA, entityB, programA, power, mockState);
    const damageB = calculateDamage(entityB, entityA, programB, power, mockState);

    return {
        sideA: {
            attackerId: idA,
            targetId: idB,
            damage: damageA,
            hp: entityB.maxHp,
            ttk: damageA > 0 ? Math.ceil(entityB.maxHp / damageA) : Infinity
        },
        sideB: {
            attackerId: idB,
            targetId: idA,
            damage: damageB,
            hp: entityA.maxHp,
            ttk: damageB > 0 ? Math.ceil(entityA.maxHp / damageB) : Infinity
        }
    };
}

export interface AttackerAverage {
    id: string;
    avgDamage: number;
    avgTTK: number;
}

export interface BatchReport {
    averageTTK: number;
    bestMatchup: { pair: [string, string], ttk: number };
    worstMatchup: { pair: [string, string], ttk: number };
    results: MatchupResult[];
    attackerAverages: AttackerAverage[];
}

/**
 * Runs simulation for every pair in the registry.
 */
export function runBatchSimulation(power: number): BatchReport {
    const ids = Object.keys(MingmingRegistry);
    const results: MatchupResult[] = [];
    let totalTTK = 0;
    let count = 0;

    let bestTTK = Infinity;
    let worstTTK = -Infinity;
    let bestPair: [string, string] = ['', ''];
    let worstPair: [string, string] = ['', ''];

    for (let i = 0; i < ids.length; i++) {
        for (let j = 0; j < ids.length; j++) {
            if (i === j) continue;

            const res = simulate1v1(ids[i], ids[j], power);
            results.push(res);

            // We care about how fast A kills B
            const ttkA = res.sideA.ttk;
            if (ttkA !== Infinity) {
                totalTTK += ttkA;
                count++;

                if (ttkA < bestTTK) {
                    bestTTK = ttkA;
                    bestPair = [ids[i], ids[j]];
                }
                if (ttkA > worstTTK) {
                    worstTTK = ttkA;
                    worstPair = [ids[i], ids[j]];
                }
            }
        }
    }

    // Calculate per-attacker averages
    const attackerAverages: AttackerAverage[] = ids.map(attackerId => {
        const attackerResults = results.filter(r => r.sideA.attackerId === attackerId);
        const validTTKs = attackerResults.map(r => r.sideA.ttk).filter(ttk => ttk !== Infinity);
        const totalDmg = attackerResults.reduce((sum, r) => sum + r.sideA.damage, 0);
        const totalTTKForAttacker = validTTKs.reduce((sum, ttk) => sum + ttk, 0);

        return {
            id: attackerId,
            avgDamage: attackerResults.length > 0 ? totalDmg / attackerResults.length : 0,
            avgTTK: validTTKs.length > 0 ? totalTTKForAttacker / validTTKs.length : 0
        };
    });

    return {
        averageTTK: count > 0 ? totalTTK / count : 0,
        bestMatchup: { pair: bestPair, ttk: bestTTK },
        worstMatchup: { pair: worstPair, ttk: worstTTK },
        results,
        attackerAverages
    };
}
