/**
 * COLLECTION V2'S CARDS DO WHAT THEY PRINT — ticket 162a, headless.
 *
 * Henry, 2026-09-24: *"Can you run a headless test of each of the new cards to make sure there are
 * no bugs. I want a smooth play test tonight."*
 *
 * # WHAT IS HERE AND WHAT IS IN THE PROBE
 *
 * `scratch/t162_cardcheck.ts` casts all 54 authored cards on a stocked board and on an empty one
 * and PRINTS what each did. That is how the numbers below were checked and it is the right tool for
 * "is anything wrong" — a card can pass every assertion somebody thought to write and still be
 * wrong in a way nobody predicted.
 *
 * This file holds the cases the probe CANNOT see, which is where a playtest bug would actually be:
 *
 *  - **Six daemons whose whole effect is a hook.** They install on the cast turn and do nothing.
 *    `daemonCoverage.test.ts` proves their hook ids resolve; nothing proved they FIRE. Three of the
 *    six are hooks written in 162a and had never been executed by anything.
 *  - **Two conditional refunds** that are false on the turn the card is cast alone, so the probe
 *    reads them as "no refund" and cannot tell that from "broken".
 *  - **Two order-dependent riders** — `ignite` reading the board BEFORE its own Burn lands, and
 *    `pile_on`'s second swing — where the wrong answer is a plausible number rather than a crash.
 *  - **`overclock_core`**, whose point is that the Energy is still there NEXT turn.
 *
 * Deliberately NOT here: damage totals. The probe covers those, and pinning arithmetic that the
 * pace divisor and every duality feed into makes a test that fails for reasons unrelated to cards.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from './data/programRegistry';
import { initDaemonHooks } from './data/daemonHooks';
import type { IBattleState, IBattleEntity, StatusEffectInstance } from './types';

initDaemonHooks();

const FRAME = 1000;
const st = (owner: string, type: string, stacks: number): StatusEffectInstance =>
    ({ id: `${owner}-${type}`, type, stacks }) as StatusEffectInstance;

interface Seat { id: string; name: string; hp?: number; energy?: number; status?: StatusEffectInstance[] }

const seat = (s: Seat): IBattleEntity => createSparseEntity({
    id: s.id, name: s.name,
    currentHp: s.hp ?? FRAME, maxHp: FRAME,
    currentEnergy: s.energy ?? 5, maxEnergy: s.energy ?? 5,
    statusEffects: s.status ?? [],
});

const card = (dataId: string, id = 'h1') =>
    ({ id, dataId, currentCost: GetProgramData(dataId).baseCost as number, isPlayable: true });

interface Setup {
    player: Seat[];
    enemy: Seat[];
    hand?: string[];
    enemyHand?: string[];
    drawpile?: number;
}

function makeState(s: Setup): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: s.player.map(seat),
        enemyParty: s.enemy.map(seat),
        playerDeck: {
            ownerId: 'PLAYER', deck: [], discard: [], exhaust: [],
            drawpile: Array.from({ length: s.drawpile ?? 4 }, (_, i) => card('tackle', `d${i}`)),
            hand: (s.hand ?? []).map((d, i) => card(d, `h${i + 1}`)),
        },
        enemyDeck: {
            ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: (s.enemyHand ?? []).map((d, i) => card(d, `eh${i + 1}`)),
        },
    });
}

const play = (state: IBattleState, sourceId: string, targetId: string, programId: string): IBattleState =>
    battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId } } as never);

const endTurn = (state: IBattleState): IBattleState => battleReducer(state, { type: 'END_TURN' } as never);

const unit = (s: IBattleState, id: string): IBattleEntity =>
    s.playerParty.find((e) => e.id === id) ?? s.enemyParty.find((e) => e.id === id)!;
const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter((x) => x.type === type).reduce((n, x) => n + x.stacks, 0);

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('162a — the six daemons whose effect is a hook, not an action', () => {
    /*
     * Every one of these installs silently and does nothing on the turn it is cast, so the probe
     * that casts each card once cannot tell a working daemon from an inert one. `daemonHooks.ts`
     * warns about exactly this: "a daemon whose hooks.json entry is perfect and whose programs.json
     * printing is perfect does NOTHING if its key is missing from the allowlist — no error, no
     * warning, no failing test."
     */

    it('short_fuse taxes an enemy that ends its turn holding Energy', () => {
        let s = makeState({
            player: [{ id: 'p1', name: 'Host' }],
            enemy: [{ id: 'e1', name: 'Hoarder', energy: 3 }],
            hand: ['short_fuse'],
        });
        s = play(s, 'p1', 'p1', 'h1');
        expect(unit(s, 'p1').daemons.length, 'the daemon installed').toBe(1);

        const before = unit(s, 'e1').currentHp;
        s = endTurn(s);          // player -> enemy
        s = endTurn(s);          // enemy ends its turn holding 3 Energy
        expect(unit(s, 'e1').currentHp, 'an enemy sitting on Energy should have been taxed')
            .toBeLessThan(before);
    });

    it('short_fuse does NOT tax an enemy that spent out', () => {
        // The half that makes it a condition rather than a clock.
        let s = makeState({
            player: [{ id: 'p1', name: 'Host' }],
            enemy: [{ id: 'e1', name: 'Spender', energy: 0 }],
            hand: ['short_fuse'],
        });
        s = play(s, 'p1', 'p1', 'h1');
        const before = unit(s, 'e1').currentHp;
        s = endTurn(s);
        s = endTurn(s);
        expect(unit(s, 'e1').currentHp).toBe(before);
    });

    it('static_ward burns an enemy that puts a status on your side', () => {
        let s = makeState({
            player: [{ id: 'p1', name: 'Host' }],
            enemy: [{ id: 'e1', name: 'Debuffer' }],
            hand: ['static_ward'],
            enemyHand: ['snarl'],
        });
        s = play(s, 'p1', 'p1', 'h1');
        const before = unit(s, 'e1').currentHp;

        s = { ...s, activeSide: 'ENEMY' };
        s = play(s, 'e1', 'p1', 'eh1');      // 2 Weakened onto the player
        expect(stacks(unit(s, 'p1'), 'Weakened'), 'the debuff still lands').toBeGreaterThan(0);
        expect(unit(s, 'e1').currentHp, 'and the ward answers it').toBeLessThan(before);
    });

    it('ember_ward puts Burn on whoever hits an ally', () => {
        let s = makeState({
            player: [{ id: 'p1', name: 'Host' }, { id: 'p2', name: 'Ally' }],
            enemy: [{ id: 'e1', name: 'Attacker' }],
            hand: ['ember_ward'],
            enemyHand: ['tackle'],
        });
        s = play(s, 'p1', 'p1', 'h1');
        expect(stacks(unit(s, 'e1'), 'Burn')).toBe(0);

        s = { ...s, activeSide: 'ENEMY' };
        s = play(s, 'e1', 'p2', 'eh1');
        expect(stacks(unit(s, 'e1'), 'Burn'), 'the attacker is scorched').toBeGreaterThan(0);
    });

    it('thermal_overload costs its host HP at end of turn', () => {
        let s = makeState({
            player: [{ id: 'p1', name: 'Host' }],
            enemy: [{ id: 'e1', name: 'Foe' }],
            hand: ['thermal_overload'],
        });
        s = play(s, 'p1', 'p1', 'h1');
        const before = unit(s, 'p1').currentHp;
        s = endTurn(s);
        expect(unit(s, 'p1').currentHp, 'the host pays for the boost').toBeLessThan(before);
    });

    it('hoofbeat answers a 0-cost card', () => {
        let s = makeState({
            player: [{ id: 'p1', name: 'Host' }],
            enemy: [{ id: 'e1', name: 'Foe' }],
            hand: ['hoofbeat', 'tackle'],
        });
        s = play(s, 'p1', 'p1', 'h1');
        const before = unit(s, 'e1').currentHp;
        s = play(s, 'p1', 'e1', 'h2');       // tackle is 0-cost AND deals damage
        // The daemon's 8 power rides on top of tackle's own 12, so the assertion is that the enemy
        // lost MORE than tackle alone takes — measured against the same cast without the daemon.
        const solo = play(
            makeState({ player: [{ id: 'p1', name: 'Host' }], enemy: [{ id: 'e1', name: 'Foe' }], hand: ['tackle'] }),
            'p1', 'e1', 'h1',
        );
        const withDaemon = before - unit(s, 'e1').currentHp;
        const without = FRAME - unit(solo, 'e1').currentHp;
        expect(withDaemon, 'the 0-cost play should cost the enemy more with hoofbeat installed')
            .toBeGreaterThan(without);
    });

    it('overclock_core raises the ceiling and the Energy is there NEXT turn', () => {
        // The whole point of the card: `ENERGY` hands over this turn's, `Energized` next turn's,
        // and neither moves the bar. A test that only checked maxEnergy on the cast turn would pass
        // for an effect that got wiped by the refill.
        let s = makeState({
            player: [{ id: 'p1', name: 'Host', energy: 5 }],
            enemy: [{ id: 'e1', name: 'Foe' }],
            hand: ['overclock_core'],
        });
        const ceilingBefore = unit(s, 'p1').maxEnergy;
        s = play(s, 'p1', 'p1', 'h1');
        expect(unit(s, 'p1').maxEnergy).toBe(ceilingBefore + 1);

        s = endTurn(s);   // -> enemy
        s = endTurn(s);   // -> player, refill
        expect(unit(s, 'p1').maxEnergy, 'the ceiling survives the refill').toBe(ceilingBefore + 1);
        expect(unit(s, 'p1').currentEnergy, 'and the refill fills to it').toBe(ceilingBefore + 1);
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('162a — the two conditional refunds', () => {
    /*
     * Both read false on a turn where the card is the only thing played, which is what the probe
     * sees. The failure this guards is the one ticket 68 already had once: `surge_protection`'s
     * refund fired on 3,371 of 3,371 casts because a guard was silently always-true.
     */

    it('surge_protection refunds only after an effect drew you a card', () => {
        const cold = play(makeState({
            player: [{ id: 'p1', name: 'A', energy: 3 }], enemy: [{ id: 'e1', name: 'F' }],
            hand: ['surge_protection'],
        }), 'p1', 'e1', 'h1');
        expect(unit(cold, 'p1').currentEnergy, 'nothing drew — 1 Energy spent, none back').toBe(2);

        let warm = makeState({
            player: [{ id: 'p1', name: 'A', energy: 3 }], enemy: [{ id: 'e1', name: 'F' }],
            hand: ['undertow', 'surge_protection'],
        });
        warm = play(warm, 'p1', 'p1', 'h1');        // undertow: 0e, draws
        const afterDraw = unit(warm, 'p1').currentEnergy;
        warm = play(warm, 'p1', 'e1', 'h2');
        expect(unit(warm, 'p1').currentEnergy, 'the draw earns the refund back')
            .toBe(afterDraw - 1 + 1);
    });

    it('riptide_run refunds on the third card of the turn and not the first', () => {
        const first = play(makeState({
            player: [{ id: 'p1', name: 'A', energy: 4 }], enemy: [{ id: 'e1', name: 'F' }],
            hand: ['riptide_run'],
        }), 'p1', 'e1', 'h1');
        expect(unit(first, 'p1').currentEnergy, 'first card of the turn — no refund').toBe(3);

        let third = makeState({
            player: [{ id: 'p1', name: 'A', energy: 4 }], enemy: [{ id: 'e1', name: 'F' }],
            hand: ['tackle', 'tackle', 'riptide_run'],
        });
        third = play(third, 'p1', 'e1', 'h1');
        third = play(third, 'p1', 'e1', 'h2');
        const before = unit(third, 'p1').currentEnergy;
        third = play(third, 'p1', 'e1', 'h3');
        expect(unit(third, 'p1').currentEnergy, 'third card — the Energy comes back').toBe(before);
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('162a — the two order-dependent riders', () => {
    it('ignite draws only when the target was ALREADY Burning', () => {
        /*
         * The DRAW is authored FIRST, before ignite's own Burn action, so "already Burning" reads
         * the board rather than the card's own work. Written the other way round it would be true
         * on every cast but the first — a different card, and a plausible-looking one.
         */
        const clean = play(makeState({
            player: [{ id: 'p1', name: 'A' }], enemy: [{ id: 'e1', name: 'F' }],
            hand: ['ignite'], drawpile: 3,
        }), 'p1', 'e1', 'h1');
        expect(clean.playerDeck.drawpile.length, 'clean target — no draw').toBe(3);
        expect(stacks(unit(clean, 'e1'), 'Burn')).toBe(1);

        const burning = play(makeState({
            player: [{ id: 'p1', name: 'A' }],
            enemy: [{ id: 'e1', name: 'F', status: [st('e1', 'Burn', 1)] }],
            hand: ['ignite'], drawpile: 3,
        }), 'p1', 'e1', 'h1');
        expect(burning.playerDeck.drawpile.length, 'already Burning — the cantrip fires').toBe(2);
        expect(stacks(unit(burning, 'e1'), 'Burn')).toBe(2);
    });

    it('pile_on swings twice into a Dazed target and once into a clean one', () => {
        const clean = play(makeState({
            player: [{ id: 'p1', name: 'A' }], enemy: [{ id: 'e1', name: 'F' }],
            hand: ['pile_on'],
        }), 'p1', 'e1', 'h1');
        const dazed = play(makeState({
            player: [{ id: 'p1', name: 'A' }],
            enemy: [{ id: 'e1', name: 'F', status: [st('e1', 'Dazed', 2)] }],
            hand: ['pile_on'],
        }), 'p1', 'e1', 'h1');

        const once = FRAME - unit(clean, 'e1').currentHp;
        const twice = FRAME - unit(dazed, 'e1').currentHp;
        expect(once, 'the base swing lands').toBeGreaterThan(0);
        // Not asserted as exactly 2x: Dazed is a duality status and shifts the defender's own
        // numbers, so the claim is "the second swing happened", not an arithmetic identity.
        expect(twice, 'a Dazed target takes a second swing').toBeGreaterThan(once * 1.5);
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('162a — every authored card is castable and costs what it prints', () => {
    /*
     * The floor under everything above. A card that cannot be played is the worst playtest bug
     * there is — it is not a balance question, it is a dead draw — and it is invisible to a suite
     * that only ever tests the cards somebody thought to write a case for.
     */
    const AUTHORED = [
        'soothe', 'mend', 'forage', 'ignite', 'ember_jab', 'brand', 'flare_burst', 'pack_tactics',
        'howl', 'snarl', 'snap', 'brute_force', 'ragnarok_edge', 'desperate_strike', 'slag_strike',
        'cinder_lance', 'sharp_edge', 'flashover', 'wildfire', 'crushing_depths', 'slander',
        'ink_cloud', 'surge_protection', 'riptide_run', 'tide_pool', 'tidal_battery', 'venom_fang',
        'serpent_flurry', 'venom_glut', 'scald', 'boiling_surge', 'maelstrom', 'hydro_blast',
        'tidal_wave', 'acorn_toss', 'seed_bomb', 'tend', 'bolster', 'verdant_ward', 'pollen_cloud',
        'heckle', 'pile_on', 'crippling_vine', 'sap_strength', 'shell_share', 'bark_smash',
        'blightbloom', 'overclock_core', 'short_fuse', 'static_ward', 'ember_ward',
        'thermal_overload', 'undertow', 'hoofbeat',
    ] as const;

    it.each(AUTHORED)('%s leaves the hand and charges its printed Energy', (id) => {
        const data = GetProgramData(id);
        const cost = data.baseCost as number;
        const aimAtAlly = data.allyTarget === true;
        const before = makeState({
            player: [{ id: 'p1', name: 'A', energy: 5 }, { id: 'p2', name: 'Ally', hp: FRAME / 2 }],
            enemy: [{ id: 'e1', name: 'F' }, { id: 'e2', name: 'F2' }],
            hand: [id],
        });
        const after = play(before, 'p1', aimAtAlly ? 'p2' : 'e1', 'h1');

        const drew = before.playerDeck.drawpile.length - after.playerDeck.drawpile.length;
        expect(after.playerDeck.hand.length, `${id} was refused — it is still in hand`)
            .toBe(before.playerDeck.hand.length - 1 + drew);
        expect(unit(after, 'p1').currentEnergy, `${id} charged the wrong Energy`).toBe(5 - cost);
    });

    it.each(AUTHORED)('%s leaves no negative status stack behind', (id) => {
        // A negative stack is the signature of a removal or consume with the sign the wrong way
        // round — `soothe` shipped at -0.8 in the SCORER for that shape, and the engine version of
        // the same mistake would show up here.
        const data = GetProgramData(id);
        const after = play(makeState({
            player: [
                { id: 'p1', name: 'A', status: [st('p1', 'Sharp', 2), st('p1', 'Strengthened', 2), st('p1', 'BarkShield', 4), st('p1', 'Burn', 1)] },
                { id: 'p2', name: 'Ally', hp: FRAME / 2, status: [st('p2', 'Weakened', 1)] },
            ],
            enemy: [
                { id: 'e1', name: 'F', status: [st('e1', 'Burn', 1), st('e1', 'Poison', 2), st('e1', 'Dazed', 2), st('e1', 'Weakened', 1)] },
                { id: 'e2', name: 'F2' },
            ],
            hand: [id],
        }), 'p1', data.allyTarget ? 'p2' : 'e1', 'h1');

        for (const e of [...after.playerParty, ...after.enemyParty]) {
            for (const s of e.statusEffects) {
                expect(s.stacks, `${id} left ${e.id} holding ${s.stacks} ${s.type}`).toBeGreaterThanOrEqual(0);
            }
        }
    });
});
