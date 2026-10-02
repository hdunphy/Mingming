/**
 * TICKET 180f — WHAT ONE SESSION HOLDS, read by replaying it.
 *
 * Nothing but the session file (and the driver's own record of tokens and time, when there is one)
 * is read from disk. The session is replayed move by move with a look at each screen just before
 * its move, which is how the report knows what the agent was choosing between and why it said it
 * chose: the options on a card reward, what a shelf offered, the screen a note was written on.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { GYM_REGISTRY } from '../../../engine/run/gyms';
import type { Finding } from '../findings';
import { firmwareName } from '../gameText';
import { currentScreen } from '../screen';
import { readSession, sessionPath } from '../sessionFile';
import type { MoveAbout, SessionFile } from '../types';
import { runOf } from '../types';
import { applyMove, createWorld } from '../world';

/** One choice the agent made that the report tallies. */
export interface DecisionFact {
    readonly about: MoveAbout;
    /** For a card reward: every card that was on offer in this choice. */
    readonly offered: ReadonlyArray<string>;
    readonly why: string;
}

export interface NoteFact {
    readonly text: string;
    /** The id of the screen the agent was on when it wrote the note. */
    readonly screen: string;
}

/** What the driver recorded about a session, when it reported anything. */
export interface DriverFact {
    readonly minutes?: number;
    readonly tokens?: number;
    readonly costUsd?: number;
    readonly turns?: number;
    readonly timedOut?: boolean;
}

export interface RunFact {
    readonly session: string;
    readonly header: SessionFile;
    /** The firmware the run started on, and the gym it was heading for, as the game names them. */
    readonly starter: string;
    readonly gym: string;
    /** The run's outcome, or `budget`, or `unfinished` for a session that stopped mid-run. */
    readonly outcome: string;
    readonly fights: number;
    readonly biome: string;
    readonly deckSize: number;
    readonly scrap: number;
    readonly decisions: number;
    readonly findings: ReadonlyArray<Finding>;
    readonly notes: ReadonlyArray<NoteFact>;
    readonly choices: ReadonlyArray<DecisionFact>;
    /** Every buy the shelves offered an affordable move for, once per visit's screen seen. */
    readonly shelfOffers: ReadonlyArray<string>;
    readonly driver?: DriverFact;
}

export function readDriverFact(root: string, name: string): DriverFact | undefined {
    const path = join(root, name, 'driver.json');
    if (!existsSync(path)) return undefined;
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
        return { minutes: n(raw.minutes), tokens: n(raw.tokens), costUsd: n(raw.costUsd), turns: n(raw.turns), timedOut: raw.timedOut === true };
    } catch {
        return undefined;
    }
}

export function gatherRun(root: string, name: string): RunFact {
    const session = readSession(root, name);
    const world = createWorld(session);
    const choices: DecisionFact[] = [];
    const shelfOffers: string[] = [];
    const notes: NoteFact[] = [];
    const screenBefore: string[] = [];

    session.moves.forEach((move, i) => {
        const screen = currentScreen(world);
        screenBefore.push(screen.id);
        const chosen = screen.moves.find((m) => m.key === move.key);
        if (chosen?.about) {
            const offered = screen.moves.filter((m) => m.about?.verb === 'take').map((m) => m.about!.items[0]);
            choices.push({ about: chosen.about, offered: chosen.about.verb === 'skip' ? chosen.about.items : offered, why: move.why });
        }
        if (screen.id === 'market') for (const m of screen.moves) if (m.about?.verb === 'buy') shelfOffers.push(m.about.items[0]);
        applyMove(world, move, session.moves[i + 1]?.chained === true);
    });
    const finalScreen = currentScreen(world).id;
    for (const note of session.notes) notes.push({ text: note.text, screen: screenBefore[note.atMove] ?? finalScreen });

    const run = runOf(world);
    const here = run.nodes.find((n) => n.id === run.currentNodeId);
    const biomeIndex = here?.biomeIndex ?? 0;
    return {
        session: name,
        header: session,
        starter: firmwareName(session.starter),
        gym: GYM_REGISTRY[run.gymId]?.name ?? run.gymId,
        outcome: world.view.cutShort ?? (run.phase === 'ended' ? (run.outcome ?? 'ended') : 'unfinished'),
        fights: run.fightsResolved,
        biome: `${biomeIndex + 1} of ${run.biomes.length}${run.biomes[biomeIndex] ? ` (${run.biomes[biomeIndex].name})` : ''}`,
        deckSize: run.deck.length,
        scrap: run.scrap,
        decisions: session.moves.filter((m) => m.chained !== true).length,
        findings: world.findings,
        notes,
        choices,
        shelfOffers,
        driver: readDriverFact(root, name),
    };
}

/** Every session in a night's folder, in name order. A folder with no session file is not one. */
export function sessionsIn(root: string): string[] {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(sessionPath(root, e.name)))
        .map((e) => e.name)
        .sort();
}
