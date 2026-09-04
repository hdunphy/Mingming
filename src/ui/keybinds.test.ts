/**
 * Ticket 36. The keybind table is the one copy, and the legend is derived from it.
 *
 * The reason this file exists at all is drift: ticket 22 wrote the bindings twice (a handler and a
 * hardcoded legend string) and this ticket would have made it three times. What can be tested is
 * that the two *displays* come from one place; what cannot be tested from here is the handler, which
 * lives inside a `useEffect` in a component no test renders. The mitigation is that the handler now
 * compares against these exported constants rather than literals — so a key can only move in one
 * file, and moving it here moves the legend and the settings table with it.
 */

import { describe, expect, it } from 'vitest';

import {
    CASTER_KEYS,
    CAST_KEY,
    CARD_KEY_MAX,
    CARD_KEY_MIN,
    CLEAR_KEY,
    CYCLE_KEY,
    END_TURN_KEY,
    ENEMY_KEYS,
    KEYBINDS,
    MACRO_KEYS,
    keybindLegend,
} from './keybinds';

describe('the keybind table', () => {
    it('has three slot keys for each of the three slot bindings', () => {
        // Party size is 3 (`engine/party.ts`), the enemy cap is 3 (`MAX_PARTY_SIZE`), and the rack
        // has 3 macro slots. A fourth key in any of these lists would be a key with nothing to bind.
        expect(CASTER_KEYS).toHaveLength(3);
        expect(ENEMY_KEYS).toHaveLength(3);
        expect(MACRO_KEYS).toHaveLength(3);
    });

    it('binds no key to two different things', () => {
        const all = [...CASTER_KEYS, ...ENEMY_KEYS, ...MACRO_KEYS, CYCLE_KEY, CAST_KEY, END_TURN_KEY, CLEAR_KEY];
        expect(new Set(all).size).toBe(all.length);
    });

    it('keeps the slot keys clear of the card digits', () => {
        // Cards are matched as a RANGE in the handler (`e.key >= '1' && e.key <= '9'`), so a letter
        // key is safe but a digit anywhere in the slot lists would be shadowed by it.
        for (const key of [...CASTER_KEYS, ...ENEMY_KEYS, ...MACRO_KEYS]) {
            expect(key >= CARD_KEY_MIN && key <= CARD_KEY_MAX).toBe(false);
        }
    });

    it('gives every row a unique id, keys and an action', () => {
        expect(new Set(KEYBINDS.map((b) => b.id)).size).toBe(KEYBINDS.length);
        for (const bind of KEYBINDS) {
            expect(bind.keys.length).toBeGreaterThan(0);
            expect(bind.action.length).toBeGreaterThan(0);
        }
    });

    it('describes every key the handler actually listens for', () => {
        // The closest a test can get to the handler: the legend must not omit a binding. Each of
        // these appears in exactly one row's `keys` string.
        const legend = keybindLegend();
        for (const fragment of ['1-9', 'W/E/R', 'A/S/D', 'TAB', 'ENTER', 'Z/X/C', 'SPACE', 'ESC']) {
            expect(legend).toContain(fragment);
        }
    });
});

describe('keybindLegend', () => {
    it('is one uppercase line in the strip format the console already used', () => {
        const legend = keybindLegend();
        expect(legend).toBe(legend.toUpperCase());
        expect(legend).not.toContain('\n');
        expect(legend.split(' · ')).toHaveLength(KEYBINDS.length);
    });

    it('is generated, not stored — a new row lands in the legend for free', () => {
        const legend = keybindLegend([
            { id: 'x', keys: 'F1', action: 'Do a thing' },
            { id: 'y', keys: 'F2', action: 'Do another' },
        ]);
        expect(legend).toBe('F1 DO A THING · F2 DO ANOTHER');
    });
});
