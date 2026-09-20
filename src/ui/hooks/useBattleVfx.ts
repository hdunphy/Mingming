import React from 'react';
import { globalBattleEventBus } from '../../engine/events';
import type { IBattleEntity, IBattleState, StatusType } from '../../engine/types';
import { STATUS_COLORS } from '../../engine/data/statusGlossary';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getElementAccent } from '../utils/contrastText';
import { playSfx, primeSfxSamples } from '../audio/AudioEngine';
import {
    castCue, causeCue, cryCue, effectivenessAgainst, HIT_BIG_FRACTION, hookCue, impactCue,
    isPlayerSide, shieldCue, statusCue, tickCue,
} from '../audio/battleCues';
import { pitchForDamage, pitchForStacks, semitones } from '../audio/limiters';

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

/**
 * A card that just resolved, announced for the centre-screen reveal.
 *
 * Henry: *"We should also show the cards that get played, animate them to show center screen so the
 * player knows what was played rather than having to check the log."* The combat log already carries
 * every play, and that is exactly the complaint - the player should not have to read prose to find
 * out what hit them.
 *
 * `dataId` rather than a rendered face: `PROGRAM_PLAYED.programId` IS the dataId (battleReducer
 * emits `card.dataId`), so the reveal looks the card up and renders the real `ProgramCard`. There is
 * no second card face to drift from the one in the hand.
 */
export interface PlayedCardAnnouncement {
    /** Monotonic, so two casts of the same card in one turn are two distinct reveals. */
    readonly key: number;
    readonly dataId: string;
    readonly sourceId: string;
    readonly targetId: string;
    /** Whose side cast it - the reveal tints and sides itself off this. */
    readonly fromPlayer: boolean;
    readonly sourceName: string;
    readonly targetName: string;
}

/**
 * How long a reveal stays up, and therefore how long the enemy loop holds before it starts thinking
 * about its next card (`BattleArena`). Ticket 127: this is the number that turns dead waiting into
 * information - the old loop slept 600ms with nothing on screen and then thought for 1.3s.
 *
 * **1200ms since the 2026-09-05 playtest** — Henry: *"Enemy AI cards disappear to fast."* 700 was
 * set against a 3v3 search that takes ~1.3s a decision, where the think itself padded the read;
 * in a SOLO fight the search returns in tens of milliseconds, so the hold WAS the whole exposure
 * and a card the player has never seen before got 0.65 seconds. The number is the floor on how long
 * a stranger's card is legible, so it is set for the fast case and the slow case keeps paying its
 * own way.
 *
 * It is a hold, not an animation length: the reveal itself never expires on a timer (see the
 * `PROGRAM_PLAYED` case below) — the next play or the turn flip is what takes it down.
 */
export const PLAYED_CARD_REVEAL_MS = 1200;

export interface BattleVfx {
    unitFx: Record<string, UnitFx>;
    /** Increments on big hits (>= ARENA_SHAKE_FRACTION of max HP) — arena shake. */
    shakeKey: number;
    /** Manually nudge a unit's lunge (used for enemy EXECUTE_INTENT, which emits no PROGRAM_PLAYED). */
    triggerLunge: (entityId: string) => void;
    /** The most recent play, for the centre-screen reveal. Null once it has aged out. */
    playedCard: PlayedCardAnnouncement | null;
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
/**
 * How many stacks of this status the target is carrying — ticket 147d, so a tick can rise with it.
 *
 * Read off the PRE-dispatch snapshot, like everything else in this hook: bus events fire
 * synchronously inside the reducer, so this is the stack count the tick was computed from rather
 * than what is left after it.
 */
/**
 * Impacts closer together than this are one cast landing on several bodies — ticket 147d.
 *
 * 146c staggers a cast's per-target impacts by `TRAIL_STAGGER_MS` (40 ms) and the next cast is
 * hundreds of milliseconds away, so there is a wide gap to put the line in. 150 sits in it.
 */
const SAME_CAST_MS = 150;

/** A card hits at most a side — three bodies — so the series never climbs past a third step. */
const MAX_HIT_STEP = 2;

function stacksOf(target: IBattleEntity | undefined, status: StatusType | undefined): number {
    if (!target || !status) return 0;
    return target.statusEffects.find((effect) => effect.type === status)?.stacks ?? 0;
}

const NEUTRAL_DAMAGE_COLOR = '#ff5a5a';

interface VfxState {
    unitFx: Record<string, UnitFx>;
    shakeKey: number;
    playedCard: PlayedCardAnnouncement | null;
}

export function useBattleVfx(battleState: IBattleState | null): BattleVfx {
    const [vfx, setVfx] = React.useState<VfxState>({ unitFx: {}, shakeKey: 0, playedCard: null });

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
    const revealKeyRef = React.useRef(1);
    /*
     * Which impact of a multi-target cast this is — ticket 147d, feeding 147b's `step`.
     *
     * The hook sees one `DAMAGE_TAKEN` at a time and is never told a Side card is in progress, so
     * the series is DETECTED rather than counted: impacts less than `SAME_CAST_MS` apart are one
     * cast landing on several bodies, and anything later starts over at 0.
     *
     * Detecting matters. A bare counter would pitch a LONE hit — the common case — by whatever
     * the counter happened to be sitting at, and would also exempt it from coalescing, which is
     * the protection `step` is allowed to bypass precisely because the caller has stated intent.
     */
    const hitStepRef = React.useRef(0);
    const lastHitAtRef = React.useRef(0);
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

    /*
     * TICKET 147a — START THE SAMPLE BANK WHEN A FIGHT DOES.
     *
     * The 61 sampled cues are 675 KB and nothing before a battle needs them, so they are fetched
     * and decoded here rather than at boot. Fire-and-forget and idempotent: nothing waits on it,
     * and every cue has a synth fallback for the seconds before its buffer lands — which is what
     * makes loading it *here* rather than earlier cost nothing but fidelity on the first fight.
     *
     * A no-op with no AudioContext, which is how the suite stays silent.
     */
    React.useEffect(() => {
        primeSfxSamples();
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
                    /*
                     * RULING 2 (Henry, 2026-08-24): *"I don't see damage indicators when going
                     * against bark shield. I need to know how much bark I take off."*
                     *
                     * A shield absorbs inside `onPostDamage`, so `amount` is what got PAST it — a
                     * fully absorbed hit used to render the word ABSORBED and no number, and a
                     * partial one rendered only the HP half, with the bark chip invisible. The
                     * shield portion now gets its own float, from `event.damage.absorbed`, which is
                     * the same record the card face reads (`IDamageRecord`). Two numbers, because
                     * they are two different resources coming off two different bars.
                     */
                    const absorbed = event.damage?.absorbed ?? 0;

                    /*
                     * ── TICKET 147d: DAMAGE IS FOUR DIFFERENT SOUNDS ───────────────────────
                     *
                     * `DAMAGE_TAKEN` carries a `cause` (146b) and this hook ignored it, so a Burn
                     * tick, a toll paid and a sword landing all played `hit`. 147 §4 is explicit
                     * that a tick is *"**never** the impact sound"* — a player has to be able to
                     * tell "the board is hurting me" from "I am being hit" with their eyes
                     * elsewhere, and that is the single most useful thing sound does here.
                     */
                    const tick = event.cause === 'status';
                    const selfInflicted = causeCue(event.cause);
                    if (tick) {
                        playSfx(tickCue(event.status), {
                            pitch: pitchForStacks(stacksOf(findEntity(targetId), event.status)),
                        });
                    } else if (selfInflicted) {
                        playSfx(selfInflicted);
                    }

                    if (absorbed > 0) {
                        pushFloat(targetId, 'absorbed', `-${absorbed} 🛡`, ABSORB_COLOR);
                    }
                    /*
                     * Three shield moments, not one (147 §8): the bark held (`blockedByBark`),
                     * the bark broke and the rest landed (`barkBreak`), or something reduced the
                     * hit to nothing without a shield to credit (`absorbedNoDamage`). They are
                     * three different pieces of news about whether that wall is still there.
                     */
                    if (!tick && !selfInflicted) {
                        const shield = shieldCue(absorbed, amount);
                        if (shield) playSfx(shield);
                    }

                    if (amount <= 0) {
                        // Nothing reached HP. The shield float above is the whole readout; the
                        // wordy fallback is kept only for an absorption we could not quantify
                        // (a hand-built event with no ledger, or a non-shield reduction to zero).
                        if (absorbed <= 0) {
                            pushFloat(targetId, 'absorbed', 'ABSORBED', ABSORB_COLOR);
                        }
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
                    /*
                     * THE IMPACT LADDER — 147 §8. Effectiveness decides the cue, damage decides the
                     * pitch and whether the sub-thump is layered under it, and a lethal hit adds
                     * the power-down and the dying body's cry on top.
                     *
                     * Ticks and tolls never reach here: they made their own sound above and a
                     * `return` would have skipped the damage float, which they still deserve.
                     */
                    if (!tick && !selfInflicted) {
                        const effectiveness = effectivenessAgainst(element, target);
                        // One cast landing on several bodies, or a new cast? 146c staggers a
                        // Side card's impacts by 40ms; the next cast is hundreds of ms away.
                        const at = typeof performance !== 'undefined' ? performance.now() : Date.now();
                        const hitStep = at - lastHitAtRef.current < SAME_CAST_MS
                            ? Math.min(hitStepRef.current + 1, MAX_HIT_STEP)
                            : 0;
                        hitStepRef.current = hitStep;
                        lastHitAtRef.current = at;
                        playSfx(impactCue(element, effectiveness), {
                            intensity: Math.min(1, frac),
                            pitch: pitchForDamage(frac),
                            // Each target of a Side card is the next of a stated series — see
                            // `SfxOptions.step`. Without it the 40ms stagger falls inside the 60ms
                            // coalescing window and three bodies take one audible hit.
                            step: hitStep,
                        });
                        if (frac >= HIT_BIG_FRACTION || isLethal) playSfx('hitBig', { intensity: 1 });
                    }
                    if (isLethal) {
                        // A power-down, not a scream: 147 §8 — they are robots. The cry goes under
                        // it, which is the Pokémon model (one call, on entry and on faint).
                        playSfx('kill');
                        const cry = cryCue(target?.definitionId);
                        if (cry) playSfx(cry);
                    }
                    const color =
                        element && element !== 'None' ? getElementAccent(element) : NEUTRAL_DAMAGE_COLOR;
                    pushFloat(targetId, isCrit ? 'crit' : 'damage', `-${amount}`, color);
                    setVfx(prev => {
                        const unit = prev.unitFx[targetId] ?? EMPTY_UNIT_FX;
                        return {
                            // Spread, unlike every sibling branch, which listed both fields by
                            // hand. That was safe while `VfxState` had exactly two fields and
                            // silently dropped the third the moment one was added.
                            ...prev,
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
                    /*
                     * 147d. The two stances keep their own synthesized cues — they are the only
                     * statuses that change how a whole unit BEHAVES, and 147 §8 left them out of
                     * the sample pack for that reason. Everything else is the STS family model:
                     * up for a buff, down for a debuff, and a cue of its own for the two that put
                     * a wall in front of a body.
                     */
                    if (event.status === 'DarkStance') {
                        playSfx('stanceDark');
                    } else if (event.status === 'LightStance') {
                        playSfx('stanceLight');
                    } else {
                        playSfx(statusCue(event.status), { pitch: statusPitch(event.status) });
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
                case 'STATUS_REMOVED': {
                    // 147d. A status ending is news too — a shield gone is a target that just got
                    // softer, and it had no sound at all before this row.
                    playSfx('statusOff');
                    return;
                }
                case 'PROGRAM_DISCARDED': {
                    playSfx('cardDiscard');
                    return;
                }
                case 'DECK_SHUFFLED': {
                    playSfx('shuffle');
                    return;
                }
                case 'HOOK_FIRED': {
                    /*
                     * 147d. One cue per Early Access OS, the family blip for the rest. The engine
                     * only fires this for hooks that actually DID something (`emitHookFired`'s
                     * own predicate), so this is not the sound of a hook being checked.
                     */
                    playSfx(hookCue(findEntity(event.ownerId), event.osId, event.daemonId));
                    return;
                }
                case 'PROGRAM_PLAYED': {
                    /*
                     * 147d. The card leaves the hand, then the element leaves the caster — the
                     * two halves of 146c's cast, and they are different sounds because they are
                     * different moments. The enemy's card is the same whoosh three semitones
                     * down (147 §8), which is the cheapest possible "that was not you".
                     */
                    const fromPlayer = isPlayerSide(stateRef.current, event.sourceId);
                    playSfx('cardFly', { pitch: fromPlayer ? 1 : semitones(-3) });
                    playSfx(castCue(GetProgramData(event.programId)?.element));
                    triggerLunge(event.sourceId);
                    // The reveal is NOT auto-expired on a timer. A timer would race the enemy
                    // loop's own hold, and the next play (or the turn ending) is the honest thing
                    // that should replace it - a card stays up until something else happens, which
                    // is what makes it readable when the AI is thinking on the same thread.
                    const source = findEntity(event.sourceId);
                    const target = findEntity(event.targetId);
                    const s = stateRef.current;
                    setVfx(prev => ({
                        ...prev,
                        playedCard: {
                            key: revealKeyRef.current++,
                            dataId: event.programId,
                            sourceId: event.sourceId,
                            targetId: event.targetId,
                            fromPlayer: s?.playerParty.some(e => e.id === event.sourceId) ?? false,
                            sourceName: source?.name ?? '',
                            targetName: target?.name ?? '',
                        },
                    }));
                    return;
                }
                case 'CARD_DRAWN': {
                    // Only the player's deck ticks audibly; the 35ms coalescer
                    // collapses multi-card draws into a single soft tick.
                    if (event.ownerId === 'PLAYER') playSfx('cardDraw');
                    return;
                }
                case 'TURN_END': {
                    // 147d. The player's half only: an enemy turn ending is the player's turn
                    // starting, and both would be two sounds for one moment.
                    if (event.activeSide === 'PLAYER') playSfx('turnEnd');
                    return;
                }
                case 'TURN_START': {
                    playSfx(event.activeSide === 'PLAYER' ? 'turnPlayer' : 'turnEnemy');
                    // A reveal must not outlive the turn that produced it: the turn banner is the
                    // next thing the player reads, and a stale card under it says the wrong side
                    // just acted.
                    setVfx(prev => (prev.playedCard === null ? prev : { ...prev, playedCard: null }));
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

    return { unitFx: vfx.unitFx, shakeKey: vfx.shakeKey, triggerLunge, playedCard: vfx.playedCard };
}
