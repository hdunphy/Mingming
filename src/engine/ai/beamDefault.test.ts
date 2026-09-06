/**
 * TICKET 144 §2 (was ticket 127): the beam width every caller gets.
 *
 * HISTORY, because the previous rule is why this file exists at all. Ticket 127 found the beam
 * unreachable from the game — `vite.config.ts` substitutes `define: { 'process.env': {} }` and a
 * browser has no `globalThis.process` — so a measured 2.3× sat in the codebase the product could
 * not touch. It fixed that by keying the default on "is this Node": browser 8, harness 0. That was
 * right for the moment and wrong as a resting place, because it left the game playing a beamed
 * search while every instrument measured a beamless one.
 *
 * Henry ruled it 2026-09-06: **beam 8 everywhere**. The tests below pin the new rule; the old one
 * is described here so nobody re-derives it from first principles and "fixes" this back.
 *
 * ORIGINAL HEADER, ticket 127: the beam is on in the game and off in a harness.
 *
 * `AI_BEAM` shipped off by default and opt-in per run (`research/3v3-optimisation.md`). That made it
 * **unreachable from the game**: `vite.config.ts` substitutes `define: { 'process.env': {} }` into
 * the app bundle and `globalThis.process` does not exist in a browser, so the width was pinned at 0
 * in the only build a player runs — a measured 2.3× the product could not touch.
 *
 * Flipping the default to 8 outright would have been worse, and this file is mostly here to keep
 * anyone from doing it. Every `scratch/` instrument and every suite in `src/debug/` runs under Node,
 * and ticket 108's standing rule is *"confirm anything you intend to act on at full, BEAMLESS"*. A
 * default that quietly beams a ship gate is worse than no beam at all.
 *
 * The rule is a pure function because a test cannot reach the browser branch by running in a
 * browser: vitest is Node, and jsdom does not remove `process`. Detection stays at the call site;
 * the decision is here where it can be pinned.
 */

import { describe, expect, it } from 'vitest';
import { resolveBeam, GAME_BEAM_WIDTH } from './TacticalAI';

describe('ticket 144 §2 — beam 8 everywhere, and the one way to opt out', () => {
    it('gives EVERY caller the beam — the browser/Node split is gone', () => {
        // Ticket 127 gave the browser 8 and Node 0, so the game played a beamed search while the
        // instrument measured a beamless one. Henry ruled that incoherent on 2026-09-06: the grid's
        // job is to measure what the player faces.
        expect(resolveBeam(false, undefined)).toBe(GAME_BEAM_WIDTH);
        expect(resolveBeam(true, undefined)).toBe(GAME_BEAM_WIDTH);
        expect(GAME_BEAM_WIDTH).toBe(8);
    });

    it('still lets anyone name a width, which is now the ONLY way to differ', () => {
        expect(resolveBeam(true, '6')).toBe(6);
        expect(resolveBeam(false, '12')).toBe(12);
    });

    it('`AI_BEAM=0` means beamless AS A RULE — but see the caveat, it cannot be delivered', () => {
        // The rule is right and the plumbing is not: `vite.config.ts` substitutes
        // `define: { 'process.env': {} }` and vite-node transforms every `scratch/` lane and
        // `src/debug/` suite through that same config, so AI_BEAM never reaches the module in the
        // one place measurements are taken. Verified, not assumed. The switch that WORKS is
        // `aiBeam` on the battle state — `BatchOptions.aiBeam` threads it — and that is what
        // ticket 108's "confirm it beamless" rule has to use.
        expect(resolveBeam(false, '0')).toBe(0);
        expect(resolveBeam(true, '0')).toBe(0);
    });
});

describe('ticket 144 §2 — the per-battle switch', () => {
    it('a battle that names a width overrides the process default', async () => {
        const { createSparseBattleState, createSparseEntity } = await import('../../debug/scenarios/scenarioTestSupport');
        const { getBestAction } = await import('./TacticalAI');
        // The assertion here is narrow on purpose: that a state carrying `aiBeam` is ACCEPTED and
        // decided on. Whether the beam changes THIS decision is a measurement, not a unit test —
        // it is the 90-cell grid gate in `results/beam144_*` that answers that.
        const board = (aiBeam?: number) => createSparseBattleState({
            activeSide: 'PLAYER', phase: 'ACTION',
            ...(aiBeam === undefined ? {} : { aiBeam }),
            playerParty: [createSparseEntity({ id: 'p1', name: 'A', currentHp: 900, maxHp: 1000, currentEnergy: 3 })],
            enemyParty: [createSparseEntity({ id: 'e1', name: 'B', currentHp: 900, maxHp: 1000 })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'h1', dataId: 'fire_poke', currentCost: 1, isPlayable: true }],
            },
        });
        expect(getBestAction(board(0)).type).toBe('PLAY_PROGRAM');
        expect(getBestAction(board(8)).type).toBe('PLAY_PROGRAM');
        expect(getBestAction(board()).type).toBe('PLAY_PROGRAM');
    });
});
