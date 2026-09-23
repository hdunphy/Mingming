/*
 * 160-e1, end to end: cast each of the eight ally cards at an ALLY and print what actually landed.
 *
 * The test suite asserts the rules; this prints the effects, because "the ally cards are fixed" is
 * a claim about what a player sees, and a green test that only checks a guard would look the same
 * if every payload were resolving on the caster.
 */
import { battleReducer } from '../src/engine/battleReducer';
import { createSparseBattleState, createSparseEntity } from '../src/debug/scenarios/scenarioTestSupport';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { describeLegalTargets } from '../src/ui/utils/targeting';
import type { IBattleState, IBattleEntity } from '../src/engine/types';

const FRAME = 1000;
const unit = (id: string, name: string, hurt = false, debuffed = false): IBattleEntity =>
    createSparseEntity({
        id, name, currentHp: hurt ? FRAME / 2 : FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
        statusEffects: debuffed
            ? [{ id: `${id}-w`, type: 'Weakened', stacks: 2 }, { id: `${id}-d`, type: 'Dazed', stacks: 2 }]
            : [],
    });

const show = (e: IBattleEntity) =>
    `hp ${e.currentHp}` + (e.statusEffects.length
        ? '  ' + e.statusEffects.filter(s => s.stacks > 0).map(s => `${s.type} ${s.stacks}`).join(' ')
        : '');

function cast(dataId: string, targetId: string): IBattleState {
    const deck = {
        ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId, currentCost: GetProgramData(dataId).baseCost as number, isPlayable: true }],
    };
    const state: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [unit('p1', 'Caster'), unit('p2', 'Ally', true, true), unit('p3', 'Other', true)],
        enemyParty: [unit('e1', 'Foe')],
        playerDeck: deck,
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId, programId: 'h1' },
    } as never);
}

const CARDS = ['soothe', 'mend', 'tend', 'bolster', 'shell_share', 'howl', 'verdant_ward', 'tidal_battery'];

console.log('Ally p2 starts at hp 500 with Weakened 2 / Dazed 2; p3 at hp 500 clean. Caster p1 is untouched.\n');
for (const id of CARDS) {
    const d = GetProgramData(id);
    const after = cast(id, 'p2');
    console.log(`${d.name}  (${d.baseCost}e, ${d.target}${d.allyTarget ? ' + allyTarget' : ''}, legend "${describeLegalTargets(d)}")`);
    console.log(`  "${d.description}"`);
    console.log(`    p1 caster : ${show(after.playerParty[0])}`);
    console.log(`    p2 ALLY   : ${show(after.playerParty[1])}`);
    console.log(`    p3 other  : ${show(after.playerParty[2])}`);
    console.log(`    e1 enemy  : ${show(after.enemyParty[0])}`);
    console.log('');
}
