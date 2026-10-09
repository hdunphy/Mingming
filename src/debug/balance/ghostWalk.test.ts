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
 *
 * TICKET 176 (the map redesign) re-pinned three of the four on purpose: the walks now run on towns
 * and one-way routes, so the nodes and fights they meet are different. (Tier 3 of the kraken seed is
 * a two-fight walk that dies first on either map, so its hash did not move.)
 *
 * TICKET 185e re-pinned all four on purpose, once: a card offer is one weighted draw now (and leaves
 * out the last two picks' cards), so every walk is offered different cards from the same seed.
 * Rows 185a-d moved none of them; the four were taken on the commit before 185e and again on it.
 *
 * TICKET 195a moved the kraken tier-0 walk once, on purpose: Bark Smash deals 5 a point and Bark Smash+ 8, so a walk
 * that meets either card plays a different game (acc09b5fe3339bde -> 672180eee007a6bd). The other three did not move.
 * After 194 and 195a are merged together, the two kraken walks measure the same as with 194 alone (the values below):
 * with 194a in, Huldra's Bark Smash no longer changes what these two walks meet.
 * TICKET 194 re-pinned the two kraken_v1 walks on purpose (194a: an enemy Huldra v2 no longer shields before
 * she acts; 194b: Ragnarok Edge lost its cap). The two fenrir_v2 walks did not move.
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
        // 206 moved all four on purpose: the biome order is now [gym], [counter + gym], approach, so every walk
        // meets different biomes from the same seed (bdba9c99839aba86 -> 64d1fd0800261959, 12b709b4581e0545 ->
        // 8d4de1d25b21adc6, 6fe38a89bb245a0e -> a2037756128706ae, 2ab092b942210e28 -> 4c95d4a67e7d2fb4).
        // 207 moved all four again on purpose: the nine leader cards joined their Instincts' pools, so a
        // walk is offered different cards (64d1fd08… -> 68a4337a…, 8d4de1d2… -> 2959d42f…,
        // a2037756… -> f02f5d6d…, 4c95d4a6… -> 45e9457d…). fenrir_v2 #1 still dies in its eighth fight.
        // And the two kraken_v1 walks once more when Eitr Surge joined kraken_v2's pool (2026-10-09):
        // 68a4337a… -> 38733bb5…, 2959d42f… -> faad0c3b…. The fenrir_v2 walks did not move.
        ['t170a:default:kraken_v1:0', 'kraken_v1', 0, 0, '38733bb5dc2a5bb9'],
        ['t170a:default:kraken_v1:0', 'kraken_v1', 0, 3, 'faad0c3b9a2ef1c8'],
        // 202k moved both fenrir_v2 walks on purpose (skoll_v1's kit changed, and wild Skolls hold that kit):
        // cbae1ed75c400704 -> 6fe38a89bb245a0e and 9ec0bff685eb34aa -> 2ab092b942210e28. The kraken_v1 walks did not move.
        ['t170a:default:fenrir_v2:1', 'fenrir_v2', 1, 0, 'f02f5d6d30d58fc7'],
        ['t170a:default:fenrir_v2:1', 'fenrir_v2', 1, 2, '45e9457d006cbf3a'],
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

/** A seed from the sample that dies before the gym on a real walk (`fenrir_v2 #1` loses its eighth fight since 206's biome order; its fifth from 202k, its sixth before). */
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
