/**
 * Headless coverage for the scenario launcher's composition half.
 *
 * The panel itself can only be rendered to static markup (no `@testing-library/react` in the
 * repo, `node` test environment), so everything that matters about the launcher is proved
 * here instead: the draft -> `ComposedSetup` projection, deck resolution off the real save
 * shape, the `Mirror my save party` preset, the CARDS-mode warning, the destination slot the
 * launch banner names, and the full compose -> `buildScenarioState` -> `dispatch` path
 * against a real store.
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
import { createDefaultSave } from '../../engine/gameTypes';
import type { IPlayerSave } from '../../engine/gameTypes';
import battleReducer from '../../ui/store/battleSlice';
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
    matchPlayerLevel,
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

function makeSave(overrides: Partial<IPlayerSave> = {}): IPlayerSave {
    return { ...createDefaultSave(), ...overrides };
}

function rosterMember(id: string, definitionId: string, level: number) {
    return {
        id,
        definitionId,
        level,
        experience: 0,
        blueprintsCollected: 0,
        attackIV: 7,
        defenseIV: 11,
        hpIV: 13,
        activeOS: `${definitionId}_v2`,
    };
}

/** A minimal launchable draft: one player unit, one enemy, base decks. */
function playableDraft(): LauncherDraft {
    return {
        ...createDraft(),
        seed: 'seed-fixed',
        party: [createUnit('fenrir', 12)],
        enemies: [createUnit('draugr', 12)],
    };
}

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer },
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

describe('mirrorSaveParty', () => {
    it('copies the active party verbatim, capped at three', () => {
        const save = makeSave({
            roster: [
                rosterMember('r1', 'kraken', 14),
                rosterMember('r2', 'ratatoskr', 12),
                rosterMember('r3', 'fenrir', 9),
                rosterMember('r4', 'draugr', 30),
            ],
            activeParty: ['r2', 'r1'],
        });

        const party = mirrorSaveParty(save);

        expect(party.map((u) => u.definitionId)).toEqual(['ratatoskr', 'kraken']);
        expect(party[0].level).toBe(12);
        expect(party[0].attackIV).toBe(7);
        expect(party[0].defenseIV).toBe(11);
        expect(party[0].hpIV).toBe(13);
        expect(party[0].activeOS).toBe('ratatoskr_v2');
    });

    it('falls back to the head of the roster when no active party is set', () => {
        const save = makeSave({
            roster: [
                rosterMember('r1', 'kraken', 14),
                rosterMember('r2', 'ratatoskr', 12),
                rosterMember('r3', 'fenrir', 9),
                rosterMember('r4', 'draugr', 30),
            ],
            activeParty: [],
        });

        expect(mirrorSaveParty(save)).toHaveLength(3);
        expect(mirrorSaveParty(makeSave())).toEqual([]);
    });
});

describe('matchPlayerLevel', () => {
    it('lifts every enemy to the highest party level', () => {
        const enemies = matchPlayerLevel(
            [createUnit('fenrir', 8), createUnit('kraken', 21)],
            [createUnit('draugr', 3), createUnit('ymir', 40)],
        );
        expect(enemies.map((e) => e.level)).toEqual([21, 21]);
    });

    it('uses the default level rather than no-oping when the party is empty', () => {
        expect(matchPlayerLevel([], [createUnit('draugr', 3)])[0].level).toBe(10);
    });
});

describe('deck resolution', () => {
    it('base mode pools the party species base decks', () => {
        const draft = { ...createDraft(), party: [createUnit('fenrir', 5), createUnit('kraken', 5)] };
        const resolved = resolveDeck(draft, makeSave());

        expect(resolved.cards).toEqual(baseDeckFor(draft.party));
        expect(resolved.cards.length).toBe(20);
        expect(resolved.source).toContain('base decks');
    });

    it('saved mode resolves instance ids through cardInventory, as the real battle path does', () => {
        const save = makeSave({
            cardInventory: [
                { instanceId: 'i1', dataId: 'ignite' },
                { instanceId: 'i2', dataId: 'scorch' },
            ],
            activeDeck: { id: 'd1', name: 'Burn Control', cards: ['i1', 'i2', 'i-gone'] },
        });

        expect(savedDeck(save)).toEqual({ name: 'Burn Control', cards: ['ignite', 'scorch'], missing: 1 });

        const resolved = resolveDeck({ ...createDraft(), deckMode: 'saved' }, save);
        expect(resolved.cards).toEqual(['ignite', 'scorch']);
        expect(resolved.source).toContain('Burn Control');
        expect(resolved.issues[0]).toContain('not in cardInventory');
    });

    it('saved mode says so, loudly, when the save has no deck', () => {
        const resolved = resolveDeck({ ...createDraft(), deckMode: 'saved' }, makeSave());
        expect(resolved.cards).toEqual([]);
        expect(resolved.issues[0]).toContain('DeckTerminal');
    });

    it('loaded mode carries a file deck through untouched', () => {
        const resolved = resolveDeck(
            { ...createDraft(), deckMode: 'loaded', loadedDeck: ['a', 'b', 'a'] },
            makeSave(),
        );
        expect(resolved.cards).toEqual(['a', 'b', 'a']);
    });
});

describe('toComposedSetup', () => {
    it('omits optional fields that are unset rather than writing nulls', () => {
        const setup = toComposedSetup(playableDraft(), makeSave());
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
            gauntlet: {
                type: 'Gym',
                element: 'Fire',
                currentBattleIndex: 1,
                totalBattles: 3,
                persistedStats: {},
            },
        };
        draft.party[0] = {
            ...draft.party[0],
            currentHp: 12,
            statusEffects: [{ id: 'burn_0', type: 'Burn', stacks: 2 }],
        };
        draft.enemies[0] = { ...draft.enemies[0], maxHpOverride: 500, deck: ['ignite'] };

        const setup = toComposedSetup(draft, makeSave());

        expect(setup.player.party[0].currentHp).toBe(12);
        expect(setup.player.party[0].statusEffects).toHaveLength(1);
        expect(setup.player.relics).toEqual(['expansion_slot']);
        expect(setup.enemies[0].maxHpOverride).toBe(500);
        expect(setup.enemies[0].deck).toEqual(['ignite']);
        expect(setup.gauntlet?.totalBattles).toBe(3);
    });

    it('shows a placeholder seed while the field is blank, and honours an override', () => {
        const draft = { ...playableDraft(), seed: '' };
        expect(toComposedSetup(draft, makeSave()).seed).toBe(UNROLLED_SEED);
        expect(toComposedSetup(draft, makeSave(), 'pinned').seed).toBe('pinned');
    });

    it('round-trips a loaded setup without rewriting it', () => {
        const original = toComposedSetup(
            {
                ...playableDraft(),
                relics: ['heatsink'],
                enemies: [{ ...createEnemyUnit(), deck: ['ignite', 'scorch'], maxHpOverride: 90 }],
            },
            makeSave(),
        );

        const rehydrated = toComposedSetup(draftFromSetup(original, 'reloaded'), makeSave());

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
        const setup = toComposedSetup(draft, makeSave());

        const saved = saveScenario({ kind: 'composed', name: draft.name, setup });
        expect(saved.success).toBe(true);

        const loaded = loadScenario(saved.json!);
        expect(loaded.scenario?.kind).toBe('composed');
        // Saved and loaded in the same process against the same registries, so no drift.
        expect(loaded.registryHashMismatch).toBe(false);

        const reloaded = loaded.scenario as ComposedScenario;
        expect(toComposedSetup(draftFromSetup(reloaded.setup, reloaded.name), makeSave())).toEqual(setup);
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
        const setup = toComposedSetup(playableDraft(), makeSave());

        const result = launchScenario(setup, store.dispatch);

        expect(result.ok).toBe(true);
        expect(result.seed).toBe('seed-fixed');

        const battle = store.getState().battle.battle;
        expect(battle).not.toBeNull();
        expect(battle!.seed).toBeTruthy();
        expect(battle!.playerParty.map((e) => e.definitionId)).toEqual(['fenrir']);
        expect(battle!.enemyParty.map((e) => e.definitionId)).toEqual(['draugr']);
        expect(battle!.playerParty[0].level).toBe(12);
        // Base decks came through: 10 cards, dealt into hand + drawpile.
        expect(battle!.playerDeck.drawpile.length + battle!.playerDeck.hand.length).toBe(10);
        expect(battle!.enemyMode).toBe('MOVES');
    });

    it('rolls a seed when the field was blank and reports the one it used', () => {
        const store = makeStore();
        const setup = toComposedSetup({ ...playableDraft(), seed: '' }, makeSave());

        const result = launchScenario(setup, store.dispatch);

        expect(result.ok).toBe(true);
        expect(result.seed).not.toBe(UNROLLED_SEED);
        expect(result.seed).toBeTruthy();
        expect(store.getState().battle.battle!.sessionId).toBe(`battle_${result.seed}`);
    });

    it('is deterministic: same setup, same seed, same state', () => {
        const setup = toComposedSetup(playableDraft(), makeSave());
        const a = makeStore();
        const b = makeStore();

        launchScenario(setup, a.dispatch);
        launchScenario(setup, b.dispatch);

        expect(a.getState().battle.battle).toEqual(b.getState().battle.battle);
    });

    it('reports the materializer error and dispatches nothing when the setup is unplayable', () => {
        const store = makeStore();
        const setup = toComposedSetup({ ...playableDraft(), enemies: [] }, makeSave());

        const result = launchScenario(setup, store.dispatch);

        expect(result.ok).toBe(false);
        expect(result.error).toContain('no enemies');
        expect(store.getState().battle.battle).toBeNull();
    });
});
