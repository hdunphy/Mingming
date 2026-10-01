/**
 * TICKET 170a — the ghost walk and the two halves that let tiers share one deck.
 *
 * Five claims, in the ticket's order. The first is the one every later row of 170 keeps green:
 * **a walk with no new option set is the walk it was**. It is pinned as a hash of the whole result
 * object, taken on the parent commit of 170a, because a refactor of a 1,400-line function that moves
 * one number is exactly the failure that cannot be seen by reading the diff.
 *
 * If this fails after a GAME change (a card, a price, a rule), the walks moved for a reason that is
 * not this ticket: regenerate the four hashes with `vite-node` on the commit BEFORE your change, then
 * on yours, and compare. If it fails after a WALKER change, that change is not allowed to move a
 * default walk: put it behind an option that is off by default (ticket 170, rule 4).
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { walkRun } from './runWalker';
import { playGauntlet, walkToGym } from './ghostWalk';

const hashOf = (value: unknown): string =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

describe('170a — the default walk is unchanged', () => {
    // [seed, starter, gymIndex, tier] -> hash of JSON.stringify(walkRun(...)) on the parent of 170a.
    const GOLDEN: ReadonlyArray<readonly [string, string, number, number, string]> = [
        ['t170a:default:kraken_v1:0', 'kraken_v1', 0, 0, '2d7f601c302705ed'],
        ['t170a:default:kraken_v1:0', 'kraken_v1', 0, 3, '35297de0d50ae11d'],
        ['t170a:default:fenrir_v2:1', 'fenrir_v2', 1, 0, 'a8498f5ab683818f'],
        ['t170a:default:fenrir_v2:1', 'fenrir_v2', 1, 2, '8580f56d061c33dd'],
    ];

    it.each(GOLDEN)('%s at tier %#: whole result object matches the pre-170 walk', (seed, starter, gymIndex, tier, hash) => {
        expect(hashOf(walkRun({ seed, starter, gymIndex, tier }))).toBe(hash);
    });

    it('carries no ghost, snapshot or resume field unless one of those options was asked for', () => {
        const result = walkRun({ seed: 't170a:default:kraken_v1:0', starter: 'kraken_v1', gymIndex: 0 });
        expect(result).not.toHaveProperty('ghostFights');
        expect(result).not.toHaveProperty('gymSnapshot');
        expect(result.fights.some((fight) => 'ghost' in fight)).toBe(false);
    });
});

/** A seed from the sample that dies before the gym on a real walk (`fenrir_v2 #1` loses its sixth fight). */
const EARLY_DEATH = { seed: 't170a:default:fenrir_v2:1', starter: 'fenrir_v2', gymIndex: 1 };

/*
 * THE WALKS ARE MEMOISED, because a map walk costs about ten seconds and a gauntlet about as much:
 * each distinct walk below is played once and every test that needs it reads the same result.
 */
const memo = <T>(make: () => T): (() => T) => {
    let value: T | undefined;
    return () => (value ??= make());
};
const realWalk = memo(() => walkRun(EARLY_DEATH));
const ghostWalk = memo(() => walkRun({ ...EARLY_DEATH, ghost: true, stopAtGym: true }));
const snapshotOf = memo(() => walkToGym(EARLY_DEATH));

describe('170a — the ghost walk', () => {
    it('reaches the gym on a seed that dies early, and counts the fights it carried the walk through', () => {
        expect(realWalk().fights.some((fight) => fight.kind === 'gym')).toBe(false);
        const snapshot = snapshotOf();
        expect(snapshot).not.toBeNull();
        expect(snapshot!.ghostFights).toBeGreaterThanOrEqual(1);
        expect(snapshot!.run.nodes.find((node) => node.id === snapshot!.run.currentNodeId)?.kind).toBe('gym');
        expect(snapshot!.realFightsWon).toBeGreaterThan(0);
        expect(JSON.stringify(snapshot)).toBe(JSON.stringify(ghostWalk().gymSnapshot));
    });

    it('never wins a fight it did not play: the fight log has the real result, and a ghost fight is marked', () => {
        const result = ghostWalk();
        const ghosts = result.fights.filter((fight) => fight.ghost === true);
        expect(ghosts.length).toBe(result.ghostFights);
        // The real result is kept: a ghost fight was LOST, and nothing else before the gym was.
        for (const fight of ghosts) expect(fight.won).toBe(false);
        expect(result.fights.filter((fight) => !fight.won && fight.ghost !== true)).toEqual([]);
        // And the run log agrees with the fight records, fight for fight.
        const logged = result.log.events.filter((event) => event.kind === 'FIGHT_ENDED').map((event) => event.kind === 'FIGHT_ENDED' && event.won);
        expect(logged).toEqual(result.fights.map((fight) => fight.won));
    });

    it('is the real walk, up to its first loss', () => {
        const real = realWalk();
        const ghost = ghostWalk();
        const firstLoss = real.fights.findIndex((fight) => !fight.won);
        expect(firstLoss).toBeGreaterThanOrEqual(0);
        expect(ghost.fights.slice(0, firstLoss + 1).map((fight) => ({ ...fight, ghost: undefined }))).toEqual(
            real.fights.slice(0, firstLoss + 1).map((fight) => ({ ...fight, ghost: undefined })),
        );
    });
});

describe('170a — one snapshot, many tiers', () => {
    const gauntlets = [0, 1, 2, 3].map((tier) => memo(() => playGauntlet(snapshotOf()!, tier)));

    it('gives the same gauntlet twice at the same tier, and does not mutate the snapshot', () => {
        const snapshot = snapshotOf()!;
        const before = JSON.stringify(snapshot);
        const first = gauntlets[3]();
        const second = playGauntlet(snapshot, 3);
        expect(second).toEqual(first);
        expect(JSON.stringify(snapshot)).toBe(before);
    });

    it('plays every tier from the same deck, party and scrap: only the tier differs', () => {
        const tier0 = gauntlets[0]();
        const tier3 = gauntlets[3]();
        expect(tier3.deck).toEqual(tier0.deck);
        expect(tier3.tier).toBe(3);
        expect(tier0.tier).toBe(0);
        expect(tier0.fights.length).toBeGreaterThan(0);
        expect(tier0.fights.length).toBeLessThanOrEqual(3);
        expect(tier0.fightsWon).toBe(tier0.fights.filter((fight) => fight.won).length);
        expect(tier0.cleared).toBe(tier0.fightsWon === 3);
    });

    it('stops at the first lost gauntlet fight, as the game does', () => {
        for (const gauntlet of gauntlets) {
            const result = gauntlet();
            const lost = result.fights.findIndex((fight) => !fight.won);
            if (lost >= 0) expect(result.fights).toHaveLength(lost + 1);
        }
    });
});
