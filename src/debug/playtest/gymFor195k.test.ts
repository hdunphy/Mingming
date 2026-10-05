/**
 * TICKET 195k — each starter plays the gym its element beats.
 *
 * Before: `planNight` gave session i the gym `i % 3`, an index into the seed's own gym offer, which is
 * ordered differently for every seed. Only 14 of 36 sonnet runs on 2026-10-05 faced the gym their element
 * beats. Henry's rule: Fire plays Rootfall (Nature), Water plays Emberfall (Fire), Nature plays Tidewrack
 * (Water). The element comes from the species registry, never from a table in the plan.
 */
import { describe, it, expect } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { offerGyms, speciesOwningFirmware } from '../../engine/run/gyms';
import { parseArgs } from './args';
import { cmdPlan, starterFirmwares } from './commands';
import { gymFor } from './night/gymFor';
import { planNight, type NightEntry } from './night/plan';
import { gymOfferSeed } from './gymOfferSeed';
import { createWorld } from './world';
import { headerFor } from './testKit';

/** The element each starter's element beats: Fire beats Nature, Nature beats Water, Water beats Fire. */
const BEATEN_BY: Readonly<Record<string, string>> = { Fire: 'Nature', Nature: 'Water', Water: 'Fire' };
const elementOf = (starter: string): string => MingmingRegistry[speciesOwningFirmware(starter)!].primaryElement;
const SEEDS = Array.from({ length: 40 }, (_, i) => `pt2026-10-05:${i + 1}`);

describe('195k — gymFor', () => {
    it('is the offer index of the gym whose element the starter beats, for every starter on every seed', () => {
        for (const starter of starterFirmwares()) {
            for (const seed of SEEDS) {
                const offer = offerGyms(gymOfferSeed(seed))[gymFor(seed, starter)];
                expect(offer.gym.element, `${starter} on ${seed}`).toBe(BEATEN_BY[elementOf(starter)]);
            }
        }
    });

    it('names Henry’s three matchups: Fire to Rootfall, Water to Emberfall, Nature to Tidewrack', () => {
        const id = (starter: string) => offerGyms(gymOfferSeed('pt1:1'))[gymFor('pt1:1', starter)].gym.id;
        expect(id('fenrir_v1')).toBe('gym_rootfall');
        expect(id('skoll_v2')).toBe('gym_rootfall');
        expect(id('kraken_v1')).toBe('gym_emberfall');
        expect(id('jormungandr_v2')).toBe('gym_emberfall');
        expect(id('huldra_v2')).toBe('gym_tidewrack');
        expect(id('ratatoskr_v1')).toBe('gym_tidewrack');
    });

    it('always finds the gym, because every seed’s offer holds all three', () => {
        for (const seed of SEEDS) expect(offerGyms(gymOfferSeed(seed)).map((o) => o.gym.element).sort()).toEqual(['Fire', 'Nature', 'Water']);
    });

    it('is the gym the session really starts in: the world builds its run from the same offer', () => {
        for (const starter of ['fenrir_v1', 'kraken_v1', 'huldra_v2']) {
            const seed = 'pt2026-10-05:7';
            const world = createWorld(headerFor({ seed, starter, gymIndex: gymFor(seed, starter) }));
            const gymId = world.store.getState().run.run!.gymId;
            expect(offerGyms(gymOfferSeed(seed))[gymFor(seed, starter)].gym.id).toBe(gymId);
        }
    });

    it('refuses a starter that no species owns', () => {
        expect(() => gymFor('pt1:1', 'not_a_firmware')).toThrow(/not_a_firmware/);
    });
});

describe('195k — the plan takes the function, and stays pure without it', () => {
    const STARTERS = Array.from({ length: 12 }, (_, i) => `starter_${i}`);

    it('without a gymFor it still rotates 0, 1, 2 (the plan knows nothing about elements)', () => {
        expect(planNight('2026-10-05', STARTERS, { runs: 6 }).map((e) => e.gym)).toEqual([0, 1, 2, 0, 1, 2]);
    });

    it('with a gymFor each session gets what it returns for its own seed and starter', () => {
        const seen: string[] = [];
        const plan = planNight('2026-10-05', STARTERS, { runs: 4, gymFor: (seed, starter) => { seen.push(`${seed}|${starter}`); return 2; } });
        expect(plan.map((e) => e.gym)).toEqual([2, 2, 2, 2]);
        expect(seen[0]).toBe('pt2026-10-05:1|starter_0');
        expect(seen[3]).toBe('pt2026-10-05:4|starter_3');
    });

    it('--seed-date plays the old worlds: the seed handed to gymFor is the seed the session is named for', () => {
        const seeds: string[] = [];
        planNight('2026-10-07', STARTERS, { runs: 2, seedDate: '2026-10-04', gymFor: (seed) => { seeds.push(seed); return 0; } });
        expect(seeds).toEqual(['pt2026-10-04:1', 'pt2026-10-04:2']);
    });
});

describe('195k — the plan command, which the night script reads, plays the matchup', () => {
    const plan = (line: string) => JSON.parse(cmdPlan('unused', parseArgs(line.split(' '))).out) as NightEntry[];

    it('all 36 sessions of a night, every starter three times, face the gym their element beats', () => {
        const entries = plan('plan --date 2026-10-05 --runs 36 --card-runs 0');
        expect(entries).toHaveLength(36);
        for (const entry of entries) {
            const gym = offerGyms(gymOfferSeed(entry.seed))[entry.gym].gym;
            expect(gym.element, `${entry.session} ${entry.starter}`).toBe(BEATEN_BY[elementOf(entry.starter)]);
        }
    });

    it('--starter plays that one starter into its matchup on every seed', () => {
        for (const entry of plan('plan --date 2026-10-05 --runs 9 --starter kraken_v1')) {
            expect(offerGyms(gymOfferSeed(entry.seed))[entry.gym].gym.id).toBe('gym_emberfall');
        }
    });
});
