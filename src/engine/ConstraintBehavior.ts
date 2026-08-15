import { ProgramConstraintType, type IBattleEntity, type ProgramConstraint } from "./types";

export type ConstraintPackage = {
    source: IBattleEntity;
    cost: number;
}

export abstract class ConstraintBehavior {
    abstract readonly type: ProgramConstraintType;
    abstract validate(constraint: ProgramConstraint, pkg: ConstraintPackage): boolean;
}

export class HasStatusConstraintBehavior implements ConstraintBehavior {
    readonly type: ProgramConstraintType = ProgramConstraintType.HasStatus;
    validate(constraint: ProgramConstraint, pkg: ConstraintPackage): boolean {
        return pkg.source.statusEffects.some(effect => effect.type === constraint.value);
    }
}

export class NotStatusConstraintBehavior implements ConstraintBehavior {
    readonly type: ProgramConstraintType = ProgramConstraintType.NotStatus;
    validate(constraint: ProgramConstraint, pkg: ConstraintPackage): boolean {
        return !pkg.source.statusEffects.some(effect => effect.type === constraint.value);
    }
}

export class HealthThresholdConstraintBehavior implements ConstraintBehavior {
    readonly type: ProgramConstraintType = ProgramConstraintType.HealthThreshold;
    validate(constraint: ProgramConstraint, pkg: ConstraintPackage): boolean {
        return pkg.source.currentHp <= pkg.source.maxHp * (constraint.value as number);
    }
}

export class BaseConstraintBehavior implements ConstraintBehavior {
    readonly type: ProgramConstraintType = ProgramConstraintType.Base;
    validate(_constraint: ProgramConstraint, _pkg: ConstraintPackage): boolean {
        return _pkg.source.currentEnergy >= _pkg.cost;
    }
}

export class CardsDrawnTriggeredConstraintBehavior implements ConstraintBehavior {
    readonly type: ProgramConstraintType = ProgramConstraintType.CardsDrawnTriggered;
    validate(_constraint: ProgramConstraint, _pkg: ConstraintPackage): boolean {
        // Ticket 68: same stateless caveat as CardsDrawn below - this registry is the UI PREVIEW
        // path and has no battle state, so it cannot see the counter. The real gameplay check is
        // ConditionValidator.evaluateCardConstraint (battleReducer:115). Returning true here means
        // the preview may show a refund that the reducer then declines, which is the pre-existing
        // behaviour for CardsDrawn and is deliberately not changed by this ticket.
        return true;
    }
}

export class CardsDrawnConstraintBehavior implements ConstraintBehavior {
    readonly type: ProgramConstraintType = ProgramConstraintType.CardsDrawn;
    validate(_constraint: ProgramConstraint, _pkg: ConstraintPackage): boolean {
        // Since we don't have state here, we might need to handle this differently or return true if unknown.
        // For UI preview, it's safer to return true if we can't verify.
        return true;
    }
}



const CONSTRAINT_REGISTRY: Record<ProgramConstraintType, ConstraintBehavior> = {
    [ProgramConstraintType.HasStatus]: new HasStatusConstraintBehavior(),
    [ProgramConstraintType.NotStatus]: new NotStatusConstraintBehavior(),
    [ProgramConstraintType.HealthThreshold]: new HealthThresholdConstraintBehavior(),
    [ProgramConstraintType.Base]: new BaseConstraintBehavior(),
    [ProgramConstraintType.CardsDrawn]: new CardsDrawnConstraintBehavior(),
    [ProgramConstraintType.CardsDrawnTriggered]: new CardsDrawnTriggeredConstraintBehavior(),
};

export function getConstraintBehavior(type: ProgramConstraintType): ConstraintBehavior {
    return CONSTRAINT_REGISTRY[type] || CONSTRAINT_REGISTRY[ProgramConstraintType.Base];
}