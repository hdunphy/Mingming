/**
 * TICKET 28a — canary the re-composed gym trios on the REAL gauntlet fight.
 *
 * The first attempt at this fielded the trios through `teamScenario` and read 0% for every one of
 * them in two to three turns, which is not a comparison — it is a harness with no Driver, no boss
 * IVs and no HP carry measuring something other than the fight. `rollGauntletFight` is the fight:
 * it applies `BOSS_IVS`, attaches the gym's Driver and builds the enemy deck the gauntlet fields.
 *
 * Both gates `teamComps.ts` names are read — **FTK 0** and **no stall** — plus the win rate, which
 * is PRINTED rather than gated: a gym boss is supposed to beat a party more often than it loses (it
 * is the run's final exam) and this harness models no HP spent on the two fights before it. What
 * the number is for is the comparison between the trio that shipped and the one 28a proposes, and
 * that comparison is only meaningful because both arms are measured here, in the same session.
 *
 * Run: `npx vite-node scratch/t28a_canary.ts -- --iter 3`
 */
import { arg } from './_env';
import { createRun } from '../src/engine/run/createRun';
import { offerGyms, GYM_REGISTRY } from '../src/engine/run/gyms';
import { rollGauntletFight, GAUNTLET_FIGHTS, isBossFight } from '../src/engine/run/gauntlet';
import { AUTHORED_BOSSES, type IAuthoredBoss } from '../src/engine/run/bosses';
import { runOne } from '../src/debug/balance/runBatch';
import { RUN_ENEMY_MODE } from '../src/engine/run/encounter';
import { BALANCE_IV, BALANCE_STAT_JITTER } from '../src/debug/balance/balanceScenarios';
import { deriveSeeds } from '../src/debug/balance/runBatch';
import type { IMingmingState } from '../src/engine/types';

const ITER = Number(arg('iter', '3'));
/**
 * THE BEAM, AND WHY IT IS NOT THE ENCOUNTER'S.
 *
 * A 3v3 boss fight at the encounter's own beam (8) costs MINUTES per battle in this harness — the
 * first run of this file managed one cell in about a quarter of an hour, which puts six cells at
 * four hours for a smoke read. Ticket 157 section 3 calls **beam 0** "the calibrated setting", so
 * that is what this canary runs at, and it is stated here rather than buried because it is a real
 * deviation:
 *
 *   - the two GATES this canary exists for - **FTK 0** and **no stall** - are properties of the
 *     fight's shape and do not need a deep search to show up;
 *   - the WIN RATE at n=3 was never a number anyway (the ticket calls 162c's n=10 a smoke read), so
 *     a shallower AI changes a reading that was already directional.
 *
 * What this canary cannot say is how the trios compare under the AI the game actually fields. That
 * is the 30-seed walker run, after 157's opening-fight ruling.
 */
const BEAM = Number(arg('beam', '0'));

/**
 * ONE player party per gym: **the counter each boss's own doc comment names**, built the way a
 * player builds (two own-element bodies plus a guest).
 *
 * Three parties per gym was the first shape and it was unaffordable — a 3v3 boss fight at the
 * encounter's own beam costs minutes, not seconds, and eighteen cells is a multi-hour job. One
 * party is also the more honest cut: 28a asks *"which trio synergises best"*, and a trio is judged
 * against the party it was DESIGNED to be hard for, not against a field.
 */
const COUNTER_PARTY: Record<string, Array<[string, string]>> = {
    // Emberfall's own note: "a control-leaning 2 Water + 1 Fire".
    gym_emberfall: [['kraken', 'kraken_v1'], ['jormungandr', 'jormungandr_v1'], ['fenrir', 'fenrir_v1']],
    // Tidewrack's note (74): "Nature - the only launch element with Weakened".
    gym_tidewrack: [['huldra', 'huldra_v1'], ['ratatoskr', 'ratatoskr_v1'], ['kraken', 'kraken_v1']],
    // Rootfall's note (72): "Fire by type - fenrir_v1's missing-HP scaling converts poison pressure".
    gym_rootfall: [['fenrir', 'fenrir_v1'], ['skoll', 'skoll_v1'], ['huldra', 'huldra_v1']],
};

/** What shipped before 28a, so both arms are measured by the same instrument in the same session. */
const BEFORE: Record<string, IAuthoredBoss> = {
    gym_emberfall: { members: [{ species: 'fenrir', os: 'fenrir_v1' }, { species: 'skoll', os: 'skoll_v1' }, { species: 'ratatoskr', os: 'ratatoskr_v2' }], driver: AUTHORED_BOSSES.gym_emberfall.driver },
    gym_tidewrack: { members: [{ species: 'jormungandr', os: 'jormungandr_v1' }, { species: 'kraken', os: 'kraken_v2' }, { species: 'skoll', os: 'skoll_v2' }], driver: AUTHORED_BOSSES.gym_tidewrack.driver },
    gym_rootfall: { members: [{ species: 'huldra', os: 'huldra_v2' }, { species: 'ratatoskr', os: 'ratatoskr_v1' }, { species: 'jormungandr', os: 'jormungandr_v2' }], driver: AUTHORED_BOSSES.gym_rootfall.driver },
};

const member = (id: string, species: string, os: string): IMingmingState => ({
    id, definitionId: species, activeOS: os, blueprintsCollected: 0,
    attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV,
});

console.log(`iterations ${ITER} per (gym × arm), boss fight only, beam ${BEAM}\n`);
console.log('gym            arm       party        boss win%  turns  FTK  trunc');

for (const gymId of Object.keys(GYM_REGISTRY)) {
    for (const arm of ['BEFORE', 'AFTER'] as const) {
        // The table is swapped in memory for the BEFORE arm, so the SAME code path measures both.
        const shipped = AUTHORED_BOSSES[gymId];
        const table = AUTHORED_BOSSES as Record<string, IAuthoredBoss>;
        if (arm === 'BEFORE') table[gymId] = BEFORE[gymId];

        let wins = 0; let games = 0; let turns = 0; let ftk = 0; let trunc = 0;
        for (const [name, comp] of [[`counter:${gymId.replace('gym_', '')}`, COUNTER_PARTY[gymId]] as const]) {
            const party = comp.map(([sp, os], i) => member(`mm${i + 1}`, sp, os));
            const offer = offerGyms('t28a:gyms').find((o) => o.gym.id === gymId)!;
            const run = createRun({ seed: `t28a:${gymId}:${arm}:${name}`, offer, party, startedAt: 1 });
            const node = run.nodes.find((n) => n.kind === 'gym')!;
            const bossIndex = GAUNTLET_FIGHTS - 1;
            if (!isBossFight(bossIndex, GAUNTLET_FIGHTS)) throw new Error('boss index');

            for (const seed of deriveSeeds(`t28a:${gymId}:${arm}:${name}`, ITER)) {
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
                games += 1;
                if (r.winner === 'ENEMY') wins += 1;
                turns += r.turns;
                if (r.ftk) ftk += 1;
                if (r.truncated) trunc += 1;
            }
            console.log(`${gymId.padEnd(15)}${arm.padEnd(9)}${name.padEnd(20)}${String(Math.round(100 * wins / games)).padStart(6)}%  ${(turns / games).toFixed(1).padStart(5)}  ${String(ftk).padStart(3)}  ${String(trunc).padStart(5)}   n=${games}`);
        }
        table[gymId] = shipped;
    }
    console.log('');
}
