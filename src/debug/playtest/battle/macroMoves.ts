/**
 * TICKET 180d — THE MACROS THE RACK CAN FIRE RIGHT NOW.
 *
 * One move per (slot, caster, target) the game says will land: the targets a macro may be aimed at
 * come from its own `targeting` (the same cases `canFireMacro` resolves), and every candidate is
 * checked with `canFireMacro` itself, the predicate the arena's rack uses to grey a slot. A macro
 * the battle can never fire (the map reveal) is shown on the screen but gets no move.
 */
import { canFireMacro } from '../../../engine/battleReducer';
import { getMacro } from '../../../engine/data/macroRegistry';
import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { macroName } from '../gameText';
import type { Move } from '../types';
import { macroKey } from './keys';
import { fireMacro } from './play';

function targetsFor(state: IBattleState, targeting: string, source: IBattleEntity): IBattleEntity[] {
    const standing = (side: ReadonlyArray<IBattleEntity>): IBattleEntity[] => side.filter((e) => e.currentHp > 0);
    switch (targeting) {
        case 'SELF': return [source];
        case 'ENEMY': return standing(state.enemyParty);
        case 'ALLY': return standing(state.playerParty);
        case 'DOWNED_ALLY': return state.playerParty.filter((e) => e.currentHp <= 0);
        default: return [];
    }
}

export function macroMoves(state: IBattleState, rack: ReadonlyArray<string | null>): Move[] {
    const moves: Move[] = [];
    rack.forEach((macroId, slot) => {
        const macro = getMacro(macroId);
        if (!macroId || !macro) return;
        for (const source of state.playerParty.filter((e) => e.currentHp > 0)) {
            for (const target of targetsFor(state, macro.targeting, source)) {
                if (canFireMacro(state, { macroId, sourceId: source.id, targetId: target.id }) !== null) continue;
                moves.push({
                    key: macroKey(slot, source.id, target.id),
                    label: macro.targeting === 'SELF'
                        ? `Fire ${macroName(macroId)} (draught) from ${source.name}`
                        : `Fire ${macroName(macroId)} (draught) from ${source.name} → ${target.name}`,
                    apply: (world) => fireMacro(world, slot, source.id, target.id),
                });
            }
        }
    });
    return moves;
}
