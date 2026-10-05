/**
 * TICKET 180e — A BATTLE'S INVARIANTS, checked after every move.
 *
 * HP stays between 0 and max and a shield is never negative; Energy is never negative; a card
 * instance id never appears twice; no card vanishes from a side's four piles (hand, draw pile,
 * discard, exhaust) or on a unit as an installed Daemon between one move and the next (a card may move
 * between them, or be made, but never disappear); and an open battle is never past the turn cap, which the tool ends it at.
 */
import type { IBattleState, ProgramEntity } from '../../../engine/types';
import { PLAYTEST_MAX_TURNS } from '../battleSim';
import type { Violation } from './violations';
import { installedDaemons } from './installedDaemons';

/** The four piles plus the Daemons installed on the side's units (193b). */
const sidePiles = (deck: IBattleState['playerDeck'], installed: ProgramEntity[]): ProgramEntity[] => [...deck.hand, ...deck.drawpile, ...deck.discard, ...deck.exhaust, ...installed];

export function battleInvariants(state: IBattleState, previous?: IBattleState): Violation[] {
    const found: Violation[] = [];
    for (const unit of [...state.playerParty, ...state.enemyParty]) {
        if (unit.currentHp < 0 || unit.currentHp > unit.maxHp) found.push({ name: 'hp-range', detail: `${unit.name} has ${unit.currentHp} HP of ${unit.maxHp}` });
        if (unit.tempHp < 0) found.push({ name: 'hp-range', detail: `${unit.name} has a negative shield (${unit.tempHp})` });
        if (unit.currentEnergy < 0) found.push({ name: 'energy-negative', detail: `${unit.name} has ${unit.currentEnergy} Energy` });
    }
    const player = sidePiles(state.playerDeck, installedDaemons(state, 'player'));
    const enemy = sidePiles(state.enemyDeck, installedDaemons(state, 'enemy'));
    const seen = new Set<string>();
    for (const card of [...player, ...enemy]) {
        if (seen.has(card.id)) found.push({ name: 'duplicate-card-id', detail: `battle card ${card.id} (${card.dataId}) is in more than one place` });
        seen.add(card.id);
    }
    if (previous) {
        for (const [label, was, now] of [['player', sidePiles(previous.playerDeck, installedDaemons(previous, 'player')), player], ['enemy', sidePiles(previous.enemyDeck, installedDaemons(previous, 'enemy')), enemy]] as const) {
            const still = new Set(now.map((c) => c.id));
            for (const card of was) if (!still.has(card.id)) found.push({ name: 'card-vanished', detail: `a ${label} card (${card.dataId}, ${card.id}) is in no pile after the move` });
        }
    }
    if (state.turn > PLAYTEST_MAX_TURNS) found.push({ name: 'turn-cap', detail: `the battle is on turn ${state.turn}, past the cap of ${PLAYTEST_MAX_TURNS}` });
    return found;
}
