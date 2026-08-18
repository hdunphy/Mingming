/**
 * `npm run balance:deck` - generates the v2 deck report (ticket 26).
 *
 * Deliberately NOT a vitest suite. `npm run balance` is the commit gate and its runtime is a
 * standing requirement; this is an on-demand tool that answers "how is this deck doing", so
 * it runs as a plain script and writes a different file. Nothing here touches
 * `docs/balance/balance_report.json`.
 *
 * Usage:
 *
 *     npm run balance:deck                                   # every tuned subject vs the control
 *     npm run balance:deck -- --subjects ymir_v1,ymir_v2
 *     npm run balance:deck -- --subjects kraken_v1 --suites vs-control,mirror,os-variance
 *     npm run balance:deck -- --iterations 150 --out docs/balance/deck_report.json
 *
 * `--subjects` takes `<species>_<os-suffix>` ids, i.e. the OS ids themselves (`ymir_v1`), so
 * the flag reads the same as the report's `subjects[].id`.
 */

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { BALANCE_SPECIES, CONTROL_SPECIES, matchupScenario, mirrorScenario } from './balanceScenarios';
import { quietly } from './balanceReporting';
import { runPairedBatch } from './runBatch';
import {
    buildDeckReport,
    writeDeckReport,
    writeDeckReportViewer,
    DECK_REPORT_JSON_PATH,
    DECK_REPORT_THRESHOLDS,
    type MeasuredMatchup,
    type SuiteKind,
} from './deckReport';

interface Args {
    subjects: string[];
    suites: SuiteKind[];
    control: string;
    iterations: number;
    maxTurns: number;
    out: string;
}

function parseArgs(argv: string[]): Args {
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const list = (flag: string): string[] | undefined =>
        get(flag)?.split(',').map(s => s.trim()).filter(Boolean);

    return {
        subjects: list('--subjects') ?? [],
        suites: (list('--suites') as SuiteKind[] | undefined) ?? ['vs-control', 'mirror', 'os-variance'],
        control: get('--control') ?? CONTROL_SPECIES,
        iterations: Number(get('--iterations') ?? 60),
        maxTurns: Number(get('--max-turns') ?? 60),
        out: get('--out') ?? DECK_REPORT_JSON_PATH,
    };
}

/** Every playable OS id in the registry, in roster order, excluding the control. */
function allSubjectIds(): string[] {
    return BALANCE_SPECIES
        .filter(s => s !== CONTROL_SPECIES)
        .flatMap(s => MingmingRegistry[s].availableOS);
}

function speciesOf(osId: string): string | undefined {
    return Object.keys(MingmingRegistry).find(s => MingmingRegistry[s].availableOS.includes(osId));
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const subjectIds = args.subjects.length > 0 ? args.subjects : allSubjectIds();
    const seedBase = 'deck-report';

    const unknown = subjectIds.filter(id => !speciesOf(id));
    if (unknown.length > 0) {
        console.error(`[balance:deck] Unknown subject id(s): ${unknown.join(', ')}`);
        console.error(`[balance:deck] Valid ids: ${allSubjectIds().join(', ')}`);
        process.exitCode = 1;
        return;
    }

    console.log(`[balance:deck] ${subjectIds.length} subject(s), suites ${args.suites.join('/')}, ${args.iterations} seeds x 2 turn orders`);

    const subjects: Parameters<typeof buildDeckReport>[0]['subjects'] = [];

    for (const subjectId of subjectIds) {
        const species = speciesOf(subjectId)!;
        const matchups: MeasuredMatchup[] = [];
        const batchOptions = { iterations: args.iterations, maxTurns: args.maxTurns, telemetry: true };

        if (args.suites.includes('vs-control')) {
            // The SUBJECT is the enemy here, because `matchupScenario` puts the control on the
            // player side exactly as the archetype gauntlet does - keeping the orientation
            // identical is what makes these rows comparable to `balance_report.json`'s.
            const setup = matchupScenario({
                player: args.control, enemy: species, enemyOS: subjectId,
                seed: `${seedBase}:vs-control:${subjectId}`,
            });
            matchups.push({
                id: `deck:${subjectId}-vs-control`, suite: 'vs-control', role: 'vs-control',
                label: `${subjectId} vs ${args.control}`,
                subjectId, subjectSpecies: species, subjectOS: subjectId,
                opponent: args.control, opponentOS: `${args.control}_v1`,
                subjectSide: 'ENEMY',
                paired: quietly(() => runPairedBatch(setup, batchOptions)),
            });
        }

        if (args.suites.includes('mirror')) {
            const setup = { ...mirrorScenario(species), seed: `${seedBase}:mirror:${subjectId}` };
            matchups.push({
                id: `deck:${subjectId}-mirror`, suite: 'mirror', role: 'mirror',
                label: `${subjectId} mirror`,
                subjectId, subjectSpecies: species, subjectOS: subjectId,
                opponent: species, opponentOS: subjectId,
                subjectSide: 'PLAYER',
                paired: quietly(() => runPairedBatch(setup, batchOptions)),
            });
        }

        if (args.suites.includes('os-variance')) {
            const [v1, v2] = MingmingRegistry[species].availableOS;
            if (v1 && v2) {
                const isV1 = subjectId === v1;
                const setup = matchupScenario({
                    player: species, enemy: species, playerOS: v1, enemyOS: v2,
                    seed: `${seedBase}:os-variance:${species}`,
                });
                matchups.push({
                    id: `deck:${subjectId}-os-variance`, suite: 'os-variance', role: 'os-variance',
                    label: `${v1} vs ${v2}`,
                    subjectId, subjectSpecies: species, subjectOS: subjectId,
                    opponent: species, opponentOS: isV1 ? v2 : v1,
                    subjectSide: isV1 ? 'PLAYER' : 'ENEMY',
                    paired: quietly(() => runPairedBatch(setup, batchOptions)),
                });
            }
        }

        if (args.suites.includes('gauntlet')) {
            for (const opponent of BALANCE_SPECIES.filter(s => s !== CONTROL_SPECIES && s !== species)) {
                const setup = matchupScenario({
                    player: species, enemy: opponent, playerOS: subjectId,
                    seed: `${seedBase}:gauntlet:${subjectId}:${opponent}`,
                });
                matchups.push({
                    id: `deck:${subjectId}-vs-${opponent}`, suite: 'gauntlet', role: 'gauntlet-matchup',
                    label: `${subjectId} vs ${opponent}`,
                    subjectId, subjectSpecies: species, subjectOS: subjectId,
                    opponent, opponentOS: MingmingRegistry[opponent].availableOS[0],
                    subjectSide: 'PLAYER',
                    paired: quietly(() => runPairedBatch(setup, batchOptions)),
                });
            }
        }

        console.log(`[balance:deck]   ${subjectId}: ${matchups.length} matchup(s)`);
        subjects.push({ id: subjectId, species, os: subjectId, matchups });
    }

    const { report, warnings } = buildDeckReport({
        command: `npm run balance:deck -- ${process.argv.slice(2).join(' ')}`.trim(),
        config: {
            suites: args.suites,
            iterations: args.iterations,
            maxTurns: args.maxTurns,
            seedBase,
            thresholds: DECK_REPORT_THRESHOLDS,
        },
        control: args.suites.includes('vs-control')
            ? { species: args.control, os: `${args.control}_v1` }
            : null,
        subjects,
    });

    const path = writeDeckReport(report, args.out);
    const viewerPath = writeDeckReportViewer(report, args.out.replace(/\.json$/, '.html'));
    for (const w of warnings) console.warn(`[balance:deck] WARNING: ${w}`);
    console.log(`[balance:deck] ${path}`);
    console.log(`[balance:deck] ${viewerPath}  <- open this`);
    console.log(`[balance:deck]   ${report.subjects.length} subject(s), ${report.cards.length} card row(s), ${report.statuses.length} status row(s), ${report.matchups.length} matchup(s), ${report.redlines.length} redline(s)`);
    console.log(`[balance:deck]   registry ${report.registryHash}`);
}

void main();
