/**
 * TICKET 169f — the modifier framework: the five modifiers are DATA (`data/modifiers.json`), an
 * active one is a `mod:<id>` entry in `IRunState.modifiers`, and every later row asks about it
 * through `hasModifier` and nowhere else.
 */

import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IBiome } from '../../runTypes';
import type { IMingmingState } from '../../types';
import { createRun } from '../createRun';
import { GYM_REGISTRY, type IGymOffer } from '../gyms';
import { blueprintBankedModifier } from '../runSummary';
import { activeModifiers, hasModifier, MODIFIER_IDS, MODIFIERS, modifierNumber } from './modifierRegistry';
import { parseModifiers } from './modifierSchema';

const KRAKEN: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: GetMingmingData('kraken').availableOS[0],
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`,
    name: `${element} ${index}`,
    elements: [element],
});

const OFFER: IGymOffer = {
    gym: GYM_REGISTRY.gym_emberfall,
    biomes: [biome('Water', 0), biome('Nature', 1), biome('Fire', 2)],
};

describe('modifiers.json', () => {
    it('lists the five ruled modifiers, with the descriptions printed as written', () => {
        expect(MODIFIER_IDS).toEqual(['junk_start', 'tight_budget', 'elite_hunt', 'no_recruits', 'draft_start']);
        const byId = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]));
        expect(byId.junk_start.description).toBe('Start with two Forge Slag in your deck.');
        expect(byId.elite_hunt.description).toBe('Every rival is an elite.');
        expect(byId.tight_budget.description).toBe('Shop and den prices +25%.');
        expect(byId.no_recruits.description).toBe(
            "You can't recruit. The party you start with is the party you finish with.",
        );
        expect(byId.draft_start.description).toBe('Draft your starting cards instead of being dealt them.');
    });

    it('carries the two numbers the ticket sets', () => {
        expect(modifierNumber('junk_start', 'junkCount')).toBe(2);
        expect(modifierNumber('tight_budget', 'pricePercent')).toBe(25);
    });

    it('rejects a bad file: a duplicate id, or a missing name', () => {
        const row = { id: 'x', name: 'X', description: 'd' };
        expect(() => parseModifiers([row, row])).toThrow();
        expect(() => parseModifiers([{ id: 'x', description: 'd' }])).toThrow();
    });
});

describe('hasModifier and activeModifiers', () => {
    it('reads mod: entries and ignores reveal: and blueprint entries', () => {
        const run = {
            modifiers: ['reveal:biome:1', blueprintBankedModifier('kraken'), 'mod:junk_start', 'mod:no_recruits'],
        };
        expect(activeModifiers(run)).toEqual(['junk_start', 'no_recruits']);
        expect(hasModifier(run, 'junk_start')).toBe(true);
        expect(hasModifier(run, 'no_recruits')).toBe(true);
        expect(hasModifier(run, 'elite_hunt')).toBe(false);
    });

    it('is false for everything on a run with no modifiers', () => {
        for (const id of MODIFIER_IDS) expect(hasModifier({ modifiers: [] }, id)).toBe(false);
    });

    it('does not mistake a lookalike for a modifier', () => {
        expect(hasModifier({ modifiers: ['junk_start', 'reveal:junk_start', 'mod:junk_start_extra'] }, 'junk_start')).toBe(false);
    });
});

describe('createRun with modifiers', () => {
    it('stores each one as mod:<id>, and stores none by default', () => {
        const run = createRun({ seed: 's', offer: OFFER, party: [KRAKEN], startedAt: 0, modifiers: ['junk_start', 'elite_hunt'] });
        expect(run.modifiers).toEqual(['mod:junk_start', 'mod:elite_hunt']);
        expect(createRun({ seed: 's', offer: OFFER, party: [KRAKEN], startedAt: 0 }).modifiers).toEqual([]);
    });

    it('throws on an unknown id', () => {
        expect(() =>
            createRun({ seed: 's', offer: OFFER, party: [KRAKEN], startedAt: 0, modifiers: ['ascension_20'] }),
        ).toThrow(/ascension_20/);
    });
});
