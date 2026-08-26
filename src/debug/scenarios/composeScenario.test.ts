/**
 * Headless coverage for the scenario launcher's composition half.
 *
 * The panel itself can only be rendered to static markup (no `@testing-library/react` in the
 * repo, `node` test environment), so everything that matters about the launcher is proved
 * here instead: the draft -> `ComposedSetup` projection, deck resolution off the real run
 * shape, the `Mirror my save party` preset, the CARDS-mode warning, the destination slot the
 * launch banner names, and the full compose -> `buildScenarioState` -> `dispatch` path
 * against a real store.
 *
 * TICKET 11 MOVED TWO OF THE SUBJECTS. "Saved deck" mode reads `IRunState.deck` rather than
 * `IPlayerSave.activeDeck`, so its instance-id resolution tests are gone with the indirection —
 * an `IRunCard` carries its own `dataId` and there is nothing left to fail to resolve. And the
 * empty-slot seeding writes only the roster: cards and drivers are run-scoped, so a scratch slot
 * with no run has nowhere to put them, which retires the "seeds a coherent deck" test below.
 */

import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const backing: Record<string, string> = {};
vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing[key] ?? null,
    setItem: (key: string, value: string) => {
        backing[key] = value;
    },
    removeItem: (key: string) => {
        delete backing[key];
    },
    clear: () => {
        Object.keys(backing).forEach((k) => delete backing[k]);
    },
    get length() {
        return Object.keys(backing).length;
    },
    key: (i: number) => Object.keys(backing)[i] ?? null,
});

import { createSlot, renameSlot, setActiveSlotId } from '../../engine/SaveSlots';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';
import battleReducer from '../../ui/store/battleSlice';
import gameReducer, { createEmptyRanch } from '../../ui/store/gameSlice';
import { validateSave } from '../saveEdit';
import {
    baseDeckFor,
    cardOptions,
    cardsModeWarning,
    createDraft,
    createEnemyUnit,
    createUnit,
    destinationSlot,
    draftFromSetup,
    launchBlockers,
    launchScenario,
    mirrorSaveParty,
    osOptions,
    relicOptions,
    resolveDeck,
    savedDeck,
    speciesOptions,
    toComposedSetup,
    UNROLLED_SEED,
    type LauncherDraft,
} from './composeScenario';
import { loadScenario, saveScenario } from './scenarioIO';
import type { ComposedScenario } from './scenarioSchema';

function makeSave(overrides: Partial<IRanchState> = {}): IRanchState {
    return { ...createEmptyRanch(), ...overrides };
}

function rosterMember(id: string, definitionId: string): IRanchMember {
    return {
        id,
        definitionId,
        attackIV: 7,
        defenseIV: 11,
        hpIV: 13,
        activeOS: `${definitionId}_v2`,
    };
}

/** A real run, built the way the game builds one, so "the run's deck" means the run's deck. */
function makeRun(party: ReadonlyArray<IRanchMember> = [rosterMember('r1', 'kraken')]): IRunState {
    return createRun({
        seed: 'compose-test-run',
        offer: offerGyms('compose-test-offer')[0],
        party: party.map((m) => ({ ...m, blueprintsCollected: 0 })),
        startedAt: 1_700_000_000_000,
    });
}

/** A minimal launchable draft: one player unit, one enemy, base decks. */
function playableDraft(): LauncherDraft {
    return {
        ...createDraft(),
        seed: 'seed-fixed',
        party: [createUnit('fenrir')],
        enemies: [createUnit('draugr')],
    };
}

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
}

/** Both slices — the seeding path writes `game` as well as `battle`. */
function makeFullStore(save: IRanchState = createEmptyRanch()) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer },
        preloadedState: { game: save },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
}

describe('registry-backed pickers', () => {
    it('reads species, OS, cards and relics off the live registries', () => {
        const species = speciesOptions();
        expect(species.length).toBeGreaterThan(10);
        expect(species.map((s) => s.id)).toContain('fenrir');
        expect(species.find((s) => s.id === 'fenrir')?.element).toBe('Fire');

        expect(osOptions('fenrir')).toContain('fenrir_v1');
        expect(osOptions('not_a_species')).toEqual([]);

        expect(cardOptions().length).toBeGreaterThan(10);
        expect(relicOptions().map((r) => r.id)).toContain('expansion_slot');
    });
});

describe('deck resolution', () => {
    it('base mode pools the party species base decks', () => {
        const draft = { ...createDraft(), party: [createUnit('fenrir'), createUnit('kraken')] };
        const resolved = resolveDeck(draft, null);

        expect(resolved.cards).toEqual(baseDeckFor(draft.party));
        expect(resolved.cards.length).toBe(17); // fenrir 9 + kraken 8 (ticket 28)
        expect(resolved.source).toContain('base decks');
    });

    it('saved mode reads the RUN deck, as dataIds — no inventory lookup left to fail', () => {
        // Ticket 11: the old test proved `activeDeck.cards` resolved through `cardInventory` the
        // same way `createBattleState` did, and counted the entries that resolved to nothing. An
        // `IRunCard` carries its `dataId`, so both the join and its failure mode are gone.
        const run = makeRun();
        const expected = run.deck.map((c) => c.dataId);

        expect(savedDeck(run)).toEqual({ name: 'run deck', cards: expected });

        const resolved = resolveDeck({ ...createDraft(), deckMode: 'saved' }, run);
        expect(resolved.cards).toEqual(expected);
        // A SOLO run's opener: one member's 4 kit cards plus the run's 2 generics. Not 6 a member —
        // the generics are a run-level allowance carried by the first mingming (Henry, 2026-08-25),
        // so this figure would be 10 for a party of two, not 12.
        expect(resolved.cards).toHaveLength(6);
        expect(resolved.source).toContain('run deck');
        expect(resolved.issues).toEqual([]);
    });

    it('saved mode says so, loudly, when there is no run in progress', () => {
        // It used to point at DeckTerminal. That screen is gone, so pointing at it would be
        // pointing at nothing — the honest instruction is "start a run, or use base decks".
        const resolved = resolveDeck({ ...createDraft(), deckMode: 'saved' }, null);
        expect(resolved.cards).toEqual([]);
        expect(resolved.source).toContain('no run in progress');
        expect(resolved.issues[0]).toContain('No run in progress');
        expect(resolved.issues[0]).not.toContain('DeckTerminal');
    });

    it('loaded mode carries a file deck through untouched', () => {
        const resolved = resolveDeck(
            { ...createDraft(), deckMode: 'loaded', loadedDeck: ['a', 'b', 'a'] },
            null,
        );
        expect(resolved.cards).toEqual(['a', 'b', 'a']);
    });
});

describe('mirrorSaveParty', () => {
    it('mirrors the RUN party when there is one', () => {
        const member = rosterMember('r1', 'kraken');
        const ranch = makeSave({ roster: [member, rosterMember('r2', 'fenrir')] });
        const run = makeRun([member]);

        const units = mirrorSaveParty(ranch, run);

        expect(units.map((u) => u.definitionId)).toEqual(['kraken']);
        expect(units[0].activeOS).toBe('kraken_v2');
        expect(units[0].attackIV).toBe(7);
    });

    it('falls back to the head of the ranch roster when there is no run', () => {
        // There is no persistent party to mirror any more, so "no run" is the ordinary case here
        // rather than the edge one.
        const ranch = makeSave({
            roster: ['kraken', 'fenrir', 'ratatoskr', 'huldra'].map((sp, i) => rosterMember(`r${i}`, sp)),
        });

        const units = mirrorSaveParty(ranch, null);

        expect(units).toHaveLength(3); // MAX_PARTY
        expect(units.map((u) => u.definitionId)).toEqual(['kraken', 'fenrir', 'ratatoskr']);
    });

    it('is empty for an empty ranch', () => {
        expect(mirrorSaveParty(createEmptyRanch(), null)).toEqual([]);
    });
});

describe('toComposedSetup', () => {
    it('omits optional fields that are unset rather than writing nulls', () => {
        const setup = toComposedSetup(playableDraft(), null);
        const member = setup.player.party[0];

        expect(member).not.toHaveProperty('currentHp');
        expect(member).not.toHaveProperty('statusEffects');
        expect(member).not.toHaveProperty('maxHpOverride');
        expect(setup.enemies[0]).not.toHaveProperty('deck');
        expect(setup).not.toHaveProperty('gauntlet');
        expect(member.activeOS).toBe('fenrir_v1');
    });

    it('carries HP, statuses, enemy overrides, relics and gauntlet context', () => {
        const draft: LauncherDraft = {
            ...playableDraft(),
            relics: ['expansion_slot'],
            // Ticket 18 reconciled `GauntletContext` with the ratified `IGauntletProgress`: no
            // `type` and no `element`, `fightIndex`/`totalFights` rather than
            // `currentBattleIndex`/`totalBattles`, and HP as a flat map beside the downed list.
            gauntlet: {
                fightIndex: 1,
                totalFights: 3,
                persistedHp: { mm_carried: 12 },
                downedMemberIds: ['mm_down'],
            },
        };
        draft.party[0] = {
            ...draft.party[0],
            currentHp: 12,
            statusEffects: [{ id: 'burn_0', type: 'Burn', stacks: 2 }],
        };
        draft.enemies[0] = { ...draft.enemies[0], maxHpOverride: 500, deck: ['ignite'] };

        const setup = toComposedSetup(draft, null);

        expect(setup.player.party[0].currentHp).toBe(12);
        expect(setup.player.party[0].statusEffects).toHaveLength(1);
        expect(setup.player.relics).toEqual(['expansion_slot']);
        expect(setup.enemies[0].maxHpOverride).toBe(500);
        expect(setup.enemies[0].deck).toEqual(['ignite']);
        expect(setup.gauntlet?.totalFights).toBe(3);
        expect(setup.gauntlet?.fightIndex).toBe(1);
        expect(setup.gauntlet?.persistedHp).toEqual({ mm_carried: 12 });
        expect(setup.gauntlet?.downedMemberIds).toEqual(['mm_down']);
    });

    it('shows a placeholder seed while the field is blank, and honours an override', () => {
        const draft = { ...playableDraft(), seed: '' };
        expect(toComposedSetup(draft, null).seed).toBe(UNROLLED_SEED);
        expect(toComposedSetup(draft, null, 'pinned').seed).toBe('pinned');
    });

    it('round-trips a loaded setup without rewriting it', () => {
        const original = toComposedSetup(
            {
                ...playableDraft(),
                relics: ['heatsink'],
                enemies: [{ ...createEnemyUnit(), deck: ['ignite', 'scorch'], maxHpOverride: 90 }],
            },
            null,
        );

        const rehydrated = toComposedSetup(draftFromSetup(original, 'reloaded'), null);

        expect(rehydrated).toEqual(original);
    });
});

describe('file round trip', () => {
    it('a composed draft saves, validates, reloads and rehydrates identically', () => {
        const draft: LauncherDraft = {
            ...playableDraft(),
            name: 'burn stall repro',
            relics: ['heatsink'],
            enemyMode: 'CARDS',
            enemies: [{ ...createEnemyUnit(), deck: ['ignite', 'ignite'], maxHpOverride: 240 }],
        };
        const setup = toComposedSetup(draft, null);

        const saved = saveScenario({ kind: 'composed', name: draft.name, setup });
        expect(saved.success).toBe(true);

        const loaded = loadScenario(saved.json!);
        expect(loaded.scenario?.kind).toBe('composed');
        // Saved and loaded in the same process against the same registries, so no drift.
        expect(loaded.registryHashMismatch).toBe(false);

        const reloaded = loaded.scenario as ComposedScenario;
        expect(toComposedSetup(draftFromSetup(reloaded.setup, reloaded.name), null)).toEqual(setup);
    });
});

describe('warnings', () => {
    it('warns when CARDS-mode enemies have no deck — the cf7ad48 failure', () => {
        const draft = { ...playableDraft(), enemyMode: 'CARDS' as const };
        expect(cardsModeWarning(draft)).toContain('nothing to play');

        draft.enemies = [{ ...draft.enemies[0], deck: ['ignite'] }];
        expect(cardsModeWarning(draft)).toBeNull();
        expect(cardsModeWarning({ ...draft, enemyMode: 'MOVES' })).toBeNull();
    });

    it('blocks launch exactly where buildScenarioState would throw', () => {
        expect(launchBlockers(playableDraft())).toEqual([]);
        expect(launchBlockers({ ...playableDraft(), party: [] })[0]).toContain('No player party');
        expect(launchBlockers({ ...playableDraft(), enemies: [] })[0]).toContain('No enemies');
    });
});

describe('destinationSlot', () => {
    beforeEach(() => {
        Object.keys(backing).forEach((key) => delete backing[key]);
    });

    it('names the slot a finished battle will write into', () => {
        renameSlot('slot_1', 'Real Save');
        const slot = destinationSlot();

        expect(slot.id).toBe('slot_1');
        expect(slot.name).toBe('Real Save');
        expect(slot.headline).toBe('This battle will end into your "Real Save" save (slot_1).');
    });

    it('follows the active slot when it moves', () => {
        const scratch = createSlot('Scratch');
        expect(scratch).not.toBeNull();
        setActiveSlotId(scratch!.id);

        expect(destinationSlot().name).toBe('Scratch');
    });
});

describe('launchScenario — compose, materialize, dispatch', () => {
    it('puts a real battle in the store from a composed draft', () => {
        const store = makeStore();
        const setup = toComposedSetup(playableDraft(), null);

        const result = launchScenario(setup, store.dispatch);

        expect(result.ok).toBe(true);
        expect(result.seed).toBe('seed-fixed');

        const battle = store.getState().battle.battle;
        expect(battle).not.toBeNull();
        expect(battle!.seed).toBeTruthy();
        expect(battle!.playerParty.map((e) => e.definitionId)).toEqual(['fenrir']);
        expect(battle!.enemyParty.map((e) => e.definitionId)).toEqual(['draugr']);
        // Base decks came through: 9 cards, dealt into hand + drawpile.
        expect(battle!.playerDeck.drawpile.length + battle!.playerDeck.hand.length).toBe(9);
        expect(battle!.enemyMode).toBe('MOVES');
    });

    it('rolls a seed when the field was blank and reports the one it used', () => {
        const store = makeStore();
        const setup = toComposedSetup({ ...playableDraft(), seed: '' }, null);

        const result = launchScenario(setup, store.dispatch);

        expect(result.ok).toBe(true);
        expect(result.seed).not.toBe(UNROLLED_SEED);
        expect(result.seed).toBeTruthy();
        expect(store.getState().battle.battle!.sessionId).toBe(`battle_${result.seed}`);
    });

    it('is deterministic: same setup, same seed, same state', () => {
        const setup = toComposedSetup(playableDraft(), null);
        const a = makeStore();
        const b = makeStore();

        launchScenario(setup, a.dispatch);
        launchScenario(setup, b.dispatch);

        expect(a.getState().battle.battle).toEqual(b.getState().battle.battle);
    });

    it('reports the materializer error and dispatches nothing when the setup is unplayable', () => {
        const store = makeStore();
        const setup = toComposedSetup({ ...playableDraft(), enemies: [] }, null);

        const result = launchScenario(setup, store.dispatch);

        expect(result.ok).toBe(false);
        expect(result.error).toContain('no enemies');
        expect(store.getState().battle.battle).toBeNull();
    });
});

describe('launchScenario — seeding an empty slot', () => {
    /** A launchable two-unit setup with a relic, so every field the launcher carries has content. */
    function seedableSetup() {
        return toComposedSetup(
            {
                ...playableDraft(),
                party: [createUnit('fenrir'), createUnit('kraken')],
                relics: ['heatsink'],
            },
            null,
        );
    }

    it('seeds an empty roster with the battle party, ids included', () => {
        const store = makeFullStore();
        const setup = seedableSetup();

        const result = launchScenario(setup, store.dispatch, store.getState().game);

        expect(result.ok).toBe(true);
        expect(result.seeded).toBe(true);
        expect(result.seedIssues).toBeUndefined();

        const battle = store.getState().battle.battle!;
        const ranch = store.getState().game;

        // THE REGRESSION THAT MATTERS: the seeded roster's ids ARE the battle's ids, so the
        // individuals on the field and the individuals in the ranch are the same individuals.
        expect(ranch.roster.map((m) => m.id)).toEqual(battle.playerParty.map((e) => e.id));
        expect(ranch.roster.map((m) => m.definitionId)).toEqual(['fenrir', 'kraken']);
        expect(ranch.roster[0].activeOS).toBe(battle.playerParty[0].activeOS);

        // Roster members are RANCH shape: no combat half, and no `blueprintsCollected` either —
        // ticket 20 made blueprints a ranch-level count, so the per-individual tally is not a
        // ranch field at all.
        expect(ranch.roster[0]).not.toHaveProperty('maxHp');
        expect(ranch.roster[0]).not.toHaveProperty('currentHp');
        expect(ranch.roster[0]).not.toHaveProperty('statusEffects');
        expect(ranch.roster[0]).not.toHaveProperty('blueprintsCollected');
    });

    it('seeds NOTHING run-scoped — the deck and the drivers stay out of the ranch', () => {
        // Ticket 11: the old version wrote the scenario deck into `cardInventory` + `activeDeck`
        // and unioned its relics into the save. A ranch holds neither, and a scratch slot has no
        // run to hold them instead. The battle already got both, directly out of `ComposedSetup`.
        const store = makeFullStore();
        const setup = seedableSetup();

        launchScenario(setup, store.dispatch, store.getState().game);

        const ranch = store.getState().game;
        expect(Object.keys(ranch).sort()).toEqual(
            ['blueprints', 'codex', 'codexMilestones', 'gymsCleared', 'highestTierCleared', 'roster', 'seenTips'],
        );
        expect(ranch.blueprints).toEqual({});
        expect(ranch.gymsCleared).toEqual([]);
        // ...and the battle itself did get the deck.
        const battle = store.getState().battle.battle!;
        expect(battle.playerDeck.drawpile.length + battle.playerDeck.hand.length)
            .toBe(setup.player.deck.length);
    });

    it('leaves a populated roster alone — a slot branched from a real run is untouched', () => {
        const populated = makeSave({
            roster: [rosterMember('r1', 'kraken')],
            blueprints: { kraken: 2 },
            gymsCleared: ['gym_emberfall'],
        });
        const store = makeFullStore(populated);

        const result = launchScenario(seedableSetup(), store.dispatch, populated);

        expect(result.ok).toBe(true);
        expect(result.seeded).toBe(false);
        expect(store.getState().game).toEqual(populated);
        // The battle still went in.
        expect(store.getState().battle.battle).not.toBeNull();
    });

    it('does not touch the ranch at all when no ranch is passed', () => {
        const store = makeFullStore();
        const before = store.getState().game;

        const result = launchScenario(seedableSetup(), store.dispatch);

        expect(result.seeded).toBe(false);
        expect(store.getState().game).toBe(before);
        expect(store.getState().battle.battle).not.toBeNull();
    });

    it('produces a ranch that passes RanchStateSchema', () => {
        const store = makeFullStore();
        launchScenario(seedableSetup(), store.dispatch, store.getState().game);

        expect(validateSave(store.getState().game)).toEqual({ valid: true, issues: [] });
    });
});
