/**
 * Launcher composition — the headless half of `panels/ScenarioLauncherPanel.tsx`.
 *
 * Specified by `docs/wayfinder/debug-toolkit/tickets/23-scenario-launcher-panel.md`, whose
 * visual spec is `prototypes/04-scenario-launcher.html`.
 *
 * The split follows `snapshotIO` / `saveSlots`: everything that can be decided without React
 * lives here — the editable draft, the registry option lists, the draft -> `ComposedSetup`
 * projection, the deck resolution, the warnings — and the panel is left holding controls and
 * `useState`. That is what makes the compose -> `buildScenarioState` -> `dispatch` path
 * testable in a `node` environment, since the repo has no `@testing-library/react` and panel
 * tests can only render static markup.
 *
 * WHY A DRAFT TYPE INSTEAD OF EDITING A `ComposedSetup` DIRECTLY
 *
 * `ComposedSetup` is the on-disk shape and is deliberately lossy about intent: it holds a
 * flat `player.deck` card list, so it cannot say "these cards came from the party's base
 * decks, recompute them when I change species". `LauncherDraft` keeps that intent (`deckMode`)
 * plus pure-UI state (`expanded`), and `toComposedSetup` throws it away on the way out.
 *
 * AD-HOC DECK MODE IS CUT (ticket 23, "Changes from the approved prototype"). Deck modes are
 * base decks and the saved deck only. `'loaded'` is not a third authoring mode — it is the
 * read-only carrier for a deck that came in from a `.scenario.json`, so loading a file and
 * saving it straight back does not silently rewrite its deck. Nothing in the UI adds cards to
 * it; picking either real mode discards it.
 *
 * Nothing outside `src/debug/` may import this module.
 */

import { MingmingRegistry, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { RelicRegistry } from '../../engine/data/relicRegistry';
import { getActiveSlotId, listSlots } from '../../engine/SaveSlots';
import { SeedStream, rollSeed } from '../../engine/core/SeedStream';
import { createOwnedProgram } from '../../engine/gameTypes';
import type { IOwnedProgram, IPlayerSave } from '../../engine/gameTypes';
import type {
    EnemyCombatMode,
    IBattleEntity,
    IBattleState,
    IMingmingState,
    IMove,
    StatusEffectInstance,
    StatusType,
} from '../../engine/types';
import { setBattleState } from '../../ui/store/battleSlice';
import { loadSave } from '../../ui/store/gameSlice';
import { prepareEdit, type SaveEditAction } from '../saveEdit';
import { buildScenarioState } from './buildScenarioState';
import type {
    ComposedSetup,
    EnemySetup,
    GauntletContext,
    PartyMemberSetup,
} from './scenarioSchema';

/** Mirrors `PlayerSaveSchema.activeParty` / `ComposedSetupSchema.player.party`. */
export const MAX_PARTY = 3;

/** `base` = each unit's species deck, `saved` = the save's deck, `loaded` = came from a file. */
export type DeckMode = 'base' | 'saved' | 'loaded';

/**
 * One editable combat unit. Player members ignore `maxHpOverride` / `deck`; the shared type
 * keeps the unit editor a single component in the panel, exactly as the prototype had it.
 */
export interface LauncherUnit {
    definitionId: string;
    attackIV: number;
    defenseIV: number;
    hpIV: number;
    activeOS: string;
    /** null = full HP at build time (the schema field is simply omitted). */
    currentHp: number | null;
    statusEffects: StatusEffectInstance[];
    /** Enemies only. null = derived from stats. */
    maxHpOverride: number | null;
    /** Enemies only. */
    deck: string[];
    /**
     * Carried through from a loaded file and never edited here — the launcher has no
     * moveset editor, and dropping the field would rewrite a scenario on load/save.
     */
    moves?: IMove[];
    /** Pure UI: whether the `▸ more` disclosure is open. */
    expanded: boolean;
}

export interface LauncherDraft {
    /** Blank means "roll one at launch"; `⟳ Roll` pins a value here. */
    seed: string;
    enemyMode: EnemyCombatMode;
    party: LauncherUnit[];
    enemies: LauncherUnit[];
    deckMode: DeckMode;
    /** Only read when `deckMode === 'loaded'`. */
    loadedDeck: string[];
    relics: string[];
    gauntlet: GauntletContext | null;
    /** Envelope `name` for save-to-file. */
    name: string;
}

// --- Registry-backed option lists --------------------------------------------
//
// Read straight off the live registries. The prototype's hardcoded arrays were
// placeholders (ticket 23: "Real pickers off the live registries").

export interface SpeciesOption {
    id: string;
    name: string;
    element: string;
}

export function speciesOptions(): SpeciesOption[] {
    return Object.values(MingmingRegistry).map((definition) => ({
        id: definition.id,
        name: definition.name,
        element: definition.primaryElement,
    }));
}

/** `availableOS` for a species, or `[]` when the id is not in the registry. */
export function osOptions(definitionId: string): string[] {
    return MingmingRegistry[definitionId]?.availableOS ?? [];
}

/** Every card id in the program registry, sorted — the same list the save editor grants from. */
export function cardOptions(): string[] {
    return Object.keys(ProgramRegistry).sort();
}

export function relicOptions(): Array<{ id: string; name: string; description: string }> {
    return Object.values(RelicRegistry).map((relic) => ({
        id: relic.id,
        name: relic.name,
        description: relic.description,
    }));
}

// --- Draft construction ------------------------------------------------------

const DEFAULT_PLAYER_SPECIES = 'fenrir';
const DEFAULT_ENEMY_SPECIES = 'draugr';

function firstSpeciesId(preferred: string): string {
    return MingmingRegistry[preferred] ? preferred : (Object.keys(MingmingRegistry)[0] ?? preferred);
}

/**
 * A unit with perfect IVs and the species' first OS.
 *
 * 31s rather than rolled IVs because a scenario is an experiment: an unpinned variable that
 * changes between two launches is the thing `ComposedSetup` exists to remove.
 */
export function createUnit(definitionId: string): LauncherUnit {
    return {
        definitionId,
        attackIV: 31,
        defenseIV: 31,
        hpIV: 31,
        activeOS: osOptions(definitionId)[0] ?? '',
        currentHp: null,
        statusEffects: [],
        maxHpOverride: null,
        deck: [],
        expanded: false,
    };
}

export function createPlayerUnit(): LauncherUnit {
    return createUnit(firstSpeciesId(DEFAULT_PLAYER_SPECIES));
}

export function createEnemyUnit(): LauncherUnit {
    return createUnit(firstSpeciesId(DEFAULT_ENEMY_SPECIES));
}

export function createDraft(): LauncherDraft {
    return {
        seed: '',
        enemyMode: 'MOVES',
        party: [],
        enemies: [],
        deckMode: 'base',
        loadedDeck: [],
        relics: [],
        gauntlet: null,
        name: 'scratch scenario',
    };
}

/** Changing species invalidates the OS: `fenrir_v2` is not a legal OS for a kraken. */
export function applySpecies(unit: LauncherUnit, definitionId: string): LauncherUnit {
    return { ...unit, definitionId, activeOS: osOptions(definitionId)[0] ?? '' };
}

// --- Presets -----------------------------------------------------------------

/**
 * `Mirror my save party` — the primary player-column action (ticket 04's resolution: "the
 * default way to start, not a convenience tucked away").
 *
 * Reads `activeParty` and falls back to the head of the roster, matching what the real
 * battle path puts on the field. Levels, IVs and `activeOS` are copied verbatim, so the
 * mirrored party is the run's actual party and not an idealized one.
 */
export function mirrorSaveParty(save: IPlayerSave): LauncherUnit[] {
    const byId = new Map(save.roster.map((member) => [member.id, member]));
    const chosen = save.activeParty
        .map((id) => byId.get(id))
        .filter((member): member is NonNullable<typeof member> => member !== undefined);
    const source = (chosen.length > 0 ? chosen : save.roster).slice(0, MAX_PARTY);

    return source.map((member) => ({
        ...createUnit(member.definitionId),
        attackIV: member.attackIV,
        defenseIV: member.defenseIV,
        hpIV: member.hpIV,
        activeOS: member.activeOS ?? osOptions(member.definitionId)[0] ?? '',
    }));
}

// --- Deck resolution ---------------------------------------------------------

export interface SavedDeck {
    name: string;
    /** Program *data* ids, already resolved out of `cardInventory`. */
    cards: string[];
    /** Instance ids in the deck that are not in `cardInventory` — dropped from `cards`. */
    missing: number;
}

/**
 * The save's deck, resolved instance-id -> dataId exactly as `createBattleState` does
 * (`battleFactories.ts:264-271`).
 *
 * `IPlayerSave` holds a single `activeDeck`, not a library of named decks, so "saved deck"
 * is a one-entry list. `DeckTerminal` is where its contents come from; the launcher only
 * reads it.
 */
export function savedDeck(save: IPlayerSave): SavedDeck | null {
    const deck = save.activeDeck;
    if (!deck) return null;

    const inventory = new Map(save.cardInventory.map((card) => [card.instanceId, card.dataId]));
    const cards: string[] = [];
    let missing = 0;
    for (const instanceId of deck.cards) {
        const dataId = inventory.get(instanceId);
        if (dataId === undefined) missing += 1;
        else cards.push(dataId);
    }

    return { name: deck.name, cards, missing };
}

/** Union of the party's per-OS starting decks — one shared pool, per schema v1 (ticket 13). */
export function baseDeckFor(party: LauncherUnit[]): string[] {
    return party.flatMap((unit) => getDeckForOS(unit.definitionId, unit.activeOS));
}

export interface ResolvedDeck {
    cards: string[];
    /** One line for the UI: where these cards came from. */
    source: string;
    /** Non-fatal problems worth showing before launch. */
    issues: string[];
}

export function resolveDeck(draft: LauncherDraft, save: IPlayerSave | null): ResolvedDeck {
    if (draft.deckMode === 'loaded') {
        return {
            cards: [...draft.loadedDeck],
            source: `loaded from file — ${draft.loadedDeck.length} cards, verbatim`,
            issues: [],
        };
    }

    if (draft.deckMode === 'saved') {
        const deck = save ? savedDeck(save) : null;
        if (!deck) {
            return {
                cards: [],
                source: 'saved deck — none in the active save',
                issues: [
                    'The active save has no deck. Build one in DeckTerminal, or switch to base decks.',
                ],
            };
        }
        return {
            cards: deck.cards,
            source: `saved deck "${deck.name}" — ${deck.cards.length} cards`,
            issues:
                deck.missing > 0
                    ? [
                          `${deck.missing} card(s) in "${deck.name}" are not in cardInventory and were dropped.`,
                      ]
                    : [],
        };
    }

    const cards = baseDeckFor(draft.party);
    return {
        cards,
        source: `base decks — ${cards.length} cards from ${draft.party.length} unit(s)`,
        issues:
            draft.party.length > 0 && cards.length === 0
                ? ['No base-deck cards resolved — check the species ids.']
                : [],
    };
}

// --- Draft -> ComposedSetup --------------------------------------------------

function toMemberSetup(unit: LauncherUnit): PartyMemberSetup {
    return {
        definitionId: unit.definitionId,
        attackIV: unit.attackIV,
        defenseIV: unit.defenseIV,
        hpIV: unit.hpIV,
        ...(unit.activeOS !== '' ? { activeOS: unit.activeOS } : {}),
        ...(unit.currentHp !== null ? { currentHp: unit.currentHp } : {}),
        ...(unit.statusEffects.length > 0 ? { statusEffects: unit.statusEffects } : {}),
        ...(unit.moves !== undefined ? { moves: unit.moves } : {}),
    };
}

function toEnemySetup(unit: LauncherUnit): EnemySetup {
    return {
        ...toMemberSetup(unit),
        ...(unit.maxHpOverride !== null ? { maxHpOverride: unit.maxHpOverride } : {}),
        ...(unit.deck.length > 0 ? { deck: [...unit.deck] } : {}),
    };
}

/** The placeholder shown in the JSON column while the seed field is blank. */
export const UNROLLED_SEED = '‹rolled on launch›';

/**
 * Project the draft onto the on-disk shape.
 *
 * `seedOverride` is how launch pins a rolled seed without mutating the draft first: the
 * preview shows `UNROLLED_SEED`, and the launch path passes the value it actually rolled so
 * the state, the JSON and the saved file all agree.
 */
export function toComposedSetup(
    draft: LauncherDraft,
    save: IPlayerSave | null,
    seedOverride?: string,
): ComposedSetup {
    return {
        seed: seedOverride ?? (draft.seed.trim() || UNROLLED_SEED),
        enemyMode: draft.enemyMode,
        player: {
            party: draft.party.map(toMemberSetup),
            deck: resolveDeck(draft, save).cards,
            relics: [...draft.relics],
        },
        enemies: draft.enemies.map(toEnemySetup),
        ...(draft.gauntlet ? { gauntlet: draft.gauntlet } : {}),
    };
}

/** Hydrate the editor from a loaded `composed` scenario, losing nothing the schema carries. */
export function draftFromSetup(setup: ComposedSetup, name: string): LauncherDraft {
    const toUnit = (member: PartyMemberSetup | EnemySetup): LauncherUnit => ({
        definitionId: member.definitionId,
        attackIV: member.attackIV,
        defenseIV: member.defenseIV,
        hpIV: member.hpIV,
        activeOS: member.activeOS ?? osOptions(member.definitionId)[0] ?? '',
        currentHp: member.currentHp ?? null,
        statusEffects: member.statusEffects ? [...member.statusEffects] : [],
        maxHpOverride: (member as EnemySetup).maxHpOverride ?? null,
        deck: [...((member as EnemySetup).deck ?? [])],
        ...(member.moves ? { moves: [...member.moves] } : {}),
        expanded: false,
    });

    return {
        seed: setup.seed === UNROLLED_SEED ? '' : setup.seed,
        enemyMode: setup.enemyMode,
        party: setup.player.party.map(toUnit),
        enemies: setup.enemies.map(toUnit),
        deckMode: 'loaded',
        loadedDeck: [...setup.player.deck],
        relics: [...setup.player.relics],
        gauntlet: setup.gauntlet ?? null,
        name,
    };
}

// --- Warnings ----------------------------------------------------------------

/**
 * The CARDS-mode failure fixed in `cf7ad48`: an enemy in CARDS mode with no deck has
 * literally nothing to play, and the battle stalls rather than erroring.
 */
export function cardsModeWarning(draft: LauncherDraft): string | null {
    if (draft.enemyMode !== 'CARDS' || draft.enemies.length === 0) return null;
    const deckless = draft.enemies.filter((enemy) => enemy.deck.length === 0).length;
    if (deckless === 0) return null;
    return (
        `CARDS mode: ${deckless} of ${draft.enemies.length} enemies have no deck. ` +
        'A CARDS enemy with an empty deck has nothing to play — give each one cards under ▸ more, ' +
        'or switch the enemy mode back to MOVES.'
    );
}

/** Reasons `buildScenarioState` would throw. Empty means launch is safe to attempt. */
export function launchBlockers(draft: LauncherDraft): string[] {
    const blockers: string[] = [];
    if (draft.party.length === 0) blockers.push('No player party members — add at least one unit.');
    if (draft.enemies.length === 0) blockers.push('No enemies — add at least one.');
    return blockers;
}

// --- Destination slot --------------------------------------------------------

export interface DestinationSlot {
    id: string;
    name: string;
    /** One plain-words line naming the save this battle will write into. */
    headline: string;
}

/**
 * Which save a battle launched from here will write into when it ends.
 *
 * THIS IS THE SAFETY AFFORDANCE, NOT DECORATION. Injecting a battle is harmless; *ending*
 * one is not. `BattleArena` dispatches `syncPartyStats`, `applyRewardBundle` and `addRelic`
 * into `gameSlice` on the way out, and `src/ui/store/store.ts` autosaves every game-state
 * change into the active slot. `syncPartyStats` matches roster members by id, and
 * `Mirror my save party` reuses the real party's species and levels — so a scenario composed
 * while the real save is active can hand a fabricated level to a real mingming with no undo.
 *
 * Reads storage at call time (localStorage is not reactive), so switching slots in the Slots
 * panel and coming back shows the new one.
 */
export function destinationSlot(): DestinationSlot {
    const id = getActiveSlotId();
    const name = listSlots().find((slot) => slot.id === id)?.name ?? id;
    return {
        id,
        name,
        headline: `This battle will end into your "${name}" save (${id}).`,
    };
}

// --- Seeding an empty slot ---------------------------------------------------

/**
 * WHY A SCENARIO SEEDS THE SLOT IT LAUNCHES INTO
 *
 * A fresh slot starts from `createDefaultSave()`, whose `roster` is `[]`. Ending a scenario
 * battle there returns to `App.tsx`, which falls through to `MainMenuView` — the starter
 * picker — and that view renders no nav bar, so the docked Debug tab is unreachable until the
 * slot has a roster. Worse, `syncPartyStats` had nothing to write into: the battle's XP and
 * levels went nowhere.
 *
 * Seeding the empty slot from the battle turns the scratch slot into a real, continuable save:
 * finish the battle, land in the hub with those mingmings, launch the next one.
 *
 * THE IDS MUST BE THE BATTLE'S IDS. `gameSlice`'s `syncPartyStats` (`gameSlice.ts:245`)
 * matches roster members to battle entities *by id*, and `buildScenarioState` mints entity
 * ids off its own `SeedStream`. A roster seeded from `ComposedSetup` instead — which carries
 * no ids at all — would look right and silently drop every level and XP gain on the way out.
 * So the roster is derived from the materialized `playerParty` and nothing else.
 */

/**
 * Roster projection of a battle entity.
 *
 * `IBattleEntity extends IMingmingState`, so the persistent fields are already there; this
 * picks exactly them and drops the derived/transient combat half (maxHp, currentHp, energy,
 * statuses, daemons, intents), none of which the save is allowed to carry.
 */
function toRosterMember(entity: IBattleEntity): IMingmingState {
    return {
        id: entity.id,
        definitionId: entity.definitionId,
        blueprintsCollected: entity.blueprintsCollected,
        attackIV: entity.attackIV,
        defenseIV: entity.defenseIV,
        hpIV: entity.hpIV,
        ...(entity.nickname !== undefined ? { nickname: entity.nickname } : {}),
        ...(entity.activeOS !== undefined ? { activeOS: entity.activeOS } : {}),
    };
}

/** Id and name the seeded deck is written under, so a hub-side deck is recognisable as ours. */
export const SEEDED_DECK_ID = 'scenario-seeded-deck';
export const SEEDED_DECK_NAME = 'Scenario Deck';

/**
 * The save a scratch slot should hold once this battle exists in it. Pure — computes, does
 * not dispatch, and is validated before anything is dispatched (see `launchScenario`).
 *
 * `roster` / `activeParty` come from `state.playerParty` (ids included, see above).
 *
 * The deck comes from `setup.player.deck`, which is *dataIds* — the output of `resolveDeck`.
 * `IPlayerSave` stores a deck as `activeDeck.cards`, a list of `cardInventory` *instance*
 * ids (`gameTypes.ts:20-24`), and `createBattleState` resolves one to the other exactly the
 * way `savedDeck` above does (`battleFactories.ts:264-271`). So each dataId is minted into a
 * fresh `IOwnedProgram` and the deck references those instance ids; anything else produces an
 * `activeDeck` whose entries resolve to nothing and a next battle with no cards.
 *
 * Instance ids are minted off a `SeedStream` seeded with the scenario seed rather than
 * `crypto.randomUUID()`, keeping the whole launch path deterministic.
 *
 * Non-destructive where it can be: existing inventory is appended to rather than replaced,
 * relics are unioned, and an existing `activeDeck` is only replaced when the scenario actually
 * resolved cards. `baseDecksGranted` is deliberately left alone — the scenario deck is not the
 * species grant, and claiming it was would silently rob a later real synthesis of its base deck.
 */
export function seedSaveFromBattle(
    save: IPlayerSave,
    setup: ComposedSetup,
    state: IBattleState,
): IPlayerSave {
    const rng = new SeedStream(setup.seed);
    const roster = state.playerParty.map(toRosterMember);
    const granted: IOwnedProgram[] = setup.player.deck.map((dataId) => createOwnedProgram(dataId, rng));

    return {
        ...save,
        roster,
        // `PlayerSaveSchema.activeParty` is capped at 3; a scenario file could carry more.
        activeParty: roster.slice(0, MAX_PARTY).map((member) => member.id),
        cardInventory: [...save.cardInventory, ...granted],
        activeDeck:
            granted.length > 0
                ? {
                      id: SEEDED_DECK_ID,
                      name: SEEDED_DECK_NAME,
                      cards: granted.map((card) => card.instanceId),
                  }
                : save.activeDeck,
        relics: [...new Set([...save.relics, ...setup.player.relics])],
    };
}

// --- Launch ------------------------------------------------------------------

export interface LaunchResult {
    ok: boolean;
    /** The seed the battle actually ran with — the rolled one when the field was blank. */
    seed?: string;
    state?: IBattleState;
    error?: string;
    /** True when an empty active save was seeded from this battle's party and deck. */
    seeded?: boolean;
    /**
     * Why the seed was refused. The battle still launched: an unseeded battle is merely
     * inconvenient, a schema-invalid save wedges every autosave from that point on.
     */
    seedIssues?: ReadonlyArray<string>;
}

/**
 * Anything that accepts `setBattleState` *and* the `gameSlice` action that seeds the save.
 * `store.dispatch` satisfies it. Widened rather than cast at the call site: seeding really
 * does dispatch a second, different action, and hiding that behind an `as` would make the
 * one place that writes a save from here invisible in the type.
 */
export type LaunchDispatch = (action: ReturnType<typeof setBattleState> | SaveEditAction) => void;

/**
 * Materialize a setup and inject it: `dispatch(setBattleState(buildScenarioState(setup)))`.
 *
 * `dispatch` is a parameter rather than a hook call — same shape as `saveSlots.ts` — so the
 * whole compose -> build -> dispatch path is exercisable headlessly.
 *
 * A blank seed is rolled here, once, and reported back so the panel can pin it in the field:
 * a scenario you cannot re-run with the same seed is not a repro.
 *
 * `save` is the *active slot's* save. Pass it to get the empty-slot seeding described above;
 * omit it (or pass null) and this is launch and nothing else. Seeding happens only when
 * `save.roster` is empty — a slot branched from a real run with `Copy current save` keeps its
 * own roster, untouched. That conditional is the entire safety property here.
 *
 * The seed is dispatched *before* the battle, and only after `prepareEdit` has validated the
 * prospective save against `PlayerSaveSchema` without dispatching (`saveEdit.ts`, audit gap
 * #18: a schema-invalid save fails the autosave with nothing but a `console.error`). Same
 * ordering discipline as `switchToSlot`: get the save into its final shape while no battle
 * exists that could end into it.
 */
export function launchScenario(
    setup: ComposedSetup,
    dispatch: LaunchDispatch,
    save?: IPlayerSave | null,
): LaunchResult {
    const seed = setup.seed === UNROLLED_SEED || setup.seed.trim() === '' ? rollSeed() : setup.seed;
    const resolved: ComposedSetup = { ...setup, seed };

    let state: IBattleState;
    try {
        state = buildScenarioState(resolved);
    } catch (err) {
        return { ok: false, error: String(err) };
    }

    let seeded = false;
    let seedIssues: ReadonlyArray<string> | undefined;

    if (save && save.roster.length === 0) {
        const prepared = prepareEdit(save, loadSave(seedSaveFromBattle(save, resolved, state)));
        if (prepared.ok) {
            dispatch(prepared.action);
            seeded = true;
        } else {
            seedIssues = prepared.issues;
            // The panel says so too, but the panel closes on launch — and this is exactly the
            // class of failure that otherwise only ever shows up as lost progress.
            console.warn(
                '[launchScenario] Refused to seed the empty save — it would not pass ' +
                    `PlayerSaveSchema:\n${prepared.issues.join('\n')}`,
            );
        }
    }

    dispatch(setBattleState(state));
    return { ok: true, seed, state, seeded, ...(seedIssues ? { seedIssues } : {}) };
}

// --- Misc helpers the panel needs but should not own -------------------------

/** A status instance with a stable, seed-free id — statuses are authored, not rolled. */
export function makeStatus(type: StatusType, stacks: number, index: number): StatusEffectInstance {
    return { id: `${type.toLowerCase()}_${index}`, type, stacks };
}

/** Display name for a species id, falling back to the id so an unknown one stays visible. */
export function speciesName(definitionId: string): string {
    return MingmingRegistry[definitionId]?.name ?? definitionId;
}
