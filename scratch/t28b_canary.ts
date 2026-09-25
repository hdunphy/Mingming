/**
 * TICKET 28b — canary the re-ruled gym trios, against **Henry's gate for this row**.
 *
 * > *"Canary at 3 iterations; the gate to report is that each gym loses to its named counter party
 * > MORE than to the other two — that is 142's route working."*
 *
 * So this is a 3×3 GRID rather than 28a's one-party-per-gym column: every gym is fought by all
 * three element parties, and the reading is the ORDER of the three, not any one number. The gate is
 * comparative, which is what makes n=3 defensible — a 33-point step between adjacent cells at three
 * battles is one battle, and that is said out loud rather than dressed up.
 *
 * Inherits 28a's two structural decisions, both still load-bearing:
 *
 *  - **The REAL gauntlet fight.** `rollGauntletFight` applies `BOSS_IVS`, attaches the gym's Driver
 *    and builds the deck the gauntlet fields. 28a's first attempt used `teamScenario` and read 0%
 *    for every trio in two to three turns — a harness with no Driver and no boss IVs measuring
 *    something other than the fight.
 *  - **Beam 0**, ticket 157 §3's "calibrated setting", stated rather than buried. A 3v3 at the
 *    encounter's own beam (8) costs minutes per battle, which puts an 18-cell grid past four hours.
 *    What this canary therefore cannot say is how the trios compare under the AI the game fields;
 *    that is the walker's job, after the opening-fight ruling.
 *
 * Run: `npx vite-node scratch/t28b_canary.ts -- --iter 3`
 */
import { arg } from './_env';
import { createRun } from '../src/engine/run/createRun';
import { offerGyms, GYM_REGISTRY, COUNTERED_BY } from '../src/engine/run/gyms';
import { rollGauntletFight, GAUNTLET_FIGHTS, isBossFight } from '../src/engine/run/gauntlet';
import { AUTHORED_BOSSES, type IAuthoredBoss } from '../src/engine/run/bosses';
import { runOne, deriveSeeds } from '../src/debug/balance/runBatch';
import { RUN_ENEMY_MODE } from '../src/engine/run/encounter';
import { BALANCE_IV, BALANCE_STAT_JITTER } from '../src/debug/balance/balanceScenarios';
import type { IMingmingState } from '../src/engine/types';

const ITER = Number(arg('iter', '3'));
const BEAM = Number(arg('beam', '0'));
/** `--arms after` skips the BEFORE column when only the gate matters. */
const ARMS = arg('arms', 'both') === 'both' ? (['BEFORE', 'AFTER'] as const) : (['AFTER'] as const);

/**
 * One party per ELEMENT, each built the way a player builds — two own-element bodies plus a guest.
 *
 * These are 28a's three counter parties promoted to a grid: each was already the named counter of
 * exactly one gym, so the diagonal of this table IS the "named counter" column and the off-diagonal
 * is the "other two". Keeping the same three parties is deliberate — a new set would make this run
 * incomparable with `results/t28a-canary.txt`, which is the only prior reading there is.
 */
const PARTIES: Record<string, Array<[string, string]>> = {
    Water: [['kraken', 'kraken_v1'], ['jormungandr', 'jormungandr_v1'], ['fenrir', 'fenrir_v1']],
    Nature: [['huldra', 'huldra_v1'], ['ratatoskr', 'ratatoskr_v1'], ['kraken', 'kraken_v1']],
    Fire: [['fenrir', 'fenrir_v1'], ['skoll', 'skoll_v1'], ['huldra', 'huldra_v1']],
};

/** The trios 28a shipped, so both rulings are measured by the same instrument in one session. */
const BEFORE: Record<string, IAuthoredBoss> = {
    gym_emberfall: { members: [{ species: 'fenrir', os: 'fenrir_v2' }, { species: 'skoll', os: 'skoll_v2' }, { species: 'kraken', os: 'kraken_v2' }], driver: AUTHORED_BOSSES.gym_emberfall.driver },
    gym_tidewrack: { members: [{ species: 'jormungandr', os: 'jormungandr_v1' }, { species: 'kraken', os: 'kraken_v1' }, { species: 'ratatoskr', os: 'ratatoskr_v1' }], driver: AUTHORED_BOSSES.gym_tidewrack.driver },
    gym_rootfall: { members: [{ species: 'huldra', os: 'huldra_v2' }, { species: 'ratatoskr', os: 'ratatoskr_v2' }, { species: 'jormungandr', os: 'jormungandr_v2' }], driver: AUTHORED_BOSSES.gym_rootfall.driver },
};

const member = (id: string, species: string, os: string): IMingmingState => ({
    id, definitionId: species, activeOS: os, blueprintsCollected: 0,
    attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV,
});

interface Cell { bossWin: number; turns: number; ftk: number; trunc: number; n: number }

function cell(gymId: string, element: string, arm: string): Cell {
    const party = PARTIES[element].map(([sp, os], i) => member(`mm${i + 1}`, sp, os));
    const offer = offerGyms('t28b:gyms').find((o) => o.gym.id === gymId)!;
    const run = createRun({ seed: `t28b:${gymId}:${arm}:${element}`, offer, party, startedAt: 1 });
    const node = run.nodes.find((n) => n.kind === 'gym')!;
    const bossIndex = GAUNTLET_FIGHTS - 1;
    if (!isBossFight(bossIndex, GAUNTLET_FIGHTS)) throw new Error('boss index');

    let bossWin = 0; let turns = 0; let ftk = 0; let trunc = 0; let n = 0;
    for (const seed of deriveSeeds(`t28b:${gymId}:${arm}:${element}`, ITER)) {
        const enc = rollGauntletFight({ run, node, fightIndex: bossIndex });
        const setup = {
            seed,
            enemyMode: RUN_ENEMY_MODE,
            player: {
                party: party.map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, attackIV: m.attackIV, defenseIV: m.defenseIV, hpIV: m.hpIV })),
                deck: run.deck.map((c) => c.dataId), drivers: [],
            },
            enemies: enc.enemyParty.map((e, i) => ({
                definitionId: e.definitionId, activeOS: e.activeOS ?? 'run-gate:no-firmware',
                attackIV: e.attackIV ?? BALANCE_IV, defenseIV: e.defenseIV ?? BALANCE_IV, hpIV: e.hpIV ?? BALANCE_IV,
                deck: i === 0 ? [...enc.enemyDeckIds] : [],
            })),
            ...(enc.enemyDrivers && enc.enemyDrivers.length > 0 ? { enemyDrivers: [...enc.enemyDrivers] } : {}),
            statJitter: BALANCE_STAT_JITTER,
        };
        const r = runOne(setup, seed, 60, 'PLAYER', false, enc.enemyAiTier, BEAM);
        n += 1;
        if (r.winner === 'ENEMY') bossWin += 1;
        turns += r.turns;
        if (r.ftk) ftk += 1;
        if (r.truncated) trunc += 1;
    }
    return { bossWin, turns, ftk, trunc, n };
}

console.log(`28b canary — ${ITER} iterations per (gym × party × arm), boss fight only, beam ${BEAM}`);
console.log('BOSS win% — so the GATE is that the named counter column is the LOWEST of the three.\n');

for (const arm of ARMS) {
    console.log(`########## ARM: ${arm} ##########`);
    console.log('gym            trio                                      Water   Nature    Fire   | named counter  | gate');
    for (const gymId of Object.keys(GYM_REGISTRY)) {
        const shipped = AUTHORED_BOSSES[gymId];
        const table = AUTHORED_BOSSES as Record<string, IAuthoredBoss>;
        if (arm === 'BEFORE') table[gymId] = BEFORE[gymId];

        const named = COUNTERED_BY[GYM_REGISTRY[gymId].element];
        const cells: Record<string, Cell> = {};
        for (const element of ['Water', 'Nature', 'Fire']) cells[element] = cell(gymId, element, arm);

        const rate = (e: string): number => (100 * cells[e].bossWin) / cells[e].n;
        const others = ['Water', 'Nature', 'Fire'].filter((e) => e !== named);
        // The gate as Henry stated it: the gym LOSES MORE to its named counter, i.e. the boss's own
        // win rate is lower there than against either of the other two. Strictly lower — a tie is
        // not the route working, it is the route not showing up at n=3.
        const pass = others.every((e) => rate(named) < rate(e));
        const trio = table[gymId].members.map((m) => m.os).join(' + ');
        console.log(
            `${gymId.padEnd(15)}${trio.padEnd(42)}`
            + ['Water', 'Nature', 'Fire'].map((e) => `${rate(e).toFixed(0).padStart(5)}%`).join('  ')
            + `   | ${named.padEnd(7)} ${rate(named).toFixed(0).padStart(4)}%  | ${pass ? 'PASS' : 'FAIL'}`,
        );
        const ftk = ['Water', 'Nature', 'Fire'].reduce((n, e) => n + cells[e].ftk, 0);
        const trunc = ['Water', 'Nature', 'Fire'].reduce((n, e) => n + cells[e].trunc, 0);
        const turns = ['Water', 'Nature', 'Fire'].reduce((n, e) => n + cells[e].turns, 0) / (3 * ITER);
        console.log(`${''.padEnd(57)}turns ${turns.toFixed(1)}  FTK ${ftk}  truncated ${trunc}  (n=${ITER} per cell)`);

        table[gymId] = shipped;
    }
    console.log('');
}
