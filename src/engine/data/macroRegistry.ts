/**
 * MACROS — ticket 15 (steam-release map).
 *
 * # WHAT A MACRO IS
 *
 * `macros-and-drivers.md`, ratified by Henry 2026-08-20:
 *
 * > Names RULED: **MACROS** (3 slots, single-use, **fired free on your turn**). **Never call them
 * > potions.**
 *
 * Three fixed slots on `IRunState.macros` (`runTypes.ts`, ratified — this ticket does not touch it),
 * each holding an id into this registry or `null`. Firing one spends the slot and costs no Energy.
 *
 * # THE VOCABULARY IS THE CARDS' VOCABULARY, ON PURPOSE
 *
 * Ticket 15: *"Implement as a `MACRO` action source through the existing reducer
 * (`PLAY_PROGRAM`-shaped, no energy cost)."* So a macro's effect is a list of `ProgramAction`s —
 * the same `ATTACK` / `HEAL` / `STATUS` / `DRAW` / `ENERGY` / `BUFF_NEXT_PROGRAM` / `PLAY_LAST_CARD`
 * shapes 216 cards already use — resolved by the same `ActionExecutorRegistry` through the same
 * hook phases. There is deliberately no second effect engine here: a macro that healed through its
 * own code path would be a second place for `onHealCalculated` to be forgotten.
 *
 * **One action type had to be added**, and it is named here rather than buried: `REVIVE`. Nothing in
 * the existing vocabulary can touch a unit at 0 HP — every resolution loop in the engine skips a
 * target whose `currentHp <= 0`, which is correct for every card ever written and is exactly what a
 * revive has to do. It is added as an ordinary `ActionType` with an ordinary executor (and
 * `CardHand.formatAction` has had a `REVIVE` case waiting for it since before this ticket), not as a
 * parallel system.
 *
 * # POWER DIES AT THE SURFACE
 *
 * Standing law (map § Notes), and ticket 13 has tests behind it: *"true numbers in UI; `power` is
 * internal pricing only."* Every `description` below is written for the player and **never says
 * "power" and never quotes a power figure**. The two macros whose real number depends on who fires
 * them and at what (`surge`, `mend`) describe themselves qualitatively and let
 * `ui/utils/macroPreview.ts` compute the true figure by simulation — the same discipline ticket 104
 * imposed on the card damage preview, so there is no second damage formula to drift from.
 *
 * # PRICES ARE NOT HERE
 *
 * `macroPrice` lives in `run/marketplace.ts` with `cardPrice`, because ticket 13 owns the price
 * table and the ruled formula ("full 1e-card value, rares 1.5x") is quoted against it.
 *
 * Engine module: no React, no Redux, no `Math.random()`, no `Date.now()`.
 */

import type { ProgramAction, Rarity } from '../types';
import type { IRunState, MacroSlots } from '../runTypes';

// =================================================================================================
// The shape
// =================================================================================================

/**
 * Where a macro points.
 *
 * `DOWNED_ALLY` is the whole reason this is an enum rather than a reuse of `TargetType`: the card
 * vocabulary has no way to say "a unit that is at 0 HP", because until Revive no card wanted one.
 * `MAP` is the other outlier — a macro that never fires in a battle at all (ticket 07's map-reveal
 * amendment); the battle reducer refuses it and `runSlice.fireMapReveal` is its only firing path.
 */
export type MacroTargeting = 'ENEMY' | 'ALLY' | 'SELF' | 'DOWNED_ALLY' | 'MAP';

export interface IMacroDefinition {
    readonly id: string;
    readonly name: string;
    /**
     * Player-facing text. **Never contains the word "power" and never quotes one** — see the header.
     * Where the effect has a fixed true number (3 Poison, draw 2, +1 Energy) it is printed here,
     * because that IS the true number; where it does not, the preview supplies it.
     */
    readonly description: string;
    /**
     * The game's own rarity vocabulary, reused rather than re-invented, because the price formula
     * keys on it: `macros-and-drivers.md` prices macros at "full 1e-card value, **rares 1.5x**", so
     * `Rare` is a price tier as well as a label. The five the ruling lists under RARES are `Rare`;
     * everything else is `Common`.
     */
    readonly rarity: Rarity;
    readonly targeting: MacroTargeting;
    /** Resolved by `ActionExecutorRegistry`, exactly as a card's actions are. Empty for `MAP`. */
    readonly actions: ReadonlyArray<ProgramAction>;
}

// =================================================================================================
// Tuning constants that are not just a number in a literal
// =================================================================================================

/**
 * `surge` / `mend`: **"~30 power"**, ruled. That figure is the *pricing* quantity and it is the last
 * place in this file it appears — it feeds `calculateDamage` / `calculateHeal` and what the player
 * ever sees is the HP those produce.
 *
 * 30 is a deliberate read of "~30": under the frozen level-15 calibration (`types.ts`) and the /45
 * divisor (`combatUtils.ts`), 30 lands a burst worth roughly a tenth of a health pool on an even
 * attack/defense trade, and `calculateHeal`'s fixed `maxHp * power / 400` makes Mend exactly 7.5% of
 * the receiving unit's max HP whoever fires it. Both are "one good card's worth, off-deck", which is
 * what a single-use consumable should be.
 */
const BURST_POWER = 30;

/**
 * `free_exec`: "next card costs 0."
 *
 * Expressed as a `BUFF_NEXT_PROGRAM` `costReduction` big enough to zero anything printed, because
 * `getEffectiveCardCost` already does `Math.max(0, currentCost - reduction)` and already clears the
 * charge after the next card resolves. A dedicated "cost = 0" flag would be a second discount
 * mechanism for the UI cost pip, the AI and the reducer to each learn about separately.
 *
 * **Known limit, inherited not introduced:** an X-cost card (ticket 22) ignores discounts by
 * design — it costs the caster's whole pool, and there is nothing to discount when the price *is*
 * the pool. So Free Exec does not make `thermal_lance` free. That is `getEffectiveCardCost`'s
 * ruling, not this macro's.
 */
export const FREE_EXEC_COST_REDUCTION = 99;

/**
 * `revive`: the fraction of max HP a revived member comes back on.
 *
 * `economy-session.md` rules the outcome — *"Gauntlet death: revivable, never gone-for-gauntlet"* —
 * and explicitly defers the SHAPE to playtesting, naming a Revive macro and "auto-return at reduced
 * %" as the two candidates. This is the first candidate built, and it borrows the second's number:
 * half, so a revive is a genuine rescue and not a second full unit. Ticket 18 (the gauntlet) is
 * where the figure gets measured against three fights with no healing between them.
 */
export const REVIVE_PERCENT_MAX_HP = 50;

/**
 * The HP a revived unit comes back on. **One formula, two callers** — added by ticket 18.
 *
 * `ReviveExecutor` does the revive inside the battle; `runSlice.reviveGauntletMember` records it in
 * the run so the next gauntlet fight does not re-down the member it just brought back (and so a
 * resumed fight rebuilds with the revive the player already paid for). Those two numbers must be the
 * same number, and the way to guarantee that is for there to be one of them rather than a constant
 * multiplied in two places.
 *
 * The clamps are the executor's own, kept verbatim: a percentage outside 1-100 is a mis-authored
 * macro rather than a reason to crash, and the floor of 1 exists because a percentage that rounds to
 * zero would "revive" a unit into still being dead — the worst possible outcome for a rare,
 * single-use rescue.
 */
export function revivedHpFor(maxHp: number, percent: number = REVIVE_PERCENT_MAX_HP): number {
    const bounded = Math.max(1, Math.min(100, percent));
    return Math.max(1, Math.floor(maxHp * bounded / 100));
}

/** `cache_pull`: "draw 2", ruled. */
const CACHE_PULL_DRAW = 2;

/** `recharge`: "+1 energy", ruled. Granted as an ADD — see `MACROS.recharge` below. */
const RECHARGE_ENERGY = 1;

// =================================================================================================
// The registry
// =================================================================================================

/**
 * Every macro in the game.
 *
 * **Twelve battle macros plus one map-reveal — thirteen entries.** `macros-and-drivers.md` heads its
 * list "The 11" and then names twelve (Surge, Mend, Venom Shot, Kindle, Rally, Cripple, Salve;
 * RARES: Free Exec, Echo, Cache Pull, Recharge, Revive). The count in the prose is one short of the
 * list under it; the list is what was actually designed, so every name in it ships. Ticket 07's
 * amendment adds the map-reveal on top. Nothing is dropped to make an arithmetic sentence true.
 */
export const MacroRegistry: Readonly<Record<string, IMacroDefinition>> = {
    // --- The seven standard macros -------------------------------------------------------------

    surge: {
        id: 'surge',
        name: 'Surge',
        description: 'A burst of damage at one enemy.',
        rarity: 'Common',
        targeting: 'ENEMY',
        // Element 'None': a macro is not cast off a species' element, so it takes no STAB and no
        // matchup multiplier. That is what keeps one number on the tin whoever is holding it — the
        // opposite choice would make Surge quietly 1.5x better in a favourable biome.
        actions: [{ type: 'ATTACK', power: BURST_POWER, element: 'None', target: 'TARGET' }],
    },

    mend: {
        id: 'mend',
        name: 'Mend',
        description: 'Patch one ally back up.',
        rarity: 'Common',
        targeting: 'ALLY',
        actions: [{ type: 'HEAL', power: BURST_POWER, target: 'TARGET' }],
    },

    venom_shot: {
        id: 'venom_shot',
        name: 'Venom Shot',
        description: 'Applies 3 Poison to one enemy.',
        rarity: 'Common',
        targeting: 'ENEMY',
        // 3 stacks reach the target exactly as written: `PoisonBehavior.getScaledStacks` scales by
        // the caster's attack ONLY when a `power` is supplied, and the STATUS mutation path supplies
        // none. A macro therefore applies the same 3 for every member of the party.
        actions: [{ type: 'STATUS', status: 'Poison', stacks: 3, target: 'TARGET' }],
    },

    kindle: {
        id: 'kindle',
        name: 'Kindle',
        description: 'Applies 2 Burn to one enemy.',
        rarity: 'Common',
        targeting: 'ENEMY',
        actions: [{ type: 'STATUS', status: 'Burn', stacks: 2, target: 'TARGET' }],
    },

    rally: {
        id: 'rally',
        name: 'Rally',
        description: 'Gives one ally 3 Strengthened.',
        rarity: 'Common',
        targeting: 'ALLY',
        actions: [{ type: 'STATUS', status: 'Strengthened', stacks: 3, target: 'TARGET' }],
    },

    cripple: {
        id: 'cripple',
        name: 'Cripple',
        description: 'Applies 3 Weakened to one enemy.',
        rarity: 'Common',
        targeting: 'ENEMY',
        actions: [{ type: 'STATUS', status: 'Weakened', stacks: 3, target: 'TARGET' }],
    },

    salve: {
        id: 'salve',
        name: 'Salve',
        description: 'Gives one ally 3 Regen.',
        rarity: 'Common',
        targeting: 'ALLY',
        actions: [{ type: 'STATUS', status: 'Regen', stacks: 3, target: 'TARGET' }],
    },

    // --- The five rares ------------------------------------------------------------------------

    free_exec: {
        id: 'free_exec',
        name: 'Free Exec',
        description: 'The next card this unit plays this turn costs nothing.',
        rarity: 'Rare',
        targeting: 'SELF',
        actions: [{
            type: 'BUFF_NEXT_PROGRAM',
            costReduction: FREE_EXEC_COST_REDUCTION,
            target: 'SELF',
        }],
    },

    echo: {
        id: 'echo',
        name: 'Echo',
        description: 'Replays the last card you played, free, at a target you choose.',
        rarity: 'Rare',
        // ENEMY rather than SELF because the replayed card's actions land on the target the macro is
        // aimed at, and the overwhelming majority of cards point at an enemy. The player re-aims,
        // which is also the answer to "what if the original target died" — `lastProgramPlayed` is a
        // dataId and has never carried a target, so there is no stale one to fall back to.
        targeting: 'ENEMY',
        actions: [{ type: 'PLAY_LAST_CARD', target: 'TARGET' }],
    },

    cache_pull: {
        id: 'cache_pull',
        name: 'Cache Pull',
        description: 'Draw 2 cards.',
        rarity: 'Rare',
        targeting: 'SELF',
        actions: [{ type: 'DRAW', amount: CACHE_PULL_DRAW, target: 'SELF' }],
    },

    recharge: {
        id: 'recharge',
        name: 'Recharge',
        description: 'Gives one unit +1 Energy right now.',
        rarity: 'Rare',
        targeting: 'SELF',
        /**
         * **THE ENGINE NOTE THE TICKET SHOUTS ABOUT, OBEYED.**
         *
         * `macros-and-drivers.md`: *"`Recharge` must ADD energy mid-turn — `processPreTurn` SETS
         * `currentEnergy`, and that is the trap that bit three OSes. Do not grant via the pre-turn
         * path."*
         *
         * The `ENERGY` action is exactly the non-pre-turn path: `applyMutations`' ENERGY case does
         * `Math.max(0, e.currentEnergy + amount)`, an ADD on the live value, where `processPreTurn`
         * does `currentEnergy: entity.maxEnergy + bonusEnergy`, a SET that would silently refill a
         * spent pool to full and then some. Using the existing action instead of writing energy
         * here is what makes the ruling structurally true rather than true-for-now.
         */
        actions: [{ type: 'ENERGY', amount: RECHARGE_ENERGY, target: 'SELF' }],
    },

    revive: {
        id: 'revive',
        name: 'Revive',
        description: `Brings a downed ally back at ${REVIVE_PERCENT_MAX_HP}% of their health.`,
        rarity: 'Rare',
        targeting: 'DOWNED_ALLY',
        actions: [{ type: 'REVIVE', percent: REVIVE_PERCENT_MAX_HP, target: 'TARGET' }],
    },

    // --- The map-reveal (ticket 07's amendment) -------------------------------------------------

    ping_sweep: {
        id: 'ping_sweep',
        name: 'Ping Sweep',
        /**
         * Named here and nowhere else: `exploration-map.md` asks Henry's question as *"items and
         * events that reveal more of the map"* and ticket 07's amendment specifies the effect
         * ("reveals the current biome's node types") without naming the thing. "Ping Sweep" is
         * chosen to sit in the same command-line register as Cache Pull and Free Exec. **Flagged as
         * an unruled naming call, not a decision.**
         */
        description: 'Reveals every node type in the biome you are standing in. Fires from the map.',
        rarity: 'Common',
        targeting: 'MAP',
        // Empty on purpose: this macro changes the RUN, not a battle. Its effect is a
        // `reveal:biome:N` entry in `IRunState.modifiers` written by `runSlice.fireMapReveal`, and
        // the battle reducer refuses to fire it at all.
        actions: [],
    },
};

/** Stable list order for anything that enumerates macros (stock rolls, tests, the rack UI). */
export const MACRO_IDS: ReadonlyArray<string> = Object.keys(MacroRegistry);

/** Every macro that can be fired inside a battle — everything except the map-reveal. */
export const BATTLE_MACRO_IDS: ReadonlyArray<string> =
    MACRO_IDS.filter((id) => MacroRegistry[id].targeting !== 'MAP');

/** Lookup that never throws at a render. An unknown id is `undefined` and every caller checks. */
export function getMacro(id: string | null | undefined): IMacroDefinition | undefined {
    return id ? MacroRegistry[id] : undefined;
}

// =================================================================================================
// The rack
// =================================================================================================

/** Why a macro cannot be taken into the rack. `null` means it can. */
export type MacroRackBlock = 'unknown-macro' | 'rack-full';

/**
 * The index of the first empty slot, or `-1` when the rack is full.
 *
 * Left-to-right so acquisition is predictable: the player watches slot 1 fill, then 2, then 3.
 */
export function firstFreeMacroSlot(macros: MacroSlots): number {
    return macros.findIndex((slot) => slot === null);
}

/**
 * Can this macro be taken? **The refusal is a reason, not a silence.**
 *
 * Ticket 15: *"a full rack must refuse a purchase with a reason, not silently drop it."* A Redux
 * reducer has no error channel — `runSlice`'s standing convention is a silent no-op on invalid — so
 * the reason is produced *here*, by a pure function the screen calls before it dispatches, exactly
 * as `workshop.workshopBlockFor` produces one for a recruit. The reducer still refuses independently
 * (ticket 20: a check that lives only in a component is a check that races); this is what turns that
 * refusal into a sentence the player can read.
 *
 * Scrap is deliberately not a term. Affordability changes under the player's feet as they buy and
 * sell; what this answers is the stable question "is there anywhere to put it".
 */
export function macroRackBlockFor(macros: MacroSlots, macroId: string): MacroRackBlock | null {
    if (!MacroRegistry[macroId]) return 'unknown-macro';
    if (firstFreeMacroSlot(macros) === -1) return 'rack-full';
    return null;
}

// =================================================================================================
// The map-reveal's record in `modifiers`
// =================================================================================================

/**
 * A revealed biome is recorded as `reveal:biome:N` in `IRunState.modifiers`, and that is a
 * deliberate use of an existing field rather than a new one.
 *
 * `runTypes.ts` is ratified and ticket 15 may not change it (its header calls the two-key save shape
 * a ruling, and ticket 23 lands it as save v4 with no migration path). `modifiers` is already
 * `ReadonlyArray<string>`, already persisted, already parsed by `RunStateSchema` as a plain string
 * array, and its documented purpose — *"opt-in run modifiers, ascension-shaped"* — is "facts about
 * this run that change how it plays", which a permanently-lifted fog is. A `revealedBiomes: number[]`
 * field would have been marginally tidier to read and would have cost a save-shape change that the
 * ratification forbids.
 *
 * The namespaced prefix is what keeps it honest: an ascension modifier will never collide with
 * `reveal:biome:`, and `revealedBiomesFrom` ignores anything that is not exactly this shape.
 */
export const BIOME_REVEAL_PREFIX = 'reveal:biome:';

/** The modifier string recording that biome `index` has been surveyed. */
export function biomeRevealModifier(index: number): string {
    return `${BIOME_REVEAL_PREFIX}${index}`;
}

/**
 * Which biomes a run has surveyed, read out of `modifiers`.
 *
 * Total and forgiving: a malformed or unknown modifier is skipped rather than thrown on, because
 * this is called from a render and a save carrying a modifier from a future version must not take
 * the map down.
 */
export function revealedBiomesFrom(modifiers: ReadonlyArray<string>): ReadonlyArray<number> {
    const out: number[] = [];
    for (const modifier of modifiers) {
        if (!modifier.startsWith(BIOME_REVEAL_PREFIX)) continue;
        const index = Number.parseInt(modifier.slice(BIOME_REVEAL_PREFIX.length), 10);
        if (Number.isInteger(index) && index >= 0 && !out.includes(index)) out.push(index);
    }
    return out;
}

/** Has this run already surveyed the biome it is standing in? Used to grey out a wasted click. */
export function isBiomeRevealed(run: IRunState, biomeIndex: number): boolean {
    return revealedBiomesFrom(run.modifiers).includes(biomeIndex);
}
