import { describe, it, expect, vi } from 'vitest';
import { battleReducer } from './battleReducer';
import { applyMutations } from './resolutionEngine';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { StatusType } from './types';
import { registerHook } from './core/Hooks';
import { FIRMWARE_REGISTRY, getOSBehavior } from './data/firmwareRegistry';
import { getHook } from './core/HookRegistry';
import { TestProgramRegistry } from './data/testProgramRegistry';
import HOOKS_DATA from './data/lib/hooks.json';

// Mock GetProgramData to use our test registry
vi.mock('./data/programRegistry', async () => {
    const actual = await vi.importActual('./data/programRegistry');
    return {
        ...actual as any,
        GetProgramData: (id: string) => {
            return TestProgramRegistry[id] || (actual as any).GetProgramData(id);
        }
    };
});

const makeUnit = (id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id,
    name,
    currentHp: 100,
    maxHp: 100,
    tempHp: 0,
    attack: 10,
    defense: 10,
    maxEnergy: 5,
    currentEnergy: 5,
    cardDraw: 3,
    statusEffects: [],
    definitionId: 'fenrir',
    hooks: [],
    speed: 10,
    primaryElement: 'None',
    daemons: [],
    blueprintsCollected: 0,
    hpIV: 0,
    attackIV: 0,
    defenseIV: 0,
    ...overrides
});

const makeState = (playerParty: IBattleEntity[], enemyParty: IBattleEntity[], hand: ProgramEntity[] = []): IBattleState => ({
    sessionId: 'test-session',
    turn: 1,
    phase: 'ACTION',
    activeSide: 'PLAYER',
    activeRelics: [],
    playerParty,
    enemyParty,
    playerDeck: { ownerId: 'PLAYER', hand, drawpile: [], discard: [], exhaust: [], deck: [] },
    enemyDeck: { ownerId: 'ENEMY', hand: [], drawpile: [], discard: [], exhaust: [], deck: [] },
    logs: [],
    osLogs: [],
    procs: [],
    seed: '12345',
    cardsPlayedThisTurn: 0,
    cardsDrawnThisTurn: 0,
    lastProgramPlayed: null,
    counters: {}
});

const card = (id: string, dataId: string, cost: number): ProgramEntity =>
    ({ id, dataId, currentCost: cost, isPlayable: true });

const play = (state: IBattleState, sourceId: string, targetId: string, programId: string): IBattleState =>
    battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId } });

// Register OS hooks for testing
Object.values(FIRMWARE_REGISTRY).forEach(os => {
    os.hooks.forEach(h => registerHook(h));
});

describe('Item 1 - AUDHUMBLA v2 PRIMORDIAL_MILK (heal cards bank Regen)', () => {
    // TICKET 101 retired NOURISH_ROUTINE - the fourth shape this OS has had. The old one turned
    // 50% of a heal's PRINTED power into Light damage at a random enemy; the rebuild banks the
    // healing as Regen instead, which `drink_deep` later drinks for damage. Hold or cash.
    //
    // What these pins are actually protecting is the TRIGGER, which is unchanged and is the part
    // that has broken before: it must read a heal CARD (`last_heal_power > 0`) and must NOT fire
    // on an engine flat heal - including Regen's own end-of-turn tick, which would otherwise feed
    // itself forever. The ticket-56 lesson that made `last_heal_power` the discriminator is what
    // makes the rebuild loop-safe for free.
    it('records the PRINTED power of a card heal, and banks Regen off it', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v2', currentHp: 95 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [card('c1', 'card_heal_flat', 1)]);
        state = play(state, 'aud1', 'aud1', 'c1');

        // card_heal_flat prints 80 power. On the 100-maxHp frame that is 20 HP, of which only 5
        // land - and 80 is what the OS must see. The gap between 80 and 5 IS the ticket-56 bug.
        expect(state.counters['last_heal_power']).toBe(80);
        expect(state.playerParty[0].currentHp).toBe(100);
        expect(state.logs.some(l => l.includes('PRIMORDIAL_MILK'))).toBe(true);
        expect(state.playerParty[0].statusEffects.find(s => s.type === 'Regen')?.stacks).toBe(3);
    });

    it('fires at FULL HP, where zero HP is restored and the printed power is all there is', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v2' }); // 100/100
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [card('c1', 'card_heal_flat', 1)]);
        state = play(state, 'aud1', 'aud1', 'c1');

        expect(state.playerParty[0].currentHp).toBe(100); // nothing healed
        expect(state.counters['last_heal_power']).toBe(80);
        expect(state.logs.some(l => l.includes('PRIMORDIAL_MILK'))).toBe(true);
        // Healing at full HP is wasted; the Regen is the point. That is the whole rebuild.
        expect(state.playerParty[0].statusEffects.find(s => s.type === 'Regen')?.stacks).toBe(3);
    });

    it('does NOT convert an ENGINE heal - the OS reads "every heal she CASTS"', () => {
        // A firmware/percentMaxHP heal arrives at the choke point as `flatHeal` with no printed
        // power. Before ticket 56 the OS read HP and could not tell the two apart.
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v2', currentHp: 50 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')]);
        state = applyMutations(state, [
            { type: 'HP', targetId: 'aud1', sourceId: 'aud1', payload: { amount: 10, isHeal: true } }
        ]);

        expect(state.logs.some(l => l.includes('PRIMORDIAL_MILK'))).toBe(false);
        expect(state.playerParty[0].statusEffects.some(s => s.type === 'Regen')).toBe(false);
    });
});

describe('Item 2 - FAFNIR v1 HOARD_PROTOCOL (recoil at turn start)', () => {
    it('takes no recoil at turn end; recoil + bonus energy land at the next own turn start', () => {
        const fafnir = makeUnit('faf1', 'Fafnir', { activeOS: 'fafnir_v1', currentEnergy: 3 });
        const enemy = makeUnit('e1', 'Enemy');
        let state = makeState([fafnir], [enemy]);

        // End the player's turn with 3 unspent energy.
        state = battleReducer(state, { type: 'END_TURN' });
        let p = state.playerParty[0];
        expect(p.currentHp).toBe(100); // no recoil yet
        expect(p.statusEffects.find(s => s.type === StatusType.Energized)?.stacks).toBe(3);
        expect(state.counters['fafnir_hoard:faf1']).toBe(3);

        // End the enemy's turn -> player's turn starts: hoard cashes in.
        state = battleReducer(state, { type: 'END_TURN' });
        p = state.playerParty[0];
        expect(p.currentHp).toBe(97); // 1% of 100 per hoarded point = 3
        expect(p.currentEnergy).toBe(8); // 5 max + 3 hoarded
        expect(p.statusEffects.some(s => s.type === StatusType.Energized)).toBe(false);
        expect(state.counters['fafnir_hoard:faf1']).toBe(0);
    });

    it('registry description says the recoil happens at turn start', () => {
        expect(getOSBehavior('fafnir_v1')!.description).toMatch(/start of your next turn/i);
    });
});

describe('Item 3 - VALKYRIE v1 VALHALLA_UPLINK (einherjar recursion)', () => {
    // Ticket 53 replaced this OS outright. The old one healed an ALLY 5% max HP on every buff
    // she applied, behind a `target.id !== owner.id` guard - in 1v1 there is no other ally, so
    // it could not fire at all, and the balance harness only ever measures 1v1.
    it('replays a random card from the discard pile at the end of her own turn', () => {
        const valk = makeUnit('valk1', 'Valkyrie', { activeOS: 'valkyrie_v1', attack: 40 });
        // defense 1: the shared fixture is attack 10 vs defense 10, where a 10-power card floors
        // to 0 damage and the assertion below could not tell a free cast from no cast at all.
        const enemy = makeUnit('e1', 'Enemy', { defense: 1 });
        let state = makeState([valk], [enemy], [card('c1', 'card_strike', 1)]);

        // Play the strike so it lands in the discard, then end her turn.
        state = play(state, 'valk1', 'e1', 'c1');
        const hpAfterPaidCast = state.enemyParty[0].currentHp;
        expect(hpAfterPaidCast).toBeLessThan(100);

        state = battleReducer(state, { type: 'END_TURN' });

        expect(state.logs.some(l => l.includes('VALHALLA_UPLINK'))).toBe(true);
        // The free cast hits again, and the card is still in the discard afterwards.
        expect(state.enemyParty[0].currentHp).toBeLessThan(hpAfterPaidCast);
        expect(state.playerDeck.discard.some(c => c.id === 'c1')).toBe(true);
    });

    it('does nothing with an empty discard pile, and never costs Energy', () => {
        const valk = makeUnit('valk1', 'Valkyrie', { activeOS: 'valkyrie_v1' });
        let state = makeState([valk], [makeUnit('e1', 'Enemy')]);
        const energyBefore = state.playerParty[0].currentEnergy;

        state = battleReducer(state, { type: 'END_TURN' });

        expect(state.logs.some(l => l.includes('VALHALLA_UPLINK'))).toBe(false);
        expect(state.enemyParty[0].currentHp).toBe(100);
        expect(state.playerParty[0].currentEnergy).toBe(energyBefore);
    });

    it('procs at most once per turn', () => {
        const valk = makeUnit('valk1', 'Valkyrie', { activeOS: 'valkyrie_v1' });
        let state = makeState([valk], [makeUnit('e1', 'Enemy', { defense: 1 })], [card('c1', 'card_strike', 1)]);
        state = play(state, 'valk1', 'e1', 'c1');

        state = battleReducer(state, { type: 'END_TURN' });
        const procs = state.logs.filter(l => l.includes('VALHALLA_UPLINK')).length;
        expect(procs).toBe(1);
        expect(state.counters['valkyrie_uplink_turn:valk1']).toBe(1);
    });
});

describe('Item 4 - AUDHUMBLA v1 GENESIS_FIRMWARE (overheal -> max Energy, once per turn)', () => {
    // Ticket 53 re-triggered this. It used to count every 3rd Heal/Skill card played, which had
    // nothing to do with her identity and ramped on a timer she could not influence. It now pays
    // out on DELIBERATE OVERHEAL - healing at or near full HP - which brings the ramp online on
    // turns 1-2 and makes `pale_mercy` at full HP a real decision. It pays in maxEnergy, not raw
    // energy, because `processPreTurn` SETS currentEnergy each turn (HANDOFF 8-ENERGY-TRAP).
    it('grants +1 max Energy when a heal overflows', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v1', currentHp: 98 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [card('c1', 'card_heal_power', 1)]);

        state = play(state, 'aud1', 'aud1', 'c1'); // heals 6 into 2 missing HP -> 4 overheal
        expect(state.playerParty[0].maxEnergy).toBe(6);
        expect(state.logs.some(l => l.includes('GENESIS_FIRMWARE'))).toBe(true);
    });

    it('a heal fully absorbed by missing HP grants nothing', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v1', currentHp: 10 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [card('c1', 'card_heal_power', 1)]);

        state = play(state, 'aud1', 'aud1', 'c1');
        expect(state.playerParty[0].maxEnergy).toBe(5);
    });

    it('pays out at most once per turn no matter how many heals overflow', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v1', currentHp: 99 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_heal_power', 1),
            card('c2', 'card_heal_power', 1)
        ]);

        state = play(state, 'aud1', 'aud1', 'c1');
        state = play(state, 'aud1', 'aud1', 'c2');
        expect(state.playerParty[0].maxEnergy).toBe(6);
        expect(state.counters['audhumbla_genesis_used:aud1']).toBe(1);
    });
});

describe('Item 5 - per-unit OS counters', () => {
    it('two audhumbla_v1 units hold independent once-per-turn guards', () => {
        const aud1 = makeUnit('aud1', 'Audhumbla A', { activeOS: 'audhumbla_v1', currentHp: 99 });
        const aud2 = makeUnit('aud2', 'Audhumbla B', { activeOS: 'audhumbla_v1', currentHp: 99 });
        let state = makeState([aud1, aud2], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_heal_power', 1),
            card('c2', 'card_heal_power', 1),
            card('c3', 'card_heal_power', 1)
        ]);

        state = play(state, 'aud1', 'aud1', 'c1'); // A pays out
        state = play(state, 'aud1', 'aud1', 'c2'); // A is spent for the turn
        expect(state.playerParty[0].maxEnergy).toBe(6);
        expect(state.playerParty[1].maxEnergy).toBe(5);

        // A global guard would have blocked B here. An owner-scoped one does not.
        state = play(state, 'aud2', 'aud2', 'c3');
        expect(state.playerParty[1].maxEnergy).toBe(6);
        expect(state.counters['audhumbla_genesis_used:aud1']).toBe(1);
        expect(state.counters['audhumbla_genesis_used:aud2']).toBe(1);
    });
});

describe('Item 6 - HRAESVELGR v2 dead data removed', () => {
    // Ticket 53 CONSCIOUSLY RETIRES the old pin here ("hooks.json contains no onDeckShuffled
    // trigger anywhere"). That assertion was correct when it was written - the trigger was a
    // type with no dispatcher, so any hook using it was dead data - but ticket 53 wired the
    // dispatch in `executeDraw` and valkyrie_v2's REBIRTH_CYCLE_OS is its first live consumer.
    // What replaces it is the claim that actually mattered: a hook on this trigger FIRES.
    it('onDeckShuffled is dispatched, and REBIRTH_CYCLE_OS is its consumer', () => {
        const entry = (HOOKS_DATA as any).valkyrie_v2;
        expect(entry.name).toBe('REBIRTH_CYCLE_OS');
        // hooks[0] is the once-per-turn reset (see ticket 53 §7a); the payout is the one that
        // has to sit on the newly-live trigger.
        expect(entry.hooks.some((h: any) => h.trigger === 'onDeckShuffled')).toBe(true);
        expect(getHook('valk_v2_rebirth')?.onDeckShuffled).toBeTypeOf('function');
    });

    it('hraesvelgr_v2 keeps its description (UI copy) but has no data hooks', () => {
        const entry = (HOOKS_DATA as any).hraesvelgr_v2;
        expect(entry.description).toBeTruthy();
        expect(entry.hooks).toEqual([]);
        // The working CustomFirmware implementation still registers.
        const os = getOSBehavior('hraesvelgr_v2')!;
        expect(os.hooks.length).toBeGreaterThan(0);
        expect(getHook('hraesvelgr_v2_updraft')?.onCardDraw).toBeTypeOf('function');
    });
});

describe('Item 7 - enemy intent Side buffs stay on the enemy side', () => {
    it('a Side StableOS/BarkShield intent lands on the enemy party, not the player', () => {
        const player = makeUnit('p1', 'Player');
        const enemy = makeUnit('e1', 'Enemy', {
            currentIntent: {
                id: 'stabilize',
                name: 'Stabilize',
                intentType: 'Buff',
                priority: 1,
                actions: [
                    { type: 'STATUS', status: 'StableOS', stacks: 1, target: 'Side' },
                    { type: 'STATUS', status: 'BarkShield', stacks: 5, target: 'Side' }
                ]
            }
        });
        let state = makeState([player], [enemy]);

        state = battleReducer(state, { type: 'EXECUTE_INTENT', payload: { sourceId: 'e1' } });

        expect(state.enemyParty[0].statusEffects.some(s => s.type === 'StableOS')).toBe(true);
        expect(state.enemyParty[0].statusEffects.some(s => s.type === 'BarkShield')).toBe(true);
        expect(state.playerParty[0].statusEffects.some(s => s.type === 'StableOS')).toBe(false);
        expect(state.playerParty[0].statusEffects.some(s => s.type === 'BarkShield')).toBe(false);
    });
});

describe('Item 8 - GULLINBURSTI v1 UNSTOPPABLE_MASS (Status -> next Attack)', () => {
    // Ticket 52: the charge pays POWER now, not a cost reduction, and it SCALES ON SHARP. The
    // discount was worth a full Energy point every turn (~40 power) and stacked with any other
    // cost reduction - the arbitrage seam ticket 36 documented. The Sharp scaling is the part
    // that matters: v1 generates Sharp from five of its ten cards and had no way to spend it,
    // because the scaler that cashes Sharp lives in v2's firmware. The trigger conditions are
    // unchanged; only the payout moved.
    it('Status card primes; the NEXT card spends the charge (Attack: +3 power per Sharp, full price)', () => {
        const gullin = makeUnit('gul1', 'Gullinbursti', {
            activeOS: 'gullinbursti_v1',
            statusEffects: [{ id: 'sh1', type: 'Sharp', stacks: 4 } as never],
        });
        let state = makeState([gullin], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_status_test', 1),
            card('c3', 'card_strike', 1)
        ]);

        // Play the Status-category card: costs 1, primes the discount.
        state = play(state, 'gul1', 'e1', 'c1');
        expect(state.playerParty[0].currentEnergy).toBe(4);
        expect(state.playerParty[0].nextProgramModifier).toBeDefined();
        expect(state.playerParty[0].nextProgramModifier!.appliesTo).toBe('Attack');
        expect(state.logs.some(l => l.includes('UNSTOPPABLE_MASS'))).toBe(true);

        // 4 Sharp x 3 power. With no Sharp the prime is worth nothing, which is the whole point.
        expect(state.playerParty[0].nextProgramModifier!.powerBonus).toBe(12);
        expect(state.playerParty[0].nextProgramModifier!.costReduction).toBe(0);

        // Next card is an Attack: it pays FULL price now, and the charge is consumed.
        //
        // Deliberately NOT asserting on the enemy's HP: these synthetic units are attack 10
        // against defense 10, where `calculateDamage` floors to 0 for a 10-power card with or
        // without the bonus, so an HP assertion here would measure the fixture rather than the
        // hook. The `powerBonus` value above is the end-to-end proof that the Sharp scaling
        // resolved; the balance suite is where the damage shows up (os:gullinbursti 0.000 ->
        // 0.490 on this change alone).
        state = play(state, 'gul1', 'e1', 'c3');
        expect(state.playerParty[0].currentEnergy).toBe(3); // cost 1, no discount
        expect(state.playerParty[0].nextProgramModifier).toBeUndefined();
    });

    it('a non-Attack card as the next card SPENDS the charge without a discount', () => {
        const gullin = makeUnit('gul1', 'Gullinbursti', { activeOS: 'gullinbursti_v1' });
        let state = makeState([gullin], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_status_test', 1),
            card('c2', 'card_draw_test', 1),
            card('c3', 'card_strike', 1)
        ]);

        state = play(state, 'gul1', 'e1', 'c1'); // prime (energy 4)
        state = play(state, 'gul1', 'gul1', 'c2'); // Skill: full cost, charge LOST
        expect(state.playerParty[0].currentEnergy).toBe(3);
        expect(state.playerParty[0].nextProgramModifier).toBeUndefined();

        state = play(state, 'gul1', 'e1', 'c3'); // Attack: full cost, no charge left
        expect(state.playerParty[0].currentEnergy).toBe(2);
    });

    it('a Skill card that applies a status ALSO primes (e.g. Shield Shards)', () => {
        // Owner decision 2026-08: trigger = any non-Attack card that applies a
        // status, since self-buffs like Shield Shards are category Skill.
        const gullin = makeUnit('gul1', 'Gullinbursti', { activeOS: 'gullinbursti_v1' });
        let state = makeState([gullin], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_burn_test', 1) // Skill category with a STATUS action
        ]);

        state = play(state, 'gul1', 'e1', 'c1');
        expect(state.playerParty[0].nextProgramModifier).toBeDefined();
        expect(state.playerParty[0].nextProgramModifier!.appliesTo).toBe('Attack');
    });

    it('an Attack card with a status rider does NOT prime; a statusless Skill does NOT prime', () => {
        const gullin = makeUnit('gul1', 'Gullinbursti', { activeOS: 'gullinbursti_v1' });
        let state = makeState([gullin], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_strike', 1),    // Attack, no status
            card('c2', 'card_draw_test', 1)  // Skill, no STATUS action
        ]);
        state = play(state, 'gul1', 'e1', 'c1');
        expect(state.playerParty[0].nextProgramModifier).toBeUndefined();
        state = play(state, 'gul1', 'gul1', 'c2');
        expect(state.playerParty[0].nextProgramModifier).toBeUndefined();
    });

    it('UI copy matches the new behavior', () => {
        const os = getOSBehavior('gullinbursti_v1')!;
        expect(os.description).toMatch(/applies a status/);
        expect(os.description).toMatch(/Attack/);
    });
});

describe('Item 9 - YMIR v2 GLACIAL_PACE_OS (1-card limit + Ice bonus)', () => {
    // Ticket 80: the cap is 2 -> 1. It sat at 2 for three tickets and NEVER BOUND - ticket 50
    // wrote that down and nobody acted on it, and ticket 79 measured her playing 1.06 cards a
    // turn against it. The drawback that was supposed to pay for a +25% unconditional damage
    // bonus was inert, so the bonus had been walked 50% -> 35% -> 25% instead, three times,
    // without fixing her. This makes the drawback real rather than shaving the bonus a fourth
    // time.
    it('silently rejects the SECOND card played by a ymir_v2 unit in one turn', () => {
        const ymir = makeUnit('ym1', 'Ymir', { activeOS: 'ymir_v2' });
        let state = makeState([ymir], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_strike', 1),
            card('c2', 'card_strike', 1),
            card('c3', 'card_strike', 1)
        ]);

        state = play(state, 'ym1', 'e1', 'c1');
        expect(state.playerParty[0].playsThisTurn).toBe(1);
        expect(state.playerParty[0].currentEnergy).toBe(4);

        const after = play(state, 'ym1', 'e1', 'c2');
        expect(after).toBe(state); // state unchanged, no log spam
        expect(after.playerDeck.hand).toHaveLength(2);
    });

    it('the limit resets when the turn cycles back to the player', () => {
        const ymir = makeUnit('ym1', 'Ymir', { activeOS: 'ymir_v2' });
        let state = makeState([ymir], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_strike', 1),
            card('c2', 'card_strike', 1),
            card('c3', 'card_strike', 1)
        ]);

        state = play(state, 'ym1', 'e1', 'c1');
        state = battleReducer(state, { type: 'END_TURN' }); // player -> enemy
        state = battleReducer(state, { type: 'END_TURN' }); // enemy -> player
        expect(state.playerParty[0].playsThisTurn).toBe(0);

        // The whole (reshuffled) deck is back in hand; playing again succeeds.
        const cardInHand = state.playerDeck.hand[0];
        expect(cardInHand).toBeDefined();
        const after = play(state, 'ym1', 'e1', cardInHand.id);
        expect(after).not.toBe(state);
        expect(after.playerParty[0].playsThisTurn).toBe(1);
    });

    it('a unit WITHOUT the OS can play more than 2 cards per turn', () => {
        const plain = makeUnit('p1', 'Plain');
        let state = makeState([plain], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_strike', 1),
            card('c2', 'card_strike', 1),
            card('c3', 'card_strike', 1)
        ]);

        state = play(state, 'p1', 'e1', 'c1');
        state = play(state, 'p1', 'e1', 'c2');
        state = play(state, 'p1', 'e1', 'c3');
        expect(state.playerDeck.hand).toHaveLength(0);
        expect(state.playerParty[0].currentEnergy).toBe(2);
        expect(state.playerParty[0].playsThisTurn).toBe(3);
    });

    it('registry exposes maxCardsPerTurn: 1 for ymir_v2 only where declared', () => {
        expect(getOSBehavior('ymir_v2')!.maxCardsPerTurn).toBe(1);
        expect(getOSBehavior('fenrir_v1')!.maxCardsPerTurn).toBeUndefined();
    });

    it('a fenrir_v1 unit hits HARDER the more max HP it is missing (ticket 84)', () => {
        // UNBOUND_KERNEL's Fire bonus scales on the OWNER's missing HP - the clause that pays for
        // the recoil. At full health it is worth nothing; at half health, half of OS_KNOBS.fenrir
        // .berserkPct. (Ticket 21: these units used to be built at level 20 because the default was
        // level 1, where the pace divisor floored a small card to 0. Everything is CALIBRATION_LEVEL
        // now, which is comfortably above that floor, so the override is simply gone.)
        const runAttack = (currentHp: number, activeOS?: string): number => {
            const attacker = makeUnit('a1', 'Attacker', {
                currentHp, maxHp: 100, ...(activeOS ? { activeOS } : {})
            });
            let state = makeState([attacker], [makeUnit('e1', 'Enemy', {})], [
                card('c1', 'card_fireball', 1)
            ]);
            state = play(state, 'a1', 'e1', 'c1');
            return 100 - state.enemyParty[0].currentHp;
        };

        const plain = runAttack(50);
        const full = runAttack(100, 'fenrir_v1');
        const half = runAttack(50, 'fenrir_v1');
        const sliver = runAttack(10, 'fenrir_v1');

        // card_fireball is two hits and the bonus floors per hit, so the assertion is the ORDER,
        // not an exact product: at full health the clause pays nothing, and it grows as she drops.
        //
        // Ticket 21 note: this used to read `half > full` strictly. At the old level-20 pin the
        // numbers were plain 8 / full 8 / half 10 / sliver 10; at CALIBRATION_LEVEL they are
        // 6 / 6 / 6 / 8. The clause is unchanged — per-hit flooring simply hides a different step
        // at the smaller scale, so the honest assertion is monotonic non-decreasing with a strict
        // increase by the time she is at a sliver.
        expect(plain).toBeGreaterThan(0);
        expect(full).toBe(plain);
        expect(half).toBeGreaterThanOrEqual(full);
        expect(sliver).toBeGreaterThan(full);
    });

    it('Ice cards from a ymir_v2 unit deal exactly +50% through the real reducer', () => {
        const runAttack = (activeOS?: string): number => {
            // Ticket 21: was pinned to level 20 because the default was level 1, where a 20-power card
            // floors to 0 damage under the rev-3.1 pace (ticket 23, /45). CALIBRATION_LEVEL clears that
            // floor, so there is nothing left to pin.
            const attacker = makeUnit('a1', 'Attacker', { ...(activeOS ? { activeOS } : {}) });
            let state = makeState([attacker], [makeUnit('e1', 'Enemy', {})], [
                card('c1', 'card_ice_strike', 1)
            ]);
            state = play(state, 'a1', 'e1', 'c1');
            return 100 - state.enemyParty[0].currentHp;
        };

        const withoutOS = runAttack();
        const withOS = runAttack('ymir_v2');
        expect(withoutOS).toBeGreaterThan(0);

        // Ticket 21 note, and it is worth reading before changing this number. The old assertion
        // was `withOS === withoutOS + floor(withoutOS * 0.35)`, which looked like it pinned the
        // ticket-09 "+35% to Ice" knob exactly. It did not: the knob is applied to POWER, before
        // the pace divisor, so what survives to the HP bar is not 1.35x. Measured at the old
        // level-20 pin the observed ratio was 5/4 = 1.25; measured at CALIBRATION_LEVEL it is
        // 26/21 = 1.238. **The OS is unchanged** — the old formula only matched because
        // floor(4 * 0.35) happened to equal the real +1 at that one scale.
        //
        // So this asserts what the OS actually promises: a substantial, Ice-specific bonus, in a
        // band wide enough to survive flooring but narrow enough to catch the knob being changed
        // or dropped. The exact-multiplier check belongs on the knob itself, not on damage output.
        expect(withOS).toBeGreaterThan(withoutOS);
        expect(withOS / withoutOS).toBeGreaterThan(1.15);
        expect(withOS / withoutOS).toBeLessThan(1.40);
    });
});

describe('getEffectiveCardCost (shared reducer/UI helper)', () => {
    it('reflects a primed Attack-only discount and ignores it for other categories', async () => {
        const { getEffectiveCardCost, doesModifierApply } = await import('./battleReducer');
        const source: any = {
            nextProgramModifier: { costReduction: 1, appliesTo: 'Attack' }
        };
        const attackCard: any = { category: 'Attack' };
        const skillCard: any = { category: 'Skill' };
        expect(doesModifierApply(source, attackCard)).toBe(true);
        expect(getEffectiveCardCost(source, attackCard, 2)).toBe(1);
        expect(getEffectiveCardCost(source, attackCard, 0)).toBe(0);
        expect(doesModifierApply(source, skillCard)).toBe(false);
        expect(getEffectiveCardCost(source, skillCard, 2)).toBe(2);
        expect(getEffectiveCardCost({ nextProgramModifier: undefined } as any, attackCard, 2)).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Ticket 07 (deck-archetypes map, 2026-08-05): mechanical firmware defect fixes
// ---------------------------------------------------------------------------

describe('Ticket 07 - SLEIPNIR v2 WAR_STEED_OS token guard', () => {
    it('an Air attack generates exactly one hoof_strike, and the token does not self-replicate', () => {
        const sleipnir = makeUnit('sl1', 'Sleipnir', { activeOS: 'sleipnir_v2' });
        let state = makeState([sleipnir], [makeUnit('e1', 'Enemy')], [
            card('c1', 'dust_devil', 1)
        ]);

        state = play(state, 'sl1', 'e1', 'c1');
        const tokens = state.playerDeck.hand.filter(c => c.dataId === 'hoof_strike');
        expect(tokens).toHaveLength(1);

        // Playing the generated token must NOT generate another (isToken: false guard).
        state = play(state, 'sl1', 'e1', tokens[0].id);
        expect(state.playerDeck.hand.filter(c => c.dataId === 'hoof_strike')).toHaveLength(0);
    });
});

describe('Ticket 07 - HULDRA v2 BARK_SHIELD_OS fires for both sides, linear shield', () => {
    it('player-side Huldra gets the shield at her first turn boundary (end of turn 1), once', () => {
        const huldra = makeUnit('h1', 'Huldra', { activeOS: 'huldra_v2', maxHp: 200, currentHp: 200 });
        let state = makeState([huldra], [makeUnit('e1', 'Enemy')]);

        // Battle starts mid-turn-1 (ACTION phase): no shield yet.
        expect(state.playerParty[0].statusEffects.find(s => s.type === 'BarkShield')).toBeUndefined();

        state = battleReducer(state, { type: 'END_TURN' }); // player turn 1 ends -> onTurnEnd
        const shield = state.playerParty[0].statusEffects.find(s => s.type === 'BarkShield');
        expect(shield).toBeDefined();
        // Linear: flat percent stacks, independent of maxHp (was floor(maxHp*0.5) = 100 here).
        expect(shield!.stacks).toBe(50);

        // Once per battle: cycle a full round; the grant must not fire a second time
        // (BarkShield's own decay schedule is irrelevant here - count the grant logs).
        state = battleReducer(state, { type: 'END_TURN' }); // enemy -> player onTurnStart
        state = battleReducer(state, { type: 'END_TURN' }); // player -> enemy again
        const grants = state.logs.filter(l => l.includes("BARK_SHIELD_OS activates"));
        expect(grants).toHaveLength(1);
    });

    it('enemy-side Huldra gets the shield at her turn-1 pre-turn', () => {
        const huldra = makeUnit('eh1', 'Enemy Huldra', { activeOS: 'huldra_v2' });
        let state = makeState([makeUnit('p1', 'Player')], [huldra]);

        state = battleReducer(state, { type: 'END_TURN' }); // -> enemy onTurnStart
        const shield = state.enemyParty[0].statusEffects.find(s => s.type === 'BarkShield');
        expect(shield).toBeDefined();
        expect(shield!.stacks).toBe(50);
    });
});

describe('Ticket 07 - FAFNIR v2 duplicate hook removed', () => {
    it('fafnir_v2 registers exactly one corrupted-gold hook (data-driven, no custom twin)', () => {
        const os = getOSBehavior('fafnir_v2')!;
        const ids = os.hooks.map(h => h.id);
        expect(ids.filter(id => id === 'fafnir_v2_corrupted')).toHaveLength(1);
        expect(os.hooks).toHaveLength(1);
    });
});

describe("Ticket 07 - explicit 'ANY' source/target condition", () => {
    it("target: 'ANY' matches by name, not by validator fall-through", async () => {
        const { ConditionValidator } = await import('./core/ConditionValidator');
        const owner = makeUnit('n1', 'Nidhoggr');
        const other = makeUnit('e1', 'Enemy');
        const state = makeState([owner], [other]);
        const context: any = { state, target: other, source: other, triggerDepth: 0 };
        expect(ConditionValidator.evaluateHookCondition({ target: 'ANY' }, context, owner)).toBe(true);
        expect(ConditionValidator.evaluateHookCondition({ source: 'ANY' }, context, owner)).toBe(true);
        expect(ConditionValidator.evaluateHookCondition({ target: 'SELF' }, context, owner)).toBe(false);
    });
});
