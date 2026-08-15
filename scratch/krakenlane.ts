/** Ticket 70: kraken picks a lane. One stat at a time, in-memory, against the ticket-69 band standard. */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ElementalMatrix } from '../src/engine/combatUtils';

const ITER = Number(process.env.ITER ?? 30);
const BASE = process.env.BASE ?? 'lane';
const KR = (MingmingRegistry as any).kraken;
const ORIG = { ...KR.baseStats };

function bucket(a: string, b: string): 'ADV' | 'DIS' | 'NEU' {
    const ea = (MingmingRegistry as any)[a].primaryElement, eb = (MingmingRegistry as any)[b].primaryElement;
    const out = (ElementalMatrix as any)[ea]?.[eb] ?? 1, inc = (ElementalMatrix as any)[eb]?.[ea] ?? 1;
    if (out > 1 && inc <= 1) return 'ADV';
    if (inc > 1 && out <= 1) return 'DIS';
    return 'NEU';
}

function arm(name: string, patch: Partial<typeof ORIG>) {
    Object.assign(KR.baseStats, ORIG, patch);
    const out: any = { arm: name, stats: { ...KR.baseStats }, decks: {} };
    for (const os of ['kraken_v1', 'kraken_v2']) {
        const cells: any[] = [];
        let dealt = 0, taken = 0, turns = 0, nDealt = 0;
        for (const opp of BALANCE_SPECIES.filter(s => s !== 'kraken')) {
            const r = runPairedBatch(
                matchupScenario({ player: 'kraken', enemy: opp, playerOS: os, seed: `${BASE}:${os}:${opp}` }),
                { iterations: ITER, telemetry: true });
            const b = bucket('kraken', opp);
            cells.push({ opp, b, wr: r.pooled.decisiveWinRate, ftk: r.pooled.ftkCount, dead: r.pooled.deadCardRatio });
            if (b === 'NEU') for (const run of r.pooled.runs) {
                if (!run.telemetry) continue;
                dealt += run.telemetry.PLAYER.totalDamage; taken += run.telemetry.ENEMY.totalDamage;
                turns += run.turns; nDealt++;
            }
        }
        const mean = cells.reduce((a, c) => a + c.wr, 0) / cells.length;
        const viol = cells.filter(c => c.wr > 0.9 || c.wr < 0.1);
        const neu = cells.filter(c => c.b === 'NEU');
        out.decks[os] = {
            mean, viol: viol.length, hi: cells.filter(c => c.wr > 0.9).length, lo: cells.filter(c => c.wr < 0.1).length,
            zeros: cells.filter(c => c.wr <= 0).length,
            neuMean: neu.reduce((a, c) => a + c.wr, 0) / neu.length,
            neuZeros: neu.filter(c => c.wr <= 0).length,
            dealtPerTurn: dealt / Math.max(1, turns), takenPerTurn: taken / Math.max(1, turns),
            net: (dealt - taken) / Math.max(1, turns),
            ftk: cells.reduce((a, c) => a + c.ftk, 0),
            dead: cells.reduce((a, c) => a + c.dead, 0) / cells.length,
            cells,
        };
    }
    const f = (os: string) => { const x = out.decks[os]; return `${os} mean ${(x.mean * 100).toFixed(1)}% band-viol ${x.viol}(${x.hi}hi/${x.lo}lo) zeros ${x.zeros} NEU ${(x.neuMean * 100).toFixed(1)}%/${x.neuZeros}z net ${x.net >= 0 ? '+' : ''}${x.net.toFixed(2)} ftk ${x.ftk} dead ${x.dead.toFixed(3)}`; };
    console.error(`ARM ${name.padEnd(10)} hp${KR.baseStats.hp} atk${KR.baseStats.attack} def${KR.baseStats.defense} :: ${f('kraken_v1')} :: ${f('kraken_v2')}`);
    Object.assign(KR.baseStats, ORIG);
    return out;
}

const ARMS: Array<[string, any]> = [
    ['baseline', {}],
    ['hp66', { hp: 66 }], ['hp74', { hp: 74 }], ['hp82', { hp: 82 }],
    ['atk88', { attack: 88 }], ['atk96', { attack: 96 }], ['atk100', { attack: 100 }], ['atk104', { attack: 104 }], ['atk105', { attack: 105 }],
    ['def95', { defense: 95 }], ['def103', { defense: 103 }], ['def111', { defense: 111 }],
];
const only = (process.env.ARMS ?? '').split(',').filter(Boolean);
const results = ARMS.filter(([n]) => !only.length || only.includes(n)).map(([n, p]) => arm(n, p));
console.log(JSON.stringify({ base: BASE, iterations: ITER, results }));
