import { describe, it, expect } from 'vitest';
import { createBattleState } from './battleFactories';
import type { IBattleSetup } from './battleFactories';
import { createMingmingInstance } from '../gameTypes';
import { createRun } from '../run/createRun';
import { GAUNTLET_FIGHTS, rollGauntletFight } from '../run/gauntlet';
import { GYM_REGISTRY } from '../run/gyms';
import type { IBiome } from '../runTypes';

/**
 * TICKET 18: WHAT THIS FILE USED TO TEST NO LONGER EXISTS.
 *
 * It tested `createBattleState`'s gym-tier branch — "a Light gym gauntlet at battleIndex 2 spawns
 * Light-species wardens", a hand-crafted `${element} Sector Warden` at 1.5x HP flanked by two
 * `Firewall Sentinel`s. That branch is deleted. It predated the run loop and contradicted four
 * rulings that have landed since (see the block comment where it used to be), the loudest being
 * ticket 21's freeze: its boss was harder because its health bar had been multiplied.
 *
 * What replaces it is not a different branch here but the ABSENCE of one, and that is the property
 * worth pinning: a gauntlet fight is rolled by `engine/run/gauntlet.ts` and reaches this factory
 * through `setup.encounter`, on the same path a wild does. So the tests below are (1) the factory
 * has no gauntlet behaviour of its own left to find, and (2) a boss team handed to it arrives intact
 * — signature firmware included, which is the one thing this path is allowed to keep that an
 * ordinary intent-driven enemy is not.
 */

const BIOMES: ReadonlyArray<IBiome> = [
    { id: 'biome_water', name: 'The Drowned Shelf', elements: ['Water'] },
    { id: 'biome_nature', name: 'The Thornwild', elements: ['Nature'] },
    { id: 'biome_fire', name: 'Cinderreach', elements: ['Fire'] },
];

const PARTY = [createMingmingInstance('fenrir')];

function gauntletSetup(
    fightIndex: number,
    /**
     * TICKET 68: which gym. Emberfall is authored now (real firmware behind a Driver); Tidewrack
     * still fields ticket 18's `boss_relic_*` formula boss, which ruling 6 keeps until its own
     * session. Both shapes have to reach the factory intact, so both are exercised from here.
     */
    gym = GYM_REGISTRY.gym_rootfall,
): { setup: IBattleSetup; seed: string } {
    const run = createRun({
        seed: 'battle-factories-gauntlet',
        offer: { gym, biomes: BIOMES },
        party: PARTY,
        startedAt: 0,
    });
    const gymNode = run.nodes.find((n) => n.kind === 'gym')!;
    const fight = rollGauntletFight({ run, node: gymNode, fightIndex });

    return {
        setup: {
            party: PARTY,
            deck: [],
            drivers: [],
            persistedHp: {},
            encounter: {
                enemyParty: fight.enemyParty,
                enemyDeckIds: fight.enemyDeckIds,
                enemyDrivers: fight.enemyDrivers,
            },
            ...(fight.enemyDrivers ? { enemyDrivers: fight.enemyDrivers } : {}),
        },
        seed: fight.seed,
    };
}

describe('createBattleState — the gym-tier branch is gone (ticket 18)', () => {
    it('has no gauntlet mode: with no encounter, no sector and no enemy ids it refuses loudly', () => {
        // Before ticket 18 a `gauntlet` field on the setup was enough to conjure a warden party out
        // of the factory. There is no field and no branch now, so this input has nothing to build
        // from — and a battle with no enemies must throw rather than render a ghost arena.
        const bare: IBattleSetup = { party: PARTY, deck: [], drivers: [], persistedHp: {} };

        expect(() => createBattleState(bare, [])).toThrow(/No enemies generated/);
    });

    it('builds the boss team it is handed, with signature firmware intact', () => {
        const { setup, seed } = gauntletSetup(GAUNTLET_FIGHTS - 1);
        const state = createBattleState(setup, [], undefined, { seed, enemyMode: 'CARDS' });

        expect(state.enemyParty).toHaveLength(3);
        // The OS strip that fires for intent-driven enemies is skipped for a pre-rolled encounter
        // (ticket 11), which is what lets the boss team run its relics at all.
        for (const boss of state.enemyParty) {
            expect(boss.activeOS?.startsWith('boss_relic_')).toBe(true);
        }
        // No multiplied health bars anywhere. The old warden was `maxHp * 1.5`; ticket 21 froze the
        // engine, so a boss sits at exactly the HP its species and IVs give it.
        for (const boss of state.enemyParty) {
            expect(boss.currentHp).toBe(boss.maxHp);
        }
        // Tuned decks, not moves: the old tier-3 boss carried three hardcoded moves and an empty
        // deck. Ticket 08's deepest kit fraction says the gym fields full decks.
        expect(state.enemyDeck.drawpile.length + state.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('builds an AUTHORED boss team with its own firmware and its side Driver (ticket 68)', () => {
        const { setup, seed } = gauntletSetup(GAUNTLET_FIGHTS - 1, GYM_REGISTRY.gym_emberfall);
        const state = createBattleState(setup, [], undefined, { seed, enemyMode: 'CARDS' });

        expect(state.enemyParty).toHaveLength(3);
        for (const boss of state.enemyParty) {
            // Ruling 2: the Driver is additive. The member keeps its real OS and gains the hooks.
            expect(boss.activeOS?.startsWith('boss_relic_')).toBe(false);
            expect(boss.hooks).toContain('driver_war_footing_rally');
            // And still no multiplied health bars — ticket 21 holds either side of the redesign.
            expect(boss.currentHp).toBe(boss.maxHp);
        }
        expect(state.enemyDeck.drawpile.length + state.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('carries persisted HP into the fight, and a 0 stays a 0', () => {
        // The gauntlet's whole asymmetry, at the one line that implements it. A downed member is
        // built at 0 HP rather than dropped or healed — `IGauntletProgress.downedMemberIds` names
        // the same member, and the Revive macro needs it on the field to be able to target it.
        const { setup, seed } = gauntletSetup(1);
        const downed: IBattleSetup = { ...setup, persistedHp: { [PARTY[0].id]: 0 } };

        const state = createBattleState(downed, [], undefined, { seed, enemyMode: 'CARDS' });

        expect(state.playerParty).toHaveLength(1);
        expect(state.playerParty[0].currentHp).toBe(0);
        expect(state.playerParty[0].maxHp).toBeGreaterThan(0);
    });
});
