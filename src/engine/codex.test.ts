/**
 * Ticket 31. What the codex counts, and what it refuses to count.
 *
 * The interesting assertions are all about **denominators**: three of them needed a deliberate
 * filter, and a filter that quietly stopped working would make completion either unreachable or
 * free, with nothing on screen to say which.
 */

import { describe, expect, it } from 'vitest';

import {
    CODEX_MILESTONES,
    codexCardIds,
    codexLaunchSpeciesIds,
    codexOsIds,
    codexPercent,
    codexProgress,
    codexSpeciesIds,
    milestonesMet,
    milestonesToFire,
    codexPlusMark,
    codexAllSpeciesIds,
} from './codex';
import { LAUNCH_SPECIES, MingmingRegistry, PLAYABLE_SPECIES } from './data/mingmingRegistry';
import { ProgramRegistry } from './data/programRegistry';
import { inV2RunPool, isRewardable } from './RewardSystem';
import type { ICodex } from './runTypes';

const empty: ICodex = { seen: [], played: [], species: [], assembled: [], os: [] };
const line = (codex: ICodex, id: string) => codexProgress(codex).find((l) => l.id === id)!;

describe('what there is to collect', () => {
    /**
     * TICKET 31a (Henry, 2026-09-24) — **THE DENOMINATOR IS WHAT AN EARLY-ACCESS RUN CAN MEET.**
     *
     * The registry is 366 entries; this used to count 264 of them while an EA run can meet about
     * 109. That is not a hard codex, it is an **incompletable** one, and it reads to a player as a
     * bug in their save rather than as content they have not reached.
     */
    it('counts only cards an EA run can be offered — v2, minus tokens, minus the `+` forms', () => {
        const ids = codexCardIds();
        const tokens = Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].isToken === true);
        const upgrades = Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].upgradeOf);
        expect(tokens.length).toBeGreaterThan(0);
        expect(upgrades.length).toBeGreaterThan(0);

        for (const token of tokens) expect(ids).not.toContain(token);
        for (const upgrade of upgrades) expect(ids).not.toContain(upgrade);
        // The archived v1 collection, which is the exclusion 31a adds and by far the largest.
        for (const id of ids) expect(inV2RunPool(id), `${id} is outside the EA run pool`).toBe(true);
        expect(ids.length).toBeLessThan(Object.keys(ProgramRegistry).length / 2);
    });

    it('counts every card the three doors CAN hand over, so the codex is completable', () => {
        /*
         * The other direction, and the one that matters: a filter that narrowed too far would make
         * the codex trivially completable and nothing would notice. `rewardCardPool` (rewards and
         * the stall's five pool slots), the neutral reservation and the run-only daemons are the
         * three doors, and `inV2RunPool` is the gate all of them already share — so the set this
         * counts and the set the game can offer are the same set by construction, not by agreement.
         */
        const ids = new Set(codexCardIds());
        const offerable = Object.keys(ProgramRegistry).filter(
            (id) => inV2RunPool(id) && isRewardable(id) && ProgramRegistry[id].isToken !== true,
        );
        expect(offerable.length).toBeGreaterThan(50);
        for (const id of offerable) expect(ids.has(id), `${id} is offerable and uncounted`).toBe(true);
    });

    it('folds a `+` into its base card\'s row rather than giving it one — Henry, 31a', () => {
        // *"A `+` card is a MARK on its base card's row, not its own entry."* So seeing `venom_fang+`
        // is seeing `venom_fang`, and the collection does not grow a second row nobody can finish.
        const upgrade = Object.keys(ProgramRegistry).find((id) => ProgramRegistry[id].upgradeOf)!;
        const base = codexPlusMark(upgrade)!;
        expect(base).toBe(upgrade.slice(0, -1));
        expect(codexCardIds()).toContain(base);
        expect(codexCardIds()).not.toContain(upgrade);
        expect(codexPlusMark(base)).toBeNull();
        expect(codexPlusMark('not_a_card')).toBeNull();
    });

    it('counts the EA six as the species denominator, and never the control', () => {
        // Sixteen is the eventual roster; six is what blueprints can be dropped for, because 162a
        // parked the other ten on the archived pool until after EA. At sixteen the species track
        // read 6/16 for a player who had done everything the game offers.
        expect(codexSpeciesIds()).toEqual([...LAUNCH_SPECIES]);
        expect(codexSpeciesIds()).not.toContain('control');
        expect(Object.keys(MingmingRegistry)).toContain('control');
    });

    it('keeps the whole roster reachable as a separate number', () => {
        // Two denominators exist and conflating them would misreport progress in both directions.
        expect(codexLaunchSpeciesIds()).toEqual([...LAUNCH_SPECIES]);
        expect(codexAllSpeciesIds()).toEqual([...PLAYABLE_SPECIES]);
        expect(codexSpeciesIds().length).toBeLessThan(codexAllSpeciesIds().length);
    });

    it('counts the EA twelve firmware only — no Drivers, and no lazy-registry race', () => {
        /*
         * `FIRMWARE_REGISTRY` is populated lazily and holds the `driver_*` enemy Drivers, which
         * ruling 4 puts out of the player's reach. Deriving from `availableOS` keeps them out
         * without a filter anyone maintains.
         *
         * TICKET 31a: the `boss_relic_*` clause that used to stand here is struck — ticket 16
         * DELETED that firmware, `gauntlet.test.ts` asserts none is registered, and a test naming
         * them as a live hazard sends the next reader looking for something that is gone. What it
         * asserts instead is the 31a narrowing: the EA six's firmware, which is twelve.
         */
        const os = codexOsIds();
        const expected = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);
        expect(os).toEqual(expected);
        expect(os).toHaveLength(12);
        for (const id of os) expect(id.startsWith('driver_')).toBe(false);
    });
});

describe('progress', () => {
    it('reports nothing held on an empty codex, and a real total', () => {
        for (const l of codexProgress(empty)) {
            expect(l.held).toBe(0);
            expect(l.total).toBeGreaterThan(0);
            expect(codexPercent(l)).toBe(0);
        }
    });

    it('intersects with the target rather than counting the ledger', () => {
        // The ledgers are add-only and never pruned, so a save that recorded a token or a retired
        // id keeps it forever. Counting the raw array would report 213 of 212.
        const total = codexCardIds().length;
        const bloated: ICodex = {
            ...empty,
            seen: [...codexCardIds(), 'a_card_that_was_retired', 'another_one'],
        };
        expect(line(bloated, 'cards-seen').held).toBe(total);
        expect(codexPercent(line(bloated, 'cards-seen'))).toBe(100);
    });

    it('floors the percentage, so 99% never means finished', () => {
        const cards = codexCardIds();
        const nearly: ICodex = { ...empty, seen: cards.slice(0, cards.length - 1) };
        expect(codexPercent(line(nearly, 'cards-seen'))).toBeLessThan(100);
    });

    it('keeps the five ledgers apart', () => {
        // Each is a different claim; a card seen is not a card played, and a species met is not one
        // you built. Writing one must not move another.
        const seenOnly: ICodex = { ...empty, seen: [codexCardIds()[0]] };
        expect(line(seenOnly, 'cards-seen').held).toBe(1);
        expect(line(seenOnly, 'cards-played').held).toBe(0);

        const metOnly: ICodex = { ...empty, species: [codexSpeciesIds()[0]] };
        expect(line(metOnly, 'species').held).toBe(1);
        expect(line(metOnly, 'assembled').held).toBe(0);
    });
});

describe('milestones', () => {
    it('pays nothing — every reward is null, pending the numbers', () => {
        // The flag, held as an assertion: the day a payout is wired, this test is what says so.
        for (const milestone of CODEX_MILESTONES) expect(milestone.reward).toBeNull();
    });

    it('names a real track for every entry', () => {
        const tracks = new Set(codexProgress(empty).map((l) => l.id));
        for (const milestone of CODEX_MILESTONES) expect(tracks.has(milestone.track)).toBe(true);
        expect(new Set(CODEX_MILESTONES.map((m) => m.id)).size).toBe(CODEX_MILESTONES.length);
    });

    it('meets nothing on an empty codex', () => {
        expect(milestonesMet(empty)).toEqual([]);
    });

    it('meets the completion milestone exactly at the total, not one short', () => {
        const cards = codexCardIds();
        const oneShort: ICodex = { ...empty, seen: cards.slice(0, cards.length - 1) };
        expect(milestonesMet(oneShort)).not.toContain('codex:cards-seen:100');
        expect(milestonesMet({ ...empty, seen: cards })).toContain('codex:cards-seen:100');
    });

    it('fires each milestone once and then never again', () => {
        // The whole point of storing "fired" rather than "satisfied": once payouts exist, a
        // milestone that re-fired would pay twice for the same threshold.
        const cards = codexCardIds();
        const full: ICodex = { ...empty, seen: cards };

        const first = milestonesToFire(full, []);
        expect(first).toContain('codex:cards-seen:100');
        expect(milestonesToFire(full, first)).toEqual([]);
    });

    it('fires the lower rungs alongside the top one', () => {
        // A player who completes a track in one sitting still earned the quarter and the half.
        const cards = codexCardIds();
        const fired = milestonesToFire({ ...empty, seen: cards }, []);
        expect(fired).toContain('codex:cards-seen:25');
        expect(fired).toContain('codex:cards-seen:50');
        expect(fired).toContain('codex:cards-seen:100');
    });
});
