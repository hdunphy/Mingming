/**
 * TICKET 180d — THE AGENT'S MOVES IN A BATTLE: a card, a macro, END TURN.
 *
 * Each is the game's own reducer called the way `BattleArena` calls it. A card is `PLAY_PROGRAM`
 * through `battleReducer`; a macro is the two-slice write (`FIRE_MACRO`, then the gauntlet's revive
 * hook, then `consumeMacro`), refused up front when `canFireMacro` says the shot will not land;
 * END TURN hands the turn to the enemy AI (`enemyTurn.ts`) and back.
 *
 * A move the reducer refuses silently changes nothing and says so, as the other screens do. A battle
 * that ends (a side is down, or the turn cap passes) is settled by `fightSettle.ts`, exactly as a
 * fight the game's AI played in one go. An engine throw ends the run as abandoned with the message kept.
 */
import { battleOutcome } from '../../../engine/battleOutcome';
import { canFireMacro, type BattleAction } from '../../../engine/battleReducer';
import { getMacro, revivedHpFor } from '../../../engine/data/macroRegistry';
import type { IBattleState } from '../../../engine/types';
import { consumeMacro, reviveGauntletMember } from '../../../ui/store/runSlice';
import { PLAYTEST_MAX_TURNS, cardNameFor, mergeHits, sortedHits, step, type HitTotal } from '../battleSim';
import { flag } from '../findings';
import { failFight, settleFight } from '../fightSettle';
import { battleKeyOf } from './keys';
import type { BattleFlow, World } from '../types';
import { runOf } from '../types';
import { runEnemyTurn } from './enemyTurn';
import { stabilizeIds } from './stableIds';
import { downedLines, hitLines } from './news';

const nameIn = (state: IBattleState, id: string): string =>
    [...state.playerParty, ...state.enemyParty].find((e) => e.id === id)?.name ?? id;

function mergedInto(held: ReadonlyArray<HitTotal>, more: ReadonlyArray<HitTotal>): HitTotal[] {
    const table = new Map<string, HitTotal>();
    mergeHits(table, held);
    mergeHits(table, more);
    return sortedHits(table);
}

/** The battle is over: close it and settle the fight. `truncated` is a turn cap or a state that would not move. */
function finish(world: World, flow: BattleFlow, state: IBattleState, hits: ReadonlyArray<HitTotal>, truncated: boolean): void {
    world.view.battle = null;
    settleFight(world, flow, {
        state, winner: truncated ? 'DRAW' : (battleOutcome(state) ?? 'DRAW'), turns: state.turn, truncated, hits,
    });
}

/** Keep going, or finish when the state says the fight is decided. */
function advance(world: World, flow: BattleFlow, state: IBattleState, hits: ReadonlyArray<HitTotal>, truncated = false): void {
    const overTheCap = battleOutcome(state) === null && state.turn > PLAYTEST_MAX_TURNS;
    if (truncated || overTheCap || battleOutcome(state) !== null) finish(world, flow, state, hits, truncated || overTheCap);
    else world.view.battle = { ...flow, state, hits };
}

/** One of the player's moves (a card or a macro) through the reducer. */
function applyAction(world: World, flow: BattleFlow, action: BattleAction, said: string): boolean {
    const moved = step(flow.state, action);
    if (!moved.changed) {
        world.view.news.push('Nothing happened: the game would not do that.');
        flag(world, 'move-refused', `the battle offered "${battleKeyOf(action)}" and the reducer refused it`);
        return false;
    }
    const named = stabilizeIds(moved.state, flow.minted);
    world.lastPlay = { action, before: flow.state, after: named.state, hits: moved.hits };
    world.view.news.push(said, ...hitLines(moved.hits), ...downedLines(flow.state, named.state));
    advance(world, { ...flow, minted: named.minted }, named.state, mergedInto(flow.hits, moved.hits));
    return true;
}

export function playCard(world: World, action: Extract<BattleAction, { type: 'PLAY_PROGRAM' }>): void {
    const flow = world.view.battle!;
    try {
        const { sourceId, targetId } = action.payload;
        const name = cardNameFor(flow.state, action) ?? 'a card';
        applyAction(world, flow, action, `${nameIn(flow.state, sourceId)} played ${name} on ${nameIn(flow.state, targetId)}.`);
    } catch (error) {
        failFight(world, error);
    }
}

export function fireMacro(world: World, slot: number, sourceId: string, targetId: string): void {
    const flow = world.view.battle!;
    const run = runOf(world);
    const macroId = run.macros[slot];
    const macro = getMacro(macroId);
    if (!macroId || !macro) {
        world.view.news.push('Nothing happened: that rack slot is empty.');
        return;
    }
    const payload = { macroId, sourceId, targetId };
    if (canFireMacro(flow.state, payload) !== null) {
        world.view.news.push(`Nothing happened: ${macro.name} cannot be fired there.`);
        flag(world, 'move-refused', `the battle offered macro slot ${slot} and canFireMacro refused it`);
        return;
    }
    try {
        const fired = applyAction(world, flow, { type: 'FIRE_MACRO', payload }, `${nameIn(flow.state, sourceId)} fired ${macro.name} at ${nameIn(flow.state, targetId)}.`);
        if (!fired) return;
        // The run hears about a revive, then the slot is spent: the arena's order (BattleArena, ticket 18).
        if (run.gauntlet) {
            const revive = macro.actions.find((a) => a.type === 'REVIVE');
            const target = flow.state.playerParty.find((p) => p.id === targetId);
            if (revive && target) {
                world.store.dispatch(reviveGauntletMember({
                    memberId: target.id, hp: revivedHpFor(target.maxHp, (revive as { percent?: number }).percent),
                }));
            }
        }
        world.store.dispatch(consumeMacro(slot));
    } catch (error) {
        failFight(world, error);
    }
}

/** END TURN: the enemy side plays its turn with the game's AI, and the turn comes back to the player. */
export function endTurn(world: World): void {
    const flow = world.view.battle!;
    try {
        const ended = step(flow.state, { type: 'END_TURN' });
        if (!ended.changed) {
            finish(world, flow, flow.state, flow.hits, true);
            return;
        }
        const named = stabilizeIds(ended.state, flow.minted);
        const enemy = runEnemyTurn(named.state, named.minted);
        const turn = enemy.hits.length > 0
            ? ['The enemy took its turn:', ...hitLines(enemy.hits)]
            : ['The enemy took its turn without hitting anyone.'];
        world.view.news.push(...turn, ...downedLines(flow.state, enemy.state));
        advance(world, { ...flow, minted: enemy.minted }, enemy.state, mergedInto(flow.hits, [...ended.hits, ...enemy.hits]), enemy.truncated);
    } catch (error) {
        failFight(world, error);
    }
}
