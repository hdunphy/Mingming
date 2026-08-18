import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { getOSBehavior } from './data/firmwareRegistry';
import { GetProgramData } from './data/programRegistry';
import HOOKS_DATA from './data/lib/hooks.json';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import type { IBattleState } from './types';

/**
 * Ticket 74 — OUROBOROS_LOOP was the first-turn kill, not `ink_stream`.
 *
 * It used to read *"the 3rd Water card you play grants 1 Energy AND draws 1 card."* Four of
 * `jormungandr_v1`'s nine cards cost nothing, so the 3rd Water card arrived on turn one for
 * free, every time — and it handed her both halves of the kill at once. The Energy paid for the
 * second `ink_stream`; the draw raised each `ink_stream` from 66 power to 99.
 *
 * Measured, one lever at a time over the 14 cells the census found (43 kills at baseline):
 *
 * | OUROBOROS | first-turn kills | jormungandr_v1 field |
 * |---|---|---|
 * | 3rd card, Energy + draw (old) | 43 | 90.4% |
 * | 3rd card, draw only           |  9 | 83.3% |
 * | 4th card, Energy + draw       | 24 | 78.2% |
 * | 5th card, Energy + draw       |  9 | 58.7% |
 * | **5th card, draw only (live)**|  **2** | **50.9%** |
 *
 * The DRAW is the lever and the Energy is not: removing the Energy alone barely moved anything,
 * removing the draw alone took 43 to 2. Shipped as "5th Water card, draw only" — Henry's pick,
 * because it keeps the draw-zoo identity the deck is built around while making the payoff
 * something you have to reach rather than something turn one hands you.
 *
 * Two kills survive, both `skoll_v1` vs `jormungandr`, 2 in 60 games in ONE of 480 cells, and
 * they need Jormungandr to move first holding both `undertow`s AND both payoffs, into the
 * softest frame in the game (Skoll, 76 HP / 27 defence), with a 1.5x Water-over-Fire bonus.
 * Accepted by Henry as texture rather than a defect.
 */

describe('OUROBOROS_LOOP is the 5th Water card, and it only draws', () => {
    interface JormTrigger {
        when: { counters: Array<{ key: string; operator: string; value: number }> };
        do: Array<{ type: string }>;
    }
    const trigger = ((HOOKS_DATA as unknown as Record<string, { hooks: Array<{ id: string }> }>)
        .jormungandr_v1.hooks.find(h => h.id === 'jorm_v1_trigger')) as unknown as JormTrigger;

    it('fires on the 5th Water card, not the 3rd', () => {
        expect(trigger.when.counters.find(c => c.key === 'jorm_water')!.value).toBe(5);
    });

    it('grants NO Energy — that was what paid for the second ink_stream', () => {
        expect(trigger.do.map(a => a.type)).not.toContain('ENERGY');
    });

    it('still draws — the draw-zoo identity survives, it just costs five Water cards', () => {
        expect(trigger.do.map(a => a.type)).toContain('DRAW');
    });

    it('is still capped at once per turn by its own counter guard', () => {
        // The per-turn guard predates this ticket and is load-bearing: without it the loop
        // re-arms every 5th card and the whole fix is undone.
        expect(trigger.when.counters.find(c => c.key === 'jorm_ouroboros_used')).toEqual({
            key: 'jorm_ouroboros_used', operator: 'LT', value: 1,
        });
    });

    it('the description a player reads matches what the hook does', () => {
        expect(getOSBehavior('jormungandr_v1')!.description)
            .toBe('Each turn, the 5th Water card you play draws 1 card.');
    });
});

describe('the scalers it feeds are UNCAPPED again (ticket 73 reverted)', () => {
    it('ink_stream is back to 33 power at 1 Energy with no ceiling in its text', () => {
        const card = GetProgramData('ink_stream')!;
        expect(card.baseCost).toBe(1);
        expect((card.actions[0] as unknown as { power: number }).power).toBe(33);
        expect(card.description).not.toContain('up to');
    });

    it('starfall likewise', () => {
        const card = GetProgramData('starfall')!;
        expect((card.actions[0] as unknown as { power: number }).power).toBe(18);
        expect(card.description).not.toContain('up to');
    });
});

describe('turn one, end to end', () => {
    /** jormungandr_v1 opening on the seed that used to kill skoll_v1 outright. */
    const openingTurn = (): IBattleState => {
        let st = buildScenarioState({
            ...matchupScenario({ player: 'jormungandr', enemy: 'skoll', playerOS: 'jormungandr_v1' }),
            seed: 'ouroboros',
        });
        // Play out jormungandr's whole first turn against a passive opponent.
        for (let i = 0; i < 20 && st.activeSide === 'PLAYER' && st.turn === 1; i++) {
            const hand = st.playerDeck.hand[0];
            if (!hand) break;
            const next = battleReducer(st, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: st.playerParty[0].id, targetId: st.enemyParty[0].id, programId: hand.id },
            });
            if (next === st) break;
            st = next;
        }
        return st;
    };

    it('she can no longer manufacture Energy on turn one', () => {
        // The whole point: whatever she plays, the pool only ever goes down. Before this ticket
        // her third Water card handed her a point back and paid for the second ink_stream.
        const st = openingTurn();
        expect(st.playerParty[0].currentEnergy).toBeLessThanOrEqual(2);
    });
});
