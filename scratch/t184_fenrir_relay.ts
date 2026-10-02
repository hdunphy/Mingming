/**
 * Ticket 184d — RELAY on UNBOUND_KERNEL (fenrir_v1): what happens when an ALLY attacks.
 *   npx vite-node scratch/t184_fenrir_relay.ts
 */
import { battleReducer } from '../src/engine/battleReducer';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import type { IBattleState, ProgramEntity } from '../src/engine/types';

function arena(patches: string[]): IBattleState {
    const a = matchupScenario({ player: 'fenrir', enemy: 'kraken', playerOS: 'fenrir_v1', enemyOS: 'kraken_v2', seed: 't184d-relay' });
    const b = matchupScenario({ player: 'skoll', enemy: 'kraken', playerOS: 'skoll_v2', enemyOS: 'kraken_v2', seed: 't184d-relay' });
    const setup = { ...a, player: { ...a.player, party: [...a.player.party, ...b.player.party] } };
    const state = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    return { ...state, activeSide: 'PLAYER', playerParty: state.playerParty.map((e, i) => (i === 0 ? { ...e, patches } : e)) } as IBattleState;
}
function play(state: IBattleState, casterIndex: number, dataId: string): IBattleState {
    const card: ProgramEntity = { id: `c${Math.random()}`, dataId, currentCost: 0, isPlayable: true };
    return battleReducer({
        ...state,
        playerDeck: { ...state.playerDeck, hand: [...state.playerDeck.hand, card] },
        playerParty: state.playerParty.map((e) => ({ ...e, currentEnergy: 50 })),
    } as IBattleState, { type: 'PLAY_PROGRAM', payload: { sourceId: state.playerParty[casterIndex].id, programId: card.id, targetId: state.enemyParty[0].id } } as never) as IBattleState;
}
const str = (s: IBattleState) => s.playerParty[0].statusEffects.find((x) => x.type === 'Strengthened')?.stacks ?? 0;
for (const patches of [[], ['relay'], ['failsafe'], ['amplifier'], ['splitter']]) {
    const s0 = arena(patches);
    const own = play(s0, 0, 'tackle');
    const ally = play(s0, 1, 'tackle');
    console.log(`${(patches[0] ?? 'none').padEnd(9)} own attack: Fenrir +${str(own)} Str, HP ${s0.playerParty[0].currentHp}->${own.playerParty[0].currentHp}, ally Str ${own.playerParty[1].statusEffects.find((x) => x.type === 'Strengthened')?.stacks ?? 0}`
        + ` | ally attack: Fenrir +${str(ally)} Str, HP ${s0.playerParty[0].currentHp}->${ally.playerParty[0].currentHp}, ally Str ${ally.playerParty[1].statusEffects.find((x) => x.type === 'Strengthened')?.stacks ?? 0}`);
}
