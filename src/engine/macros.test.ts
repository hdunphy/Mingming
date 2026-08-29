/**
 * MACROS, FIRED — ticket 15.
 *
 * `macros-and-drivers.md` rules twelve battle macros and ticket 07's amendment adds a map-reveal.
 * Every one of them is fired here and **its number is asserted**, not merely that something changed:
 * a macro is a single-use consumable bought with scrap, so "it did something" is not a passing
 * grade.
 *
 * The four laws with a ruling behind them get their own cases, because each has a plausible-looking
 * wrong version that a "does it do something" test would wave through:
 *
 * - **Recharge ADDS, it does not SET.** The ruling shouts about this: *"`processPreTurn` SETS
 *   `currentEnergy`, and that is the trap that bit three OSes."* Proven from a state whose energy is
 *   deliberately not its maximum, and again by firing twice.
 * - **Firing is free.** No macro may move the firer's Energy, Recharge excepted (upward).
 * - **A macro is not a card play.** `cardsPlayedThisTurn`, `playsThisTurn` and `lastProgramPlayed`
 *   are untouched — see `handleFireMacro`'s note for the reasoning, which is a reading and not a
 *   ruling.
 * - **A refused macro changes nothing at all**, so the slot the screen is about to spend is spent on
 *   a shot that landed.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer, canFireMacro } from './battleReducer';
import {
    BATTLE_MACRO_IDS,
    MACRO_IDS,
    MacroRegistry,
    REVIVE_PERCENT_MAX_HP,
} from './data/macroRegistry';
import type { IBattleEntity, IBattleState, ProgramEntity } from './types';

// =================================================================================================
// The board
// =================================================================================================

/**
 * Attack 45 against defense 30 is chosen so the damage formula lands on a whole number rather than a
 * rounding artefact, which is what lets the Surge case assert an exact figure and show its
 * arithmetic: `floor(8 × 30 × 45 / 30) / 45 = 8`. (8 is `CALIBRATION_LEVEL_DAMAGE_BASE`, 45 the
 * global divisor from `combatUtils`.)
 */
const ATTACK = 45;
const DEFENSE = 30;
const MAX_HP = 100;

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id,
        name: id.toUpperCase(),
        definitionId: 'test_def',
        blueprintsCollected: 0,
        attackIV: 0,
        defenseIV: 0,
        hpIV: 0,
        maxHp: MAX_HP,
        currentHp: MAX_HP,
        cardDraw: 1,
        maxEnergy: 3,
        currentEnergy: 3,
        attack: ATTACK,
        defense: DEFENSE,
        speed: 10,
        primaryElement: 'Fire',
        tempHp: 0,
        statusEffects: [],
        daemons: [],
        ...over,
    } as IBattleEntity;
}

function hand(...entries: Array<{ id: string; cost: number }>): ProgramEntity[] {
    // `water_slap` ("Tackle") is the generic filler every start deck carries: 0-cost, 12 power, one
    // plain ATTACK action and no constraints beyond the standard three. It is the card Echo replays
    // in these tests precisely because there is nothing clever about it to confuse the assertion.
    return entries.map((e) => ({ id: e.id, dataId: 'water_slap', currentCost: e.cost, isPlayable: true }));
}

function board(over: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'macro-test',
        seed: 'macro-seed',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: [unit('p1'), unit('p2')],
        enemyParty: [unit('e1', { primaryElement: 'Water' }), unit('e2', { primaryElement: 'Water' })],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: [],
            drawpile: hand({ id: 'd1', cost: 0 }, { id: 'd2', cost: 0 }, { id: 'd3', cost: 0 }),
            hand: hand({ id: 'h1', cost: 2 }),
            discard: [],
            exhaust: [],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [],
        osLogs: [],
        procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        ...over,
    } as IBattleState;
}

/** The target a macro of each targeting kind is legitimately aimed at on the board above. */
function defaultTargetFor(macroId: string, state: IBattleState): string {
    switch (MacroRegistry[macroId].targeting) {
        case 'ENEMY': return state.enemyParty[0].id;
        case 'ALLY': return state.playerParty[1].id;
        case 'DOWNED_ALLY': return state.playerParty.find((p) => p.currentHp <= 0)?.id ?? '';
        default: return state.playerParty[0].id;
    }
}

function fire(state: IBattleState, macroId: string, targetId?: string, sourceId = 'p1'): IBattleState {
    return battleReducer(state, {
        type: 'FIRE_MACRO',
        payload: { macroId, sourceId, targetId: targetId ?? defaultTargetFor(macroId, state) },
    });
}

const find = (state: IBattleState, id: string): IBattleEntity =>
    state.playerParty.find((e) => e.id === id) ?? state.enemyParty.find((e) => e.id === id)!;

const stacks = (state: IBattleState, id: string, status: string): number =>
    find(state, id).statusEffects.find((s) => s.type === status)?.stacks ?? 0;

// =================================================================================================
// The registry itself
// =================================================================================================

describe('the macro registry', () => {
    it('holds every macro the ruling names, plus ticket 07`s map-reveal', () => {
        // `macros-and-drivers.md` heads its list "The 11" and names twelve; the list is what was
        // designed, so every name in it ships (see the registry header). Plus the map-reveal.
        const expected = [
            'surge', 'mend', 'venom_shot', 'kindle', 'rally', 'cripple', 'salve',
            'free_exec', 'echo', 'cache_pull', 'recharge', 'revive',
            'ping_sweep',
        ];
        expect([...MACRO_IDS].sort()).toEqual([...expected].sort());
        expect(BATTLE_MACRO_IDS).toHaveLength(12);
    });

    it('marks exactly the five RARES as Rare', () => {
        const rares = MACRO_IDS.filter((id) => MacroRegistry[id].rarity === 'Rare').sort();
        expect(rares).toEqual(['cache_pull', 'echo', 'free_exec', 'recharge', 'revive']);
    });

    it('never says "power" in any player-facing string', () => {
        // POWER DIES AT THE SURFACE (map § Notes). The registry's descriptions are rendered
        // verbatim by the marketplace and the map's rack, so the law is enforced at the source.
        for (const id of MACRO_IDS) {
            const macro = MacroRegistry[id];
            expect(`${macro.name} ${macro.description}`).not.toMatch(/power/i);
        }
    });

    it('expresses every effect in the CARDS` action vocabulary', () => {
        // Ticket 15: macros resolve through the same executors cards do. A macro action type that
        // no executor knows would resolve to a console warning and a spent slot.
        const known = new Set([
            'ATTACK', 'STATUS', 'HEAL', 'DRAW', 'ENERGY', 'BUFF_NEXT_PROGRAM', 'PLAY_LAST_CARD',
            'REVIVE',
        ]);
        for (const id of BATTLE_MACRO_IDS) {
            for (const action of MacroRegistry[id].actions) {
                expect(known.has(action.type)).toBe(true);
            }
        }
    });
});

// =================================================================================================
// The seven standard macros
// =================================================================================================

describe('the standard macros', () => {
    it('surge deals 8 damage — 30 through the frozen calibration at 45 attack vs 30 defense', () => {
        const after = fire(board(), 'surge');
        expect(find(after, 'e1').currentHp).toBe(MAX_HP - 8);
        // Element None takes no STAB and no matchup multiplier, so the number is the same whoever
        // fires it into whatever biome — see the registry's note on `surge`.
        expect(find(after, 'e2').currentHp).toBe(MAX_HP);
    });

    it('mend restores 7 HP — a fixed 7.5% of the RECEIVER`s max HP, floored', () => {
        const hurt = board({ playerParty: [unit('p1'), unit('p2', { currentHp: 50 })] });
        const after = fire(hurt, 'mend', 'p2');
        expect(find(after, 'p2').currentHp).toBe(57);
    });

    it('mend never overheals past max HP', () => {
        const after = fire(board(), 'mend', 'p2');
        expect(find(after, 'p2').currentHp).toBe(MAX_HP);
    });

    it('venom shot applies exactly 3 Poison', () => {
        // Exactly 3: `PoisonBehavior.getScaledStacks` multiplies by the caster's attack only when a
        // `power` is supplied, and the STATUS mutation path supplies none. A high-attack member and
        // a low-attack one therefore apply the same 3.
        expect(stacks(fire(board(), 'venom_shot'), 'e1', 'Poison')).toBe(3);
    });

    it('kindle applies exactly 2 Burn', () => {
        expect(stacks(fire(board(), 'kindle'), 'e1', 'Burn')).toBe(2);
    });

    it('rally gives an ally 3 Strengthened', () => {
        expect(stacks(fire(board(), 'rally', 'p2'), 'p2', 'Strengthened')).toBe(3);
    });

    it('cripple applies 3 Weakened to an enemy', () => {
        expect(stacks(fire(board(), 'cripple'), 'e1', 'Weakened')).toBe(3);
    });

    it('salve gives an ally 3 Regen', () => {
        expect(stacks(fire(board(), 'salve', 'p2'), 'p2', 'Regen')).toBe(3);
    });
});

// =================================================================================================
// The five rares
// =================================================================================================

describe('free exec', () => {
    it('primes the firer so the next card costs nothing', () => {
        const after = fire(board(), 'free_exec');
        expect(find(after, 'p1').nextProgramModifier?.costReduction).toBeGreaterThan(0);
    });

    it('actually makes the next card free — the Energy is not spent', () => {
        // The end-to-end assertion, because the modifier existing and the modifier WORKING are two
        // different things: `getEffectiveCardCost` is where a discount becomes a price.
        const primed = fire(board(), 'free_exec');
        const energyBefore = find(primed, 'p1').currentEnergy;
        const played = battleReducer(primed, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' },
        });
        expect(find(played, 'p1').currentEnergy).toBe(energyBefore);
        // And the card really resolved: `water_slap` is 12 power, which is 3 damage on this board.
        expect(find(played, 'e1').currentHp).toBeLessThan(MAX_HP);
    });
});

describe('echo', () => {
    /** Play Tackle at `targetId`, so there is a last card to replay. */
    function afterOneCard(state: IBattleState, targetId = 'e1'): IBattleState {
        return battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId, programId: 'h1' },
        });
    }

    it('replays the last card for free, dealing the same damage again', () => {
        const played = afterOneCard(board());
        const firstHit = MAX_HP - find(played, 'e1').currentHp;
        expect(firstHit).toBeGreaterThan(0);

        const echoed = fire(played, 'echo', 'e1');
        expect(MAX_HP - find(echoed, 'e1').currentHp).toBe(firstHit * 2);
        // Free: no Energy moved, and the card was not drawn or discarded a second time.
        expect(find(echoed, 'p1').currentEnergy).toBe(find(played, 'p1').currentEnergy);
        expect(echoed.playerDeck.discard).toHaveLength(played.playerDeck.discard.length);
    });

    it('refuses — and changes NOTHING — when no card has been played yet', () => {
        // A rare consumable spent on the log line "no program was played previously" would be the
        // worst possible outcome, so this is a refusal rather than a fizzle.
        const fresh = board();
        expect(canFireMacro(fresh, { macroId: 'echo', sourceId: 'p1', targetId: 'e1' }))
            .toBe('nothing-to-echo');
        expect(fire(fresh, 'echo', 'e1')).toBe(fresh);
    });

    /**
     * THE DEAD-TARGET QUESTION, ANSWERED.
     *
     * `IBattleState.lastProgramPlayed` is a **dataId and nothing else** — no instance, no target, no
     * source. So there is no original target to be stale: Echo takes a fresh one from the player
     * every time, and a dead original is simply not on the board to pick. That is why the macro is
     * declared `targeting: 'ENEMY'` rather than replaying at some remembered victim.
     */
    it('re-aims: the original target being dead is not Echo`s problem', () => {
        const played = afterOneCard(board({
            enemyParty: [unit('e1', { currentHp: 1 }), unit('e2')],
        }), 'e1');
        expect(find(played, 'e1').currentHp).toBe(0);

        const echoed = fire(played, 'echo', 'e2');
        expect(find(echoed, 'e2').currentHp).toBeLessThan(MAX_HP);
        // The corpse is not hit again — the standard alive-check still applies to every action.
        expect(find(echoed, 'e1').currentHp).toBe(0);
    });

    it('refuses a dead target rather than fizzling on it', () => {
        const played = afterOneCard(board({
            enemyParty: [unit('e1', { currentHp: 1 }), unit('e2')],
        }), 'e1');
        expect(canFireMacro(played, { macroId: 'echo', sourceId: 'p1', targetId: 'e1' })).toBe('bad-target');
        expect(fire(played, 'echo', 'e1')).toBe(played);
    });
});

describe('cache pull', () => {
    it('draws exactly 2 cards into the firer`s hand', () => {
        const before = board();
        const after = fire(before, 'cache_pull');
        expect(after.playerDeck.hand).toHaveLength(before.playerDeck.hand.length + 2);
        expect(after.playerDeck.drawpile).toHaveLength(before.playerDeck.drawpile.length - 2);
    });
});

describe('recharge', () => {
    /**
     * THE TRAP THE RULING NAMES: *"`Recharge` must ADD energy mid-turn — `processPreTurn` SETS
     * `currentEnergy`, and that is the trap that bit three OSes."*
     *
     * Every case below starts from an energy value that is NOT the unit's maximum, which is the only
     * way to tell an add from a set: on a full pool the two agree.
     */
    it('ADDS 1 to a partly spent pool — it does not refill it', () => {
        const spent = board({ playerParty: [unit('p1', { currentEnergy: 1, maxEnergy: 3 }), unit('p2')] });
        const after = fire(spent, 'recharge');
        expect(find(after, 'p1').currentEnergy).toBe(2);   // an ADD
        expect(find(after, 'p1').currentEnergy).not.toBe(3); // a SET to maxEnergy
        expect(find(after, 'p1').maxEnergy).toBe(3);        // and the cap itself is untouched
    });

    it('ADDS from empty', () => {
        const empty = board({ playerParty: [unit('p1', { currentEnergy: 0, maxEnergy: 3 }), unit('p2')] });
        expect(find(fire(empty, 'recharge'), 'p1').currentEnergy).toBe(1);
    });

    it('stacks: two Recharges are +2, which no SET can produce', () => {
        const spent = board({ playerParty: [unit('p1', { currentEnergy: 1, maxEnergy: 3 }), unit('p2')] });
        expect(find(fire(fire(spent, 'recharge'), 'recharge'), 'p1').currentEnergy).toBe(3);
    });

    it('goes ABOVE max energy rather than clamping to it', () => {
        // The clearest possible statement that this is not the pre-turn path: `processPreTurn` can
        // never produce more than `maxEnergy + Energized`, and this does.
        const full = board({ playerParty: [unit('p1', { currentEnergy: 3, maxEnergy: 3 }), unit('p2')] });
        expect(find(fire(full, 'recharge'), 'p1').currentEnergy).toBe(4);
    });
});

describe('revive', () => {
    const withDowned = () => board({ playerParty: [unit('p1'), unit('p2', { currentHp: 0 })] });

    it('brings a downed ally back at half their health', () => {
        const after = fire(withDowned(), 'revive', 'p2');
        expect(find(after, 'p2').currentHp).toBe(Math.floor(MAX_HP * REVIVE_PERCENT_MAX_HP / 100));
    });

    it('makes them a real unit again: they can be healed, hit and targeted', () => {
        const revived = fire(withDowned(), 'revive', 'p2');
        // Death is derived from `currentHp <= 0` everywhere in this engine — there is no flag to
        // clear — so a revived unit is legal for every other action the moment its HP is back.
        const healed = fire(revived, 'mend', 'p2');
        expect(find(healed, 'p2').currentHp).toBeGreaterThan(find(revived, 'p2').currentHp);
    });

    it('refuses a LIVING ally — it is a rescue, not a percentage heal', () => {
        const alive = board();
        expect(canFireMacro(alive, { macroId: 'revive', sourceId: 'p1', targetId: 'p2' })).toBe('bad-target');
        expect(fire(alive, 'revive', 'p2')).toBe(alive);
    });

    it('refuses a downed ENEMY — the rack revives your side only', () => {
        const state = board({ enemyParty: [unit('e1', { currentHp: 0 }), unit('e2')] });
        expect(canFireMacro(state, { macroId: 'revive', sourceId: 'p1', targetId: 'e1' })).toBe('bad-target');
    });
});

// =================================================================================================
// The map-reveal, seen from the battle
// =================================================================================================

describe('the map-reveal in a battle', () => {
    it('is refused outright rather than resolving to nothing', () => {
        const state = board();
        expect(canFireMacro(state, { macroId: 'ping_sweep', sourceId: 'p1', targetId: 'p1' })).toBe('map-only');
        // The slot survives: `BattleArena` only dispatches `consumeMacro` when this says null.
        expect(fire(state, 'ping_sweep')).toBe(state);
    });
});

// =================================================================================================
// The laws that hold for ALL of them
// =================================================================================================

describe('every battle macro', () => {
    /**
     * A board every macro has a legal target on: a firer, a hurt living ally (for Mend, Rally,
     * Salve) and a downed one (for Revive). Sharing one board across the sweeps is what makes them
     * sweeps — a per-macro board would let a macro pass because its board happened to suit it.
     */
    const sweepBoard = () => board({
        playerParty: [unit('p1'), unit('p2', { currentHp: 40 }), unit('p3', { currentHp: 0 })],
        // A card has already been played this battle, which is what Echo needs to be firable at all.
        lastProgramPlayed: 'water_slap',
    });

    it('fires and changes the board', () => {
        for (const id of BATTLE_MACRO_IDS) {
            const before = sweepBoard();
            const after = fire(before, id);
            expect(canFireMacro(before, {
                macroId: id, sourceId: 'p1', targetId: defaultTargetFor(id, before),
            })).toBeNull();
            expect(after).not.toBe(before);
        }
    });

    it('costs the firer NO Energy — Recharge excepted, upward', () => {
        // `macros-and-drivers.md`: "fired free on your turn." The exception is the macro whose whole
        // job is Energy, and it may only ever go up.
        for (const id of BATTLE_MACRO_IDS) {
            const before = sweepBoard();
            const after = fire(before, id);
            const spent = find(before, 'p1').currentEnergy;
            const left = find(after, 'p1').currentEnergy;
            if (id === 'recharge') expect(left).toBeGreaterThan(spent);
            else expect(left).toBe(spent);
        }
    });

    it('is NOT a card play — no counter a card moves is touched', () => {
        /**
         * A READING, NOT A RULING — flagged as such. No ticket says whether a macro counts as a card
         * play, and `handleFireMacro`'s header argues the case: `CARDS_PLAYED` scalers (`stampede`,
         * `momentum_crash`) are deliberately uncapped because they reward playing out of your deck,
         * and a bought consumable that inflated them would be a multiplier you can purchase. The
         * same argument covers the per-unit OS card limit and Echo's own "last CARD" wording.
         */
        for (const id of BATTLE_MACRO_IDS) {
            const before = { ...sweepBoard(), cardsPlayedThisTurn: 2, lastProgramPlayed: 'water_slap' };
            before.playerParty = before.playerParty.map((p) => ({ ...p, playsThisTurn: 1 }));
            const after = fire(before, id);

            expect(after.cardsPlayedThisTurn).toBe(2);
            expect(after.lastProgramPlayed).toBe('water_slap');
            expect(find(after, 'p1').playsThisTurn).toBe(1);
            expect(find(after, 'p1').nextProgramModifier === undefined || id === 'free_exec').toBe(true);
        }
    });

    it('leaves no card in a pile it was not already in — a macro is not a card', () => {
        for (const id of BATTLE_MACRO_IDS) {
            const before = sweepBoard();
            const after = fire(before, id);
            expect(after.playerDeck.discard).toHaveLength(0);
            expect(after.playerDeck.exhaust).toHaveLength(0);
            // Cache Pull is the one macro that legitimately moves cards, and only into the hand.
            const handDelta = after.playerDeck.hand.length - before.playerDeck.hand.length;
            expect(handDelta).toBe(id === 'cache_pull' ? 2 : 0);
        }
    });

    it('is refused, byte-identically, outside the player`s turn', () => {
        for (const id of BATTLE_MACRO_IDS) {
            const enemyTurn = { ...sweepBoard(), activeSide: 'ENEMY' as const };
            expect(canFireMacro(enemyTurn, {
                macroId: id, sourceId: 'p1', targetId: defaultTargetFor(id, enemyTurn),
            })).toBe('not-your-turn');
            expect(fire(enemyTurn, id)).toBe(enemyTurn);
        }
    });

    it('is refused when the firing unit is down', () => {
        // Only the FIRER is down — downing the whole party would trip the battle-over guard first
        // and this case would pass for the wrong reason.
        for (const id of BATTLE_MACRO_IDS) {
            const state = board({
                playerParty: [unit('p1', { currentHp: 0 }), unit('p2', { currentHp: 40 }), unit('p3', { currentHp: 0 })],
            });
            expect(canFireMacro(state, {
                macroId: id, sourceId: 'p1', targetId: defaultTargetFor(id, state),
            })).toBe('no-source');
        }
    });

    it('is refused once the fight is over', () => {
        for (const id of BATTLE_MACRO_IDS) {
            const won = board({ enemyParty: [unit('e1', { currentHp: 0 }), unit('e2', { currentHp: 0 })] });
            expect(canFireMacro(won, { macroId: id, sourceId: 'p1', targetId: 'e1' })).toBe('battle-over');
        }
    });

    it('is refused during any phase but ACTION', () => {
        for (const id of BATTLE_MACRO_IDS) {
            const state = { ...sweepBoard(), phase: 'POST_TURN' as const };
            expect(canFireMacro(state, {
                macroId: id, sourceId: 'p1', targetId: defaultTargetFor(id, state),
            })).toBe('wrong-phase');
        }
    });
});

describe('an unknown macro id', () => {
    it('is refused rather than crashing a render or a reducer', () => {
        const state = board();
        expect(canFireMacro(state, { macroId: 'no_such_macro', sourceId: 'p1', targetId: 'e1' }))
            .toBe('unknown-macro');
        expect(battleReducer(state, {
            type: 'FIRE_MACRO',
            payload: { macroId: 'no_such_macro', sourceId: 'p1', targetId: 'e1' },
        })).toBe(state);
    });
});
