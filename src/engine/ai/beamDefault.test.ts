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

describe('ticket 144 §2 amended — the beam is a rung of the enemy ladder, not a global', () => {
    it('the PROCESS default is beamless, so nothing measures a beamed search by accident', () => {
        // Ticket 108's standing rule: "confirm anything you intend to act on at full, BEAMLESS".
        // A harness that says nothing gets the full search, and the whole 3v3 corpus stays
        // comparable with itself. Callers that want the beam ask for it.
        expect(resolveBeam(false, undefined)).toBe(0);
        expect(resolveBeam(true, undefined)).toBe(0);
    });

    it('still lets anyone name a width', () => {
        expect(resolveBeam(true, '8')).toBe(8);
        expect(resolveBeam(false, '12')).toBe(12);
        expect(resolveBeam(false, '0')).toBe(0);
    });

    it('BUT `AI_BEAM` cannot be delivered to a harness lane — the switch that works is on the state', () => {
        // `vite.config.ts` substitutes `define: { 'process.env': {} }` and vite-node transforms
        // every `scratch/` lane and `src/debug/` suite through that same config, so the variable
        // never reaches the module in the one place measurements are taken. Verified, not assumed.
        // The reachable switch is `aiBeam` on the battle state; `BatchOptions.aiBeam` threads it.
        expect(GAME_BEAM_WIDTH).toBe(8);
    });
});

describe('ticket 144 §2 amended — the boss thinks at full depth', () => {
    it('wild and elite get the beam; the GAUNTLET is beamless', async () => {
        const { ENEMY_LADDER, OPENING_FIGHT_LOADOUT } = await import('../run/encounter');
        // Henry, 2026-09-06: "for the AI in the game we want the bosses to use beamless, some of
        // the other AI should use beam 8." Measured at 3v3, the beam costs the winning side ~12.5
        // points of win rate — cheap on a wild you meet twenty times an hour, wrong on the fight
        // the whole run was built to reach.
        expect(ENEMY_LADDER.wild.beam).toBe(GAME_BEAM_WIDTH);
        expect(ENEMY_LADDER.elite.beam).toBe(GAME_BEAM_WIDTH);
        expect(ENEMY_LADDER.gauntlet.beam).toBe(0);
        expect(OPENING_FIGHT_LOADOUT.beam).toBe(GAME_BEAM_WIDTH);
    });

    it('every rung STATES a width — a new rung cannot inherit one by accident', async () => {
        const { ENEMY_LADDER } = await import('../run/encounter');
        for (const [grade, row] of Object.entries(ENEMY_LADDER)) {
            expect(typeof row.beam, `${grade} has no beam width`).toBe('number');
        }
    });

    it('a real WILD fight carries 8 and a real GYM fight carries 0 — end to end', async () => {
        // The plumbing is what the ticket-127 bug was made of: a width that exists but never
        // reaches the fight. So this asserts the two ends rather than the table.
        const { rollEncounter } = await import('../run/encounter');
        const { rollGauntletFight } = await import('../run/gauntlet');
        const { createRun } = await import('../run/createRun');
        const { GYM_REGISTRY } = await import('../run/gyms');

        const member = (id: string, definitionId: string) => ({
            id, definitionId, nickname: id, activeOS: `${definitionId}_v1`,
            blueprintsCollected: 0, hpIV: 0, attackIV: 0, defenseIV: 0,
        });
        const party = [member('mm1', 'fenrir')];
        const run = {
            ...createRun({
                seed: 'beam-ladder-test',
                offer: {
                    gym: GYM_REGISTRY.gym_rootfall,
                    biomes: ['Nature', 'Fire', 'Water'].map((e, i) => (
                        { id: `b${i}`, name: `${e} ${i}`, elements: [e] }
                    )),
                },
                party,
                startedAt: 0,
            }),
            fightsResolved: 1,
        };

        const wild = run.nodes.find(n => n.kind === 'wild' && n.visited === 0)!;
        expect(rollEncounter({ run, node: wild, party }).aiBeam).toBe(GAME_BEAM_WIDTH);

        const gym = run.nodes.find(n => n.kind === 'gym')!;
        expect(rollGauntletFight({ run, node: gym, fightIndex: 0 }).aiBeam).toBe(0);
    });
});
