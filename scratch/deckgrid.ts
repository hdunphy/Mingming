/**
 * The deep field grid: every deck against every OTHER DECK, not against a species' default OS.
 *
 * Ticket 69's census was 32 decks x 15 opponent SPECIES, with the opponent always playing
 * `availableOS[0]`. That is enough to find 0%/100% cells but it cannot test the ARCHETYPE WEB,
 * because roles are assigned per DECK: `jormungandr_v1` is Zoo and `jormungandr_v2` is Burst, and
 * half of every role's members were simply never on the board as an opponent. This runs the full
 * 32 x 31 = 992-cell grid so both wheels - the type chart and the archetype web - can be read.
 *
 * Writes `docs/balance/deck_grid.json`.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ElementalMatrix } from '../src/engine/combatUtils';
import { writeFileSync } from 'node:fs';

const ITER = Number(process.env.ITER ?? 30);

/**
 * Roles from `research/archetype-web.md`, including Henry's 2026-08-16 orphan assignments.
 * The wheel under test: ZOO beats RAMP beats CONTROL beats ZOO. BURST is the flex spoke and
 * carries NO prey/predator licence - it is held to 10-90 everywhere.
 */
const ROLE: Record<string, 'ZOO' | 'RAMP' | 'CONTROL' | 'BURST'> = {
    jormungandr_v1: 'ZOO', sleipnir_v1: 'ZOO', hraesvelgr_v1: 'ZOO',
    audhumbla_v1: 'RAMP', audhumbla_v2: 'RAMP', valkyrie_v1: 'RAMP', valkyrie_v2: 'RAMP',
    ymir_v1: 'RAMP', ymir_v2: 'RAMP', hraesvelgr_v2: 'RAMP', kraken_v2: 'RAMP',
    gullinbursti_v2: 'BURST', fafnir_v1: 'RAMP',
    kraken_v1: 'CONTROL', ratatoskr_v1: 'CONTROL', ratatoskr_v2: 'CONTROL',
    huldra_v1: 'CONTROL', huldra_v2: 'CONTROL', draugr_v1: 'CONTROL', draugr_v2: 'CONTROL',
    fenrir_v1: 'BURST', fenrir_v2: 'BURST', skoll_v1: 'BURST', skoll_v2: 'BURST',
    hel_v1: 'BURST', hel_v2: 'BURST', nidhoggr_v1: 'BURST', nidhoggr_v2: 'BURST',
    jormungandr_v2: 'BURST', sleipnir_v2: 'BURST', gullinbursti_v1: 'BURST', fafnir_v2: 'BURST',
};

const decks: Array<{ species: string; deck: string }> = [];
for (const species of BALANCE_SPECIES)
    for (const deck of MingmingRegistry[species].availableOS) decks.push({ species, deck });

function bucketOf(a: string, b: string): 'ADV' | 'NEU' | 'DIS' {
    const ea = MingmingRegistry[a].primaryElement as never;
    const eb = MingmingRegistry[b].primaryElement as never;
    const out = (ElementalMatrix as Record<string, Record<string, number>>)[ea]?.[eb] ?? 1;
    const inc = (ElementalMatrix as Record<string, Record<string, number>>)[eb]?.[ea] ?? 1;
    if (out > 1 && inc <= 1) return 'ADV';
    if (inc > 1 && out <= 1) return 'DIS';
    return 'NEU';
}

const cells: any[] = [];
let done = 0;
for (const a of decks) {
    for (const b of decks) {
        if (a.species === b.species) continue;   // mirrors and same-species v1-vs-v2 have their own suites
        const r = runPairedBatch(
            matchupScenario({
                player: a.species, enemy: b.species,
                playerOS: a.deck, enemyOS: b.deck,
                seed: `grid:${a.deck}:${b.deck}`,
            }),
            { iterations: ITER });
        cells.push({
            deck: a.deck, species: a.species, opponent: b.deck, opponentSpecies: b.species,
            bucket: bucketOf(a.species, b.species),
            role: ROLE[a.deck] ?? '?', opponentRole: ROLE[b.deck] ?? '?',
            games: r.pooled.iterations, decisive: r.pooled.decisive,
            winRate: Number(r.pooled.decisiveWinRate.toFixed(4)),
            turns: Number(r.pooled.averageTurns.toFixed(2)),
            ftk: r.pooled.ftkCount,
            dead: Number(r.pooled.deadCardRatio.toFixed(4)),
        });
    }
    done++;
    const mine = cells.filter(c => c.deck === a.deck);
    console.error(`[${done}/${decks.length}] ${a.deck.padEnd(18)} mean ${(mine.reduce((s, c) => s + c.winRate, 0) / mine.length * 100).toFixed(1)}%  ` +
        `zeros ${mine.filter(c => c.winRate <= 0).length}  hundreds ${mine.filter(c => c.winRate >= 1).length}  ftk ${mine.reduce((s, c) => s + c.ftk, 0)}`);
}

writeFileSync('docs/balance/deck_grid.json', `${JSON.stringify({
    schemaVersion: 1,
    note: 'Every deck vs every other deck, both turn orders. Roles from research/archetype-web.md.',
    iterationsPerOrder: ITER,
    cells,
}, null, 1)}\n`);
console.error(`\nWROTE docs/balance/deck_grid.json  ${cells.length} cells`);
