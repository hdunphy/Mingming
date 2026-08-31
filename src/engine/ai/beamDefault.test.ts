/**
 * TICKET 127: the beam is on in the game and off in a harness.
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

describe('ticket 127 - which beam width each caller gets', () => {
    it('gives the browser the beam', () => {
        // The player is the one waiting. 1320ms -> 569ms a decision at 3v3, measured.
        expect(resolveBeam(false, undefined)).toBe(GAME_BEAM_WIDTH);
        expect(GAME_BEAM_WIDTH).toBe(8);
    });

    it('gives a Node harness the BEAMLESS search, so no measurement changes silently', () => {
        // This is the load-bearing case. Every balance number on record was taken beamless; a
        // default that beamed them would re-baseline the whole corpus without a commit saying so.
        expect(resolveBeam(true, undefined)).toBe(0);
    });

    it('lets a harness opt IN by name', () => {
        expect(resolveBeam(true, '8')).toBe(8);
        expect(resolveBeam(true, '6')).toBe(6);
    });

    it('lets the game opt OUT by name, including back to zero', () => {
        // `AI_BEAM=0` has to mean beamless rather than "unset", or there is no way to ask for the
        // old behaviour and no way to reproduce a pre-127 number.
        expect(resolveBeam(false, '0')).toBe(0);
    });
});
