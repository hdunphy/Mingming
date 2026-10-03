/**
 * THE DISPLAYED BOARD — ticket 189c. The HP, Bark and ghost chunk the player SEES, per body.
 *
 * The engine resolves a card in one synchronous burst, so the real state already holds the end of
 * the card while the trail is still on its way. This store is the screen's own copy: it starts equal
 * to the real state and moves only when the presenter says so, at the impact. The HP bar, the HP
 * text, the Bark band and the knocked-out look read it; targeting, the damage preview and every
 * engine call keep reading real state.
 *
 * # THE GHOST
 *
 * A hit leaves a pale chunk behind where the HP was. It holds for `GHOST_HOLD_MS` of game time and
 * then the bar lets it drain (the CSS transition is `GHOST_DRAIN_MS`). It is board state rather than
 * a CSS trick because the hold is game time: a hit-stop freezes it, battle speed scales it, and
 * Instant has none.
 *
 * # THE SAFETY NET
 *
 * `reconcile(state)` is called when the presenter has gone idle. The board must equal the real state
 * then; if a beat was missed (or an HP change arrived without an event) it snaps to real state and,
 * for HP, reports it, so a wrong number can never stay on screen. Bark is snapped silently: it
 * decays at a turn boundary with no event of its own.
 */

import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { barkShieldPoints } from '../../components/stage/barkShield';
import type { BattleClock } from '../clock/BattleClock';

/** §189c: the ghost chunk waits this long (game ms) before it drains. */
export const GHOST_HOLD_MS = 380;
/** §189c: and drains over this long. The bar's CSS transition reads it. */
export const GHOST_DRAIN_MS = 420;
/** §189c: the fill drains to the new value over this long. */
export const FILL_DRAIN_MS = 240;

export interface DisplayedUnit {
    /** HP the bar and the text show. */
    readonly hp: number;
    /** Where the pale chunk reaches. Never below `hp`. */
    readonly ghost: number;
    /** Bark Shield, in HP points. */
    readonly bark: number;
}

export interface BoardMismatch {
    readonly id: string;
    readonly shownHp: number;
    readonly realHp: number;
}

type Listener = () => void;

const sameUnit = (a: DisplayedUnit, b: DisplayedUnit): boolean =>
    a.hp === b.hp && a.ghost === b.ghost && a.bark === b.bark;

export class DisplayedBoard {
    private units = new Map<string, DisplayedUnit>();
    private maxHp = new Map<string, number>();
    /** Bumped on every drain request, so only the last hit's timer lets the ghost go. */
    private ghostSeq = new Map<string, number>();
    private cancels = new Map<string, () => void>();
    private listeners = new Set<Listener>();
    private version = 0;
    /** Called with what a reconcile had to correct. The app logs it; tests listen. */
    onMismatch: (mismatches: BoardMismatch[]) => void = () => undefined;

    constructor(private readonly clock: BattleClock) {}

    // ── reading ────────────────────────────────────────────────────────────────────────────

    unit(id: string): DisplayedUnit | undefined {
        return this.units.get(id);
    }

    /**
     * True when the board knows at least one body of this state. A battle with nobody in common is a
     * new battle; one body joining or leaving a fight in progress is not (`reconcile` adds it).
     */
    sharesBody(state: IBattleState): boolean {
        return rosterOf(state).some((entity) => this.units.has(entity.id));
    }

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    getVersion = (): number => this.version;

    // ── writing: the presenter, at the impact ───────────────────────────────────────────────

    /** A hit lands. `applied` comes off the HP, `absorbed` off the Bark band. */
    damage(id: string, applied: number, absorbed: number): void {
        const unit = this.units.get(id);
        if (!unit) return;
        const hp = Math.max(0, unit.hp - Math.max(0, applied));
        const bark = Math.max(0, unit.bark - Math.max(0, absorbed));
        // The pale chunk marks where the bar WAS, and keeps the highest mark through a run of hits.
        const ghost = applied > 0 ? Math.max(unit.ghost, unit.hp) : unit.ghost;
        this.set(id, { hp, ghost, bark });
        if (applied > 0) this.scheduleGhostDrain(id);
    }

    /** A heal lands. Capped at the body's max, and the ghost never sits below the fill. */
    heal(id: string, amount: number): void {
        const unit = this.units.get(id);
        if (!unit) return;
        const cap = this.maxHp.get(id) ?? Number.POSITIVE_INFINITY;
        const hp = Math.min(cap, unit.hp + Math.max(0, amount));
        this.set(id, { ...unit, hp, ghost: Math.max(unit.ghost, hp) });
        this.scheduleGhostDrain(id);
    }

    /** A Bark Shield was applied: the band grows by this many HP points. */
    gainBark(id: string, points: number): void {
        const unit = this.units.get(id);
        if (!unit || points <= 0) return;
        this.set(id, { ...unit, bark: unit.bark + points });
    }

    // ── the safety net ──────────────────────────────────────────────────────────────────────

    /** A new battle: the board equals the real state. */
    reset(state: IBattleState | null): void {
        this.dropTimers();
        this.units = new Map();
        this.maxHp = new Map();
        if (state) {
            for (const entity of rosterOf(state)) {
                this.units.set(entity.id, truth(entity));
                this.maxHp.set(entity.id, entity.maxHp);
            }
        }
        this.bump();
    }

    /**
     * The presenter is idle: the board must now equal the real state. Anything that differs is
     * snapped to real state. HP differences are reported (a missed beat); Bark is not.
     */
    reconcile(state: IBattleState): BoardMismatch[] {
        const mismatches: BoardMismatch[] = [];
        let changed = false;
        for (const entity of rosterOf(state)) {
            this.maxHp.set(entity.id, entity.maxHp);
            const shown = this.units.get(entity.id);
            const real = truth(entity);
            if (!shown) {
                this.units.set(entity.id, real);
                changed = true;
            } else if (shown.hp !== real.hp) {
                mismatches.push({ id: entity.id, shownHp: shown.hp, realHp: real.hp });
                this.units.set(entity.id, real);
                changed = true;
            } else if (shown.bark !== real.bark) {
                this.units.set(entity.id, { ...shown, bark: real.bark });
                changed = true;
            }
        }
        if (changed) this.bump();
        if (mismatches.length > 0) this.onMismatch(mismatches);
        return mismatches;
    }

    /** Leaving the battle: nothing pending, nothing shown. */
    clear(): void {
        this.reset(null);
    }

    // ── internals ───────────────────────────────────────────────────────────────────────────

    private set(id: string, next: DisplayedUnit): void {
        const unit = this.units.get(id);
        if (unit && sameUnit(unit, next)) return;
        this.units.set(id, next);
        this.bump();
    }

    private scheduleGhostDrain(id: string): void {
        const seq = (this.ghostSeq.get(id) ?? 0) + 1;
        this.ghostSeq.set(id, seq);
        this.cancels.get(id)?.();
        const cancel = this.clock.after(GHOST_HOLD_MS, () => {
            if (this.ghostSeq.get(id) !== seq) return;
            const unit = this.units.get(id);
            if (unit) this.set(id, { ...unit, ghost: unit.hp });
        });
        this.cancels.set(id, cancel);
    }

    private dropTimers(): void {
        for (const cancel of this.cancels.values()) cancel();
        this.cancels.clear();
        this.ghostSeq.clear();
    }

    private bump(): void {
        this.version += 1;
        for (const listener of this.listeners) listener();
    }
}

function rosterOf(state: IBattleState): IBattleEntity[] {
    return [...state.playerParty, ...state.enemyParty];
}

/** What the real state says a body looks like. */
function truth(entity: IBattleEntity): DisplayedUnit {
    return { hp: entity.currentHp, ghost: entity.currentHp, bark: barkShieldPoints(entity) };
}
