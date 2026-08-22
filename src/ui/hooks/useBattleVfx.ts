import React from 'react';
import { globalBattleEventBus } from '../../engine/events';
import type { IBattleState, StatusType } from '../../engine/types';
import { STATUS_COLORS } from '../../engine/data/statusGlossary';
import { getElementAccent } from '../utils/contrastText';
import { playSfx } from '../audio/AudioEngine';

/**
 * useBattleVfx — UI-only combat-juice driver.
 *
 * Subscribes to the engine's globalBattleEventBus (the same bus SimRunner
 * uses) and converts battle events into small, per-entity FX descriptors that
 * MingmingUnit / BattleArena render with framer-motion. Events fire
 * synchronously inside the Redux dispatch that runs the engine reducer, so
 * every setState here lands in the same React 18 batch as the store update —
 * no extra renders, no per-frame state churn.
 *
 * The engine is never touched: this is a pure listener.
 */

export type FloatKind = 'damage' | 'crit' | 'heal' | 'absorbed';

export interface CombatFloat {
    id: number;
    kind: FloatKind;
    text: string;
    color: string;
    /** 0..5 lateral slot so rapid hits fan out instead of overlapping dead-center. */
    slot: number;
}

export interface UnitFx {
    floats: CombatFloat[];
    /** Increments on every damaging hit; keys the flash overlay + shake. */
    hitKey: number;
    /** Damage as a fraction of the target's max HP (0..1) for intensity scaling. */
    hitIntensity: number;
    /** Increments on every heal; keys the green pulse. */
    healKey: number;
    /** Increments on every status application; keys the colored ring pulse. */
    statusKey: number;
    statusColor: string;
    /** Increments when this entity plays a program / executes an intent (attack lunge). */
    lungeKey: number;
}

export interface BattleVfx {
    unitFx: Record<string, UnitFx>;
    /** Increments on big hits (>= ARENA_SHAKE_FRACTION of max HP) — arena shake. */
    shakeKey: number;
    /** Manually nudge a unit's lunge (used for enemy EXECUTE_INTENT, which emits no PROGRAM_PLAYED). */
    triggerLunge: (entityId: string) => void;
}

export const EMPTY_UNIT_FX: UnitFx = {
    floats: [],
    hitKey: 0,
    hitIntensity: 0,
    healKey: 0,
    statusKey: 0,
    statusColor: '#ffffff',
    lungeKey: 0,
};

/** Hits >= this fraction of max HP render as crits (bigger, rotated, glowing). */
const CRIT_FRACTION = 0.25;
/** Hits >= this fraction of max HP also shake the whole arena. */
const ARENA_SHAKE_FRACTION = 0.33;
/** Cap concurrent floats per unit; oldest are dropped beyond this. */
const MAX_FLOATS_PER_UNIT = 8;
/** Must outlive the ~1s float animation. */
const FLOAT_LIFETIME_MS = 1150;
const FLOAT_SLOTS = 6;

const HEAL_COLOR = '#4ade80';
const ABSORB_COLOR = '#9aa0ae';

/**
 * Small stable hash → pitch multiplier so each status type gets its own glitch
 * tick flavor (Burn ticks differently from Poison) without a hand-tuned table.
 */
function statusPitch(status: string): number {
    let h = 0;
    for (let i = 0; i < status.length; i++) h = (h * 31 + status.charCodeAt(i)) | 0;
    return 0.85 + (Math.abs(h) % 8) * 0.06; // 0.85 .. 1.27
}
/** Element 'None' damage stays red-hot instead of the gray element accent, so it never reads as "absorbed". */
const NEUTRAL_DAMAGE_COLOR = '#ff5a5a';

interface VfxState {
    unitFx: Record<string, UnitFx>;
    shakeKey: number;
}

export function useBattleVfx(battleState: IBattleState | null): BattleVfx {
    const [vfx, setVfx] = React.useState<VfxState>({ unitFx: {}, shakeKey: 0 });

    // Latest engine state for max-HP lookups inside the (synchronous) listener.
    //
    // ticket 55: reviewed, not a defect. The write has to happen during render, which is the whole
    // point of the pattern: the event-bus listener runs SYNCHRONOUSLY inside the same commit as a
    // dispatch, so a ref updated in an effect would still hold the previous battle state when the
    // listener reads it. This is the standard latest-value ref, and it is a write (never a read)
    // during render.
    const stateRef = React.useRef(battleState);
    // eslint-disable-next-line react-hooks/refs
    stateRef.current = battleState;

    const floatIdRef = React.useRef(1);
    const slotRef = React.useRef<Record<string, number>>({});
    // Pending timeouts, cleared on unmount (pendingTimeoutsRef pattern from MingmingUnit).
    const pendingTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

    const triggerLunge = React.useCallback((entityId: string) => {
        setVfx(prev => {
            const unit = prev.unitFx[entityId] ?? EMPTY_UNIT_FX;
            return {
                ...prev,
                unitFx: { ...prev.unitFx, [entityId]: { ...unit, lungeKey: unit.lungeKey + 1 } },
            };
        });
    }, []);

    React.useEffect(() => {
        const pushFloat = (entityId: string, kind: FloatKind, text: string, color: string) => {
            const id = floatIdRef.current++;
            const slot = (slotRef.current[entityId] = ((slotRef.current[entityId] ?? -1) + 1) % FLOAT_SLOTS);
            setVfx(prev => {
                const unit = prev.unitFx[entityId] ?? EMPTY_UNIT_FX;
                let floats = [...unit.floats, { id, kind, text, color, slot }];
                if (floats.length > MAX_FLOATS_PER_UNIT) {
                    floats = floats.slice(floats.length - MAX_FLOATS_PER_UNIT);
                }
                return { ...prev, unitFx: { ...prev.unitFx, [entityId]: { ...unit, floats } } };
            });
            const timeout = setTimeout(() => {
                setVfx(prev => {
                    const unit = prev.unitFx[entityId];
                    if (!unit || !unit.floats.some(f => f.id === id)) return prev;
                    return {
                        ...prev,
                        unitFx: {
                            ...prev.unitFx,
                            [entityId]: { ...unit, floats: unit.floats.filter(f => f.id !== id) },
                        },
                    };
                });
            }, FLOAT_LIFETIME_MS);
            pendingTimeoutsRef.current.push(timeout);
        };

        const findEntity = (id: string) => {
            const s = stateRef.current;
            if (!s) return undefined;
            return s.playerParty.find(e => e.id === id) ?? s.enemyParty.find(e => e.id === id);
        };

        const unsubscribe = globalBattleEventBus.subscribe(event => {
            switch (event.type) {
                case 'DAMAGE_TAKEN': {
                    const { targetId, amount, element } = event;
                    if (amount <= 0) {
                        // Fully shielded/absorbed hit — no flash, no shake, just the readout.
                        pushFloat(targetId, 'absorbed', 'ABSORBED', ABSORB_COLOR);
                        playSfx('absorbed');
                        return;
                    }
                    const target = findEntity(targetId);
                    const maxHp = target?.maxHp ?? 0;
                    const frac = maxHp > 0 ? amount / maxHp : 0;
                    const isCrit = event.isCritical === true || frac >= CRIT_FRACTION;
                    // stateRef still holds the pre-dispatch snapshot (events fire
                    // synchronously inside the reducer), so currentHp is the HP
                    // *before* this hit → HP→0 transition = lethal hit.
                    const isLethal = !!target && target.currentHp > 0 && amount >= target.currentHp;
                    if (isLethal) {
                        playSfx('death');
                    } else {
                        playSfx(isCrit ? 'hitCrit' : 'hit', { intensity: Math.min(1, frac) });
                    }
                    const color =
                        element && element !== 'None' ? getElementAccent(element) : NEUTRAL_DAMAGE_COLOR;
                    pushFloat(targetId, isCrit ? 'crit' : 'damage', `-${amount}`, color);
                    setVfx(prev => {
                        const unit = prev.unitFx[targetId] ?? EMPTY_UNIT_FX;
                        return {
                            unitFx: {
                                ...prev.unitFx,
                                [targetId]: {
                                    ...unit,
                                    hitKey: unit.hitKey + 1,
                                    hitIntensity: Math.min(1, frac),
                                },
                            },
                            shakeKey: frac >= ARENA_SHAKE_FRACTION ? prev.shakeKey + 1 : prev.shakeKey,
                        };
                    });
                    return;
                }
                case 'HEAL': {
                    if (event.amount <= 0) return;
                    playSfx('heal');
                    pushFloat(event.targetId, 'heal', `+${event.amount}`, HEAL_COLOR);
                    setVfx(prev => {
                        const unit = prev.unitFx[event.targetId] ?? EMPTY_UNIT_FX;
                        return {
                            ...prev,
                            unitFx: {
                                ...prev.unitFx,
                                [event.targetId]: { ...unit, healKey: unit.healKey + 1 },
                            },
                        };
                    });
                    return;
                }
                case 'STATUS_APPLIED': {
                    if (event.status === 'DarkStance') {
                        playSfx('stanceDark');
                    } else if (event.status === 'LightStance') {
                        playSfx('stanceLight');
                    } else {
                        playSfx('statusApply', { pitch: statusPitch(event.status) });
                    }
                    const color = STATUS_COLORS[event.status as StatusType] ?? '#cccccc';
                    setVfx(prev => {
                        const unit = prev.unitFx[event.targetId] ?? EMPTY_UNIT_FX;
                        return {
                            ...prev,
                            unitFx: {
                                ...prev.unitFx,
                                [event.targetId]: {
                                    ...unit,
                                    statusKey: unit.statusKey + 1,
                                    statusColor: color,
                                },
                            },
                        };
                    });
                    return;
                }
                case 'PROGRAM_PLAYED': {
                    // Subtle attacker anticipation ("Step Forward" from the roadmap).
                    playSfx('cardPlay');
                    triggerLunge(event.sourceId);
                    return;
                }
                case 'CARD_DRAWN': {
                    // Only the player's deck ticks audibly; the 35ms coalescer
                    // collapses multi-card draws into a single soft tick.
                    if (event.ownerId === 'PLAYER') playSfx('cardDraw');
                    return;
                }
                case 'TURN_START': {
                    playSfx(event.activeSide === 'PLAYER' ? 'turnPlayer' : 'turnEnemy');
                    return;
                }
                case 'LEVEL_UP': {
                    playSfx('levelUp');
                    return;
                }
                default:
                    return;
            }
        });

        const timeouts = pendingTimeoutsRef.current;
        return () => {
            unsubscribe();
            timeouts.forEach(clearTimeout);
            timeouts.length = 0;
        };
    }, [triggerLunge]);

    return { unitFx: vfx.unitFx, shakeKey: vfx.shakeKey, triggerLunge };
}
