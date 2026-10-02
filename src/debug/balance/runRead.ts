/**
 * runRead — what a run log SAYS, as a table — ticket 156 §4.
 *
 *     npm run runread -- <export.json>
 *     npm run runread                      # the newest file in the desktop's run-logs folder
 *
 * # WHY THIS EXISTS
 *
 * 156 §4: *"That table is what the 148/153 session reads instead of Henry's memory of the run."*
 * The rows 156 §2 added are complete and nearly unreadable by eye — a fourteen-fight run is some
 * six hundred of them, most of them turn aggregates. The questions they exist to answer are short:
 * how big was the deck at fight N, how hard did it hit, who died and when, and which picks moved
 * the curve. This prints those and nothing else.
 *
 * # WHERE IT SITS
 *
 * `src/debug/`, behind the same wall as every other tool here: nothing outside `src/debug/` may
 * import it, `scripts/assert-no-debug.mjs` proves the toolkit never reaches `dist/`, and it runs
 * through `vite-node` like `balance:deck` and `decks` rather than being built. The ticket wrote it
 * as `scratch/runread.ts`; it is here instead because `scratch/` is not a directory this repo has
 * and the debug folder is where the other readers already live.
 *
 * # WHAT IT WILL NOT DO
 *
 * It does not re-simulate. Every figure below is read off rows the game recorded while it was being
 * played, and a reader that quietly recomputed would be a second engine to keep in step. Where the
 * log cannot answer, it prints a dash.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { GetProgramData } from '../../engine/data/programRegistry';
import { calculatePowerscale } from './powerscale';
import { formatRunDuration } from '../../engine/run/runSummary';
import type { IRunEvent, IRunLog } from '../../engine/run/runLog';

// --- Reading the file ---------------------------------------------------------------------------

interface RunLogEnvelope {
    readonly version: number;
    readonly exportedAt: number;
    readonly logs: ReadonlyArray<IRunLog>;
    /**
     * The combat transcripts, keyed by the `logId` each `FIGHT_LOG` row carries.
     *
     * Absent on an export written before the transcripts were split out, and an individual id can
     * be missing from it when that fight's text was pruned or never stored — both read here as
     * "no transcript", which is the truth in either case.
     */
    readonly fightLogs?: Readonly<Record<string, { readonly lines: ReadonlyArray<string>; readonly truncated: number }>>;
}

/**
 * The export envelope, straight from disk.
 *
 * Deliberately NOT routed through `runLog`'s zod schema: that schema exists to make the GAME's
 * storage safe to read, and it strips unknown top-level fields. A reader that silently dropped a
 * field a newer game wrote would be the most annoying possible bug to chase, so this trusts the
 * file and fails loudly on a shape it cannot use.
 */
function readEnvelope(path: string): RunLogEnvelope {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as RunLogEnvelope;
    if (!parsed || !Array.isArray(parsed.logs)) {
        throw new Error(`${path} is not a run-log export: no "logs" array.`);
    }
    return parsed;
}

/** The newest `mingming-run*.json` in a directory, for the no-argument case. */
function newestExportIn(dir: string): string | null {
    try {
        const files = readdirSync(dir)
            .filter((name) => name.startsWith('mingming-run') && name.endsWith('.json'))
            .map((name) => join(dir, name))
            .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
        return files[0] ?? null;
    } catch {
        return null;
    }
}

// --- The numbers --------------------------------------------------------------------------------

type Row<K extends IRunEvent['kind']> = Extract<IRunEvent, { kind: K }>;

/**
 * Mean powerscale of a deck — the 149c score, averaged over the cards in it.
 *
 * The score is a property of a CARD, so a deck's mean is the blunt summary: it says whether a run
 * is carrying better cards than it started with, which is the progression question 148/153 asks.
 * It deliberately says nothing about whether they fit together; that is what the win column is for.
 */
function meanPowerscale(deck: ReadonlyArray<string>): number | null {
    if (deck.length === 0) return null;
    let total = 0;
    let counted = 0;
    for (const dataId of deck) {
        try {
            const data = GetProgramData(dataId);
            if (!data || !data.name) continue;
            total += calculatePowerscale(data).score;
            counted += 1;
        } catch {
            // A card the registry has since dropped. The run still happened; skip it and say so
            // by way of the smaller denominator rather than by crashing the reader.
        }
    }
    return counted === 0 ? null : total / counted;
}

export interface FightRead {
    readonly index: number;
    readonly nodeKind: string;
    readonly biome: number;
    readonly enemies: string;
    readonly deckSize: number;
    readonly deckPower: number | null;
    readonly turns: number;
    readonly won: boolean | null;
    readonly damageDealt: number;
    readonly damageTaken: number;
    /** `memberId` → the turn its HP first reached 0, from the per-turn rows. */
    readonly deaths: ReadonlyArray<{ memberId: string; turn: number }>;
    readonly damageByCaster: ReadonlyArray<{ casterId: string; damage: number }>;
    readonly statusesBySource: ReadonlyArray<{ status: string; count: number }>;
    readonly logLines: number;
    readonly logTruncated: number;
    /** Into the export's `fightLogs` map. `null` when the player had battle logs off. */
    readonly logId: string | null;
}

/**
 * Split the transcript into fights.
 *
 * `FIGHT_STARTED` opens one and `FIGHT_ENDED` closes it. Everything between belongs to it — which
 * is only true because 156 made `FIGHT_ENDED` land before `RUN_ENDED` on a defeat; before that, the
 * last fight of a lost run closed after the run did and this loop would have dropped it.
 */
export function readFights(log: IRunLog): FightRead[] {
    const fights: FightRead[] = [];

    let open: {
        index: number; deck: Row<'FIGHT_DECK'> | null; started: Row<'FIGHT_STARTED'>;
        turns: Row<'FIGHT_TURN'>[]; log: Row<'FIGHT_LOG'> | null;
    } | null = null;

    const close = (ended: Row<'FIGHT_ENDED'> | null): void => {
        if (!open) return;

        const turns = open.turns;
        const damageDealt = turns.filter((t) => t.side === 'PLAYER').reduce((n, t) => n + t.damageDealt, 0);
        const damageTaken = turns.filter((t) => t.side === 'PLAYER').reduce((n, t) => n + t.damageTaken, 0)
            + turns.filter((t) => t.side === 'ENEMY').reduce((n, t) => n + t.damageDealt, 0);

        // First turn each member's HP is seen at zero. The rows carry party HP at every turn's
        // close, so a death has a turn number without any death event needing to exist.
        const deaths: { memberId: string; turn: number }[] = [];
        const down = new Set<string>();
        for (const turn of turns) {
            for (const [memberId, hp] of Object.entries(turn.partyHp)) {
                if (hp <= 0 && !down.has(memberId)) {
                    down.add(memberId);
                    deaths.push({ memberId, turn: turn.turn });
                }
            }
        }

        const byCaster = new Map<string, number>();
        for (const turn of turns) {
            if (turn.side !== 'PLAYER') continue;
            // A turn's damage is not split per card by the row, so it is attributed to the casters
            // who acted in it, evenly. Blunt, and honest about being blunt: the alternative is a
            // per-hit row class the ticket explicitly did not ask for.
            const casters = [...new Set(turn.cardsPlayed.map((c) => c.casterId))];
            if (casters.length === 0) continue;
            const share = turn.damageDealt / casters.length;
            for (const casterId of casters) byCaster.set(casterId, (byCaster.get(casterId) ?? 0) + share);
        }

        const byStatus = new Map<string, number>();
        for (const turn of turns) {
            for (const applied of turn.statusesApplied) {
                byStatus.set(applied.status, (byStatus.get(applied.status) ?? 0) + applied.stacks);
            }
        }

        fights.push({
            index: open.index,
            nodeKind: open.deck?.nodeKind ?? open.started.nodeKind,
            biome: open.deck?.biome ?? 0,
            enemies: (open.deck?.enemies.map((e) => `${e.species}${e.osId ? `/${e.osId}` : ''}`)
                ?? [...open.started.enemies]).join(' '),
            deckSize: open.deck?.deck.length ?? 0,
            deckPower: open.deck ? meanPowerscale(open.deck.deck) : null,
            turns: ended?.turns ?? (turns.length > 0 ? turns[turns.length - 1].turn : 0),
            won: ended ? ended.won : null,
            damageDealt: Math.round(damageDealt),
            damageTaken: Math.round(damageTaken),
            deaths,
            damageByCaster: [...byCaster.entries()]
                .map(([casterId, damage]) => ({ casterId, damage: Math.round(damage) }))
                .sort((a, b) => b.damage - a.damage),
            statusesBySource: [...byStatus.entries()]
                .map(([status, count]) => ({ status, count }))
                .sort((a, b) => b.count - a.count),
            logLines: open.log?.lineCount ?? 0,
            logTruncated: open.log?.truncated ?? 0,
            logId: open.log?.logId ?? null,
        });
        open = null;
    };

    for (const event of log.events) {
        switch (event.kind) {
            case 'FIGHT_STARTED':
                close(null);                              // an unclosed fight, from a truncated log
                open = { index: fights.length + 1, deck: null, started: event, turns: [], log: null };
                break;
            case 'FIGHT_DECK': if (open) open.deck = event; break;
            case 'FIGHT_TURN': if (open) open.turns.push(event); break;
            case 'FIGHT_LOG': if (open) open.log = event; break;
            case 'FIGHT_ENDED': close(event); break;
            default: break;
        }
    }
    close(null);
    return fights;
}

// --- Printing -----------------------------------------------------------------------------------

const pad = (text: string, width: number): string =>
    text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
const padL = (text: string, width: number): string =>
    text.length >= width ? text.slice(0, width) : ' '.repeat(width - text.length) + text;

const num = (value: number | null, digits = 0): string =>
    value === null ? '—' : value.toFixed(digits);

/** How much of a fight's transcript the table prints. The rest stays in the file. */
const TAIL_LINES = 6;

function printRun(
    log: IRunLog,
    transcripts: Readonly<Record<string, { readonly lines: ReadonlyArray<string> }>> = {},
): void {
    const fights = readFights(log);
    const ended = log.events.find((event) => event.kind === 'RUN_ENDED') as Row<'RUN_ENDED'> | undefined;
    const picks = log.events.filter(
        (event) => event.kind === 'CARD_PICKED' || event.kind === 'CARD_BOUGHT',
    ) as Array<Row<'CARD_PICKED'> | Row<'CARD_BOUGHT'>>;

    console.log('');
    console.log(`RUN ${log.runKey}`);
    console.log(
        `  ${ended?.outcome ?? 'in progress'} · ${fights.length} fights · `
        + `${formatRunDuration(log.activeMs)} playing`
        + (log.droppedEvents > 0 ? ` · ${log.droppedEvents} ROWS DROPPED — this transcript is incomplete` : ''),
    );
    console.log('');

    console.log(`  ${pad('#', 3)}${pad('node', 11)}${pad('enemies', 30)}`
        + `${padL('deck', 5)}${padL('power', 7)}${padL('turns', 6)}${padL('dealt', 7)}${padL('taken', 7)}  result`);
    console.log(`  ${'-'.repeat(3 + 11 + 30 + 5 + 7 + 6 + 7 + 7 + 8)}`);

    for (const fight of fights) {
        const result = fight.won === null ? 'unfinished' : fight.won ? 'won' : 'LOST';
        const died = fight.deaths.map((d) => `${d.memberId}@t${d.turn}`).join(' ');
        console.log(
            `  ${pad(String(fight.index), 3)}${pad(`${fight.nodeKind} b${fight.biome}`, 11)}`
            + `${pad(fight.enemies, 30)}${padL(String(fight.deckSize), 5)}`
            + `${padL(num(fight.deckPower, 1), 7)}${padL(String(fight.turns), 6)}`
            + `${padL(String(fight.damageDealt), 7)}${padL(String(fight.damageTaken), 7)}  ${result}`
            + (died ? `  ☠ ${died}` : ''),
        );
    }

    console.log('');
    console.log('  DECK POWER, FIGHT BY FIGHT');
    const powers = fights.map((f) => f.deckPower).filter((p): p is number => p !== null);
    if (powers.length === 0) {
        console.log('    — no FIGHT_DECK rows (a run logged before ticket 156).');
    } else {
        const top = Math.max(...powers);
        for (const fight of fights) {
            if (fight.deckPower === null) continue;
            const width = Math.round((fight.deckPower / top) * 40);
            console.log(`    ${padL(String(fight.index), 3)} ${pad('█'.repeat(width), 41)}${num(fight.deckPower, 1)}`);
        }
        const first = powers[0];
        const last = powers[powers.length - 1];
        console.log(`    fight 1 → ${fights.length}: ${num(first, 1)} → ${num(last, 1)}`
            + ` (${last >= first ? '+' : ''}${num(last - first, 1)})`);
    }

    if (picks.length > 0) {
        console.log('');
        console.log('  WHAT WENT IN');
        for (const pick of picks) {
            const verb = pick.kind === 'CARD_PICKED' ? 'picked' : 'bought';
            console.log(`    f${padL(String(pick.fightIndex), 2)} ${verb} ${pick.dataId}`
                + `  (deck ${pick.deckSize}, ${pick.scrap} scrap)`);
        }
    }

    for (const fight of fights) {
        if (fight.damageByCaster.length === 0 && fight.statusesBySource.length === 0) continue;
        console.log('');
        console.log(`  FIGHT ${fight.index} — ${fight.enemies}`);
        if (fight.damageByCaster.length > 0) {
            console.log(`    damage by caster: ${fight.damageByCaster
                .map((entry) => `${entry.casterId} ${entry.damage}`).join(' · ')}`);
        }
        if (fight.statusesBySource.length > 0) {
            console.log(`    statuses applied: ${fight.statusesBySource
                .map((entry) => `${entry.status} ×${entry.count}`).join(' · ')}`);
        }
        if (fight.logLines > 0 || fight.logId) {
            const held = fight.logId ? transcripts[fight.logId] : undefined;
            const where = fight.logId === null
                ? ' — not stored (battle logs off)'
                : held ? '' : ' — MISSING from this export';
            console.log(`    combat log: ${fight.logLines} lines`
                + (fight.logTruncated > 0 ? ` (+${fight.logTruncated} truncated from the front)` : '')
                + where);
            // The last few lines are the part a bug report is about, so they are printed rather
            // than merely counted. The whole transcript is in the file for anyone who wants it.
            for (const line of (held?.lines ?? []).slice(-TAIL_LINES)) console.log(`      ${line}`);
        }
    }
    console.log('');
}

// --- Entry --------------------------------------------------------------------------------------

/**
 * NOTHING RUNS ON IMPORT. `runRunRead.ts` is the entry point, matching `deckReport.ts` and its
 * `runDeckReport.ts` next door.
 *
 * The first cut called `main()` at module scope, and `runRead.test.ts` importing `readFights`
 * therefore ran the whole script: a usage error printed into the suite's output and
 * `process.exitCode = 1`, which is a green test run reporting failure. A path guard cannot fix it
 * either — `vite-node` strips the script path out of `process.argv` entirely, so a module has no
 * way to tell whether it is the one that was asked for.
 */
export function runRead(): void {
    const given = process.argv[2];
    const path = given ?? newestExportIn(join(process.cwd(), 'run-logs'));

    if (!path) {
        console.error('usage: npm run runread -- <export.json>');
        console.error('  (no path given, and no mingming-run*.json found in ./run-logs)');
        process.exitCode = 1;
        return;
    }

    const envelope = readEnvelope(path);
    console.log(`${path} — ${envelope.logs.length} run(s), exported ${new Date(envelope.exportedAt).toISOString()}`);
    for (const log of envelope.logs) printRun(log, envelope.fightLogs ?? {});
}
