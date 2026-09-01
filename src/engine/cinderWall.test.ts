/**
 * TICKET 128 — does CINDER_WALL_OS fire on the cards fenrir_v2 actually holds?
 *
 * Henry, mid-run: *"fenrir_v2 doesn't seem to work. I'm at the elite and he doesn't gain any
 * sharp."*
 *
 * `OSSystem.test.ts` already asserts this OS works and it passes — but it fires the hook with
 * `card_burn_test`, a card that exists only in `TestProgramRegistry`, and it registers the firmware
 * hooks by hand at module scope. Neither of those is the game. So the green test is not evidence
 * about the shipped deck, and this file exists to close that gap: **every Burn card in fenrir_v2's
 * real deck list, through the real registry, with no hand-registration.**
 *
 * The deck (`mingmingRegistry.fenrir_v2`) is ignite x2, molten_core x2, slag_strike, water_slap,
 * pyre_sacrifice, ash_communion, cinder_lance. Three of those apply Burn:
 *
 *   ignite          1 Burn to the target
 *   molten_core     2 Burn to the target, +2 more if the host has Sharp
 *   pyre_sacrifice  60 power, 3 Burn to the target AND 3 Burn to SELF
 *
 * The OS reads *"whenever Fenrir applies the Burn status to any unit - including himself"*, so all
 * three must pay, and `pyre_sacrifice` must pay TWICE - it is two separate applications.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { getOSBehavior } from './data/firmwareRegistry';
import { getHook } from './core/Hooks';
import { StatusType } from './types';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';

const FENRIR = 'p_fenrir';
const FOE = 'e_foe';

/** A real fenrir carrying the real fenrir_v2 firmware, with one real card in hand. */
function stateWith(dataId: string, sharpOnHost = 0): IBattleState {
    const host = createSparseEntity({
        id: FENRIR, definitionId: 'fenrir', name: 'Fenrir',
        activeOS: 'fenrir_v2', primaryElement: 'Fire', cardDraw: 3,
        statusEffects: sharpOnHost > 0
            ? [{ id: 'sh', type: 'Sharp', stacks: sharpOnHost } as never]
            : [],
    });
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [host],
        enemyParty: [createSparseEntity({ id: FOE, definitionId: 'kraken', name: 'Foe' })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: [{ id: 'c1', dataId, currentCost: 0, isPlayable: true } as ProgramEntity],
        },
    });
}

const play = (s: IBattleState): IBattleState => battleReducer(s, {
    type: 'PLAY_PROGRAM', payload: { sourceId: FENRIR, targetId: FOE, programId: 'c1' },
} as never);

const stacksOf = (e: IBattleEntity, t: string): number =>
    e.statusEffects.find(s => s.type === t)?.stacks ?? 0;

describe('ticket 128 - CINDER_WALL_OS on fenrir_v2\'s real deck', () => {
    it('the firmware and its hook are registered under the ids the entity carries', () => {
        // If this fails nothing below can pass, and the failure would otherwise look like a
        // gating bug rather than a wiring one.
        const os = getOSBehavior('fenrir_v2');
        expect(os, 'fenrir_v2 is not in the firmware registry').toBeTruthy();
        expect(os!.name).toBe('CINDER_WALL_OS');
        const ids = os!.hooks.map(h => h.id);
        expect(ids).toContain('fenrir_v2_hook');
        const registered = getHook('fenrir_v2_hook');
        expect(registered, 'fenrir_v2_hook is not in the hook registry').toBeTruthy();
        expect(registered!.onStatusApplied, 'the hook has no onStatusApplied phase').toBeTruthy();
    });

    it('ignite: 1 Burn on the foe pays 1 Sharp', () => {
        const after = play(stateWith('ignite'));
        expect(stacksOf(after.enemyParty[0], StatusType.Burn), 'ignite applied no Burn').toBe(1);
        expect(stacksOf(after.playerParty[0], StatusType.Sharp)).toBe(1);
    });

    it('molten_core: one application pays one Sharp, however many stacks it is', () => {
        // The OS says "whenever ... applies the Burn status", not "per stack". One card, one apply.
        const after = play(stateWith('molten_core'));
        expect(stacksOf(after.enemyParty[0], StatusType.Burn)).toBe(2);
        expect(stacksOf(after.playerParty[0], StatusType.Sharp)).toBe(1);
    });

    it('molten_core with Sharp already up: the conditional second apply pays again', () => {
        // Two STATUS actions resolve (2 Burn, then 2 more because the host has Sharp), so this is
        // two applications and the OS owes two stacks on top of the one already there.
        const after = play(stateWith('molten_core', 1));
        expect(stacksOf(after.enemyParty[0], StatusType.Burn)).toBe(4);
        expect(stacksOf(after.playerParty[0], StatusType.Sharp)).toBe(3);
    });

    it('pyre_sacrifice: burning the foe AND himself pays TWICE', () => {
        // "including himself" is the clause under test.
        const after = play(stateWith('pyre_sacrifice'));
        expect(stacksOf(after.enemyParty[0], StatusType.Burn)).toBe(3);
        expect(stacksOf(after.playerParty[0], StatusType.Burn)).toBe(3);
        expect(stacksOf(after.playerParty[0], StatusType.Sharp)).toBe(2);
    });

    it('slag_strike still grants its printed Sharp (the card, not the OS)', () => {
        // A control: if this fails the problem is the STATUS pipeline, not the firmware.
        const after = play(stateWith('slag_strike'));
        expect(stacksOf(after.playerParty[0], StatusType.Sharp)).toBe(1);
    });

    it('water_slap grants nothing - the OS is not paying on every card', () => {
        const after = play(stateWith('water_slap'));
        expect(stacksOf(after.playerParty[0], StatusType.Sharp)).toBe(0);
    });
});

/**
 * THE TWO WAYS IT STILL LOOKS BROKEN IN A REAL FIGHT.
 *
 * Everything above passes, so the firmware is not defective. These are the two states a player can
 * be in where a working CINDER_WALL produces no visible Sharp, and both of them are silent.
 */
describe('ticket 128 - why a working CINDER_WALL shows no Sharp', () => {
    it('DAZED EATS IT. Sharp is the duality partner of Dazed, so the stack is spent cancelling', () => {
        // `effectHandlers.DUALITY_MAP` cancels an incoming status against its opposite BEFORE the
        // behaviour runs, so 1 Sharp arriving on a unit holding Dazed removes 1 Dazed and leaves
        // no Sharp behind. Nothing about that is wrong - it is the ticket-102 model - but from the
        // outside it is indistinguishable from the OS not firing.
        const base = stateWith('ignite');
        const dazed: IBattleState = {
            ...base,
            playerParty: base.playerParty.map(e => ({
                ...e, statusEffects: [{ id: 'dz', type: 'Dazed', stacks: 3 } as never],
            })),
        };
        const after = play(dazed);

        expect(stacksOf(after.enemyParty[0], StatusType.Burn), 'the Burn still landed').toBe(1);
        expect(stacksOf(after.playerParty[0], StatusType.Sharp), 'no Sharp is visible').toBe(0);
        // The stack was not lost - it paid down a debuff. That is the tell.
        expect(stacksOf(after.playerParty[0], StatusType.Dazed)).toBe(2);
        // AND THE OS STILL ANNOUNCES ITSELF. `onStatusApplied` fires whether or not duality ate
        // the stack, so the log line is present. This is the discriminator a player can use.
        expect(after.logs.some(l => l.includes('feeds on the flames'))).toBe(true);
    });

    it('A DIFFERENT BODY CAST IT. At 3v3 the deck is shared, and the OS pays only its owner', () => {
        // The hook is gated `when: { source: SELF }`, so it fires for the unit that APPLIED the
        // Burn. At 3v3 one shared pile is drawn across the whole party and the player picks the
        // caster, so an `ignite` cast off an ally spends the card and pays Fenrir nothing.
        const ALLY = 'p_ally';
        const base = stateWith('ignite');
        const threeUp: IBattleState = {
            ...base,
            playerParty: [
                ...base.playerParty,
                createSparseEntity({ id: ALLY, definitionId: 'kraken', name: 'Ally', cardDraw: 3 }),
            ],
        };
        const after = battleReducer(threeUp, {
            type: 'PLAY_PROGRAM', payload: { sourceId: ALLY, targetId: FOE, programId: 'c1' },
        } as never);

        expect(stacksOf(after.enemyParty[0], StatusType.Burn), 'the ally still burned the foe').toBe(1);
        expect(stacksOf(after.playerParty[0], StatusType.Sharp), 'Fenrir was paid for someone else\'s cast').toBe(0);
        expect(stacksOf(after.playerParty[1], StatusType.Sharp), 'and so was the ally').toBe(0);
        // AND THE OS SAYS NOTHING AT ALL. Together with the duality case above this is a clean
        // discriminator in the combat log: "feeds on the flames" with no Sharp means Dazed ate it;
        // no line at all means the wrong body cast the card.
        expect(after.logs.some(l => l.includes('feeds on the flames'))).toBe(false);
    });
});
