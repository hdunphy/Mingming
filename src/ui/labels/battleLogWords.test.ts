/**
 * The battle log speaks Norse, not machine (Henry's 2026-10-07 playtest: "Fenrir pushes its core to
 * the limit!", "Reprogramming: Ragnarok Edge+"). Every line the log can print, as the CombatLog shows
 * it (through `plain()`), is checked for the machine words. The Totem lines are left for ticket 195e-2
 * (research/195-norse-flavour-names.md), which renames those Totems; they are listed here so the
 * exception is visible and goes when the names do.
 */
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import hooks from '../../engine/data/lib/hooks.json';
import { plain } from './labels';

const MACHINE = /\b(?:core|overclock\w*|reprogram\w*|CC Immunity|discharges?|arcs into|earths|interference|vents|overheat|hoarded charge)\b/i;

/** Totem log lines that wait for the 195e-2 renames (DEEP CACHE, STATIC FIELD, FRAYED SIGNAL, STATIC HAZE). */
const WAITING_FOR_195 = /DEEP CACHE|STATIC FIELD|FRAYED SIGNAL|STATIC HAZE/;

function hookTexts(): string[] {
    const out: string[] = [];
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (node && typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
                if (key === 'text' && typeof value === 'string') out.push(value);
                else walk(value);
            }
        }
    };
    walk(hooks);
    return out;
}

const ENGINE_FILES = [
    'src/engine/actions/ActionExecutors.ts',
    'src/engine/effectHandlers.ts',
    'src/engine/battleReducer.ts',
    'src/engine/core/CustomFirmware.ts',
    'src/engine/StatusBehaviors.ts',
];

function engineLogTemplates(): string[] {
    const out: string[] = [];
    for (const file of ENGINE_FILES) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/(?:addLog\([^,]+,\s*|logs?\.push\(|payload:\s*)(`[^`]*`|'[^']*')/g)) {
            out.push(match[1].slice(1, -1));
        }
    }
    return out;
}

describe('the battle log has no machine words', () => {
    it('in any hook line, as the log shows it', () => {
        const found = hookTexts().map((text) => plain(text)).filter((text) => MACHINE.test(text) && !WAITING_FOR_195.test(text));
        expect(found).toEqual([]);
    });

    it('in any line the engine writes', () => {
        const templates = engineLogTemplates();
        expect(templates.length).toBeGreaterThan(20);
        expect(templates.map((text) => plain(text)).filter((text) => MACHINE.test(text))).toEqual([]);
    });

    it('and no hook line still shows a name in capitals and underscores', () => {
        const found = hookTexts().map((text) => plain(text)).filter((text) => /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/.test(text));
        expect(found).toEqual([]);
    });
});
