/**
 * THE RUN LOG, DRIVEN THROUGH A REAL STORE — ticket 59's Done-when.
 *
 * *"A full run produces a log containing every event class"* is not a claim any unit test on the
 * pure helpers can make, because the whole design bet is that **the middleware derives rows from
 * what changed rather than from call sites announcing themselves**. What that bet risks is a row
 * class that nothing ever emits — the log looks healthy, the panel renders, and the answer to
 * "where did the scrap go" is quietly missing a sink. So this drives the actual actions through the
 * actual middleware and asserts the transcript that comes out.
 *
 * The store is assembled here rather than imported from `store.ts`: that module is a singleton with
 * an autosave subscription attached at import, and a test that shared it would be writing the
 * suite's fixtures into whatever storage the previous test left installed.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import battleReducer, { endTurn, playProgram, setBattleState, startBattle } from './battleSlice';
import gameReducer, { swapOS } from './gameSlice';
import runReducer, {
    addRunScrap,
    buyMacro,
    buyMarketCard,
    consumeMacro,
    endRun,
    enterNode,
    grantMacro,
    recruitIntoParty,
    resolveEvent,
    sellRunCard,
    setRun,
    startRun,
    takeRewardMacro,
} from './runSlice';
import uiReducer from './uiSlice';
import { createRunLogMiddleware, currentRunLog, flushRunLogNow, logRunEvent, resetRunLogRecorder } from './runLogMiddleware';
import { battleReducer as battleReducerFn } from '../../engine/battleReducer';
import { globalBattleEventBus } from '../../engine/events';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { ACTIVE_GAP_CAP_MS, readRunLogs, type IRunEvent } from '../../engine/run/runLog';
import { fightLogIds, readFightLog } from '../../engine/run/fightLog';
import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import type { IBattleSetup } from '../../engine/data/battleFactories';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const SETUP: IBattleSetup = { party: [KRAKEN], deck: ['water_slap'], drivers: [], persistedHp: {} };

function makeRun(): IRunState {
    return createRun({
        seed: 'run-log-seed',
        offer: offerGyms('run-log-offer')[0],
        party: [KRAKEN],
        startedAt: 5000,
    });
}

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false })
            .concat(createRunLogMiddleware(readRunLogs)),
    });
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
    resetRunLogRecorder();
    // `battleLogs` is read at each fight's close, so a test that changed it must not leak into the
    // next one. The defaults are what the game ships with: logs on.
    saveSettings(DEFAULT_SETTINGS);
});

afterEach(() => {
    resetSaveStorage();
});

/** Every row's kind, in order. */
const kinds = (): string[] => (currentRunLog()?.events ?? []).map((event) => event.kind);
const rowsOf = <K extends IRunEvent['kind']>(kind: K): IRunEvent[] =>
    (currentRunLog()?.events ?? []).filter((event) => event.kind === kind);

/** Walk a run through everything the log claims to cover. */
function playARun(store: ReturnType<typeof makeStore>): IRunState {
    const run = makeRun();
    store.dispatch(startRun(run));

    const next = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    store.dispatch(enterNode(next.id));

    store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));
    store.dispatch(setBattleState(null));

    // Enough to afford everything below. A refused purchase moves no scrap and so logs no SCRAP
    // row, which would make this fixture quietly test less than it looks like it does.
    store.dispatch(addRunScrap(200));
    store.dispatch(buyMarketCard({
        card: { instanceId: 'bought_1', dataId: 'hydro_blast', ownerId: null }, price: 25,
    }));

    const sold = store.getState().run.run!.deck[0];
    store.dispatch(sellRunCard({ instanceId: sold.instanceId, price: 5 }));

    store.dispatch(recruitIntoParty({
        memberId: 'mm2',
        cards: [{ instanceId: 'r1', dataId: 'nettle_sting', ownerId: 'mm2' }],
        price: 25,
    }));

    store.dispatch(grantMacro('surge'));
    store.dispatch(consumeMacro(0));
    store.dispatch(buyMacro({ macroId: 'mend', price: 32 }));

    store.dispatch(swapOS({ id: 'mm1', targetOS: 'kraken_v2' }));

    store.dispatch(logRunEvent({ kind: 'CARD_PICKED', dataId: 'whirlpool', offered: ['a', 'b', 'c'] }));
    store.dispatch(logRunEvent({ kind: 'CARD_SKIPPED', offered: ['d', 'e', 'f'] }));

    store.dispatch(endRun('victory'));
    return run;
}

describe('the run log middleware, over a whole run', () => {
    it('records every event class the ticket asked for', () => {
        playARun(makeStore());
        const seen = new Set(kinds());
        // The list from ticket 59's deliverable 1, minus nothing. A class missing here means the
        // derivation for it never fires, which is invisible in the panel.
        for (const kind of [
            'RUN_STARTED', 'NODE_ENTERED', 'FIGHT_STARTED', 'FIGHT_DECK', 'FIGHT_LOG',
            'FIGHT_ENDED', 'SCRAP',
            'CARD_PICKED', 'CARD_SKIPPED', 'CARD_BOUGHT', 'CARD_REMOVED', 'RECRUITED',
            'REFLASHED', 'MACRO_BOUGHT', 'MACRO_FIRED', 'RUN_ENDED',
        ]) {
            expect(seen, `missing ${kind}`).toContain(kind);
        }
    });

    it('derives a SCRAP row from the state delta, naming the action that caused it', () => {
        /*
         * The property the whole design rests on. Nothing dispatches a scrap event; the middleware
         * notices `run.scrap` moved. That is what makes a sink added next month logged before
         * anyone remembers this file exists.
         */
        playARun(makeStore());
        const scrap = rowsOf('SCRAP') as Array<IRunEvent & { delta: number; reason: string }>;
        const paid = (reason: string): number[] =>
            scrap.filter((row) => row.reason === reason).map((row) => row.delta);

        expect(paid('addRunScrap')).toEqual([200]);
        expect(paid('buyMarketCard')).toEqual([-25]);
        // A SALE PAYS, and the SIGN is the assertion. This line read
        // `paid('removeRunCardForScrap')).toEqual([-20])` while the market's only card verb charged
        // to delete a card; Henry deleted paid removal and repealed the sell ban on 2026-08-26, so
        // the same middleware derivation now has to produce a positive delta from a positive
        // balance change — a sink logged as income, or income logged as a sink, is exactly the kind
        // of error a derived log can make and a hand-written one cannot.
        expect(paid('sellRunCard')).toEqual([5]);
        expect(paid('recruitIntoParty')).toEqual([-25]);
        expect(paid('buyMacro')).toEqual([-32]);
    });

    it('reads each payload by its OWN field names, not by a guess at them', () => {
        // `game/swapOS` takes `{ id, targetOS }`. Reading `{ memberId, osId }` off it — which is
        // what this file caught before it shipped — yields a row saying a reflash happened and
        // refusing to say to whom, which is worse than no row at all.
        playARun(makeStore());
        const reflash = rowsOf('REFLASHED')[0] as IRunEvent & { memberId: string; osId: string };
        expect(reflash.memberId).toBe('mm1');
        expect(reflash.osId).toBe('kraken_v2');

        const recruited = rowsOf('RECRUITED')[0] as IRunEvent & { definitionId: string; cards: string[] };
        expect(recruited.cards).toEqual(['nettle_sting']);

        const bought = rowsOf('CARD_BOUGHT')[0] as IRunEvent & { dataId: string; price: number };
        expect(bought).toMatchObject({ dataId: 'hydro_blast', price: 25 });
    });

    it('stamps deck size and scrap on EVERY row, so both curves need no joining', () => {
        playARun(makeStore());
        const events = currentRunLog()!.events;
        expect(events.length).toBeGreaterThan(10);
        for (const event of events) {
            expect(typeof event.deckSize).toBe('number');
            expect(typeof event.scrap).toBe('number');
            expect(event.seq).toBeGreaterThan(0);
        }
        // And the deck really moves across the run — a stamp that never changed would satisfy the
        // loop above and answer nothing.
        const sizes = new Set(events.map((event) => event.deckSize));
        expect(sizes.size).toBeGreaterThan(1);
    });

    it('closes a fight from the battle it is losing, not from the run', () => {
        // FIGHT_ENDED reads the PRE-dispatch board, because by the time `battle` is null the turn
        // count and the party's HP are gone. A row that read post-state would report an empty fight.
        playARun(makeStore());
        const ended = rowsOf('FIGHT_ENDED')[0] as IRunEvent & { partyHp: Record<string, number>; turns: number };
        expect(ended).toBeTruthy();
        expect(Object.keys(ended.partyHp)).toContain('mm1');
        expect(ended.turns).toBeGreaterThan(0);
    });

    it('counts time between dispatches, and refuses to count a day away from the app', () => {
        /*
         * TICKET 156 §2. Henry's summary read *5h 01m* for a three-fight run — `durationMs` is
         * `endedAt - startedAt`, and the run sat open across a day away from the app.
         *
         * A dispatch is this game's own evidence that somebody is playing, so active time is the
         * sum of the gaps between them with each gap capped. No `visibilitychange`, no idle timer,
         * no DOM: a shut laptop stops dispatching, which is the same signal by a shorter route.
         */
        let clock = 1_000_000;
        const store = configureStore({
            reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
            middleware: (getDefault) => getDefault({ serializableCheck: false })
                .concat(createRunLogMiddleware(readRunLogs, () => clock)),
        });

        store.dispatch(startRun(makeRun()));
        clock += 5_000;
        store.dispatch(addRunScrap(1));          // five seconds of play
        clock += 20_000;
        store.dispatch(addRunScrap(1));          // twenty more
        expect(currentRunLog()!.activeMs).toBe(25_000);

        // Overnight. The gap is capped, not counted — one minute, not eight hours.
        clock += 8 * 60 * 60 * 1000;
        store.dispatch(addRunScrap(1));
        expect(currentRunLog()!.activeMs).toBe(25_000 + ACTIVE_GAP_CAP_MS);
    });

    it('records a turn from the bus, with what was cast and what it cost', () => {
        /*
         * TICKET 156 §2. A Redux middleware cannot see inside a turn: the engine resolves a whole
         * cast synchronously in one reducer call, so `before`/`after` show a turn's SUM and never
         * its parts. These rows come off `globalBattleEventBus`, which is where the parts are — so
         * this drives real plays through the real engine rather than dispatching fixtures.
         */
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));

        const board = store.getState().battle.battle!;
        const caster = board.playerParty[0];
        const foe = board.enemyParty[0];
        const card = board.playerDeck.hand[0];
        expect(card).toBeTruthy();
        store.dispatch(playProgram({ sourceId: caster.id, targetId: foe.id, programId: card.id }));
        store.dispatch(endTurn());

        const turns = rowsOf('FIGHT_TURN') as Array<IRunEvent & {
            side: string; cardsPlayed: Array<{ dataId: string }>; damageDealt: number;
            partyHp: Record<string, number>;
        }>;
        expect(turns.length).toBeGreaterThan(0);

        const played = turns.flatMap((row) => row.cardsPlayed);
        expect(played.map((entry) => entry.dataId)).toContain('water_slap');
        // The attack landed, so the acting side dealt damage and the row says so.
        expect(turns.some((row) => row.damageDealt > 0)).toBe(true);
        // Every row carries the player's HP at the turn's close — the attrition curve per turn.
        expect(Object.keys(turns[0].partyHp)).toContain('mm1');
    });

    it('records nothing from a muted bus, so the AI\'s lookahead leaves no trace', () => {
        /*
         * TICKET 156 §3: *"Under `isSimulating()` nothing is recorded (the balance suite must stay
         * byte-identical)."* The AI's search runs the reducer about 94,000 times for one 3v3
         * decision; a row per imagined turn would bury the real run and rewrite the balance
         * fixtures. `runMuted` is the seam the AI and both previews already use.
         */
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));
        const before = rowsOf('FIGHT_TURN').length;

        const board = store.getState().battle.battle!;
        globalBattleEventBus.runMuted(() => {
            battleReducerFn(board, {
                type: 'PLAY_PROGRAM',
                payload: {
                    sourceId: board.playerParty[0].id,
                    targetId: board.enemyParty[0].id,
                    programId: board.playerDeck.hand[0].id,
                },
            });
        });

        expect(rowsOf('FIGHT_TURN')).toHaveLength(before);
    });

    it('writes the fight\'s transcript to its own key, and points the row at it', () => {
        /*
         * Henry, 2026-09-20: *"Should we instead add a log for each fight and reference it in the
         * full log instead of one big log?"* The row keeps the numbers; the text lives under
         * `mingming_fight_log:<runKey>#<fight>`, and `writeRunLog` no longer re-serialises a
         * fight's 12.5 KB on every dispatch for the rest of the run.
         */
        saveSettings({ ...DEFAULT_SETTINGS, battleLogs: true });
        const store = makeStore();
        const run = makeRun();
        store.dispatch(startRun(run));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));

        // A fight with no plays has an empty combat log, and an assertion about an empty
        // transcript proves nothing — so play a card first.
        const board = store.getState().battle.battle!;
        store.dispatch(playProgram({
            sourceId: board.playerParty[0].id,
            targetId: board.enemyParty[0].id,
            programId: board.playerDeck.hand[0].id,
        }));
        expect(store.getState().battle.battle!.logs.length).toBeGreaterThan(0);
        store.dispatch(setBattleState(null));

        const row = rowsOf('FIGHT_LOG')[0] as IRunEvent & {
            logId: string | null; lineCount: number;
        };
        expect(row.logId).toBe(`${run.seed}@${run.startedAt}#1`);

        const transcript = readFightLog(row.logId!);
        expect(transcript).not.toBeNull();
        expect(row.lineCount).toBeGreaterThan(0);
        expect(transcript!.lines).toHaveLength(row.lineCount);
        // And the run log itself carries no combat text at all.
        expect(JSON.stringify(currentRunLog())).not.toContain(transcript!.lines[0] ?? '\u0000');
    });

    it('keeps the counts but stores no text when battle logs are off', () => {
        /*
         * "Off" has to be graceful: a row that vanished with the setting would make the setting
         * look like a fault, and the line count is still worth having — *"that fight ran 376
         * lines"* tells you what you chose not to keep.
         */
        saveSettings({ ...DEFAULT_SETTINGS, battleLogs: false });
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));

        // A fight with no plays has an empty combat log, and an assertion about an empty
        // transcript proves nothing — so play a card first.
        const board = store.getState().battle.battle!;
        store.dispatch(playProgram({
            sourceId: board.playerParty[0].id,
            targetId: board.enemyParty[0].id,
            programId: board.playerDeck.hand[0].id,
        }));
        expect(store.getState().battle.battle!.logs.length).toBeGreaterThan(0);
        store.dispatch(setBattleState(null));

        const row = rowsOf('FIGHT_LOG')[0] as IRunEvent & { logId: string | null; lineCount: number };
        expect(row).toBeTruthy();
        expect(row.logId).toBeNull();
        expect(row.lineCount).toBeGreaterThan(0);
        expect(fightLogIds()).toEqual([]);
    });

    it('closes the fight BEFORE the run, on a defeat — and only once', async () => {
        /*
         * TICKET 156 §2, and a correction to the ticket. It says *"`FIGHT_ENDED` is not emitted on
         * a defeat today"*. It is — `handleDefeat` dispatches `endRun('defeat')` and then
         * `setBattleState(null)`, the second of which trips the ordinary close. What was actually
         * wrong is WHERE it landed:
         *
         *     RUN_STARTED, FIGHT_STARTED, RUN_ENDED, FIGHT_ENDED
         *
         * The fight's own row after the end of the run, in the one position nobody reads — and the
         * uncoalesced write at `RUN_ENDED` persisted a transcript without it, so a player who shut
         * the game on the defeat screen kept the version that really was missing a row. That is the
         * log Henry filed the ticket from.
         */
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));

        // The arena's own order on a defeat.
        store.dispatch(endRun('defeat'));
        store.dispatch(setBattleState(null));
        await Promise.resolve();

        expect(kinds()).toEqual([
            'RUN_STARTED', 'FIGHT_STARTED', 'FIGHT_DECK', 'FIGHT_LOG', 'FIGHT_ENDED', 'RUN_ENDED',
        ]);
        // The board clearing a dispatch later must not write a second one.
        expect(rowsOf('FIGHT_ENDED')).toHaveLength(1);
        // And the immediate write at RUN_ENDED carries the fight, not a transcript missing it.
        const stored = readRunLogs()[0];
        expect(stored.events.map((event) => event.kind)).toEqual([
            'RUN_STARTED', 'FIGHT_STARTED', 'FIGHT_DECK', 'FIGHT_LOG', 'FIGHT_ENDED', 'RUN_ENDED',
        ]);
    });

    it('calls a mutual kill a loss, because the game does', () => {
        /*
         * TICKET 156 §2. `won` was `every enemy is down`, which is the precedence `battleOutcome`
         * was written to end after Henry's 2026-09-05 report: *"Fenrir killed me, but added burn
         * overload to himself and he died first, so I won?"* A board with both sides down would log
         * `FIGHT_ENDED(won: true)` beside `RUN_ENDED(outcome: 'defeat')`, so the transcript
         * disagreed with itself about the only fight anybody goes back to read.
         */
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));

        const board = store.getState().battle.battle!;
        const floor = <T extends { currentHp: number }>(unit: T): T => ({ ...unit, currentHp: 0 });
        store.dispatch(setBattleState({
            ...board,
            playerParty: board.playerParty.map(floor),
            enemyParty: board.enemyParty.map(floor),
        }));
        store.dispatch(setBattleState(null));

        const ended = rowsOf('FIGHT_ENDED')[0] as IRunEvent & { won: boolean };
        expect(ended.won).toBe(false);
    });

    it('closes a WON fight on the dispatch that decides it, before its reward rows (2026-09-25)', () => {
        // The 09-25 Rootfall export logged fight one's scrap and card pick, THEN its killing turn and
        // FIGHT_ENDED, because the fight closed only when the arena cleared after the reward screen.
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));

        const board = store.getState().battle.battle!;
        store.dispatch(setBattleState({
            ...board,
            enemyParty: board.enemyParty.map((unit) => ({ ...unit, currentHp: 0 })),
        }));
        // The reward screen, while the decided board is still up.
        store.dispatch(addRunScrap(10));
        store.dispatch(setBattleState(null));

        const order = kinds().filter((kind) => ['FIGHT_ENDED', 'SCRAP'].includes(kind));
        expect(order).toEqual(['FIGHT_ENDED', 'SCRAP']);
        expect(rowsOf('FIGHT_ENDED')).toHaveLength(1);
        expect((rowsOf('FIGHT_ENDED')[0] as IRunEvent & { won: boolean }).won).toBe(true);
    });

    it('survives a reload — it RESUMES the transcript rather than starting a second one', async () => {
        /*
         * `setRun` fires on every boot with a run in progress. Starting fresh there would split one
         * run's transcript across as many logs as the player had sessions — and because
         * `writeRunLog` replaces by runKey, the earlier half would be overwritten, not merely
         * separated. The reload is simulated the honest way: a second store over the same storage.
         */
        const first = makeStore();
        const run = makeRun();
        first.dispatch(startRun(run));
        first.dispatch(addRunScrap(10));
        flushRunLogNow();                 // the write is deferred; a reload would run the page-leave flush
        const before = currentRunLog()!.events.length;
        expect(before).toBeGreaterThan(0);

        resetRunLogRecorder();
        const second = makeStore();
        second.dispatch(setRun(first.getState().run.run!));
        second.dispatch(addRunScrap(5));

        const after = currentRunLog()!;
        expect(after.runKey).toBe(`${run.seed}@${run.startedAt}`);
        expect(after.events.length).toBeGreaterThan(before);
        // One RUN_STARTED, not two — the resumed transcript keeps the original opening row.
        expect(after.events.filter((event) => event.kind === 'RUN_STARTED')).toHaveLength(1);
        // And seq did not restart, so the rows still sort into one order.
        expect(after.events[after.events.length - 1].seq).toBe(after.events.length);
    });

    it('writes through to storage, and writes the ended run immediately', () => {
        // Every other write is coalesced onto a microtask; RUN_ENDED is not, because the next thing
        // that happens may be teardown, a reload, or the player closing the game.
        playARun(makeStore());
        const stored = readRunLogs();
        expect(stored).toHaveLength(1);
        expect(stored[0].events.some((event) => event.kind === 'RUN_ENDED')).toBe(true);
    });

    it('never lets a logging failure break a dispatch', () => {
        // Instrumentation may not cost the player a purchase. A full quota is the realistic case.
        setSaveStorage({
            read: () => null,
            write: () => { throw new Error('quota'); },
            remove: () => {},
            keys: () => [],
        });
        const store = makeStore();
        expect(() => playARun(store)).not.toThrow();
        // The game state is exactly what it would have been with no logging at all.
        expect(store.getState().run.run?.outcome).toBe('victory');
    });

    it('is actually WIRED INTO the production store, not just wired correctly in this file', async () => {
        /*
         * Every other case here builds its own store, which is right — they test the middleware.
         * But that leaves the failure this whole ticket is most exposed to completely uncovered:
         * a middleware that works perfectly and is not in the chain. The log would be empty, the
         * panel would say "no runs recorded yet", and nothing would look broken.
         *
         * Imported dynamically so the memory storage installed in `beforeEach` is in place before
         * `store.ts` attaches its autosave subscription at module scope.
         */
        const { store } = await import('./store');
        store.dispatch(startRun(makeRun()));
        expect(currentRunLog()?.events.some((event) => event.kind === 'RUN_STARTED')).toBe(true);
    });

    it('logs nothing at all before a run exists', () => {
        const store = makeStore();
        store.dispatch(addRunScrap(10));
        store.dispatch(startBattle({ setup: SETUP, enemyIds: ['fenrir'], sectorElement: 'Fire' }));
        expect(currentRunLog()).toBeNull();
        expect(readRunLogs()).toEqual([]);
    });

    it('takeRewardMacro records MACRO_WON with replaced: null on a free slot and the dropped id on a replace (166d)', () => {
        const store = makeStore();
        const run = makeRun();
        store.dispatch(startRun(run));
        store.dispatch(setRun({ ...run, macros: ['overcharge', null, null] }));

        store.dispatch(takeRewardMacro({ macroId: 'mend' }));
        const events = currentRunLog()?.events ?? [];
        const won1 = events.find((e) => e.kind === 'MACRO_WON' && e.macroId === 'mend');
        expect(won1).toBeDefined();
        if (won1?.kind === 'MACRO_WON') {
            expect(won1.replaced).toBeNull();
        }

        // Fill remaining slot so rack is full: ['overcharge', 'mend', 'revive']
        store.dispatch(takeRewardMacro({ macroId: 'revive' }));
        // Replace slot 1 ('mend') with 'surge'
        store.dispatch(takeRewardMacro({ macroId: 'surge', replaceSlot: 1 }));
        const won2 = (currentRunLog()?.events ?? []).filter((e) => e.kind === 'MACRO_WON').pop();
        expect(won2).toBeDefined();
        if (won2?.kind === 'MACRO_WON') {
            expect(won2.macroId).toBe('surge');
            expect(won2.replaced).toBe('mend');
        }
    });
});

describe('the run log middleware — events (ticket 168a)', () => {
    it('records EVENT_RESOLVED once, and not again when a second resolution is refused', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(resolveEvent({ nodeId: 'n1', eventId: 'scrap_cache', choiceId: 'take', grants: [] }));
        store.dispatch(resolveEvent({ nodeId: 'n1', eventId: 'data_fragments', choiceId: 'scrap', grants: [] }));

        expect(rowsOf('EVENT_RESOLVED')).toMatchObject([
            { kind: 'EVENT_RESOLVED', eventId: 'scrap_cache', choiceId: 'take' },
        ]);
    });
});
