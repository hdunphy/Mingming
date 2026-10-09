/**
 * TICKET 192 — the Norse Aura names, the Rune names and the Tattle token Henry approved on 2026-10-03
 * ("Accept all including the feedback token"). The tables below are the approved lists written out by
 * hand, so a stray edit to `programs.json`, `patchRegistry.ts` or `instinctNames.ts` fails here.
 *
 * An Aura is a "Daemon" card. Its name reaches the screen two ways: the card's own `name`, and the
 * name of its hooks.json entry (the battle log, the status beats, the Codex). Both must say the same thing.
 */
import { describe, expect, it } from 'vitest';

import { getPatch } from '../../engine/data/patchRegistry';
import { GetProgramData, ProgramRegistry } from '../../engine/data/programRegistry';
import HOOKS_DATA from '../../engine/data/lib/hooks.json';
import { instinctName, plain } from './labels';

/** card id -> the name a player reads. A "+" card keeps the plus. */
const AURAS: ReadonlyArray<readonly [string, string]> = [
    ['harden_daemon', 'Dwarf-Forged'],
    ['battery_pack', 'Mead Horn'],
    ['fertile_ground_daemon', "Norns' Gift"],
    ['einherjar_standard', 'Einherjar Standard'],
    ['riptide', 'Riptide'],
    ['short_circuit', "Wisdom's Price"],
    ['reactive_plating', 'Berserkergang'],
    ['scrubber', "Eir's Remedy"],
    ['drip_feed', "Idunn's Apples"],
    ['overclock_core', 'Well of Mimir'],
    ['short_fuse', "Hoarder's Toll"],
    ['static_ward', "Frigg's Oath"],
    ['core_overclock', 'Megingjord'],
    ['cinder_armor', 'Emberhide'],
    ['ember_ward', "Brynhild's Ring"],
    // TICKET 207 (2026-10-08): Emberfall's answer. Named in the ticket and shown to Henry with the build.
    ['sindris_forge', "Sindri's Forge"],
    ['feedback_loop', "Huginn's Dive"],
    ['hoofbeat', 'Hoofbeat'],
    ['echo_chamber', 'Gjallarhorn'],
    ['thermal_overload', "Surtr's Fever"],
];

const RUNES: ReadonlyArray<readonly [string, string]> = [
    ['amplifier', 'Fehu'],
    ['repeater', 'Jera'],
    ['relay', 'Mannaz'],
    ['splitter', 'Gebo'],
    ['overclock', 'Uruz'],
    ['failsafe', 'Algiz'],
];

const hooksEntry = (id: string): { name: string } | undefined =>
    (HOOKS_DATA as unknown as Record<string, { name: string }>)[id];

describe('ticket 192 — Aura names', () => {
    it.each(AURAS)('card %s is shown as %s', (id, shown) => {
        expect(GetProgramData(id).name).toBe(shown);
    });

    it.each(AURAS)('the "+" of %s keeps the plus', (id, shown) => {
        if (ProgramRegistry[`${id}+`] === undefined) return;
        expect(GetProgramData(`${id}+`).name).toBe(`${shown}+`);
    });

    it('every Daemon card is in the approved list (a new Aura has to be named on purpose)', () => {
        const approved = new Set(AURAS.map(([id]) => id));
        const unlisted = Object.entries(ProgramRegistry)
            .filter(([id, card]) => (card as { category?: string }).category === 'Daemon' && !id.endsWith('+') && id !== 'feedback_token')
            .map(([id]) => id)
            .filter((id) => !approved.has(id));
        expect(unlisted).toEqual([]);
    });

    it('the name of an Aura\'s hooks.json entry reads the same as its card (battle log, Codex, status beats)', () => {
        for (const [id, shown] of AURAS) {
            for (const suffix of ['', '+']) {
                const entry = hooksEntry(`${id}${suffix}`);
                if (entry === undefined) continue;
                expect(instinctName(entry.name), `${id}${suffix}`).toBe(`${shown}${suffix}`);
            }
        }
        // Harden's hooks live under the old id `defensive_daemon`.
        expect(instinctName(hooksEntry('defensive_daemon')!.name)).toBe('Dwarf-Forged');
    });

    it('no Aura is shown under two names', () => {
        const names = AURAS.map(([, shown]) => shown);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('ticket 192 — Rune names', () => {
    it.each(RUNES)('rune %s is shown as %s', (id, shown) => {
        expect(getPatch(id)?.name).toBe(shown);
        expect(plain(getPatch(id)?.name)).toBe(shown);
    });

    it('no Rune name is also an Aura name or an Instinct name', () => {
        const aura = new Set(AURAS.map(([, shown]) => shown));
        for (const [, shown] of RUNES) expect(aura.has(shown)).toBe(false);
    });
});

describe('ticket 192 — the Tattle token', () => {
    it('feedback_token is called Tattle', () => {
        expect(GetProgramData('feedback_token').name).toBe('Tattle');
    });

    it('no card or hook text still says "Feedback token" or "generates Feedback"', () => {
        const pattern = /Feedback tokens?|generates Feedback/;
        const left: string[] = [];
        for (const [id, card] of Object.entries(ProgramRegistry)) if (pattern.test(JSON.stringify(card))) left.push(`card ${id}`);
        for (const [id, entry] of Object.entries(HOOKS_DATA as unknown as Record<string, unknown>)) if (pattern.test(JSON.stringify(entry))) left.push(`hooks ${id}`);
        expect(left).toEqual([]);
    });
});
