/**
 * TICKET 168c — the walker removes junk at the shop when it can pay, and never at an event.
 */
import { describe, expect, it } from 'vitest';

import { EVENTS } from '../../engine/run/events/eventCatalogue';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import { JUNK_REMOVAL_PRICE } from '../../engine/run/marketplace';
import type { IRunCard } from '../../engine/runTypes';
import { chooseEventChoice } from './eventPolicy';
import { junkToRemove } from './junkPolicy';

const card = (instanceId: string, dataId: string): IRunCard => ({ instanceId, dataId, ownerId: null });
const deck = [card('a', 'baseline_jab'), card('j1', JUNK_CARD_ID), card('b', 'baseline_jab'), card('j2', JUNK_CARD_ID)];

describe('junkToRemove', () => {
    it('removes nothing it cannot pay for', () => {
        expect(junkToRemove(deck, JUNK_REMOVAL_PRICE - 5)).toEqual([]);
    });

    it('removes one junk card per price it can pay, in deck order', () => {
        expect(junkToRemove(deck, JUNK_REMOVAL_PRICE)).toEqual(['j1']);
        expect(junkToRemove(deck, JUNK_REMOVAL_PRICE * 2 + 5)).toEqual(['j1', 'j2']);
        expect(junkToRemove(deck, 1000)).toEqual(['j1', 'j2']);
    });

    it('never touches a real card', () => {
        expect(junkToRemove([card('a', 'baseline_jab')], 1000)).toEqual([]);
    });

    it('prices removal at the price it is given, so Tight Budget clears fewer', () => {
        // 60 scrap pays for two removals at 25 and one at 35.
        expect(junkToRemove(deck, 60)).toEqual(['j1', 'j2']);
        expect(junkToRemove(deck, 60, 35)).toEqual(['j1']);
    });
});

describe('the walker at the two junk events', () => {
    it('leaves Overclock Rig and Corrupted Cache, because each one costs it a card or a gamble', () => {
        for (const id of ['overclock_rig', 'corrupted_cache']) {
            const event = EVENTS.find((e) => e.id === id)!;
            expect(chooseEventChoice(event, 1000).id, id).toBe('leave');
        }
    });
});
