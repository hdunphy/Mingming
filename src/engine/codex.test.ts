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
} from './codex';
import { LAUNCH_SPECIES, MingmingRegistry, PLAYABLE_SPECIES } from './data/mingmingRegistry';
import { ProgramRegistry } from './data/programRegistry';
import type { ICodex } from './runTypes';

const empty: ICodex = { seen: [], played: [], species: [], assembled: [], os: [] };
const line = (codex: ICodex, id: string) => codexProgress(codex).find((l) => l.id === id)!;

describe('what there is to collect', () => {
    it('counts every card except the tokens', () => {
        // A token is generated mid-battle by another card — never drafted, bought or chosen. Making
        // 100% depend on having drawn the right generator is a completion nobody can pursue.
        const ids = codexCardIds();
        const tokens = Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].isToken === true);

        expect(tokens.length).toBeGreaterThan(0);
        expect(ids).toHaveLength(Object.keys(ProgramRegistry).length - tokens.length);
        for (const token of tokens) expect(ids).not.toContain(token);
    });

    it('counts the playable species and never the control', () => {
        // `mingmingRegistry` says it outright: enumerate through `PLAYABLE_SPECIES` "or the control
        // shows up as a wild Mingming". A codex is player-facing.
        expect(codexSpeciesIds()).toEqual([...PLAYABLE_SPECIES]);
        expect(codexSpeciesIds()).not.toContain('control');
        expect(Object.keys(MingmingRegistry)).toContain('control');
    });

    it('keeps the launch list separate from the whole roster', () => {
        // Two denominators exist and conflating them would misreport progress in both directions.
        expect(codexLaunchSpeciesIds()).toEqual([...LAUNCH_SPECIES]);
        expect(codexLaunchSpeciesIds().length).toBeLessThan(codexSpeciesIds().length);
    });

    it('counts equippable firmware only — no boss signatures, and no lazy-registry race', () => {
        // `FIRMWARE_REGISTRY` is populated lazily and holds the three `boss_relic_*` signatures the
        // player can never equip. Counting those would make the codex incompletable by three.
        const os = codexOsIds();
        expect(os.length).toBeGreaterThan(0);
        for (const id of os) expect(id.startsWith('boss_relic_')).toBe(false);
        // Derived by inverting `availableOS`, so every entry belongs to a playable species.
        for (const id of os) {
            expect(PLAYABLE_SPECIES.some((s) => MingmingRegistry[s]?.availableOS.includes(id))).toBe(true);
        }
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
