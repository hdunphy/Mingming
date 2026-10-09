/**
 * TICKET 195h — THE GAUNTLET REMEMBERS HOW HURT EACH MEMBER IS.
 *
 * The tool wrote each member's HP at the end of a fight under the battle's own ids, which are made up
 * by the balance harness and are not the party's ids. The game's `advanceGauntlet` only takes the
 * party's ids, so it dropped every number: the header said "HP full" and every later fight ran at
 * full health. The engine was right; this is the tool's mapping.
 */
import { describe, expect, it } from 'vitest';

import { rollGauntletFight } from '../../engine/run/gauntlet';
import { addToRoster } from '../../ui/store/gameSlice';
import { setRun } from '../../ui/store/runSlice';
import { plainMaxHp } from './carriedHp';
import { buildFight } from './fightFlow';
import { partyOf } from './party';
import { settleFight } from './fightSettle';
import { claimRewards } from './rewards';
import { renderScreen, statusLine } from './render';
import { currentScreen } from './screen';
import { worldAt } from './walkKit';
import type { World } from './types';
import { runOf } from './types';

/** A gym gate with three members, and fight 1 built (not played). */
function threeAtTheGate(): { world: World; place: Parameters<typeof settleFight>[1]; state: ReturnType<typeof buildFight> } {
    const world = worldAt('gym');
    const first = world.store.getState().game.roster[0];
    for (const id of ['mm2', 'mm3']) world.store.dispatch(addToRoster({ ...first, id }));
    world.store.dispatch(setRun({ ...runOf(world), partyIds: ['mm1', 'mm2', 'mm3'] }));
    const run = runOf(world);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const state = buildFight(world, rollGauntletFight({ run, node, fightIndex: 0 }));
    return { world, place: { context: 'gauntlet', nodeId: node.id, fought: node }, state };
}

describe('195h — a gauntlet win carries each member\'s HP under the party\'s own id', () => {
    it('a member who ended fight 1 at 0 is revived at 30% of max (202b); the others are at their HP plus 30% of max', () => {
        const { world, place, state } = threeAtTheGate();
        expect(state.playerParty).toHaveLength(3);
        const [a, b, c] = state.playerParty;
        const ended = { ...state, playerParty: [{ ...a, currentHp: 0 }, { ...b, currentHp: 100 }, { ...c, currentHp: b.maxHp }] };
        settleFight(world, place, { state: ended, winner: 'PLAYER', turns: 5, truncated: false, hits: [] });
        claimRewards(world);

        const g = runOf(world).gauntlet!;
        // The screen's max is the plain one; the fight's own max is a few points off (the harness jitters stats per fight).
        const plain = plainMaxHp(partyOf(world)[0]);
        const wounded = Math.round((100 * plain) / b.maxHp) + Math.floor((plain * 30) / 100);
        expect(g.fightIndex).toBe(1);
        const revived = Math.floor((plain * 30) / 100);
        expect(g.persistedHp.mm1).toBe(revived);
        expect(g.downedMemberIds).toEqual([]);
        expect(g.persistedHp.mm2).toBe(wounded);
        expect(g.persistedHp.mm3).toBe(plain);

        const screen = renderScreen(world, currentScreen(world));
        expect(screen).toContain(`${revived}/${plain} (revived at 30%)`);
        expect(screen).not.toContain('(down)');
        expect(screen).toContain(`${wounded}/${plain} (repaired 30%, +`);
        // The status line shows the carried numbers too, not "full".
        expect(statusLine(world)).toContain(`HP ${revived};`);
        expect(statusLine(world)).not.toContain('HP full');
        // The header sentence states both halves of the rule.
        expect(screen).toContain('a downed one comes back at 30%');
    });

    it('the next fight opens with the carried HP (a downed member starts at the revive floor, 202b)', () => {
        const { world, place, state } = threeAtTheGate();
        const ended = { ...state, playerParty: state.playerParty.map((p, i) => ({ ...p, currentHp: i === 0 ? 0 : 50 })) };
        settleFight(world, place, { state: ended, winner: 'PLAYER', turns: 5, truncated: false, hits: [] });
        claimRewards(world);
        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const next = buildFight(world, rollGauntletFight({ run, node, fightIndex: 1 }), run.gauntlet!.persistedHp);
        expect(next.playerParty.map((p) => p.currentHp)).toEqual([run.gauntlet!.persistedHp.mm1, run.gauntlet!.persistedHp.mm2, run.gauntlet!.persistedHp.mm3]);
        expect(next.playerParty[0].currentHp).toBe(Math.floor((plainMaxHp(partyOf(world)[0]) * 30) / 100));
        expect(next.playerParty[0].currentHp).toBeGreaterThan(0);
        expect(next.playerParty[1].currentHp).toBeGreaterThan(50);
    });

    it('a member carried at full health reads full, never above the max the screen prints', () => {
        const { world, place, state } = threeAtTheGate();
        settleFight(world, place, { state, winner: 'PLAYER', turns: 5, truncated: false, hits: [] });
        claimRewards(world);
        const plain = plainMaxHp(partyOf(world)[0]);
        for (const hp of Object.values(runOf(world).gauntlet!.persistedHp)) expect(hp).toBeLessThanOrEqual(plain);
        expect(renderScreen(world, currentScreen(world))).toContain(`${plain}/${plain}`);
    });
});
