import { describe, it, expect, vi } from 'vitest';
import { battleReducer } from './battleReducer';
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
    level: 1,
    experience: 0,
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
    levelUpQueue: [],
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

describe('Item 1 - AUDHUMBLA v2 NOURISH_ROUTINE (real overheal)', () => {
    it('converts healOverride overflow into exact Light damage on a random enemy', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v2', currentHp: 95 });
        const enemy = makeUnit('e1', 'Enemy');
        // card_heal_flat: healOverride 20 on SELF. 95/100 -> applied 5, overheal 15.
        let state = makeState([aud], [enemy], [card('c1', 'card_heal_flat', 1)]);
        state = play(state, 'aud1', 'aud1', 'c1');

        expect(state.playerParty[0].currentHp).toBe(100);
        expect(state.enemyParty[0].currentHp).toBe(85); // 100 - 15 overflow
        expect(state.logs.some(l => l.includes('NOURISH_ROUTINE'))).toBe(true);
    });

    it('converts power-based (calculateHeal) overflow — the clamp no longer eats it', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v2', currentHp: 95 });
        const enemy = makeUnit('e1', 'Enemy');
        // card_heal_power: power 25, target maxHp 100. docs/power_curve_spec.md rev 3:
        // calculateHeal = maxHp * power / 400 = 100 * 25 / 400 = 6.25 -> intended heal 6.
        // 95/100 -> applied 5 (clamped to missing HP), overheal 1.
        let state = makeState([aud], [enemy], [card('c1', 'card_heal_power', 1)]);
        state = play(state, 'aud1', 'aud1', 'c1');

        expect(state.playerParty[0].currentHp).toBe(100);
        expect(state.enemyParty[0].currentHp).toBe(99); // 100 - 1 overflow
    });

    it('a heal fully absorbed by missing HP procs nothing', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v2', currentHp: 50 });
        const enemy = makeUnit('e1', 'Enemy');
        let state = makeState([aud], [enemy], [card('c1', 'card_heal_power', 1)]);
        state = play(state, 'aud1', 'aud1', 'c1');

        expect(state.playerParty[0].currentHp).toBe(56); // 50 + 6, no overflow
        expect(state.enemyParty[0].currentHp).toBe(100);
        expect(state.logs.some(l => l.includes('NOURISH_ROUTINE'))).toBe(false);
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

describe('Item 3 - VALKYRIE v1 VALHALLA_UPLINK (real buff statuses)', () => {
    it('applying Energized to an ally heals them 5% max HP', () => {
        const valk = makeUnit('valk1', 'Valkyrie', { activeOS: 'valkyrie_v1' });
        const ally = makeUnit('ally1', 'Ally', { currentHp: 50 });
        let state = makeState([valk, ally], [makeUnit('e1', 'Enemy')]);

        state = battleReducer(state, {
            type: 'APPLY_STATUS',
            payload: { targetId: 'ally1', sourceId: 'valk1', status: 'Energized', stacks: 1 }
        });

        expect(state.playerParty[1].currentHp).toBe(55);
    });

    it('applying BarkShield to an ally heals them too', () => {
        const valk = makeUnit('valk1', 'Valkyrie', { activeOS: 'valkyrie_v1' });
        const ally = makeUnit('ally1', 'Ally', { currentHp: 50 });
        let state = makeState([valk, ally], [makeUnit('e1', 'Enemy')]);

        state = battleReducer(state, {
            type: 'APPLY_STATUS',
            payload: { targetId: 'ally1', sourceId: 'valk1', status: 'BarkShield', stacks: 5 }
        });

        expect(state.playerParty[1].currentHp).toBe(55);
    });

    it('self-buffs still do not proc the heal', () => {
        const valk = makeUnit('valk1', 'Valkyrie', { activeOS: 'valkyrie_v1', currentHp: 50 });
        let state = makeState([valk], [makeUnit('e1', 'Enemy')]);

        state = battleReducer(state, {
            type: 'APPLY_STATUS',
            payload: { targetId: 'valk1', sourceId: 'valk1', status: 'Energized', stacks: 1 }
        });

        expect(state.playerParty[0].currentHp).toBe(50);
    });
});

describe('Item 4 - AUDHUMBLA v1 GENESIS_FIRMWARE (3rd Heal/Skill exactly)', () => {
    it('grants +1 max energy on exactly the 3rd Heal/Skill card', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v1', currentHp: 10 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_heal_power', 1),
            card('c2', 'card_draw_test', 1),
            card('c3', 'card_heal_power', 1)
        ]);

        state = play(state, 'aud1', 'aud1', 'c1'); // Heal #1
        expect(state.playerParty[0].maxEnergy).toBe(5);
        state = play(state, 'aud1', 'aud1', 'c2'); // Skill #2
        expect(state.playerParty[0].maxEnergy).toBe(5);
        state = play(state, 'aud1', 'aud1', 'c3'); // Heal #3 -> reward
        expect(state.playerParty[0].maxEnergy).toBe(6);
        expect(state.counters['audhumbla_genesis:aud1']).toBe(0);
    });

    it('an Attack card as "card 3" does not trigger the payout', () => {
        const aud = makeUnit('aud1', 'Audhumbla', { activeOS: 'audhumbla_v1', currentHp: 10 });
        let state = makeState([aud], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_heal_power', 1),
            card('c2', 'card_draw_test', 1),
            card('c3', 'card_strike', 1),
            card('c4', 'card_heal_power', 1)
        ]);

        state = play(state, 'aud1', 'aud1', 'c1'); // Heal #1
        state = play(state, 'aud1', 'aud1', 'c2'); // Skill #2
        state = play(state, 'aud1', 'e1', 'c3'); // Attack — must not count nor pay out
        expect(state.playerParty[0].maxEnergy).toBe(5);
        expect(state.counters['audhumbla_genesis:aud1']).toBe(2);
        state = play(state, 'aud1', 'aud1', 'c4'); // Heal #3 -> reward
        expect(state.playerParty[0].maxEnergy).toBe(6);
    });
});

describe('Item 5 - per-unit OS counters', () => {
    it('two audhumbla_v1 units count Heal/Skill plays independently', () => {
        const aud1 = makeUnit('aud1', 'Audhumbla A', { activeOS: 'audhumbla_v1', currentHp: 10 });
        const aud2 = makeUnit('aud2', 'Audhumbla B', { activeOS: 'audhumbla_v1', currentHp: 10 });
        let state = makeState([aud1, aud2], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_heal_power', 1),
            card('c2', 'card_heal_power', 1),
            card('c3', 'card_heal_power', 1),
            card('c4', 'card_heal_power', 1)
        ]);

        state = play(state, 'aud1', 'aud1', 'c1'); // A: 1
        state = play(state, 'aud1', 'aud1', 'c2'); // A: 2
        state = play(state, 'aud2', 'aud2', 'c3'); // B: 1 (global would be 3 -> false payout)

        expect(state.playerParty[0].maxEnergy).toBe(5);
        expect(state.playerParty[1].maxEnergy).toBe(5);
        expect(state.counters['audhumbla_genesis:aud1']).toBe(2);
        expect(state.counters['audhumbla_genesis:aud2']).toBe(1);

        state = play(state, 'aud1', 'aud1', 'c4'); // A: 3 -> only A rewarded
        expect(state.playerParty[0].maxEnergy).toBe(6);
        expect(state.playerParty[1].maxEnergy).toBe(5);
    });
});

describe('Item 6 - HRAESVELGR v2 dead data removed', () => {
    it('hooks.json contains no onDeckShuffled trigger anywhere', () => {
        expect(JSON.stringify(HOOKS_DATA)).not.toContain('onDeckShuffled');
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
    it('Status card primes; the NEXT card spends the charge (Attack: discounted)', () => {
        const gullin = makeUnit('gul1', 'Gullinbursti', { activeOS: 'gullinbursti_v1' });
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

        // Next card is an Attack: discounted to 0, charge consumed.
        state = play(state, 'gul1', 'e1', 'c3');
        expect(state.playerParty[0].currentEnergy).toBe(4); // cost 1 - 1 = 0
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

describe('Item 9 - YMIR v2 GLACIAL_PACE_OS (2-card limit + Ice bonus)', () => {
    it('silently rejects the third card played by a ymir_v2 unit in one turn', () => {
        const ymir = makeUnit('ym1', 'Ymir', { activeOS: 'ymir_v2' });
        let state = makeState([ymir], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_strike', 1),
            card('c2', 'card_strike', 1),
            card('c3', 'card_strike', 1)
        ]);

        state = play(state, 'ym1', 'e1', 'c1');
        state = play(state, 'ym1', 'e1', 'c2');
        expect(state.playerParty[0].playsThisTurn).toBe(2);
        expect(state.playerParty[0].currentEnergy).toBe(3);

        const after = play(state, 'ym1', 'e1', 'c3');
        expect(after).toBe(state); // state unchanged, no log spam
        expect(after.playerDeck.hand).toHaveLength(1);
    });

    it('the limit resets when the turn cycles back to the player', () => {
        const ymir = makeUnit('ym1', 'Ymir', { activeOS: 'ymir_v2' });
        let state = makeState([ymir], [makeUnit('e1', 'Enemy')], [
            card('c1', 'card_strike', 1),
            card('c2', 'card_strike', 1),
            card('c3', 'card_strike', 1)
        ]);

        state = play(state, 'ym1', 'e1', 'c1');
        state = play(state, 'ym1', 'e1', 'c2');
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

    it('registry exposes maxCardsPerTurn: 2 for ymir_v2 only where declared', () => {
        expect(getOSBehavior('ymir_v2')!.maxCardsPerTurn).toBe(2);
        expect(getOSBehavior('fenrir_v1')!.maxCardsPerTurn).toBeUndefined();
    });

    it('Ice cards from a ymir_v2 unit deal exactly +50% through the real reducer', () => {
        const runAttack = (activeOS?: string): number => {
            // Level 20, not the default 1: under the rev-3.1 pace (ticket 23, /45) a 20-power
            // card at level 1 floors to 0 damage, which makes a +35% assertion meaningless.
            const attacker = makeUnit('a1', 'Attacker', { level: 20, ...(activeOS ? { activeOS } : {}) });
            let state = makeState([attacker], [makeUnit('e1', 'Enemy', { level: 20 })], [
                card('c1', 'card_ice_strike', 1)
            ]);
            state = play(state, 'a1', 'e1', 'c1');
            return 100 - state.enemyParty[0].currentHp;
        };

        const withoutOS = runAttack();
        const withOS = runAttack('ymir_v2');
        expect(withoutOS).toBeGreaterThan(0);
        expect(withOS).toBe(withoutOS + Math.floor(withoutOS * 0.35)); // ticket 09: softened to ~1.35x
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
            card('c1', 'gust_jab', 0)
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
