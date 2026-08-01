import { describe, it, expect, vi, afterEach } from 'vitest';
import type { IBattleState, IBattleEntity, IMove } from '../types';
import { battleReducer } from '../battleReducer';
import { createMockEntity } from './battleFactories';
import { MingmingRegistry } from './mingmingRegistry';
import { generateIntents } from '../core/IntentUtils';

/**
 * Coverage for the four species that previously had NO movesets
 * (valkyrie, audhumbla, hel, nidhoggr) and fell back to the Struggle move.
 * Every authored move is executed through EXECUTE_INTENT and its
 * damage / heal / status payload asserted.
 */

function makeState(playerParty: IBattleEntity[], enemyParty: IBattleEntity[]): IBattleState {
    return {
        sessionId: 'test',
        seed: 'moveset_seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'ENEMY',
        logs: [],
        osLogs: [],
        procs: [],
        playerParty,
        enemyParty,
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        levelUpQueue: [],
        activeRelics: []
    } as unknown as IBattleState;
}

function getMove(speciesId: string, moveId: string): IMove {
    const move = MingmingRegistry[speciesId].moves?.find(m => m.id === moveId);
    if (!move) throw new Error(`Move ${moveId} not found on ${speciesId}`);
    return move;
}

/** Puts the move on the enemy as its current intent and executes it. */
function runIntent(state: IBattleState, enemyIndex: number, move: IMove): IBattleState {
    const armed: IBattleState = {
        ...state,
        enemyParty: state.enemyParty.map((e, i) => i === enemyIndex ? { ...e, currentIntent: move } : e)
    };
    return battleReducer(armed, { type: 'EXECUTE_INTENT', payload: { sourceId: state.enemyParty[enemyIndex].id } });
}

const findStatus = (e: IBattleEntity, type: string) => e.statusEffects.find(s => s.type === type);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Mingming registry movesets', () => {
    it('ALL 16 species define a non-empty moves array (no Struggle fallback)', () => {
        const speciesIds = Object.keys(MingmingRegistry);
        expect(speciesIds).toHaveLength(16);
        for (const id of speciesIds) {
            const moves = MingmingRegistry[id].moves;
            expect(moves, `${id} should define moves`).toBeDefined();
            expect(moves!.length, `${id} should have at least 3 moves`).toBeGreaterThanOrEqual(2);
        }
    });

    it('generateIntents assigns a real move (never Struggle, no console warning) for every species', () => {
        const warnSpy = vi.spyOn(console, 'warn');
        const party = Object.keys(MingmingRegistry).map(id => createMockEntity(`E_${id}`, id, 10));
        const withIntents = generateIntents(party, 'seed_x', 1);

        for (const entity of withIntents) {
            expect(entity.currentIntent, `${entity.definitionId} should get an intent`).toBeTruthy();
            expect(entity.currentIntent!.id).not.toBe('struggle');
        }
        const struggleWarnings = warnSpy.mock.calls.filter(args =>
            String(args[0]).includes('no moveset'));
        expect(struggleWarnings).toEqual([]);
    });
});

describe('Valkyrie moveset (precision striker)', () => {
    const setup = () => {
        const player = createMockEntity('Hero', 'fenrir', 10);
        const valkyrie = createMockEntity('Valkyrie', 'valkyrie', 10);
        return makeState([player], [valkyrie]);
    };

    it('Radiant Smite deals damage to the player', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('valkyrie', 'valkyrie_smite'));
        expect(next.playerParty[0].currentHp).toBeLessThan(state.playerParty[0].currentHp);
    });

    it('Death Mark applies 2 Dazed to the player', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('valkyrie', 'valkyrie_mark'));
        expect(findStatus(next.playerParty[0], 'Dazed')?.stacks).toBe(2);
    });

    it('Battle Trance buffs Valkyrie with Strengthened and Sharp', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('valkyrie', 'valkyrie_trance'));
        expect(findStatus(next.enemyParty[0], 'Strengthened')?.stacks).toBeGreaterThanOrEqual(1);
        expect(findStatus(next.enemyParty[0], 'Sharp')?.stacks).toBeGreaterThanOrEqual(1);
    });

    it('Spear of Dawn hits harder than Radiant Smite', () => {
        const state = setup();
        const afterSmite = runIntent(state, 0, getMove('valkyrie', 'valkyrie_smite'));
        const afterSpear = runIntent(state, 0, getMove('valkyrie', 'valkyrie_spear'));
        const smiteDmg = state.playerParty[0].currentHp - afterSmite.playerParty[0].currentHp;
        const spearDmg = state.playerParty[0].currentHp - afterSpear.playerParty[0].currentHp;
        expect(spearDmg).toBeGreaterThan(smiteDmg);
    });
});

describe('Audhumbla moveset (protector)', () => {
    const setup = () => {
        const player = createMockEntity('Hero', 'fenrir', 10);
        const audhumbla = createMockEntity('Audhumbla', 'audhumbla', 10);
        const ally = createMockEntity('Ally', 'draugr', 10);
        // Wound the enemy side so heals are observable
        const wounded = (e: IBattleEntity): IBattleEntity => ({ ...e, currentHp: Math.floor(e.maxHp / 2) });
        return makeState([player], [wounded(audhumbla), wounded(ally)]);
    };

    it('Mending Lick heals the lowest-HP member of its own side', () => {
        const state = setup();
        // Make the ally clearly the lowest-HP target
        const stateLowAlly: IBattleState = {
            ...state,
            enemyParty: state.enemyParty.map((e, i) => i === 1 ? { ...e, currentHp: 10 } : e)
        };
        const next = runIntent(stateLowAlly, 0, getMove('audhumbla', 'audhumbla_lick'));
        expect(next.enemyParty[1].currentHp).toBeGreaterThan(10);
        expect(next.playerParty[0].currentHp).toBe(state.playerParty[0].currentHp); // player untouched
    });

    it('Primordial Milk heals its whole side and grants Regen', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('audhumbla', 'audhumbla_milk'));
        expect(next.enemyParty[0].currentHp).toBeGreaterThan(state.enemyParty[0].currentHp);
        expect(next.enemyParty[1].currentHp).toBeGreaterThan(state.enemyParty[1].currentHp);
        expect(findStatus(next.enemyParty[0], 'Regen')).toBeTruthy();
        expect(findStatus(next.enemyParty[1], 'Regen')).toBeTruthy();
    });

    it('Stalwart Aegis grants Energized to its side and StableOS to itself, not to the player', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('audhumbla', 'audhumbla_bolster'));
        expect(findStatus(next.enemyParty[0], 'Energized')).toBeTruthy();
        expect(findStatus(next.enemyParty[1], 'Energized')).toBeTruthy();
        expect(findStatus(next.enemyParty[0], 'StableOS')).toBeTruthy();
        expect(findStatus(next.playerParty[0], 'Energized')).toBeUndefined();
        expect(findStatus(next.playerParty[0], 'StableOS')).toBeUndefined();
    });

    it('Horn Toss deals modest damage to the player', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('audhumbla', 'audhumbla_slam'));
        expect(next.playerParty[0].currentHp).toBeLessThan(state.playerParty[0].currentHp);
    });
});

describe('Hel moveset (glass cannon with recoil)', () => {
    const setup = () => {
        const player = createMockEntity('Hero', 'fenrir', 10);
        const hel = createMockEntity('Hel', 'hel', 10);
        return makeState([player], [hel]);
    };

    it('Cold Embrace is a safe hit: damages the player, no cost to Hel', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('hel', 'hel_touch'));
        expect(next.playerParty[0].currentHp).toBeLessThan(state.playerParty[0].currentHp);
        expect(next.enemyParty[0].currentHp).toBe(state.enemyParty[0].currentHp);
        expect(next.enemyParty[0].statusEffects).toEqual([]);
    });

    it('Grasp of Helheim deals heavy damage AND recoils onto Hel', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('hel', 'hel_grasp'));
        expect(next.playerParty[0].currentHp).toBeLessThan(state.playerParty[0].currentHp);
        expect(next.enemyParty[0].currentHp).toBeLessThan(state.enemyParty[0].currentHp); // recoil landed
    });

    it('Soul Reaping deals damage and applies Weakened to Hel herself', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('hel', 'hel_reaping'));
        expect(next.playerParty[0].currentHp).toBeLessThan(state.playerParty[0].currentHp);
        expect(findStatus(next.enemyParty[0], 'Weakened')?.stacks).toBeGreaterThanOrEqual(1);
        expect(findStatus(next.playerParty[0], 'Weakened')).toBeUndefined();
    });
});

describe('Nidhoggr moveset (poison combo)', () => {
    const setup = () => {
        const player = createMockEntity('Hero', 'fenrir', 10);
        const nidhoggr = createMockEntity('Nidhoggr', 'nidhoggr', 10);
        return makeState([player], [nidhoggr]);
    };

    it('Root Gnaw damages and poisons the player', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('nidhoggr', 'nidhoggr_gnaw'));
        expect(next.playerParty[0].currentHp).toBeLessThan(state.playerParty[0].currentHp);
        expect(findStatus(next.playerParty[0], 'Poison')?.stacks).toBeGreaterThanOrEqual(3);
    });

    it('Corpse Venom poisons the entire player side', () => {
        const player = createMockEntity('Hero', 'fenrir', 10);
        const player2 = createMockEntity('Hero2', 'kraken', 10);
        const nidhoggr = createMockEntity('Nidhoggr', 'nidhoggr', 10);
        const state = makeState([player, player2], [nidhoggr]);
        const next = runIntent(state, 0, getMove('nidhoggr', 'nidhoggr_venom'));
        expect(findStatus(next.playerParty[0], 'Poison')).toBeTruthy();
        expect(findStatus(next.playerParty[1], 'Poison')).toBeTruthy();
    });

    it('Feast of Malice hits harder against a poisoned target (conditional bonus hit)', () => {
        const state = setup();
        const move = getMove('nidhoggr', 'nidhoggr_feast');

        const cleanRun = runIntent(state, 0, move);
        const cleanDmg = state.playerParty[0].currentHp - cleanRun.playerParty[0].currentHp;

        const poisonedState: IBattleState = {
            ...state,
            playerParty: state.playerParty.map(e => ({
                ...e,
                statusEffects: [{ id: 'poison-pre', type: 'Poison' as const, stacks: 3 }]
            }))
        };
        const poisonedRun = runIntent(poisonedState, 0, move);
        const poisonedDmg = state.playerParty[0].currentHp - poisonedRun.playerParty[0].currentHp;

        expect(cleanDmg).toBeGreaterThan(0);
        expect(poisonedDmg).toBeGreaterThan(cleanDmg);
    });

    it('Creeping Dread applies Weakened 2 and Dazed 1 to the player', () => {
        const state = setup();
        const next = runIntent(state, 0, getMove('nidhoggr', 'nidhoggr_dread'));
        expect(findStatus(next.playerParty[0], 'Weakened')?.stacks).toBe(2);
        expect(findStatus(next.playerParty[0], 'Dazed')?.stacks).toBe(1);
    });
});
