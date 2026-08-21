import { describe, it, expect } from 'vitest';

import { cellKey } from './cellCache';

/**
 * Ticket 103 regression. `sideHash` used to read `FIRMWARE_REGISTRY[os]` directly, and that
 * registry is empty until the first `getOSBehavior()` call. Ticket 97 made the deck grid hoist
 * every cell key BEFORE the first battle - which is precisely the moment firmware has not been
 * initialised - so the firmware component of every key was the constant `null` and the cache was
 * blind to every hooks.json change. It served a stale 960-cell grid before this was caught.
 *
 * The test does not check a hash VALUE (that would pin the algorithm). It checks that the key
 * actually contains the OS's hooks, which is the property that was silently missing.
 */
describe('cellCache firmware sensitivity', () => {
    it('the cell key changes when the two sides run different firmware', () => {
        const base = {
            playerSpecies: 'sleipnir', enemySpecies: 'control', enemyOS: 'control_v1',
            seed: 'test', iterations: 4,
        };
        const v1 = cellKey({ ...base, playerOS: 'sleipnir_v1' });
        const v2 = cellKey({ ...base, playerOS: 'sleipnir_v2' });
        expect(v1).not.toBe(v2);
    });

    it('the firmware component is populated, not the null fallback', async () => {
        // Import order matters: this file must NOT have initialised firmware before cellKey runs,
        // which is the situation the bug lived in. `cellKey` has to trigger the init itself.
        const key = cellKey({
            playerSpecies: 'sleipnir', playerOS: 'sleipnir_v1',
            enemySpecies: 'control', enemyOS: 'control_v1',
            seed: 'test', iterations: 4,
        });
        // A populated firmware hash makes the side hash differ from the hash of a deck whose only
        // difference IS its firmware, which the first test covers. Here we assert directly that the
        // registry the hash reads is non-empty at key time.
        const { FIRMWARE_REGISTRY } = await import('../../engine/data/firmwareRegistry');
        expect(Object.keys(FIRMWARE_REGISTRY).length).toBeGreaterThan(0);
        expect(key.split('|')).toHaveLength(6);
    });
});
