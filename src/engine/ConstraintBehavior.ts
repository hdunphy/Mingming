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
    validate(_constraint: ProgramConstraint, pkg: ConstraintPackage): boolean {
        return pkg.source.currentEnergy >= pkg.cost;
    }
}



const CONSTRAINT_REGISTRY: Record<ProgramConstraintType, ConstraintBehavior> = {
    [ProgramConstraintType.HasStatus]: new HasStatusConstraintBehavior(),
    [ProgramConstraintType.NotStatus]: new NotStatusConstraintBehavior(),
    [ProgramConstraintType.HealthThreshold]: new HealthThresholdConstraintBehavior(),
    [ProgramConstraintType.Base]: new BaseConstraintBehavior(),
};

export function getConstraintBehavior(type: ProgramConstraintType): ConstraintBehavior {
    return CONSTRAINT_REGISTRY[type];
}