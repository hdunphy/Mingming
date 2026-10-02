/**
 * TICKET 162c, REDONE AT 3v3 — Henry, 2026-09-23: *"we need to look at these as 3v3 decks not just
 * 1v1"*.
 *
 * # WHY THE 1v1 READ WAS THE WRONG INSTRUMENT
 *
 * §7's probe measured each OS alone against thirty opponents and reported sköll_v1 at 11.7%, the
 * worst number in the roster. Henry's answer: *"She shares the str payoff with fenrir."* Which is
 * the design — collection v2's own partner map says it in as many words: *"Fenrir v1: Howl +
 * UNBOUND_KERNEL: Fenrir's consume eats Sköll's Strength."* A deck whose payoff is on another body
 * scores as a deck with no payoff when it is measured alone, and every keeper, battery and
 * status-maker in the collection has that shape on purpose.
 *
 * So the unit of measurement is the COMP.
 *
 * # THE SIX COMPS, AND WHERE THEY COME FROM
 *
 * Not invented here. Each is a triple drawn from `collection.json`'s `partners` field — Henry's own
 * statement of which OS wants which — with the no-duplicate-species law respected. Naming them
 * after the currency they pass around rather than after an archetype word, because "who makes the
 * pile and who spends it" is the thing being measured.
 *
 * # WHAT IT REPORTS
 *
 * Round-robin, both turn orders, pooled. A comp's `field` is its win rate against the other five.
 * `solitaire` is the gap between a member's 1v1 field number (§7) and the comp's — the number that
 * says whether a body is carried by its party or carrying it, which is 160 §5's "solitaire score"
 * asked the way round that answers Henry's point.
 *
 * Run: npx vite-node scratch/t162c_comps.ts -- --iter 3
 */
import fs from 'node:fs';
import { arg } from './_env';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { runPairedBatch } from '../src/debug/balance/runBatch';

const ITER = Number(arg('iter', '3'));
const OUT = arg('out', 'results/t162/COMPS.txt');

type Member = readonly [string, string];
interface Comp { id: string; why: string; members: readonly Member[] }

const COMPS: Comp[] = [
    {
        id: 'strength',
        why: "Sköll v1 makes Strength (Howl, TREACHERY), Fenrir v1 spends it; Huldra v1 Weakens the attackers so the recoil deck lives",
        members: [['skoll', 'skoll_v1'], ['fenrir', 'fenrir_v1'], ['huldra', 'huldra_v1']],
    },
    {
        id: 'detonation',
        why: "Sköll v2 adds Burn, Fenrir v2 turns every Burn into Sharp, Kraken v2's steam pre-loads the pile",
        members: [['skoll', 'skoll_v2'], ['fenrir', 'fenrir_v2'], ['kraken', 'kraken_v2']],
    },
    {
        id: 'water-engine',
        why: "Undertow serves both OUROBOROS and ABYSSAL_INK; Rat v1's 0e Water cards proc all three",
        members: [['jormungandr', 'jormungandr_v1'], ['kraken', 'kraken_v1'], ['ratatoskr', 'ratatoskr_v1']],
    },
    {
        id: 'poison',
        why: "Huldra v2's Thornguard and Rat v2's Dazed both feed TOXIN_FANG's per-stack attacks",
        members: [['jormungandr', 'jormungandr_v2'], ['huldra', 'huldra_v2'], ['ratatoskr', 'ratatoskr_v2']],
    },
    {
        id: 'dazed',
        why: "Two Dazed engines and one Crushing Depths; Huldra v1's Weakened is the second currency",
        members: [['kraken', 'kraken_v1'], ['ratatoskr', 'ratatoskr_v2'], ['huldra', 'huldra_v1']],
    },
    {
        id: 'keeper',
        why: "GOSSIP heals the HP the berserker spends; Bolster's Sharp lands on whoever is being hit",
        members: [['huldra', 'huldra_v1'], ['ratatoskr', 'ratatoskr_v1'], ['fenrir', 'fenrir_v1']],
    },
];

/** §7's 1v1 field numbers, for the solitaire column. */
const SOLO_1V1: Record<string, number> = {
    fenrir_v1: 69.9, fenrir_v2: 79.3, skoll_v1: 11.7, skoll_v2: 66.9,
    kraken_v1: 45.7, kraken_v2: 75.2, jormungandr_v1: 20.9, jormungandr_v2: 62.6,
    ratatoskr_v1: 80.5, ratatoskr_v2: 33.8, huldra_v1: 33.6, huldra_v2: 50.0,
};

interface Cell { a: string; b: string; aWins: number; games: number; turns: number }

const cells: Cell[] = [];
const lines: string[] = [];
const say = (s: string) => { console.log(s); lines.push(s); };

say(`# 162c at 3v3 — six comps from collection v2's own partner map, ${ITER} iterations a pair, both turn orders\n`);
for (const c of COMPS) say(`  ${c.id.padEnd(13)} ${c.members.map((m) => m[1]).join(' + ')}\n${' '.repeat(17)}${c.why}`);
say('');

const t0 = Date.now();
for (let i = 0; i < COMPS.length; i++) {
    for (let j = i + 1; j < COMPS.length; j++) {
        const A = COMPS[i];
        const B = COMPS[j];
        const setup = teamScenario({ player: A.members, enemy: B.members, seed: `t162c:${A.id}-vs-${B.id}` });
        const paired = runPairedBatch(setup, { iterations: ITER });
        const games = paired.pooled.runs.length;
        // `pooled` counts PLAYER wins across both orientations, and A is the player in both.
        const aWins = paired.pooled.playerWins;
        cells.push({ a: A.id, b: B.id, aWins, games, turns: paired.pooled.averageTurns });
        say(`  ${A.id.padEnd(13)} vs ${B.id.padEnd(13)} ${String(aWins).padStart(3)}/${String(games).padEnd(3)} = `
            + `${((aWins / Math.max(1, games)) * 100).toFixed(1).padStart(5)}%   avgTurns ${paired.pooled.averageTurns.toFixed(1)}`
            + `   ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
}

// ── the table ─────────────────────────────────────────────────────────────────────────────────
const field = new Map<string, { w: number; g: number }>();
const bump = (id: string, w: number, g: number) => {
    const at = field.get(id) ?? { w: 0, g: 0 };
    field.set(id, { w: at.w + w, g: at.g + g });
};
for (const c of cells) { bump(c.a, c.aWins, c.games); bump(c.b, c.games - c.aWins, c.games); }

say(`\n\n## Comp field win rate — each against the other five\n`);
const ranked = [...field.entries()]
    .map(([id, v]) => ({ id, pct: (v.w / Math.max(1, v.g)) * 100, g: v.g }))
    .sort((a, b) => b.pct - a.pct);
for (const r of ranked) say(`  ${r.id.padEnd(13)} ${r.pct.toFixed(1).padStart(5)}%   (${r.g} games)`);

say(`\n\n## Solitaire — what a body is worth alone (§7's 1v1) against the comp that wants it\n`);
say(`  ${'member'.padEnd(17)} ${'1v1'.padStart(6)}  ${'comp'.padStart(6)}  ${'carried by'.padStart(11)}`);
for (const c of COMPS) {
    const pct = ranked.find((r) => r.id === c.id)!.pct;
    for (const [, os] of c.members) {
        const solo = SOLO_1V1[os];
        const d = pct - solo;
        say(`  ${os.padEnd(17)} ${solo.toFixed(1).padStart(6)}  ${pct.toFixed(1).padStart(6)}  ${(d >= 0 ? '+' : '') + d.toFixed(1)}  ${c.id}`);
    }
}

say(`\n  wall clock ${((Date.now() - t0) / 1000).toFixed(0)}s for ${cells.length} pairs`);
fs.mkdirSync('results/t162', { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`\n-> ${OUT}`);
