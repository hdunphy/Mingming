/**
 * TICKET 156 §5 — the reader, against a hand-built transcript.
 *
 * `runRead` is what the 148/153 session reads instead of Henry's memory of a run, which makes its
 * arithmetic load-bearing in exactly the way a debug script usually is not. The rows here are
 * written by hand rather than produced by a fixture run: what is under test is the READING — that
 * a fight's rows are grouped to the right fight, that a death gets the turn it happened on, and
 * that an unclosed fight at the end of a truncated log is still reported rather than dropped.
 */
import { describe, expect, it } from 'vitest';

import { readFights } from './runRead';
import type { IRunEvent, IRunLog } from '../../engine/run/runLog';

let seq = 0;
const stamp = (fightIndex: number) => ({ seq: (seq += 1), fightIndex, deckSize: 10, scrap: 0 });

const row = (fightIndex: number, body: Record<string, unknown>): IRunEvent =>
    ({ ...stamp(fightIndex), ...body }) as unknown as IRunEvent;

function logOf(events: IRunEvent[]): IRunLog {
    return { runKey: 'r@1', seed: 'r', startedAt: 1, events, droppedEvents: 0, activeMs: 60_000 };
}

const turn = (n: number, side: 'PLAYER' | 'ENEMY', over: Record<string, unknown> = {}) => row(0, {
    kind: 'FIGHT_TURN', turn: n, side, cardsPlayed: [], damageDealt: 0, damageTaken: 0,
    statusesApplied: [], partyHp: { a: 100 }, ...over,
});

describe('156 §4 — reading a transcript back', () => {
    beforeEachReset();

    it('groups each fight\'s rows to its own fight, and counts damage by side', () => {
        const fights = readFights(logOf([
            row(0, { kind: 'FIGHT_STARTED', nodeKind: 'wild', enemies: ['skoll'] }),
            row(0, {
                kind: 'FIGHT_DECK', deck: ['ignite', 'ignite'], nodeKind: 'wild', biome: 0,
                party: [{ memberId: 'a', species: 'fenrir', osId: 'fenrir_v2', hp: 100, maxHp: 100 }],
                enemies: [{ species: 'skoll', osId: null }],
            }),
            turn(1, 'PLAYER', {
                damageDealt: 40, damageTaken: 5,
                cardsPlayed: [{ dataId: 'ignite', casterId: 'a', targetId: 'e' }],
            }),
            turn(1, 'ENEMY', { damageDealt: 12 }),
            row(0, { kind: 'FIGHT_LOG', logId: 'r@1#1', lineCount: 2, truncated: 7 }),
            row(0, { kind: 'FIGHT_ENDED', turns: 1, won: true, partyHp: { a: 83 } }),

            row(1, { kind: 'FIGHT_STARTED', nodeKind: 'elite', enemies: ['draugr'] }),
            turn(1, 'PLAYER', { damageDealt: 9 }),
            row(1, { kind: 'FIGHT_ENDED', turns: 1, won: false, partyHp: { a: 0 } }),
        ]));

        expect(fights).toHaveLength(2);
        expect(fights[0].enemies).toBe('skoll');          // no `/osId` when a wild runs no firmware
        expect(fights[0].deckSize).toBe(2);
        expect(fights[0].won).toBe(true);
        expect(fights[0].damageDealt).toBe(40);
        // Taken is the player's own-turn damage PLUS everything the enemy's turn dealt.
        expect(fights[0].damageTaken).toBe(17);
        expect(fights[0].logLines).toBe(2);
        expect(fights[0].logTruncated).toBe(7);
        // The row is a POINTER now — the text lives under its own key, and the export inlines it.
        expect(fights[0].logId).toBe('r@1#1');
        // The second fight's rows are its own.
        expect(fights[1].damageDealt).toBe(9);
        expect(fights[1].won).toBe(false);
    });

    it('dates a death from the turn its HP first reads zero', () => {
        const fights = readFights(logOf([
            row(0, { kind: 'FIGHT_STARTED', nodeKind: 'wild', enemies: ['skoll'] }),
            turn(1, 'PLAYER', { partyHp: { a: 50, b: 40 } }),
            turn(2, 'PLAYER', { partyHp: { a: 50, b: 0 } }),
            turn(3, 'PLAYER', { partyHp: { a: 0, b: 0 } }),
            row(0, { kind: 'FIGHT_ENDED', turns: 3, won: false, partyHp: { a: 0, b: 0 } }),
        ]));

        // Each unit once, on the turn it fell — not once per turn it stayed down.
        expect(fights[0].deaths).toEqual([{ memberId: 'b', turn: 2 }, { memberId: 'a', turn: 3 }]);
    });

    it('still reports a fight whose FIGHT_ENDED the cap ate', () => {
        /*
         * `droppedEvents` is non-zero on a truncated transcript and the rows that go are the LAST
         * ones — so the final fight can have no closing row at all. Dropping it from the table
         * would hide the fight most likely to be the interesting one.
         */
        const fights = readFights(logOf([
            row(0, { kind: 'FIGHT_STARTED', nodeKind: 'wild', enemies: ['skoll'] }),
            turn(4, 'PLAYER', { damageDealt: 30 }),
        ]));

        expect(fights).toHaveLength(1);
        expect(fights[0].won).toBeNull();
        expect(fights[0].turns).toBe(4);      // from the last turn row, since no FIGHT_ENDED said
    });
});

/** `seq` is module state in this file; keep the ids unique per test without leaking across them. */
function beforeEachReset(): void {
    seq = 0;
}
