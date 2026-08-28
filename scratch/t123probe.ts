/**
 * TICKET 123 take-check: does scoping CARDS_PLAYED to the caster actually change the damage?
 *
 * The stacked-comp arms came back bit-identical before and after, on a deck that runs two copies of
 * `serpents_coil`. That is either a real "the outcome does not move" result or a dead arm, and this
 * arc has already produced three dead arms that read exactly like real null results. So: measure the
 * damage directly instead of inferring it from a win rate.
 *
 * Two mingmings on the player side sharing a hand. The ALLY casts filler first, then the CASTER
 * casts the scaler. Under the old rule the ally's casts pump the caster's card; under the new rule
 * they must not.
 *
 * Run: npx vite-node scratch/t123probe.ts
 */
import { battleReducer } from '../src/engine/battleReducer';
import { createSparseBattleState, createSparseEntity } from '../src/debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from '../src/engine/types';

const card = (id: string, dataId: string): ProgramEntity =>
    ({ id, dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

/** Two allies, shared hand: two fillers for the ally and the scaler for the caster. */
function stateWith(): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [
            createSparseEntity({ id: 'caster', definitionId: 'sleipnir', name: 'Caster', cardDraw: 3 }),
            createSparseEntity({ id: 'ally', definitionId: 'sleipnir', name: 'Ally', cardDraw: 3 }),
        ],
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'kraken', name: 'Target' })],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: [],
            drawpile: [],
            hand: [card('f1', 'water_slap'), card('f2', 'water_slap'), card('s1', 'stampede')],
            discard: [],
            exhaust: [],
        },
    });
}

const play = (s: IBattleState, sourceId: string, programId: string): IBattleState =>
    battleReducer(s, { type: 'PLAY_PROGRAM', payload: { sourceId, targetId: 'e1', programId } } as never);

function run(label: string): void {
    let s = stateWith();
    const startHp = s.enemyParty[0].currentHp;

    // The ALLY plays two cards first. Under the old side-wide rule these inflate the caster's scaler.
    s = play(s, 'ally', 'f1');
    s = play(s, 'ally', 'f2');
    const beforeScaler = s.enemyParty[0].currentHp;

    s = play(s, 'caster', 's1');
    const scalerDamage = beforeScaler - s.enemyParty[0].currentHp;

    const caster = s.playerParty.find(e => e.id === 'caster');
    const ally = s.playerParty.find(e => e.id === 'ally');
    console.log(`${label}`);
    console.log(`   side cardsPlayedThisTurn ${s.cardsPlayedThisTurn}   `
        + `caster.playsThisTurn ${caster?.playsThisTurn}   ally.playsThisTurn ${ally?.playsThisTurn}`);
    console.log(`   stampede damage ${scalerDamage}   (enemy ${startHp} -> ${s.enemyParty[0].currentHp})`);
}

console.log('The ally casts twice, THEN the caster casts stampede.\n');
process.env.T123_OFF = '1';
run('OLD RULE  (state.cardsPlayedThisTurn - the whole side)');
delete process.env.T123_OFF;
run('NEW RULE  (source.playsThisTurn - the caster only)');
console.log('\nIf the two damage numbers match, the change did NOT take.');
