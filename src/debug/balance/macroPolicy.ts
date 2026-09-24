/**
 * MACRO POLICY — the harness's hand on the rack (steam-release ticket 77, Track B1).
 *
 * # WHY THE ARM NEVER HAD ONE
 *
 * Macros are fired by the SCREEN. `MacroRack` checks `canFireMacro`, dispatches `battleSlice.fireMacro`
 * (the `FIRE_MACRO` reducer action) and then `runSlice.consumeMacro` to empty the slot. Nothing in
 * `TacticalAI` knows a rack exists, so every gym number taken through `runGate` measured a player
 * who held three consumables and never touched them. Ticket 77's Track A showed that at the 18-card
 * deck every added CARD costs win rate; macros are the ruled player power that costs no card slot,
 * and this is the piece that lets the graded arm hold them.
 *
 * # THE POLICY IS A FLOOR ON A HUMAN, DELIBERATELY
 *
 * Three rules, in this order, checked before every player action:
 *
 *  1. **Lethal.** If any held damage macro's previewed damage would take an enemy to 0, fire it at
 *     that enemy. The preview is the real reducer run muted (`computeMacroPreview`'s method), so it
 *     sees shields, Weakened, the target's defense — everything the screen's preview sees.
 *  2. **Boss turn 1.** In the boss fight, on turn 1, fire every unfired macro: `surge` at the
 *     lowest-HP enemy, `cripple` at the highest-attack enemy, `mend` on the lowest-%HP ally, anything
 *     else at the first legal target. One macro per call; the loop calls again until the rack is
 *     empty, so all three land before the first card of the fight.
 *  3. **Mend under 40%.** At the start of any turn on which an ally is under 40% HP, fire `mend` on
 *     the lowest-%HP ally if one is held.
 *
 * A human does better than this — holding Surge for a body that is about to heal, aiming Cripple at
 * the member whose next card is the big one. That is the point: if the FLOOR moves the gauntlet
 * compound, macros are worth at least that; if it does not, no policy would have.
 *
 * # THE RACK IS PER FIGHT HERE, AND THAT IS AN UPPER BOUND, STATED
 *
 * `IRunState.macros` is three slots per RUN. `runGate` fights each gauntlet cell in isolation and
 * from full HP — its `gauntletCompound` already says it is an UPPER BOUND for that reason — and the
 * same applies here: each cell's sample starts with a full rack, so a Surge spent in fight 1 is
 * available again in fight 3. Rule 2 only fires in the boss cell, so the lead-in cells spend macros
 * only on lethals and sub-40% mends. Read the boss cell as "three macros brought to the boss".
 *
 * # EVERY FIRE PASSES `canFireMacro` OR THE RUN THROWS
 *
 * The screen never dispatches a macro the reducer would refuse. If this policy ever would, that is
 * a bug in the policy and not a measurement, and the ticket says STOP rather than work around it —
 * so the policy throws instead of returning the action.
 *
 * `src/debug`: may import the engine; imports nothing from `src/ui`.
 */

import { battleReducer, canFireMacro, type BattleAction } from '../../engine/battleReducer';
import { getMacro, type IMacroDefinition } from '../../engine/data/macroRegistry';
import { globalBattleEventBus } from '../../engine/events';
import type { IBattleEntity, IBattleState } from '../../engine/types';

/** The two loadouts ticket 77 names: B1a three Surges, B1b one of each shape. */
export const MACRO_LOADOUTS = {
    surge3: ['surge', 'surge', 'surge'],
    mixed: ['surge', 'cripple', 'mend'],
} as const satisfies Record<string, readonly [string, string, string]>;

export type MacroLoadout = keyof typeof MACRO_LOADOUTS;
export const MACRO_LOADOUT_NAMES = Object.keys(MACRO_LOADOUTS) as ReadonlyArray<MacroLoadout>;

export function isMacroLoadout(value: string): value is MacroLoadout {
    return (MACRO_LOADOUT_NAMES as ReadonlyArray<string>).includes(value);
}

/** Which of the three rules fired a macro — reported per fight beside the win rate. */
export type MacroRule = 'lethal' | 'boss-turn-1' | 'mend-under-40';

export interface MacroFire {
    readonly macroId: string;
    readonly rule: MacroRule;
    /** `IBattleState.turn` at the moment of firing. */
    readonly turn: number;
    readonly sourceId: string;
    readonly targetId: string;
}

export interface MacroPolicy {
    /**
     * The macro to fire NOW, or `null` to let `TacticalAI` play a card. Only ever non-null on the
     * player's ACTION phase. Records the fire in `fired` on the assumption the caller dispatches it.
     */
    next(state: IBattleState): BattleAction | null;
    /** Every macro this policy has fired, in order. */
    readonly fired: ReadonlyArray<MacroFire>;
    /** The macro ids still in the rack. */
    readonly held: ReadonlyArray<string>;
}

export interface MacroPolicyOptions {
    /** Is this the gauntlet's boss fight? Rule 2 fires only there. */
    readonly bossFight: boolean;
    /** Rule 3's threshold, as a fraction of max HP. Ticket 77 says 40%. */
    readonly mendBelow?: number;
}

const MEND_BELOW_DEFAULT = 0.4;

const alive = (party: ReadonlyArray<IBattleEntity>): IBattleEntity[] => party.filter((e) => e.currentHp > 0);
const hpFraction = (e: IBattleEntity): number => (e.maxHp > 0 ? e.currentHp / e.maxHp : 1);
const pool = (e: IBattleEntity | undefined): number => (e?.currentHp ?? 0) + (e?.tempHp ?? 0);
const isDamageMacro = (macro: IMacroDefinition): boolean => macro.actions.some((a) => a.type === 'ATTACK');

/**
 * Would firing `macroId` from `sourceId` at `targetId` take the target's pool to 0? The real reducer,
 * muted, exactly as the screen's preview does it — so shields and Weakened are honoured.
 */
export function macroIsLethal(state: IBattleState, macroId: string, sourceId: string, targetId: string): boolean {
    const payload = { macroId, sourceId, targetId };
    if (canFireMacro(state, payload) !== null) return false;
    const after = globalBattleEventBus.runMuted(() => battleReducer(state, { type: 'FIRE_MACRO', payload }));
    return pool(after.enemyParty.find((e) => e.id === targetId)) <= 0;
}

/** Where a macro is aimed when nothing is lethal — the ticket's per-macro rule, then "first legal". */
function defaultTarget(state: IBattleState, macro: IMacroDefinition, sourceId: string): string | undefined {
    const enemies = alive(state.enemyParty);
    const allies = alive(state.playerParty);
    switch (macro.id) {
        case 'surge':
            return [...enemies].sort((a, b) => pool(a) - pool(b))[0]?.id;
        case 'cripple':
            return [...enemies].sort((a, b) => b.attack - a.attack)[0]?.id;
        case 'mend':
            return [...allies].sort((a, b) => hpFraction(a) - hpFraction(b))[0]?.id;
        default:
            break;
    }
    switch (macro.targeting) {
        case 'ENEMY': return enemies[0]?.id;
        case 'ALLY': return allies[0]?.id;
        case 'SELF': return sourceId;
        case 'DOWNED_ALLY': return state.playerParty.find((e) => e.currentHp <= 0)?.id;
        default: return undefined;
    }
}

export function createMacroPolicy(loadout: MacroLoadout, options: MacroPolicyOptions): MacroPolicy {
    const held: string[] = [...MACRO_LOADOUTS[loadout]];
    const fired: MacroFire[] = [];
    const mendBelow = options.mendBelow ?? MEND_BELOW_DEFAULT;
    /** Rule 3 is a START-of-turn check: the turn number it last ran on. */
    let mendCheckedOnTurn = -1;

    const fire = (state: IBattleState, slot: number, rule: MacroRule, sourceId: string, targetId: string): BattleAction => {
        const macroId = held[slot];
        const payload = { macroId, sourceId, targetId };
        const block = canFireMacro(state, payload);
        if (block !== null) {
            // The STOP condition from the ticket, surfaced as a throw rather than a skipped fire.
            throw new Error(
                `[macroPolicy] rule "${rule}" chose ${macroId} from ${sourceId} at ${targetId} on turn ` +
                `${state.turn}, and canFireMacro refuses it: ${block}. The policy is wrong; do not measure this.`,
            );
        }
        held.splice(slot, 1);
        fired.push({ macroId, rule, turn: state.turn, sourceId, targetId });
        return { type: 'FIRE_MACRO', payload };
    };

    return {
        fired,
        held,
        next(state: IBattleState): BattleAction | null {
            if (held.length === 0) return null;
            if (state.activeSide !== 'PLAYER' || state.phase !== 'ACTION') return null;
            const source = alive(state.playerParty)[0];
            if (!source) return null;
            const enemies = alive(state.enemyParty);
            if (enemies.length === 0) return null;

            // Rule 1 — a lethal, from any held damage macro, on any enemy. Lowest pool first so the
            // kill is the cheapest one available.
            for (let slot = 0; slot < held.length; slot += 1) {
                const macro = getMacro(held[slot]);
                if (!macro || !isDamageMacro(macro)) continue;
                for (const enemy of [...enemies].sort((a, b) => pool(a) - pool(b))) {
                    if (macroIsLethal(state, macro.id, source.id, enemy.id)) {
                        return fire(state, slot, 'lethal', source.id, enemy.id);
                    }
                }
            }

            // Rule 2 — the boss fight's opening turn empties the rack, one macro per call.
            if (options.bossFight && state.turn === 1) {
                for (let slot = 0; slot < held.length; slot += 1) {
                    const macro = getMacro(held[slot]);
                    if (!macro) continue;
                    const target = defaultTarget(state, macro, source.id);
                    if (target === undefined) continue;
                    if (canFireMacro(state, { macroId: macro.id, sourceId: source.id, targetId: target }) !== null) continue;
                    return fire(state, slot, 'boss-turn-1', source.id, target);
                }
            }

            // Rule 3 — start of a turn with an ally under the line: mend the worst-off one.
            if (mendCheckedOnTurn !== state.turn) {
                mendCheckedOnTurn = state.turn;
                const slot = held.indexOf('mend');
                if (slot >= 0) {
                    const worst = [...alive(state.playerParty)].sort((a, b) => hpFraction(a) - hpFraction(b))[0];
                    if (worst && hpFraction(worst) < mendBelow) {
                        return fire(state, slot, 'mend-under-40', source.id, worst.id);
                    }
                }
            }

            return null;
        },
    };
}

/** One banner line per loadout. */
export function describeMacroLoadout(loadout: MacroLoadout): string {
    const names = MACRO_LOADOUTS[loadout].map((id) => getMacro(id)?.name ?? id);
    return `${loadout}: ${names.join(' + ')} — fired by the harness policy (lethal > boss turn 1 > mend under 40%); ` +
        'a FULL rack per cell, so the boss cell reads as "three macros brought to the boss" (ticket 77 B1)';
}
