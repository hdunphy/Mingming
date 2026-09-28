import type { IGauntletProgress, NodeKind } from '../runTypes';

/** The extra prize a won fight pays beside scrap, cards and blueprints. */
export type FightBonus = 'patch' | 'macro' | null;

export interface FightBonusInput {
    readonly nodeKind: NodeKind;
    readonly biomeIndex: number;
    readonly biomeCount: number;
    readonly gauntlet: IGauntletProgress | null;
}

export function fightBonusFor(input: FightBonusInput): FightBonus {
    if (input.nodeKind === 'gym') {
        // TICKET 166d: a macro after gauntlet fights 1 and 2. The boss fight ends the run; nothing to spend it on.
        if (!input.gauntlet) return null;
        return input.gauntlet.fightIndex < input.gauntlet.totalFights - 1 ? 'macro' : null;
    }
    // Everything below is unchanged behaviour until 166e: elites and ambushes pay the patch offer.
    if (input.nodeKind === 'elite' || input.nodeKind === 'ambush') return 'patch';
    return null;
}
