/**
 * TICKET 149 (3a, aside) — how many fights a run holds, by node kind, over sampled region graphs.
 * Width is NOT a generator output: `enemyPartySize` mirrors the player's party (alpha = 1 enemy,
 * ambush = party+1 capped at 3), and the party grows from 1 by recruiting at workshops. So this
 * counts fight nodes per graph and the recruit opportunities (workshops) that precede them.
 * Run: npx vite-node scratch/t149_runmix.ts -- --seeds 300
 */
import { generateRegionGraph } from '../src/engine/run/regionGraph';
import { isFightNode } from '../src/engine/run/encounter';
import { arg } from './_env';
const N = Number(arg('seeds', '300'));
const total: Record<string, number> = {};
let fights = 0, nodes = 0;
const perBiomeFights: number[] = [0, 0, 0];
for (let i = 0; i < N; i++) {
    const g = generateRegionGraph(`t149mix:${i}`);
    for (const n of g.nodes) {
        total[n.kind] = (total[n.kind] ?? 0) + 1; nodes++;
        if (isFightNode(n.kind)) { fights++; perBiomeFights[n.biomeIndex]++; }
    }
}
console.log(`| node kind | per graph (n=${N} graphs) |\n|---|---|`);
for (const [k, v] of Object.entries(total).sort((a, b) => b[1] - a[1])) console.log(`| ${k}${isFightNode(k as never) ? ' (fight)' : ''} | ${(v / N).toFixed(2)} |`);
console.log(`| ALL nodes | ${(nodes / N).toFixed(2)} |`);
console.log(`| fight nodes | ${(fights / N).toFixed(2)} |`);
console.log(`| fight nodes by biome 0/1/2 | ${perBiomeFights.map(x => (x / N).toFixed(2)).join(' / ')} |`);

// A WALKED PATH: forward-only random walk entry -> gym (always stepping to a higher layer / next
// biome), pockets skipped. This is the minimum a run fights; a player can detour into pockets.
const walked: Record<string, number> = {}; let wf = 0;
for (let i = 0; i < N; i++) {
    const g = generateRegionGraph(`t149mix:${i}`);
    const byId = new Map(g.nodes.map(n => [n.id, n]));
    let cur = byId.get(g.entryNodeId)!;
    let guard = 0; let h = i * 7919;
    while (cur && cur.id !== g.gymNodeId && guard++ < 100) {
        walked[cur.kind] = (walked[cur.kind] ?? 0) + 1; if (isFightNode(cur.kind)) wf++;
        const next = cur.edges.map(e => byId.get(e)!).filter(n => n && !n.pocket
            && (n.biomeIndex > cur.biomeIndex || (n.biomeIndex === cur.biomeIndex && n.layer > cur.layer)));
        if (!next.length) break;
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        cur = next[h % next.length];
    }
    if (cur) { walked[cur.kind] = (walked[cur.kind] ?? 0) + 1; if (isFightNode(cur.kind)) wf++; }
}
console.log(`\nWALKED PATH (forward random walk, pockets skipped), per run:\n| kind | per run |\n|---|---|`);
for (const [k, v] of Object.entries(walked).sort((a, b) => b[1] - a[1])) console.log(`| ${k}${isFightNode(k as never) ? ' (fight)' : ''} | ${(v / N).toFixed(2)} |`);
console.log(`| fights on the path | ${(wf / N).toFixed(2)} |`);
