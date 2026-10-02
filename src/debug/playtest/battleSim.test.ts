/**
 * TICKET 180a — the playtester's battle loop plays a fight exactly as the walker's `runOne` does.
 *
 * `runOne` returns a summary and hides the damage ledger, so the playtester has its own loop in
 * `battleSim.ts` (it also needs to stop between moves for `turn` and `card` mode). The rule from the
 * ticket is that this must not be a second opinion about how a fight goes: the same state, the same
 * AI, the same reducer. This test is the proof, and it is the thing that fails if either drifts.
 */
import { describe, it, expect } from 'vitest';

import { runOne } from '../balance/runBatch';
import { setupFor, memberFor, eaStarters, NO_FIRMWARE_OS } from '../balance/runWalker';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { rollEncounter } from '../../engine/run/encounter';
import { autoPlay, openBattle, PLAYTEST_MAX_TURNS } from './battleSim';

function firstFight(seed: string, starter: string) {
    const member = memberFor('mm1', starter);
    const offer = offerGyms(`${seed}:gyms`)[0];
    const run = createRun({ seed, offer, party: [member], startedAt: 1_700_000_000_000 });
    const here = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const node = run.nodes.find((n) => here.edges.includes(n.id))!;
    const encounter = rollEncounter({ run, node, party: [member] });
    const setup = setupFor(
        encounter.seed, [member], run.deck.map((c) => c.dataId), encounter.enemyParty, encounter.enemyDeckIds,
        encounter.enemyDrivers ?? [], run.drivers ?? [], run.patches,
    );
    return { encounter, setup };
}

describe('180a — the battle loop is the walker\'s', () => {
    it('plays the same fight as runOne: same winner, same turns, same HP left', () => {
        for (const starter of eaStarters().slice(0, 4)) {
            const { encounter, setup } = firstFight('ps-sim', starter);
            const reference = runOne(setup, encounter.seed, PLAYTEST_MAX_TURNS, 'PLAYER', false, encounter.enemyAiTier, encounter.aiBeam);
            const state = openBattle({ setup, seed: encounter.seed, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam });
            const mine = autoPlay(state, PLAYTEST_MAX_TURNS);
            expect(mine.winner).toBe(reference.winner);
            expect(mine.turns).toBe(reference.turns);
            expect(mine.truncated).toBe(reference.truncated);
            expect(mine.state.playerParty.map((e) => Math.max(0, e.currentHp)))
                .toEqual(reference.playerEnd.map((e) => e.hp));
            expect(mine.state.enemyParty.map((e) => Math.max(0, e.currentHp)))
                .toEqual(reference.enemyEnd.map((e) => e.hp));
        }
    });

    it('reports the damage ledger totals, biggest first', () => {
        const { encounter, setup } = firstFight('ps-sim', eaStarters()[0]);
        const mine = autoPlay(openBattle({ setup, seed: encounter.seed, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam }), PLAYTEST_MAX_TURNS);
        expect(mine.hits.length).toBeGreaterThan(0);
        const totals = mine.hits.map((h) => h.total);
        expect([...totals].sort((a, b) => b - a)).toEqual(totals);
    });

    it('names who dealt each hit, even though the engine writes SYSTEM as the source of card attacks', () => {
        const { encounter, setup } = firstFight('ps-sim', eaStarters()[0]);
        const mine = autoPlay(openBattle({ setup, seed: encounter.seed, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam }), PLAYTEST_MAX_TURNS);
        expect(mine.hits.length).toBeGreaterThan(0);
        for (const hit of mine.hits) expect(hit.source).not.toBe('SYSTEM');
        expect(mine.hits.some((h) => h.side === 'PLAYER')).toBe(true);
        expect(mine.hits.some((h) => h.side === 'ENEMY')).toBe(true);
    });

    it('uses the same turn cap as the walker', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync('src/debug/balance/runWalker.ts', 'utf8');
        const match = /const WALK_MAX_TURNS = (\d+);/.exec(source);
        expect(match).not.toBeNull();
        expect(PLAYTEST_MAX_TURNS).toBe(Number(match![1]));
    });

    it('has a firmware sentinel the walker also uses', () => {
        expect(NO_FIRMWARE_OS).toBeTruthy();
    });
});
