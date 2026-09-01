
export type Element = 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Ice' | 'Light' | 'Dark' | 'None';
export const ELEMENTS: Element[] = ['Fire', 'Water', 'Earth', 'Air', 'Nature', 'Ice', 'Light', 'Dark', 'None'];

export type TargetType = 'Single' | 'Self' | 'Side' | 'All';
export const TARGET_TYPES: TargetType[] = ['Single', 'Self', 'Side', 'All'];

export type ProgramCategory = 'Attack' | 'Skill' | 'Daemon' | 'Status' | 'Heal';
export const PROGRAM_CATEGORIES: ProgramCategory[] = ['Attack', 'Skill', 'Daemon', 'Status', 'Heal'];

export type TurnPhase = 'PRE_TURN' | 'ACTION' | 'POST_TURN';

/** How the enemy side fights — set once at battle creation. */
export type EnemyCombatMode = 'MOVES' | 'CARDS';

export const StatusType = {
  Burn: 'Burn',
  Poison: 'Poison',
  Asleep: 'Asleep',
  Weakened: 'Weakened',
  Strengthened: 'Strengthened',
  Dazed: 'Dazed',
  Sharp: 'Sharp',
  Stunned: 'Stunned',
  Regen: 'Regen',
  Energized: 'Energized',
  StableOS: 'StableOS',
  BarkShield: 'BarkShield',
  DarkStance: 'DarkStance',
  LightStance: 'LightStance'
} as const;
export const Statuses: StatusType[] = Object.values(StatusType);

export type StatusType = typeof StatusType[keyof typeof StatusType];

export interface StatusEffectInstance {
  readonly id: string;
  readonly type: StatusType;
  readonly stacks: number;
}


export const ProgramConstraintType = {
  HasStatus: 'HAS_STATUS',
  NotStatus: 'NOT_STATUS',
  HealthThreshold: 'HEALTH_THRESHOLD',
  Base: 'BASE',
  CardsDrawn: 'CARDS_DRAWN',
  /**
   * Ticket 68: draws CAUSED BY AN EFFECT this turn - a card, an OS or a daemon - excluding
   * the draw-phase refill.
   *
   * `CARDS_DRAWN` above counts every draw including the natural one, which makes any
   * condition built on it true on ~91% of turns for every species (HANDOFF 0-DRAW-COUNTER).
   * That is not what "if you drew a card this turn" was ever meant to reward.
   */
  CardsDrawnTriggered: 'CARDS_DRAWN_TRIGGERED'
} as const;

export type ProgramConstraintType = typeof ProgramConstraintType[keyof typeof ProgramConstraintType];

export interface ProgramConstraint {
  readonly id?: string;
  readonly type: ProgramConstraintType;
  readonly target: 'SELF' | 'TARGET';
  readonly value: string | number;
  /** Ticket 39: HAS_STATUS only - require at least this many stacks, not merely presence. */
  readonly minStacks?: number;
  readonly error?: string; // Validation error
}

// --- MingMing Definitions (Nested Immutable Pattern) ---

/**
 * Static Data: Loaded from JSON/ScriptableObject. Read-only.
 */
export interface IMingmingDefinition {
  readonly id: string;
  readonly name: string;
  readonly baseStats: {
    readonly hp: number;
    readonly attack: number;
    readonly defense: number;
    readonly energy: number; // Base energy
  };
  readonly primaryElement: Element;
  readonly secondaryElement?: Element;
  readonly cardDraw: number; // Base contribution
  readonly availableOS: string[]; // IDs of OS variants
  /**
   * Ticket 13: per-OS starting decks (8-12 cards each per the deck template),
   * keyed by firmware id — one entry per availableOS. Resolve through
   * `getDeckForOS(definitionId, osId)` rather than indexing directly.
   */
  readonly decks: Record<string, string[]>;
  /**
   * Ticket 09: which five cards of a species' deck a run actually STARTS with,
   * keyed by firmware id exactly as `decks` is.
   *
   * Ticket 08 ruled that a run does not hand the player the whole tuned deck. A member
   * joins with 5 `startKit` cards plus 3 generics; a recruit joins with 3 plus 1. The
   * tuned deck stays the design target the run builds back toward, so these tags name
   * WHICH five of it survive the cut rather than describing a separate list — every id
   * here must appear in that same species+OS `decks` entry, copy counts included.
   *
   * Optional because only the six launch species (`LAUNCH_SPECIES`) are tagged today;
   * the other ten get their tags when their decks ship.
   */
  readonly startKits?: Record<string, ReadonlyArray<string>>;
  readonly moves?: ReadonlyArray<IMove>; // Signature moves for this entity (especially bosses/enemies)
  readonly artReference?: string;
  /**
   * Ticket 42: a measuring instrument rather than a playable Mingming (the balance control).
   * It lives in the registry because the balance harness resolves units and decks through it,
   * but it must never reach a player: excluded from wild encounters, from the playable roster
   * count, and from the mirror/§2.3 suites. Use `PLAYABLE_SPECIES` to enumerate the roster.
   */
  readonly isControl?: boolean;
}

/**
 * Persistent Instance: The unit in the player's save file.
 */
export interface IMingmingState {
  id: string; // instance ID
  definitionId: string; // architecture name (e.g. 'fenrir')
  nickname?: string;
  activeOS?: string;
  blueprintsCollected: number; // For OS swapping
  attackIV: number;
  defenseIV: number;
  hpIV: number;
}

// --- System Deemons / Relics ---

export interface IRelic {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effect: string; // Internal ID for logic
}

/**
 * Volatile Combat State: Existing only during battle.
 */
export interface IBattleEntity extends IMingmingState {
  // Derived Stats (Calculated at start of battle from Definition + Level)
  readonly name: string;
  readonly maxHp: number;
  readonly cardDraw: number;
  readonly maxEnergy: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number; // Derived from something? Or base?

  // Element caching for combat
  readonly primaryElement: Element;
  readonly secondaryElement?: Element;

  // Transient State (Mutable via Redux/Zustand, but defined as readonly here to enforce immutable updates)
  readonly currentHp: number;
  readonly currentEnergy: number;
  readonly tempHp: number; // Shields
  readonly relicBonuses?: { draw: number; energy: number; attackMod: number };
  readonly statusEffects: ReadonlyArray<StatusEffectInstance>;
  readonly hooks?: ReadonlyArray<string>; // IDs of active hooks (Relics, Passives)
  readonly activeOS?: string; // Current Operating System ID
  readonly daemons: ReadonlyArray<ProgramEntity>; // Persistent "installed" software
  readonly currentIntent?: IMove | null; // The planned move for the next turn (primarily for enemies)
  readonly artReference?: string;
  readonly forcedTargetId?: string; // ID of the entity this unit is forced to target (Taunt)
  readonly nextProgramModifier?: { multiplier?: number; flatBonus?: number; costReduction?: number; powerBonus?: number; appliesTo?: ProgramCategory }; // Buffs the next card played (appliesTo restricts it to that category; non-matching cards don't consume it). `powerBonus` (ticket 52) hits only the FIRST ATTACK action, where `flatBonus` hits every power/stacks/heal field.
  readonly playsThisTurn?: number; // Cards played by THIS unit this turn (enforces per-unit OS limits like GLACIAL_PACE_OS)
  /**
   * Cards a card, OS or daemon drew THIS UNIT this turn — the draw-phase refill excluded.
   *
   * The per-unit twin of `state.nonNaturalCardsDrawnThisTurn`, and the number `CARDS_DRAWN_TRIGGERED`
   * reads since Henry's 2026-08-30 ruling. See `ActionExecutors.getScalingValue` for what the
   * side-wide counter was worth and why it was the wrong one.
   */
  readonly nonNaturalDrawsThisTurn?: number;
  readonly moves?: ReadonlyArray<IMove>; // Custom moveset for this instance
}

// --- Transformation Logic ---

/**
 * THE CALIBRATION LEVEL — ticket 21 (steam-release map), from `vision.md`:
 * *"LEVELING REMOVED. The engine freezes at the level-15 calibration point. No XP, no grind —
 * progression IS acquisition (species, OS, cards, rolls). Difficulty = enemy team design, never
 * stat inflation."*
 *
 * 15 is not arbitrary and is not new: it is `BALANCE_LEVEL` in `debug/balance/balanceScenarios.ts`,
 * the level every row of the balance corpus has always been computed at ("low enough that base
 * decks are still what a unit is fighting with, high enough that the stat curve is out of its
 * early-level noise"). Freezing here is what makes the entire existing balance corpus become the
 * shipped game's numbers permanently, rather than one sample of a moving curve.
 *
 * This constant is the ONLY survivor of the level system. Nothing reads a per-entity level any
 * more, because no entity has one.
 */
export const CALIBRATION_LEVEL = 15;

/**
 * Standard stat (Attack/Defense), Unity Legacy Formula, frozen at `CALIBRATION_LEVEL`.
 *
 * The `level` parameter is GONE rather than defaulted. A default would leave a seam a future
 * caller could pass 20 into and silently re-introduce stat inflation — the exact thing
 * `vision.md` rules out ("difficulty = enemy team design, never stat inflation"). With no
 * parameter, there is nothing to pass.
 */
export function calculateStandardStat(base: number, modifier: number): number {
  return Math.floor(((2 * base) + modifier + 25) * CALIBRATION_LEVEL / 100) + 5;
}

/**
 * The damage formula's base coefficient, frozen. Was `Math.floor((2 * level) / 5) + 2`, which at
 * `CALIBRATION_LEVEL` is exactly 8. Lives here rather than in `combatUtils` so the one number the
 * whole damage curve rests on sits next to the constant it was derived from.
 */
export const CALIBRATION_LEVEL_DAMAGE_BASE = Math.floor((2 * CALIBRATION_LEVEL) / 5) + 2;

/**
 * TICKET 131b — THE FRAME BUFF. Every mingming has 50% more health.
 *
 * RULED by Henry, 2026-09-01: *"Maybe we give everyone a flat HP buff to extend games because the
 * cards played just shows that you were always leaving energy on the table which feels bad and its
 * tough to get out combos with only 3 cards and no drawing."*
 *
 * **It is applied to the FORMULA'S OUTPUT, not to `baseStats.hp`, and that is not a shortcut.**
 * `calculateHealth` is `calculateStandardStat(base, iv) + 15 + 30`, and `calculateStandardStat`
 * itself ends in `+ 5` — so a **flat +50 dominates the result** at this calibration. Fenrir's base
 * 66 produces 75 HP, of which only 25 comes from the base at all. Multiplying `baseStats.hp` by 1.5
 * would have moved 75 to 85 — a **13%** buff wearing a 50% label — and it would have widened the
 * gap between species unevenly, because the flat term does not scale with them. Multiplying the
 * output scales every frame by exactly 1.5 and leaves the roster's relative spread intact.
 *
 * MEASURED (`scratch/handeconomy.ts`, 3v3, control panel and zoo panel):
 *   turns per battle   5.2 / 4.5  ->  7.7 / 5.8
 *   cards cast a turn  5.77       ->  5.63   (unchanged - this buys TURNS, not bigger turns)
 *   energy unspent     22.9%      ->  15.5%  (a side effect, not the point; see the draw change)
 *
 * That last row is why this ships alongside `+1 cardDraw` rather than instead of it: HP buys turns
 * and does NOT fix leftover energy, extra draw fixes leftover energy and SHORTENS the game. Only
 * the two together lengthen the game *and* empty the energy pool.
 */
export const HP_MULTIPLIER = 1.5;

/** Health, Unity Legacy Formula, frozen at `CALIBRATION_LEVEL`. Same reasoning as above. */
export function calculateHealth(base: number, modifier: number): number {
  return Math.floor((calculateStandardStat(base, modifier) + CALIBRATION_LEVEL + 30) * HP_MULTIPLIER);
}

export function initializeBattleEntity(instance: IMingmingState, definition: IMingmingDefinition): IBattleEntity {
  const attackIV = instance.attackIV ?? 0;
  const defenseIV = instance.defenseIV ?? 0;
  const hpIV = instance.hpIV ?? 0;

  const finalHp = calculateHealth(definition.baseStats.hp, hpIV);

  return {
    ...instance,
    name: definition.name,
    maxHp: finalHp,
    cardDraw: definition.cardDraw,
    maxEnergy: definition.baseStats.energy,
    attack: calculateStandardStat(definition.baseStats.attack, attackIV),
    defense: calculateStandardStat(definition.baseStats.defense, defenseIV),
    speed: 10, // Placeholder for future logic

    primaryElement: definition.primaryElement,
    secondaryElement: definition.secondaryElement,

    currentHp: finalHp,
    currentEnergy: definition.baseStats.energy,
    tempHp: 0,
    statusEffects: [],
    hooks: [],
    activeOS: instance.activeOS || definition.availableOS[0], // Default to first available OS
    daemons: [],
    artReference: definition.artReference,
    relicBonuses: { draw: 0, energy: 0, attackMod: 1 }
  };
}

/**
 * The cost an X-cost card is treated as for STATIC purposes - budget audit, sorting,
 * UI grouping. 3 is the practical ceiling: a species runs 2 base Energy and at most
 * one +1 ramp (hraesvelgr's UPDRAFT_KERNEL), so an X card can never be paid more than
 * 3 Energy. The card's REAL cost in battle is always the source's current Energy.
 */
export const X_COST_STATIC_BUDGET = 3;

/** Narrows a card's baseCost to a number, mapping 'X' to X_COST_STATIC_BUDGET. */
export function numericBaseCost(baseCost: number | 'X'): number {
  return typeof baseCost === 'number' ? baseCost : X_COST_STATIC_BUDGET;
}

// --- Program (Card) Definitions (Preserving previous work) ---
export type ActionType = 'ATTACK' | 'STATUS' | 'HEAL' | 'DRAW' | 'ENERGY' | 'GENERATE_CARD' | 'CLEANSE' | 'DISCARD' | 'EXHAUST' | 'RETURN' | 'SEARCH' | 'MULTIPLY_STATUS' | 'TRIGGER_STATUS' | 'PLAY_LAST_CARD' | 'TAUNT' | 'BUFF_NEXT_PROGRAM' | 'REDIRECT_TARGET' | 'FORCE_DISCARD' | 'SHIFT_STANCE' | 'REVIVE';

export type IntentType = 'Attack' | 'Defend' | 'Debuff' | 'Buff' | 'Special' | 'Unknown';

export interface IMove {
  readonly id: string;
  readonly name: string;
  readonly intentType: IntentType;
  readonly priority: number;
  readonly actions: ReadonlyArray<ProgramAction>;
}

export interface ProgramAction {
  readonly id?: string;
  readonly type: ActionType;
  readonly conditionals?: ReadonlyArray<ProgramConstraint>;
  readonly target?: TargetType | string; // Often target is defined on Action or on Program
  readonly error?: string; // Validation error
  /*
   * THE ONE `any` TICKET 55 DID NOT REMOVE, AND THE REASON.
   *
   * This index signature is the card data model. `programs.json` is a flat structure and every
   * action variant below (`AttackActionData`, `StatusActionData`, ...) extends this interface with
   * its own fields, so the signature is what lets a `ProgramAction` be read as `action.power`,
   * `action.stacks`, `action.status` before it has been narrowed to a variant. Roughly 200 reads
   * across the engine, the AI, the balance harness and the UI go through it.
   *
   * `unknown` would be the correct type and would break every one of those reads at once. The real
   * fix is to make `ProgramAction` a discriminated union over `ActionType` and delete the signature,
   * which is a redesign of how cards are authored — **deck-archetypes' territory, not this map's**
   * (ticket 55 says so in as many words: "if step 4 turns out to need a public engine type changed,
   * that is a deck-archetypes concern... file it there and stop").
   *
   * So it is disabled here, once, with this note — rather than left to fail a gate that is now
   * blocking, or "fixed" by a rewrite nobody ruled.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [key: string]: any; // Flat structure for JSON
}

export interface AttackActionData extends ProgramAction {
  readonly type: 'ATTACK';
  readonly power: number;
  readonly element?: Element;
  readonly scalingPower?: number; // MISSING_HP: power added per 1% of maxHP missing (ticket 26)
  readonly scaling?: string | 'CARDS_PLAYED' | 'MISSING_HP' | 'STATUS_COUNT' | 'CARDS_DRAWN' | 'CARDS_DRAWN_TRIGGERED' | 'ELEMENT_PLAYED' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'DAZED_STACKS' | 'DISTINCT_STATUS' | 'ANY_STATUS' | 'BARKSHIELD_STACKS' | 'CARDS_DISCARDED' | 'ENERGY_SPENT' | 'ENERGY_SPENT_SQUARED' | 'BURN_TIMES_ENERGY' | 'STATUS_CONSUMED';
}

export interface StatusActionData extends ProgramAction {
  readonly type: 'STATUS';
  readonly status: StatusType;
  readonly stacks: number; // Negative value means remove stacks
  readonly consume?: boolean; // If true, completely removes status and returns stacks
  /** Ticket 33: multiply `stacks` by the count removed by a preceding consume action in the
   *  same card (hexbloom: "consume all Weakened, apply that many Poison"). Mirrors the
   *  STATUS_CONSUMED path that already existed for HEAL only. */
  /** Ticket 41: WEAKENED_STACKS multiplies `stacks` by the TARGET's current Weakened, without
   *  consuming it - a standing resource read, not a spend. */
  readonly scaling?: 'STATUS_CONSUMED' | 'WEAKENED_STACKS';
}

export interface HealActionData extends ProgramAction {
  readonly type: 'HEAL';
  readonly power: number;
}

/**
 * Ticket 15 — the ONE action the macro set could not express with what was already here.
 *
 * Every resolution loop in the engine skips a target at 0 HP (`battleReducer`'s action loop,
 * `handleExecuteIntent`, `resolveProgramFree`), which is correct for all 216 cards and is exactly
 * what a revive must not do. HEAL cannot be pressed into service either: a heal on a downed unit
 * would restore HP without ever being *about* the downing, and it would be reachable by accident
 * from any existing heal card the day the loop guard was relaxed.
 *
 * So this is a distinct verb, and it is a verb the engine can only apply deliberately. It is a
 * PERCENTAGE of max HP rather than a `power` figure because a revive is a rescue rather than a heal
 * curve — the caller wants "back on their feet at half", not "back on their feet at whatever the
 * calibration says 30 is worth today. Denominating it in power would also make it silently better
 * on a big frame than a small one, which is the wrong way round for a safety net.
 *
 * `economy-session.md` rules the outcome ("Gauntlet death: revivable, never gone-for-gauntlet") and
 * defers the shape; `macroRegistry.REVIVE_PERCENT_MAX_HP` carries the number and the argument.
 */
export interface ReviveActionData extends ProgramAction {
  readonly type: 'REVIVE';
  /** Percentage of the target's max HP to come back on. Clamped to 1..100 by the executor. */
  readonly percent: number;
}

export interface DrawActionData extends ProgramAction {
  readonly type: 'DRAW';
  readonly amount: number;
}

export interface EnergyActionData extends ProgramAction {
  readonly type: 'ENERGY';
  readonly amount: number;
}

export interface GenerateCardActionData extends ProgramAction {
  readonly type: 'GENERATE_CARD';
  readonly dataId: string; // ID of the ProgramData to generate
}

export interface CleanseActionData extends ProgramAction {
  readonly type: 'CLEANSE';
  readonly statusTarget?: StatusType; // If omitted, cleanses all negative status effects
}

export interface DiscardActionData extends ProgramAction {
  readonly type: 'DISCARD';
  readonly amount?: number; // Explicit pile-move size (FORCE_DISCARD / discardEffect callers)
  /**
   * Self-discard COST (ticket 21). `{ "type": "DISCARD", "count": N }` in a card's
   * action list removes N RANDOM cards from the ACTING side's own hand (the played
   * card is already out of the hand by resolution time). `count` implies isRandom
   * and self-targeting; the battleReducer deliberately does NOT read it as the
   * generic multi-hit repeat for this action type.
   */
  readonly count?: number;
  readonly isRandom?: boolean; // If true, discards randomly instead of player choice (or first N cards)
}

export interface ExhaustActionData extends ProgramAction {
  readonly type: 'EXHAUST';
  readonly amount: number;
}

export interface ReturnActionData extends ProgramAction {
  readonly type: 'RETURN';
  readonly amount: number;
  readonly sourcePile?: 'DISCARD' | 'EXHAUST'; // Default: DISCARD
  readonly destinationPile?: 'HAND' | 'DRAW'; // Default: HAND
  /** Ticket 32: optional predicate applied before the slice. */
  readonly filter?: { readonly maxCost?: number };
}

export interface SearchActionData extends ProgramAction {
  readonly type: 'SEARCH';
  readonly amount: number;
  readonly criteria?: {
    element?: Element;
    category?: ProgramCategory;
  };
}

export interface MultiplyStatusActionData extends ProgramAction {
  readonly type: 'MULTIPLY_STATUS';
  readonly status: StatusType;
  readonly factor: number;
}

export interface TriggerStatusActionData extends ProgramAction {
  readonly type: 'TRIGGER_STATUS';
  readonly status: StatusType;
}

export interface PlayLastCardActionData extends ProgramAction {
  readonly type: 'PLAY_LAST_CARD';
}

export interface TauntActionData extends ProgramAction {
  readonly type: 'TAUNT';
}

export interface BuffNextProgramActionData extends ProgramAction {
  readonly type: 'BUFF_NEXT_PROGRAM';
  readonly multiplier?: number;
  readonly flatBonus?: number;
  readonly costReduction?: number;
  /** Ticket 52: raw power added to the primed card's FIRST ATTACK action only. */
  readonly powerBonus?: number;
  readonly appliesTo?: ProgramCategory; // If set, only a card of this category consumes (and benefits from) the buff
}

export interface RedirectTargetActionData extends ProgramAction {
  readonly type: 'REDIRECT_TARGET';
  readonly newTargetId?: string;
  readonly isRandom?: boolean;
}

export interface ForceDiscardActionData extends ProgramAction {
  readonly type: 'FORCE_DISCARD';
  readonly amount: number;
  readonly isRandom?: boolean;
}

/**
 * Shifts the SOURCE of the card into a stance (Watcher model): 'Dark' grants
 * DarkStance (+30% outgoing damage), 'Light' grants LightStance (-30% damage taken).
 * Stances are mutually exclusive and cap at 1 stack; entering one removes the other.
 *
 * Ticket 36: LightStance used to grant +50% healing. It is a defensive stance now -
 * the healing multiplier moved onto hel_v2's firmware via `onHealCalculated`.
 */
export interface ShiftStanceActionData extends ProgramAction {
  readonly type: 'SHIFT_STANCE';
  readonly stance: 'Dark' | 'Light';
}

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';
export const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic'];

export interface ProgramData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly element: Element;
  readonly target: TargetType;
  readonly category: ProgramCategory;
  readonly rarity: Rarity;
  /**
   * Energy cost. The string 'X' marks an X-COST card (ticket 22): it costs ALL of the
   * source's current Energy, minimum 1, resolved at play time by getEffectiveCardCost.
   * Anywhere a number is genuinely needed (sorting, static budget audit, UI grouping),
   * go through numericBaseCost() rather than casting.
   */
  readonly baseCost: number | 'X';
  readonly constraints: ReadonlyArray<ProgramConstraint>;
  readonly actions: ReadonlyArray<ProgramAction>;
  readonly discardEffect?: ReadonlyArray<ProgramAction>; // Actions triggered automatically when this card is discarded from hand
  readonly hooks?: ReadonlyArray<string>; // IDs of active hooks for Daemons
  readonly isToken?: boolean; // If true, this is a generated token card
  readonly exhaust?: boolean; // If true, card is removed from battle after use
  /**
   * Ticket 53 - RAMPAGE growth. This card INSTANCE permanently gains +N power on every
   * ATTACK action each time it resolves, for the rest of the battle. Per instance, not per
   * card id: two copies of `zealots_edge` grow independently, and the accumulator is a
   * counter keyed by the ProgramEntity id (`card_growth:<instanceId>`) so it survives every
   * pile move without widening `ProgramEntity`.
   *
   * Deliberately UNCAPPED (Henry's law, ticket 53): a scaling attack underperforms early and
   * overperforms late, and capping it pre-emptively removes the only reason to build around
   * it. The brake is the deck, not the card.
   *
   * NOTE for powerscale: the static scorer sees the PRINTED power only, so a growth card is
   * scored at its first cast. See `GROWTH_HORIZON_PLAYS` in powerscale.ts.
   */
  readonly growPerPlay?: number;
  readonly artReference?: string;
}

export interface ProgramEntity {
  readonly id: string;
  readonly dataId: string; // Ref to ProgramData
  readonly currentCost: number;
  readonly isPlayable: boolean;
}

// --- Deck & State Definitions ---

export interface IDeckState {
  readonly ownerId: string;
  readonly deck: ReadonlyArray<string>; // Array of ProgramData IDs
  readonly drawpile: ReadonlyArray<ProgramEntity>;
  readonly hand: ReadonlyArray<ProgramEntity>;
  readonly discard: ReadonlyArray<ProgramEntity>;
  readonly exhaust: ReadonlyArray<ProgramEntity>;
}

export interface IBattleState {
  readonly sessionId: string;
  readonly seed: string;
  readonly turn: number;
  readonly phase: TurnPhase;
  readonly activeSide: 'PLAYER' | 'ENEMY';
  readonly activeRelics: ReadonlyArray<string>;

  readonly playerParty: ReadonlyArray<IBattleEntity>;
  readonly enemyParty: ReadonlyArray<IBattleEntity>;

  readonly playerDeck: IDeckState;
  readonly enemyDeck: IDeckState;

  readonly logs: ReadonlyArray<string>;
  readonly osLogs: ReadonlyArray<string>;
  readonly procs: ReadonlyArray<{ id: number; entityId: string; text: string }>;
  readonly cardsPlayedThisTurn: number;
  readonly cardsDrawnThisTurn: number;
  /**
   * Ticket 68: cards drawn this turn by an EFFECT rather than the draw phase.
   * Reset alongside `cardsDrawnThisTurn`; incremented only when `executeDraw` is called
   * with `isNatural: false`.
   */
  readonly nonNaturalCardsDrawnThisTurn?: number;
  /**
   * Mirrors cardsPlayedThisTurn for the CARDS_DISCARDED scaling (Carrion Swoop).
   * Optional so existing state fixtures keep compiling; production state builders
   * always set it and every read defaults to 0.
   */
  readonly cardsDiscardedThisTurn?: number;
  /** Energy actually paid for the card currently resolving - the X in an X-cost card. */
  readonly lastEnergySpent?: number;
  /**
   * Cards that left a hand because an EFFECT shed them (a DISCARD cost, Tempest, an enemy
   * FORCE_DISCARD) rather than because they were played - entries are `SIDE:entityId`.
   *
   * Exists so the balance harness can tell "this card rotted in hand" from "this deck threw
   * this card away on purpose". Without it a discard archetype reads as ~36% dead cards for
   * doing exactly what it is designed to do: measured on the same hraesvelgr deck, one
   * Tempest read 17-22% dead and two read 36%.
   */
  readonly discardedByEffect?: ReadonlyArray<string>;
  readonly lastProgramPlayed: string | null;
  /**
   * TICKET 111: the INSTANCE id of the card whose actions are resolving right now, or null.
   *
   * `handlePlayProgram` moves the played card to the discard while paying its cost - at step 3,
   * BEFORE any of its actions run - and `drawCards` reshuffles the discard whenever the drawpile
   * is empty. Without this marker a 0-cost "draw a card" played on an empty drawpile finds its own
   * copy in the discard it was just placed in, shuffles it back and draws it into hand, leaving the
   * state identical and the Energy unspent: an unbounded loop. Measured on `valkyrie_v2`, 213 plays
   * a game and 43 of 60 games in one cell never deciding.
   *
   * Deliberately the instance id and not the dataId: a deck may hold several copies of the card,
   * and only the ONE being resolved is excluded - the others reshuffle normally.
   */
  readonly resolvingCardInstanceId?: string | null;
  /**
   * How the enemy side fights, decided once at battle creation:
   * 'MOVES' (default) — Slay-the-Spire style: telegraphed intents only, no cards.
   * 'CARDS' — enemies draw a hand and play cards via the tactical AI (no intents).
   * Undefined is treated as 'MOVES' everywhere.
   */
  readonly enemyMode?: EnemyCombatMode;
  /**
   * Which grade of `TacticalAI` plays the ENEMY side — steam-release ticket 60's enemy ladder,
   * wired by ticket 67. `'greedy'` skips the one-turn lookahead, `'lite'` narrows it, `'full'` is
   * the shipped default.
   *
   * Decided once at battle creation, exactly as `enemyMode` is, and for the same reason: it is a
   * property of the fight the run rolled, not a setting a turn can change. Undefined means the
   * process-wide default (`TacticalAI.AI_TIER`, from the environment), which is what every battle
   * outside a run still gets.
   *
   * **The player's half is never graded.** The AI does not play it in the shipped game, and in a
   * harness that plays both sides the player deliberately stays on the process default — grading
   * both would measure two changes at once.
   */
  readonly enemyAiTier?: 'greedy' | 'lite' | 'full';
  /** Stacks removed by the most recent STATUS consume action (for STATUS_CONSUMED heal scaling). Reset each card play. */
  readonly lastStatusConsumed?: number;
  readonly elementPlays?: Record<Element, number>;
  readonly counters: Record<string, number>;
  /**
   * What every hit of the CURRENT action actually did — see `IDamageRecord`.
   *
   * Cleared at the top of each committed action (`handlePlayProgram`, `handleFireMacro`,
   * `handleExecuteIntent`, `handleEndTurn`) and appended to by `handleAttack`, so it always reads
   * "what this one play did", never "what this battle did". Optional so existing state fixtures
   * keep compiling; every read defaults to `[]`.
   */
  readonly damageLedger?: ReadonlyArray<IDamageRecord>;
}

/**
 * ONE HIT, AS THE ENGINE ACTUALLY RESOLVED IT.
 *
 * # Why this exists
 *
 * Henry, 2026-08-24: *"we had so many bugs last time... so we need to share damage calculation
 * functions, just be able to pull out from it before it gets `Math.max(0, damage)`. Just no bugs,
 * it's really important to know the exact damage."*
 *
 * Before this, the card face's damage number was **measured** rather than reported: the preview
 * cast the card into a throwaway state and diffed the target's HP pool. That could not drift from
 * the engine — which is why it was built that way; ticket 104 paid 52 parity mismatches to learn
 * the lesson — but it could only ever see what HP *moved*, and two things move HP less than the
 * card hits for:
 *
 * - the floor in `effectHandlers.handleAttack`, `Math.max(0, currentHp - finalDamage)`, so a lethal
 *   blow read as the target's remaining HP — 5 damage on a 5 HP target, whatever the card;
 * - BarkShield, which absorbs inside `onPostDamage` *before* HP is touched, so a shielded hit read
 *   as **no number at all**.
 *
 * The fix is not a second calculation to check against — that is the drift trap again. It is for
 * the one place that applies damage to *write down what it did*, and for the preview, the floating
 * numbers and anything else that needs it to read that record. There is still exactly one
 * calculation; it now reports itself instead of being inferred from its side effects.
 *
 * # The three numbers
 *
 * `raw = absorbed + applied + overkill`, always. Each answers a different question:
 * - `raw` — what the card hit for. This is the number on the card face.
 * - `absorbed` — what a shield ate. The player needs it to know how much bark is left.
 * - `applied` — what HP actually lost. This is the health bar's movement.
 *
 * Overkill is deliberately not a field: it is `raw - absorbed - applied`, and a stored number that
 * can disagree with its own inputs is exactly the class of bug this record exists to end.
 */
export interface IDamageRecord {
  readonly sourceId: string;
  readonly targetId: string;
  /** Post-multiplier damage, before shields and before the HP floor. The card's true output. */
  readonly raw: number;
  /** Eaten by a shield status — BarkShield, and anything else with an `onPostDamage`. */
  readonly absorbed: number;
  /** What HP actually lost, after shields and after the floor at 0. */
  readonly applied: number;
  readonly element: Element;
}
