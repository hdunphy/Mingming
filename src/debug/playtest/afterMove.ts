/**
 * TICKET 180e — WHAT IS CHECKED AFTER EVERY MOVE.
 *
 * `applyMove` calls `checkMove` once the move has been made. Two things happen, in every mode:
 *
 * 1. The agent's `--expect`, when the move was a card or a macro, is compared with what happened and
 *    any difference is recorded as a surprise (and told to the agent on the next screen).
 * 2. The invariants run: the run state, the battle, the fight report, the screen, and whether the
 *    game's own code threw.
 *
 * Both only ever read; neither changes the game, so a session plays out identically with or
 * without them. They run during replays too, which is how the report finds them again.
 */
import { cardLine, macroLine } from './gameText';
import { compare } from './expect/compare';
import { outcomeOf } from './expect/outcome';
import { parsePrediction, PREDICTION_KEYS } from './expect/prediction';
import { battleInvariants } from './invariants/battleInvariants';
import { runInvariants } from './invariants/runInvariants';
import { fightInvariants, screenInvariants } from './invariants/screenInvariants';
import type { Violation } from './invariants/violations';
import { currentScreen } from './screen';
import { cardNameFor } from './battleSim';
import type { IBattleState } from '../../engine/types';
import type { LoggedMove, World } from './types';
import { runOf } from './types';

/** What the move starts from: the battle as it was, and whether the engine had already thrown. */
export interface BeforeMove {
    readonly battle: IBattleState | null;
    readonly engineError: string | null;
}

export const beforeMove = (world: World): BeforeMove => ({ battle: world.view.battle?.state ?? null, engineError: world.view.engineError });

function judgeExpectation(world: World, move: LoggedMove, atMove: number): void {
    const parsed = parsePrediction(move.expect);
    if (!parsed.ok) {
        world.view.news.push(`(Your --expect was not read: ${parsed.reason})`);
        return;
    }
    const play = world.lastPlay;
    if (!play) {
        world.view.news.push('(--expect is only checked on a card or a macro move; this move was not one.)');
        return;
    }
    const differences = compare(parsed.prediction, outcomeOf(play), play.before);
    if (differences.length === 0) return;

    const action = play.action;
    const isMacro = action.type === 'FIRE_MACRO';
    const dataId = action.type === 'PLAY_PROGRAM'
        ? play.before.playerDeck.hand.find((c) => c.id === action.payload.programId)?.dataId ?? action.payload.programId
        : action.type === 'FIRE_MACRO' ? action.payload.macroId : '';
    const name = cardNameFor(play.before, action) ?? dataId;
    const wanted = new Set(PREDICTION_KEYS.filter((k) => k in parsed.prediction));
    const full = outcomeOf(play) as unknown as Record<string, unknown>;
    world.findings.push({
        kind: 'surprise',
        atMove,
        subject: { type: isMacro ? 'macro' : 'card', id: dataId, name, text: isMacro ? macroLine(dataId) : cardLine(dataId) },
        prediction: parsed.prediction,
        result: Object.fromEntries([...wanted].map((k) => [k, full[k]])),
        differences,
    });
    world.view.news.push(
        `SURPRISE: ${name} did not do what you expected.`,
        ...differences.map((d) => `  ${d.key}: you expected ${JSON.stringify(d.predicted)}, it did ${JSON.stringify(d.actual)}.`),
    );
}

function record(world: World, atMove: number, violations: ReadonlyArray<Violation>): void {
    for (const v of violations) world.findings.push({ kind: 'invariant', atMove, name: v.name, detail: v.detail });
}

/** A check that itself throws means the state was not even readable: that is a finding, and never a crash. */
function guarded(world: World, atMove: number, label: string, check: () => ReadonlyArray<Violation>): void {
    try {
        record(world, atMove, check());
    } catch (error) {
        record(world, atMove, [{ name: 'screen-error', detail: `${label}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}` }]);
    }
}

export function checkMove(world: World, before: BeforeMove, move: LoggedMove, atMove: number): void {
    if (move.expect !== undefined) judgeExpectation(world, move, atMove);

    guarded(world, atMove, 'the run', () => runInvariants(runOf(world)));
    const battle = world.view.battle;
    if (battle) guarded(world, atMove, 'the battle', () => battleInvariants(battle.state, before.battle ?? undefined));
    guarded(world, atMove, 'the fight report', () => fightInvariants(world.view.fight));
    if (world.view.engineError && world.view.engineError !== before.engineError) {
        record(world, atMove, [{ name: 'engine-error', detail: world.view.engineError }]);
    }
    guarded(world, atMove, 'the screen', () => screenInvariants(currentScreen(world), runOf(world)));
}
