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
    // TICKET 166e (Henry, 2026-09-27): "only on the last elite you can win one. The others should
    // give extra scrap or maybe a macro instead." The last elite is any elite in the FINAL biome -
    // the one whose exit is the gym (decision E3). Ambushes and earlier elites pay the macro pick (E1).
    if (input.nodeKind === 'elite' && input.biomeIndex === input.biomeCount - 1) return 'patch';
    if (input.nodeKind === 'elite' || input.nodeKind === 'ambush') return 'macro';
    return null;
}
