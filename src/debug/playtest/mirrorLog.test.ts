/**
 * The playtester opens its fights the way the game does, so a mirror fight's foe is `Kraken (foe)` in
 * the combat log it prints after every play too (the game's own log, ticket 186d), not only in the
 * tool's hit table (193f).
 */
import { describe, expect, it } from 'vitest';
import { setupFor, memberFor } from '../balance/runWalker';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { rollEncounter } from '../../engine/run/encounter';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { openBattle, step } from './battleSim';

function mirrorState() {
    const member = memberFor('mm1', 'kraken_v1');
    const offer = offerGyms('mirror:gyms')[0];
    const run = createRun({ seed: 'mirror', offer, party: [member], startedAt: 1_700_000_000_000 });
    const here = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const node = run.nodes.find((n) => here.edges.includes(n.id))!;
    const encounter = rollEncounter({ run, node, party: [member] });
    const mine = openBattle({
        setup: setupFor(encounter.seed, [member], run.deck.map((c) => c.dataId), encounter.enemyParty, encounter.enemyDeckIds, [], run.drivers ?? [], run.patches),
        seed: encounter.seed,
    }).playerParty[0].name;
    // the same fight with the enemy being the player's own species
    const foes = encounter.enemyParty.map((e) => ({ ...e, definitionId: member.definitionId, activeOS: member.activeOS }));
    const state = openBattle({
        setup: setupFor(encounter.seed, [member], run.deck.map((c) => c.dataId), foes, encounter.enemyDeckIds, [], run.drivers ?? [], run.patches),
        seed: encounter.seed,
    });
    return { state, mine };
}

describe('the playtester\'s mirror fight', () => {
    it('opens with the foe named apart from the party member', () => {
        const { state, mine } = mirrorState();
        expect(state.playerParty[0].name).toBe(mine);
        expect(state.enemyParty.every((e) => e.name === `${mine} (foe)`)).toBe(true);
    });

    it('and the combat log line for the player\'s first hit names the foe', () => {
        let { state } = mirrorState();
        for (let i = 0; i < 6 && !state.logs.some((l) => /→ .* takes \d+ damage/.test(l)); i += 1) {
            const moved = step(state, getBestAction(state));
            state = moved.changed ? moved.state : step(state, { type: 'END_TURN' }).state;
        }
        const hit = state.logs.find((l) => /→ .* takes \d+ damage/.test(l));
        expect(hit, state.logs.join('\n')).toContain('(foe)');
    });
});
