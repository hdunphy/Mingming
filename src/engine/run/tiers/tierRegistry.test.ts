/**
 * TICKET 169a — the tier ladder is DATA (`data/tiers.json`), and this file pins its shape.
 *
 * The rows are read by `enemyLoadoutFor` (wild firmware, wild AI), `createRun` (extra elites) and
 * `gauntlet` (the leader's Driver). What has to stay true is that the ladder only ever goes UP: a
 * higher tier includes everything below it, which is what "tiers stack" means.
 */

import { describe, expect, it } from 'vitest';

import { getDriver } from '../../data/driverRegistry';
import { GYM_REGISTRY } from '../gyms';
import { MAX_TIER, TIERS, leaderDriverFor, tierRule } from './tierRegistry';
import { parseTiers } from './tierSchema';

describe('tiers.json', () => {
    it('parses, and the tiers are 0, 1, 2, 3 in order', () => {
        expect(TIERS.map((row) => row.tier)).toEqual([0, 1, 2, 3]);
        expect(MAX_TIER).toBe(3);
    });

    it('is monotonic: no tier turns off something a lower tier turned on', () => {
        for (let i = 1; i < TIERS.length; i += 1) {
            const lower = TIERS[i - 1];
            const higher = TIERS[i];
            if (lower.wildFirmware) expect(higher.wildFirmware).toBe(true);
            if (lower.leaderDriverEveryFight) expect(higher.leaderDriverEveryFight).toBe(true);
            if (lower.wildAi === 'lite') expect(higher.wildAi).not.toBe('greedy');
            expect(higher.extraElitesPerBiome).toBeGreaterThanOrEqual(lower.extraElitesPerBiome);
        }
    });

    it('starts at the game as it is: tier 0 changes nothing', () => {
        expect(tierRule(0)).toMatchObject({
            wildFirmware: false,
            wildAi: 'greedy',
            extraElitesPerBiome: 0,
            leaderDriverEveryFight: false,
        });
    });

    it('is clamped, not extrapolated: tier 9 is the top row and a negative tier is tier 0', () => {
        expect(tierRule(9)).toEqual(tierRule(3));
        expect(tierRule(-1)).toEqual(tierRule(0));
    });

    it('names a registered Driver for every gym', () => {
        for (const gymId of Object.keys(GYM_REGISTRY)) {
            const driverId = leaderDriverFor(gymId);
            expect(driverId, gymId).toBeDefined();
            expect(getDriver(driverId as string), `${gymId} -> ${driverId}`).toBeDefined();
        }
        expect(leaderDriverFor('gym_nowhere')).toBeUndefined();
    });
});

describe('parseTiers', () => {
    const row = (tier: number) => ({
        tier,
        name: `T${tier}`,
        description: 'd',
        wildFirmware: false,
        wildAi: 'greedy',
        extraElitesPerBiome: 0,
        leaderDriverEveryFight: false,
    });

    it('throws on a bad AI grade', () => {
        expect(() => parseTiers({ tiers: [{ ...row(0), wildAi: 'genius' }], leaderDrivers: {} })).toThrow();
    });

    it('throws when the tiers are not 0..n in order', () => {
        expect(() => parseTiers({ tiers: [row(0), row(2)], leaderDrivers: {} })).toThrow();
        expect(() => parseTiers({ tiers: [row(1)], leaderDrivers: {} })).toThrow();
    });

    it('throws on a negative elite count', () => {
        expect(() => parseTiers({ tiers: [{ ...row(0), extraElitesPerBiome: -1 }], leaderDrivers: {} })).toThrow();
    });
});
