import type { IBattleState, ProgramEntity } from '../../../engine/types';

/**
 * The Daemons (Auras) installed on one side's units (TICKET 193b).
 *
 * A Daemon card leaves the hand and sits on `IBattleEntity.daemons`, in none of the four piles, so the
 * vanished-card and duplicate-id checks have to be told about it or every Aura played looks like a
 * card that disappeared.
 */
export function installedDaemons(state: IBattleState, side: 'player' | 'enemy'): ProgramEntity[] {
    const party = side === 'player' ? state.playerParty : state.enemyParty;
    return party.flatMap((unit) => unit.daemons ?? []);
}
