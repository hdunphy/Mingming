/**
 * TICKET 154a — THE BAD ID STOPS IN DEV AND TRAVELS IN PROD, pinned on both sides of the switch.
 *
 * Ticket 154 §7's gates, in order. The first is 142d itself, reproduced rather than described —
 * the write-up of that incident was wrong twice (*"returns undefined"*, then *"fails silently"*),
 * and the fix for a failure mode nobody can state correctly is an executable statement of it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { GetMingmingData, MingmingRegistry } from './mingmingRegistry';
import { GetProgramData } from './programRegistry';
import { allowRegistryMisses } from './registryMiss';
import { speciesOwningFirmware } from '../run/gyms';

afterEach(() => vi.unstubAllEnvs());

describe('154a — a firmware id asked of the species registry (the 142d bug)', () => {
    it('is loud, rather than answering with a hollow unit whose element is None', () => {
        /*
         * `gym.leaderComp` holds FIRMWARE ids. 142d's biome builder passed `kraken_v1` to
         * `GetMingmingData`, took `.primaryElement` and got `'None'` — three times — then built a
         * biome advertising an element no species pool contains. It surfaced three files away.
         *
         * Asserted on a REAL firmware id taken from the registry, so this cannot rot into a test
         * about a string: if `kraken_v1` ever became a species key, the first expect fails first.
         */
        const firmware = MingmingRegistry.kraken.availableOS[0];
        expect(firmware).toBe('kraken_v1');
        expect(MingmingRegistry[firmware], 'a firmware id is not a species key').toBeUndefined();

        expect(() => GetMingmingData(firmware)).toThrowError(/Mingming ID not found: kraken_v1/);
    });

    it('names the fix in the message, because the id alone was read as noise nine times', () => {
        expect(() => GetMingmingData('kraken_v1')).toThrowError(/speciesOwningFirmware/);
    });

    it('and the right call answers it — the resolution 142d named once', () => {
        // The other half: the bug is not "you cannot look this up", it is "you looked it up in the
        // wrong registry". This is the lookup that works, and 154 §6 folds the last three
        // hand-written copies of it onto this function.
        expect(speciesOwningFirmware('kraken_v1')).toBe('kraken');
        expect(GetMingmingData(speciesOwningFirmware('kraken_v1')!).primaryElement).toBe('Water');
    });
});

describe('154a — both accessors, both directions of the switch', () => {
    it('throws for an unknown card id too, and says where deleted cards went', () => {
        expect(() => GetProgramData('a_card_that_was_cut')).toThrowError(/Program ID not found/);
        expect(() => GetProgramData('a_card_that_was_cut')).toThrowError(/programs-v1\.json/);
    });

    it('throws on the EMPTY id and says so in words', () => {
        // This one used to get a bare `console.trace()`. An Error carries the same stack and is
        // read by the runner instead of scrolled past.
        expect(() => GetProgramData('')).toThrowError(/\(empty string\)/);
    });

    it('A SHIPPED BUILD IS UNCHANGED — same sentinel, same fields, no throw', () => {
        /*
         * §7's second gate, and the whole reason 154a could ship without touching 40 call sites.
         * `import.meta.env.DEV` is the switch `App.tsx` already uses for the debug root.
         */
        vi.stubEnv('DEV', false);

        const mingming = GetMingmingData('not_a_species');
        expect(mingming.id).toBe('missing');
        expect(mingming.primaryElement).toBe('None');
        expect(mingming.availableOS).toEqual([]);

        const program = GetProgramData('not_a_card');
        expect(program.id).toBe('missing');
        expect(program.baseCost).toBe(99);
        expect(program.actions).toEqual([]);
    });
});

describe('154a — the escape hatch is scoped, and it is not a way out', () => {
    it('tolerates a miss while it is held, and throws again once released', () => {
        const release = allowRegistryMisses('this test');
        expect(GetMingmingData('not_a_species').id).toBe('missing');
        release();
        expect(() => GetMingmingData('not_a_species')).toThrow();
    });

    it('nests, so one suite holding it cannot switch it off for another', () => {
        // A boolean would have: the inner release would clear the outer hold. A counter does not.
        const outer = allowRegistryMisses('outer');
        const inner = allowRegistryMisses('inner');
        inner();
        expect(GetMingmingData('not_a_species').id, 'the outer hold is still up').toBe('missing');
        outer();
        expect(() => GetMingmingData('not_a_species')).toThrow();
    });

    it('is idempotent on release, so a double teardown cannot leave it permanently on', () => {
        const release = allowRegistryMisses('once');
        release();
        release();
        expect(() => GetMingmingData('not_a_species')).toThrow();
    });
});
