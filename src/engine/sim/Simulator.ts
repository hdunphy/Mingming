
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
    levelA: number,
    idB: string,
    levelB: number,
    power: number
): MatchupResult {
    const defA = MingmingRegistry[idA];
    const defB = MingmingRegistry[idB];

    if (!defA || !defB) throw new Error("Invalid Mingming ID");

    // Initialize as Persistent Instance
    const instanceA = { id: 'A', definitionId: idA, level: levelA, experience: 0 };
    const instanceB = { id: 'B', definitionId: idB, level: levelB, experience: 0 };

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
        logs: [],
        playerParty: [entityA],
        enemyParty: [entityB],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [] },
        levelUpQueue: [],
        cardsPlayedThisTurn: 0,
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
export function runBatchSimulation(level: number, power: number): BatchReport {
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

            const res = simulate1v1(ids[i], level, ids[j], level, power);
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
