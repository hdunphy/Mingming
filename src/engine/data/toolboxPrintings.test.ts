/**
 * THE FIVE REMAINING TOOLBOX PRINTINGS — ticket 69, `research/69-toolbox-printings.md`.
 *
 * `reactive_plating`, `discharge`, `scrubber`, `vent`, `drip_feed`. Every one of them is a counter
 * card, which means its failure mode is the worst one this engine has: a card that does nothing
 * reads as *"the counter is too weak"* in a win rate, and a knob round gets spent on a number that
 * was never live. Four separate silent-wiring bugs have already been found this way.
 *
 * So every test below **counts stacks, damage or procs**. None asserts that something merely
 * happened, and none reads a battle outcome.
 *
 * # THE FOUR TRAPS THESE PRINTINGS SIT ON
 *
 *  1. **The daemon allowlist.** `initDaemonHooks` builds from a hand-maintained list of `hooks.json`
 *     keys; a daemon missing from it is inert with nothing thrown. `daemonCoverage.test.ts` closes
 *     the class; the proc tests here close these three instances.
 *  2. **zod strips undeclared `when`/action keys.** `targetHasStatus` is new for `drip_feed`, and a
 *     dropped filter would silently feed Regen to healthy allies.
 *  3. **A COUNTER action with no `target` is skipped silently** (ticket 71). `reactive_plating`'s
 *     per-turn cap is a counter, and losing it uncaps the card rather than breaking it.
 *  4. **A group-targeted action resolves a GROUP, not a context target.** A `when` clause cannot
 *     filter per member, which is exactly what *"each poisoned ally"* requires.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { getHook } from '../core/HookRegistry';
import { GetProgramData } from './programRegistry';
import { MARKET_NEUTRAL_UTILITY } from '../run/marketplace';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../types';

const THE_FIVE = ['reactive_plating', 'discharge', 'scrubber', 'vent', 'drip_feed'] as const;

function arena(): IBattleState {
    const setup = matchupScenario({
        player: 'huldra', enemy: 'jormungandr',
        playerOS: 'huldra_v1', enemyOS: 'jormungandr_v1', seed: 'toolbox',
    });
    return buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
}

/**
 * A three-body player side. Every group-targeted printing here (`scrubber`, `drip_feed`,
 * `reactive_plating`'s team-wide cap) is INDISTINGUISHABLE from a self-targeted one at width 1, so
 * measuring them against the 1v1 `matchupScenario` would pass whichever scope the engine used.
 */
function withThree(base: IBattleState, hps: number[] = [60, 60, 60]): IBattleState {
    const template = base.playerParty[0];
    return {
        ...base,
        playerParty: hps.map((hp, i) => ({
            ...template, id: `p${i}`, name: `P${i}`, currentHp: hp, statusEffects: [], daemons: [],
        })),
    } as IBattleState;
}

const daemon = (dataId: string): ProgramEntity =>
    ({ id: `daemon_${dataId}`, dataId, currentCost: 2, isPlayable: false });

function install(state: IBattleState, dataId: string): IBattleState {
    return {
        ...state,
        playerParty: state.playerParty.map((e, i) =>
            i === 0 ? { ...e, daemons: [...e.daemons, daemon(dataId)] } : e),
    } as IBattleState;
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.find(s => s.type === type)?.stacks ?? 0;

const withStatus = (state: IBattleState, id: string, type: string, n: number): IBattleState => ({
    ...state,
    playerParty: state.playerParty.map(e => e.id === id ? { ...e, statusEffects: [...e.statusEffects, { id: `${type}-${id}`, type, stacks: n }] } : e),
    enemyParty: state.enemyParty.map(e => e.id === id ? { ...e, statusEffects: [...e.statusEffects, { id: `${type}-${id}`, type, stacks: n }] } : e),
} as IBattleState);

/** Play a card from the PLAYER side at a chosen target. */
function play(state: IBattleState, dataId: string, targetId: string, sourceId?: string): IBattleState {
    const card: ProgramEntity = { id: `c_${dataId}`, dataId, currentCost: 0, isPlayable: true };
    const src = sourceId ?? state.playerParty[0].id;
    const armed = {
        ...state,
        activeSide: 'PLAYER' as const,
        playerParty: state.playerParty.map(e => e.id === src ? { ...e, currentEnergy: 9 } : e),
        playerDeck: { ...state.playerDeck, hand: [card] },
    } as IBattleState;
    return battleReducer(armed, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: src, programId: card.id, targetId },
    } as never) as IBattleState;
}

/** Let the ENEMY attack one of the player's bodies, through the reducer's real hit loop. */
function enemyAttacks(state: IBattleState, victimId: string): IBattleState {
    const card: ProgramEntity = { id: `atk_${victimId}_${state.logs.length}`, dataId: 'water_slap', currentCost: 0, isPlayable: true };
    const attacker = state.enemyParty[0];
    const armed = {
        ...state,
        activeSide: 'ENEMY' as const,
        enemyParty: state.enemyParty.map(e => e.id === attacker.id ? { ...e, currentEnergy: 9 } : e),
        enemyDeck: { ...state.enemyDeck, hand: [card] },
    } as IBattleState;
    return battleReducer(armed, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: attacker.id, programId: card.id, targetId: victimId },
    } as never) as IBattleState;
}

describe('the printings themselves', () => {
    it('are all None, buyable, and print their own numbers', () => {
        for (const id of THE_FIVE) {
            const data = GetProgramData(id);
            expect(data.element, `${id} must be neutral so ANY party can buy it`).toBe('None');
            expect(MARKET_NEUTRAL_UTILITY, `${id} must be in the neutral slot`).toContain(id);
            // The doc's law: descriptions print their numbers. A counter card whose text hides its
            // rate cannot be knob-tuned by anyone reading the card.
            expect(data.description, `${id} must print a figure`).toMatch(/\d/);
        }
    });

    it('carries the costs and rarities the doc ruled', () => {
        const ruled: Record<string, [number, string, string]> = {
            reactive_plating: [2, 'Daemon', 'Uncommon'],
            discharge: [1, 'Skill', 'Uncommon'],
            scrubber: [2, 'Daemon', 'Uncommon'],
            vent: [0, 'Skill', 'Common'],
            drip_feed: [2, 'Daemon', 'Uncommon'],
        };
        for (const [id, [cost, cat, rarity]] of Object.entries(ruled)) {
            const data = GetProgramData(id);
            expect(data.baseCost, `${id} cost`).toBe(cost);
            expect(data.category, `${id} category`).toBe(cat);
            expect(data.rarity, `${id} rarity`).toBe(rarity);
        }
    });

    it('did NOT collide with the existing `overheat` — the rename the doc called for', () => {
        // The spec called this card Overheat; `overheat` is already a 3e Fire attack. A silent
        // overwrite would have re-pointed a live Fire card at a neutral debuff-strip.
        const existing = GetProgramData('overheat');
        expect(existing.element).toBe('Fire');
        expect(existing.baseCost).toBe(3);
        expect(GetProgramData('discharge').element).toBe('None');
    });
});

describe('REACTIVE_PLATING — Sharp on being hit, capped team-wide', () => {
    it('registers both of its hooks, including the reset', () => {
        // The cap is worthless without the reset: it would fire three times per BATTLE.
        expect(getHook('reactive_plating_proc')?.onPostDamage).toBeTypeOf('function');
        expect(getHook('reactive_plating_reset')?.onTurnStart).toBeTypeOf('function');
    });

    it('carries a `target` on every COUNTER action — ticket 71’s silent skip', () => {
        const decl = getHook('reactive_plating_proc') as unknown as { data?: { do?: Array<Record<string, unknown>> } };
        for (const action of decl.data?.do ?? []) {
            if (action.type === 'COUNTER') expect(action.target, 'a COUNTER with no target is skipped').toBeDefined();
        }
    });

    it('grants Sharp to the ally that was hit, and stops at 3 across the TEAM', () => {
        /*
         * The cap is TEAM-WIDE per the ruling, which is why this is measured at width 3: a per-unit
         * cap and a team-wide one read the same number until a SECOND body takes a hit.
         *
         * Driven through real enemy attacks rather than a raw damage call, because `onPostDamage` is
         * dispatched by the reducer's hit loop — a handler-level poke would not exercise the trigger
         * the card is actually wired to.
         */
        let s = install(withThree(arena()), 'reactive_plating');

        // Four separate hits, spread across the party, all from the enemy.
        for (const victim of ['p0', 'p1', 'p2', 'p0']) s = enemyAttacks(s, victim);

        const granted = s.playerParty.reduce((n, e) => n + stacks(e, 'Sharp'), 0);
        expect(granted, 'the team-wide cap is 3, not 3 per body').toBe(3);
        // And it really was spread, not three stacks dumped on one body — which is what a per-unit
        // cap would look like at exactly this total.
        expect(s.playerParty.filter(e => stacks(e, 'Sharp') > 0).length).toBeGreaterThan(1);
    });

    it('does NOT grant Sharp when an ally damages ITSELF — it answers ENEMY attacks', () => {
        // Recoil and self-poison are ally-sourced. A plating that paid out on those would turn every
        // self-damage archetype in the game into a defensive engine for free.
        const s = install(withThree(arena()), 'reactive_plating');
        const after = play(s, 'desperate_strike', s.enemyParty[0].id, 'p1');  // 10 self-damage
        expect(after.playerParty.reduce((n, e) => n + stacks(e, 'Sharp'), 0)).toBe(0);
    });
});

describe('DISCHARGE — strips the buff, and pays for what it actually took', () => {
    it('removes up to 4 Strengthened from an ENEMY', () => {
        const base = withStatus(arena(), arena().enemyParty[0].id, 'Strengthened', 6);
        const enemyId = base.enemyParty[0].id;
        const after = play(base, 'discharge', enemyId);
        expect(stacks(after.enemyParty[0], 'Strengthened'), 'capped at 4, so 6 -> 2').toBe(2);
    });

    it('pays 1 Burn per 2 REMOVED — not per 2 asked for', () => {
        /*
         * The whole reason capped removal now records its real count. Against a target holding 2,
         * the card removes 2 and must pay 1 Burn; a version reading its printed cap would pay 2.
         */
        const enemyId = arena().enemyParty[0].id;

        const fromSix = play(withStatus(arena(), enemyId, 'Strengthened', 6), 'discharge', enemyId);
        expect(stacks(fromSix.enemyParty[0], 'Burn'), '4 removed -> 2 Burn').toBe(2);

        const fromTwo = play(withStatus(arena(), enemyId, 'Strengthened', 2), 'discharge', enemyId);
        expect(stacks(fromTwo.enemyParty[0], 'Burn'), '2 removed -> 1 Burn').toBe(1);

        const fromThree = play(withStatus(arena(), enemyId, 'Strengthened', 3), 'discharge', enemyId);
        expect(stacks(fromThree.enemyParty[0], 'Burn'), '3 removed -> 1 Burn, floored').toBe(1);
    });

    it('pays NOTHING against an unbuffed target — it scales with the problem', () => {
        const enemyId = arena().enemyParty[0].id;
        const after = play(arena(), 'discharge', enemyId);
        expect(stacks(after.enemyParty[0], 'Burn')).toBe(0);
    });
});

describe('SCRUBBER — a Poison tick removed from every ally, every turn', () => {
    it('takes exactly 1 from EACH ally, and does not touch the enemy', () => {
        let s = install(withThree(arena()), 'scrubber');
        for (const id of ['p0', 'p1', 'p2']) s = withStatus(s, id, 'Poison', 4);
        s = withStatus(s, s.enemyParty[0].id, 'Poison', 4);

        const after = battleReducer({ ...s, activeSide: 'PLAYER' as const }, { type: 'END_TURN' }) as IBattleState;

        for (const ally of after.playerParty) expect(stacks(ally, 'Poison'), 'each ally loses exactly 1').toBe(3);
        // Half-rate against ROOT ROT by design — the ruling is that the gym survives its own counter.
        expect(after.playerParty.every(e => stacks(e, 'Poison') > 0), 'one tick is a brake, not a cleanse').toBe(true);
    });

    it('is harmless on a clean party — no 0-stack Poison instance is created', () => {
        const s = install(withThree(arena()), 'scrubber');
        const after = battleReducer({ ...s, activeSide: 'PLAYER' as const }, { type: 'END_TURN' }) as IBattleState;
        for (const ally of after.playerParty) {
            expect(ally.statusEffects.some(x => x.type === 'Poison'), 'must not mint an empty status').toBe(false);
        }
    });
});

describe('DRIP_FEED — Regen to the POISONED, and only the poisoned', () => {
    it('feeds the poisoned ally and skips the healthy one', () => {
        /*
         * The `targetHasStatus` filter, measured. Without it — or with zod stripping it — every ally
         * gets Regen, which is a strictly better card that would never fail a test asserting
         * "somebody got Regen".
         */
        let s = install(withThree(arena()), 'drip_feed');
        s = withStatus(s, 'p1', 'Poison', 3);

        const after = battleReducer({ ...s, activeSide: 'PLAYER' as const }, { type: 'END_TURN' }) as IBattleState;

        expect(stacks(after.playerParty[1], 'Regen'), 'the poisoned ally is fed').toBe(1);
        expect(stacks(after.playerParty[0], 'Regen'), 'a healthy ally is NOT').toBe(0);
        expect(stacks(after.playerParty[2], 'Regen'), 'a healthy ally is NOT').toBe(0);
    });

    it('grants Regen as STACKS, per the ruling — not a flat heal', () => {
        let s = install(withThree(arena()), 'drip_feed');
        s = withStatus(s, 'p0', 'Poison', 2);
        s = withStatus(s, 'p0', 'Regen', 2);
        const after = battleReducer({ ...s, activeSide: 'PLAYER' as const }, { type: 'END_TURN' }) as IBattleState;
        expect(stacks(after.playerParty[0], 'Regen'), 'stacks onto what is there').toBeGreaterThan(2);
    });
});

describe('VENT — the 0-energy pulse cleanse', () => {
    it('removes 3 Poison from the chosen ALLY', () => {
        /*
         * Targeting is the live risk here, not the removal. `TacticalAI` aims a `Single` card with no
         * HEAL action at the ENEMY party, so a `Single` printing of this card would have the AI
         * cleansing the boss. `target: 'Self'` puts the whole player party in the candidate set and
         * the action's `TARGET` resolves to whichever ally was chosen.
         */
        const data = GetProgramData('vent');
        expect(data.target, 'a Single printing would be aimed at the enemy by the AI').toBe('Self');

        let s = withThree(arena());
        s = withStatus(s, 'p2', 'Poison', 5);
        const after = play(s, 'vent', 'p2');
        expect(stacks(after.playerParty[2], 'Poison')).toBe(2);
    });

    it('clears the status outright when it removes the last stack', () => {
        let s = withThree(arena());
        s = withStatus(s, 'p1', 'Poison', 2);
        const after = play(s, 'vent', 'p1');
        expect(after.playerParty[1].statusEffects.some(x => x.type === 'Poison')).toBe(false);
    });
});
