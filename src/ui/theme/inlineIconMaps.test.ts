/**
 * TICKET 205 - the name maps that replaced the emoji. Every name a surface asks for is in the
 * generated Tabler file, the picks are pinned as Henry's sheet showed them, and the one rule that
 * could quietly rot is checked: the bolt means energy and nothing else.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EFFECT_ICON } from '../components/cardEffectIcons';
import { INTENT_ICON } from '../components/intentIcons';
import { TYPE_CHART_ICON } from '../components/typeChartIcons';
import { MARK_ICON } from './markIcons';
import { ICON_TABLER } from './icons';
import { TABLER_FILLED, TABLER_OUTLINE } from './tabler.generated';

const outline = TABLER_OUTLINE as Readonly<Record<string, unknown>>;
const filled = TABLER_FILLED as Readonly<Record<string, unknown>>;

describe('every mapped Tabler name exists in tabler.generated.ts (205)', () => {
    it('card effect lines', () => {
        for (const [action, name] of Object.entries(EFFECT_ICON)) expect(outline[name], action).toBeDefined();
    });
    it('enemy intents', () => {
        for (const [intent, name] of Object.entries(INTENT_ICON)) expect(outline[name], intent).toBeDefined();
    });
    it('the type chart', () => {
        for (const [key, name] of Object.entries(TYPE_CHART_ICON)) expect(outline[name], key).toBeDefined();
    });
    it('the marks, including the FILLED star the Codex draws for a reached milestone', () => {
        for (const [key, mark] of Object.entries(MARK_ICON)) {
            expect(outline[mark.name], key).toBeDefined();
            if ('filled' in mark && mark.filled) expect(filled[mark.name], `${key} filled`).toBeDefined();
        }
    });
    it('and every one of them is listed in scripts/tabler-icons.names.json, so `npm run icons` keeps it', () => {
        const names = JSON.parse(readFileSync(resolve('scripts/tabler-icons.names.json'), 'utf8')) as { outline: string[]; filled: string[] };
        const wanted = [
            ...Object.values(EFFECT_ICON), ...Object.values(INTENT_ICON), ...Object.values(TYPE_CHART_ICON),
            ...Object.values(MARK_ICON).map((mark) => mark.name),
        ];
        for (const name of wanted) expect(names.outline, name).toContain(name);
        expect(names.filled).toContain('star');
    });
});

describe('the picks (205)', () => {
    it('card effect lines', () => {
        expect(EFFECT_ICON).toEqual({
            ATTACK: 'sword', HEAL: 'heart', STATUS: 'point', CLEANSE: 'x', ENERGY: 'bolt', MAX_ENERGY: 'bolt',
            DRAW: 'cards', DISCARD: 'trash', FORCE_DISCARD: 'trash', EXHAUST: 'flame', RETURN: 'arrow-back-up',
            SEARCH: 'search', GENERATE_CARD: 'sparkles', MULTIPLY_STATUS: 'multiplier-2x', TRIGGER_STATUS: 'stopwatch',
            PLAY_LAST_CARD: 'repeat', TAUNT: 'shield', BUFF_NEXT_PROGRAM: 'arrow-up', REDIRECT_TARGET: 'arrow-ramp-right',
            SHIFT_STANCE: 'contrast', REVIVE: 'recycle',
        });
    });
    it('enemy intents: sword, shield, flask for the potion, star for everything else', () => {
        expect(INTENT_ICON).toEqual({ Attack: 'sword', Defend: 'shield', Debuff: 'flask', Buff: 'star', Special: 'star', Unknown: 'star' });
    });
    it('the type chart: DNA on the button; the STAB footer is NOT the bolt', () => {
        expect(TYPE_CHART_ICON).toEqual({ toggle: 'dna', stab: 'circle-plus' });
    });
    it('the marks', () => {
        expect(MARK_ICON).toEqual({
            warning: { name: 'alert-triangle' },
            tick: { name: 'check' },
            terminated: { name: 'grave-2' },
            absorbed: { name: 'shield' },
            milestoneDone: { name: 'star', filled: true },
            milestoneOpen: { name: 'star' },
        });
    });
    it('agree with icons.ts where they draw the same thing', () => {
        expect(EFFECT_ICON.ATTACK).toBe(ICON_TABLER.attack);
        expect(EFFECT_ICON.HEAL).toBe(ICON_TABLER.hp);
        expect(EFFECT_ICON.ENERGY).toBe(ICON_TABLER.energy);
        expect(INTENT_ICON.Defend).toBe(ICON_TABLER.defense);
        expect(MARK_ICON.warning.name).toBe(ICON_TABLER.warning);
        expect(MARK_ICON.tick.name).toBe(ICON_TABLER.check);
        expect(MARK_ICON.terminated.name).toBe(ICON_TABLER.grave);
    });
    it('the skull stays Poison\'s: nothing here draws it', () => {
        const all = [...Object.values(EFFECT_ICON), ...Object.values(INTENT_ICON), ...Object.values(TYPE_CHART_ICON), ...Object.values(MARK_ICON).map((m) => m.name)];
        expect(all).not.toContain('skull');
    });
});

describe('the bolt means energy and nothing else (205)', () => {
    it('only the two energy effect lines draw it', () => {
        const boltEffects = Object.entries(EFFECT_ICON).filter(([, name]) => name === 'bolt').map(([action]) => action).sort();
        expect(boltEffects).toEqual(['ENERGY', 'MAX_ENERGY']);
        expect(Object.values(INTENT_ICON)).not.toContain('bolt');
        expect(Object.values(TYPE_CHART_ICON)).not.toContain('bolt');
        expect(Object.values(MARK_ICON).map((m) => m.name)).not.toContain('bolt');
    });
});
