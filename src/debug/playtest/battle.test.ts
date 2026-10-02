/**
 * TICKET 180d — a battle the agent plays, in `turn` and `card` mode.
 *
 * In `run` mode the game's AI plays the fights (180a). In the other two modes stepping onto a fight
 * opens a battle screen, and the moves are the game's own `legalActions`, one per play, plus the
 * macros the rack can fire, plus END TURN. END TURN hands the turn to the enemy AI and back.
 *
 * Nothing here pins on-screen wording. Text is read off the game's own modules (`gameText`), and
 * moves are found by their keys.
 */
import { describe, it, expect } from 'vitest';

import { battleReducer, canFireMacro, type BattleAction } from '../../engine/battleReducer';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { legalActions } from '../../engine/ai/legalActions';
import { battleOutcome } from '../../engine/battleOutcome';
import { grantMacro } from '../../ui/store/runSlice';
import { battleKeyOf, parseBattleKey } from './battle/keys';
import { LOG_LINES, logLines } from './battle/news';
import { cardName } from './gameText';
import { PLAYTEST_MAX_TURNS } from './battleSim';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { walkTo } from './walkKit';
import { applyMove, IllegalMoveError, replayWorld, stateHash } from './world';
import type { Screen, World } from './types';
import { runOf } from './types';

const firstFight = (world: World): void => {
    const screen = currentScreen(world);
    expect(screen.moves.length).toBeGreaterThan(0);
    applyMove(world, { key: screen.moves[0].key, why: 'test' });
};

/** A `turn`-mode world standing in its first battle. */
const inBattle = (over: Parameters<typeof freshWorld>[0] = {}): World => {
    const world = freshWorld({ mode: 'turn', ...over });
    firstFight(world);
    return world;
};

const battleOf = (world: World) => world.view.battle!;
const keysOf = (screen: Screen): string[] => screen.moves.map((m) => m.key);

/** The move the game's own AI would make for the player right now, as the screen's key for it. */
const aiKey = (world: World): string => battleKeyOf(getBestAction(battleOf(world).state));

/** Let the game's AI play the player's side to the end of the battle, through the screen's moves. */
function playBattleOut(world: World, guard = 400): void {
    for (let n = 0; world.view.battle && n < guard; n += 1) {
        const screen = currentScreen(world);
        const key = aiKey(world);
        applyMove(world, { key: screen.moves.some((m) => m.key === key) ? key : 'battle:end', why: 'test' });
    }
}

describe('180d — opening a battle', () => {
    it('in run mode the fight is still played by the game, with no battle screen', () => {
        const world = freshWorld({ mode: 'run' });
        firstFight(world);
        expect(world.view.battle).toBeNull();
        expect(currentScreen(world).id).not.toBe('battle');
    });

    it.each(['turn', 'card'] as const)('in %s mode stepping onto a fight opens a battle screen', (mode) => {
        const world = freshWorld({ mode });
        firstFight(world);
        expect(world.view.battle).not.toBeNull();
        const screen = currentScreen(world);
        expect(screen.id).toBe('battle');
        expect(world.view.fight).toBeNull();
        expect(runOf(world).phase).not.toBe('ended');
    });

    it('the screen names every side, shows the hand, and offers END TURN last', () => {
        const world = inBattle();
        const screen = currentScreen(world);
        const text = screen.body.join('\n');
        const { state } = battleOf(world);
        for (const unit of [...state.playerParty, ...state.enemyParty]) expect(text).toContain(unit.name);
        for (const card of state.playerDeck.hand) expect(text).toContain(cardName(card.dataId));
        expect(screen.moves[screen.moves.length - 1].key).toBe('battle:end');
    });
});

describe('180d — the moves are the game’s own legal actions', () => {
    it('every play on the screen is one `legalActions` lists, and none is missing', () => {
        const world = inBattle();
        const { state } = battleOf(world);
        const offered = keysOf(currentScreen(world)).filter((k) => k.startsWith('battle:play:'));
        const expected = legalActions(state, 'PLAYER').filter((a) => a.type === 'PLAY_PROGRAM').map(battleKeyOf);
        expect(offered.sort()).toEqual(expected.sort());
        expect(offered.length).toBeGreaterThan(0);
    });

    it('every key on the screen reads back as the move it names', () => {
        const world = inBattle();
        for (const move of currentScreen(world).moves) {
            const parsed = parseBattleKey(move.key);
            expect(parsed, move.key).not.toBeNull();
        }
    });

    it('a key that is not on the screen is refused and changes nothing', () => {
        const world = inBattle();
        const before = stateHash(world);
        expect(() => applyMove(world, { key: 'battle:play:nope:nobody:nothing', why: 'test' })).toThrow(IllegalMoveError);
        expect(stateHash(world)).toBe(before);
    });
});

describe('180d — the same moves as the reducer', () => {
    it('plays a scripted turn and ends in the state battleReducer gives for the same actions', () => {
        const world = inBattle({ seed: 'ps4' });
        const start = battleOf(world).state;

        // The script: the first two plays the game lists (each re-listed after the first), then END TURN.
        const actions: BattleAction[] = [];
        let direct = start;
        for (let i = 0; i < 2; i += 1) {
            const play = legalActions(direct, 'PLAYER').find((a) => a.type === 'PLAY_PROGRAM');
            if (!play) break;
            const next = battleReducer(direct, play);
            if (next === direct) break;
            actions.push(play);
            direct = next;
        }
        actions.push({ type: 'END_TURN' });
        direct = battleReducer(direct, { type: 'END_TURN' });
        // The enemy takes its turn with the game's AI, move by move, until the turn is the player's again.
        for (let guard = 0; guard < 300 && battleOutcome(direct) === null && direct.activeSide === 'ENEMY'; guard += 1) {
            const action = getBestAction(direct);
            const next = battleReducer(direct, action);
            direct = next === direct ? battleReducer(direct, { type: 'END_TURN' }) : next;
        }

        for (const action of actions) {
            applyMove(world, { key: battleKeyOf(action), why: 'test' });
        }
        const played = battleOf(world).state;
        // Ticket 186a: the engine's ids come from the state now, so the two states are equal as they stand.
        expect(played).toEqual(direct);
    });

    it('END TURN hands the turn to the enemy AI and back', () => {
        const world = inBattle({ seed: 'ps4' });
        const before = battleOf(world).state;
        expect(before.activeSide).toBe('PLAYER');
        applyMove(world, { key: 'battle:end', why: 'test' });
        const flow = world.view.battle;
        if (flow) {
            expect(flow.state.activeSide).toBe('PLAYER');
            expect(flow.state.turn).toBe(before.turn + 1);
            // the enemy did something in between, and the player is told what
            expect(world.view.news.length).toBeGreaterThan(0);
        } else {
            expect(runOf(world).phase === 'ended' || world.view.reward !== null).toBe(true);
        }
    });
});

describe('180d — how a battle ends', () => {
    it('played to the end by the game’s AI it lands on the reward claim or the end of the run', () => {
        const world = inBattle({ seed: 'ps4' });
        playBattleOut(world);
        expect(world.view.battle).toBeNull();
        const id = currentScreen(world).id;
        expect(['reward', 'end']).toContain(id);
        expect(world.view.fight).not.toBeNull();
    });

    it('a battle that runs past the turn cap ends as a loss that did not finish', () => {
        const world = inBattle();
        const flow = battleOf(world);
        world.view.battle = { ...flow, state: { ...flow.state, turn: PLAYTEST_MAX_TURNS } };
        applyMove(world, { key: 'battle:end', why: 'test' });
        expect(world.view.battle).toBeNull();
        expect(world.view.fight?.truncated).toBe(true);
        expect(runOf(world).phase).toBe('ended');
        expect(runOf(world).outcome).toBe('defeat');
    });

    it('the same session replays to the same state, battle and all', () => {
        const world = inBattle({ seed: 'ps4' });
        for (let n = 0; world.view.battle && n < 6; n += 1) applyMove(world, { key: aiKey(world), why: 'test' });
        expect(stateHash(replayWorld(world.header, world.log))).toBe(stateHash(world));
    });
});

describe('180d — macros', () => {
    it('fires a macro from the rack: the battle takes it and the slot is spent', () => {
        // the first seed on which the rack's macro can be fired at the opening
        for (const seed of ['ps4', 'ps5', 'ps6', 'ps7']) {
            const world = freshWorld({ mode: 'turn', seed });
            world.store.dispatch(grantMacro('surge'));
            expect(runOf(world).macros).toContain('surge');
            firstFight(world);
            const macroMoves = currentScreen(world).moves.filter((m) => m.key.startsWith('battle:macro:'));
            if (macroMoves.length === 0) continue;

            const slot = runOf(world).macros.indexOf('surge');
            const before = battleOf(world).state;
            applyMove(world, { key: macroMoves[0].key, why: 'test' });
            expect(runOf(world).macros[slot]).toBeNull();
            expect(battleOf(world).state).not.toBe(before);
            // and the macro cannot be fired a second time: its moves are gone
            expect(currentScreen(world).moves.some((m) => m.key.startsWith('battle:macro:'))).toBe(false);
            return;
        }
        throw new Error('no seed offered a macro move at the opening');
    });

    it('offers a macro move only where the game says the shot will land', () => {
        const world = freshWorld({ mode: 'turn', seed: 'ps4' });
        world.store.dispatch(grantMacro('surge'));
        firstFight(world);
        const { state } = battleOf(world);
        const offered = currentScreen(world).moves.filter((m) => m.key.startsWith('battle:macro:'));
        for (const move of offered) {
            const [, , , sourceId, targetId] = move.key.split(':');
            expect(canFireMacro(state, { macroId: 'surge', sourceId, targetId })).toBeNull();
        }
    });
});

describe('180d — the gauntlet in turn mode', () => {
    it('opens a battle for each fight, and a win claims with every member’s HP carried', () => {
        for (const seed of ['ps22', 'ps26', 'ps3']) {
            const world = freshWorld({ mode: 'turn', seed });
            if (!walkTo(world, 'gym', 1500)) continue;
            expect(currentScreen(world).id).toBe('gauntlet');
            applyMove(world, { key: 'gauntlet:begin', why: 'test' });
            expect(currentScreen(world).id).toBe('battle');
            expect(battleOf(world).context).toBe('gauntlet');
            playBattleOut(world);
            // either the gauntlet fight was won (claim open, HP carried) or the run is over
            if (world.view.reward) expect(world.view.reward.carried).toBeDefined();
            else expect(runOf(world).phase).toBe('ended');
            return;
        }
        throw new Error('no seed reached its gym gate');
    });
});

describe('186d — the game’s own combat log comes with every move', () => {
    const playFirst = (world: World): void => {
        const key = currentScreen(world).moves.find((m) => m.key.startsWith('battle:play:'))!.key;
        applyMove(world, { key, why: 'test' });
    };

    it('a card play prints the lines the game added to its combat log, firmware effects included', () => {
        const world = inBattle({ seed: 'ps1', starter: 'fenrir_v1' });
        const before = battleOf(world).state.logs.length;
        playFirst(world);
        const added = battleOf(world).state.logs.slice(before).map((l) => l.trim());
        expect(added.length).toBeGreaterThan(0);
        const shown = world.view.news.join('\n');
        for (const line of added.slice(0, 6)) expect(shown, line).toContain(line);
    });

    it('END TURN prints what the game logged while the enemy played', () => {
        const world = inBattle({ seed: 'ps4' });
        const before = battleOf(world).state.logs.length;
        applyMove(world, { key: 'battle:end', why: 'test' });
        const flow = world.view.battle;
        if (!flow) return; // the fight ended on that turn: nothing to compare
        const added = flow.state.logs.slice(before).map((l) => l.trim());
        expect(added.length).toBeGreaterThan(0);
        expect(world.view.news.join('\n')).toContain(added[0]);
    });

    it('a long log is cut to a few lines and says how many more there were', () => {
        const world = inBattle({ seed: 'ps4' });
        const state = battleOf(world).state;
        const crowded = { ...state, logs: [...state.logs, ...Array.from({ length: 80 }, (_, i) => `filler ${i}`)] };
        const lines = logLines(state, crowded);
        expect(lines.length).toBeLessThan(20);
        expect(lines[lines.length - 1]).toContain(`${80 - LOG_LINES} more`);
        expect(logLines(state, state)).toEqual([]);
    });
});
