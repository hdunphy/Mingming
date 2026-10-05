/**
 * STAGE MOMENTS — ticket 189d. The moment a hit, a tick, a price or a heal LANDS on the screen.
 *
 * The engine's events arrive at play, all at once. The collector (`useCastSequence`) turns each
 * damage or heal event into a moment and the presenter plays it on the clock, at the impact; every
 * listener (the floats and sounds in `useBattleVfx`, the hit-stop and shakes in
 * `useImpactFeedback`) hears it at that instant and never on the event itself. One bus for the
 * screen, written to by exactly one place.
 */

import type { Element, StatusType } from '../../../engine/types';

interface DamageMomentBase {
    readonly targetId: string;
    /** HP the hit took. */
    readonly applied: number;
    /** Bark Shield the hit took (what the shield float names). */
    readonly absorbed: number;
    readonly element: Element | undefined;
    readonly maxHp: number;
    /** Did this take the body down? Worked out from the burst's own HP, so two hits that kill together read as one kill. */
    readonly isLethal: boolean;
    /** For the cry a body gives as it goes. */
    readonly definitionId: string | undefined;
}

/** An attack landing. */
export interface HitMoment extends DamageMomentBase {
    readonly kind: 'hit';
    /** Who cast it, when a card is behind it (the attacker shudders in the freeze). */
    readonly sourceId: string | undefined;
    readonly isCritical: boolean;
    /** Type-chart multiplier against this body. */
    readonly effectiveness: number;
    /** Which target of the card this is, for the sound spacing (0 for a lone hit). */
    readonly step: number;
    /** How many bodies the card hit. */
    readonly targets: number;
}

/** A damage-over-time tick. */
export interface TickMoment extends DamageMomentBase {
    readonly kind: 'tick';
    readonly status: StatusType;
    /** Stacks the tick was worked out from, so it can rise with them. */
    readonly stacks: number;
}

/** A price the caster pays: recoil or toll. */
export interface CostMoment extends DamageMomentBase {
    readonly kind: 'cost';
    readonly cause: 'recoil' | 'toll';
}

export interface HealMoment {
    readonly kind: 'heal';
    readonly targetId: string;
    readonly amount: number;
}

/**
 * TICKET 198b-3: a status LANDING, said by the presenter when the orb arrives (or, after a damage
 * card, as the rider lands): the float, the sound and the plaque's ring bump play here, not when
 * the engine applied it at the start of the cast. The lab's `statusLand` floats "+2 Poison" as the
 * particles go off, and so does this. `overflow` is 184b's: the pile left after a detonation.
 */
export interface StatusMoment {
    readonly kind: 'status';
    readonly targetId: string;
    readonly status: StatusType;
    readonly stacks: number;
    readonly overflow?: number;
}

export type StageMoment = HitMoment | TickMoment | CostMoment | HealMoment | StatusMoment;
export type DamageMoment = HitMoment | TickMoment | CostMoment;

/** What the collector records from an event; the beat fills in what only the cast knows. */
export type MomentDraft =
    | Omit<HitMoment, 'sourceId' | 'step' | 'targets'>
    | TickMoment
    | CostMoment
    | HealMoment
    | StatusMoment;

export interface CastContext {
    readonly sourceId: string | undefined;
    readonly step: number;
    readonly targets: number;
}

export function finishMoment(draft: MomentDraft, context: CastContext): StageMoment {
    return draft.kind === 'hit' ? { ...draft, ...context } : draft;
}

type Listener = (moment: StageMoment) => void;
const listeners = new Set<Listener>();

export function onStageMoment(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emitStageMoment(moment: StageMoment): void {
    for (const listener of [...listeners]) listener(moment);
}
