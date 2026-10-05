import React from 'react';
import { globalBattleEventBus } from '../../engine/events';
import type { IBattleState, StatusType } from '../../engine/types';
import { STATUS_COLORS } from '../../engine/data/statusGlossary';
import { GetProgramData } from '../../engine/data/programRegistry';
import { JS_COLOR } from '../theme/jsColors';
import { getElementAccent } from '../utils/contrastText';
import { playSfx, primeSfxSamples } from '../audio/AudioEngine';
import {
    castCue, causeCue, cryCue, HIT_BIG_FRACTION, hookCue, impactCue,
    shieldCue, statusCue, tickCue,
} from '../audio/battleCues';
import { pitchForDamage, pitchForStacks, semitones } from '../audio/limiters';
import { statusFloatText, absorbedAmount } from '../vfx/statusBurst';
import { HOOK_BEAT_DELAY_MS, hookBeatLabel, hookFloatText, isHookStatus } from '../vfx/hookStatusBeat';
import { nextOverflowRemaining, overflowText } from '../utils/statusOverflow';
import { driverText } from '../labels/driverText';
import { RESISTED_AT, SUPER_EFFECTIVE_AT, damageSeverity } from '../vfx/impact/impactMath';
import { activeProfile } from '../vfx/tiers/activeTier';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import { type StageMoment, onStageMoment } from '../vfx/impact/stageMoments';
import { type CardSignal, onCardSignal } from '../vfx/presenter/cardSignals';

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

/**
 * `proc` is ticket 16's: a Driver's NAME rising off the member whose copy fired. The Driver law is
 * PROC-VISIBLE, and a float on the unit is the half of that law the eye is already on — the chip in
 * the top bar flashes at the same moment for the half of the screen it is not.
 */
export type FloatKind = 'damage' | 'crit' | 'heal' | 'absorbed' | 'proc' | 'status' | 'tag';

export interface CombatFloat {
    id: number;
    kind: FloatKind;
    text: string;
    color: string;
    /** 0..5 vertical slot (ticket 167h) so rapid hits stack instead of overlapping dead-center. */
    slot: number;
    /** TICKET 194k-4: a damage number's font size in px, `TierProfile.damageNumberPx(s)` for this hit. */
    px?: number;
}

export interface UnitFx {
    floats: CombatFloat[];
    /** Increments on every damaging hit; keys the flash overlay + shake. */
    hitKey: number;
    /** How hard the last hit landed, 0..1 (`damageSeverity`): the shake reads it. */
    hitIntensity: number;
    /** Increments on every hit that flashes the body white (190e). Stays put with the flashes setting off. */
    flashKey: number;
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

/*
 * TICKET 189e DELETED `PLAYED_CARD_REVEAL_MS` (1.2 s) AND `PLAYER_CARD_HOLD_MS` (1.5 s).
 *
 * The reveal's time was a number nobody could tune against what was happening on the board: the
 * enemy loop slept the first, and the player's own card left on the second whether its sequence was
 * a chip or a kill. A card now arrives, the enemy's hovers 1 s (`ENEMY_HOVER_MS`, Henry: *"Before
 * makes more sense"*), the attack plays, and the card leaves when ITS SEQUENCE ENDS
 * (`presenter/castBeat`). The enemy loop waits for the presenter to be idle instead of for a
 * timer. Ticket 127's point survives: the time a card is on screen is information, not dead air.
 */

export interface BattleVfx {
    unitFx: Record<string, UnitFx>;
    /** Manually nudge a unit's lunge (used for enemy EXECUTE_INTENT, which emits no PROGRAM_PLAYED). */
    triggerLunge: (entityId: string) => void;
    /** The most recent play, for the centre-screen reveal. Null once it has aged out. */
    playedCard: PlayedCardAnnouncement | null;
}

export const EMPTY_UNIT_FX: UnitFx = {
    floats: [],
    hitKey: 0,
    hitIntensity: 0,
    flashKey: 0,
    healKey: 0,
    statusKey: 0,
    statusColor: JS_COLOR.text,
    lungeKey: 0,
};

/** Hits >= this fraction of max HP render as crits (bigger, rotated, glowing). */
const CRIT_FRACTION = 0.25;
/** Cap concurrent floats per unit; oldest are dropped beyond this. */
const MAX_FLOATS_PER_UNIT = 8;
/** Must outlive the 1.8 s float animation (`FxFloats`, ticket 167h). */
const FLOAT_LIFETIME_MS = 2000;
const FLOAT_SLOTS = 6;

const HEAL_COLOR = JS_COLOR.hp;
/** The Driver chip's violet (`.battle-driver-chip`), so the float and the chip read as one event. */
const DRIVER_PROC_COLOR = JS_COLOR.edge;
const ABSORB_COLOR = JS_COLOR.textMute;

/**
 * Small stable hash → pitch multiplier so each status type gets its own glitch
 * tick flavor (Burn ticks differently from Poison) without a hand-tuned table.
 */
function statusPitch(status: string): number {
    let h = 0;
    for (let i = 0; i < status.length; i++) h = (h * 31 + status.charCodeAt(i)) | 0;
    return 0.85 + (Math.abs(h) % 8) * 0.06; // 0.85 .. 1.27
}
/**
 * Impacts closer together than this are one cast landing on several bodies — ticket 147d.
 *
 * 146c staggers a cast's per-target impacts by `TRAIL_STAGGER_MS` (40 ms) and the next cast is
 * hundreds of milliseconds away, so there is a wide gap to put the line in. 150 sits in it.
 */
const SAME_CAST_MS = 150;

/**
 * A card hits at most a side — three bodies — so the series never climbs past a third step.
 *
 * 162e reuses it for repeated HOOK firings, where a card CAN exceed three (Serpent Flurry+ is four
 * swings). The clamp is right there too: the step is a readability device, not a count, and a
 * fourth rising semitone would be a pitch nobody can place rather than information.
 */
export const MAX_HIT_STEP = 2;

/**
 * Where in a stated series this event sits — 147b's `step`, DETECTED rather than counted.
 *
 * One rule, two callers since 162e: a cast's per-target impacts, and a hook firing once per swing
 * of a multi-hit card. Written once because it is one rule, and because two copies of "same key,
 * close enough in time, clamped" is the shape that drifts — the impact path would get a fix the
 * hook path did not.
 *
 * DETECTING is the load-bearing word. A bare counter would pitch a LONE event by whatever it
 * happened to be sitting at, and would also exempt it from coalescing — which is the protection
 * `step` is allowed to bypass precisely because the caller has stated a series. A different key,
 * or a gap wider than one cast, starts over at 0.
 */
export function nextSeriesStep(
    prior: { key: string; step: number; at: number },
    key: string,
    at: number,
    windowMs: number = SAME_CAST_MS,
): number {
    return prior.key === key && at - prior.at < windowMs
        ? Math.min(prior.step + 1, MAX_HIT_STEP)
        : 0;
}


const NEUTRAL_DAMAGE_COLOR = JS_COLOR.hpLow;
/** The matchup tags of 190e: amber for super effective, the muted grey for resisted. */
const SUPER_TAG_COLOR = 'var(--amber)';
const RESISTED_TAG_COLOR = JS_COLOR.textMute;

interface VfxState {
    unitFx: Record<string, UnitFx>;
    playedCard: PlayedCardAnnouncement | null;
}

export function useBattleVfx(battleState: IBattleState | null): BattleVfx {
    const [vfx, setVfx] = React.useState<VfxState>({ unitFx: {}, playedCard: null });

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
    /*
     * The same series detection for a HOOK firing several times in one cast — ticket 162e.
     *
     * EMBER_FUSE moved to a per-hit trigger, so Pack Tactics now fires it three times inside one
     * reducer tick. Three `playSfx` calls with the same cue name land in the same millisecond,
     * which is well inside 147b's 60 ms coalescing window: without a `step` the player would HEAR
     * ONE PROC while the board took three Burn, and the audio would be telling them something
     * untrue about the thing they are trying to learn.
     *
     * Keyed on the hook id rather than counted blind, for the reason `nextSeriesStep` gives and one
     * more: two different firmware firing in the same beat are not a series, they are two events,
     * and stepping the second would pitch it for no reason the player could work out.
     */
    const hookStepRef = React.useRef<{ key: string; step: number; at: number }>({ key: '', step: 0, at: 0 });
    const slotRef = React.useRef<Record<string, number>>({});
    // Pending timeouts, cleared on unmount (pendingTimeoutsRef pattern from MingmingUnit).
    const pendingTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
    // TICKET 166b: STATUS_APPLIED events from one reducer burst, merged by body + status.
    // 184b: `overflow` is the pile left behind when one of the merged applications set it off.
    const statusBurstRef = React.useRef<Map<string, { targetId: string; status: StatusType; stacks: number; overflow?: number }> | null>(null);
    /*
     * TICKET 171f: statuses a HOOK applied (EMBER_FUSE's Burn), held out of the burst above and
     * played as their own beat after the card. Keyed hookId|body|status so Pack Tactics' three fuses
     * read as one "+3 Burn · EMBER_FUSE". `label` and `sound` arrive with the HOOK_FIRED that follows
     * the statuses in the same burst; the sound waits for the float so the two land together.
     */
    const hookBurstRef = React.useRef<{
        entries: Map<string, { hookId: string; targetId: string; status: StatusType; stacks: number; overflow?: number }>;
        labels: Map<string, string | undefined>;
        sounds: Array<() => void>;
    } | null>(null);

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
        const pushFloat = (entityId: string, kind: FloatKind, text: string, color: string, px?: number) => {
            const id = floatIdRef.current++;
            const slot = (slotRef.current[entityId] = ((slotRef.current[entityId] ?? -1) + 1) % FLOAT_SLOTS);
            setVfx(prev => {
                const unit = prev.unitFx[entityId] ?? EMPTY_UNIT_FX;
                let floats = [...unit.floats, { id, kind, text, color, slot, ...(px === undefined ? {} : { px }) }];
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

        const flushStatusBurst = () => {
            const burst = statusBurstRef.current;
            statusBurstRef.current = null;
            if (!burst || burst.size === 0) return;
            const entries = [...burst.values()];

            // One sound per distinct status, in the order they arrived.
            const sounded = new Set<StatusType>();
            for (const entry of entries) {
                if (sounded.has(entry.status)) continue;
                sounded.add(entry.status);
                /*
                 * 147d. The two stances keep their own synthesized cues — they are the only
                 * statuses that change how a whole unit BEHAVES, and 147 §8 left them out of
                 * the sample pack for that reason. Everything else is the STS family model:
                 * up for a buff, down for a debuff, and a cue of its own for the two that put
                 * a wall in front of a body.
                 */
                if (entry.status === 'DarkStance') {
                    playSfx('stanceDark');
                } else if (entry.status === 'LightStance') {
                    playSfx('stanceLight');
                } else {
                    playSfx(statusCue(entry.status), { pitch: statusPitch(entry.status) });
                }
            }

            // One ring bump per body, coloured by the last status that body received.
            const ringColour = new Map<string, string>();
            for (const entry of entries) ringColour.set(entry.targetId, STATUS_COLORS[entry.status as StatusType] ?? JS_COLOR.textDim);
            setVfx(prev => {
                const unitFx = { ...prev.unitFx };
                for (const [targetId, colour] of ringColour) {
                    const unit = unitFx[targetId] ?? EMPTY_UNIT_FX;
                    unitFx[targetId] = { ...unit, statusKey: unit.statusKey + 1, statusColor: colour };
                }
                return { ...prev, unitFx };
            });

            // One float per body per status, with the stack count.
            for (const entry of entries) {
                // 184b: a pile that went off says OVERFLOW and what is left, not "+4" on a badge
                // that has just dropped to 2.
                const text = entry.overflow !== undefined
                    ? overflowText(entry.status, entry.overflow)
                    : statusFloatText(entry.status, entry.stacks);
                pushFloat(entry.targetId, 'status', text, STATUS_COLORS[entry.status as StatusType] ?? JS_COLOR.textDim);
            }
        };

        const flushHookBurst = () => {
            const burst = hookBurstRef.current;
            hookBurstRef.current = null;
            if (!burst) return;
            for (const sound of burst.sounds) sound();
            const entries = [...burst.entries.values()];
            setVfx(prev => {
                const unitFx = { ...prev.unitFx };
                for (const entry of entries) {
                    const unit = unitFx[entry.targetId] ?? EMPTY_UNIT_FX;
                    unitFx[entry.targetId] = {
                        ...unit, statusKey: unit.statusKey + 1, statusColor: STATUS_COLORS[entry.status] ?? JS_COLOR.textDim,
                    };
                }
                return { ...prev, unitFx };
            });
            for (const entry of entries) {
                const label = burst.labels.get(entry.hookId);
                const text = entry.overflow !== undefined
                    ? [overflowText(entry.status, entry.overflow), label].filter(Boolean).join(' · ')
                    : hookFloatText(entry.status, entry.stacks, label);
                pushFloat(entry.targetId, 'status', text, STATUS_COLORS[entry.status] ?? JS_COLOR.textDim);
            }
        };

        const findEntity = (id: string) => {
            const s = stateRef.current;
            if (!s) return undefined;
            return s.playerParty.find(e => e.id === id) ?? s.enemyParty.find(e => e.id === id);
        };

        /**
         * A damage or heal moment LANDS (189d): the float, the sounds, the flash. It used to be the
         * `DAMAGE_TAKEN` and `HEAL` cases of the handler below; the logic is unchanged, only the
         * moment it runs at is, and it now reads the moment (captured from the PRE-burst state, so a
         * kill is a kill) instead of looking the body up as it goes.
         */
        const landMoment = (moment: StageMoment): void => {
            if (moment.kind === 'heal') {
                playSfx('heal');
                pushFloat(moment.targetId, 'heal', `+${moment.amount}`, HEAL_COLOR);
                setVfx(prev => {
                    const unit = prev.unitFx[moment.targetId] ?? EMPTY_UNIT_FX;
                    return {
                        ...prev,
                        unitFx: {
                            ...prev.unitFx,
                            [moment.targetId]: { ...unit, healKey: unit.healKey + 1 },
                        },
                    };
                });
                return;
            }

            const { targetId, absorbed, applied, element } = moment;
            /*
             * RULING 2 (Henry, 2026-08-24): *"I don't see damage indicators when going against bark
             * shield. I need to know how much bark I take off."* The shield portion gets its own
             * float, from `absorbed` (the same record the card face reads), because a shield and HP
             * are two resources coming off two bars.
             *
             * ── TICKET 147d: DAMAGE IS FOUR DIFFERENT SOUNDS ───────────────────────────────────
             * A Burn tick, a toll paid and a sword landing must not all play `hit`: 147 §4 is
             * explicit that a tick is *"**never** the impact sound"*, and the player has to be able
             * to tell "the board is hurting me" from "I am being hit" with their eyes elsewhere.
             */
            const isHit = moment.kind === 'hit';
            if (moment.kind === 'tick') {
                playSfx(tickCue(moment.status), { pitch: pitchForStacks(moment.stacks) });
            } else if (moment.kind === 'cost') {
                const selfInflicted = causeCue(moment.cause);
                if (selfInflicted) playSfx(selfInflicted);
            }

            if (absorbed > 0) {
                pushFloat(targetId, 'absorbed', `-${absorbedAmount(absorbed)} 🛡`, ABSORB_COLOR);
            }
            /*
             * Three shield moments, not one (147 §8): the bark held (`blockedByBark`), the bark broke
             * and the rest landed (`barkBreak`), or something reduced the hit to nothing without a
             * shield to credit (`absorbedNoDamage`).
             */
            if (isHit) {
                const shield = shieldCue(absorbed, applied);
                if (shield) playSfx(shield);
            }

            if (applied <= 0) {
                // Nothing reached HP. The shield float above is the whole readout; the wordy
                // fallback is kept only for an absorption we could not quantify.
                if (absorbed <= 0) pushFloat(targetId, 'absorbed', 'ABSORBED', ABSORB_COLOR);
                return;
            }
            const frac = moment.maxHp > 0 ? applied / moment.maxHp : 0;
            const isCrit = (isHit && moment.isCritical) || frac >= CRIT_FRACTION;
            /*
             * THE IMPACT LADDER — 147 §8. Effectiveness decides the cue, damage decides the pitch and
             * whether the sub-thump is layered under it, and a lethal hit adds the power-down and the
             * dying body's cry on top. Ticks and tolls made their own sound above.
             *
             * 189d: each target of a card is the next of a stated series (`step`, counted by the
             * cast, not detected by the clock), so the 40 ms stagger does not fall inside the 60 ms
             * coalescing window and three bodies take three audible hits.
             */
            if (isHit) {
                playSfx(impactCue(element, moment.effectiveness), {
                    intensity: Math.min(1, frac),
                    pitch: pitchForDamage(frac),
                    step: Math.min(moment.step, MAX_HIT_STEP),
                });
                if (frac >= HIT_BIG_FRACTION || moment.isLethal) playSfx('hitBig', { intensity: 1 });
            }
            if (moment.isLethal) {
                // A power-down, not a scream: 147 §8 — they are robots. The cry goes under it, which
                // is the Pokémon model (one call, on entry and on faint).
                playSfx('kill');
                const cry = cryCue(moment.definitionId);
                if (cry) playSfx(cry);
            }
            const color =
                element && element !== 'None' ? getElementAccent(element) : NEUTRAL_DAMAGE_COLOR;
            pushFloat(targetId, isCrit ? 'crit' : 'damage', `-${applied}`, color, activeProfile().damageNumberPx(damageSeverity(applied, moment.maxHp)));
            /*
             * TICKET 190e: the matchup, named on the body. It is a gameplay tell (the type chart landing),
             * so it reads as words and not only as a bigger burst. Hits only: a tick or a toll has no matchup.
             */
            if (isHit) {
                if (moment.effectiveness >= SUPER_EFFECTIVE_AT) pushFloat(targetId, 'tag', 'SUPER EFFECTIVE', SUPER_TAG_COLOR);
                else if (moment.effectiveness <= RESISTED_AT) pushFloat(targetId, 'tag', 'RESISTED', RESISTED_TAG_COLOR);
            }
            // The white flash is the player's own switch (`flashes`), read as the hit lands so a change
            // made in the settings overlay takes effect on the next blow.
            const flash = resolveVfxGates(loadSettings()).flashes;
            setVfx(prev => {
                const unit = prev.unitFx[targetId] ?? EMPTY_UNIT_FX;
                return {
                    ...prev,
                    unitFx: {
                        ...prev.unitFx,
                        // `hitIntensity` is the hit's SEVERITY now (189d): the same 0..1 the
                        // hit-stop and the shakes run off.
                        [targetId]: {
                            ...unit,
                            hitKey: unit.hitKey + 1,
                            flashKey: flash ? unit.flashKey + 1 : unit.flashKey,
                            hitIntensity: damageSeverity(applied, moment.maxHp),
                        },
                    },
                };
            });
        };
        const unsubscribeMoments = onStageMoment(landMoment);
        /**
         * A card's life on the stage (189e), from the presenter: it flies in (reveal + whoosh),
         * launches the element (the cast sound; the caster's pose is the presenter's since 190c), and leaves when its sequence ends.
         * 147d: *"The card leaves the hand, then the element leaves the caster — … different sounds
         * because they are different moments. The enemy's card is the same whoosh three semitones
         * down."*
         */
        const landCard = (signal: CardSignal): void => {
            const { card } = signal;
            if (signal.kind === 'in') {
                playSfx('cardFly', { pitch: card.fromPlayer ? 1 : semitones(-3) });
                setVfx(prev => ({ ...prev, playedCard: card }));
            } else if (signal.kind === 'launch') {
                playSfx(castCue(GetProgramData(card.dataId)?.element));
                // The caster's lunge is its pose now (190c), sent by the cast's `pose` beat.
            } else {
                // A newer card may already have replaced it: the key check makes that a no-op.
                setVfx(prev => (prev.playedCard?.key === card.key ? { ...prev, playedCard: null } : prev));
            }
        };
        const unsubscribeCards = onCardSignal(landCard);

        const unsubscribe = globalBattleEventBus.subscribe(event => {
            switch (event.type) {
                /*
                 * TICKET 189d — `DAMAGE_TAKEN` AND `HEAL` ARE NOT HEARD HERE ANY MORE.
                 *
                 * The engine says them at play, all at once. The presenter says them again at the
                 * impact, as a stage moment (`vfx/impact/stageMoments`), and `landMoment` below is
                 * where the number, the shield float, the impact ladder and the heal float live now.
                 */
                case 'STATUS_APPLIED': {
                    // TICKET 171f: a hook's status is its own beat, after the card. See hookBurstRef.
                    if (isHookStatus(event.source)) {
                        let hooks = hookBurstRef.current;
                        if (!hooks) {
                            hooks = { entries: new Map(), labels: new Map(), sounds: [] };
                            hookBurstRef.current = hooks;
                            pendingTimeoutsRef.current.push(setTimeout(flushHookBurst, HOOK_BEAT_DELAY_MS));
                        }
                        const hookKey = `${event.source.hookId}|${event.targetId}|${event.status}`;
                        const before = hooks.entries.get(hookKey);
                        hooks.entries.set(hookKey, {
                            hookId: event.source.hookId, targetId: event.targetId, status: event.status,
                            stacks: (before?.stacks ?? 0) + event.stacks,
                            overflow: nextOverflowRemaining(before?.overflow, event.stacks, event.overflowRemaining),
                        });
                        return;
                    }
                    // TICKET 166b: gathered, not played. Every status of one cast arrives in the same
                    // synchronous reducer burst; a 0 ms timeout runs after the burst and plays it once.
                    let burst = statusBurstRef.current;
                    if (!burst) {
                        burst = new Map();
                        statusBurstRef.current = burst;
                        pendingTimeoutsRef.current.push(setTimeout(flushStatusBurst, 0));
                    }
                    const key = `${event.targetId}|${event.status}`;
                    const previous = burst.get(key);
                    burst.set(key, {
                        targetId: event.targetId, status: event.status, stacks: (previous?.stacks ?? 0) + event.stacks,
                        overflow: nextOverflowRemaining(previous?.overflow, event.stacks, event.overflowRemaining),
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
                     *
                     * 162e: and a hook can now fire several times in one cast, so it carries the
                     * same stated-series `step` a multi-target impact does. See `hookStepRef`.
                     */
                    const hookAt = Date.now();
                    const hookStep = nextSeriesStep(hookStepRef.current, event.hookId, hookAt);
                    hookStepRef.current = { key: event.hookId, step: hookStep, at: hookAt };
                    const cue = hookCue(findEntity(event.ownerId), event.osId, event.daemonId);
                    // TICKET 171f: a hook that put a status on someone this burst sounds with that
                    // status's float, after the card, rather than under the card.
                    const held = hookBurstRef.current;
                    if (held && [...held.entries.values()].some((entry) => entry.hookId === event.hookId)) {
                        held.labels.set(event.hookId, hookBeatLabel(event.osId, event.daemonId));
                        held.sounds.push(() => playSfx(cue, { step: hookStep }));
                        return;
                    }
                    playSfx(cue, { step: hookStep });
                    return;
                }
                /*
                 * TICKET 189e — `PROGRAM_PLAYED` IS NOT HEARD HERE ANY MORE.
                 *
                 * The card, the whoosh, the cast sound and the lunge are the presenter's, played in
                 * each cast's own turn (`presenter/cardSignals`): see `landCard` below. Heard at
                 * arrival, a burst of seven enemy casts showed one card, sounded seven whooshes at
                 * once and lunged seven casters together.
                 */
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
                    // 189e: no clearing of the reveal here. A card leaves when ITS sequence ends, so a
                    // stale card cannot outlive the turn that produced it, and clearing it on the
                    // event would pull a card out from under a sequence still playing.
                    return;
                }
                case 'LEVEL_UP': {
                    playSfx('levelUp');
                    return;
                }
                case 'DRIVER_PROC': {
                    // Ticket 16. The name, not the number: what a Driver did is already on the
                    // board as damage/heal/status floats of its own; what those floats cannot say
                    // is WHY, and the why is the Driver.
                    playSfx('driverProc');
                    pushFloat(event.ownerId, 'proc', driverText(event.driverId).name, DRIVER_PROC_COLOR);
                    return;
                }
                default:
                    return;
            }
        });

        const timeouts = pendingTimeoutsRef.current;
        return () => {
            unsubscribe();
            unsubscribeMoments();
            unsubscribeCards();
            timeouts.forEach(clearTimeout);
            timeouts.length = 0;
            statusBurstRef.current = null;
            hookBurstRef.current = null;
        };
    }, [triggerLunge]);

    return { unitFx: vfx.unitFx, triggerLunge, playedCard: vfx.playedCard };
}
