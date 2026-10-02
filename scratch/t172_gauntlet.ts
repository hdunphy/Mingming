/**
 * TICKET 172 — was Henry's 2026-09-30 Emberfall gauntlet loss fair, and what would a heal between
 * fights buy? Replays HIS gate state (party, IVs, firmware, patches, drivers, 26-card deck) against
 * the three fights the game rolls for HIS run, carrying HP between fights the way the game does
 * (downed members stay at 0; no macros are fired), with `heal` percent of max HP restored to every
 * LIVING member between fights.
 *
 *   npx vite-node scratch/t172_gauntlet.ts -- <heal%> <samples> [startSample]
 */
import fs from 'node:fs';
import { rollGauntletFight } from '../src/engine/run/gauntlet';
import { setupFor } from '../src/debug/balance/runWalker';
import { runOne } from '../src/debug/balance/runBatch';
import type { IRunState } from '../src/engine/runTypes';
import type { IMingmingState } from '../src/engine/types';

const [healArg, samplesArg, startArg] = process.argv.slice(2);
const heal = Number(healArg ?? 0) / 100;
const samples = Number(samplesArg ?? 10);
const start = Number(startArg ?? 0);

const save = JSON.parse(fs.readFileSync('playtest-results/2026-29-09/firefall-kraken_v2/mingming_run__slot_1.old.json', 'utf8'));
const baseRun = save.run as IRunState;
const gymNode = { ...baseRun.nodes.find((n) => n.kind === 'gym')!, visited: 1 };
const run: IRunState = { ...baseRun, nodes: baseRun.nodes.map((n) => (n.id === gymNode.id ? gymNode : n)), gauntlet: null };

const member = (id: string, definitionId: string, activeOS: string, a: number, d: number, h: number): IMingmingState => ({
    id, definitionId, activeOS, attackIV: a, defenseIV: d, hpIV: h, blueprintsCollected: 0,
});
// The gate order the run log prints: kraken, jormungandr, skoll.
const party = [
    member('mm_135t5m1_1', 'kraken', 'kraken_v2', 12, 30, 24),
    member('mm_1u01cxm_1', 'jormungandr', 'jormungandr_v2', 29, 1, 23),
    member('mm_0pt9kqy_1', 'skoll', 'skoll_v2', 1, 20, 31),
];
const deck = ['boiling_surge', 'brand', 'capacitor', 'contagion+', 'corrosive_bolt', 'corrosive_bolt+', 'ember_jab', 'ember_jab',
    'ember_ward', 'flashover', 'hydro_blast', 'ignite', 'ignite', 'ignite', 'overclock_core+', 'scald', 'scald', 'serpent_flurry',
    'serpent_flurry+', 'spreading_rot+', 'thermal_overload', 'tidal_battery+', 'tide_pool', 'toxic_surge+', 'venom_fang', 'venom_fang'];
const drivers = ['driver_first_blood', 'driver_tenth_strike', 'driver_element_nature'];
const patches = { mm_135t5m1_1: ['amplifier'], mm_1u01cxm_1: ['amplifier'], mm_0pt9kqy_1: ['amplifier'] };

const fightsWon = [0, 0, 0];
let cleared = 0;
const rows: string[] = [];
for (let s = start; s < start + samples; s += 1) {
    let hp: Record<string, number> | null = null;
    let reached = 0;
    const trail: string[] = [];
    for (let f = 0; f < 3; f += 1) {
        const enc = rollGauntletFight({ run, node: gymNode, fightIndex: f });
        const setup = setupFor(`${enc.seed}#${s}`, party, deck, enc.enemyParty, enc.enemyDeckIds, enc.enemyDrivers ?? [], drivers, patches);
        delete (setup as { statJitter?: number }).statJitter;
        if (hp) {
            setup.player.party = setup.player.party.map((m, i) => ({ ...m, currentHp: hp![party[i].id] }));
        }
        const t0 = Date.now();
        const result = runOne(setup, `${enc.seed}#${s}`, 60, 'PLAYER', false, enc.enemyAiTier, enc.aiBeam);
        const won = result.winner === 'PLAYER';
        const end = result.playerEnd.map((e) => `${e.hp}/${e.maxHp}`).join(' ');
        trail.push(`F${f + 1} ${won ? 'W' : 'L'} t${result.turns} [${end}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        if (!won) break;
        fightsWon[f] += 1;
        reached = f + 1;
        hp = {};
        result.playerEnd.forEach((e, i) => {
            const healed = e.hp > 0 ? Math.min(e.maxHp, e.hp + Math.floor(e.maxHp * heal)) : 0;
            hp![party[i].id] = healed;
        });
        if (f === 0 && s === start) {
            console.error('fight 1 enemies:', enc.enemyParty.map((e) => `${e.definitionId}/${e.activeOS}`).join(', '));
        }
    }
    if (reached === 3) cleared += 1;
    rows.push(`sample ${s}: ${trail.join(' | ')}`);
    console.error(rows[rows.length - 1]);
}
console.log(JSON.stringify({ heal, samples, start, fightsWon, cleared }));
