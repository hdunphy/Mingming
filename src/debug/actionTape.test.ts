import { afterEach, describe, expect, it } from 'vitest';

import { selectCard, setBattleState } from '../ui/store/battleSlice';
import { setActionTap, store } from '../ui/store/store';
import type { IBattleState } from '../engine/types';
import {
    ACTION_TAPE_CAPACITY,
    getActionTape,
    getActionTapeStats,
    installActionTape,
} from './actionTape';
import { SnapshotScenarioSchema, migrateScenario } from './scenarios/scenarioSchema';

/** Only `sessionId` is read, so the rest of `IBattleState` is beside the point here. */
const battleWithSession = (sessionId: string) => ({ sessionId }) as unknown as IBattleState;

const disposers: Array<() => void> = [];

function install(): () => void {
    const dispose = installActionTape();
    disposers.push(dispose);
    return dispose;
}

afterEach(() => {
    while (disposers.length > 0) disposers.pop()!();
    // Belt and braces: a failed assertion must not leave a tap armed for the next test.
    setActionTap(null);
    store.dispatch(setBattleState(null));
});

describe('store dispatch tap', () => {
    it('is inert when nothing installs it', () => {
        const action = selectCard('card-inert');

        expect(store.dispatch(action)).toBe(action);
        expect(store.getState().battle.selectedCardId).toBe('card-inert');
        expect(getActionTape()).toEqual([]);
    });

    it('sees every action while installed and nothing after removal', () => {
        const seen: unknown[] = [];
        setActionTap((action) => {
            seen.push(action);
        });

        store.dispatch(selectCard('while-tapped'));
        setActionTap(null);
        store.dispatch(selectCard('after-tap'));

        expect(seen).toEqual([selectCard('while-tapped')]);
    });
});

describe('action tape recording', () => {
    it('records dispatched actions in order and stops on uninstall', () => {
        const dispose = install();

        store.dispatch(selectCard('a'));
        store.dispatch(selectCard('b'));
        expect(getActionTape()).toEqual([selectCard('a'), selectCard('b')]);

        dispose();
        store.dispatch(selectCard('c'));
        expect(getActionTape()).toEqual([]);
    });

    it('keeps recording until the last mount uninstalls', () => {
        // DebugRoot mounts twice (floating layer + docked tab) and StrictMode double-invokes
        // effects, so the first uninstall must not disarm the tap.
        const disposeFirst = install();
        install();

        disposeFirst();
        store.dispatch(selectCard('still-recording'));

        expect(getActionTape()).toEqual([selectCard('still-recording')]);
    });
});

describe('ring buffer bounds', () => {
    it('holds at most ACTION_TAPE_CAPACITY actions, evicting the oldest', () => {
        install();
        const overflow = 10;

        for (let i = 0; i < ACTION_TAPE_CAPACITY + overflow; i += 1) {
            store.dispatch({ type: 'tape/probe', i });
        }

        const tape = getActionTape() as Array<{ type: string; i: number }>;
        expect(tape).toHaveLength(ACTION_TAPE_CAPACITY);
        expect(tape[0].i).toBe(overflow);
        expect(tape[tape.length - 1].i).toBe(ACTION_TAPE_CAPACITY + overflow - 1);
        expect(getActionTapeStats()).toMatchObject({
            size: ACTION_TAPE_CAPACITY,
            dropped: overflow,
            capacity: ACTION_TAPE_CAPACITY,
        });
    });

    it('reports nothing dropped while under capacity', () => {
        install();
        store.dispatch(selectCard('one'));

        expect(getActionTapeStats()).toMatchObject({ size: 1, dropped: 0 });
    });
});

describe('battle boundaries', () => {
    it('resets when sessionId changes, keeping the action that started the new battle', () => {
        install();

        const startA = setBattleState(battleWithSession('battle_A'));
        store.dispatch(startA);
        expect(getActionTape()).toEqual([startA]);

        store.dispatch(selectCard('mid-battle'));
        expect(getActionTape()).toHaveLength(2);

        const startB = setBattleState(battleWithSession('battle_B'));
        store.dispatch(startB);

        expect(getActionTape()).toEqual([startB]);
        expect(getActionTapeStats()).toMatchObject({ size: 1, dropped: 0, sessionId: 'battle_B' });
    });

    it('does not reset while the same battle continues', () => {
        install();
        store.dispatch(setBattleState(battleWithSession('battle_same')));

        store.dispatch(selectCard('one'));
        store.dispatch(selectCard('two'));

        expect(getActionTape()).toHaveLength(3);
    });

    it('clears the tape and forgets the session on uninstall', () => {
        const dispose = install();
        store.dispatch(setBattleState(battleWithSession('battle_gone')));

        dispose();

        expect(getActionTape()).toEqual([]);
        expect(getActionTapeStats()).toMatchObject({ size: 0, dropped: 0, sessionId: null });
    });
});

describe('scenario schema carries the tape', () => {
    it('accepts a recorded tape on the optional snapshot field, and omitting it', () => {
        install();
        store.dispatch(selectCard('recorded'));
        const tape = getActionTape();

        expect(SnapshotScenarioSchema.shape.tape.parse(tape)).toEqual(tape);
        expect(SnapshotScenarioSchema.shape.tape.parse(undefined)).toBeUndefined();
        // Serializable as-is: export writes it straight into the envelope.
        expect(JSON.parse(JSON.stringify(tape))).toEqual([
            { type: 'battle/selectCard', payload: 'recorded' },
        ]);
    });

    it('migrateScenario is a no-op for tape-bearing snapshots', () => {
        const raw = { version: 1, kind: 'snapshot', tape: [{ type: 'battle/endTurn' }] };

        expect(migrateScenario(raw)).toEqual(raw);
    });
});
