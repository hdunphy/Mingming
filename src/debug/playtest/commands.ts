/**
 * TICKET 180a — THE CLI'S COMMANDS, AS FUNCTIONS THAT RETURN TEXT.
 *
 * `cli.ts` only reads argv, calls one of these and prints. Keeping the commands as plain functions
 * over a results folder is what lets the tests drive "the CLI" without spawning a process.
 *
 * Every command that changes a session rebuilds it by replay first, applies the change to the
 * rebuilt world, and writes the file only if the change was accepted. A refused move leaves the
 * session file byte for byte as it was.
 */
import { MingmingRegistry, LAUNCH_SPECIES } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { parsePrediction } from './expect/prediction';
import { planNight } from './night/plan';
import { cardLine } from './gameText';
import { currentScreen } from './screen';
import { renderScreen, screenJson } from './render';
import { readSession, sessionExists, writeSession } from './sessionFile';
import { IllegalMoveError, applyMove, createWorld, enforceBudget, replayWorld } from './world';
import type { ParsedArgs } from './args';
import type { LoggedMove, PlaytestMode, SessionFile, SessionHeader, World } from './types';

export interface CommandResult {
    readonly out: string;
    readonly code: number;
}

const ok = (out: string): CommandResult => ({ out, code: 0 });
const refuse = (out: string): CommandResult => ({ out, code: 1 });

const MODES: ReadonlyArray<PlaytestMode> = ['run', 'turn', 'card'];

/** The twelve Early Access starter firmwares, in registry order. */
export const starterFirmwares = (): string[] =>
    LAUNCH_SPECIES.flatMap((species) => MingmingRegistry[species]?.availableOS ?? []);

const text = (args: ParsedArgs, name: string): string | undefined => {
    const value = args.flags[name];
    return typeof value === 'string' ? value : undefined;
};

function sessionName(args: ParsedArgs): string | CommandResult {
    return text(args, 'session') ?? refuse('--session <name> is required.');
}
const isRefusal = (value: string | CommandResult): value is CommandResult => typeof value !== 'string';

function show(world: World, args: ParsedArgs): string {
    return args.flags.json === true
        ? JSON.stringify(screenJson(world, currentScreen(world)), null, 2)
        : renderScreen(world, currentScreen(world));
}

function load(root: string, name: string): { session: SessionFile; world: World } {
    const session = readSession(root, name);
    return { session, world: replayWorld(session, session.moves) };
}

export function cmdNew(root: string, args: ParsedArgs): CommandResult {
    const name = sessionName(args);
    if (isRefusal(name)) return name;
    if (sessionExists(root, name)) return refuse(`Session "${name}" already exists. Pick another name.`);

    const seed = text(args, 'seed');
    const starter = text(args, 'starter');
    if (!seed) return refuse('--seed <text> is required.');
    if (!starter) return refuse(`--starter <firmware> is required. One of: ${starterFirmwares().join(', ')}`);
    if (!starterFirmwares().includes(starter)) return refuse(`"${starter}" is not a starter. One of: ${starterFirmwares().join(', ')}`);
    const mode = (text(args, 'mode') ?? 'run') as PlaytestMode;
    if (!MODES.includes(mode)) return refuse(`--mode must be one of ${MODES.join(', ')}.`);
    const gymIndex = Number(text(args, 'gym') ?? '0');
    const tier = Number(text(args, 'tier') ?? '0');
    if (!Number.isInteger(gymIndex) || gymIndex < 0) return refuse('--gym must be 0, 1 or 2.');
    if (!Number.isInteger(tier) || tier < 0) return refuse('--tier must be a whole number.');
    const modifiers = (text(args, 'modifiers') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

    const budget = text(args, 'budget') === undefined ? undefined : Number(text(args, 'budget'));
    if (budget !== undefined && (!Number.isInteger(budget) || budget < 1)) return refuse('--budget must be a whole number of decisions, 1 or more.');

    const header: SessionHeader = { seed, starter, gymIndex, mode, tier, modifiers, ...(budget === undefined ? {} : { budget }) };
    let world: World;
    try {
        world = createWorld(header);
    } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
    }
    writeSession(root, name, { ...header, moves: [], notes: [] });
    return ok(show(world, args));
}

export function cmdState(root: string, args: ParsedArgs): CommandResult {
    const name = sessionName(args);
    if (isRefusal(name)) return name;
    try {
        return ok(show(load(root, name).world, args));
    } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
    }
}

/** `3` or `3,1,2` into the numbers they name. */
function parseNumbers(raw: string): number[] | null {
    const parts = raw.split(',').map((s) => s.trim());
    if (parts.some((p) => !/^\d+$/.test(p))) return null;
    return parts.map(Number);
}

function applyNumbered(root: string, args: ParsedArgs, numbers: ReadonlyArray<number>): CommandResult {
    const name = sessionName(args);
    if (isRefusal(name)) return name;
    const why = text(args, 'why');
    if (why === undefined || why.trim() === '') {
        return refuse('Every move needs a reason: add --why "<one sentence>". Nothing was changed.');
    }
    let expect: unknown;
    const rawExpect = text(args, 'expect');
    if (rawExpect !== undefined) {
        try { expect = JSON.parse(rawExpect); } catch { return refuse('--expect must be valid JSON. Nothing was changed.'); }
        const checked = parsePrediction(expect);
        if (!checked.ok) return refuse(`${checked.reason} Nothing was changed.`);
    }

    let session: SessionFile;
    let world: World;
    try {
        ({ session, world } = load(root, name));
    } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
    }

    if (numbers.length > 1 && session.mode === 'card') {
        return refuse('card mode takes one move per call: use "move", not "moves". Nothing was changed.');
    }

    // Numbers address the screen as it is NOW. They are turned into keys up front, so a later number
    // in a list still means the move the agent saw, even though the screen changes as the list runs.
    const screen = currentScreen(world);
    const keys: string[] = [];
    for (const n of numbers) {
        const move = screen.moves[n - 1];
        if (!move) return refuse(`There is no move ${n}: this screen has ${screen.moves.length}. Nothing was changed.`);
        keys.push(move.key);
    }

    const applied: LoggedMove[] = [];
    for (const [i, key] of keys.entries()) {
        const move: LoggedMove = { key, why, ...(expect !== undefined && i === 0 ? { expect } : {}), ...(i > 0 ? { chained: true as const } : {}) };
        try {
            applyMove(world, move, i < keys.length - 1);
        } catch (error) {
            if (!(error instanceof IllegalMoveError)) throw error;
            if (applied.length === 0) return refuse(`${error.message}. Nothing was changed.`);
            // The list stopped at the first illegal move; what came before it stands.
            enforceBudget(world);
            writeSession(root, name, { ...session, moves: [...session.moves, ...applied] });
            return refuse(`Stopped at move ${i + 1} of ${keys.length}: ${error.message}. The ${applied.length} before it were applied.\n\n${renderScreen(world)}`);
        }
        applied.push(move);
    }
    writeSession(root, name, { ...session, moves: [...session.moves, ...applied] });
    return ok(show(world, args));
}

export function cmdMove(root: string, args: ParsedArgs): CommandResult {
    const raw = args.positional[0];
    const numbers = raw === undefined ? null : parseNumbers(raw);
    if (numbers === null || numbers.length !== 1) return refuse('Usage: move --session <name> <n> --why "<reason>". <n> is one move number.');
    return applyNumbered(root, args, numbers);
}

export function cmdMoves(root: string, args: ParsedArgs): CommandResult {
    const raw = args.positional[0];
    const numbers = raw === undefined ? null : parseNumbers(raw);
    if (numbers === null) return refuse('Usage: moves --session <name> <n,n,n> --why "<reason>". The numbers are move numbers on the screen as it is now.');
    return applyNumbered(root, args, numbers);
}

export function cmdCard(root: string, args: ParsedArgs): CommandResult {
    const name = sessionName(args);
    if (isRefusal(name)) return name;
    if (!sessionExists(root, name)) return refuse(`no session "${name}"`);
    const query = args.positional.join(' ').trim().toLowerCase();
    if (query === '') return refuse('Usage: card --session <name> <card name>');
    const matches = Object.values(ProgramRegistry).filter((card) =>
        card.id.toLowerCase() === query || (card.name ?? '').toLowerCase() === query);
    const found = matches.length > 0 ? matches : Object.values(ProgramRegistry).filter((card) =>
        (card.name ?? '').toLowerCase().includes(query));
    if (found.length === 0) return refuse(`No card is called "${query}".`);
    return ok(found.slice(0, 6).map((card) => cardLine(card.id)).join('\n'));
}

export function cmdNote(root: string, args: ParsedArgs): CommandResult {
    const name = sessionName(args);
    if (isRefusal(name)) return name;
    const noteText = args.positional.join(' ').trim();
    if (noteText === '') return refuse('Usage: note --session <name> "<text>"');
    try {
        const session = readSession(root, name);
        writeSession(root, name, { ...session, notes: [...session.notes, { atMove: session.moves.length, text: noteText }] });
        return ok('Noted.');
    } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
    }
}

/** `plan --date D [--runs N] [--card-runs N] [--turn-runs N] [--starter F]`: the night's sessions as JSON, for the nightly script. Touches no session. */
export function cmdPlan(_root: string, args: ParsedArgs): CommandResult {
    const date = text(args, 'date');
    if (!date || !/^[A-Za-z0-9._-]+$/.test(date)) return refuse('--date <YYYY-MM-DD> is required.');
    const count = (name: string): number | undefined => (text(args, name) === undefined ? undefined : Number(text(args, name)));
    const options = { runs: count('runs'), cardRuns: count('card-runs'), turnRuns: count('turn-runs'), tier: count('tier') };
    for (const [name, value] of Object.entries(options)) {
        if (value !== undefined && (!Number.isInteger(value) || value < 0)) return refuse(`--${name === 'cardRuns' ? 'card-runs' : name === 'turnRuns' ? 'turn-runs' : name} must be a whole number.`);
    }
    const only = text(args, 'starter');
    if (only !== undefined && !starterFirmwares().includes(only)) return refuse(`"${only}" is not a starter. One of: ${starterFirmwares().join(', ')}`);
    try {
        return ok(JSON.stringify(planNight(date, only === undefined ? starterFirmwares() : [only], options), null, 2));
    } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
    }
}

/** `replay --session s --to N`: the screen as it was after the first N moves. Read-only; the one-line reproduction a finding points at. */
export function cmdReplay(root: string, args: ParsedArgs): CommandResult {
    const name = sessionName(args);
    if (isRefusal(name)) return name;
    try {
        const session = readSession(root, name);
        const to = text(args, 'to') === undefined ? session.moves.length : Number(text(args, 'to'));
        if (!Number.isInteger(to) || to < 0 || to > session.moves.length) return refuse(`--to must be a whole number from 0 to ${session.moves.length}.`);
        return ok(show(replayWorld(session, session.moves.slice(0, to)), args));
    } catch (error) {
        return refuse(error instanceof Error ? error.message : String(error));
    }
}

export const COMMANDS: Readonly<Record<string, (root: string, args: ParsedArgs) => CommandResult>> = {
    new: cmdNew, state: cmdState, move: cmdMove, moves: cmdMoves, card: cmdCard, note: cmdNote, replay: cmdReplay, plan: cmdPlan,
};
