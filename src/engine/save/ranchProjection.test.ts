/**
 * The save boundary's translation layer — ticket 23.
 *
 * Two things are worth pinning down here, and they are not the same thing:
 *
 *   1. **What round-trips.** Roster identity, stat rolls, active OS, blueprint COUNTS and gym
 *      clears must survive slice → ranch → slice unchanged. These are the ranch, the half ticket 06
 *      says is irreplaceable.
 *   2. **What deliberately does not.** Cards, deck, scrap, relics and gauntlet progress are
 *      run-scoped in the ratified model and are asserted to come back at their fresh-start values.
 *      That assertion exists so the behaviour is a documented decision rather than a bug someone
 *      "fixes" later without reading ticket 06.
 */

import { describe, expect, it } from 'vitest';

import { createDefaultSave, type IPlayerSave } from '../gameTypes';
import { RanchStateSchema } from '../runTypes';
import { applyRanchState, toRanchState } from './ranchProjection';

function slice(overrides: Partial<IPlayerSave> = {}): IPlayerSave {
    return { ...createDefaultSave(), ...overrides };
}

const member = (id: string, definitionId: string, activeOS?: string) => ({
    id,
    definitionId,
    blueprintsCollected: 0,
    attackIV: 7,
    defenseIV: 11,
    hpIV: 23,
    ...(activeOS === undefined ? {} : { activeOS }),
});

describe('toRanchState', () => {
    it('produces something RanchStateSchema accepts, which is what makes it savable at all', () => {
        const ranch = toRanchState(slice({ roster: [member('mm1', 'kraken')] }));
        expect(RanchStateSchema.safeParse(ranch).success).toBe(true);
    });

    it('carries blueprint counts across as-is, and copies rather than aliases them', () => {
        const before = slice({ blueprints: { kraken: 2, fenrir: 1 } });
        const ranch = toRanchState(before);
        // Ticket 20 moved the slice to counts too, so this half of the projection is the
        // identity — the lossy dedup-on-architectureId edge it used to have is gone. What is
        // still worth asserting is that it hands over a fresh object: the ranch state is about
        // to be serialized, and sharing the slice's map would let a later `addBlueprint` mutate
        // what is being written.
        expect(ranch.blueprints).toEqual({ kraken: 2, fenrir: 1 });
        expect(ranch.blueprints).not.toBe(before.blueprints);
    });

    it('resolves an absent activeOS the same way the roster grant does', () => {
        // `IRanchMember.activeOS` is required: "which firmware is this running" has no meaningful
        // absent state once swapping costs a blueprint. The fallback must match
        // `gameSlice.addToRoster`'s, or the two disagree about which kit was granted.
        const ranch = toRanchState(slice({ roster: [member('mm1', 'kraken')] }));
        expect(ranch.roster[0].activeOS).toBe('kraken_v1');
    });

    it('keeps an explicit activeOS', () => {
        const ranch = toRanchState(slice({ roster: [member('mm1', 'kraken', 'kraken_v2')] }));
        expect(ranch.roster[0].activeOS).toBe('kraken_v2');
    });

    it('records only sectors BEYOND the starting three as gym clears', () => {
        const base = createDefaultSave().unlockedSectors;
        const ranch = toRanchState(slice({ unlockedSectors: [...base, 'Dark'] }));
        // The three defaults are re-seeded by `createDefaultSave`, so persisting them would just
        // be noise that grows every load.
        expect(ranch.gymsCleared).toEqual(['Dark']);
    });
});

describe('applyRanchState', () => {
    it('round-trips the ranch half unchanged', () => {
        const before = slice({
            roster: [member('mm1', 'kraken', 'kraken_v2'), member('mm2', 'fenrir', 'fenrir_v1')],
            activeParty: ['mm1'],
            blueprints: { kraken: 1 },
            unlockedSectors: [...createDefaultSave().unlockedSectors, 'Dark'],
        });

        const after = applyRanchState(createDefaultSave(), toRanchState(before));

        expect(after.roster.map((m) => [m.id, m.definitionId, m.activeOS, m.attackIV, m.hpIV]))
            .toEqual(before.roster.map((m) => [m.id, m.definitionId, m.activeOS ?? 'kraken_v2', m.attackIV, m.hpIV]));
        expect(after.blueprints).toEqual({ kraken: 1 });
        expect(after.unlockedSectors).toContain('Dark');
    });

    it('restores the stack, not one entry per species', () => {
        // This used to assert that `name` and `compileCost` were re-synthesized from the
        // registry on the way back in. Ticket 20 deleted both fields — the name was derivable
        // and the flat 100-scrap cost is gone, assembly costs a blueprint — so the only thing
        // left to get right is the count itself, and holding two must not come back as one.
        const after = applyRanchState(createDefaultSave(), {
            roster: [],
            blueprints: { kraken: 2 },
            codex: { seen: [], played: [] },
            gymsCleared: [],
            highestTierCleared: 0,
        });

        expect(after.blueprints).toEqual({ kraken: 2 });
    });

    it('DELIBERATELY does not restore run-scoped state (ticket 06)', () => {
        const before = slice({
            roster: [member('mm1', 'kraken')],
            cardInventory: [{ instanceId: 'c1', dataId: 'prog_a' }],
            activeDeck: { id: 'd1', name: 'Main', cards: ['c1'] },
            scrapCount: 250,
            relics: ['relic_a'],
        });

        const after = applyRanchState(createDefaultSave(), toRanchState(before));

        // Every one of these moves into `IRunState` as tickets 09–15 land the run loop. Until
        // then they start fresh each boot. This is the ruling, not a gap.
        expect(after.cardInventory).toEqual([]);
        expect(after.activeDeck).toBeNull();
        expect(after.scrapCount).toBe(0);
        expect(after.relics).toEqual([]);
        expect(after.gauntlet).toBeNull();
    });

    it('refilters activeParty against the roster it actually loaded', () => {
        const after = applyRanchState(
            slice({ activeParty: ['mm1', 'ghost'] }),
            toRanchState(slice({ roster: [member('mm1', 'kraken')] })),
        );
        // A party id with no member behind it is the same soft-lock `reconcileLoadedState` guards
        // the run against; the slice's own party needs the same guard because it is not a ranch
        // field and so is inherited from the base rather than validated by the schema.
        expect(after.activeParty).toEqual(['mm1']);
    });

    it('never restores more than three party members', () => {
        const roster = ['mm1', 'mm2', 'mm3', 'mm4'].map((id, i) => member(id, ['kraken', 'fenrir', 'ratatoskr', 'huldra'][i]));
        const after = applyRanchState(
            slice({ activeParty: ['mm1', 'mm2', 'mm3', 'mm4'] }),
            toRanchState(slice({ roster })),
        );
        expect(after.activeParty).toHaveLength(3);
    });
});
