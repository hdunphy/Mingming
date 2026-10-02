/**
 * Ticket 164d — Valkyrie's REBIRTH_CYCLE fires for every living Valkyrie regardless of party slot.
 */
import { describe, expect, it } from 'vitest';
import { executeDraw } from './resolutionEngine';
import type { IBattleEntity, IBattleState, ProgramEntity } from './types';
import { getOSBehavior } from './data/firmwareRegistry';
import { registerHook } from './core/HookRegistry';

// Ensure valkyrie_v2 hooks are registered
const valkOS = getOSBehavior('valkyrie_v2');
if (valkOS) {
    valkOS.hooks.forEach(h => registerHook(h));
}

function makeUnit(id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id,
        name,
        currentHp: 100,
        maxHp: 100,
        tempHp: 0,
        attack: 10,
        defense: 10,
        maxEnergy: 5,
        currentEnergy: 5,
        cardDraw: 3,
        statusEffects: [],
        definitionId: 'fenrir',
        hooks: [],
        speed: 10,
        primaryElement: 'Light',
        daemons: [],
        blueprintsCollected: 0,
        hpIV: 0,
        attackIV: 0,
        defenseIV: 0,
        ...overrides,
    };
}

function makeCard(id: string, dataId: string): ProgramEntity {
    return {
        id,
        dataId,
        currentCost: 1,
        isPlayable: true,
    };
}

function make3v3State(playerParty: IBattleEntity[], enemyParty: IBattleEntity[]): IBattleState {
    return {
        sessionId: 'test-session',
        seed: 'test-seed-164d',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeDrivers: [],
        playerParty,
        enemyParty,
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['water_slap'],
            drawpile: [],
            hand: [],
            discard: [makeCard('c1', 'water_slap')],
            exhaust: [],
        },
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: [],
            drawpile: [],
            hand: [],
            discard: [],
            exhaust: [],
        },
        logs: [],
        osLogs: [],
        procs: [],
        lastProgramPlayed: null,
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        counters: {},
    };
}

describe('Ticket 164d — Valkyrie REBIRTH_CYCLE hook on reshuffle', () => {
    it('1. A 3v3 fixture that forces a reshuffle, with Valkyrie v2 in slot 1: the hook fires', () => {
        const ally0 = makeUnit('p0', 'Fenrir', { activeOS: 'fenrir_v1' });
        const valk1 = makeUnit('p1', 'Valkyrie', { activeOS: 'valkyrie_v2', currentHp: 50, maxHp: 100 });
        const ally2 = makeUnit('p2', 'Skoll', { activeOS: 'skoll_v1' });

        const enemy0 = makeUnit('e0', 'Target 0', { currentHp: 500, maxHp: 500 });
        const enemy1 = makeUnit('e1', 'Target 1', { currentHp: 500, maxHp: 500 });
        const enemy2 = makeUnit('e2', 'Target 2', { currentHp: 500, maxHp: 500 });

        const state = make3v3State([ally0, valk1, ally2], [enemy0, enemy1, enemy2]);

        // Draw 1 card from empty drawpile with 1 in discard -> triggers reshuffle
        const after = executeDraw(state, 'PLAYER', 1, false);

        // Valkyrie in slot 1 should have healed and enemies should have taken damage
        const afterValk = after.playerParty.find(e => e.id === 'p1')!;
        const totalEnemyHpBefore = enemy0.currentHp + enemy1.currentHp + enemy2.currentHp;
        const totalEnemyHpAfter = after.enemyParty.reduce((sum, e) => sum + e.currentHp, 0);

        expect(afterValk.currentHp, 'Valkyrie in slot 1 heals on reshuffle').toBeGreaterThan(50);
        expect(totalEnemyHpAfter, 'Enemies take Light attack on reshuffle').toBeLessThan(totalEnemyHpBefore);
    });

    it('2. Valkyrie dead in slot 0 with a living ally: no fire', () => {
        const deadValk0 = makeUnit('p0', 'Valkyrie', { activeOS: 'valkyrie_v2', currentHp: 0, maxHp: 100 });
        const livingAlly1 = makeUnit('p1', 'Fenrir', { activeOS: 'fenrir_v1', currentHp: 100, maxHp: 100 });
        const livingAlly2 = makeUnit('p2', 'Skoll', { activeOS: 'skoll_v1', currentHp: 100, maxHp: 100 });

        const enemy0 = makeUnit('e0', 'Target 0', { currentHp: 500, maxHp: 500 });
        const enemy1 = makeUnit('e1', 'Target 1', { currentHp: 500, maxHp: 500 });
        const enemy2 = makeUnit('e2', 'Target 2', { currentHp: 500, maxHp: 500 });

        const state = make3v3State([deadValk0, livingAlly1, livingAlly2], [enemy0, enemy1, enemy2]);

        const after = executeDraw(state, 'PLAYER', 1, false);

        const totalEnemyHpBefore = enemy0.currentHp + enemy1.currentHp + enemy2.currentHp;
        const totalEnemyHpAfter = after.enemyParty.reduce((sum, e) => sum + e.currentHp, 0);

        expect(totalEnemyHpAfter, 'No damage when slot 0 Valkyrie is dead').toBe(totalEnemyHpBefore);
    });

    it('3. Two living Valkyries: two fires', () => {
        const valk0 = makeUnit('p0', 'Valkyrie 0', { activeOS: 'valkyrie_v2', currentHp: 50, maxHp: 100 });
        const valk1 = makeUnit('p1', 'Valkyrie 1', { activeOS: 'valkyrie_v2', currentHp: 50, maxHp: 100 });
        const ally2 = makeUnit('p2', 'Skoll', { activeOS: 'skoll_v1', currentHp: 100, maxHp: 100 });

        const enemy0 = makeUnit('e0', 'Target 0', { currentHp: 500, maxHp: 500 });
        const enemy1 = makeUnit('e1', 'Target 1', { currentHp: 500, maxHp: 500 });
        const enemy2 = makeUnit('e2', 'Target 2', { currentHp: 500, maxHp: 500 });

        const state = make3v3State([valk0, valk1, ally2], [enemy0, enemy1, enemy2]);

        const after = executeDraw(state, 'PLAYER', 1, false);

        const afterValk0 = after.playerParty.find(e => e.id === 'p0')!;
        const afterValk1 = after.playerParty.find(e => e.id === 'p1')!;

        // Both Valkyries heal
        expect(afterValk0.currentHp, 'Valkyrie 0 heals').toBeGreaterThan(50);
        expect(afterValk1.currentHp, 'Valkyrie 1 heals').toBeGreaterThan(50);

        // Check logs for two firings
        const fireLogs = after.logs.filter(l => l.includes('REBIRTH_CYCLE_OS ignites'));
        expect(fireLogs.length, 'REBIRTH_CYCLE_OS fired twice').toBe(2);
    });
});
