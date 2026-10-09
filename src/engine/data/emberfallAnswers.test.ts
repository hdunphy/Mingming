/**
 * TICKET 207 — EMBERFALL'S ANSWERS. Henry, 2026-10-08: *"pick new ones and if we don't [have them]
 * add something to remove burn and a new aura to get energized if a burn overflows."*
 *
 * `quench` (0e, remove 2 Burn and 2 Poison from an ally) and `sindris_forge` (2e Aura: whenever a Burn
 * detonates on one of your Mingmings, it gains 1 Energized). Both neutral (Henry, 2026-10-08). Like the ticket 69 toolbox, every test counts
 * stacks: a counter that silently does nothing reads as "the counter is too weak" in a win rate.
 */
import { describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { effectHandlers } from '../effectHandlers';
import { BURN_CONFIG } from '../StatusBehaviors';
import { GetProgramData } from './programRegistry';
import { initDaemonHooks } from './daemonHooks';
import { NEUTRAL_UTILITY_IDS } from './speciesPools';
import { GYM_COUNTER_ANSWERS } from '../run/marketplace';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../types';

initDaemonHooks();

function arena(): IBattleState {
    const setup = matchupScenario({
        player: 'kraken', enemy: 'skoll',
        playerOS: 'kraken_v2', enemyOS: 'skoll_v2', seed: 'emberfall-answers',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    const template = base.playerParty[0];
    return {
        ...base,
        playerParty: [0, 1, 2].map((i) => ({ ...template, id: `p${i}`, name: `P${i}`, statusEffects: [], daemons: [] })),
    } as IBattleState;
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.find((s) => s.type === type)?.stacks ?? 0;

const install = (state: IBattleState, dataId: string): IBattleState => ({
    ...state,
    playerParty: state.playerParty.map((e, i) =>
        i === 0 ? { ...e, daemons: [...e.daemons, { id: `daemon_${dataId}`, dataId, currentCost: 2, isPlayable: false } as ProgramEntity] } : e),
} as IBattleState);

/** Burn applied the way a card applies it. */
const burn = (state: IBattleState, targetId: string, n: number, sourceId: string): IBattleState =>
    effectHandlers.APPLY_STATUS(state, { targetId, status: 'Burn', stacks: n, sourceId } as never) as IBattleState;

function play(state: IBattleState, dataId: string, targetId: string): IBattleState {
    const card: ProgramEntity = { id: `c_${dataId}`, dataId, currentCost: 0, isPlayable: true };
    const src = state.playerParty[0].id;
    const armed = {
        ...state,
        activeSide: 'PLAYER' as const,
        playerParty: state.playerParty.map((e) => (e.id === src ? { ...e, currentEnergy: 9 } : e)),
        playerDeck: { ...state.playerDeck, hand: [card] },
    } as IBattleState;
    return battleReducer(armed, { type: 'PLAY_PROGRAM', payload: { sourceId: src, programId: card.id, targetId } } as never) as IBattleState;
}

describe('207 — Emberfall\'s answers are stocked and listed', () => {
    it('both are in the shop\'s neutral slot and in Emberfall\'s answer list', () => {
        for (const id of ['quench', 'sindris_forge']) {
            expect(NEUTRAL_UTILITY_IDS).toContain(id);
            expect(GYM_COUNTER_ANSWERS.gym_emberfall).toContain(id);
        }
    });

    it('both are neutral; Quench is a 0e card aimed at an ally (Self), so the AI does not cleanse the enemy', () => {
        expect(GetProgramData('quench').target).toBe('Self');
        expect(GetProgramData('quench').baseCost).toBe(0);
        expect(GetProgramData('quench').element).toBe('None');
        expect(GetProgramData('sindris_forge').element).toBe('None');
    });
});

describe('QUENCH', () => {
    it('removes 2 Burn and 2 Poison from the chosen ally', () => {
        const enemy = arena().enemyParty[0].id;
        let s = burn(arena(), 'p2', BURN_CONFIG.maxStacks, enemy);
        s = effectHandlers.APPLY_STATUS(s, { targetId: 'p2', status: 'Poison', stacks: 5, sourceId: enemy } as never) as IBattleState;
        const poisonBefore = stacks(s.playerParty[2], 'Poison');
        expect(stacks(s.playerParty[2], 'Burn')).toBe(BURN_CONFIG.maxStacks);
        const after = play(s, 'quench', 'p2');
        expect(stacks(after.playerParty[2], 'Burn')).toBe(BURN_CONFIG.maxStacks - 2);
        expect(stacks(after.playerParty[2], 'Poison')).toBe(poisonBefore - 2);
    });
});

describe('SINDRI\'S FORGE', () => {
    it('gives the burned ally 1 Energized when its Burn detonates', () => {
        const base = install(arena(), 'sindris_forge');
        const enemy = base.enemyParty[0].id;
        const loaded = burn(base, 'p1', BURN_CONFIG.maxStacks, enemy);
        expect(stacks(loaded.playerParty[1], 'Energized'), 'no detonation yet').toBe(0);
        const blown = burn(loaded, 'p1', 1, enemy);
        expect(stacks(blown.playerParty[1], 'Energized')).toBe(1);
    });

    it('pays nothing for a detonation on the enemy side', () => {
        const base = install(arena(), 'sindris_forge');
        const target = base.enemyParty[0].id;
        const after = burn(burn(base, target, BURN_CONFIG.maxStacks, 'p0'), target, 1, 'p0');
        for (const e of [...after.playerParty, ...after.enemyParty]) expect(stacks(e, 'Energized')).toBe(0);
    });
});
