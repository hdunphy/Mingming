/**
 * `npm run balance:run-gate` — ticket 61's run gate, printed.
 *
 * The harness is `runGate.ts`; this file is the argv, the table and the exit code. Same split as
 * `runDeckReport.ts` / `deckReport.ts`, and for the same reason: the thing that decides *what to
 * measure* should be importable and testable without a `console.log` in it.
 *
 * Usage:
 *
 *     npm run balance:run-gate                                  # all three bands, ITERATIONS_DEFAULT each
 *     npm run balance:run-gate -- --iterations 12               # one full pass over the 12 tuned OS ids
 *     npm run balance:run-gate -- --bands gauntlet --iterations 24
 *     npm run balance:run-gate -- --cells wild:biome0 --iterations 400   # the cheap cells, to real precision
 *     npm run balance:run-gate -- --strict                      # exit 1 if any band is outside ±5
 *     npm run balance:run-gate -- --list                        # every cell id, and nothing else
 *
 * `--cells` exists because **the nine cells differ in cost by a factor of two hundred** (see
 * `runGate.ts`'s cost table), and `--iterations` alone therefore prices the whole gate at its most
 * expensive cell. `wild:biome0` is a 1v1 and runs 400 samples in under a minute; `gauntlet:fight2` is
 * a 3v3 and runs 400 samples in about five hours. A knob that could only move them together would
 * mean the two cheap cells were permanently under-sampled for no reason at all. A band measured with
 * `--cells` is still pooled over whatever cells were run, so **a band verdict from a partial cell set
 * is not a band verdict** — the header line says which cells were in it, and that line is the caveat.
 *
 * # DELIBERATELY NOT A VITEST SUITE, AND DELIBERATELY NOT A CI GATE
 *
 * `npm run balance` is the commit gate and its runtime is a standing requirement (ticket 20). This
 * measures a different thing (a run, not a deck) at a cost that would swamp that gate — six of its
 * nine cells are 3v3 — so it runs as a plain script, writes no file, and touches neither
 * `docs/balance/balance_report.json` nor `deck_report.json`.
 *
 * Ticket 61 asks for *"a report, not a CI gate"*: the exit code is **0 whatever the numbers say**,
 * so a failing band is a finding for Henry to rule on rather than a red build. `--strict` flips that
 * for whoever eventually wants it wired into something.
 *
 * # THE DEFAULT, AND ITS RUNTIME — MEASURED, NOT ESTIMATED, AND OVER THE TICKET'S BUDGET
 *
 * `ITERATIONS_DEFAULT = 2` is **18 battles: 2 samples in each of 9 cells**, and it takes
 * **8m 23s** — measured, 502,832 ms, on a 2-core Xeon @2.8GHz under `npx vite-node`. Split: WILDS
 * 63.7s, ELITES 144.3s, GAUNTLET 294.8s. Two separate default runs produced byte-identical win/loss
 * sequences, which is the determinism contract holding: every seed in this gate derives from a
 * sample index, so the same invocation is the same 18 battles.
 *
 * **Ticket 61 asked for well under five minutes and this does not meet it. The reason is worth
 * recording rather than papering over, because it is a fact about the engine and not about this
 * script.** Six of the nine cells are 3v3, a 3v3 battle costs 30-70 seconds, and nothing this file
 * controls changes that: `TacticalAI`'s same-turn search enumerates casters x hand x targets, so a
 * 3v3 decision is ~200x a 1v1 one (`runGate.ts`'s cost table, and `gauntlet-boss.balance.ts` reached
 * the same wall independently). The gate needs 3v3 because the run does — a trio at biome 2 and a
 * trio at the gym are what ticket 61 named as the representative decks.
 *
 * Three ways out were considered and all three are worse than telling the truth:
 *
 * - **`ITERATIONS_DEFAULT = 1`** hits the budget at ~4m 10s, and prints three battles per band — a
 *   band that can only read 0%, 33%, 67% or 100%. That satisfies a stopwatch by making the output
 *   unreadable, which is the wrong trade for a ticket whose deliverable is numbers.
 * - **`AI_LITE` / `AI_BEAM`** would buy roughly 2-3x. Ticket 108 calibrated both and its ruling is
 *   explicit — *"SCREEN WITH LITE, CONFIRM THE WINNER WITH FULL. Never read a band verdict off
 *   lite"* — and lite biases weak arms UP by as much as 8 points, which is larger than the window
 *   being checked. (It is moot anyway: see the `process.env` note below.)
 * - **Dropping the 3v3 cells** would make the gate fast and make it measure a different game.
 *
 * So the default is sized to be *readable* rather than *fast*, and the cost is printed at the bottom
 * of every run. **At the default every band's 95% interval is roughly ±20 to ±40 points, four to
 * eight times ticket 61's ±5 window** — the default exists to prove the harness runs end to end and
 * to catch a band that is wrong by thirty points, not to close the window. Closing it needs
 * `--iterations` in the low hundreds and hours of wall clock; buy it one band at a time with
 * `--bands`, and use `--cells` for the two cheap cells, which are nearly free.
 *
 * # WHAT THE FIRST REAL MEASUREMENT SAID (2026-08-26, registry `1:1ad8616b`)
 *
 * Recorded here the way `gauntlet-boss.balance.ts` records its first smoke run: **not as a threshold
 * and not as a claim about what the game should be**, but so the next person to run this knows what
 * moved and what did not. Every number is a measurement, not a target. All three bands are far
 * outside their windows, and **none of the three misses is a sampling artefact** — the two cheapest
 * cells were run to 1,200 samples each, which puts their intervals well inside ±5.
 *
 * | cell | n | win rate | 95% CI |
 * |---|---|---|---|
 * | `wild:biome0`     | 1200 | **67.1%** | 64.4-69.7 |
 * | `wild:biome1`     |  120 | **26.7%** | 19.6-35.2 |
 * | `wild:biome2`     |   12 | 50.0%     | wide |
 * | `elite:biome0`    | 1200 | **36.9%** | 34.2-39.7 |
 * | `elite:biome1`    |  120 | **42.5%** | 34.0-51.4 |
 * | `elite:biome2`    |   12 | 41.7%     | wide |
 * | `gauntlet:fight0` |   12 | 75.0%     | wide |
 * | `gauntlet:fight1` |   12 | 66.7%     | wide |
 * | `gauntlet:fight2` |   12 | **8.3%**  | wide |
 *
 * Pooled at 12 samples per cell: WILDS **52.8%** (19/36) against 95, ELITES **41.7%** (15/36)
 * against 75, GAUNTLET **50.0%** (18/36) against 60.
 *
 * Three things in that table are shapes rather than magnitudes, and they are the ones worth chasing:
 *
 * 1. **The kit fraction is not monotonic.** A biome-1 wild (26.7%) is harder than a biome-2 wild
 *    (50.0%) and much harder than a biome-0 one (67.1%), so ticket 08's table does not currently
 *    produce a rising difficulty curve — it produces a spike in the middle. The plausible mechanism
 *    is deck CONCENTRATION rather than deck size: the biome-1 rule is `start-kit`, five pure engine
 *    cards per body and no filler, while the biome-2 rule is `tuned`, nine cards including whatever
 *    the tuned list carries to smooth itself out. The player, meanwhile, is holding three neutral
 *    `GENERIC_HIT` at every depth.
 * 2. **The gym boss is not in the same game as the two fights before it** — 8.3% against 75.0% and
 *    66.7%. Ticket 18's own smoke run said the same thing in twelve battles ("the boss team won 12
 *    of 12... may simply be over the line"), and this is that result at the run's real party and
 *    deck. And it is an *optimistic* reading: this harness fights from full HP and the real gauntlet
 *    carries damage forward with no heal.
 * 3. **The enemy out-rolls the player on IVs by about five points in every stat, everywhere.** See
 *    the block above `partyFor` in `runGate.ts` for the two call sites. It is upstream of every band
 *    in this table and of every deck in the game, so it should be ruled on before any deck is.
 */

import { appendFileSync, writeFileSync } from 'node:fs';

import { computeRegistryHash } from '../scenarios/registryHash';
import { AI_TIER } from '../../engine/ai/TacticalAI';
import { DEFAULT_MAX_TURNS } from './runBatch';
import { HANDBUILT_PARTIES, handbuiltParty, type HandbuiltParty } from './handbuiltParties';
import { applyRegistryTweaks, describeTweaks, validateTweaks } from './experimentalTweaks';
import {
    CELLS,
    RUN_GATE_TARGETS,
    RUN_GATE_TOLERANCE,
    TUNED_OS_IDS,
    gauntletCompound,
    describeBossOverride,
    measureBand,
    type BossOverride,
    type MatchupMode,
    type BandId,
    type BandMeasurement,
    type CellMeasurement,
} from './runGate';

/**
 * `--out <file>` — mirror every reported line into a file, line by line, as it is produced.
 *
 * THIS IS NOT A CONVENIENCE. A full gauntlet arm is hours of wall clock, and the two ways those
 * hours have already been lost are both silent:
 *
 *  - **Node BLOCK-buffers stdout when it is a pipe.** `... > gate.txt` holds the whole report in a
 *    64 KiB buffer and flushes at exit, so a run that is killed — a closed terminal, a reclaimed
 *    container, Ctrl-C at hour three — leaves an EMPTY file, not a partial one.
 *  - **A long run dies.** Then the only thing that matters is how much of it survived.
 *
 * `appendFileSync` per line is the fix for both: the file is complete-to-the-second at every
 * moment, so a killed run is a *short* measurement rather than no measurement. The per-line syscall
 * costs microseconds against a battle that costs tens of seconds.
 *
 * Stdout still gets every line too — this tees, it does not redirect.
 */
let outFile: string | undefined;

function say(line = ''): void {
    console.log(line);
    if (outFile !== undefined) appendFileSync(outFile, `${line}\n`);
}

/** See the header. Two samples per cell, ~5 minutes, ±20 points per band. */
const ITERATIONS_DEFAULT = 2;

const ALL_BANDS: ReadonlyArray<BandId> = ['wild', 'elite', 'gauntlet'];

interface Args {
    bands: BandId[];
    /** Cell ids to restrict to, empty = every cell of every selected band. */
    cells: string[];
    iterations: number;
    maxTurns: number;
    strict: boolean;
    /** Print the sampled lineups and enemy rosters per cell. Off by default — it is a wall of text. */
    verbose: boolean;
    /** Print the cell ids and exit. */
    list: boolean;
    /**
     * Which player to model — Henry's ticket-67 ruling. `blind` (default) is the original stride and
     * reproduces every number taken before that ruling; `favourable` is the PREPARED arm the
     * 95/75/60 targets grade; `control` removes type from the fight. See `runGate.MatchupMode`.
     */
    matchup: MatchupMode;
    /**
     * Run-scoped boss isolation — ticket 67 rulings round 3. `--boss-ivs 10` (or `10/12/14` as
     * hp/attack/defense) replaces the authored `BOSS_IVS` for this run only; `--boss-relics off`
     * strips the `boss_relic_*` hooks while leaving the deck identical. **Neither edits a shipped
     * constant**, because the question being measured is which knob is the wall and turning a knob
     * to answer it would destroy the baseline.
     */
    bossOverride?: BossOverride;
    /**
     * TICKET 68: `--gym gym_emberfall` pins every sample to one leader.
     *
     * The three gyms stopped being the same fight when ruling 5 authored Emberfall and ruling 6 left
     * the other two on ticket 18's formula boss. Unpinned, `gauntlet:fight2` blends them and reports
     * an average about neither. **A pinned arm is not comparable to a number taken before this
     * flag** — it is a different population, not a deeper sample of the same one.
     */
    gymId?: string;
    /** `--out <file>`: tee every reported line into this file as it is produced. See `say`. */
    out?: string;
    /**
     * `--handbuilt <id>`: measure a DESIGNED party and deck instead of a generated lineup.
     *
     * The generated arms can only field all-v1 or all-v2 teams holding the 18-card start deck, so
     * they measure type preparation and nothing else. This measures the other thing. See
     * `handbuiltParties.ts`.
     */
    handbuilt?: HandbuiltParty;
    /**
     * `--toolbox`: hand the party the pinned gym's three ruled counter answers.
     *
     * A CEILING arm — see `sampleFight`. It answers "can a player holding the designed counters beat
     * this boss", not "does the average player find them".
     */
    toolbox?: boolean;
    /**
     * `--tweak <name>[,<name>]`: named, uncommitted balance knobs for this measurement only.
     *
     * `boss-cantrips`, `ink-power-<N>`, `thorn-target` — see `experimentalTweaks.ts` for what each
     * one is testing and why none of them is an edit to `programs.json`. Composable on purpose, so a
     * two-knob arm can be run once the single-knob arms say which two are worth combining.
     */
    tweaks: ReadonlyArray<string>;
}

/** `--boss-ivs 10` or `--boss-ivs 10/12/14`. Uniform is the common case; the triple is for a lever
 *  that turns out to be one stat rather than all three. */
function parseBossIvs(raw: string | undefined): BossOverride['ivs'] {
    if (raw === undefined) return undefined;
    const parts = raw.split('/').map((n) => Number(n.trim()));
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 31)) {
        throw new Error(`[run-gate] --boss-ivs expects 0-31 integers, got "${raw}"`);
    }
    if (parts.length === 1) return { hp: parts[0], attack: parts[0], defense: parts[0] };
    if (parts.length === 3) return { hp: parts[0], attack: parts[1], defense: parts[2] };
    throw new Error(`[run-gate] --boss-ivs expects one value or three (hp/attack/defense), got "${raw}"`);
}

/**
 * Argv parsing, copied in shape from `runDeckReport.parseArgs` rather than reached for from a
 * library: the balance scripts are run by hand from a terminal and a dependency that has to be
 * installed to read `--iterations 12` is a dependency this repo does not need.
 *
 * Flags rather than environment variables, and that is forced rather than chosen — `vite.config.ts`
 * carries `define: { 'process.env': {} }`, so under `vite-node` every `process.env` read in the
 * module graph is substituted to `{}` before the script ever starts. `process.argv` is untouched.
 */
/** Resolve `--handbuilt <id>`, failing LOUDLY on a typo rather than silently measuring the arm. */
function resolveHandbuilt(id: string | undefined): HandbuiltParty | undefined {
    if (id === undefined) return undefined;
    const found = handbuiltParty(id);
    if (found === undefined) {
        throw new Error(
            `[run-gate] Unknown --handbuilt party "${id}". Known: ${Object.keys(HANDBUILT_PARTIES).join(', ')}`,
        );
    }
    return found;
}

function parseArgs(argv: string[]): Args {
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const list = (flag: string): string[] | undefined =>
        get(flag)?.split(',').map((s) => s.trim()).filter(Boolean);

    const bands = (list('--bands') as BandId[] | undefined) ?? [...ALL_BANDS];
    const iterations = Number(get('--iterations') ?? ITERATIONS_DEFAULT);
    // Validated at PARSE time, not at use time: a misspelled knob that parses and changes nothing
    // produces a banner describing an arm nobody ran. That is the `--toolbox` bug's failure class.
    const tweaks = list('--tweak');
    validateTweaks(tweaks ?? []);

    return {
        bands,
        cells: list('--cells') ?? [],
        iterations,
        maxTurns: Number(get('--max-turns') ?? DEFAULT_MAX_TURNS),
        matchup: (get('--matchup') as MatchupMode | undefined) ?? 'blind',
        gymId: get('--gym'),
        out: get('--out'),
        handbuilt: resolveHandbuilt(get('--handbuilt')),
        toolbox: argv.includes('--toolbox'),
        tweaks: tweaks ?? [],
        bossOverride: {
            ivs: parseBossIvs(get('--boss-ivs')),
            relics: get('--boss-relics') === 'off' ? 'off' : undefined,
        },
        strict: argv.includes('--strict'),
        verbose: argv.includes('--verbose'),
        list: argv.includes('--list'),
    };
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** `1h 04m 12s` for anything past a minute, plain seconds below it. */
function clock(ms: number): string {
    const total = Math.round(ms / 1000);
    if (total < 60) return `${total}s`;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
        ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
        : `${m}m ${String(s).padStart(2, '0')}s`;
}

/**
 * What each arm is, said once at the top of a report, because a number without its arm is not a
 * number: the same cell measures very differently under `blind` and `favourable`, and a pasted
 * figure that has lost its header is unreadable.
 */
const MATCHUP_LABEL: Readonly<Record<MatchupMode, string>> = {
    blind: 'BLIND matchup (party picked without looking at the biome — the population average)',
    favourable: 'PREPARED player (brings the counter-element — THIS is the arm 95/75/60 grade)',
    control: 'CONTROL (party is the fight\'s own element — type removed, 1.0x both ways)',
};

const BAND_LABEL: Readonly<Record<BandId, string>> = {
    wild: 'WILDS   (ordinary wild nodes)',
    elite: 'ELITES  (biome exits + rolled middle elites)',
    gauntlet: 'GAUNTLET (the gym\'s three fights)',
};

function cellLine(cell: CellMeasurement): string {
    return (
        `    ${cell.label.padEnd(26)} ` +
        `${String(cell.partySize)}v${String(cell.enemiesSeen[0]?.split(' + ').length ?? '?')}  ` +
        `${String(cell.wins).padStart(3)}/${String(cell.battles).padEnd(3)} = ${pct(cell.winRate).padStart(6)}  ` +
        `decisive=${pct(cell.decisiveWinRate).padStart(6)}  ` +
        `avgTurns=${cell.averageTurns.toFixed(1).padStart(4)}  ` +
        `ftk=${cell.ftkCount}  stalled=${cell.truncatedCount}  ` +
        `${secs(cell.elapsedMs)}`
    );
}

/**
 * Is this band's sample too thin for its verdict to mean anything?
 *
 * The test is the only one that is actually about the ticket: **is the 95% interval narrower than
 * the ±5 window the verdict is being read against?** If it is not, PASS and FAIL are both statements
 * about the sample size rather than about the game — a band could print PASS at the default and FAIL
 * at `--iterations 40` without a single card changing. Ticket 61 asked for PASS/FAIL and it gets
 * PASS/FAIL, but a verdict this flag marks is a placeholder for a measurement nobody has paid for
 * yet, and hiding that behind a confident word would be the one way this report could mislead.
 */
const underSampled = (band: BandMeasurement): boolean =>
    band.high - band.low > 2 * RUN_GATE_TOLERANCE;

/**
 * One band's verdict line.
 *
 * The interval is printed *before* the verdict on purpose. A PASS whose interval spans the whole
 * window is not a pass, it is an absence of evidence, and putting the two next to each other is the
 * only way a reader skimming the output sees that.
 */
function bandLines(band: BandMeasurement): string[] {
    const target = RUN_GATE_TARGETS[band.band];
    const window = `${pct(target - RUN_GATE_TOLERANCE)}-${pct(target + RUN_GATE_TOLERANCE)}`;
    /*
     * THE GRADED NUMBER, and it is not always the pooled one.
     *
     * The gauntlet target is the chance of CLEARING three fights, so `measureBand` grades
     * `band.compound` there and the pooled per-fight rate is context (Henry, 2026-08-30). Reading
     * the delta off `measured` for the gauntlet is the exact mistake that made a calibrated
     * Emberfall print FAIL by 23 points for several sessions, so the delta, the verdict and the
     * caveat below all read the same figure — and the line SAYS which figure it is.
     */
    const graded = band.compound ?? band.measured;
    const delta = graded - target;
    const signed = `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}pt`;
    const caveat = underSampled(band)
        ? `  <- UNDER-SAMPLED: the 95% interval (±${(((band.high - band.low) / 2) * 100).toFixed(1)}pt) is wider than the ±5 window, so this verdict is not yet evidence`
        : '';

    return [
        '',
        `  ${BAND_LABEL[band.band]}`,
        ...(band.band === 'gauntlet' && band.compound === undefined ? [
            `    NOT GRADED ON THE COMPOUND — only part of the gauntlet was measured, so the clear rate ` +
            `cannot be computed. The pooled per-fight rate below is graded instead,`,
            `    against a target that describes CLEARING all three fights. Read it as a fight rate, ` +
            `not as a verdict: ~84.3% per fight is what a 60% clear needs.`,
        ] : []),
        ...(band.compound === undefined ? [] : [
            `    GRADED ON THE COMPOUND — ${pct(band.compound)} chance of clearing all three fights ` +
            `(the product of the per-fight rates below). The 60% target is a CLEAR rate, not a fight rate;`,
            `    a uniform gauntlet needs ~84.3% per fight to reach it. Pooled per-fight rate, for context: ` +
            `${pct(band.measured)} (${band.wins}/${band.battles}).`,
        ]),
        `    target ${pct(target)} (window ${window})   ` +
        `${band.compound === undefined ? 'measured' : 'compound'} ${pct(graded)} ` +
        `(${band.wins}/${band.battles}, ${signed})   ` +
        `95% CI ${pct(band.low)}-${pct(band.high)}`,
        `    ${band.inBand ? 'PASS' : 'FAIL'} — ${band.inBand
            ? 'inside the ±5 window'
            : `outside the ±5 window by ${((Math.abs(delta) - RUN_GATE_TOLERANCE) * 100).toFixed(1)}pt`}` +
        `   [${secs(band.elapsedMs)}]${caveat}`,
        ...band.cells.map(cellLine),
    ];
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (args.out !== undefined) {
        // Truncate ONCE, here, rather than appending to whatever was there. A second run writing
        // its report underneath a first one produces a file whose two halves disagree and no way to
        // tell which line belongs to which arm.
        writeFileSync(args.out, '');
        outFile = args.out;
        console.log(`[balance:run-gate] teeing every line to ${args.out} as it is produced.`);
    }

    if (args.list) {
        for (const cell of CELLS) say(`${cell.id.padEnd(20)} ${cell.partySize}v? ${cell.label}`);
        return;
    }

    /*
     * The registry knobs are applied HERE and nowhere else — before the first party, run, encounter
     * or battle is built. `GetProgramData` reads `ProgramRegistry` live, but
     * `getInflatedProgramRegistry` memoises on first call, so a knob applied late would silently
     * apply to some consumers and not others. This is the only safe point in the script.
     */
    if (args.tweaks.length > 0) {
        applyRegistryTweaks(args.tweaks);
        console.log(`[balance:run-gate] EXPERIMENTAL TWEAKS ACTIVE — ${args.tweaks.join(', ')}`);
        for (const line of describeTweaks(args.tweaks)) console.log(`[balance:run-gate]   ${line}`);
        console.log('[balance:run-gate] programs.json is UNTOUCHED. This number is not a baseline.');
    }

    const unknown = args.bands.filter((band) => !ALL_BANDS.includes(band));
    if (unknown.length > 0) {
        console.error(`[balance:run-gate] Unknown band(s): ${unknown.join(', ')}`);
        console.error(`[balance:run-gate] Valid bands: ${ALL_BANDS.join(', ')}`);
        process.exitCode = 1;
        return;
    }
    if (!Number.isFinite(args.iterations) || args.iterations < 1) {
        console.error('[balance:run-gate] --iterations must be an integer >= 1.');
        process.exitCode = 1;
        return;
    }

    const unknownCells = args.cells.filter((id) => !CELLS.some((cell) => cell.id === id));
    if (unknownCells.length > 0) {
        console.error(`[balance:run-gate] Unknown cell id(s): ${unknownCells.join(', ')}`);
        console.error(`[balance:run-gate] Valid ids: ${CELLS.map((cell) => cell.id).join(', ')}`);
        process.exitCode = 1;
        return;
    }

    const cells = CELLS.filter((cell) =>
        args.bands.includes(cell.band) && (args.cells.length === 0 || args.cells.includes(cell.id)));
    if (cells.length === 0) {
        console.error('[balance:run-gate] --bands and --cells select no cells between them.');
        process.exitCode = 1;
        return;
    }
    const battles = cells.length * args.iterations;

    say('[balance:run-gate] Ticket 61 — tier-1 run win rates against the three enemy grades.');
    say(`[balance:run-gate]   bands      ${args.bands.join(', ')}  (${cells.length} cells: ${cells.map((c) => c.id).join(', ')})`);
    say(`[balance:run-gate]   iterations ${args.iterations} per cell  ->  ${battles} battles, PLAYER moves first (as a run does)`);
    say(`[balance:run-gate]   sample     ${TUNED_OS_IDS.length} tuned OS ids, stride-5 rotation; one fresh run seed, region graph and gym offer per sample`);
    say(`[balance:run-gate]   AI tier    ${AI_TIER}   maxTurns ${args.maxTurns}   registry ${computeRegistryHash()}`);
    say('');

    const started = Date.now();
    const results: BandMeasurement[] = [];

    // A band with no selected cell is not measured at all rather than measured as 0/0: `--cells
    // wild:biome0` must not print an ELITES row that says 0.0% FAIL about six battles nobody ran.
    for (const band of args.bands.filter((b) => cells.some((cell) => cell.band === b))) {
        results.push(measureBand(band, cells, {
            iterations: args.iterations,
            maxTurns: args.maxTurns,
            matchup: args.matchup,
            gymId: args.gymId,
            bossOverride: args.bossOverride,
            handbuilt: args.handbuilt,
            toolbox: args.toolbox,
            tweaks: args.tweaks,
            onProgress: (cell, sampleIndex, elapsedMs, won) => {
                say(
                    `[balance:run-gate]   ${cell.id} ${sampleIndex}/${args.iterations} ` +
                    `${won ? 'WIN ' : 'loss'}  ${secs(elapsedMs)} into cell, ${clock(Date.now() - started)} total`,
                );
            },
        }));
    }

    const elapsed = Date.now() - started;

    say('');
    say('='.repeat(112));
    say(`  RUN GATE — ticket 61   ·   ${MATCHUP_LABEL[args.matchup]}`);
    say(`  ${describeBossOverride(args.bossOverride)}`);
    // Ticket 68: a pinned arm is a different POPULATION from an unpinned one, so the header has to
    // say so — the whole value of these numbers is that they can be pasted somewhere and still mean
    // what they meant.
    if (args.toolbox) {
        say('  TOOLBOX ARM — the party holds this gym\'s three ruled counter answers (a CEILING, not a median run).');
    }
    if (args.tweaks.length > 0) {
        // Loud, and above the party line, because the one thing that must never happen to this
        // report is being pasted somewhere as a baseline. `programs.json` still says otherwise.
        say(`  ** EXPERIMENTAL TWEAKS — NOT A BASELINE, NOT COMMITTED (${args.tweaks.join(', ')}) **`);
        for (const line of describeTweaks(args.tweaks)) say(`     ${line}`);
    }
    if (args.handbuilt) {
        say(`  HAND-BUILT PARTY "${args.handbuilt.id}" — ${args.handbuilt.label}`);
        say(
            `  ${args.handbuilt.lineup.join(' + ')}   ` +
            `(${args.handbuilt.deck ? `${args.handbuilt.deck.length} cards` : 'run-dealt start deck'})`,
        );
    }
    say(args.gymId
        ? `  PINNED to ${args.gymId} — not comparable to an unpinned number (ticket 68)`
        : '  all three leaders, evenly (unpinned)');
    say('='.repeat(112));
    for (const band of results) for (const line of bandLines(band)) say(line);

    const gauntlet = results.find((band) => band.band === 'gauntlet');
    if (gauntlet && gauntlet.cells.length === 3) {
        say('');
        say(
            `    clears all three (product of the per-fight rates): ${pct(gauntletCompound(gauntlet))}` +
            '  — UNBANDED, and an UPPER BOUND: the gauntlet carries HP between fights and this',
        );
        say('      harness fights each one from full. See `gauntletCompound` for why.');
    }

    say('');
    say('-'.repeat(112));
    const failures = results.filter((band) => !band.inBand);
    say(
        `  ${failures.length === 0 ? 'ALL BANDS IN WINDOW' : `${failures.length} BAND(S) OUTSIDE WINDOW: ${failures.map((b) => b.band).join(', ')}`}`,
    );
    const thin = results.filter(underSampled);
    if (thin.length > 0) {
        say(
            `  ${thin.length} BAND(S) UNDER-SAMPLED (${thin.map((b) => b.band).join(', ')}): ` +
            'their 95% interval is wider than the ±5 window, so the verdicts above are provisional. ' +
            'Raise --iterations.',
        );
    }
    say(`  wall clock ${clock(elapsed)} (${elapsed} ms) for ${results.reduce((n, b) => n + b.battles, 0)} battles`);
    say(`  ${(elapsed / Math.max(1, results.reduce((n, b) => n + b.battles, 0)) / 1000).toFixed(1)}s per battle averaged over every cell`);
    say('-'.repeat(112));

    if (args.verbose) {
        say('');
        say('  SAMPLES (player lineup vs rolled enemy roster, in sample order)');
        for (const band of results) {
            for (const cell of band.cells) {
                say(`    ${cell.id}`);
                cell.lineupsSeen.forEach((lineup, i) => {
                    say(`      ${String(i).padStart(3)}  ${lineup.padEnd(46)} vs  ${cell.enemiesSeen[i]}`);
                });
            }
        }
    }

    // Ticket 61: a report, not a gate. `--strict` is the opt-in for whoever wires this into CI.
    if (args.strict && failures.length > 0) {
        console.error(
            `[balance:run-gate] --strict: ${failures.length} band(s) outside ±${(RUN_GATE_TOLERANCE * 100).toFixed(0)} points.`,
        );
        process.exitCode = 1;
    }
}

void main();
