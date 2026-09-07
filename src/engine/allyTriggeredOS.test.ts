/**
 * TICKET 141 — any ally may pull the trigger; the firmware pays its owner.
 *
 * WHY THIS FILE EXISTS. Ticket 140's comp grid split the whole 3v3 field on one firmware: comps
 * containing kraken_v1 averaged 68 and the other 108 averaged 27. The cause was not the ally
 * trigger by itself — it was ABYSSAL_INK stacking three things at once (fires on ANY ally's
 * effect-draw, pays out on EVERY enemy, and pays in Dazed, which is uncapped). Either half alone
 * measures as an ordinary firmware. So 141a shrinks the payoff to one enemy and keeps the trigger,
 * and 141b-j give the other nine firmwares the trigger half they were missing.
 *
 * THE ENGINE FACT THE WHOLE TICKET RESTS ON: `when.source: "ALLY"` matches SAME SIDE, owner
 * included (`ConditionValidator` L42 — it compares which party the source is on, and never
 * excludes the owner). That is why seven of these rows are 1v1-invariant by construction: with one
 * body, the ally set IS the owner, so the hook fires exactly as often as it did before. Only 141d
 * (skoll_v2, whose own Fire attacks now charge her) and 141e (a stack change) move a 1v1 number,
 * and both carry a measured gate.
 *
 * WHAT EACH TEST HAS TO PROVE, per §3 of the ticket: an ALLY's action fires the hook, and an
 * ENEMY's does not. The second half is the one that matters — `source: "OPPONENT"` and
 * `source: "ALLY"` are one word apart in the data, and a firmware that pays the enemy's actions
 * is invisible in the log and reads only as a deck that mysteriously underperforms.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { ProgramRegistry } from './data/programRegistry';
import type { IBattleState, IBattleEntity } from './types';

const FRAME = 1000;

function unit(id: string, name: string, activeOS?: string): IBattleEntity {
    return createSparseEntity({
        id, name, activeOS,
        currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
    });
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter(s => s.type === type).reduce((n, s) => n + s.stacks, 0);

/**
 * A 3v3 board. `casterId` plays `dataId` at `targetId` — the caster may be on EITHER side, which
 * is how each row's "an enemy's action does not fire it" half is expressed.
 */
function play(
    opts: {
        playerOS: Array<string | undefined>,
        enemyOS?: Array<string | undefined>,
        dataId: string,
        casterId: string,
        targetId: string,
        drawpile?: number,
    },
): IBattleState {
    const casterIsEnemy = opts.casterId.startsWith('e');
    const pile = Array.from({ length: opts.drawpile ?? 0 }, (_, i) => (
        { id: `d${i}`, dataId: 'baseline_jab', currentCost: 0, isPlayable: true }
    ));
    const deck = {
        ownerId: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        deck: [], drawpile: pile, discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId: opts.dataId, currentCost: ProgramRegistry[opts.dataId].baseCost as number, isPlayable: true }],
    };
    const empty = { ownerId: '', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] };
    const state: IBattleState = createSparseBattleState({
        activeSide: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        phase: 'ACTION',
        playerParty: opts.playerOS.map((os, i) => unit(`p${i + 1}`, `Ally ${i + 1}`, os)),
        enemyParty: (opts.enemyOS ?? [undefined, undefined, undefined])
            .map((os, i) => unit(`e${i + 1}`, `Foe ${i + 1}`, os)),
        playerDeck: casterIsEnemy ? { ...empty, ownerId: 'PLAYER' } : deck,
        enemyDeck: casterIsEnemy ? deck : { ...empty, ownerId: 'ENEMY' },
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: opts.casterId, targetId: opts.targetId, programId: 'h1' },
    } as never);
}

describe('141a — ABYSSAL_INK pays one enemy, not the side', () => {
    it('an ally\'s effect-draw Dazes exactly one enemy', () => {
        const state = play({
            playerOS: [undefined, 'kraken_v1', undefined],
            dataId: 'forage', casterId: 'p1', targetId: 'p1', drawpile: 2,
        });
        const dazed = state.enemyParty.map(e => stacks(e, 'Dazed'));
        expect(dazed.filter(n => n === 2)).toHaveLength(1);
        expect(dazed.reduce((a, b) => a + b, 0)).toBe(2);
    });

    it('the ally trigger survives the nerf — a body that is NOT Kraken still fires it', () => {
        // This is the half of ABYSSAL_INK the ticket deliberately keeps: the synergy, not the size.
        const state = play({
            playerOS: ['kraken_v1', undefined, undefined],
            dataId: 'forage', casterId: 'p3', targetId: 'p3', drawpile: 2,
        });
        expect(state.enemyParty.reduce((n, e) => n + stacks(e, 'Dazed'), 0)).toBe(2);
    });

    it('an ENEMY drawing a card does not feed the player\'s Kraken', () => {
        const state = play({
            playerOS: ['kraken_v1', undefined, undefined],
            dataId: 'forage', casterId: 'e1', targetId: 'e1', drawpile: 2,
        });
        // The enemy's own draw may only ever reach the enemy's own firmware. Nobody on the player
        // side holds one here, so the board must be clean of Dazed entirely.
        expect(state.playerParty.every(e => stacks(e, 'Dazed') === 0)).toBe(true);
        expect(state.enemyParty.every(e => stacks(e, 'Dazed') === 0)).toBe(true);
    });
});

describe('141b — allies\' attacks feed fenrir_v1, and only his own cost him HP', () => {
    it('his own attack still nets 2 Strengthened and 2% recoil — 1v1 is unchanged to the decimal', () => {
        // Both hooks match his own cast (ALLY includes the owner), so 1+1 = the 2 he always had.
        const state = play({
            playerOS: ['fenrir_v1', undefined, undefined],
            dataId: 'fire_poke', casterId: 'p1', targetId: 'e1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(2);
        expect(state.playerParty[0].currentHp).toBe(FRAME - Math.floor(FRAME * 0.02));
    });

    it('an ally\'s attack pays 1 Strengthened and costs Fenrir nothing', () => {
        const state = play({
            playerOS: ['fenrir_v1', undefined, undefined],
            dataId: 'fire_poke', casterId: 'p2', targetId: 'e1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(1);
        expect(state.playerParty[0].currentHp, 'the recoil is a price for his OWN cast').toBe(FRAME);
    });

    it('an enemy attacking pays him nothing', () => {
        const state = play({
            playerOS: ['fenrir_v1', undefined, undefined],
            dataId: 'fire_poke', casterId: 'e1', targetId: 'p2',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });
});

describe('141d — allies\' Fire attacks charge skoll_v2', () => {
    it('an ally\'s Fire attack gives her 1 Strengthened', () => {
        const state = play({
            playerOS: ['skoll_v2', undefined, undefined],
            dataId: 'fire_poke', casterId: 'p2', targetId: 'e1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(1);
    });

    it('a NON-Fire attack does not — the element gate is the whole point of the row', () => {
        const state = play({
            playerOS: ['skoll_v2', undefined, undefined],
            dataId: 'baseline_jab', casterId: 'p2', targetId: 'e1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });

    it('an enemy\'s Fire attack does not', () => {
        const state = play({
            playerOS: ['skoll_v2', undefined, undefined],
            dataId: 'fire_poke', casterId: 'e1', targetId: 'p2',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });
});

describe('141e — skoll_v1 keeps her 1-stack trigger; the PAYOFF card is the knob', () => {
    /*
     * WHY THIS ROW LOOKS LIKE A CARD CHANGE AND NOT A HOOK CHANGE. TREACHERY was already
     * ally-triggered — she is the one firmware in the roster that ticket 141 had nothing to open —
     * so the row was a pure 1v1 rescue for a deck sitting at 34.4. The ticket offered two arms:
     * e1 doubled the trigger to 2 Strengthened, e2 left the trigger alone and paid more per stack
     * on `sun_devourer`. Measured, e1 overshot to 61.9 — above the 45-60 gate — exactly as the
     * ticket predicted it might, because an enemy attacking two or three times a turn is +4-6
     * uncapped Strength a turn. e2 ships.
     *
     * The ticket guessed 25 power a stack for e2 and that undershot at 41.9. 30 measures 49.1,
     * which is inside the gate and as close to 50 as this knob gets in fives.
     */
    it('an enemy attack on an ally gives her 1 Strengthened — the trigger is unchanged', () => {
        const state = play({
            playerOS: ['skoll_v1', undefined, undefined],
            dataId: 'baseline_jab', casterId: 'e1', targetId: 'p2',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(1);
    });

    it('her own side hitting the enemy gives her nothing', () => {
        const state = play({
            playerOS: ['skoll_v1', undefined, undefined],
            dataId: 'baseline_jab', casterId: 'p2', targetId: 'e1',
        });
        expect(stacks(state.playerParty[0], 'Strengthened')).toBe(0);
    });

    it('sun_devourer pays 30 a stack — the measured number, not the ticket\'s guess of 25', () => {
        const card = ProgramRegistry.sun_devourer;
        const hit = card.actions.find(a => a.type === 'ATTACK');
        expect(hit?.power).toBe(30);
        expect(hit?.scaling).toBe('STATUS_CONSUMED');
        expect(card.description).toContain('30 power per stack consumed');
    });

    it('and it still scales with the pile it eats', () => {
        const damageAt = (strength: number): number => {
            const skoll = createSparseEntity({
                id: 'p1', name: 'Skoll', activeOS: 'skoll_v1',
                currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
                statusEffects: [{ id: 's', type: 'Strengthened', stacks: strength }] as never,
            });
            const before: IBattleState = createSparseBattleState({
                activeSide: 'PLAYER', phase: 'ACTION',
                playerParty: [skoll],
                enemyParty: [unit('e1', 'Foe')],
                playerDeck: {
                    ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                    hand: [{ id: 'h1', dataId: 'sun_devourer', currentCost: 2, isPlayable: true }],
                },
            });
            const after = battleReducer(before, {
                type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' },
            } as never);
            return FRAME - after.enemyParty[0].currentHp;
        };
        expect(damageAt(8)).toBeGreaterThan(damageAt(4));
        expect(damageAt(4)).toBeGreaterThan(0);
    });
});

describe('141f — huldra_v1 mirrors an ALLY\'s buff, and still refuses a debuff', () => {
    it('an ally buffing themselves twice puts 2 Weakened on the enemy side', () => {
        // iron_bark is two applications (3 Sharp, 2 Regen), so the mirror fires twice — the
        // payoff stays single-target, which is why this is 2 stacks and not 6.
        const state = play({
            playerOS: ['huldra_v1', undefined, undefined],
            dataId: 'iron_bark', casterId: 'p2', targetId: 'p2',
        });
        expect(state.enemyParty.reduce((n, e) => n + stacks(e, 'Weakened'), 0)).toBe(2);
    });

    it('an ally applying a DEBUFF to themselves does not — the ticket-107 guard', () => {
        // scald is the case the guard exists for: it Dazes its own caster. Without
        // statusAppliedNotIn, opening the trigger to the side would have turned every self-cost
        // in the game into free Weakened.
        const state = play({
            playerOS: ['huldra_v1', undefined, undefined],
            dataId: 'scald', casterId: 'p2', targetId: 'e1',
        });
        expect(state.enemyParty.reduce((n, e) => n + stacks(e, 'Weakened'), 0)).toBe(0);
    });

    it('an ENEMY buffing themselves does not', () => {
        const state = play({
            playerOS: ['huldra_v1', undefined, undefined],
            dataId: 'iron_bark', casterId: 'e1', targetId: 'e1',
        });
        expect(state.enemyParty.reduce((n, e) => n + stacks(e, 'Weakened'), 0)).toBe(0);
    });
});

describe('141h — GOSSIP_NODE heals the ally who played the free card', () => {
    it('the CASTER is healed, not the whole side', () => {
        const hurt = (e: IBattleEntity): IBattleEntity => ({ ...e, currentHp: FRAME / 2 });
        let state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER', phase: 'ACTION',
            playerParty: [
                hurt(unit('p1', 'Ratatoskr', 'ratatoskr_v1')),
                hurt(unit('p2', 'Ally')),
                hurt(unit('p3', 'Other')),
            ],
            enemyParty: [unit('e1', 'Foe')],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'h1', dataId: 'water_slap', currentCost: 0, isPlayable: true }],
            },
        });
        state = battleReducer(state, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p2', targetId: 'e1', programId: 'h1' },
        } as never);

        // 2.5% of a 1000 frame = 25.
        expect(state.playerParty[1].currentHp).toBe(FRAME / 2 + 25);
        expect(state.playerParty[0].currentHp, 'Ratatoskr is not paid for it').toBe(FRAME / 2);
        expect(state.playerParty[2].currentHp, 'and neither is the third body').toBe(FRAME / 2);
    });
});

describe('141i — INSTIGATOR reads any ally\'s free card', () => {
    it('an ally\'s 0-cost at an enemy Dazes that enemy', () => {
        const state = play({
            playerOS: ['ratatoskr_v2', undefined, undefined],
            dataId: 'baseline_jab', casterId: 'p2', targetId: 'e2',
        });
        expect(stacks(state.enemyParty[1], 'Dazed')).toBe(1);
        expect(stacks(state.enemyParty[0], 'Dazed'), 'the payoff stays on the target').toBe(0);
    });

    it('an ally\'s 1-cost card does not', () => {
        const state = play({
            playerOS: ['ratatoskr_v2', undefined, undefined],
            dataId: 'fire_poke', casterId: 'p2', targetId: 'e2',
        });
        expect(stacks(state.enemyParty[1], 'Dazed')).toBe(0);
    });
});

describe('141j — OUROBOROS counts the SIDE\'s Water cards', () => {
    it('five Water cards spread across three bodies draws for Jormungandr', () => {
        const hand = Array.from({ length: 5 }, (_, i) => (
            { id: `w${i}`, dataId: 'scald', currentCost: 0, isPlayable: true }
        ));
        let state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER', phase: 'ACTION',
            playerParty: [unit('p1', 'Jormungandr', 'jormungandr_v1'), unit('p2', 'Ally'), unit('p3', 'Other')],
            enemyParty: [unit('e1', 'Foe')],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [{ id: 'd1', dataId: 'baseline_jab', currentCost: 0, isPlayable: true }],
                discard: [], exhaust: [], hand,
            },
        });
        // p2, p3, p2, p3 — four Water cards from bodies that are NOT the owner, then his own fifth.
        for (const [i, caster] of ['p2', 'p3', 'p2', 'p3', 'p1'].entries()) {
            state = battleReducer(state, {
                type: 'PLAY_PROGRAM', payload: { sourceId: caster, targetId: 'e1', programId: `w${i}` },
            } as never);
        }
        expect(state.logs.some(l => l.includes('OUROBOROS_LOOP triggers'))).toBe(true);
        expect(state.playerDeck.drawpile, 'the draw is his, and it happened').toHaveLength(0);
    });

    it('four is not five', () => {
        const hand = Array.from({ length: 4 }, (_, i) => (
            { id: `w${i}`, dataId: 'scald', currentCost: 0, isPlayable: true }
        ));
        let state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER', phase: 'ACTION',
            playerParty: [unit('p1', 'Jormungandr', 'jormungandr_v1'), unit('p2', 'Ally'), unit('p3', 'Other')],
            enemyParty: [unit('e1', 'Foe')],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [{ id: 'd1', dataId: 'baseline_jab', currentCost: 0, isPlayable: true }],
                discard: [], exhaust: [], hand,
            },
        });
        for (const [i, caster] of ['p2', 'p3', 'p2', 'p3'].entries()) {
            state = battleReducer(state, {
                type: 'PLAY_PROGRAM', payload: { sourceId: caster, targetId: 'e1', programId: `w${i}` },
            } as never);
        }
        expect(state.logs.some(l => l.includes('OUROBOROS_LOOP triggers'))).toBe(false);
    });
});

describe('141g — the BARK_SHIELD wall covers the side', () => {
    it('Huldra takes 50 and each living ally takes 25, once', () => {
        let state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER', phase: 'ACTION',
            playerParty: [unit('p1', 'Huldra', 'huldra_v2'), unit('p2', 'Ally'), unit('p3', 'Other')],
            enemyParty: [unit('e1', 'Foe'), unit('e2', 'Foe B')],
            playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
        });
        expect(state.playerParty[0].statusEffects.find(s => s.type === 'BarkShield')).toBeUndefined();

        state = battleReducer(state, { type: 'END_TURN' } as never);
        expect(stacks(state.playerParty[0], 'BarkShield')).toBe(50);
        expect(stacks(state.playerParty[1], 'BarkShield')).toBe(25);
        expect(stacks(state.playerParty[2], 'BarkShield')).toBe(25);
        expect(state.enemyParty.every(e => stacks(e, 'BarkShield') === 0), 'never the other side').toBe(true);

        // Once per battle: the guard counter is shared with the ally grant, so a full round must
        // not re-shield anybody.
        state = battleReducer(state, { type: 'END_TURN' } as never);
        state = battleReducer(state, { type: 'END_TURN' } as never);
        expect(state.logs.filter(l => l.includes('BARK_SHIELD_OS activates'))).toHaveLength(1);
    });
});
