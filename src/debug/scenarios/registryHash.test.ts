import { describe, it, expect, afterEach } from 'vitest';
import {
    REGISTRY_HASH_ALGO_VERSION,
    buildRegistryCanonicalString,
    computeRegistryHash,
    fnv1a32,
} from './registryHash';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { FIRMWARE_REGISTRY } from '../../engine/data/firmwareRegistry';
import type { IMingmingDefinition } from '../../engine/types';

const TEMP_ID = '__registry_hash_probe_species__';

const TEMP_DEFINITION: IMingmingDefinition = {
    id: TEMP_ID,
    name: 'Probe',
    baseStats: { hp: 1, attack: 1, defense: 1, energy: 1 },
    primaryElement: 'None',
    cardDraw: 1,
    availableOS: [],
    baseDeck: [],
};

afterEach(() => {
    Reflect.deleteProperty(MingmingRegistry, TEMP_ID);
});

describe('computeRegistryHash', () => {
    it('returns <algoVersion>:<8 hex>', () => {
        const hash = computeRegistryHash();

        expect(hash).toMatch(/^\d+:[0-9a-f]{8}$/);
        expect(hash.split(':')[0]).toBe(String(REGISTRY_HASH_ALGO_VERSION));
    });

    it('is stable across two calls', () => {
        expect(computeRegistryHash()).toBe(computeRegistryHash());
    });

    it('forces the lazily initialized firmware registry open before hashing', () => {
        computeRegistryHash();

        expect(Object.keys(FIRMWARE_REGISTRY).length).toBeGreaterThan(0);
    });

    it('covers the Mingming, Program and firmware registries', () => {
        const canonical = buildRegistryCanonicalString();

        expect(canonical).toContain('mingming:fenrir');
        expect(canonical).toContain('program:' + Object.keys(ProgramRegistry)[0]);
        expect(canonical).toContain('firmware:' + Object.keys(FIRMWARE_REGISTRY)[0]);
    });

    it('changes when a registry entry is added, and returns when it is removed', () => {
        const before = computeRegistryHash();

        MingmingRegistry[TEMP_ID] = TEMP_DEFINITION;
        const withEntry = computeRegistryHash();
        expect(withEntry).not.toBe(before);

        Reflect.deleteProperty(MingmingRegistry, TEMP_ID);
        expect(computeRegistryHash()).toBe(before);
    });

    it('changes when an existing registry entry is edited', () => {
        const original = MingmingRegistry['fenrir'];
        const before = computeRegistryHash();

        MingmingRegistry['fenrir'] = {
            ...original,
            baseStats: { ...original.baseStats, attack: original.baseStats.attack + 1 },
        };

        try {
            expect(computeRegistryHash()).not.toBe(before);
        } finally {
            MingmingRegistry['fenrir'] = original;
        }

        expect(computeRegistryHash()).toBe(before);
    });
});

describe('fnv1a32', () => {
    it('matches the published FNV-1a 32-bit vectors', () => {
        expect(fnv1a32('')).toBe(0x811c9dc5);
        expect(fnv1a32('a')).toBe(0xe40c292c);
        expect(fnv1a32('foobar')).toBe(0xbf9cf968);
    });

    it('is order sensitive', () => {
        expect(fnv1a32('ab')).not.toBe(fnv1a32('ba'));
    });
});
