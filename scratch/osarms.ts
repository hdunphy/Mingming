/**
 * OS-nerf comparison for jormungandr_v1's OUROBOROS_LOOP.
 *
 * One arm per PROCESS: `firmwareRegistry` builds its hooks once, lazily, from the imported
 * hooks.json object, so an arm has to mutate that object before the first battle and can only
 * do it once. The bash loop runs this file once per arm.
 *
 * ARM env values:
 *   base           - nothing changed (the pre-ticket-73 world)
 *   nodraw         - OUROBOROS grants Energy but no longer draws
 *   noenergy       - OUROBOROS draws but no longer grants Energy
 *   at4 / at5      - fires on the 4th / 5th Water card instead of the 3rd
 *   at4-nodraw     - both
 *   cap2           - ticket 73's shipped cap (reference)
 *   deckcut        - one Undertow and one Ink Stream replaced with Water Slap (reference)
 */
import HOOKS_DATA from '../src/engine/data/lib/hooks.json';
import { ENV } from './_env';

const ARM = ENV.ARM ?? 'base';

// --- mutate the OS BEFORE anything imports the firmware registry ---
const jorm = (HOOKS_DATA as any).jormungandr_v1;
const trigger = jorm.hooks.find((h: any) => h.id === 'jorm_v1_trigger');
if (ARM.includes('nodraw')) trigger.do = trigger.do.filter((a: any) => a.type !== 'DRAW');
if (ARM.includes('noenergy')) trigger.do = trigger.do.filter((a: any) => a.type !== 'ENERGY');
const at = /at(\d)/.exec(ARM);
if (at) trigger.when.counters.find((c: any) => c.key === 'jorm_water').value = Number(at[1]);

const { battleReducer } = await import('../src/engine/battleReducer');
const { getBestAction } = await import('../src/engine/ai/TacticalAI');
const { runPairedBatch, runOne, deriveSeeds, applyStatJitter, DEFAULT_MAX_TURNS } = await import('../src/debug/balance/runBatch');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');
const { DRAW_SCALING_CAP, PLAY_COUNT_SCALING_CAP } = await import('../src/engine/actions/ActionExecutors');
type IBattleState = import('../src/engine/types').IBattleState;
type IBattleEntity = import('../src/engine/types').IBattleEntity;
type BattleAction = import('../src/engine/battleReducer').BattleAction;

// Every arm except `cap2` runs UNCAPPED with the card at its ticket-71 values - i.e. ticket 73's
// caps and power changes reverted, which is the world an OS nerf would ship into.
if (ARM === 'cap2') {
    DRAW_SCALING_CAP.value = 2; PLAY_COUNT_SCALING_CAP.value = 3;
    (ProgramRegistry as any).ink_stream.actions[0].power = 28;
    (ProgramRegistry as any).starfall.actions[0].power = 24;
} else {
    DRAW_SCALING_CAP.value = Infinity; PLAY_COUNT_SCALING_CAP.value = Infinity;
    (ProgramRegistry as any).ink_stream.actions[0].power = 33;
    (ProgramRegistry as any).starfall.actions[0].power = 18;
}
if (ARM === 'deckcut') {
    (MingmingRegistry as any).jormungandr.decks.jormungandr_v1 =
        ['undertow', 'water_slap', 'blind_spot', 'corrosive_leak', 'surge_protection',
            'serpents_coil', 'serpents_coil', 'ink_stream', 'water_slap'];
}

const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);
const CARRIERS: Array<[string, string]> = [['jormungandr', 'jormungandr_v1'], ['kraken', 'kraken_v1'], ['valkyrie', 'valkyrie_v2']];

// --- 1. what jormungandr_v1 can put out on turn 1, as a share of the target's max HP
const shares: number[] = []; let t1kills = 0;
for (const opp of BALANCE_SPECIES.filter(s => s !== 'jormungandr')) {
    const setup = matchupScenario({ player: 'jormungandr', enemy: opp, playerOS: 'jormungandr_v1', seed: `t1:${opp}` });
    for (const seed of deriveSeeds(setup.seed, 40)) {
        let st: IBattleState = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        const start = hp(st.enemyParty), maxHp = st.enemyParty.reduce((t, e) => t + e.maxHp, 0);
        let g = 0;
        while (st.activeSide === 'PLAYER' && st.turn === 1 && hp(st.enemyParty) > 0 && g++ < 40) {
            const nx = battleReducer(st, getBestAction(st)); if (nx === st) break; st = nx;
        }
        shares.push((start - hp(st.enemyParty)) / maxHp);
        if (hp(st.enemyParty) <= 0) t1kills++;
    }
}
shares.sort((x, y) => x - y);
const q = (p: number) => shares[Math.min(shares.length - 1, Math.floor(shares.length * p))];

// --- 2. first-turn kills across the 14 cells the census found
const KNOWN: Array<[string, string, string]> = [
    ['skoll', 'skoll_v1', 'jormungandr'], ['jormungandr', 'jormungandr_v1', 'skoll'],
    ['skoll', 'skoll_v2', 'jormungandr'], ['fenrir', 'fenrir_v2', 'jormungandr'],
    ['jormungandr', 'jormungandr_v1', 'fenrir'], ['jormungandr', 'jormungandr_v1', 'fafnir'],
    ['gullinbursti', 'gullinbursti_v2', 'jormungandr'], ['fenrir', 'fenrir_v1', 'jormungandr'],
    ['fafnir', 'fafnir_v1', 'jormungandr'], ['jormungandr', 'jormungandr_v1', 'gullinbursti'],
    ['jormungandr', 'jormungandr_v1', 'ratatoskr'], ['jormungandr', 'jormungandr_v1', 'hel'],
    ['gullinbursti', 'gullinbursti_v1', 'jormungandr'], ['hel', 'hel_v2', 'jormungandr'],
];
let ftk = 0;
for (const [sp, os, opp] of KNOWN) {
    const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `band:${os}:${opp}` });
    for (const seed of deriveSeeds(setup.seed, 30))
        for (const side of ['PLAYER', 'ENEMY'] as const)
            if (runOne(setup, seed, DEFAULT_MAX_TURNS, side).ftk) ftk++;
}

// --- 3. field win rate for the three decks that carry a draw-scaled card
const field: Record<string, number> = {};
for (const [sp, os] of CARRIERS) {
    let sum = 0, n = 0;
    for (const opp of BALANCE_SPECIES.filter(s => s !== sp)) {
        const r = runPairedBatch(matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `band:${os}:${opp}` }), { iterations: 15 });
        sum += r.pooled.decisiveWinRate; n++;
    }
    field[os] = sum / n;
}

// --- 4. what the payoff cards actually deliver
const dmg: Record<string, { n: number; d: number }> = {};
for (const [sp, os] of CARRIERS) for (const opp of BALANCE_SPECIES.filter(s => s !== sp)) {
    const setup = matchupScenario({ player: sp, enemy: opp, playerOS: os, seed: `dc:${os}:${opp}` });
    for (const seed of deriveSeeds(setup.seed, 3)) for (const side of ['PLAYER', 'ENEMY'] as const) {
        const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        let st: IBattleState = side === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
        let g = 0; const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && g++ < 4000) {
            const act: BattleAction = getBestAction(st);
            let id: string | undefined; let before = 0;
            if (act.type === 'PLAY_PROGRAM' && st.playerParty.some(e => e.id === (act as any).payload.sourceId)) {
                const d = st.playerDeck.hand.find(c => c.id === (act as any).payload.programId)?.dataId;
                if (d === 'ink_stream' || d === 'starfall') { id = `${os}/${d}`; before = hp(st.enemyParty); }
            }
            let nx = battleReducer(st, act);
            if (nx === st) { nx = battleReducer(st, { type: 'END_TURN' }); if (nx === st) break; }
            if (id) { const s = (dmg[id] ??= { n: 0, d: 0 }); s.n++; s.d += Math.max(0, before - hp(nx.enemyParty)); }
            st = nx;
        }
    }
}

console.error(`RESULT ${ARM.padEnd(12)} t1med ${(q(.5) * 100).toFixed(0)}%  t1p99 ${(q(.99) * 100).toFixed(0)}%  t1max ${(shares[shares.length - 1] * 100).toFixed(0)}%  t1kills ${t1kills}/600  FTK ${String(ftk).padStart(2)}  ` +
    `field: jorm ${(field['jormungandr_v1'] * 100).toFixed(1)}% kraken ${(field['kraken_v1'] * 100).toFixed(1)}% valk ${(field['valkyrie_v2'] * 100).toFixed(1)}%  ` +
    `inkdmg: jorm ${dmg['jormungandr_v1/ink_stream']?.d ?? 0} kraken ${dmg['kraken_v1/ink_stream']?.d ?? 0}`);
