/** Ticket 73 task 1: find the FTK seeds and replay one, action by action, with the numbers. */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { runOne, deriveSeeds, applyStatJitter, DEFAULT_MAX_TURNS } from '../src/debug/balance/runBatch';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { GetProgramData } from '../src/engine/data/programRegistry';
import type { IBattleState, IBattleEntity } from '../src/engine/types';

const CELLS: Array<[string, string, string]> = (process.env.CELLS ??
    'skoll:jormungandr:skoll_v1;jormungandr:skoll:jormungandr_v1;skoll:jormungandr:skoll_v2;fenrir:jormungandr:fenrir_v2')
    .split(';').map(c => c.split(':') as [string, string, string]);
const ITER = Number(process.env.ITER ?? 30);
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);

for (const [sp, opp, os] of CELLS) {
    const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `band:${os}:${opp}` });
    const seeds = deriveSeeds(setup.seed, ITER);
    const hits: Array<{ seed: string; side: 'PLAYER' | 'ENEMY' }> = [];
    for (const seed of seeds) for (const side of ['PLAYER', 'ENEMY'] as const) {
        const r = runOne(setup, seed, DEFAULT_MAX_TURNS, side);
        if (r.ftk) hits.push({ seed, side });
    }
    console.error(`\n=== ${os} vs ${opp}: ${hits.length} FTK of ${seeds.length * 2}   sides: ${hits.map(h => h.side).join(',')}`);
    if (!hits.length) continue;

    const { seed, side } = hits[0];
    const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
    let st: IBattleState = side === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
    const you = (s: IBattleState) => s.activeSide === 'PLAYER' ? s.playerParty[0] : s.enemyParty[0];
    const foe = (s: IBattleState) => s.activeSide === 'PLAYER' ? s.enemyParty[0] : s.playerParty[0];
    console.error(`REPLAY seed=${seed} firstMover=${side}`);
    console.error(`  PLAYER ${st.playerParty[0].name} hp ${st.playerParty[0].currentHp}/${st.playerParty[0].maxHp} atk ${st.playerParty[0].attack} def ${st.playerParty[0].defense} e ${st.playerParty[0].currentEnergy}`);
    console.error(`  ENEMY  ${st.enemyParty[0].name} hp ${st.enemyParty[0].currentHp}/${st.enemyParty[0].maxHp} atk ${st.enemyParty[0].attack} def ${st.enemyParty[0].defense} e ${st.enemyParty[0].currentEnergy}`);
    let g = 0;
    while (hp(st.playerParty) > 0 && hp(st.enemyParty) > 0 && st.turn <= 3 && g++ < 60) {
        const a: BattleAction = getBestAction(st);
        const actor = you(st), target = foe(st);
        let label = a.type as string;
        if (a.type === 'PLAY_PROGRAM') {
            const deck = st.activeSide === 'PLAYER' ? st.playerDeck : st.enemyDeck;
            const card = deck.hand.find(c => c.id === (a as any).payload.programId);
            const d = card ? GetProgramData(card.dataId) : undefined;
            label = `PLAY ${card?.dataId} (${d?.baseCost}e)`;
        }
        const beforeFoe = target.currentHp, beforeE = actor.currentEnergy;
        const handBefore = (st.activeSide === 'PLAYER' ? st.playerDeck : st.enemyDeck).hand.map(c => c.dataId).join(',');
        let next = battleReducer(st, a);
        if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; label += ' [->END_TURN]'; }
        const t2 = next.activeSide === st.activeSide ? foe(next) : you(next);
        const a2 = next.activeSide === st.activeSide ? you(next) : foe(next);
        console.error(`  T${st.turn} ${st.activeSide} cp${st.cardsPlayedThisTurn} cd${st.cardsDrawnThisTurn}/tr${st.nonNaturalCardsDrawnThisTurn ?? 0} e${beforeE}  ${label.padEnd(34)} dmg ${Math.max(0, beforeFoe - t2.currentHp).toString().padStart(3)}  foeHp ${t2.currentHp}  e->${a2.currentEnergy}  hand[${handBefore}]`);
        st = next;
    }
    console.error(`  RESULT turn ${st.turn}  player ${hp(st.playerParty)}  enemy ${hp(st.enemyParty)}`);
}
