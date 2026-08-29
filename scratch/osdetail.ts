/**
 * Ticket 74 diagnostic: with OUROBOROS on "5th Water card draws 1, no Energy", WHICH first-turn
 * kills survive, how often, and what has to line up for one?
 *
 * FULL=1 scans all 480 cells; otherwise just the 14 the census found.
 * REPLAY=1 narrates the surviving ones action by action.
 */
import HOOKS_DATA from '../src/engine/data/lib/hooks.json';
import { ENV } from './_env';

// The chosen arm, applied before the firmware registry builds its hooks.
const jorm = (HOOKS_DATA as any).jormungandr_v1;
const trigger = jorm.hooks.find((h: any) => h.id === 'jorm_v1_trigger');
trigger.do = trigger.do.filter((a: any) => a.type !== 'ENERGY');
trigger.when.counters.find((c: any) => c.key === 'jorm_water').value = 5;

const { battleReducer } = await import('../src/engine/battleReducer');
const { getBestAction } = await import('../src/engine/ai/TacticalAI');
const { runOne, deriveSeeds, applyStatJitter, DEFAULT_MAX_TURNS } = await import('../src/debug/balance/runBatch');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
const { ProgramRegistry, GetProgramData } = await import('../src/engine/data/programRegistry');
const { DRAW_SCALING_CAP, PLAY_COUNT_SCALING_CAP } = await import('../src/engine/actions/ActionExecutors');
const { ElementalMatrix } = await import('../src/engine/combatUtils');
type IBattleState = import('../src/engine/types').IBattleState;
type IBattleEntity = import('../src/engine/types').IBattleEntity;
type BattleAction = import('../src/engine/battleReducer').BattleAction;

// Ticket 73 fully reverted: no ceilings, Ink Stream back to 33 power at 1 Energy.
DRAW_SCALING_CAP.value = Infinity;
PLAY_COUNT_SCALING_CAP.value = Infinity;
(ProgramRegistry as any).ink_stream.actions[0].power = 33;
(ProgramRegistry as any).starfall.actions[0].power = 18;

const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);
const bucket = (a: string, b: string) => {
    const ea = (MingmingRegistry as any)[a].primaryElement, eb = (MingmingRegistry as any)[b].primaryElement;
    const out = (ElementalMatrix as any)[ea]?.[eb] ?? 1, inc = (ElementalMatrix as any)[eb]?.[ea] ?? 1;
    if (out > 1 && inc <= 1) return `ADVANTAGED (${ea} beats ${eb})`;
    if (inc > 1 && out <= 1) return `DISADVANTAGED (${eb} beats ${ea})`;
    return `neutral (${ea} vs ${eb})`;
};

const all: Array<[string, string, string]> = [];
for (const sp of BALANCE_SPECIES)
    for (const os of (MingmingRegistry as any)[sp].availableOS)
        for (const opp of BALANCE_SPECIES) if (opp !== sp) all.push([sp, os, opp]);

const KNOWN = new Set(['skoll_v1:jormungandr', 'jormungandr_v1:skoll', 'skoll_v2:jormungandr', 'fenrir_v2:jormungandr',
    'jormungandr_v1:fenrir', 'jormungandr_v1:fafnir', 'gullinbursti_v2:jormungandr', 'fenrir_v1:jormungandr',
    'fafnir_v1:jormungandr', 'jormungandr_v1:gullinbursti', 'jormungandr_v1:ratatoskr', 'jormungandr_v1:hel',
    'gullinbursti_v1:jormungandr', 'hel_v2:jormungandr']);
const cells = ENV.FULL ? all : all.filter(([, os, opp]) => KNOWN.has(`${os}:${opp}`));
const ITER = Number(ENV.ITER ?? 30);

let total = 0;
const hits: Array<{ sp: string; os: string; opp: string; seed: string; side: 'PLAYER' | 'ENEMY' }> = [];
for (const [sp, os, opp] of cells) {
    const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `band:${os}:${opp}` });
    let n = 0;
    for (const seed of deriveSeeds(setup.seed, ITER))
        for (const side of ['PLAYER', 'ENEMY'] as const)
            if (runOne(setup, seed, DEFAULT_MAX_TURNS, side).ftk) { n++; hits.push({ sp, os, opp, seed, side }); }
    if (n) console.error(`  ${os} vs ${opp}: ${n}/${ITER * 2} games (${(n / (ITER * 2) * 100).toFixed(1)}%)  -  ${bucket(sp, opp)}`);
    total += n;
}
console.error(`TOTAL ${total} first-turn kills across ${cells.length} cells at ${ITER}x2 games each`);

if (ENV.REPLAY) for (const h of hits) {
    const setup = matchupScenario({ player: h.sp, enemy: h.opp, playerOS: h.os, seed: `band:${h.os}:${h.opp}` });
    const built = buildScenarioState({ ...applyStatJitter(setup, h.seed), seed: h.seed });
    let st: IBattleState = h.side === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
    console.error(`\nREPLAY ${h.os} vs ${h.opp}  seed=${h.seed}  firstMover=${h.side}`);
    console.error(`  ${st.playerParty[0].name} ${st.playerParty[0].currentHp}hp atk${st.playerParty[0].attack} def${st.playerParty[0].defense}  vs  ${st.enemyParty[0].name} ${st.enemyParty[0].currentHp}hp atk${st.enemyParty[0].attack} def${st.enemyParty[0].defense}`);
    let g = 0;
    while (hp(st.playerParty) > 0 && hp(st.enemyParty) > 0 && st.turn <= 2 && g++ < 40) {
        const a: BattleAction = getBestAction(st);
        const foe = st.activeSide === 'PLAYER' ? st.enemyParty[0] : st.playerParty[0];
        let label = a.type as string;
        if (a.type === 'PLAY_PROGRAM') {
            const deck = st.activeSide === 'PLAYER' ? st.playerDeck : st.enemyDeck;
            const card = deck.hand.find(c => c.id === (a as any).payload.programId);
            label = `PLAY ${card?.dataId} (${card ? GetProgramData(card.dataId)?.baseCost : '?'}e)`;
        }
        const before = foe.currentHp;
        let next = battleReducer(st, a);
        if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
        const foe2 = next.activeSide === st.activeSide ? (next.activeSide === 'PLAYER' ? next.enemyParty[0] : next.playerParty[0])
            : (next.activeSide === 'PLAYER' ? next.playerParty[0] : next.enemyParty[0]);
        console.error(`  T${st.turn} ${st.activeSide} played=${st.cardsPlayedThisTurn} drawn=${st.nonNaturalCardsDrawnThisTurn ?? 0} e${st.activeSide === 'PLAYER' ? st.playerParty[0].currentEnergy : st.enemyParty[0].currentEnergy}  ${label.padEnd(30)} dmg ${String(Math.max(0, before - foe2.currentHp)).padStart(3)}  foeHp ${foe2.currentHp}`);
        st = next;
    }
}
