/**
 * TICKET 37 — the Steam Input template covers every key the game listens for.
 *
 * `steam/controller_config/mingming_keyboard_mouse.vdf` binds controller inputs to the keys
 * `keybinds.ts` already handles, which is the ticket's minimum viable controller path: the cursor is
 * the primary route and the hotkeys are accelerators.
 *
 * # WHAT THIS CATCHES, AND IT IS THE ONLY THING THAT COULD
 *
 * A template is a file nobody opens. Add a binding to `KEYBINDS` — a fourth macro slot, a new cast
 * modifier — and nothing anywhere tells you the controller cannot reach it; the game keeps working
 * on a keyboard and quietly loses a control on a Deck. **This is the tripwire**: a new key constant
 * fails here until the template has it.
 *
 * Deliberately NOT a VDF parser. The claim is coverage, not syntax — and the file's own README says
 * plainly that the schema is unverified against the Steam client, which is a human's job with Steam
 * installed. A parser written here would assert that a guess about the format matches itself.
 *
 * `CARD_KEY_MIN`/`MAX` are `1`–`9` and the template binds the first four, which is the d-pad's whole
 * budget. Asserted as "the first four" rather than all nine so the gap is stated rather than
 * discovered: a controller reaches cards 1–4, and the cursor reaches the rest.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { CASTER_KEYS, ENEMY_KEYS, MACRO_KEYS, KEYBINDS } from './keybinds';

const TEMPLATE = path.join('steam', 'controller_config', 'mingming_keyboard_mouse.vdf');

describe('37 — the Steam Input template', () => {
    const vdf = fs.readFileSync(TEMPLATE, 'utf8');

    it('is checked in where the ticket says, with its README beside it', () => {
        // The Done-when is literally "a Steam Input template is checked in under `steam/`".
        expect(fs.existsSync(TEMPLATE)).toBe(true);
        expect(fs.existsSync(path.join('steam', 'controller_config', 'README.md'))).toBe(true);
        expect(vdf).toContain('"controller_mappings"');
    });

    it('binds every caster, enemy and macro key the battle handler listens for', () => {
        for (const key of [...CASTER_KEYS, ...ENEMY_KEYS, ...MACRO_KEYS]) {
            expect(vdf, `no controller input sends '${key}'`).toContain(`key_press ${key.toUpperCase()}`);
        }
    });

    it('binds cast, end turn, cycle and clear', () => {
        // Named by what Steam calls them, which is the one place this file has to know the format.
        for (const [what, steamKey] of [['cast', 'RETURN'], ['end turn', 'SPACE'], ['cycle', 'TAB'], ['clear', 'ESCAPE']] as const) {
            expect(vdf, `nothing sends ${steamKey} for ${what}`).toContain(`key_press ${steamKey}`);
        }
    });

    it('reaches the first four cards, and the gap past that is stated not accidental', () => {
        for (const digit of ['1', '2', '3', '4']) {
            expect(vdf, `no d-pad direction sends card ${digit}`).toContain(`key_press ${digit}`);
        }
        // The cursor covers 5-9. If a future template binds them, this line is what says the
        // README's "cards 1-4" sentence went stale with it.
        expect(vdf).not.toContain('key_press 5');
    });

    it('keeps a mouse click on the controller, because the cursor is the primary path', () => {
        // Every action in the game is reachable by pointing. If this binding ever disappears, a
        // controller loses access to most of the UI while every hotkey assertion above still passes.
        expect(vdf).toContain('mouse_button LEFT');
        expect(vdf).toContain('joystick_mouse');
    });

    it('sends Right Shift from the right stick click, for hold-to-fast-forward (190a)', () => {
        // The right stick is the cursor, and its click is free. Held, it is the fast-forward key.
        expect(vdf).toContain('key_press RIGHT_SHIFT');
        const line = vdf.split('\n').find((l) => l.includes('RIGHT_SHIFT')) ?? '';
        expect(line).toMatch(/click/i);
        expect(fs.readFileSync(path.join('steam', 'controller_config', 'README.md'), 'utf8')).toContain('Right stick click');
    });

    it('covers every row of KEYBINDS, so a new binding cannot ship uncontrolled', () => {
        /*
         * The tripwire, stated against the TABLE rather than against a list of keys repeated here.
         * `ally` rides the same W/E/R the caster row does (Shift is a layer, not a key), so it is
         * satisfied by the caster keys; every other row names something asserted above.
         */
        const covered = new Set(['card', 'caster', 'ally', 'enemy', 'cycle', 'cast', 'macro', 'endturn', 'clear', 'fastforward']);
        const uncovered = KEYBINDS.map((b) => b.id).filter((id) => !covered.has(id));
        expect(uncovered, `KEYBINDS gained ${uncovered.join(', ')} — bind it in the template or add it here with a reason`).toEqual([]);
    });
});
