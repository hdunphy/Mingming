import { describe, it, expect } from 'vitest';
import { createBattleState, createMockEntity, instantiateDeck } from './battleFactories';
import type { BattleOptions, IBattleSetup } from './battleFactories';
import { generateEncounter } from './EncounterGenerator';
import { getDeckForOS } from './mingmingRegistry';
import { SeedStream, rollSeed } from '../core/SeedStream';
import { createMingmingInstance, createOwnedProgram, createRanchMember } from '../gameTypes';
import { RanchMemberSchema } from '../runTypes';
import { toMingmingState } from '../run/battleSetup';

/**
 * Ticket 09 "done when": same seed + same inputs => deep-equal IBattleState.
 *
 * 09 had to use a fixed save literal here, because the starter-save factory rolled
 * crypto.randomUUID() ids and Math.random() IVs - the save was an *input* that
 * differed between calls, and determinism of creation cannot paper over that.
 * Ticket 22 seeded the factories, so the input is now generated from a seed like
 * everything else. That is the stronger proof, and the fixed literal is gone.
 *
 * Ticket 11 replaced the save with an `IBattleSetup`, which is the same argument carried further:
 * the input is now *only* the fields the battle actually reads, built here from the seeded ranch
 * factory, so a change to some unrelated corner of the save shape can no longer perturb a
 * determinism test.
 */
const SAVE_SEED = 'ticket-22-save-seed';

function seededSetup(seed: string = SAVE_SEED): IBattleSetup {
    return {
        party: [toMingmingState(createRanchMember('fenrir', 'fenrir_v1', new SeedStream(seed)))],
        deck: getDeckForOS('fenrir', 'fenrir_v1'),
        drivers: [],
        persistedHp: {},
        gauntlet: null,
    };
}

const SEEDED_SAVE: IBattleSetup = seededSetup();

const gymSave = (fightIndex: number): IBattleSetup => ({
    ...SEEDED_SAVE,
    gauntlet: { element: 'Fire', fightIndex },
});

const SEED: BattleOptions = { seed: 'ticket-09-seed' };

describe('createBattleState is deterministic under a threaded seed', () => {
    // Every creation branch: fixed enemyIds, procedural sector, and all three
    // gym tiers (each of which used its own Date.now() seed source).
    const branches: Array<[string, () => ReturnType<typeof createBattleState>]> = [
        ['fixed enemyIds fallback', () => createBattleState(SEEDED_SAVE, ['ratatoskr'], undefined, SEED)],
        ['procedural sector encounter', () => createBattleState(SEEDED_SAVE, [], 'Fire', SEED)],
        ['gym tier 1 (grunt, random count)', () => createBattleState(gymSave(0), [], undefined, SEED)],
        ['gym tier 2 (elite)', () => createBattleState(gymSave(1), [], undefined, SEED)],
        ['gym tier 3 (warden boss)', () => createBattleState(gymSave(2), [], undefined, SEED)],
        ['enemyMode CARDS', () => createBattleState(SEEDED_SAVE, [], 'Fire', { ...SEED, enemyMode: 'CARDS' })]
    ];

    for (const [name, build] of branches) {
        it(`${name}: two calls with the same seed are deep-equal`, () => {
            expect(build()).toEqual(build());
        });
    }

    it('a different seed produces a different battle', () => {
        const a = createBattleState(SEEDED_SAVE, [], 'Fire', { seed: 'seed-a' });
        const b = createBattleState(SEEDED_SAVE, [], 'Fire', { seed: 'seed-b' });
        expect(a).not.toEqual(b);
    });

    it('no seed still works, and rolls a fresh one per call', () => {
        const a = createBattleState(SEEDED_SAVE, [], 'Fire');
        const b = createBattleState(SEEDED_SAVE, [], 'Fire');
        expect(a.enemyParty.length).toBeGreaterThan(0);
        expect(a).not.toEqual(b);
    });

    it('sessionId is seed-derived, not wall-clock (it lives inside IBattleState)', () => {
        const a = createBattleState(SEEDED_SAVE, [], 'Fire', SEED);
        const b = createBattleState(SEEDED_SAVE, [], 'Fire', SEED);
        expect(a.sessionId).toBe(b.sessionId);
        expect(a.sessionId).toContain('ticket-09-seed');
        expect(Number(a.sessionId.replace('battle_', ''))).toBeNaN();
    });

    it('card instance ids are stable across a replay and unique within a battle', () => {
        const a = createBattleState(SEEDED_SAVE, [], 'Fire', { ...SEED, enemyMode: 'CARDS' });
        const b = createBattleState(SEEDED_SAVE, [], 'Fire', { ...SEED, enemyMode: 'CARDS' });

        const idsOf = (s: typeof a) => [
            ...s.playerDeck.drawpile, ...s.playerDeck.hand,
            ...s.enemyDeck.drawpile, ...s.enemyDeck.hand
        ].map(c => c.id);

        const ids = idsOf(a);
        expect(ids.length).toBeGreaterThan(0);
        expect(idsOf(b)).toEqual(ids);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('generateEncounter is deterministic', () => {
    const party = [createMockEntity('P1', 'fenrir', new SeedStream('party'))];

    it('same seed => same encounter', () => {
        const a = generateEncounter({ sectorElement: 'Fire', playerParty: party, seed: 'enc' });
        const b = generateEncounter({ sectorElement: 'Fire', playerParty: party, seed: 'enc' });
        expect(a).toEqual(b);
    });
});

describe('SeedStream', () => {
    it('replays identically from the same seed', () => {
        const draw = () => {
            const s = new SeedStream('abc');
            return [s.nextInt(0, 100), s.next(), s.nextId('x'), s.shuffle([1, 2, 3, 4, 5]), s.fork('label'), s.seed];
        };
        expect(draw()).toEqual(draw());
    });

    it('diverges on a different seed', () => {
        expect(new SeedStream('abc').nextId('x')).not.toBe(new SeedStream('def').nextId('x'));
    });

    it('mints collision-free ids in bulk (the counter, not the 31-bit token, guarantees it)', () => {
        const s = new SeedStream('bulk');
        const ids = Array.from({ length: 2000 }, () => s.nextId('c'));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('adopt() re-anchors the thread on a seed produced elsewhere', () => {
        const s = new SeedStream('start');
        s.adopt('elsewhere');
        expect(s.seed).toBe('elsewhere');
        expect(s.nextInt(0, 9)).toBe(new SeedStream('elsewhere').nextInt(0, 9));
    });

    it('instantiateDeck sharing one stream never repeats an id across decks', () => {
        const s = new SeedStream('decks');
        const a = instantiateDeck(['fire_poke', 'fire_poke'], s);
        const b = instantiateDeck(['fire_poke', 'fire_poke'], s);
        const ids = [...a, ...b].map(c => c.id);
        expect(new Set(ids).size).toBe(4);
    });

    it('rollSeed returns a fresh seed each call', () => {
        expect(rollSeed()).not.toBe(rollSeed());
    });
});

describe('ranch factories are deterministic under a threaded seed (ticket 22)', () => {
    // Ticket 11 deleted `createStarterSave` — a starter *save* is not a thing any more, because
    // starting is now "spend a blueprint at the ranch, then pick a party at run start". What
    // survives is the property those tests were really about: every factory that mints persistent
    // identity replays exactly from its seed. The subject moved from the save to `createRanchMember`.
    it('same seed => deep-equal IRanchMember', () => {
        expect(createRanchMember('fenrir', 'fenrir_v1', new SeedStream(SAVE_SEED)))
            .toEqual(createRanchMember('fenrir', 'fenrir_v1', new SeedStream(SAVE_SEED)));
        expect(createRanchMember('kraken', 'kraken_v1', new SeedStream(SAVE_SEED)))
            .toEqual(createRanchMember('kraken', 'kraken_v1', new SeedStream(SAVE_SEED)));
    });

    it('a different seed produces a different individual', () => {
        expect(createRanchMember('fenrir', 'fenrir_v1', new SeedStream('seed-a')))
            .not.toEqual(createRanchMember('fenrir', 'fenrir_v1', new SeedStream('seed-b')));
    });

    it('no seed still works, and rolls a fresh one per call', () => {
        const a = createRanchMember('fenrir');
        const b = createRanchMember('fenrir');
        expect(a.definitionId).toBe('fenrir');
        // `activeOS` is required on IRanchMember and defaults to the species' first OS.
        expect(a.activeOS).toBe('fenrir_v1');
        expect(a).not.toEqual(b);
    });

    it('the generated member validates against RanchMemberSchema (IVs stay in 0-31)', () => {
        expect(RanchMemberSchema.safeParse(createRanchMember('fenrir', 'fenrir_v1', new SeedStream(SAVE_SEED))).success).toBe(true);
        for (let i = 0; i < 200; i++) {
            const mm = createMingmingInstance('fenrir', new SeedStream('iv_' + i));
            for (const iv of [mm.attackIV, mm.defenseIV, mm.hpIV]) {
                expect(Number.isInteger(iv)).toBe(true);
                expect(iv).toBeGreaterThanOrEqual(0);
                expect(iv).toBeLessThanOrEqual(31);
            }
        }
    });

    it('createMingmingInstance and createOwnedProgram replay from a shared stream', () => {
        const draw = () => {
            const s = new SeedStream('leaf-factories');
            return {
                member: createMingmingInstance('fenrir', s),
                first: createOwnedProgram('fire_poke', s),
                second: createOwnedProgram('fire_poke', s)
            };
        };
        const a = draw();
        expect(draw()).toEqual(a);
        // One stream, so two instances of the same card never collide.
        expect(a.first.instanceId).not.toBe(a.second.instanceId);
    });

    it('tolerates being passed straight to Array.prototype.map (the index is not a seed)', () => {
        const cards = ['fire_poke', 'fire_poke'].map(createOwnedProgram);
        expect(cards.map(c => c.dataId)).toEqual(['fire_poke', 'fire_poke']);
        expect(cards[0].instanceId).not.toBe(cards[1].instanceId);
    });
});
