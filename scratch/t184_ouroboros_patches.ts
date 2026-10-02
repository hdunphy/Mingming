/**
 * Ticket 184d — what each patch really does to OUROBOROS_LOOP (jormungandr_v1), played through the
 * reducer: ten Water cards (0e Undertow) in one turn, counting the OS's draws.
 * Unpatched: one draw, on the 5th card.
 *
 *   npx vite-node scratch/t184_ouroboros_patches.ts
 */
import { battleReducer } from '../src/engine/battleReducer';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { bestPatchFor } from '../src/engine/data/patchRanking';
import { gatePatchChoices } from '../src/engine/data/patchRanking';
import { rawFirmwareHooks } from '../src/engine/data/firmwareRegistry';
import type { IBattleState, ProgramEntity } from '../src/engine/types';

function run(patches: string[], cards = 10): { triggers: number[]; } {
    const setup = matchupScenario({ player: 'jormungandr', enemy: 'kraken', playerOS: 'jormungandr_v1', enemyOS: 'kraken_v2', seed: 't184d' });
    let state = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    state = { ...state, activeSide: 'PLAYER', playerParty: state.playerParty.map((e, i) => (i === 0 ? { ...e, patches } : e)) } as IBattleState;
    const triggers: number[] = [];
    for (let i = 1; i <= cards; i++) {
        const card: ProgramEntity = { id: `w${i}`, dataId: 'undertow', currentCost: 0, isPlayable: true };
        const before = state.logs.length;
        state = battleReducer({
            ...state,
            playerDeck: { ...state.playerDeck, hand: [...state.playerDeck.hand, card] },
            playerParty: state.playerParty.map((e, j) => (j === 0 ? { ...e, currentEnergy: 50 } : e)),
        } as IBattleState, { type: 'PLAY_PROGRAM', payload: { sourceId: state.playerParty[0].id, programId: card.id, targetId: state.enemyParty[0].id } } as never) as IBattleState;
        if (state.logs.slice(before).some((l) => l.includes('OUROBOROS_LOOP triggers'))) triggers.push(i);
    }
    return { triggers };
}

for (const p of [[], ['amplifier'], ['repeater'], ['splitter'], ['relay'], ['failsafe'], ['overclock']]) {
    console.log(`${(p[0] ?? 'none').padEnd(10)} fires on Water card #: ${JSON.stringify(run(p).triggers)}`);
}
console.log('bestPatchFor(jormungandr_v1) =', bestPatchFor(rawFirmwareHooks('jormungandr_v1')).id);
console.log('gatePatchChoices(jormungandr_v1) =', gatePatchChoices(rawFirmwareHooks('jormungandr_v1'), []));
